import os
import sys
import time
import json
import subprocess
import threading
import shutil
import numpy as np
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

def get_battery_info():
    cmd = [
        'powershell', '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; '
        '$p = [System.Windows.Forms.SystemInformation]::PowerStatus; '
        '@{ PowerLine = $p.PowerLineStatus.ToString(); BatteryPercent = $p.BatteryLifePercent; Charge = $p.BatteryChargeStatus.ToString() } | ConvertTo-Json -Compress'
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(res.stdout.strip())
    except Exception as e:
        return {'PowerLine': 'Unknown', 'BatteryPercent': 0, 'Error': str(e)}

def get_ffmpeg_bin():
    which_ffmpeg = shutil.which("ffmpeg")
    if which_ffmpeg:
        return which_ffmpeg
    return "ffmpeg"

def decode_audio_ffmpeg(file_path: str):
    ffmpeg_bin = get_ffmpeg_bin()
    cmd = [
        ffmpeg_bin,
        "-nostdin",
        "-threads", "0",
        "-v", "error",
        "-i", file_path,
        "-f", "f32le",
        "-ac", "1",
        "-ar", "16000",
        "-"
    ]
    t0 = time.perf_counter()
    res = subprocess.run(cmd, capture_output=True, check=True)
    t1 = time.perf_counter()
    arr = np.frombuffer(res.stdout, dtype=np.float32)
    decode_time = t1 - t0
    audio_dur = len(arr) / 16000.0
    return arr, decode_time, audio_dur

class DmonLogger:
    def __init__(self, output_csv):
        self.output_csv = output_csv
        self.proc = None

    def start(self):
        # nvidia-smi dmon -s pucv -d 1
        cmd = ['nvidia-smi', 'dmon', '-s', 'pucv', '-d', '1']
        with open(self.output_csv, 'w', encoding='utf-8') as f:
            self.proc = subprocess.Popen(cmd, stdout=f, stderr=subprocess.DEVNULL)
        time.sleep(1.2) # Allow dmon header to write

    def stop(self):
        if self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except:
                self.proc.kill()
            self.proc = None

def parse_dmon_csv(csv_path):
    rows = []
    if not os.path.exists(csv_path):
        return rows
    with open(csv_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split()
            # dmon -s pucv columns:
            # # gpu   pwr gtemp mtemp    sm   mem   enc   dec  mclk  pclk  pviolation  tviolation
            # Note format varies by driver, let's store parts
            rows.append(parts)
    return rows

def run_whisper_benchmark():
    from faster_whisper import WhisperModel
    import ctranslate2

    print("================================================================================")
    print("WHISPER BENCHMARK: 328s Hindi vs 328s English (small, float16, beam 1 vs 5)")
    print("================================================================================\n")

    hindi_path = "scratch/bench_audio_hi.webm"
    english_path = "scratch/bench_audio_en.mp3"

    configs = [
        {"name": "Run 1: Hindi 328s, beam_size=1", "audio": hindi_path, "lang": "hi", "beam": 1, "dmon_csv": "scratch/dmon_hi_beam1.txt"},
        {"name": "Run 2: Hindi 328s, beam_size=5", "audio": hindi_path, "lang": "hi", "beam": 5, "dmon_csv": "scratch/dmon_hi_beam5.txt"},
        {"name": "Run 3: English 328s, beam_size=1", "audio": english_path, "lang": "en", "beam": 1, "dmon_csv": "scratch/dmon_en_beam1.txt"},
        {"name": "Run 4: English 328s, beam_size=5", "audio": english_path, "lang": "en", "beam": 5, "dmon_csv": "scratch/dmon_en_beam5.txt"},
    ]

    results = []

    # Preload model to exclude model download/init overhead from inference timing
    print("[Setup] Loading WhisperModel('small', device='cuda', compute_type='float16')...")
    model = WhisperModel("small", device="cuda", compute_type="float16")
    print("✓ Model loaded successfully.\n")

    for cfg in configs:
        print(f"--- Running {cfg['name']} ---")
        batt = get_battery_info()
        print(f"Battery/Power Status: {batt.get('PowerLine')} ({batt.get('BatteryPercent')*100:.0f}% charge)")

        # 1. Decode audio
        print(f"Decoding {cfg['audio']} with ffmpeg...")
        audio, decode_time, audio_dur = decode_audio_ffmpeg(cfg['audio'])
        print(f"  • Audio Duration: {audio_dur:.2f}s")
        print(f"  • Decode Time: {decode_time:.3f}s")

        # 2. Start dmon logger
        dmon = DmonLogger(cfg['dmon_csv'])
        dmon.start()

        # 3. Inference
        t_infer_start = time.perf_counter()
        segments_gen, info = model.transcribe(
            audio,
            language=cfg['lang'],
            task="transcribe",
            beam_size=cfg['beam'],
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )
        segments = []
        full_text = []
        for s in segments_gen:
            segments.append(s)
            full_text.append(s.text)
        t_infer_end = time.perf_counter()
        infer_time = t_infer_end - t_infer_start

        dmon.stop()

        text_str = " ".join(full_text)
        word_count = len(text_str.split())
        char_count = len(text_str)

        print(f"  • Inference Time: {infer_time:.2f}s (Real-Time Factor: {infer_time/audio_dur:.3f}x)")
        print(f"  • Total Time (Decode + Infer): {(decode_time + infer_time):.2f}s")
        print(f"  • Extracted: {len(segments)} segments, {word_count} words, {char_count} chars\n")

        # Query GPU instantaneous clocks
        gpu_q = subprocess.run([
            'nvidia-smi', '--query-gpu=clocks.current.graphics,clocks.current.memory,power.draw,pstate',
            '--format=csv,noheader,nounits'
        ], capture_output=True, text=True).stdout.strip().split(',')

        results.append({
            "test": cfg['name'],
            "audio_file": cfg['audio'],
            "audio_duration_sec": round(audio_dur, 2),
            "language": cfg['lang'],
            "beam_size": cfg['beam'],
            "decode_time_sec": round(decode_time, 3),
            "inference_time_sec": round(infer_time, 3),
            "total_time_sec": round(decode_time + infer_time, 3),
            "rtf": round(infer_time / audio_dur, 4),
            "segments_count": len(segments),
            "word_count": word_count,
            "char_count": char_count,
            "battery_powerline": batt.get('PowerLine'),
            "battery_percent": batt.get('BatteryPercent'),
            "gpu_graphics_mhz": int(gpu_q[0].strip()) if len(gpu_q) > 0 else 0,
            "gpu_mem_mhz": int(gpu_q[1].strip()) if len(gpu_q) > 1 else 0,
            "gpu_power_w": float(gpu_q[2].strip()) if len(gpu_q) > 2 else 0.0,
            "gpu_pstate": gpu_q[3].strip() if len(gpu_q) > 3 else "P0",
            "dmon_csv": cfg['dmon_csv'],
        })

    with open("scratch/whisper_speed_benchmark.json", "w", encoding="utf-8") as out:
        json.dump(results, out, indent=2)

    return results

if __name__ == "__main__":
    res = run_whisper_benchmark()
    print("\nBenchmark completed. Results saved to scratch/whisper_speed_benchmark.json")
