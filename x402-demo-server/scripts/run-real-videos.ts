import { extractTranscript } from '../core/transcript/extractor.js';

const defaultVideos = [
  'https://www.youtube.com/watch?v=qzAHXO-cN5Q', // Hindi / Hinglish: Simplilearn AI Tutorial
  'https://www.youtube.com/watch?v=8tK5z83unaM', // Telugu / English: Student Placements & AI Talk
  'https://www.youtube.com/watch?v=jNQXAC9IVRw', // English: Me at the zoo (Classic short speech)
  'https://www.youtube.com/watch?v=kcc_KAhwpa0', // English: CGP Grey (High-density manual captions)
];

const urls = process.argv.slice(2).filter((u) => u.startsWith('http'));
const testUrls = urls.length > 0 ? urls : defaultVideos;

async function run() {
  console.log('================================================================');
  console.log(' QuickPitch B10: Real Video Extraction & Transcription Runner');
  console.log('================================================================');
  console.log(`Testing ${testUrls.length} real non-music YouTube videos:\n`);

  const results: any[] = [];

  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    console.log(`\n----------------------------------------------------------------`);
    console.log(`[Video ${i + 1}/${testUrls.length}]: ${url}`);
    console.log(`----------------------------------------------------------------`);

    const startTime = Date.now();
    try {
      const transcriptData = await extractTranscript({
        sourceType: 'youtube',
        url,
      }, { allowCloudFallback: false });

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const words = transcriptData.sanitizedText.split(/\s+/).filter(Boolean).length;

      // Extract 10-line sample
      let sample10Lines: string[] = [];
      const punctuatedLines = transcriptData.sanitizedText
        .split(/(?<=[.?!।])\s+|\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 5);

      if (punctuatedLines.length >= 10) {
        sample10Lines = punctuatedLines.slice(0, 10);
      } else {
        const wordsArr = transcriptData.sanitizedText.split(/\s+/).filter(Boolean);
        const chunkSize = 12;
        for (let idx = 0; idx < Math.min(wordsArr.length, 120); idx += chunkSize) {
          sample10Lines.push(wordsArr.slice(idx, idx + chunkSize).join(' '));
        }
        sample10Lines = sample10Lines.slice(0, 10);
      }

      const report = {
        index: i + 1,
        url,
        title: transcriptData.title,
        durationSeconds: transcriptData.metadata?.durationSeconds || 'N/A',
        pathUsed: transcriptData.metadata?.isManualCaptions
          ? 'Manual Captions'
          : transcriptData.metadata?.detectedLanguage
          ? 'Audio Download + Faster-Whisper'
          : transcriptData.metadata?.partial
          ? 'Partial Metadata'
          : 'Captions Track',
        detectedLanguage: transcriptData.metadata?.detectedLanguage || transcriptData.metadata?.language || 'en',
        languageConfidence: transcriptData.metadata?.languageConfidence
          ? `${Math.round(transcriptData.metadata.languageConfidence * 100)}%`
          : 'N/A',
        lowConfidence: transcriptData.metadata?.lowLanguageConfidence ?? false,
        charCount: transcriptData.charCount,
        wordCount: words,
        elapsedSec: `${elapsedSec}s`,
        sample10Lines,
      };

      results.push(report);

      console.log(`\n✓ Result:`);
      console.log(`  Title:               "${report.title}"`);
      console.log(`  Extraction Path:     ${report.pathUsed}`);
      console.log(`  Spoken Language:     ${report.detectedLanguage} (Conf: ${report.languageConfidence}, LowConf: ${report.lowConfidence})`);
      console.log(`  Transcript Length:   ${report.charCount} chars (${report.wordCount} words)`);
      console.log(`  Time Elapsed:        ${report.elapsedSec}`);
      console.log(`  10-Line Transcript Sample:`);
      sample10Lines.forEach((line, idx) => {
        console.log(`    [Line ${idx + 1}] ${line}`);
      });
    } catch (err: any) {
      console.error(`❌ Failed for ${url}:`, err.message);
      results.push({
        index: i + 1,
        url,
        error: err.message,
      });
    }
  }

  console.log('\n================================================================');
  console.log(' FINAL RESULTS SUMMARY TABLE (B10 Actual Output)');
  console.log('================================================================');
  console.table(
    results.map((r) => ({
      '#': r.index,
      Title: (r.title || r.error || '').slice(0, 30),
      Path: r.pathUsed || 'Error',
      Lang: r.detectedLanguage || 'N/A',
      Confidence: r.languageConfidence || 'N/A',
      Words: r.wordCount || 0,
      Time: r.elapsedSec || 'N/A',
    }))
  );
}

run().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
