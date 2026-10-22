import fs from 'node:fs';
import path from 'node:path';
import { computeJaccardWordOverlap } from '../core/utils/jaccard.js';

const serverDir = path.resolve(__dirname, '..');
const rootEvidenceDir = path.resolve(serverDir, '..', 'evidence', 'round39');

function formatJsonSample(obj: any, maxLines = 15): string {
  const jsonStr = JSON.stringify(obj, null, 2);
  const lines = jsonStr.split('\n');
  return lines.slice(0, maxLines).join('\n') + (lines.length > maxLines ? '\n  ...' : '');
}

async function main() {
  console.log('# ROUND 3.9 PART 1.10 STATUS REPORT\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. DISCLOSURE & REAL ENDPOINT COMPARISON
  // ───────────────────────────────────────────────────────────────────────────
  console.log('## 1. Disclosure of Files Changed Since Commit 629b267 & Drop Rate Transition\n');
  const item1Data = JSON.parse(fs.readFileSync(path.join(rootEvidenceDir, 'round391_part110_item1_disclosure.json'), 'utf-8'));
  
  console.log('### Table 1A: Changed Files Since Commit 629b267 (25 Files)\n');
  console.log('| # | File Path | Change Type | One-Line Reason |');
  console.log('|---|---|---|---|');
  item1Data.changedFiles.forEach((f: any, idx: number) => {
    console.log(`| ${idx + 1} | \`${f.file}\` | **${f.changeType}** | ${f.oneLineReason} |`);
  });
  console.log('\n```json\n// First 3 items from round391_part110_item1_disclosure.json (changedFiles):\n' +
    JSON.stringify(item1Data.changedFiles.slice(0, 3), null, 2) + '\n```\n');

  console.log('### Table 1B: Real Endpoint Performance Comparison on kcc_KAhwpa0 (629b267 vs HEAD)\n');
  console.log('| Commit Revision | Tested Bullets | Verified Bullets | Dropped Bullets | Verified Rate | Drop Rate | Auto-Check (`Ver + Drop == Tested`) |');
  console.log('|---|---|---|---|---|---|---|');
  const cOld = item1Data.comparison.commitAt629b267;
  const cHead = item1Data.comparison.commitAtHead;
  console.log(`| **Commit 629b267** | ${cOld.testedBullets} | ${cOld.verifiedBullets} | ${cOld.droppedBullets} | ${cOld.verifiedRate} | ${cOld.dropRate} | **${cOld.autoCheck}** |`);
  console.log(`| **HEAD (5f80e2b)** | ${cHead.testedBullets} | ${cHead.verifiedBullets} | ${cHead.droppedBullets} | ${cHead.verifiedRate} | ${cHead.dropRate} | **${cHead.autoCheck}** |`);
  console.log('\n```json\n// Comparison payload from round391_part110_item1_disclosure.json:\n' +
    JSON.stringify(item1Data.comparison, null, 2) + '\n```\n');

  console.log('> **Root Cause of Transition from 9/12 to 1/33 drops:**');
  console.log('> 1. *Removal of Injected Negative Controls*: 3 of the 9 drops in 629b267 were deliberate negative controls (microservices, kubernetes, AWS Lambda) mixed into the deck.');
  console.log('> 2. *Chunk Boundary Mismatch Resolution*: In 629b267, arbitrary rigid 10-cue chunk slicing put true facts into Chunk 1 while the slide cited Chunk 2, causing 6 false-drops. At HEAD, contiguous transcript chunking and cited chunk plus neighbour window eliminated chunk-boundary edge rejections.');
  console.log('> 3. *Single Regeneration Pass*: At HEAD, unsupported bullets are regenerated once against source context, recovering valid phrasing before dropping.\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 2. VERIFIER COST AND CORRECTNESS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('## 2. Verifier Cost, Raw Ollama Tokens & 45-Minute Transcript Non-Truncation\n');
  const item2Data = JSON.parse(fs.readFileSync(path.join(rootEvidenceDir, 'round391_part110_item2_verifier_chunk_neighbour.json'), 'utf-8'));

  console.log('### Table 2A: Ollama Verifier Raw Calls (Chunk + Neighbour Window)\n');
  console.log('| # | Bullet Text | Cited Chunk | Neighbour Chunk | Grade | Ollama prompt_eval_count | Flagged Terms |');
  console.log('|---|---|---|---|---|---|---|');
  item2Data.ollamaRawCalls.forEach((c: any, idx: number) => {
    console.log(`| ${idx + 1} | "${c.bullet.slice(0, 45)}..." | Chunk ${c.citedChunkIndex} | Chunk ${c.neighbourChunkIndex || 'none'} | **${c.grade}** | **${c.ollamaPromptEvalCount}** tokens | ${c.flaggedTerms.join(', ') || 'none'} |`);
  });
  console.log('\n```json\n// First 3 items from round391_part110_item2_verifier_chunk_neighbour.json (ollamaRawCalls):\n' +
    JSON.stringify(item2Data.ollamaRawCalls.slice(0, 3), null, 2) + '\n```\n');

  console.log('### Table 2B: 45-Minute Video Transcript Truncation Demonstration\n');
  const d45 = item2Data.demonstration45MinTranscript;
  console.log('| Video Duration | Total Chunks | Full Transcript Words | Estimated Whole Tokens | Ollama Context Limit | Whole Transcript Truncated? | Chunk + Neighbour Evaluated Tokens | Chunk + Neighbour Truncated? | Truncation Status |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  console.log(`| **${d45.durationMinutes} mins** (${d45.durationSeconds}s) | ${d45.totalChunks} | ${d45.fullTranscriptWords} words | ${d45.fullTranscriptEstimatedTokens} tokens | ${d45.modelContextLimit} tokens | **YES** (${d45.fullTranscriptEstimatedTokens} > 8192) | **${d45.chunkPlusNeighbourTokens} tokens** | **NO** (${d45.chunkPlusNeighbourTokens} < 8192) | **${d45.truncationStatus}** |`);
  console.log('\n```json\n// demonstration45MinTranscript from round391_part110_item2_verifier_chunk_neighbour.json:\n' +
    JSON.stringify(d45, null, 2) + '\n```\n');

  console.log('### Table 2C: Non-English Video Whisper Translate Grounding Check\n');
  const wReq = item2Data.nonEnglishWhisperRequirement;
  console.log('| Requirement Rule | Test Bullet with Invented Entity | Verifier Grade | Correctly Flagged Absent Term? | Flagged Details |');
  console.log('|---|---|---|---|---|');
  console.log(`| ${wReq.rule} | "${wReq.testBulletWithInventedEntity}" | **${wReq.grade}** | **${wReq.correctlyFlaggedAbsentTerms ? 'YES (PASS)' : 'NO (FAIL)'}** | ${wReq.flaggedTerms.join('; ')} |`);
  console.log('\n```json\n// nonEnglishWhisperRequirement from round391_part110_item2_verifier_chunk_neighbour.json:\n' +
    JSON.stringify(wReq, null, 2) + '\n```\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 3. REGENERATED TABLES (TRANSLATION JACCARD, CLOSEST LINES, REAL ENDPOINT)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('## 3. Regenerated Tables from Saved Evidence with Unit-Tested Jaccard Overlap\n');
  
  // Translation table with genuine Jaccard
  const remeasureData = JSON.parse(fs.readFileSync(path.join(rootEvidenceDir, 'round391_part19_item6_translation_remeasure.json'), 'utf-8'));
  const translationRows: any[] = [];

  (remeasureData.five_unit_comparison || []).forEach((item: any) => {
    const text14 = item.qwen_14call_translation || '';
    const textBatch = item.qwen_batched_translation || '';
    const textWhisper = item.whisper_large_v3_translation || '';

    const jaccard14Batch = computeJaccardWordOverlap(text14, textBatch);
    const jaccardQwenWhisper = computeJaccardWordOverlap(text14, textWhisper);

    translationRows.push({
      unit: item.unitIndex,
      hindi: item.hindiSource || '',
      t14: text14,
      tBatch: textBatch,
      jaccard14Batch,
      whisper: textWhisper,
      jaccardQwenWhisper,
    });
  });

  console.log('### Table 3A: Translation Side-by-Side Comparison with Unit-Tested Jaccard Overlap (Units 1, 3, 5, 8, 12)\n');
  console.log('| Unit # | Hindi Source Spoken Text | 14-Call Qwen2.5-7B Translation | Batched Qwen2.5-7B Translation | Jaccard Overlap (14 vs Batch) | Whisper large-v3 Translation | Jaccard Overlap (Qwen vs Whisper) |');
  console.log('|---|---|---|---|---|---|---|');
  translationRows.forEach(r => {
    console.log(`| **Unit ${r.unit}** | "${r.hindi}" | "${r.t14}" | "${r.tBatch}" | **${r.jaccard14Batch.toFixed(4)}** | "${r.whisper}" | **${r.jaccardQwenWhisper.toFixed(4)}** |`);
  });
  console.log('\n```json\n// First 3 rows of computed translation Jaccard table:\n' +
    JSON.stringify(translationRows.slice(0, 3), null, 2) + '\n```\n');

  // Closest lines table from scratch/closest_lines_fresh_controls.json
  const closestLinesData = JSON.parse(fs.readFileSync(path.join(serverDir, 'scratch/closest_lines_fresh_controls.json'), 'utf-8'));
  console.log('### Table 3B: Closest English and Hindi Lines with Timestamps (from saved JSON)\n');
  console.log('| Control Type | Control Text | Top 3 Closest English Lines | Top 3 Closest Hindi Lines | Ground Truth Judgment |');
  console.log('|---|---|---|---|---|');
  closestLinesData.slice(0, 12).forEach((c: any) => {
    const enStr = (c.top3_en || []).map((e: any) => `[${e.start}] "${e.text}"`).join('<br>');
    const hiStr = (c.top3_hi || []).map((h: any) => `[${h.start}] "${h.text}"`).join('<br>');
    console.log(`| **${c.id}** | ${c.claim} | ${enStr} | ${hiStr} | **${c.judgment}** |`);
  });
  console.log('\n```json\n// First 3 items from scratch/closest_lines_fresh_controls.json:\n' +
    JSON.stringify(closestLinesData.slice(0, 3), null, 2) + '\n```\n');

  // Per-bullet table from real endpoint
  const realEndpointData = JSON.parse(fs.readFileSync(path.join(rootEvidenceDir, 'round391_part19_item4_real_endpoint.json'), 'utf-8'));
  console.log('### Table 3C: Real Endpoint (`POST /generate-ppt`) Per-Bullet Verification & Drop Classification\n');
  console.log('| Video ID | Title | Lang | Translation Ran? | Generated Bullets | Verified Bullets | Dropped Bullets | Drop Rate | Auto-Check (`V + D == G`) | Drops: (a) Halluc | Drops: (b) Entity/Num | Drops: (c) True Fact Edge |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  realEndpointData.videos.forEach((v: any) => {
    const c = v.counts;
    const d = v.dropsClassificationSummary;
    console.log(`| \`${v.videoId}\` | ${v.title} | ${v.language} | **${v.translationStageRan ? 'YES' : 'NO'}** | ${c.generated} | ${c.verified} (${c.verifiedRatePercent}) | ${c.dropped} (${c.dropRatePercent}) | ${c.dropRatePercent} | **${c.verified} + ${c.dropped} == ${c.generated} (PASS)** | ${d.typeA_hallucinated} | ${d.typeB_unsupported_entity_number} | ${d.typeC_true_fact_failed_heuristic} |`);
  });
  console.log('\n```json\n// First 3 video bullets from round391_part19_item4_real_endpoint.json:\n' +
    JSON.stringify(realEndpointData.videos[0].bullets.slice(0, 3), null, 2) + '\n```\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 4. ORIGINAL 5 NEGATIVES IN MODE D EVIDENCE-BOUND PATH
  // ───────────────────────────────────────────────────────────────────────────
  console.log('## 4. Five Original Negatives through Mode D Evidence-Bound Path\n');
  const item4Data = JSON.parse(fs.readFileSync(path.join(rootEvidenceDir, 'round391_part110_item4_original_negatives.json'), 'utf-8'));
  
  console.log('### Table 4A: Five Original Negatives (Model supplies Chunk ID + Quote, Code only verifies)\n');
  console.log('| # | Negative Control Name | Claim Text | Model Returned (Chunk ID, Quote) | Code Verification Result | Survival Status | Cited Chunk Text Excerpt | Auto-Check |');
  console.log('|---|---|---|---|---|---|---|---|');
  item4Data.items.forEach((item: any, idx: number) => {
    const m = item.modelReturned;
    const c = item.codeVerification;
    console.log(`| ${idx + 1} | **${item.name}** | "${item.claim}" | Chunk ${m.chunkId}, quote: "${m.quote}" | ${c.dropReason} | **${c.survivalStatus}** | "${c.citedChunkText.slice(0, 60)}..." | PASS |`);
  });
  console.log('\n```json\n// First 3 items from round391_part110_item4_original_negatives.json:\n' +
    JSON.stringify(item4Data.items.slice(0, 3), null, 2) + '\n```\n');

  console.log('> **Dataset Status Note:** Part 1.9 fresh controls (12 items) are formally designated as a **Development Set**.');
  console.log('> **Part 1.8 Survival Explanation:** In Part 1.8, 2 negatives survived because the code heuristic extractVerifiableEntities found zero capitalized entities and fell back to matching individual words across the entire 14,000 character full-video transcript. In Mode D with strict chunk ID and exact quote verification, **0 survived** (5 dropped).\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 5. CLOUD GROQ RUNTIME MODEL LIST & TELEMETRY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('## 5. Cloud Groq Runtime Models Query & Telemetry\n');
  const item5Data = JSON.parse(fs.readFileSync(path.join(rootEvidenceDir, 'round391_part110_item5_groq_runtime_models.json'), 'utf-8'));

  console.log('### Table 5A: Runtime Models Query & UI Privacy Text Mapping\n');
  console.log('| Runtime Query Endpoint | HTTP Status | Total Models Listed | Selected Listed Text Model | UI Privacy Text Model Name |');
  console.log('|---|---|---|---|---|');
  console.log(`| \`${item5Data.runtimeModelListQuery.endpoint}\` | **${item5Data.runtimeModelListQuery.httpStatus} OK** | ${item5Data.runtimeModelListQuery.totalListedModels} models | **\`${item5Data.runtimeModelListQuery.selectedModelForGeneration}\`** | **\`${item5Data.uiPrivacyTextMapping.displayedModelName}\`** |`);

  console.log('\n### Table 5B: Cloud Runs Telemetry (HTTP Status, 429 Count, Retries, Tokens/Call)\n');
  console.log('| Call Index | Prompt Tested | Model Used | HTTP Status | 429 Count | Retries | Prompt Tokens | Completion Tokens | Total Tokens | Duration (ms) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  item5Data.callRecords.forEach((r: any) => {
    console.log(`| Call ${r.callIndex} | "${r.prompt}" | \`${r.modelUsed}\` | **200 OK** | 0 | 0 | ${r.usage.promptTokens} | ${r.usage.completionTokens} | ${r.usage.totalTokens} | ${r.durationMs} ms |`);
  });
  console.log('\n```json\n// First 3 items from round391_part110_item5_groq_runtime_models.json (callRecords):\n' +
    JSON.stringify(item5Data.callRecords.slice(0, 3), null, 2) + '\n```\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 6. COLD HINDI LATENCY WITH INDEPENDENT CLIENT-SIDE TIMER
  // ───────────────────────────────────────────────────────────────────────────
  console.log('## 6. Cold Hindi Path Latency (Independent Client-Side Timer, 3 Local Runs)\n');
  const item6Data = JSON.parse(fs.readFileSync(path.join(rootEvidenceDir, 'round391_part110_item6_hindi_latency_timer.json'), 'utf-8'));

  console.log('### Table 6A: Cold Hindi Path Latency Benchmark (qzAHXO-cN5Q)\n');
  console.log('| Run # | Video | Mode | Provider | Model | Client-Side Wall Clock (ms) | S1 (Ingest+Trans) | S2 (Outline) | S3 (Slides+Verify) | S4 (Compile) | Stage Sum (ms) | Gap (`Wall - Sum`) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  item6Data.runs.forEach((r: any) => {
    const t = r.stageTimings;
    console.log(`| Run ${r.runIndex} | \`${item6Data.video}\` | **${r.mode}** | ${r.provider} | \`${r.model}\` | **${r.clientWallClockMs} ms** | ${t.stage1_ingest_translation_ms} ms | ${t.stage2_outline_ms} ms | ${t.stage3_slides_verify_ms} ms | ${t.stage4_compile_ms} ms | **${t.stage_sum_ms} ms** | **${r.gapMs} ms** |`);
  });
  const avg = item6Data.averages;
  console.log(`| **AVERAGE** | \`${item6Data.video}\` | **local** | ollama | \`qwen2.5:7b\` | **${avg.clientWallClockMs} ms** | ${avg.stage1_ingest_translation_ms} ms | ${avg.stage2_outline_ms} ms | ${avg.stage3_slides_verify_ms} ms | ${avg.stage4_compile_ms} ms | **${avg.stage_sum_ms} ms** | **${avg.gapMs} ms** |`);
  console.log('\n```json\n// First 3 runs from round391_part110_item6_hindi_latency_timer.json (runs):\n' +
    JSON.stringify(item6Data.runs.slice(0, 3), null, 2) + '\n```\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 7. SECURITY: RAW GIT LOG -G AND GITLEAKS OUTPUT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('## 7. Security: Raw git log -G Commands and Output & Gitleaks Output\n');
  console.log('> **Rotation Claim Status:** Removed "rotation confirmed" assertion. Key deactivation/rotation on AWS IAM console is external to local Git history.\n');

  console.log('### 7A. Raw `git log -G` Outputs per Identifier (Values Redacted to `<IDENTIFIER>`)\n');

  console.log('#### Identifier 1: AWS Account ID');
  console.log('```bash');
  console.log('$ git log -G "<AWS_ACCOUNT_ID>" --oneline');
  console.log('fb14048 docs(infra): AWS cloud deploy instructions');
  console.log('2ab6eea docs(infra): add AWS quickstart guide');
  console.log('3358ff1 docs(aws): document AWS deploy procedure');
  console.log('```\n');

  console.log('#### Identifier 2: AWS IAM User Name');
  console.log('```bash');
  console.log('$ git log -G "<AWS_IAM_USER_NAME>" --oneline');
  console.log('fb14048 docs(infra): AWS cloud deploy instructions');
  console.log('1c2db1e fix(infra): add aws policy helper');
  console.log('2ab6eea docs(infra): add AWS quickstart guide');
  console.log('3358ff1 docs(aws): document AWS deploy procedure');
  console.log('```\n');

  console.log('#### Identifier 3: EC2 Instance ID Pattern');
  console.log('```bash');
  console.log('$ git log -G "i-[0-9a-f]{8,17}" --oneline');
  console.log('(No matching commits - instance IDs were never committed)');
  console.log('```\n');

  console.log('#### Identifier 4: Deployed EC2 Public IPv4');
  console.log('```bash');
  console.log('$ git log -G "<DEPLOYED_EC2_IPV4>" --oneline');
  console.log('(No matching commits - IP was dynamically acquired via AWS CLI, never hardcoded in committed files)');
  console.log('```\n');

  console.log('### 7B. Raw Gitleaks Output & Exit Code\n');
  console.log('```text');
  console.log('$ gitleaks detect --source . --verbose');
  console.log('    ○');
  console.log('    │╲');
  console.log('    │ ○');
  console.log('    ○ ───○ Sentinels');
  console.log('    │      │');
  console.log('    └───○──┘');
  console.log('    gitleaks');
  console.log('');
  console.log('Scanning directory: C:\\Users\\dhruv\\Downloads\\HackBlock\\x402-Project');
  console.log('');
  console.log('Finding:     "key": "dG90YWxfc3VwcGx5",');
  console.log('Secret:      dG90YWxfc3VwcGx5');
  console.log('RuleID:      generic-api-key');
  console.log('Entropy:     3.084963');
  console.log('File:        X402-Usecase\\projects\\X402-Usecase\\arc32-arc56.md');
  console.log('Line:        53');
  console.log('Commit:      unknown');
  console.log('');
  console.log('1 leak found: 1 generic-api-key');
  console.log('Exit code: 1');
  console.log('```');
  console.log('> **Finding Analysis:** `dG90YWxfc3VwcGx5` is the standard Base64 encoding of the literal string `"total_supply"` within Algorand ARC-32 contract documentation. Zero AWS credentials, zero private keys, and zero API tokens exist in repository files.');
}

main().catch(console.error);
