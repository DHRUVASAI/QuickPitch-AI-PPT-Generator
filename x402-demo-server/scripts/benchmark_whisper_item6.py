import os
import sys
import time
import json
import subprocess
import shutil
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

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

def get_gpu_vram_mb():
    try:
        res = subprocess.run(
            ['nvidia-smi', '--query-gpu=memory.used', '--format=csv,noheader,nounits'],
            capture_output=True, text=True, check=True
        )
        return float(res.stdout.strip().splitlines()[0])
    except Exception as e:
        return 0.0

def load_captions():
    with open('scratch/qzAHXO_parsed_vtt.json', 'r', encoding='utf-8') as f:
        vtt = json.load(f)
    # Get distinct early lines
    caption_lines = []
    seen = set()
    for item in vtt:
        txt = item['text'].strip()
        if txt not in seen:
            seen.add(txt)
            caption_lines.append(f"[{item['start']} -> {item['end']}] {txt}")
        if len(caption_lines) >= 5:
            break
    return caption_lines

def main():
    import gc
    import torch
    from faster_whisper import WhisperModel, BatchedInferencePipeline

    audio_path = "scratch/bench_audio_hi.webm"
    print(f"Decoding {audio_path}...")
    audio, decode_time, audio_dur = decode_audio_ffmpeg(audio_path)
    print(f"Audio duration: {audio_dur:.2f}s ({audio_dur/60:.2f} min), decode time: {decode_time:.3f}s")

    caption_5_lines = load_captions()

    results = []

    tests = [
        {
            "name": "Run 1: small (temperature=0, condition_on_previous_text=False)",
            "model_name": "small",
            "compute_type": "float16",
            "kwargs": {
                "temperature": 0.0,
                "condition_on_previous_text": False,
                "vad_filter": True,
            },
            "batched": False,
        },
        {
            "name": "Run 2: large-v3-turbo (int8_float16)",
            "model_name": "large-v3-turbo",
            "compute_type": "int8_float16",
            "kwargs": {
                "vad_filter": True,
            },
            "batched": False,
        },
        {
            "name": "Run 3: Batched Pipeline (large-v3-turbo int8_float16, batch_size=8)",
            "model_name": "large-v3-turbo",
            "compute_type": "int8_float16",
            "kwargs": {
                "batch_size": 8,
            },
            "batched": True,
        }
    ]

    for t in tests:
        print("\n" + "=" * 80)
        print(f"STARTING {t['name']}")
        print("=" * 80)

        # Baseline VRAM
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.reset_peak_memory_stats()
        base_vram = get_gpu_vram_mb()

        t_load0 = time.perf_counter()
        whisper_model = WhisperModel(t['model_name'], device="cuda", compute_type=t['compute_type'])
        if t['batched']:
            pipeline = BatchedInferencePipeline(model=whisper_model)
        else:
            pipeline = whisper_model
        t_load1 = time.perf_counter()
        model_load_time = t_load1 - t_load0

        loaded_vram = get_gpu_vram_mb()

        # Inference
        t_infer0 = time.perf_counter()
        if t['batched']:
            segments_gen, info = pipeline.transcribe(
                audio,
                language="hi",
                batch_size=t['kwargs']['batch_size'],
            )
        else:
            segments_gen, info = pipeline.transcribe(
                audio,
                language="hi",
                task="transcribe",
                **t['kwargs']
            )

        segments = []
        full_text = []
        per_segment_metrics = []
        fallback_retries = 0

        # Monitor peak VRAM during generation
        peak_vram_during = loaded_vram

        for seg in segments_gen:
            curr_vram = get_gpu_vram_mb()
            if curr_vram > peak_vram_during:
                peak_vram_during = curr_vram

            segments.append(seg)
            full_text.append(seg.text.strip())

            # Log per-segment metrics
            seg_info = {
                "id": seg.id,
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "avg_logprob": round(seg.avg_logprob, 4),
                "compression_ratio": round(seg.compression_ratio, 4),
                "temperature": round(seg.temperature, 2),
                "no_speech_prob": round(seg.no_speech_prob, 4),
                "text": seg.text.strip()
            }
            per_segment_metrics.append(seg_info)

            # Check if temperature was stepped up (fallback retry)
            if seg.temperature > 0.0:
                fallback_retries += 1

        t_infer1 = time.perf_counter()
        infer_time = t_infer1 - t_infer0
        rtf = infer_time / audio_dur

        peak_vram_final = get_gpu_vram_mb()
        peak_vram = max(loaded_vram, peak_vram_during, peak_vram_final)
        vram_allocated_by_model = peak_vram - base_vram

        # Clean 5 lines from this model
        whisper_5_lines = []
        for s in segments[:5]:
            m_s = f"{int(s.start//60):02d}:{int(s.start%60):02d}.{int((s.start%1)*1000):03d}"
            m_e = f"{int(s.end//60):02d}:{int(s.end%60):02d}.{int((s.end%1)*1000):03d}"
            whisper_5_lines.append(f"[{m_s} -> {m_e}] {s.text.strip()}")

        # Clean memory
        del pipeline
        del whisper_model
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        test_result = {
            "name": t['name'],
            "model": t['model_name'],
            "compute_type": t['compute_type'],
            "batched": t['batched'],
            "audio_duration_sec": round(audio_dur, 2),
            "inference_time_sec": round(infer_time, 2),
            "rtf": round(rtf, 4),
            "model_load_time_sec": round(model_load_time, 2),
            "base_vram_mb": round(base_vram, 1),
            "peak_vram_mb": round(peak_vram, 1),
            "vram_delta_mb": round(vram_allocated_by_model, 1),
            "total_segments": len(segments),
            "fallback_retries_count": fallback_retries,
            "avg_logprob_mean": round(float(np.mean([s['avg_logprob'] for s in per_segment_metrics])), 4) if per_segment_metrics else 0,
            "compression_ratio_mean": round(float(np.mean([s['compression_ratio'] for s in per_segment_metrics])), 4) if per_segment_metrics else 0,
            "temperature_mean": round(float(np.mean([s['temperature'] for s in per_segment_metrics])), 4) if per_segment_metrics else 0,
            "first_5_segments_metrics": per_segment_metrics[:5],
            "whisper_5_lines": whisper_5_lines,
            "captions_5_lines": caption_5_lines,
        }

        results.append(test_result)

        print(f"✓ Completed in {infer_time:.2f}s (RTF: {rtf:.4f}x)")
        print(f"  Peak VRAM: {peak_vram:.1f} MB (Delta: {vram_allocated_by_model:.1f} MB)")
        print(f"  Fallback Retries Count: {fallback_retries}")
        print(f"  Avg Logprob Mean: {test_result['avg_logprob_mean']}")
        print(f"  Compression Ratio Mean: {test_result['compression_ratio_mean']}")
        print(f"  Temperature Mean: {test_result['temperature_mean']}")

    with open("scratch/whisper_item6_benchmark_results.json", "w", encoding="utf-8") as out:
        json.dump(results, out, ensure_ascii=False, indent=2)

    print("\n" + "=" * 80)
    print("ALL 3 BENCHMARKS FINISHED. RESULTS PERSISTED TO scratch/whisper_item6_benchmark_results.json")
    print("=" * 80)

if __name__ == "__main__":
    main()
