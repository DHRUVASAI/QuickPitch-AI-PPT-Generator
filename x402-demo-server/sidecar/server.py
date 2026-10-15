"""
QuickPitch AI - Faster-Whisper Local Transcription Sidecar Service
Runs over HTTP on localhost:8000 with VAD, language detection, and explicit GPU memory unloading.
"""

import os
import gc
import tempfile
import logging
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("whisper-sidecar")

app = FastAPI(title="QuickPitch Faster-Whisper Sidecar", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model state
loaded_model = None
current_model_name: Optional[str] = None
current_device: Optional[str] = None
current_compute_type: Optional[str] = None

DEFAULT_MODEL = os.getenv("WHISPER_MODEL", "tiny")


def get_torch():
    try:
        import torch
        return torch
    except ImportError:
        return None


def get_model(model_name: Optional[str] = None):
    global loaded_model, current_model_name, current_device, current_compute_type
    target_model = model_name or os.getenv("WHISPER_MODEL", DEFAULT_MODEL)

    if loaded_model is not None and current_model_name == target_model:
        return loaded_model

    from faster_whisper import WhisperModel

    torch = get_torch()
    has_cuda = torch is not None and torch.cuda.is_available()

    # Try CUDA first if available, then fallback to CPU int8
    if has_cuda:
        try:
            logger.info(f"Loading WhisperModel({target_model}) on CUDA float16...")
            loaded_model = WhisperModel(target_model, device="cuda", compute_type="float16")
            current_model_name = target_model
            current_device = "cuda"
            current_compute_type = "float16"
            logger.info("Successfully loaded model on CUDA GPU.")
            return loaded_model
        except Exception as e:
            logger.warning(f"Failed to load on CUDA float16 ({e}). Trying CPU int8 fallback...")

    # CPU int8 fallback
    logger.info(f"Loading WhisperModel({target_model}) on CPU int8...")
    loaded_model = WhisperModel(target_model, device="cpu", compute_type="int8")
    current_model_name = target_model
    current_device = "cpu"
    current_compute_type = "int8"
    logger.info("Successfully loaded model on CPU int8.")
    return loaded_model


def unload_model():
    global loaded_model, current_model_name, current_device, current_compute_type
    if loaded_model is not None:
        logger.info(f"Unloading Whisper model '{current_model_name}' from VRAM...")
        del loaded_model
        loaded_model = None
        current_model_name = None
        current_device = None
        current_compute_type = None

        gc.collect()
        torch = get_torch()
        if torch is not None and torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info("Whisper model unloaded and VRAM released.")
        return True
    return False


class SegmentItem(BaseModel):
    start: float
    end: float
    text: str


class TranscriptionResponse(BaseModel):
    text: str
    language: str
    language_probability: float
    duration: float
    segments: List[SegmentItem]


class DetectLanguageResponse(BaseModel):
    language: str
    probability: float
    duration: float


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "faster-whisper-sidecar",
        "loaded_model": current_model_name,
        "device": current_device,
        "compute_type": current_compute_type,
        "default_model": os.getenv("WHISPER_MODEL", DEFAULT_MODEL),
    }


@app.post("/unload")
def unload():
    was_loaded = unload_model()
    return {"unloaded": True, "was_loaded": was_loaded}


import subprocess
import shutil
import numpy as np

def decode_audio_ffmpeg(file_path: str) -> np.ndarray:
    ffmpeg_paths = [
        "ffmpeg",
        r"C:\Users\dhruv\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe",
    ]
    ffmpeg_bin = "ffmpeg"
    for p in ffmpeg_paths:
        if os.path.exists(p) or shutil.which(p):
            ffmpeg_bin = p
            break

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
    res = subprocess.run(cmd, capture_output=True, check=True)
    return np.frombuffer(res.stdout, dtype=np.float32)


@app.post("/detect-language", response_model=DetectLanguageResponse)
async def detect_language(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "audio.mp3")[1] or ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        content = await file.read()
        tmp.write(content)

    try:
        audio = decode_audio_ffmpeg(tmp_path)
        duration = len(audio) / 16000.0

        # Run language detection on first 30 seconds
        audio_30s = audio[: 16000 * 30]
        model = get_model()
        _, info = model.transcribe(audio_30s, vad_filter=False, beam_size=1)

        return DetectLanguageResponse(
            language=info.language,
            probability=round(info.language_probability, 4),
            duration=round(duration, 2),
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/v1/audio/transcriptions", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    model: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    initial_prompt: Optional[str] = Form(None),
    vad_filter: bool = Form(True),
    unload_after: bool = Form(False),
):
    suffix = os.path.splitext(file.filename or "audio.mp3")[1] or ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        content = await file.read()
        tmp.write(content)

    try:
        audio = decode_audio_ffmpeg(tmp_path)
        whisper_model = get_model(model)

        segments_gen, info = whisper_model.transcribe(
            audio,
            language=language if (language and language.lower() not in ["auto", "same as video", ""]) else None,
            initial_prompt=initial_prompt,
            vad_filter=vad_filter,
            vad_parameters=dict(min_silence_duration_ms=500),
            beam_size=5,
        )

        segments: List[SegmentItem] = []
        full_text_chunks: List[str] = []

        for seg in segments_gen:
            clean_text = seg.text.strip()
            if clean_text:
                segments.append(SegmentItem(start=round(seg.start, 2), end=round(seg.end, 2), text=clean_text))
                full_text_chunks.append(clean_text)

        # Automatic recovery if vad_filter was too aggressive on noisy/music audio
        if vad_filter and not segments and len(audio) > 16000 * 3:
            logger.info("VAD filter pruned all segments, retrying with vad_filter=False...")
            fallback_gen, info = whisper_model.transcribe(
                audio,
                language=language if (language and language.lower() not in ["auto", "same as video", ""]) else None,
                initial_prompt=initial_prompt,
                vad_filter=False,
                beam_size=5,
            )
            for seg in fallback_gen:
                clean_text = seg.text.strip()
                if clean_text:
                    segments.append(SegmentItem(start=round(seg.start, 2), end=round(seg.end, 2), text=clean_text))
                    full_text_chunks.append(clean_text)

        full_text = " ".join(full_text_chunks)

        response = TranscriptionResponse(
            text=full_text,
            language=info.language,
            language_probability=round(info.language_probability, 4),
            duration=round(info.duration, 2),
            segments=segments,
        )

        if unload_after:
            unload_model()

        return response
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("server:app", host="127.0.0.1", port=port, reload=False)
