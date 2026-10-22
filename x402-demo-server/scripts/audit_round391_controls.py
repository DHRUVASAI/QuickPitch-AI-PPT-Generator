#!/usr/bin/env python3
"""Round 3.9 Part 1.8 - Item 1 control pre-check and verifier mode audit."""
import json, re, sys

# ── Load corpus ──────────────────────────────────────────────────────────────
with open('scratch/qzAHXO_step3_deduped_translated.json', encoding='utf-8') as f:
    units = json.load(f)

hindi_all = ' '.join(u.get('sourceText', '') for u in units).lower()
english_all = ' '.join(u.get('translatedText', '') for u in units).lower()

with open('scratch/qzAHXO_large_v3_translate.json', encoding='utf-8') as f:
    whisper_data = json.load(f)
whisper_all = ' '.join(s['text'] for s in whisper_data.get('segments', [])).lower()

# Also load the captions for Hindi raw text
with open('scratch/qzAHXO-cN5Q.hi.vtt', encoding='utf-8') as f:
    vtt_raw = f.read().lower()

def corpus_grep(keyword):
    kl = keyword.lower()
    return {
        'keyword': kl,
        'in_hindi_captions': kl in hindi_all or kl in vtt_raw,
        'in_english_translation': kl in english_all,
        'in_whisper_translate': kl in whisper_all,
        'found_any': kl in hindi_all or kl in vtt_raw or kl in english_all or kl in whisper_all,
    }

# ── 10 NEW controls ───────────────────────────────────────────────────────────
# Format: (claim_text, keyword_to_grep, expected_present)
new_controls = [
    # POSITIVES
    ("Kurzweil predicts robots as smart as humans by 2045.",         "kurzweil",       True),
    ("Kurzweil predicts robots as smart as humans by 2045.",         "2045",           True),
    ("Elon Musk predicts AI implants will enhance the human mind and body.", "elon musk", True),
    ("Elon Musk predicts AI implants will enhance the human mind and body.", "implant",  True),
    ("The video asks viewers a quiz question in the comments.",      "quiz",           True),
    ("The video asks viewers a quiz question in the comments.",      "comment",        True),
    ("Machine learning is a technique for achieving AI.",            "machine learning", True),
    ("Strong AI is described as self-aware and able to develop emotions.", "self-aware", True),
    ("Strong AI is described as self-aware and able to develop emotions.", "emotion",   True),
    # NEGATIVES
    ("The speaker explains how GPUs accelerate neural network training.", "gpu",         False),
    ("The video says AI will replace all doctors by 2030.",          "replace all doctors", False),
    ("The video says AI will replace all doctors by 2030.",          "2030",           False),
    ("The speaker names OpenAI as the leader in generative AI.",     "openai",         False),
    ("The video explains the Turing test.",                          "turing test",    False),
    ("The speaker says Alexa is an example of strong AI.",           "strong ai",      False),
]

print("=" * 70)
print("ITEM 1 PRE-CHECK: Corpus grep before running verifier")
print("=" * 70)
results = {}
for claim, keyword, expected_present in new_controls:
    r = corpus_grep(keyword)
    found = r['found_any']
    passes = (found == expected_present)
    status = "PASS" if passes else "FAIL"
    short = claim[:60]
    key = f"{claim[:40]}|{keyword}"
    results[key] = {'claim': claim, 'keyword': keyword, 'expected_present': expected_present,
                    'found': found, 'passes': passes, **r}
    side = "POSITIVE" if expected_present else "NEGATIVE"
    print(f"[{status}] [{side}] kw={keyword!r:25s} | hindi={str(r['in_hindi_captions']):5s} en={str(r['in_english_translation']):5s} whisper={str(r['in_whisper_translate']):5s}")

# Summarise which full controls pass/fail
print()
print("=" * 70)
print("CONTROL-LEVEL SUMMARY (all keywords for a claim must pass)")
print("=" * 70)

# Group by claim
from collections import defaultdict
claim_results = defaultdict(list)
for key, v in results.items():
    claim_results[v['claim']].append(v['passes'])

passed_controls = []
failed_controls = []
for claim, passes_list in claim_results.items():
    if all(passes_list):
        passed_controls.append(claim)
        print(f"  KEEP: {claim[:70]}")
    else:
        failed_controls.append(claim)
        print(f"  DROP: {claim[:70]}  <-- pre-check failed")

print()
print(f"Controls kept: {len(passed_controls)}, dropped: {len(failed_controls)}")

# Save results
out = {
    'round': '3.9 Part 1.8',
    'item': 1,
    'description': 'Pre-check: corpus grep for 10 new controls before running verifier',
    'corpus_files': [
        'scratch/qzAHXO_step3_deduped_translated.json',
        'scratch/qzAHXO_large_v3_translate.json',
        'scratch/qzAHXO-cN5Q.hi.vtt'
    ],
    'keyword_checks': list(results.values()),
    'passed_controls': passed_controls,
    'failed_controls': failed_controls,
}
with open('evidence/round39/round391_part18_item1_precheck.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print("\nEvidence written to evidence/round39/round391_part18_item1_precheck.json")
