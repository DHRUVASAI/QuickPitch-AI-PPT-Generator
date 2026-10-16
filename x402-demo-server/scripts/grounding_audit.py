import os
import sys
import json
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

pptx_path = "scratch/real_pipeline_hindi_deck.pptx"
vtt_json_path = "scratch/qzAHXO_parsed_vtt.json"

if not os.path.exists(pptx_path):
    print(f"Error: {pptx_path} not found")
    sys.exit(1)

with open(vtt_json_path, "r", encoding="utf-8") as f:
    vtt_segments = json.load(f)

# Extract slides from pptx zip
archive = zipfile.ZipFile(pptx_path, 'r')
slide_entries = [name for name in archive.namelist() if name.startswith("ppt/slides/slide") and name.endswith(".xml")]

def get_slide_num(name):
    base = os.path.basename(name)
    num = ''.join(c for c in base if c.isdigit())
    return int(num) if num else 0

slide_entries.sort(key=get_slide_num)

print(f"Total slides found in {pptx_path}: {len(slide_entries)}")

ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}

deck_slides = []
for entry_name in slide_entries:
    xml_data = archive.read(entry_name)
    root = ET.fromstring(xml_data)
    
    # Extract text from shapes
    slide_texts = []
    for sp in root.findall('.//{http://schemas.openxmlformats.org/presentationml/2006/main}sp'):
        txBody = sp.find('{http://schemas.openxmlformats.org/presentationml/2006/main}txBody')
        if txBody is not None:
            shape_lines = []
            for p in txBody.findall('a:p', ns):
                p_text = "".join(t.text for t in p.findall('.//a:t', ns) if t.text).strip()
                if p_text:
                    shape_lines.append(p_text)
            if shape_lines:
                slide_texts.append("\n".join(shape_lines))
    deck_slides.append(slide_texts)

print("=" * 80)
print("AUDIT OF SLIDES 3 TO 6 FROM real_pipeline_hindi_deck.pptx")
print("=" * 80)

for s_idx in range(2, min(6, len(deck_slides))):
    print(f"\n############################# SLIDE {s_idx + 1} #############################")
    texts = deck_slides[s_idx]
    for t in texts:
        print(f"  • {t}")
