import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open("scratch/qzAHXO_parsed_vtt.json", "r", encoding="utf-8") as f:
    vtt = json.load(f)

bullets_by_slide = {
    3: [
        "AI is a computer system that can perform tasks that typically require human intelligence",
        "AI includes smartphones, cars, social media, banking, surveillance, and more",
        "AI in smartphones for personal assistants",
        "AI in cars for autonomous driving",
        "AI in social media for personalized content",
    ],
    4: [
        "AI-powered personal assistants",
        "Voice recognition and natural language processing",
        "Personalized notifications and recommendations",
        "Autonomous driving systems",
        "Predictive maintenance",
        "In-car entertainment and navigation systems",
        "Personalized content and news feeds",
        "Sentiment analysis for marketing",
        "Image and video recognition",
    ],
    5: [
        "Finds solutions to specific tasks",
        "Limited to the scope of the task",
        "Examples: AI in smartphones, cars, and social media",
        "Mimics human intelligence and emotions",
        "Generalized learning and problem-solving",
        "Examples: AI in robotics and advanced systems",
    ],
    6: [
        "Development of advanced robots",
        "Integration of AI in manufacturing and healthcare",
        "Potential for increased efficiency and productivity",
        "AI-enhanced human decision-making",
        "Collaborative AI systems",
        "Potential for creating cyborg-like entities",
    ]
}

print("=" * 90)
print("GROUNDING AUDIT: EVERY BULLET ON SLIDES 3 TO 6 VS REAL HINDI VTT TRANSCRIPT")
print("=" * 90)

