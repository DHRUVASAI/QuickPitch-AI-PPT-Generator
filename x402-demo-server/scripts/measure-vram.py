import time
import threading
import subprocess
import requests
import os

samples = []
stop_sampling = False

def sampler():
    while not stop_sampling:
        try:
            out = subprocess.check_output(
                ['nvidia-smi', '--query-gpu=memory.used', '--format=csv,noheader,nounits']
            ).decode().strip()
            samples.append((time.strftime('%H:%M:%S'), int(out)))
        except Exception:
            pass
        time.sleep(1.0)

t = threading.Thread(target=sampler)
t.start()

# Check initial VRAM with Ollama loaded
init_vram = int(subprocess.check_output(
    ['nvidia-smi', '--query-gpu=memory.used', '--format=csv,noheader,nounits']
).decode().strip())
print(f'Initial VRAM (Ollama qwen2.5:7b resident): {init_vram} MiB ({init_vram / 1024:.2f} GB)')

# Download audio from real video
ffmpeg_dir = r'C:\Users\dhruv\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin'
subprocess.run([
    'yt-dlp', '--js-runtimes', 'node', '--ffmpeg-location', ffmpeg_dir,
    '-x', '--audio-format', 'mp3', '-o', 'vram_test.%(ext)s',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw', '--quiet'
])

print('Transcribing via Faster-Whisper GPU sidecar (/v1/audio/transcriptions)...')
with open('vram_test.mp3', 'rb') as f:
    resp = requests.post(
        'http://127.0.0.1:8000/v1/audio/transcriptions',
        files={'file': ('vram_test.mp3', f, 'audio/mpeg')},
        data={'model': 'small', 'vad_filter': 'true'}
    )
    print('Transcription HTTP status:', resp.status_code)
    if resp.ok:
        data = resp.json()
        print('Detected language:', data.get('language'), 'confidence:', data.get('language_probability'))
        print('Text snippet:', data.get('text', '')[:100])

time.sleep(2.0)
stop_sampling = True
t.join()

if os.path.exists('vram_test.mp3'):
    try:
        os.remove('vram_test.mp3')
    except Exception:
        pass

used_vals = [s[1] for s in samples]
peak = max(used_vals) if used_vals else init_vram
print('\n--- VRAM SAMPLING LOG (Every 1s) ---')
for ts, u in samples:
    print(f'{ts}: {u} MiB used ({u / 1024:.2f} GB)')
print('\n======================================================')
print(f'PEAK VRAM USAGE: {peak} MiB ({peak / 1024:.2f} GB / 8.00 GB)')
exceeds = 'YES' if peak > 7168 else 'NO (Fits comfortably within 8 GB VRAM budget)'
print(f'EXCEEDS 7 GB THRESHOLD: {exceeds}')
print('======================================================')
