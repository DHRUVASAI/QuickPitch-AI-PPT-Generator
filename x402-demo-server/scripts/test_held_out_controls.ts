import fs from 'node:fs';
import path from 'node:path';
import { writeEvidence } from './evidence-helper.js';
import { gradeBulletAgainstSource } from '../core/synthesis/bullet-verifier.js';
import type { ChunkWithTime } from '../core/transcript/timestamp-utils.js';

async function main() {
  const root = path.resolve(__dirname, '../../');
  const serverDir = path.join(root, 'x402-demo-server');

  const hindiVttPath = path.join(serverDir, 'scratch/qzAHXO_parsed_vtt.json');
  const whisperPath = path.join(serverDir, 'scratch/qzAHXO_large_v3_translate.json');
  const translationPath = path.join(serverDir, 'scratch/qzAHXO_step3_deduped_translated.json');

  const hindiCues = JSON.parse(fs.readFileSync(hindiVttPath, 'utf-8'));
  const whisperData = JSON.parse(fs.readFileSync(whisperPath, 'utf-8'));
  const translatedUnits = JSON.parse(fs.readFileSync(translationPath, 'utf-8'));

  const rawHindiText = hindiCues.map((c: any) => c.text).join(' ');
  const rawWhisperText = whisperData.segments.map((s: any) => s.text).join(' ');
  const rawEnglishTranslation = translatedUnits.map((u: any) => u.translatedText || '').join(' ');

  const fullCorpus = {
    hindi: rawHindiText.toLowerCase(),
    whisper: rawWhisperText.toLowerCase(),
    translation: rawEnglishTranslation.toLowerCase(),
  };

  const positiveControls = [
    { text: 'Weak AI performs only one kind of task.', keywords: ['weak', 'task', 'वीक', 'टास्क'] },
    { text: 'AlphaGo is an example of narrow AI.', keywords: ['alphago', 'narrow', 'अल्फा', 'गो'] },
    { text: 'Alexa is an example of narrow AI.', keywords: ['alexa', 'weak', 'narrow', 'अलेक्सा'] },
    { text: 'Ultron from Avengers is an example of strong AI.', keywords: ['ultron', 'avengers', 'strong', 'अल्ट्रॉन', 'अवेंजर्स'] },
    { text: 'Deep learning is a subset of machine learning.', keywords: ['deep learning', 'subset', 'machine learning', 'सबसेट'] },
  ];

  const negativeControls = [
    { text: 'The speaker explains how transformer models use attention.', keywords: ['transformer', 'attention', 'ट्रांसफार्मर'] },
    { text: 'The video recommends banning autonomous weapons.', keywords: ['autonomous weapons', 'weapons', 'हथियार', 'बैन'] },
    { text: 'The speaker says strong AI is already sold in commercial products.', keywords: ['commercial products', 'already sold'] },
    { text: 'The speaker says AI was invented at MIT in 1970.', keywords: ['mit', '1970'] },
    { text: 'The speaker explains how blockchain secures AI models.', keywords: ['blockchain', 'ब्लॉकचेन'] },
  ];

  console.log('--- PRE-RUN CORPUS GREP CHECK ---');
  const preGrepResults: any[] = [];

  for (const pos of positiveControls) {
    const inHindi = pos.keywords.some(k => fullCorpus.hindi.includes(k));
    const inWhisper = pos.keywords.some(k => fullCorpus.whisper.includes(k));
    const inTrans = pos.keywords.some(k => fullCorpus.translation.includes(k));
    const confirmed = inHindi || inWhisper || inTrans;
    preGrepResults.push({
      type: 'POSITIVE',
      claim: pos.text,
      confirmedInCorpus: confirmed,
      foundIn: { inHindi, inWhisper, inTranslation: inTrans },
    });
  }

  for (const neg of negativeControls) {
    const inHindi = neg.keywords.some(k => fullCorpus.hindi.includes(k));
    const inWhisper = neg.keywords.some(k => fullCorpus.whisper.includes(k));
    const inTrans = neg.keywords.some(k => fullCorpus.translation.includes(k));
    const absent = !inHindi && !inWhisper && !inTrans;
    preGrepResults.push({
      type: 'NEGATIVE',
      claim: neg.text,
      confirmedAbsentInCorpus: absent,
      foundIn: { inHindi, inWhisper, inTranslation: inTrans },
    });
  }

  // Entire video combined chunk for verification
  const fullVideoChunk: ChunkWithTime & { originalText?: string } = {
    index: 1,
    startSec: 0,
    endSec: 327.9,
    timestamps: '00:00 - 05:28',
    text: rawEnglishTranslation,
    originalText: rawHindiText,
  };

  console.log('--- RUNNING FIXED VERIFIER ON 10 HELD-OUT CONTROLS ---');
  const positiveEvaluations: any[] = [];
  let falseRejects = 0; // Positives flagged as non-SUPPORTED

  for (const pos of positiveControls) {
    const audit = await gradeBulletAgainstSource(pos.text, fullVideoChunk, undefined, rawWhisperText);
    const isSupported = audit.grade === 'SUPPORTED';
    if (!isSupported) falseRejects++;
    positiveEvaluations.push({
      bullet: pos.text,
      grade: audit.grade,
      isVerified: isSupported,
      flaggedTerms: audit.flaggedTerms,
      reason: audit.reason,
    });
  }

  const negativeEvaluations: any[] = [];
  let falseAccepts = 0; // Negatives graded as SUPPORTED

  for (const neg of negativeControls) {
    const audit = await gradeBulletAgainstSource(neg.text, fullVideoChunk, undefined, rawWhisperText);
    const isFlagged = audit.grade !== 'SUPPORTED';
    if (!isFlagged) falseAccepts++;
    negativeEvaluations.push({
      bullet: neg.text,
      grade: audit.grade,
      isFlagged,
      flaggedTerms: audit.flaggedTerms,
      reason: audit.reason,
    });
  }

  const positiveFlagRate = `${((falseRejects / positiveControls.length) * 100).toFixed(1)}%`;
  const negativeFlagRate = `${(((negativeControls.length - falseAccepts) / negativeControls.length) * 100).toFixed(1)}%`;
  const falseRejectRate = `${((falseRejects / positiveControls.length) * 100).toFixed(1)}%`;
  const falseAcceptRate = `${((falseAccepts / negativeControls.length) * 100).toFixed(1)}%`;

  const result = writeEvidence(
    'held_out_controls.json',
    {
      description: 'Pre-check corpus grep and single-run verification results for 10 user-provided held-out controls (5 positive, 5 negative).',
      preRunCorpusGrepCheck: {
        allPositivesConfirmedPresent: preGrepResults.filter(r => r.type === 'POSITIVE').every(r => r.confirmedInCorpus),
        allNegativesConfirmedAbsent: preGrepResults.filter(r => r.type === 'NEGATIVE').every(r => r.confirmedAbsentInCorpus),
        details: preGrepResults,
      },
      verificationMetrics: {
        positiveGroup: {
          total: positiveControls.length,
          supportedCount: positiveControls.length - falseRejects,
          flaggedCount: falseRejects,
          flagRate: positiveFlagRate,
          falseRejectRate,
        },
        negativeGroup: {
          total: negativeControls.length,
          flaggedCount: negativeControls.length - falseAccepts,
          acceptedCount: falseAccepts,
          flagRate: negativeFlagRate,
          falseAcceptRate,
        },
      },
      positiveControls: positiveEvaluations,
      negativeControls: negativeEvaluations,
    },
    [
      'scratch/qzAHXO_parsed_vtt.json',
      'scratch/qzAHXO_large_v3_translate.json',
      'scratch/qzAHXO_step3_deduped_translated.json',
      'core/synthesis/bullet-verifier.ts',
    ]
  );

  console.log(`Held-out controls audit written to ${result.relativePath}`);
  console.log(`Positive Group: ${positiveControls.length - falseRejects}/${positiveControls.length} SUPPORTED (False Reject Rate: ${falseRejectRate})`);
  console.log(`Negative Group: ${negativeControls.length - falseAccepts}/${negativeControls.length} FLAGGED (False Accept Rate: ${falseAcceptRate})`);
}

main().catch(err => {
  console.error('Error running held-out controls:', err);
  process.exit(1);
});
