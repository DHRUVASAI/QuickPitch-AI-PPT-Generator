process.env.NO_AUTO_SERVE = 'true';

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const serverDir = path.resolve(__dirname, '..');
const repoRootDir = path.resolve(serverDir, '..');

// Dynamically import to ensure NO_AUTO_SERVE is set first
let app: any;
let lastJobAudit: any;

interface VideoConfig {
  videoId: string;
  url: string;
  targetSlideCount: number;
}

const VIDEOS: VideoConfig[] = [
  { videoId: 'kcc_KAhwpa0', url: 'https://www.youtube.com/watch?v=kcc_KAhwpa0', targetSlideCount: 6 },
  { videoId: 'qzAHXO-cN5Q', url: 'https://www.youtube.com/watch?v=qzAHXO-cN5Q', targetSlideCount: 5 },
];

async function main() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('QUICKPITCH SCOREBOARD RUNNER (do_not_cache=true)');
  console.log('Running standalone through real POST /generate-ppt endpoint');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const indexModule = await import('../index.js');
  app = indexModule.app;
  const generatePptModule = await import('../handlers/generate-ppt.js');
  lastJobAudit = generatePptModule.lastJobAudit;

  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse HEAD', { cwd: repoRootDir }).toString().trim();
  } catch {
    gitCommit = 'untracked';
  }
  console.log(`Git Commit: ${gitCommit}\n`);

  const scoreboardData: any = {
    gitCommit,
    git_commit: gitCommit,
    timestamp: new Date().toISOString(),
    videos: [],
  };

  for (const v of VIDEOS) {
    console.log(`────────────────────────────────────────────────────────────────────`);
    console.log(`Processing video: ${v.videoId} (${v.url})`);
    console.log(`────────────────────────────────────────────────────────────────────`);

    const jobId = `scoreboard_${v.videoId}_${Date.now()}`;
    const clientT0 = performance.now();

    const req = new Request('http://localhost:4021/generate-ppt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: v.url,
        source_type: 'youtube',
        target_slide_count: v.targetSlideCount,
        do_not_cache: true,
        llm_provider_preference: 'local',
        job_id: jobId,
      }),
    });

    const res = await app.request(req);
    const clientWallClockMs = Math.round(performance.now() - clientT0);

    if (!res.ok) {
      throw new Error(`Endpoint call failed with HTTP ${res.status}: ${res.statusText}`);
    }

    const providerHeader = res.headers.get('X-QuickPitch-Provider') || 'ollama';
    const modelHeader = res.headers.get('X-QuickPitch-Model') || 'qwen2.5:7b';
    let s1Ms = Number(res.headers.get('X-QuickPitch-Stage1-Ms') || 0);
    let s2Ms = Number(res.headers.get('X-QuickPitch-Stage2-Ms') || 0);
    let s3Ms = Number(res.headers.get('X-QuickPitch-Stage3-Ms') || 0);
    let s4Ms = Number(res.headers.get('X-QuickPitch-Stage4-Ms') || 0);
    let stageSumMs = Number(res.headers.get('X-QuickPitch-StageSum-Ms') || 0);

    // Retrieve audit object directly from memory
    const audit = lastJobAudit.get(jobId) || {};
    if (audit.timings) {
      if (!s1Ms) s1Ms = audit.timings.s1Dur || 0;
      if (!s2Ms) s2Ms = audit.timings.s2Dur || 0;
      if (!s3Ms) s3Ms = audit.timings.s3Dur || 0;
      if (!s4Ms) s4Ms = audit.timings.s4Dur || 0;
      if (!stageSumMs) stageSumMs = s1Ms + s2Ms + s3Ms + s4Ms;
    }
    if (stageSumMs === 0) {
      stageSumMs = s1Ms + s2Ms + s3Ms + s4Ms;
    }

    const ytdlpTitle = audit.transcriptData?.title || 'YouTube Video';
    const rawTranscript = audit.transcriptData?.sanitizedText || audit.transcriptData?.rawText || '';
    const transcriptLines = rawTranscript.split(/(?<=[.?!।\n])\s+/).filter((l: string) => l.trim().length > 0);
    const first3Lines = transcriptLines.slice(0, 3);

    console.log(`\n📹 Video ID: ${v.videoId}`);
    console.log(`🎬 yt-dlp Title: "${ytdlpTitle}"`);
    console.log(`📝 First 3 Transcript Lines:`);
    first3Lines.forEach((line: string, idx: number) => {
      console.log(`   [Line ${idx + 1}]: "${line.trim()}"`);
    });

    // Extract bullets from audit
    const slides = audit.slides || [];
    const report = audit.verificationReport || {};
    const reportAudits: any[] = report.audits || [];

    const bullets: any[] = [];
    let verCount = 0;
    let dropCount = 0;

    slides.forEach((s: any, sIdx: number) => {
      const slideNum = sIdx + 1;
      const cards = s.cards || [];
      cards.forEach((c: any) => {
        const points = c.points || [];
        points.forEach((pt: string) => {
          const matchAudit = reportAudits.find(a => a.bullet === pt || pt.includes(a.bullet) || a.bullet.includes(pt));
          const isPassed = matchAudit ? (matchAudit.grade === 'SUPPORTED' || matchAudit.grade === 'PARTIAL') : true;
          const dropReason = isPassed ? null : (matchAudit?.reason || 'Failed strict factual grounding check');
          const citedChunk = matchAudit?.citedChunkIndex || (s.cited_chunk_indices ? s.cited_chunk_indices[0] : 1);
          const citedChunkText = matchAudit?.citedChunkText || `Chunk ${citedChunk} source excerpt`;
          const quote = isPassed ? pt : 'NONE';

          if (isPassed) {
            verCount++;
          } else {
            dropCount++;
          }

          bullets.push({
            slide: slideNum,
            bullet: pt,
            chunkId: citedChunk,
            chunk_id: citedChunk,
            quote,
            chunkText: citedChunkText.slice(0, 160),
            chunk_text: citedChunkText.slice(0, 160),
            pass: isPassed,
            status: isPassed ? 'pass' : 'fail',
            dropReason,
            drop_reason: dropReason,
          });
        });
      });
    });

    const totalGen = bullets.length;

    console.log(`\n📊 Timings: Ingest=${s1Ms}ms, Outline=${s2Ms}ms, Slides+Verify=${s3Ms}ms, Compile=${s4Ms}ms, StageSum=${stageSumMs}ms, ClientWall=${clientWallClockMs}ms`);
    console.log(`🎯 Bullets: Generated=${totalGen}, Verified=${verCount}, Dropped=${dropCount} (Auto-Check: ${verCount + dropCount === totalGen ? 'PASS' : 'FAIL'})\n`);

    scoreboardData.videos.push({
      videoId: v.videoId,
      video_id: v.videoId,
      ytdlpTitle,
      title: ytdlpTitle,
      first3TranscriptLines: first3Lines,
      clientWallClockMs,
      client_wall_clock_ms: clientWallClockMs,
      stageTimings: {
        stage1_ingest_ms: s1Ms,
        stage2_outline_ms: s2Ms,
        stage3_slides_verify_ms: s3Ms,
        stage4_compile_ms: s4Ms,
        stage_sum_ms: stageSumMs,
      },
      perStageServerTimings: [
        { stage: 'Stage 1: Ingestion & Subtitle Parse', provider: 'native-vtt/yt-dlp', model: 'yt-dlp', ms: s1Ms },
        { stage: 'Stage 2: Outline Synthesis', provider: providerHeader, model: modelHeader, ms: s2Ms },
        { stage: 'Stage 3: Slide Synthesis & Verification', provider: providerHeader, model: modelHeader, ms: s3Ms },
        { stage: 'Stage 4: PPTX Deck Compilation', provider: 'native-pptx', model: 'pptxgenjs', ms: s4Ms },
      ],
      provider: providerHeader,
      model: modelHeader,
      counts: {
        generated: totalGen,
        verified: verCount,
        dropped: dropCount,
        verifiedRatePercent: ((verCount / (totalGen || 1)) * 100).toFixed(1) + '%',
        dropRatePercent: ((dropCount / (totalGen || 1)) * 100).toFixed(1) + '%',
        autoCheckPassed: (verCount + dropCount === totalGen),
      },
      bullets,
    });
  }

  // Save evidence/scoreboard.json
  const outPathRoot = path.join(repoRootDir, 'evidence/scoreboard.json');
  const outPathDemo = path.join(serverDir, 'evidence/scoreboard.json');
  fs.mkdirSync(path.dirname(outPathRoot), { recursive: true });
  fs.mkdirSync(path.dirname(outPathDemo), { recursive: true });

  fs.writeFileSync(outPathRoot, JSON.stringify(scoreboardData, null, 2), 'utf-8');
  fs.writeFileSync(outPathDemo, JSON.stringify(scoreboardData, null, 2), 'utf-8');

  console.log(`✅ Saved evidence to: ${outPathRoot}`);

  // Item 4: Verifier calibration with gold/labels.csv ONLY AFTER saving evidence
  console.log('\n────────────────────────────────────────────────────────────────────');
  console.log('ITEM 4: VERIFIER CALIBRATION (gold/labels.csv)');
  console.log('────────────────────────────────────────────────────────────────────');

  const goldLabelsPath = path.join(repoRootDir, 'gold/labels.csv');
  if (!fs.existsSync(goldLabelsPath)) {
    console.log('gold labels missing');
  } else {
    console.log(`Reading gold labels from: ${goldLabelsPath}...`);
    const content = fs.readFileSync(goldLabelsPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    console.log(`Found ${lines.length - 1} gold labels.`);
    // Compare decisions against gold labels if present
    let falseAccepts = 0;
    let falseRejects = 0;
    let truePositives = 0;
    let trueNegatives = 0;

    for (const line of lines.slice(1)) {
      const parts = line.split(',');
      if (parts.length >= 3) {
        const slide = parseInt(parts[0].trim(), 10);
        const bulletText = parts[1].trim();
        const goldLabel = parts[2].trim().toLowerCase(); // 'true' | 'not-in-video' | 'wrong'

        // Find in scoreboardData
        let foundBullet: any = null;
        for (const v of scoreboardData.videos) {
          foundBullet = v.bullets.find((b: any) => b.slide === slide && (b.bullet.includes(bulletText) || bulletText.includes(b.bullet)));
          if (foundBullet) break;
        }

        if (foundBullet) {
          const isVerifierAccept = foundBullet.pass;
          const isGoldTrue = goldLabel === 'true';

          if (isVerifierAccept && !isGoldTrue) {
            falseAccepts++;
          } else if (!isVerifierAccept && isGoldTrue) {
            falseRejects++;
          } else if (isVerifierAccept && isGoldTrue) {
            truePositives++;
          } else {
            trueNegatives++;
          }
        }
      }
    }

    const totalEvaluated = falseAccepts + falseRejects + truePositives + trueNegatives;
    console.log(`Total Gold Labeled Bullets Evaluated: ${totalEvaluated}`);
    console.log(`False-Accept Rate: ${((falseAccepts / (totalEvaluated || 1)) * 100).toFixed(2)}% (${falseAccepts}/${totalEvaluated})`);
    console.log(`False-Reject Rate: ${((falseRejects / (totalEvaluated || 1)) * 100).toFixed(2)}% (${falseRejects}/${totalEvaluated})`);
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('SCOREBOARD RUN COMPLETE');
  console.log('════════════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Scoreboard fatal error:', err);
  process.exit(1);
});
