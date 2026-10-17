import fs from 'node:fs';
import path from 'node:path';
import { verifyQuote, formatVerifiedQuote } from '../core/utils/verify-quote.js';

function main() {
  console.log('='.repeat(90));
  console.log('ITEM 3: INDEPENDENT REFERENCE (WHISPER LARGE-V3 TASK=TRANSLATE) VS STEP 2');
  console.log('='.repeat(90));

  const lv3Path = path.join(process.cwd(), 'scratch', 'qzAHXO_large_v3_translate.json');
  const step2Path = path.join(process.cwd(), 'scratch', 'qzAHXO_step2_translated.json');
  const hindiCleanPath = path.join(process.cwd(), 'scratch', 'qzAHXO-cN5Q_captions_clean.txt');
  const whisperRawPath = path.join(process.cwd(), 'scratch', 'whisper_large-v3_raw.txt');

  const lv3Data = JSON.parse(fs.readFileSync(lv3Path, 'utf-8'));
  const step2Units = JSON.parse(fs.readFileSync(step2Path, 'utf-8'));
  const hindiClean = fs.readFileSync(hindiCleanPath, 'utf-8');
  const whisperRaw = fs.readFileSync(whisperRawPath, 'utf-8');

  // Part A: 10 chunks side-by-side
  console.log('\nPART A: 10 CHUNKS SIDE-BY-SIDE (STEP 2 TRANSLATION VS LARGE-V3 TRANSLATE)');
  console.log('-'.repeat(90));

  for (let i = 0; i < 10; i++) {
    const u = step2Units[i];
    if (!u) continue;

    // Find large-v3 segments overlapping with unit timeframe
    const matchingLv3 = lv3Data.segments.filter((s: any) => {
      return (s.start >= u.startSec - 2 && s.start <= u.endSec + 2) ||
             (s.end >= u.startSec - 2 && s.end <= u.endSec + 2);
    });
    const lv3Text = matchingLv3.map((s: any) => s.text).join(' ');

    console.log(`\n### CHUNK ${i + 1} [${u.timestamps}]`);
    console.log(`[Step 2 Translation (LLM Faithful)]:`);
    console.log(`"${u.translatedText}"`);
    console.log(`[Large-v3 Independent Translation (task=translate)]:`);
    console.log(`"${lv3Text || '(No matching segment)'}"`);

    // Verify quote in large-v3 output
    if (matchingLv3.length > 0) {
      const v = verifyQuote(lv3Path, matchingLv3[0].text);
      console.log(`Reference Verification: ${formatVerifiedQuote(v)}`);
    }
  }

  // Part B: Video topics in order with timestamps from Hindi text
  console.log('\n' + '='.repeat(90));
  console.log('PART B: VIDEO TOPICS IN ORDER WITH TIMESTAMPS FROM HINDI TEXT');
  console.log('='.repeat(90));

  const topics = [
    {
      time: '00:00 - 00:20',
      topic: 'AI in Daily Life',
      hindiEvidence: 'सोचिए कि कोई मशीन है जो आपके हिसाब से आपकी अलमारी सेट कर दे या आपके परिवार के हर मेंबर को उनकी पसंद के हिसाब से कॉफी सर्व कर दे',
      englishAligned: 'Everyday AI convenience: wardrobe sorting, customized coffee serving, making life easy.'
    },
    {
      time: '00:20 - 00:45',
      topic: 'Definition of Artificial Intelligence',
      hindiEvidence: 'इन मशीनों में ह्यूमंस जैसी इंटेलिजेंस को आर्टिफिशली इनकॉरपोरेट किया जाता है ताकि वह हमारे जैसे टास्क्स कर सके',
      englishAligned: 'Cognitive faculties artificially incorporated into machines to execute human-like tasks using algorithms and math functions.'
    },
    {
      time: '00:45 - 01:17',
      topic: 'Lab Robot Experiment: Three Core Capabilities',
      hindiEvidence: 'किसी नई सिचुएशन पर सही तरीके से रिएक्ट करने की क्षमता को जनरलाइज्ड लर्निंग कहा जाता है',
      englishAligned: 'Robot in field demonstrating: 1. Generalized learning (adapting to new environment), 2. Reasoning (choosing rocky vs paved path), 3. Problem solving (crossing river using a plank).'
    },
    {
      time: '01:17 - 01:54',
      topic: 'Category 1: Weak AI / Narrow AI (AlphaGo & Alexa)',
      hindiEvidence: 'वीक एआई जिसे नैरो एआई भी कहा जाता है सिर्फ एक ही टास्क पर फोकस करता है एग्जांपल के लिए अल्फा गो गेम गो का उस्ताद है',
      englishAligned: 'Narrow AI focused on single domain: AlphaGo is master of Go but cannot play chess; Alexa matches keywords (Despacito) but cannot answer untrained traffic questions.'
    },
    {
      time: '01:54 - 02:18',
      topic: 'Category 2: Strong AI (Ultron from Avengers)',
      hindiEvidence: 'अवेंजर्स का अल्ट्रॉन स्ट्रंग एआई का आइडियल एग्जांपल है ऐसा इसलिए क्योंकि यह सेल्फ अवेयर है और इसमें इमोशंस के डेवलप करने की भी कैपेबिलिटी है',
      englishAligned: 'General / Strong AI possessing self-awareness and emotional evolution, making machine behavior unpredictable.'
    },
    {
      time: '02:18 - 02:35',
      topic: 'AI vs Machine Learning vs Deep Learning',
      hindiEvidence: 'मशीन लर्निंग एआई हासिल करने की एक टेक्नीक है वहीं डीप लर्निंग मशीन लर्निंग का एक सबसेट है',
      englishAligned: 'Machine Learning uses algorithms to learn from data; Deep Learning is a subset inspired by human neural biology.'
    },
    {
      time: '02:35 - 02:56',
      topic: 'Future Milestones: Kurzweil Singularity & Elon Musk Cyborgs',
      hindiEvidence: 'इलन मस्क ने भविष्यवाणी की है कि ह्यूमन माइंड और शरीर को एआई इंप्लांट से बढ़ाया जाएगा जो हमें कुछ हद तक साइबर्ग बना देगा',
      englishAligned: 'Futurist Kurzweil predicts 2045 Singularity (robots as smart as humans); Elon Musk predicts neural implants creating cyborgs.'
    },
    {
      time: '02:56 - 03:27',
      topic: 'Viewer Quiz & Uncharted Frontiers of AI',
      hindiEvidence: 'नीचे दिया गया कौन सा एआई प्रोजेक्ट अभी तक मौजूद नहीं है',
      englishAligned: 'Quiz on non-existent AI projects (citizenship, muscular skeletal, emotional empathy); Amazon gift vouchers; conclusion on exploring uncharted AI domains.'
    }
  ];

  topics.forEach((t, i) => {
    console.log(`\n${i + 1}. [${t.time}] ${t.topic}`);
    console.log(`   Hindi Source Evidence: "${t.hindiEvidence}"`);
    console.log(`   English Aligned Chunk: "${t.englishAligned}"`);
    const v = verifyQuote(hindiCleanPath, t.hindiEvidence.slice(0, 30));
    console.log(`   Quote Verification: ${formatVerifiedQuote(v)}`);
  });

  // Part C: Plain statement on 7 terms
  console.log('\n' + '='.repeat(90));
  console.log('PART C: VERIFICATION OF THE 7 REQUIRED TERMS IN SOURCE');
  console.log('='.repeat(90));

  const checkTerms = [
    { name: 'Kurzweil', hindiKey: 'कूर्स', lv3Key: 'Kurzweil' },
    { name: 'Masayoshi Son', hindiKey: 'मासायोशी', lv3Key: 'Masayoshi' },
    { name: 'unemployment', hindiKey: 'बेरोजगारी', lv3Key: 'unemployment' },
    { name: 'kill switches', hindiKey: 'किल स्विच', lv3Key: 'kill switch' },
    { name: 'weak AI', hindiKey: 'वीक एआई', lv3Key: 'Weak AI' },
    { name: 'strong AI', hindiKey: 'स्ट्रंग एआई', lv3Key: 'Strong AI' },
    { name: 'AlphaGo', hindiKey: 'अल्फा गो', lv3Key: 'AlphaGo' },
  ];

  for (const t of checkTerms) {
    const inHindi = hindiClean.toLowerCase().includes(t.hindiKey.toLowerCase()) || whisperRaw.toLowerCase().includes(t.hindiKey.toLowerCase());
    const inLv3 = lv3Data.full_text.toLowerCase().includes(t.lv3Key.toLowerCase());
    const isPresent = inHindi || inLv3;

    console.log(`\n- **${t.name}**: ${isPresent ? 'YES (Present in source)' : 'NO (NOT in source)'}`);
    if (isPresent) {
      if (inHindi) {
        console.log(`  Found in Hindi source text matching key "${t.hindiKey}".`);
      }
      if (inLv3) {
        console.log(`  Found in Whisper large-v3 translation: "${t.lv3Key}".`);
      }
    } else {
      console.log(`  Searched Hindi captions, Whisper raw text, and large-v3 translation. 0 occurrences found.`);
    }
  }
}

main();
