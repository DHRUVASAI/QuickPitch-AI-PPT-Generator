import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/qzAHXO-cN5Q.hi.vtt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

segments = []
current_time = None
time_pattern = re.compile(r'(\d\d:\d\d:\d\d\.\d\d\d)\s*-->\s*(\d\d:\d\d:\d\d\.\d\d\d)')

current_text = []
for line in lines:
    line = line.strip()
    m = time_pattern.search(line)
    if m:
        if current_time and current_text:
            text = ' '.join(current_text)
            text = re.sub(r'<[^>]+>', '', text).strip()
            if text:
                segments.append({'start': current_time[0], 'end': current_time[1], 'text': text})
        current_time = (m.group(1), m.group(2))
        current_text = []
    elif line and not line.startswith('WEBVTT') and not line.startswith('Kind:') and not line.startswith('Language:'):
        cleaned = re.sub(r'<[^>]+>', '', line).strip()
        if cleaned and (not current_text or cleaned != current_text[-1]):
            current_text.append(cleaned)

if current_time and current_text:
    text = ' '.join(current_text)
    text = re.sub(r'<[^>]+>', '', text).strip()
    if text:
        segments.append({'start': current_time[0], 'end': current_time[1], 'text': text})

# Deduplicate repeating text
deduped = []
for s in segments:
    if not deduped or s['text'] != deduped[-1]['text']:
        deduped.append(s)

print(f"Total parsed segments: {len(deduped)}")
for i, s in enumerate(deduped[:15]):
    print(f"[{i+1}] [{s['start']} --> {s['end']}] {s['text']}")

with open('scratch/qzAHXO_parsed_vtt.json', 'w', encoding='utf-8') as out:
    json.dump(deduped, out, ensure_ascii=False, indent=2)
