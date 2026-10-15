# Faster-Whisper Sidecar Service

A lightweight, dedicated Python 3.12 microservice running [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (powered by CTranslate2) on NVIDIA CUDA GPUs or CPU fallback.

---

## Features
- **GPU Acceleration**: Uses CTranslate2 CUDA (`float16`) on NVIDIA RTX GPUs (e.g. RTX 4060 8GB).
- **Fast Startup & Low Footprint**: Uses pinned, minimal dependencies with zero PyTorch or PyAV bloat.
- **Audio Extraction via FFmpeg**: High-performance 16kHz float32 mono PCM decoding directly via system FFmpeg, preventing OS DLL load blocks.
- **VRAM Serialization**: Controlled via `/unload` endpoint and `GPULock` mutex queue in Node.js backend. Model object is freed and garbage collected before Ollama LLM execution.
- **Spoken Language Detection**: `/detect-language` probes the first 30 seconds of audio and returns language code and confidence score.

---

## Setup & Running

### Requirements
- **Python 3.12** (64-bit)
- **FFmpeg** in system `PATH` (or set `FFMPEG_PATH` environment variable)
- **NVIDIA GPU** with CUDA driver (Driver 550+ for CUDA 12.x / 13.x)

### 1. Environment Setup
```bash
cd x402-demo-server/sidecar
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Run Service
```bash
python server.py
# Or on Windows:
start.bat
```
The sidecar starts on `http://127.0.0.1:8000`.

---

## API Endpoints

- `GET /health`: Returns service status, loaded model, current device (`cuda` or `cpu`), and CUDA availability.
- `POST /detect-language`: Accepts multipart `file` and returns `{ "language": "en", "probability": 0.85, "duration": 30.0 }`.
- `POST /v1/audio/transcriptions`: OpenAI-compatible transcription endpoint with timestamped segments and VAD filtering.
- `POST /unload`: Deletes the loaded model object, runs garbage collection, and releases GPU VRAM immediately.

---

## Environment Variables
| Variable | Default | Description |
|---|---|---|
| `WHISPER_MODEL` | `small` | Model size (`tiny`, `base`, `small`, `medium`) |
| `WHISPER_PORT` | `8000` | Port for the FastAPI server |
| `FFMPEG_PATH` | (from PATH) | Path to `ffmpeg.exe` binary if not in global PATH |
