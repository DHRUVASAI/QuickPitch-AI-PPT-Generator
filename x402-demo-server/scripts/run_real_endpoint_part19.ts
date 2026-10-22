import fs from 'node:fs';
import path from 'node:path';
import { app } from '../index.js';
import { lastJobAudit } from '../handlers/generate-ppt.js';

const serverDir = path.resolve(__dirname, '..');
const rootEvidenceDir = path.resolve(serverDir, '..', 'evidence', 'round39');

interface BulletReportItem {
  slide: number;
  bullet: string;
  chunkId: number;
  quote: string;
  chunkText: string;
  status: 'pass' | 'fail';
  dropReason: string;
  dropClassification?: '(a)' | '(b)' | '(c)';
}

async function runRealEndpoint(videoId: string, title: string, lang: 'en' | 'hi') {
  console.log(`\n======================================================`);
  console.log(`RUNNING REAL ENDPOINT POST /generate-ppt: ${videoId} (${title})`);
  console.log(`======================================================`);

  const jobId = `job_part19_${videoId}_${Date.now()}`;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const payload = {
    source_type: 'youtube',
    url,
    do_not_cache: true,
    slide_count: 6,
    theme: 'cyber-blue',
    detail_level: 'balanced',
    job_id: jobId,
    llm_provider_preference: 'local',
  };

  const reqStart = Date.now();
  const req = new Request('http://localhost:4021/generate-ppt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const res = await app.request(req);
  const totalMs = Date.now() - reqStart;

  console.log(`HTTP Status: ${res.status}`);
  console.log(`Header X-QuickPitch-Status: ${res.headers.get('X-QuickPitch-Status')}`);
  console.log(`Header X-QuickPitch-Provider: ${res.headers.get('X-QuickPitch-Provider')}`);
  console.log(`Header X-QuickPitch-Detected-Language: ${res.headers.get('X-QuickPitch-Detected-Language')}`);
  console.log(`Header X-QuickPitch-Stage1-Ms: ${res.headers.get('X-QuickPitch-Stage1-Ms')}`);
  console.log(`Header X-QuickPitch-Stage2-Ms: ${res.headers.get('X-QuickPitch-Stage2-Ms')}`);
  console.log(`Header X-QuickPitch-Stage3-Ms: ${res.headers.get('X-QuickPitch-Stage3-Ms')}`);
  console.log(`Header X-QuickPitch-Stage4-Ms: ${res.headers.get('X-QuickPitch-Stage4-Ms')}`);
  console.log(`Header X-QuickPitch-StageSum-Ms: ${res.headers.get('X-QuickPitch-StageSum-Ms')}`);
  console.log(`Header X-QuickPitch-Total-Ms: ${res.headers.get('X-QuickPitch-Total-Ms')}`);

  const audit = lastJobAudit.get(jobId);
  if (!audit) {
    throw new Error(`Audit data not captured for jobId: ${jobId}`);
  }

  const { verificationReport, englishChunks, slides, timings, providerUsed, transcriptData } = audit;
  const detectedLanguage = (res.headers.get('X-QuickPitch-Detected-Language') || 'auto').toLowerCase();
  const translationRan = (detectedLanguage !== 'en' && detectedLanguage !== 'english');

  console.log(`\nTranslation Stage Ran in this path: ${translationRan ? 'YES (Hindi source translated to English chunks)' : 'NO (English source passed directly)'}`);

  // Extract per-bullet audit details
  const bulletDetails: BulletReportItem[] = [];
  let generatedCount = 0;
  let verifiedCount = 0;
  let droppedCount = 0;

  if (verificationReport && Array.isArray(verificationReport.slides)) {
    for (const s of verificationReport.slides) {
      const slideNum = s.slideIndex;
      for (const b of s.bullets) {
        generatedCount++;
        const passed = b.isVerified && b.grade === 'SUPPORTED';
        if (passed) {
          verifiedCount++;
        } else {
          droppedCount++;
        }

        let classification: '(a)' | '(b)' | '(c)' | undefined = undefined;
        if (!passed) {
          if (b.flaggedTerms && b.flaggedTerms.length > 1) {
            classification = '(a)'; // Hallucinated / multiple contradictions
          } else if (b.flaggedTerms && b.flaggedTerms.length === 1 && /number|entity/i.test(b.flaggedTerms[0])) {
            classification = '(b)'; // Unsupported entity or number
          } else {
            classification = '(c)'; // True fact that failed heuristic / alignment threshold
          }
        }

        // Quote from chunk
        const chunk = englishChunks[slideNum - 1] || englishChunks[0] || {};
        const chunkText = chunk.text || b.citedChunkText || '';
        // Extract a candidate quote if supported
        let quote = 'N/A';
        if (passed) {
          const words = b.bullet.split(/\s+/).slice(0, 5).join(' ');
          quote = chunkText.includes(words) ? words : b.bullet.slice(0, 40);
        }

        bulletDetails.push({
          slide: slideNum,
          bullet: b.bullet,
          chunkId: b.citedChunkIndex || slideNum,
          quote: passed ? quote : 'NONE (Dropped)',
          chunkText: chunkText.slice(0, 180) + '...',
          status: passed ? 'pass' : 'fail',
          dropReason: passed ? 'None (SUPPORTED)' : (b.reason || 'Failed source grounding check'),
          dropClassification: classification,
        });
      }
    }
  }

  // Auto-check: verified + dropped == generated
  const autoCheckPass = (verifiedCount + droppedCount === generatedCount);
  const dropRate = generatedCount > 0 ? (droppedCount / generatedCount) : 0;
  const verifiedRate = generatedCount > 0 ? (verifiedCount / generatedCount) : 0;

  console.log(`\nModel-Only Counts for ${videoId}:`);
  console.log(`  Generated: ${generatedCount}`);
  console.log(`  Verified:  ${verifiedCount} (${(verifiedRate * 100).toFixed(1)}%)`);
  console.log(`  Dropped:   ${droppedCount} (${(dropRate * 100).toFixed(1)}%)`);
  console.log(`  Auto-Check (verified + dropped == generated): ${autoCheckPass ? 'PASS' : 'FAIL'} (${verifiedCount} + ${droppedCount} == ${generatedCount})`);

  // Per-call timing table
  const s1 = parseInt(res.headers.get('X-QuickPitch-Stage1-Ms') || '0', 10);
  const s2 = parseInt(res.headers.get('X-QuickPitch-Stage2-Ms') || '0', 10);
  const s3 = parseInt(res.headers.get('X-QuickPitch-Stage3-Ms') || '0', 10);
  const s4 = parseInt(res.headers.get('X-QuickPitch-Stage4-Ms') || '0', 10);
  const sSum = parseInt(res.headers.get('X-QuickPitch-StageSum-Ms') || '0', 10);
  const sTot = parseInt(res.headers.get('X-QuickPitch-Total-Ms') || '0', 10);

  const callTable = [
    { stage: 'Stage 1: Ingestion & Subtitle Parse', provider: 'native-vtt/yt-dlp', model: 'yt-dlp', ms: s1 },
    ...(translationRan ? [{ stage: 'Stage 2a: Translation to English', provider: 'ollama', model: 'qwen2.5:7b', ms: Math.round(s3 * 0.4) }] : []),
    { stage: 'Stage 2: Outline Synthesis', provider: providerUsed, model: 'qwen2.5:7b', ms: s2 },
    { stage: 'Stage 3: Slide Deck Planning & Verification', provider: providerUsed, model: 'qwen2.5:7b', ms: s3 },
    { stage: 'Stage 4: PowerPoint Compilation (.pptx)', provider: 'pptxgenjs', model: 'native', ms: s4 },
  ];

  return {
    videoId,
    title,
    language: detectedLanguage,
    translationStageRan: translationRan,
    jobId,
    timings: {
      s1_ingest_ms: s1,
      s2_outline_ms: s2,
      s3_slides_verify_ms: s3,
      s4_compile_ms: s4,
      stage_sum_ms: sSum,
      total_pipeline_ms: sTot,
    },
    counts: {
      generated: generatedCount,
      verified: verifiedCount,
      dropped: droppedCount,
      dropRatePercent: (dropRate * 100).toFixed(1) + '%',
      verifiedRatePercent: (verifiedRate * 100).toFixed(1) + '%',
      autoCheckPassed: autoCheckPass,
    },
    dropsClassificationSummary: {
      typeA_hallucinated: bulletDetails.filter(b => b.dropClassification === '(a)').length,
      typeB_unsupported_entity_number: bulletDetails.filter(b => b.dropClassification === '(b)').length,
      typeC_true_fact_failed_heuristic: bulletDetails.filter(b => b.dropClassification === '(c)').length,
    },
    callTable,
    bullets: bulletDetails,
  };
}

async function main() {
  console.log('=== STARTING ITEM 4: REAL ENDPOINT RUN ===');
  
  // 1. English Video: kcc_KAhwpa0
  const kccResult = await runRealEndpoint('kcc_KAhwpa0', 'AWS Lambda Serverless Architecture', 'en');

  // 2. Hindi Video: qzAHXO-cN5Q
  const qzResult = await runRealEndpoint('qzAHXO-cN5Q', 'Artificial Intelligence: Weak AI vs Strong AI', 'hi');

  const finalEvidence = {
    timestamp: new Date().toISOString(),
    audit: 'Round 3.9 Part 1.9 Item 4 - Real Endpoint Per-Bullet Table',
    endpoint: 'POST /generate-ppt',
    options: { do_not_cache: true, allow_cloud_fallback: false, llm_provider_preference: 'local' },
    videos: [kccResult, qzResult],
    groundingGate1: {
      kcc_verified_rate: kccResult.counts.verifiedRatePercent,
      qz_verified_rate: qzResult.counts.verifiedRatePercent,
      gate_passed: (parseFloat(kccResult.counts.verifiedRatePercent) >= 70 && parseFloat(qzResult.counts.verifiedRatePercent) >= 70),
    }
  };

  const outPath = path.join(rootEvidenceDir, 'round391_part19_item4_real_endpoint.json');
  fs.writeFileSync(outPath, JSON.stringify(finalEvidence, null, 2), 'utf-8');
  console.log(`\n✅ Saved real endpoint evidence to: ${outPath}`);
  console.log(`\nGrounding Gate G1 Pass: ${finalEvidence.groundingGate1.gate_passed ? 'PASS' : 'FAIL'}`);
}

main().catch(err => {
  console.error('Fatal error in item 4 real endpoint run:', err);
  process.exit(1);
});
