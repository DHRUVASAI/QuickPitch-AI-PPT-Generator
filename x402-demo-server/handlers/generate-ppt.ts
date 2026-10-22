import type { Context } from 'hono';
import { getModelClient } from '../models/index.js';
import {
  extractTranscript,
  extractYouTubeVideoId,
  synthesizeOutline,
  planSlideStructure,
  compilePptx,
  validateSlideDeck,
} from '../core/index.js';

export interface JobProgress {
  stage: 'ingest' | 'transcribe' | 'translate' | 'synthesize' | 'compile' | 'complete' | 'error';
  percent: number;
  message: string;
  timestamp: number;
}

export const jobStages = new Map<string, JobProgress>();

export const lastJobAudit = new Map<string, any>();

export function setJobStage(jobId: string | undefined, stage: JobProgress['stage'], percent: number, message: string) {
  if (!jobId) return;
  jobStages.set(jobId, { stage, percent, message, timestamp: Date.now() });
}

export async function handleGeneratePpt(c: Context) {
  try {
    console.log('\n[QuickPitch] Presentation generation requested...');

    let body = c.get('parsedBody');
    if (!body || typeof body !== 'object') {
      try {
        body = await c.req.json();
      } catch {
        try {
          const rawText = c.get('rawBodyText') || (await c.req.text());
          body = rawText ? JSON.parse(rawText) : {};
        } catch {
          body = {};
        }
      }
    }

    const {
      source_type = 'text',
      url,
      text,
      theme,
      detail_level = 'balanced',
      allow_cloud_fallback,
      slide_count,
      target_slide_count,
      bullets_per_slide,
      words_per_bullet,
      audience,
      tone,
      speaker_notes,
      include_speaker_notes,
      agenda,
      include_agenda,
      summary,
      include_summary,
      focus_text,
      start_time,
      end_time,
      do_not_cache = false,
      spoken_language,
      user_confirmed_spoken_language = false,
      user_confirmed_language = false,
      force_audio = false,
      accuracy_mode,
      job_id,
      llm_provider_preference = 'local',
    } = body;

    const validatedPref: 'local' | 'cloud' = llm_provider_preference === 'cloud' ? 'cloud' : 'local';

    const jobId = job_id || c.req.query('job_id') || `job_${Date.now()}`;
    setJobStage(jobId, 'ingest', 15, 'Ingesting source & verifying duration limits...');

    // Server-side validation for User Options (Round 3 Item 1)
    const finalSlideCount = parseInt(String(slide_count || target_slide_count || 6), 10);
    if (isNaN(finalSlideCount) || finalSlideCount < 3 || finalSlideCount > 30) {
      return c.json({
        status: 'validation_error',
        error: 'Invalid slide count',
        message: 'Slide count must be an integer between 3 and 30 slides.',
      }, 400);
    }

    let finalBulletsPerSlide: number | undefined = undefined;
    if (bullets_per_slide !== undefined && bullets_per_slide !== null && bullets_per_slide !== '') {
      finalBulletsPerSlide = parseInt(String(bullets_per_slide), 10);
      if (isNaN(finalBulletsPerSlide) || finalBulletsPerSlide < 1 || finalBulletsPerSlide > 8) {
        return c.json({
          status: 'validation_error',
          error: 'Invalid bullets per slide',
          message: 'Bullets per slide must be an integer between 1 and 8.',
        }, 400);
      }
    }

    let finalWordsPerBullet: number | undefined = undefined;
    if (words_per_bullet !== undefined && words_per_bullet !== null && words_per_bullet !== '') {
      finalWordsPerBullet = parseInt(String(words_per_bullet), 10);
      if (isNaN(finalWordsPerBullet) || finalWordsPerBullet < 3 || finalWordsPerBullet > 35) {
        return c.json({
          status: 'validation_error',
          error: 'Invalid words per bullet',
          message: 'Words per bullet must be an integer between 3 and 35.',
        }, 400);
      }
    }

    // Time slicing helper
    function parseTimeSeconds(val: any): number | null {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'number') return val;
      const str = String(val).trim();
      if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);
      const parts = str.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] * 60 + parts[1];
      }
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      return null;
    }

    const startSec = parseTimeSeconds(start_time);
    const endSec = parseTimeSeconds(end_time);
    if (startSec !== null && endSec !== null && startSec >= endSec) {
      return c.json({
        status: 'validation_error',
        error: 'Invalid time range',
        message: 'Start time must be strictly before end time.',
      }, 400);
    }

    // Round 3 Item 1: Output is strictly English-only
    const outputLanguage = 'en';
    const output_language = 'en';

    const allowCloudFallback = allow_cloud_fallback === true || process.env.ALLOW_CLOUD_FALLBACK === 'true';
    const modelClient = getModelClient();
    let isPartial = false;
    let partialNotice = '';

    const pipelineStartTime = Date.now();
    let s1Dur = 0, s2Dur = 0, s3Dur = 0, s4Dur = 0;

    // Stage 1: Transcript Ingestion & Sanitization
    console.log(`[QuickPitch Stage 1] Ingesting source (type: ${source_type}, cloudFallback: ${allowCloudFallback}, outputLang: ${output_language}, spokenLang: ${spoken_language || 'auto'})...`);
    const t1Start = Date.now();
    if (source_type === 'audio' || (source_type === 'youtube' && force_audio)) {
      setJobStage(jobId, 'transcribe', 35, 'Transcribing audio with Batched GPU Whisper...');
    }
    let transcriptData;
    try {
      transcriptData = await extractTranscript({
        sourceType: source_type,
        url,
        text,
        topicHint: text ? text.slice(0, 60) : undefined,
      }, {
        allowCloudFallback,
        outputLanguage,
        spokenLanguage: spoken_language,
        forceAudio: force_audio,
        accuracyMode: accuracy_mode,
        doNotCache: do_not_cache === true,
      });
      if (transcriptData.metadata?.partial) {
        isPartial = true;
        partialNotice = 'Transcript used partial video metadata';
      }
    } catch (err: any) {
      if (err.message?.includes('[WrongVideoGuard]')) {
        throw err;
      }
      console.warn('⚠️ [QuickPitch Stage 1] Transcript extraction encountered error, using safe partial fallback:', err.message);
      isPartial = true;
      partialNotice = `Transcript extraction error: ${err.message}`;
      transcriptData = {
        sourceType: source_type as any,
        title: url || 'Presentation Subject',
        rawText: `[Partial Source]: ${text || url || 'Executive Analysis'}`,
        sanitizedText: text || url || 'Executive Analysis and Insights',
        charCount: (text || url || '').length,
        metadata: { partial: true },
      };
    }

    // Requirement 2: Wrong-video guard in the pipeline (not just a test)
    // After extraction, compare the transcript's video id and yt-dlp title with the request and fail loudly if they differ.
    if (source_type === 'youtube' && url) {
      const requestedId = extractYouTubeVideoId(url);
      const extractedId = (transcriptData.metadata as any)?.videoId || extractYouTubeVideoId((transcriptData.metadata as any)?.url || url);
      if (requestedId && extractedId && requestedId !== extractedId) {
        throw new Error(`[WrongVideoGuard] FAILED: Video ID mismatch! Requested "${requestedId}" but transcript belongs to "${extractedId}".`);
      }
      const ytdlpTitle = (transcriptData.metadata as any)?.ytdlpTitle || transcriptData.title;
      const expectedVideoId = (body as any).expected_video_id || (body as any).expectedVideoId;
      const expectedTitle = (body as any).expected_title || (body as any).expectedTitle;
      if (expectedVideoId && extractedId && expectedVideoId !== extractedId) {
        throw new Error(`[WrongVideoGuard] FAILED: Expected video ID "${expectedVideoId}" does not match extracted "${extractedId}".`);
      }
      if (expectedTitle && ytdlpTitle && !ytdlpTitle.toLowerCase().includes(String(expectedTitle).toLowerCase())) {
        throw new Error(`[WrongVideoGuard] FAILED: Expected title "${expectedTitle}" does not match yt-dlp title "${ytdlpTitle}".`);
      }
      console.log(`✓ [WrongVideoGuard] Video guard verified: ID "${extractedId}" matches requested "${requestedId}". yt-dlp title: "${ytdlpTitle}"`);
    }

    // Time slicing on transcript text if startSec or endSec specified
    if ((startSec !== null || endSec !== null) && transcriptData.sanitizedText) {
      const s = startSec ?? 0;
      const e = endSec ?? Infinity;
      console.log(`[QuickPitch Stage 1] Time window filtering active (${s}s to ${e === Infinity ? 'end' : e + 's'})...`);
      // If segment timestamps are present in metadata
      const metaAny = transcriptData.metadata as any;
      if (Array.isArray(metaAny?.segments) && metaAny.segments.length > 0) {
        const filtered = metaAny.segments.filter((seg: any) => seg.start >= s && seg.end <= e);
        if (filtered.length > 0) {
          transcriptData.sanitizedText = filtered.map((seg: any) => seg.text).join(' ');
          transcriptData.charCount = transcriptData.sanitizedText.length;
        }
      }
    }

    console.log(`✓ Transcript ready: "${transcriptData.title}" (${transcriptData.charCount} chars, detectedLang: ${transcriptData.metadata?.detectedLanguage || 'unknown'})`);
    s1Dur = Date.now() - t1Start;

    const detectedLang = transcriptData.metadata?.detectedLanguage || transcriptData.metadata?.language || 'unknown';
    const langConfidence = transcriptData.metadata?.languageConfidence ?? 1.0;
    const isLowConfidence = Boolean(
      transcriptData.metadata?.lowLanguageConfidence ||
      (transcriptData.metadata?.languageConfidence !== undefined && transcriptData.metadata.languageConfidence < 0.60)
    );

    // Spoken-language picker prompt if confidence is low
    const isSpokenConfirmed = user_confirmed_spoken_language || user_confirmed_language || Boolean(spoken_language);
    if (isLowConfidence && !isSpokenConfirmed) {
      console.log(`⚠️ [QuickPitch Stage 1] Low spoken language confidence (${Math.round(langConfidence * 100)}% for "${detectedLang}"). Prompting UI for SPOKEN language.`);
      return c.json({
        status: 'needs_spoken_language_selection',
        low_language_confidence: true,
        detected_language: detectedLang,
        language_confidence: langConfidence,
        title: transcriptData.title,
        output_language,
        message: `Low language confidence detected (${Math.round(langConfidence * 100)}% for "${detectedLang}"). Please select the SPOKEN language of the video so Whisper can transcribe accurately.`,
      }, 422, {
        'X-QuickPitch-Low-Language-Confidence': 'true',
        'X-QuickPitch-Detected-Language': detectedLang,
      });
    }

    // Stage 2: Synthesis & Outline Planning (with schema validation & chunking)
    console.log(`[QuickPitch Stage 2] Synthesizing outline (Target slides: ${finalSlideCount}, outputLanguage: "en")...`);
    setJobStage(jobId, 'synthesize', 75, 'Structuring executive slides & source-language verification...');
    const t2Start = Date.now();
    const outline = await synthesizeOutline(transcriptData, modelClient, detail_level, {
      allowCloudFallback: allowCloudFallback || validatedPref === 'cloud',
      llm_provider_preference: validatedPref,
      outputLanguage: 'en',
      targetSlideCount: finalSlideCount,
      audience: audience ? String(audience).trim() : undefined,
      tone: tone ? String(tone).trim() : undefined,
      focusText: focus_text ? String(focus_text).trim() : undefined,
    });
    if (outline.rawSynthesis?.includes('Partial Result')) {
      isPartial = true;
      partialNotice = 'Model synthesis used deterministic fallback';
    }
    s2Dur = Date.now() - t2Start;

    const t3Start = Date.now();
    const slideDeck = await planSlideStructure(
      outline,
      transcriptData,
      modelClient,
      theme,
      detail_level,
      {
        allowCloudFallback: allowCloudFallback || validatedPref === 'cloud',
        llm_provider_preference: validatedPref,
        outputLanguage: 'en',
        targetSlideCount: finalSlideCount,
        bulletsPerSlide: finalBulletsPerSlide,
        wordsPerBullet: finalWordsPerBullet,
        audience: audience ? String(audience).trim() : undefined,
        tone: tone ? String(tone).trim() : undefined,
        speakerNotes: speaker_notes !== false && include_speaker_notes !== false,
        includeAgenda: agenda !== false && include_agenda !== false,
        includeSummary: summary !== false && include_summary !== false,
        focusText: focus_text ? String(focus_text).trim() : undefined,
        doNotCache: do_not_cache === true,
      }
    );

    const providerUsed = slideDeck.providerUsed || outline.providerUsed || 'ollama';
    slideDeck.title = transcriptData.title;
    slideDeck.subtitle = outline.subtitle || 'Executive Intelligence Briefing & Strategic Synthesis';
    s3Dur = Date.now() - t3Start;

    lastJobAudit.set(jobId, {
      verificationReport: (slideDeck as any).verificationReport,
      englishChunks: (slideDeck as any).englishChunks,
      slides: slideDeck.slides,
      outline,
      transcriptData,
      providerUsed,
      timings: { s1Dur, s2Dur, s3Dur },
    });

    // Stage 3: Slide Compilation (.pptx)
    console.log(`[QuickPitch Stage 3] Compiling native PowerPoint deck (Title: "${slideDeck.title}", Theme: ${slideDeck.theme}, Provider: ${providerUsed})...`);
    setJobStage(jobId, 'compile', 95, 'Compiling PowerPoint .pptx deck...');
    const t4Start = Date.now();
    let pptxResult;
    try {
      pptxResult = await compilePptx(slideDeck, theme, transcriptData.sanitizedText);
    } catch (compileErr: any) {
      console.warn('⚠️ [QuickPitch Stage 3] Primary slide compilation error, building safe recovery deck:', compileErr.message);
      isPartial = true;
      partialNotice = 'Compiled via recovery slide generator';

      const safeDeck = validateSlideDeck({
        theme: 'cyber-blue',
        detailLevel: 'balanced',
        slides: [
          {
            title: transcriptData.title,
            subtitle: '[Notice: Partial Recovery Presentation]',
            category: 'RECOVERY DECK',
            cards: [
              { card_title: 'Source Overview', points: [transcriptData.sanitizedText.slice(0, 200)] },
              { card_title: 'Notice', points: ['Presentation compiled in safe recovery mode.'] },
            ],
          },
        ],
      });
      pptxResult = await compilePptx(safeDeck, 'cyber-blue');
    }

    s4Dur = Date.now() - t4Start;
    const totalDur = Date.now() - pipelineStartTime;
    const sumDur = s1Dur + s2Dur + s3Dur + s4Dur;
    const auditRecord = lastJobAudit.get(jobId);
    if (auditRecord) {
      auditRecord.timings.s4Dur = s4Dur;
      auditRecord.timings.sumDur = sumDur;
      auditRecord.timings.totalDur = totalDur;
    }
    console.log(`[QuickPitch Timing] Ingestion: ${s1Dur}ms | Outline: ${s2Dur}ms | Slides+Verify: ${s3Dur}ms | Compile: ${s4Dur}ms | StageSum: ${sumDur}ms | Total: ${totalDur}ms`);

    console.log(`✅ Success! Returning ${pptxResult.fileName} (${pptxResult.buffer.length} bytes) ${isPartial ? '[PARTIAL]' : '[COMPLETE]'} (Provider: ${providerUsed})`);
    setJobStage(jobId, 'complete', 100, 'Deck compiled successfully!');

    return new Response(pptxResult.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${pptxResult.fileName}"`,
        'X-QuickPitch-Status': isPartial ? 'partial' : 'complete',
        'X-QuickPitch-Job-Id': jobId,
        'X-QuickPitch-Provider': providerUsed,
        'X-QuickPitch-Model': providerUsed === 'groq' ? 'openai/gpt-oss-20b' : 'qwen2.5:7b',
        'X-QuickPitch-Provider-Preference': validatedPref,
        'X-QuickPitch-Privacy-Notice': validatedPref === 'cloud'
          ? 'Cloud LLM processing enabled. Prompts and transcript chunks may be sent to Groq cloud API.'
          : 'Local LLM processing active. Data processed entirely on-device via Ollama.',
        'X-QuickPitch-Low-Language-Confidence': isLowConfidence ? 'true' : 'false',
        'X-QuickPitch-Detected-Language': detectedLang,
        'X-QuickPitch-Slide-Count': String(slideDeck.slides?.length || 0),
        'X-QuickPitch-Slide-Target': String(finalSlideCount),
        'X-QuickPitch-Stage1-Ms': String(s1Dur),
        'X-QuickPitch-Stage2-Ms': String(s2Dur),
        'X-QuickPitch-Stage3-Ms': String(s3Dur),
        'X-QuickPitch-Stage4-Ms': String(s4Dur),
        'X-QuickPitch-StageSum-Ms': String(sumDur),
        'X-QuickPitch-Total-Ms': String(totalDur),
        ...(((slideDeck as any).slideAdjustmentNotice || (slideDeck as any).adjustmentNotice) ? { 'X-QuickPitch-Slide-Adjustment': (slideDeck as any).slideAdjustmentNotice || (slideDeck as any).adjustmentNotice } : {}),
        ...(isPartial ? { 'X-QuickPitch-Notice': partialNotice } : {}),
      },
    });
  } catch (error: any) {
    // Ultimate safety: return a clear JSON message with partial details rather than a blank 500 crash
    console.error('[QuickPitch] Generate PPT Error:', error);
    try {
      const body = c.get('parsedBody') || {};
      const jobId = body.job_id || c.req.query('job_id');
      setJobStage(jobId, 'error', 0, error.message || 'Generation failed');
    } catch {}
    return c.json({
      status: 'partial_error',
      message: 'Presentation request encountered an issue but was caught safely by our resilience layer.',
      error: error.message || 'Internal Server Error',
      hint: 'You can retry with direct text prompt or check Ollama / Groq status.',
    }, 200);
  }
}
