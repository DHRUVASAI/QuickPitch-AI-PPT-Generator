#!/usr/bin/env python3
"""Find closest 3 English lines and 3 Hindi lines with timestamps for the 12 fresh controls and save as JSON."""
import json
import re

with open('scratch/qzAHXO_step3_deduped_translated.json', encoding='utf-8') as f:
    units = json.load(f)

with open('scratch/qzAHXO_large_v3_translate.json', encoding='utf-8') as f:
    whisper_data = json.load(f)

english_lines = []
hindi_lines = []

for u in units:
    u_idx = u['unitIndex']
    h_lines = u['lines']
    t_lines = u.get('translatedLines', [])
    for idx, hl in enumerate(h_lines):
        start = hl.get('start', '')
        end = hl.get('end', '')
        htext = hl.get('text', '')
        etext = t_lines[idx]['text'] if idx < len(t_lines) else ''
        hindi_lines.append({
            'unitIndex': u_idx,
            'start': start,
            'end': end,
            'text': htext
        })
        english_lines.append({
            'unitIndex': u_idx,
            'start': start,
            'end': end,
            'text': etext
        })

def score_match(query, line):
    qw = set(re.findall(r'\w+', query.lower()))
    lw = set(re.findall(r'\w+', line.lower()))
    return len(qw & lw)

controls = [
    # POSITIVE
    ("P1", "Alexa cannot answer questions it has not been trained for.", "present"),
    ("P2", "In the robot example the robot uses a plank to cross the river.", "present"),
    ("P3", "Weak AI is also called narrow AI.", "present"),
    ("P4", "The video mentions an AI robot that has been given citizenship.", "present"),
    ("P5", "The speaker says AI is used in smartphones, cars, social media feeds, video games and banking.", "present"),
    # NEGATIVE
    ("N1", "The speaker says Ultron is an example of weak AI.", "contradicted"),
    ("N2", "The speaker says Alexa is an example of strong AI.", "contradicted"),
    ("N3", "The speaker says Alexa can answer questions it was never trained for.", "contradicted"),
    ("N4", "The speaker says weak AI and strong AI mean the same thing.", "contradicted"),
    ("N5", "The speaker says Kurzweil predicts robots will never match human intelligence.", "contradicted"),
    ("N6", "The speaker says the robot gave up because there was no way across the river.", "contradicted"),
    ("N7", "The speaker explains how recommendation algorithms rank social media posts.", "absent"),
]

results = []
for cid, claim, expected_judgment in controls:
    scored_en = []
    for idx, el in enumerate(english_lines):
        sc = score_match(claim, el['text'])
        # Also check semantic keywords
        if "alexa" in claim.lower() and "alexa" in el['text'].lower(): sc += 5
        if "plank" in claim.lower() and ("plank" in el['text'].lower() or "लकड़ी" in hindi_lines[idx]['text']): sc += 5
        if "river" in claim.lower() and ("river" in el['text'].lower() or "नदी" in hindi_lines[idx]['text']): sc += 5
        if "citizenship" in claim.lower() and ("citizenship" in el['text'].lower() or "सिटीजनशिप" in hindi_lines[idx]['text']): sc += 5
        if "smartphones" in claim.lower() and "smartphones" in el['text'].lower(): sc += 5
        if "ultron" in claim.lower() and ("ultron" in el['text'].lower() or "अल्ट्रॉन" in hindi_lines[idx]['text']): sc += 5
        if "kurzweil" in claim.lower() and ("kurzweil" in el['text'].lower() or "कूर्स" in hindi_lines[idx]['text']): sc += 5
        scored_en.append((sc, idx, el))

    scored_en.sort(key=lambda x: x[0], reverse=True)
    top3_indices = [x[1] for x in scored_en[:3]]

    top3_en = [english_lines[i] for i in top3_indices]
    top3_hi = [hindi_lines[i] for i in top3_indices]

    results.append({
        'id': cid,
        'claim': claim,
        'judgment': expected_judgment,
        'top3_en': top3_en,
        'top3_hi': top3_hi
    })

with open('scratch/closest_lines_fresh_controls.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("Saved scratch/closest_lines_fresh_controls.json successfully.")
