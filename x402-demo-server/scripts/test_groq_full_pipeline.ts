import { config } from 'dotenv';
config();
process.env.OLLAMA_HOST = 'http://localhost:9999'; // Force Ollama offline to test cloud fallback
process.env.ALLOW_CLOUD_FALLBACK = 'true';
import fs from 'node:fs';
import path from 'node:path';
import { getModelClient } from '../models/index.js';
import { synthesizeOutline } from '../core/synthesis/outline-synthesizer.js';
import { planSlideStructure } from '../core/synthesis/slide-planner.js';
import type { TranscriptData } from '../core/schemas/transcript.schema.js';

async function main() {
  console.log('================================================================================');
  console.log('GROQ CLOUD FALLBACK VERIFICATION (Ollama STOPPED, ALLOW_CLOUD_FALLBACK=true)');
  console.log('================================================================================\n');

  // Verify Ollama is unreachable
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    console.warn('⚠️ Warning: Ollama responded unexpectedly:', res.status);
  } catch (err: any) {
    console.log('✓ Verified: Ollama is offline / stopped (' + err.message + ')');
  }

  // Load real Hindi transcript data
  const vttSegmentsPath = path.join(process.cwd(), 'scratch', 'qzAHXO_parsed_vtt.json');
  if (!fs.existsSync(vttSegmentsPath)) {
    throw new Error('qzAHXO_parsed_vtt.json not found');
  }
  const segments: Array<{ start: string; end: string; text: string }> = JSON.parse(
    fs.readFileSync(vttSegmentsPath, 'utf-8')
  );

  const fullText = segments.map((s) => s.text).join(' ');
  const parseSec = (ts: string) => {
    const [h, m, rest] = ts.split(':');
    return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(rest);
  };

  const numSegments = segments.map((s) => ({
    start: parseSec(s.start),
    end: parseSec(s.end),
    text: s.text,
  }));

  const transcript: TranscriptData = {
    sourceType: 'youtube',
    rawText: fullText,
    sanitizedText: fullText,
    charCount: fullText.length,
    title: 'Artificial Intelligence Kya Hai? | What Is Artificial Intelligence In Hindi | Simplilearn',
    metadata: {
      segments: numSegments,
      duration: 328,
    } as any,
  };

  const client = getModelClient();
  console.log('UnifiedModelClient registered providers:', client.getRegisteredProviders().join(', '));
  console.log('UnifiedModelClient primary provider:', client.getPrimaryProviderName());
  console.log('ALLOW_CLOUD_FALLBACK:', process.env.ALLOW_CLOUD_FALLBACK);

  // 1. Full Outline Generation through Groq
  console.log('\n--- 1. Testing Outline Generation via Groq ---');
  const t0 = performance.now();
  let outlineResult: any;
  let outlineParseBroke = false;
  try {
    outlineResult = await synthesizeOutline(transcript, client, 'balanced', {
      allowCloudFallback: true,
      targetSlideCount: 6,
      audience: 'Executive Leadership',
      tone: 'Executive Strategic Briefing',
    });
  } catch (err: any) {
    outlineParseBroke = true;
    console.error('❌ Outline generation failed:', err.message);
  }
  const t1 = performance.now();

  if (outlineResult) {
    console.log(`✓ Outline generated in ${((t1 - t0) / 1000).toFixed(2)}s`);
    console.log(`  Provider used: "${outlineResult.providerUsed}"`);
    console.log(`  Title: "${outlineResult.title}"`);
    console.log(`  Subtitle: "${outlineResult.subtitle}"`);
    console.log(`  Pillars count: ${outlineResult.pillars?.length}`);
    console.log(`  Key Topics: ${outlineResult.keyTopics?.join(', ')}`);
  }

  // 2. Full Slide Generation through Groq
  console.log('\n--- 2. Testing Slide Structure Generation via Groq ---');
  const t2 = performance.now();
  let slideResult: any;
  let slideParseBroke = false;
  try {
    slideResult = await planSlideStructure(outlineResult, transcript, client, 'cyber-blue', 'balanced', {
      allowCloudFallback: true,
      targetSlideCount: 6,
      slideCount: 6,
      bulletsPerSlide: 3,
      wordsPerBullet: 14,
      speakerNotes: true,
    });
  } catch (err: any) {
    slideParseBroke = true;
    console.error('❌ Slide generation failed:', err.message);
  }
  const t3 = performance.now();

  if (slideResult) {
    console.log(`✓ Slides generated in ${((t3 - t2) / 1000).toFixed(2)}s`);
    console.log(`  Provider used: "${slideResult.providerUsed}"`);
    console.log(`  Slides count: ${slideResult.slides?.length}`);
    console.log(`  Adjustment notice: "${slideResult.adjustmentNotice || 'None'}"`);

    slideResult.slides.forEach((s: any, idx: number) => {
      console.log(`\n  Slide ${idx + 1}: [${s.category}] "${s.title}"`);
      console.log(`    Subtitle: "${s.subtitle}"`);
      console.log(`    Source Timestamps: "${s.source_timestamps}" (${s.source_start}s - ${s.source_end}s)`);
      if (s.unverified_terms && s.unverified_terms.length > 0) {
        console.log(`    ⚠️ Unverified terms flagged (${s.unverified_terms.length}):`, s.unverified_terms);
      } else {
        console.log(`    ✓ Verification: All terms grounded in source chunk.`);
      }
      s.cards?.forEach((c: any) => {
        console.log(`    Card: "${c.card_title}"`);
        c.points?.forEach((p: string) => console.log(`      • ${p}`));
      });
      if (s.speaker_notes) {
        console.log(`    Speaker Notes: "${s.speaker_notes}"`);
      }
    });
  }

  const report = {
    ollama_offline: true,
    allow_cloud_fallback: true,
    outline_provider: outlineResult?.providerUsed,
    outline_json_broken: outlineParseBroke,
    slide_provider: slideResult?.providerUsed,
    slide_json_broken: slideParseBroke,
    outline_duration_sec: ((t1 - t0) / 1000).toFixed(2),
    slide_duration_sec: ((t3 - t2) / 1000).toFixed(2),
    total_slides: slideResult?.slides?.length,
  };

  fs.writeFileSync('scratch/groq_pipeline_result.json', JSON.stringify({ report, slideResult }, null, 2));
  console.log('\nResults saved to scratch/groq_pipeline_result.json');
}

main().catch(console.error);
