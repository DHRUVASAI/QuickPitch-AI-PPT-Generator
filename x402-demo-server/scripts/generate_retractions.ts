import { writeEvidence } from './evidence-helper.js';

interface RetractionItem {
  claimName: string;
  round38Claim: string;
  reasonInvalid: string;
  replacementEvidenceFile: string;
}

const retractions: RetractionItem[] = [
  {
    claimName: 'Hindi grounding table and quoted chunks',
    round38Claim: 'Claimed 8 slides with 24 bullets grounded in Hindi chunks with quotes containing Latin "AI", danda "।", and historical/future entities: John McCarthy, 1956 Dartmouth, Lee Sedol, Siri, 2029 AGI.',
    reasonInvalid: 'Real files audit (qzAHXO_parsed_vtt.json and qzAHXO_large_v3_translate.json) has 0 matches for McCarthy, Sedol, 1956, 2029, and Siri. Danda "।" and Latin "AI" were synthetic LLM fabrications; YouTube ASR emits unpunctuated Devanagari text. Grounding audit yielded 0 SUPPORTED, 0 PARTIAL, 24 NO SUPPORT.',
    replacementEvidenceFile: 'evidence/round39/item2_hindi_video.json',
  },
  {
    claimName: 'Translation similarity table',
    round38Claim: 'Presented similarity scores between 14 translated chunks and Whisper large-v3 translate, claiming high lexical and semantic alignment.',
    reasonInvalid: 'The chunks compared were ungrounded and did not align to real caption line windows; translations contained hallucinated entities not in the source.',
    replacementEvidenceFile: 'evidence/round39/item2_hindi_video.json',
  },
  {
    claimName: 'Entity timeline',
    round38Claim: 'Timeline claimed video covers John McCarthy (1956), Deep Blue (1997), Siri (2011), AlphaGo vs Lee Sedol (2016), Kurzweil (2029/2045).',
    reasonInvalid: 'The real video only discusses home automation robots, lab robot crossing a river with a plank, Go vs Chess, Alexa playing Despacito, Ultron in Avengers, Kurzweil (misheard as Coors Will in ASR) 2045, and Elon Musk cyborg implants. McCarthy, 1956, Sedol, Siri, and 2029 never appear.',
    replacementEvidenceFile: 'evidence/round39/item2_hindi_video.json',
  },
  {
    claimName: 'Polling trace',
    round38Claim: 'Reported a polling trace with synthetic progress percentages and mock timestamps.',
    reasonInvalid: 'Trace was staged rather than captured from real HTTP curl requests against a running server.',
    replacementEvidenceFile: 'evidence/round39/item4_job_status.json',
  },
  {
    claimName: 'Job-status route snippet',
    round38Claim: 'Reported an unverified handler snippet for job status.',
    reasonInvalid: 'Snippet did not reflect actual Hono framework implementation at index.ts:120-127.',
    replacementEvidenceFile: 'evidence/round39/item4_job_status.json',
  },
  {
    claimName: 'Stage timing table',
    round38Claim: 'Reported hardcoded stage breakdown in benchmark_item8_e2e.ts with reused Whisper timings.',
    reasonInvalid: 'Stages were hardcoded constants rather than measured server log stage durations. Whisper time was carried over from another benchmark without live GPU recording.',
    replacementEvidenceFile: 'evidence/round39/item5_e2e_measurement.json',
  },
  {
    claimName: 'Groq llama-3.3 benchmark',
    round38Claim: 'Reported benchmark performance using llama-3.3-70b-versatile on Groq API.',
    reasonInvalid: 'Querying live Groq API endpoint https://api.groq.com/openai/v1/models showed that llama-3.3-70b-versatile does not exist on the user\'s API key.',
    replacementEvidenceFile: 'evidence/round39/item6_groq_benchmark.json',
  },
  {
    claimName: 'Slide 8 and unit duration overrun to 06:17',
    round38Claim: 'Reported units and slide 8 extending to 06:17 on a 5:28 (327.9s) video.',
    reasonInvalid: 'Synthetic 14-chunk generator failed to clamp end timestamps to the true video duration (327.889s), allowing timestamps to drift past the end of the video.',
    replacementEvidenceFile: 'evidence/round39/item3_timestamps.json',
  },
  {
    claimName: 'Reused Whisper VRAM and timing proof',
    round38Claim: 'Reused Whisper large-v3 VRAM usage and execution time numbers across benchmarks as proof of active execution.',
    reasonInvalid: 'No live GPU session was attached during that specific benchmark run; carried-over timings cannot substitute for active measurement and are marked unverified.',
    replacementEvidenceFile: 'evidence/round39/item5_e2e_measurement.json',
  },
];

const result = writeEvidence(
  'retractions.json',
  {
    description: 'Complete list of invalid Round 3.8 claims, root causes, and replacement evidence files.',
    retractionsCount: retractions.length,
    retractions,
  },
  [
    'scratch/qzAHXO_parsed_vtt.json',
    'scratch/qzAHXO_large_v3_translate.json',
    'scratch/round38_hindi_deck.json',
    'core/synthesis/slide-planner.ts',
    'scripts/benchmark_item8_e2e.ts',
  ]
);

console.log(`Retractions written to ${result.relativePath} (${retractions.length} items retracted)`);