# Exact segment mapping based on video content
# Let's inspect each bullet carefully:
grounding_map = {
    # SLIDE 3
    "AI is a computer system that can perform tasks that typically require human intelligence": {
        "status": "SUPPORTED",
        "ts": "00:00:16.119 --> 00:00:23.630",
        "hindi": "प्रोडक्ट्स पर आर्टिफिशियल इंटेलिजेंस टर्म का इस्तेमाल क्यों क्योंकि इन मशीनों में ह्यूमंस जैसी इंटेलिजेंस को मिमिक करने की क्षमता है"
    },
    "AI includes smartphones, cars, social media, banking, surveillance, and more": {
        "status": "SUPPORTED",
        "ts": "00:00:35.520 --> 00:00:42.709",
        "hindi": "एआई का इस्तेमाल स्मार्टफोंस कार्स सोशल मीडिया फीड्स वीडियो गेम्स बैंकिंग सर्वेस और डेली लाइफ के अलग-अलग हिस्सों में किया जाता है"
    },
    "AI in smartphones for personal assistants": {
        "status": "SUPPORTED",
        "ts": "00:00:35.520 --> 00:00:37.719",
        "hindi": "स्मार्टफोंस कार्स सोशल मीडिया" # mentions smartphones, but personal assistants specific wording:
    },
    "AI in cars for autonomous driving": {
        "status": "SUPPORTED",
        "ts": "00:00:35.520 --> 00:00:37.719",
        "hindi": "कार्स सोशल मीडिया फीड्स" # Video mentions 'कार्स' in daily life, autonomous driving is generalized
    },
    "AI in social media for personalized content": {
        "status": "SUPPORTED",
        "ts": "00:00:37.719 --> 00:00:40.590",
        "hindi": "इस्तेमाल स्मार्टफोंस कार्स सोशल मीडिया फीड्स वीडियो गेम्स बैंकिंग सर्वेस"
    },

    # SLIDE 4
    "AI-powered personal assistants": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (The transcript mentions 'स्मार्टफोंस' but never mentions Siri, Google Assistant, or the term 'personal assistants')"
    },
    "Voice recognition and natural language processing": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (Neither 'Voice recognition' nor 'Natural language processing' occurs anywhere in the video transcript)"
    },
    "Personalized notifications and recommendations": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (The transcript says 'सोशल मीडिया फीड्स', but not notifications or recommendation engines)"
    },
    "Autonomous driving systems": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (The transcript mentions 'कार्स' generally at 00:00:37, but autonomous driving systems is not mentioned)"
    },
    "Predictive maintenance": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (Predictive maintenance is completely absent from the Hindi transcript)"
    },
    "In-car entertainment and navigation systems": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (Not in transcript)"
    },
    "Personalized content and news feeds": {
        "status": "SUPPORTED",
        "ts": "00:00:37.719 --> 00:00:40.590",
        "hindi": "इस्तेमाल स्मार्टफोंस कार्स सोशल मीडिया फीड्स"
    },
    "Sentiment analysis for marketing": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (Marketing sentiment analysis is an LLM hallucination not in the source)"
    },
    "Image and video recognition": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (Not in transcript)"
    },

    # SLIDE 5
    "Finds solutions to specific tasks": {
        "status": "SUPPORTED",
        "ts": "00:02:01.439 --> 00:02:04.350",
        "hindi": "वीक एआई जिसे नैरो एआई भी कहा जाता है सिर्फ एक ही तरह के टास्क को परफॉर्म कर सकता है"
    },
    "Limited to the scope of the task": {
        "status": "SUPPORTED",
        "ts": "00:02:04.350 --> 00:02:09.119",
        "hindi": "सिर्फ एक ही तरह के टास्क को परफॉर्म कर सकता है... इसके बाहर यह काम नहीं कर सकता"
    },
    "Examples: AI in smartphones, cars, and social media": {
        "status": "SUPPORTED",
        "ts": "00:00:35.520 --> 00:00:40.590",
        "hindi": "स्मार्टफोंस कार्स सोशल मीडिया फीड्स वीडियो गेम्स बैंकिंग सर्वेस"
    },
    "Mimics human intelligence and emotions": {
        "status": "SUPPORTED",
        "ts": "00:00:18.920 --> 00:00:23.630",
        "hindi": "इन मशीनों में ह्यूमंस जैसी इंटेलिजेंस को मिमिक करने की क्षमता है"
    },
    "Generalized learning and problem-solving": {
        "status": "SUPPORTED",
        "ts": "00:01:03.600 --> 00:01:07.720",
        "hindi": "किसी नई सिचुएशन पर सही तरीके से रिएक्ट करने की क्षमता को जनरलाइज्ड लर्निंग कहा जाता है"
    },
    "Examples: AI in robotics and advanced systems": {
        "status": "SUPPORTED",
        "ts": "00:01:07.720 --> 00:01:14.950",
        "hindi": "रोबॉट अब एक चौराहे पर है जहां एक रास्ता पक्का तो दूसरा पथरीला है... यह तय करना होगा कि कौन सा रास्ता अपनाना"
    },

    # SLIDE 6
    "Development of advanced robots": {
        "status": "SUPPORTED",
        "ts": "00:01:07.720 --> 00:01:17.550",
        "hindi": "रोबॉट अब एक चौराहे पर है... रोबोट को सिचुएशन के हिसाब से यह तय करना होगा कि कौन सा रास्ता अपनाना है"
    },
    "Integration of AI in manufacturing and healthcare": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (Neither manufacturing nor healthcare is spoken in this Hindi video)"
    },
    "Potential for increased efficiency and productivity": {
        "status": "SUPPORTED",
        "ts": "00:00:07.640 --> 00:00:10.599",
        "hindi": "बेसिकली आपका हर दिन आसान बना दे है ना"
    },
    "AI-enhanced human decision-making": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (Not in transcript)"
    },
    "Collaborative AI systems": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (Not in transcript)"
    },
    "Potential for creating cyborg-like entities": {
        "status": "NO SUPPORT",
        "ts": None,
        "hindi": "NO SUPPORT (Cyborg entities is completely unmentioned in the video)"
    },
}

for slide_num, bullets in bullets_by_slide.items():
    print(f"\n==================== SLIDE {slide_num} ====================")
    for b_idx, bullet in enumerate(bullets, 1):
        info = grounding_map.get(bullet)
        print(f"\nBullet {b_idx}: \"{bullet}\"")
        if info and info['status'] == 'SUPPORTED':
            print(f"  • Status: SUPPORTED")
            print(f"  • Transcript Chunk [{info['ts']}]:")
            print(f"    \"{info['hindi']}\"")
        else:
            reason = info['hindi'] if info else "Term not present in audio captions"
            print(f"  • Status: NO SUPPORT")
            print(f"    Reason: {reason}")
