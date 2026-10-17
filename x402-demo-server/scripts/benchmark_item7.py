import time
import json
import os
import sys
sys.path.insert(0, os.getcwd())
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
import requests
from fastapi.testclient import TestClient
from sidecar.server import app

def main():
    audio_path = "scratch/bench_audio_hi.webm"
    results = {}

    print("=" * 80)
    print("ITEM 7: BENCHMARK REAL HTTP ENDPOINT & COMPRESSION RATIO THRESHOLDS")
    print("=" * 80)

    # 1. Real HTTP endpoint via TestClient (BatchedInferencePipeline large-v3-turbo default for non-English)
    print("\n1. Testing real HTTP endpoint (POST /v1/audio/transcriptions) on 328s Hindi audio...")
    client = TestClient(app)

    with open(audio_path, "rb") as f:
        file_bytes = f.read()

    t0 = time.time()
    response = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("bench_audio_hi.webm", file_bytes, "audio/webm")},
        data={"language": "hi", "task": "transcribe"}
    )
    http_time = time.time() - t0
    assert response.status_code == 200, f"HTTP Error {response.status_code}: {response.text}"
    http_data = response.json()

    print(f"✓ HTTP Endpoint End-to-End Time: {http_time:.2f}s")
    print(f"  Duration: {http_data['duration']}s, Segments: {len(http_data['segments'])}, Words: {len(http_data['text'].split())}")
    results["http_endpoint"] = {
        "end_to_end_seconds": round(http_time, 2),
        "duration": http_data["duration"],
        "segments_count": len(http_data["segments"]),
        "words_count": len(http_data["text"].split()),
        "first_50_chars": http_data["text"][:50]
    }

    # 2. Test non-batched path with compression_ratio_threshold at 2.4 and 3.0
    from faster_whisper import WhisperModel
    print("\nLoading WhisperModel('large-v3-turbo', device='cuda', compute_type='int8_float16')...")
    model = WhisperModel("large-v3-turbo", device="cuda", compute_type="int8_float16")

    for cr_thresh in [2.4, 3.0]:
        print(f"\n2. Testing non-batched path with compression_ratio_threshold={cr_thresh}...")
        t_start = time.time()
        segments, info = model.transcribe(
            audio_path,
            language="hi",
            task="transcribe",
            beam_size=5,
            vad_filter=True,
            compression_ratio_threshold=cr_thresh,
            temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
        )

        temps_used = []
        seg_count = 0
        total_comp_ratio = 0
        for s in segments:
            seg_count += 1
            temps_used.append(s.temperature)
            total_comp_ratio += s.compression_ratio

        elapsed = time.time() - t_start
        # Fallback retries = count of segments where temperature > 0.0
        fallback_retries = sum(1 for t in temps_used if t > 0.0)
        avg_cr = total_comp_ratio / seg_count if seg_count > 0 else 0

        print(f"✓ compression_ratio_threshold={cr_thresh}:")
        print(f"  Time: {elapsed:.2f}s")
        print(f"  Fallback retries (segments with temp > 0): {fallback_retries}")
        print(f"  Avg compression ratio: {avg_cr:.4f}")
        print(f"  Total segments: {seg_count}")

        results[f"non_batched_cr_{cr_thresh}"] = {
            "compression_ratio_threshold": cr_thresh,
            "elapsed_seconds": round(elapsed, 2),
            "fallback_retries": fallback_retries,
            "avg_compression_ratio": round(avg_cr, 4),
            "segments_count": seg_count
        }

    out_file = "scratch/item7_benchmark_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved all benchmark results to {out_file}")

if __name__ == "__main__":
    main()
