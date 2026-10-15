import os
import sys
import time
import subprocess
import threading
import json
import numpy as np

# Ensure CTranslate2 finds the cublas DLLs
ct2_dir = os.path.join(os.path.dirname(__file__), "..", "sidecar", ".venv", "Lib", "site-packages", "ctranslate2")
if os.path.exists(ct2_dir):
    try:
        os.add_dll_directory(ct2_dir)
    except Exception:
        pass

import ctranslate2
from faster_whisper import WhisperModel

VIDEO_URL = "https://www.youtube.com/watch?v=qzAHXO-cN5Q"

def get_vram_usage():
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            check=True
        )
        return int(res.stdout.strip())
    except Exception:
        return 0

class VramMonitor:
    def __init__(self, interval=1.0):
        self.interval = interval
        self.samples = []
        self.peak = 0
        self.running = False
        self._thread = None

    def start(self):
        self.running = True
        self.samples = []
        self.peak = 0
        self._thread = threading.Thread(target=self._run)
        self._thread.daemon = True
        self._thread.start()

    def _run(self):
        while self.running:
            v = get_vram_usage()
            self.samples.append(v)
            if v > self.peak:
                self.peak = v
            time.sleep(self.interval)

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        return self.peak, self.samples

def decode_audio(mp3_path):
    # Use ffmpeg to decode audio into 16kHz float32
    cmd = [
        "ffmpeg", "-nostdin", "-threads", "0", "-v", "error",
        "-i", mp3_path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"
    ]
    res = subprocess.run(cmd, capture_output=True, check=True)
    return np.frombuffer(res.stdout, dtype=np.float32)

def main():
    print("================================================================")
    print(" Faster-Whisper GPU Benchmark on RTX 4060: small, medium, large-v3")
    print(f" Target Video: {VIDEO_URL}")
    print(" Explicit Parameters: task='transcribe', language='hi', beam_size=5")
    print("================================================================")
    print(f"CUDA device count: {ctranslate2.get_cuda_device_count()}")

    # Download audio with yt-dlp to a temp file
    temp_audio = os.path.join(os.path.dirname(__file__), "..", "scratch", "bench_audio_hi.mp3")
    os.makedirs(os.path.dirname(temp_audio), exist_ok=True)

    if not os.path.exists(temp_audio) or os.path.getsize(temp_audio) < 1000:
        print("\nDownloading audio via yt-dlp...")
        subprocess.run([
            "yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "0",
            "-o", temp_audio, VIDEO_URL
        ], check=True)

    print(f"Audio ready: {temp_audio} ({os.path.getsize(temp_audio)} bytes)")
    print("Decoding audio to 16kHz mono float32...")
    audio = decode_audio(temp_audio)
    duration_sec = len(audio) / 16000.0
    print(f"Decoded {len(audio)} samples ({duration_sec:.1f}s)")

    configs = [
        ("small", "float16"),
        ("medium", "float16"),
        ("large-v3", "int8_float16"),
    ]

    results = []

    for model_name, compute_type in configs:
        print("\n" + "=" * 65)
        print(f" TESTING: {model_name} (device=cuda, compute_type={compute_type})")
        print("=" * 65)
        print(f"[PARAMETERS LOG]:")
        print(f"  model:          {model_name}")
        print(f"  device:         cuda")
        print(f"  compute_type:   {compute_type}")
        print(f"  language:       hi")
        print(f"  task:           transcribe")
        print(f"  vad_filter:     True")
        print(f"  beam_size:      5")

        baseline_vram = get_vram_usage()
        print(f"  Baseline VRAM:  {baseline_vram} MiB")

        # Load model
        t_load_start = time.time()
        model = WhisperModel(model_name, device="cuda", compute_type=compute_type)
        load_time = time.time() - t_load_start
        print(f"  Model loaded in {load_time:.2f}s")

        # Start VRAM monitor
        monitor = VramMonitor(interval=0.5)
        monitor.start()

        t_trans_start = time.time()
        segments_gen, info = model.transcribe(
            audio,
            task="transcribe",
            language="hi",
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            beam_size=5,
        )

        segments = []
        full_text_chunks = []
        for seg in segments_gen:
            clean_t = seg.text.strip()
            if clean_t:
                segments.append({"start": round(seg.start, 2), "end": round(seg.end, 2), "text": clean_t})
                full_text_chunks.append(clean_t)

        trans_time = time.time() - t_trans_start
        peak_vram, samples = monitor.stop()

        full_text = " ".join(full_text_chunks)
        words = full_text.split()

        # Count Devanagari vs Latin characters
        devanagari_chars = len([c for c in full_text if "\u0900" <= c <= "\u097F"])
        latin_chars = len([c for c in full_text if ("a" <= c <= "z" or "A" <= c <= "Z")])
        script_name = "Devanagari (Native Hindi)" if devanagari_chars > latin_chars else "Latin / Romanized Hindi"

        print(f"  ✓ Transcription complete in {trans_time:.1f}s")
        print(f"  Peak VRAM:        {peak_vram} MiB (increase: +{peak_vram - baseline_vram} MiB)")
        print(f"  Output Script:    {script_name} ({devanagari_chars} Devanagari chars, {latin_chars} Latin chars)")
        print(f"  Detected Lang:    {info.language} (probability: {info.language_probability:.2f})")
        print(f"  Word Count:       {len(words)} words ({len(full_text)} characters)")

        # Save transcript to scratch
        out_txt = os.path.join(os.path.dirname(__file__), "..", "scratch", f"transcript_{model_name}_hi.txt")
        with open(out_txt, "w", encoding="utf-8") as f:
            f.write(full_text)

        # 10 line sample
        lines = [s["text"] for s in segments[:10]]
        print("  10-Line Sample:")
        for idx, line in enumerate(lines[:5]):
            print(f"    [Line {idx+1}] {line}")

        results.append({
            "model": model_name,
            "compute_type": compute_type,
            "time_sec": f"{trans_time:.1f}s",
            "peak_vram": f"{peak_vram} MiB",
            "vram_delta": f"+{peak_vram - baseline_vram} MiB",
            "script": script_name,
            "devanagari_chars": devanagari_chars,
            "latin_chars": latin_chars,
            "words": len(words),
            "lines": lines,
            "full_text": full_text
        })

        # Explicit unload and garbage collect
        del model
        import gc
        gc.collect()
        time.sleep(2)

    print("\n" + "=" * 65)
    print(" BENCHMARK SUMMARY TABLE (qzAHXO-cN5Q, language=hi, task=transcribe)")
    print("=" * 65)
    print(f"{'Model':<12} | {'Compute':<14} | {'Time':<8} | {'Peak VRAM':<12} | {'Script':<25} | {'Words'}")
    print("-" * 80)
    for r in results:
        print(f"{r['model']:<12} | {r['compute_type']:<14} | {r['time_sec']:<8} | {r['peak_vram']:<12} | {r['script']:<25} | {r['words']}")

    # Save complete JSON report
    report_path = os.path.join(os.path.dirname(__file__), "..", "scratch", "whisper_benchmark_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nFull report saved to {report_path}")

if __name__ == "__main__":
    main()
