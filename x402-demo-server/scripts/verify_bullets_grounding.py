import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("scratch/qzAHXO_parsed_vtt.json", "r", encoding="utf-8") as f:
    vtt = json.load(f)

# Helper to find text in VTT segments
def search_vtt(keywords):
    matches = []
    for s in vtt:
        text = s['text']
        for kw in keywords:
            if kw.lower() in text.lower():
                matches.append(s)
                break
    return matches

# Print full transcript for reference
print(f"Total VTT segments: {len(vtt)}")
# Let's inspect where specific concepts appear
concepts = [
    ("Machine/Human intelligence", ["मशीनों", "ह्यूमंस", "इंटेलिजेंस", "इंसान"]),
    ("Almirah / Coffee", ["अलमारी", "कॉफ़ी", "कॉफी"]),
    ("Smartphones / Siri / Alexa", ["स्मार्टफोन", "फोन", "असिस्टेंट"]),
    ("Cars / Autonomous", ["कार", "गाड़ी", "ड्राइव"]),
    ("Weak AI / Narrow AI", ["वीक", "नैरो", "weak", "narrow"]),
    ("Strong AI / General AI", ["स्ट्रॉन्ग", "strong", "जनरल", "general"]),
    ("Robots / Sophia", ["रोबोट", "सोफिया", "robot"]),
    ("Manufacturing / Healthcare", ["मैन्युफैक्चरिंग", "हेल्थकेयर", "हॉस्पिटल", "डॉक्टर"]),
    ("Cyborg", ["साइबॉर्ग", "cyborg"]),
    ("John McCarthy", ["मैकार्थी", "mccarthy"]),
    ("Banking / Surveillance", ["बैंकिंग", "सर्विलांस", "बैंक"]),
]

print("\n--- Key Concept Scan in Hindi Transcript ---")
for name, kws in concepts:
    m = search_vtt(kws)
    print(f"Concept '{name}': {len(m)} segments found.")
    for seg in m[:3]:
        print(f"   [{seg['start']} --> {seg['end']}] {seg['text']}")
