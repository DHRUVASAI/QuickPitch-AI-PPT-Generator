import time
import json
import os
import ctranslate2
from faster_whisper import WhisperModel

def main():
    audio_path = "scratch/bench_audio_hi.webm"
    out_path = "scratch/qzAHXO_large_v3_translate.json"

    print(f"Loading large-v3 model on CUDA (int8_float16)...")
    t0 = time.time()
    model = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
    load_time = time.time() - t0
    print(f"Loaded large-v3 in {load_time:.2f}s")

    print(f"Transcribing {audio_path} with task='translate' (Hindi -> English)...")
    t1 = time.time()
    segments, info = model.transcribe(
        audio_path,
        task="translate",
        temperature=0.0,
        beam_size=5,
        vad_filter=True,
    )

    seg_list = []
    full_text_list = []
    for s in segments:
        seg_obj = {
            "start": round(s.start, 2),
            "end": round(s.end, 2),
            "text": s.text.strip(),
            "avg_logprob": round(s.avg_logprob, 4),
            "compression_ratio": round(s.compression_ratio, 4),
            "temperature": s.temperature
        }
        seg_list.append(seg_obj)
        full_text_list.append(s.text.strip())
        print(f"[{seg_obj['start']:06.2f} - {seg_obj['end']:06.2f}] {seg_obj['text']}")

    elapsed = time.time() - t1
    full_text = " ".join(full_text_list)
    print(f"\nTranslation complete in {elapsed:.2f}s! Segments: {len(seg_list)}, Total words: {len(full_text.split())}")

    result = {
        "model": "large-v3",
        "task": "translate",
        "audio_path": audio_path,
        "duration": info.duration,
        "language": info.language,
        "language_probability": info.language_probability,
        "elapsed_seconds": round(elapsed, 2),
        "segments": seg_list,
        "full_text": full_text
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Saved results to {out_path}")

if __name__ == "__main__":
    main()
