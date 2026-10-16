import os
import sys
import time
import json
import gc
import urllib.request
import subprocess
import threading
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

AUDIO_PATH = "scratch/vram_test_clip.mp3"
OUTPUT_CSV = "scratch/vram_large_v3_proof.csv"

# Global state
current_phase = "1. Baseline: Ollama loaded with qwen2.5:7b in VRAM"
keep_sampling = True
samples = []
start_perf = time.perf_counter()

def query_gpu():
    cmd = [
        'nvidia-smi',
        '--query-gpu=memory.used,memory.free,power.draw,clocks.current.graphics,temperature.gpu,pstate',
        '--format=csv,noheader,nounits'
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip()
        parts = [p.strip() for p in out.split(',')]
        return {
            'used_mb': int(parts[0]),
            'free_mb': int(parts[1]),
            'power_w': float(parts[2]),
            'graphics_mhz': int(parts[3]),
            'temp_c': int(parts[4]),
            'pstate': parts[5]
        }
    except Exception as e:
        return {'used_mb': 0, 'free_mb': 0, 'power_w': 0.0, 'graphics_mhz': 0, 'temp_c': 0, 'pstate': 'N/A'}

def sampler_thread():
    second = 0
    while keep_sampling:
        t_now = datetime.now().strftime("%H:%M:%S")
        gpu = query_gpu()
        samples.append({
            'second': second,
            'timestamp': t_now,
            'used_mb': gpu['used_mb'],
            'free_mb': gpu['free_mb'],
            'power_w': gpu['power_w'],
            'graphics_mhz': gpu['graphics_mhz'],
            'temp_c': gpu['temp_c'],
            'pstate': gpu['pstate'],
            'phase': current_phase
        })
        time.sleep(1.0)
        second += 1

def call_ollama(prompt, keep_alive=None):
    payload = {
        'model': 'qwen2.5:7b',
        'prompt': prompt,
        'stream': False
    }
    if keep_alive is not None:
        payload['keep_alive'] = keep_alive
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        'http://localhost:11434/api/generate',
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))

def main():
    global current_phase, keep_sampling

    print("================================================================================")
    print("VRAM LIFECYCLE VERIFICATION (large-v3 int8_float16 + qwen2.5:7b)")
    print("================================================================================\n")

    # State audio duration
    ff_cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', AUDIO_PATH]
    ff_res = subprocess.run(ff_cmd, capture_output=True, text=True)
    audio_dur = float(json.loads(ff_res.stdout)['format']['duration'])
    print(f"Test Audio File: {AUDIO_PATH}")
    print(f"Audio Duration: {audio_dur:.4f} seconds ({audio_dur:.1f}s)\n")

    # Start Sampler
    sampler = threading.Thread(target=sampler_thread, daemon=True)
    sampler.start()

    # Phase 1: Baseline Ollama warm in GPU
    current_phase = "1. Baseline: Ollama loaded with qwen2.5:7b in VRAM"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {current_phase}...")
    call_ollama("Warm up GPU")
    time.sleep(3.0)

    # Phase 2: Unload Ollama
    current_phase = "2. Request received: Unloading Ollama (keep_alive: 0)"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {current_phase}...")
    call_ollama("", keep_alive=0)
    time.sleep(2.0)

    # Phase 3: Loading Whisper large-v3
    from faster_whisper import WhisperModel
    import ctranslate2

    current_phase = "3. Loading Whisper large-v3 (compute_type=int8_float16) to CUDA"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {current_phase}...")
    t_load_0 = time.perf_counter()
    model = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
    t_load_1 = time.perf_counter()
    print(f"  • Model loaded in {t_load_1 - t_load_0:.2f}s")
    time.sleep(1.0)

    # Phase 4: Whisper large-v3 transcribing on CUDA
    current_phase = "4. Whisper large-v3 actively transcribing on CUDA"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {current_phase}...")
    t_trans_0 = time.perf_counter()
    segments_gen, info = model.transcribe(AUDIO_PATH, beam_size=1, vad_filter=True)
    segments = list(segments_gen)
    t_trans_1 = time.perf_counter()
    print(f"  • Transcribed {len(segments)} segments in {t_trans_1 - t_trans_0:.2f}s (Language: {info.language})")
    time.sleep(1.0)

    # Phase 5: Unload Whisper
    current_phase = "5. Transcribe finished: Unloading Whisper large-v3 from memory"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {current_phase}...")
    del model
    gc.collect()
    time.sleep(2.0)

    # Phase 6: Reload Ollama
    current_phase = "6. Reloading Ollama qwen2.5:7b into VRAM"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {current_phase}...")
    t_reload_0 = time.perf_counter()
    call_ollama("Reload model into GPU VRAM")
    t_reload_1 = time.perf_counter()
    print(f"  • Ollama reloaded in {t_reload_1 - t_reload_0:.2f}s")
    time.sleep(2.0)

    # Phase 7: Baseline restored
    current_phase = "7. Final steady state: Ollama loaded in VRAM"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {current_phase}...")
    time.sleep(2.0)

    keep_sampling = False
    time.sleep(0.5)

    # Write CSV
    print(f"\nWriting {len(samples)} real-time samples to {OUTPUT_CSV}...")
    with open(OUTPUT_CSV, "w", encoding="utf-8") as f:
        f.write("Second,Timestamp,Used_MB,Free_MB,Power_W,Graphics_MHz,Temp_C,PState,Phase_Label\n")
        for s in samples:
            f.write(f"{s['second']},{s['timestamp']},{s['used_mb']},{s['free_mb']},{s['power_w']},{s['graphics_mhz']},{s['temp_c']},{s['pstate']},\"{s['phase']}\"\n")

    print(f"✓ Saved {OUTPUT_CSV} successfully.")

if __name__ == "__main__":
    main()
