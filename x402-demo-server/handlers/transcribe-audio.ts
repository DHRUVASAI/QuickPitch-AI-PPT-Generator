import type { Context } from 'hono';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  TranscriptionJobStatus
} from '@aws-sdk/client-transcribe';
import OpenAI from 'openai';
import 'dotenv/config';

// ─── AWS Clients ─────────────────────────────────────────────────────────────
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
};

const s3Client = new S3Client(awsConfig);
const transcribeClient = new TranscribeClient(awsConfig);
const S3_BUCKET = process.env.S3_BUCKET || 'quickpitch-ppts';

// ─── Helper: Upload audio bytes to S3 ────────────────────────────────────────
async function uploadAudioToS3(audioBuffer: ArrayBuffer, fileName: string, contentType: string): Promise<string> {
  const key = `audio-uploads/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: Buffer.from(audioBuffer),
    ContentType: contentType
  }));

  const s3Uri = `s3://${S3_BUCKET}/${key}`;
  console.log(`✅ Audio uploaded to S3: ${s3Uri}`);
  return s3Uri;
}

// ─── Helper: Run AWS Transcribe job and poll for result ──────────────────────
async function runAwsTranscribeJob(s3Uri: string, mediaFormat: string): Promise<string | null> {
  const jobName = `quickpitch-${Date.now()}`;

  console.log(`🎙️ Starting AWS Transcribe job: ${jobName} (auto-detect language)`);
  await transcribeClient.send(new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    Media: { MediaFileUri: s3Uri },
    MediaFormat: mediaFormat as any,
    IdentifyLanguage: true,          // Auto-detect any of 100+ languages
    OutputBucketName: S3_BUCKET,
    OutputKey: `transcripts/${jobName}.json`
  }));

  // Poll up to 60 seconds
  const maxWaitMs = 60000;
  const pollIntervalMs = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(res => setTimeout(res, pollIntervalMs));

    const statusResp = await transcribeClient.send(new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName
    }));
    const status = statusResp.TranscriptionJob?.TranscriptionJobStatus;
    console.log(`  Transcribe job status: ${status} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);

    if (status === TranscriptionJobStatus.COMPLETED) {
      // Fetch the transcript JSON from S3
      try {
        const s3Resp = await s3Client.send(new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: `transcripts/${jobName}.json`
        }));
        const body = await s3Resp.Body?.transformToString('utf-8');
        if (body) {
          const parsed = JSON.parse(body);
          const transcript = parsed?.results?.transcripts?.[0]?.transcript;
          if (transcript && transcript.trim().length > 20) {
            console.log(`✅ AWS Transcribe completed! Transcript length: ${transcript.length} chars`);
            return transcript;
          }
        }
      } catch (e: any) {
        console.warn('Failed to fetch transcript from S3:', e.message);
      }
      return null;
    }

    if (status === TranscriptionJobStatus.FAILED) {
      console.warn('❌ AWS Transcribe job failed');
      return null;
    }
  }

  console.warn('⏱️ AWS Transcribe timed out after 60s');
  return null;
}

// ─── Helper: Groq Whisper fallback transcription ──────────────────────────────
async function transcribeWithGroqWhisper(audioBuffer: ArrayBuffer, fileName: string, mimeType: string): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  try {
    console.log('🔄 Falling back to Groq Whisper transcription...');
    const groqClient = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
    
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    const audioFile = new File([audioBlob], fileName, { type: mimeType });

    const response = await groqClient.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      response_format: 'text'
      // No language param — auto-detect any of 99 languages
    });

    const transcript = typeof response === 'string' ? response : (response as any).text || '';
    if (transcript && transcript.trim().length > 20) {
      console.log(`✅ Groq Whisper transcription complete! Length: ${transcript.length} chars`);
      return transcript;
    }
  } catch (e: any) {
    console.warn('Groq Whisper error:', e.message);
  }
  return null;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function handleTranscribeAudio(c: Context) {
  try {
    console.log('🎙️ Audio transcription request received');

    // Parse multipart form data
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return c.json({ error: 'No audio file provided. Send audio file as "audio" field in multipart/form-data.' }, 400);
    }

    const fileName = audioFile.name || 'audio.mp3';
    const mimeType = audioFile.type || 'audio/mpeg';
    const fileSizeKB = Math.round(audioFile.size / 1024);
    
    console.log(`  File: ${fileName} | Type: ${mimeType} | Size: ${fileSizeKB} KB`);

    // Validate it's actually audio
    const isAudio = mimeType.startsWith('audio/') || 
                    fileName.match(/\.(mp3|mp4|wav|m4a|flac|ogg|webm|aac|amr|opus)$/i);
    if (!isAudio) {
      return c.json({ 
        error: 'File must be an audio file. Supported: mp3, wav, m4a, flac, ogg, mp4, webm, aac',
        received_type: mimeType
      }, 400);
    }

    const audioBuffer = await audioFile.arrayBuffer();

    // Determine media format for AWS Transcribe
    const ext = fileName.split('.').pop()?.toLowerCase() || 'mp3';
    const mediaFormatMap: Record<string, string> = {
      'mp3': 'mp3', 'mp4': 'mp4', 'wav': 'wav', 'm4a': 'mp4',
      'flac': 'flac', 'ogg': 'ogg', 'webm': 'webm', 'amr': 'amr', 'opus': 'ogg'
    };
    const mediaFormat = mediaFormatMap[ext] || 'mp3';

    // ── STEP 1: Try AWS Transcribe (via S3) ──────────────────────────────────
    let transcript: string | null = null;

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        console.log('🚀 Attempting AWS Transcribe pipeline...');
        const s3Uri = await uploadAudioToS3(audioBuffer, fileName, mimeType);
        transcript = await runAwsTranscribeJob(s3Uri, mediaFormat);
      } catch (awsErr: any) {
        console.warn('AWS pipeline error:', awsErr.message);
      }
    }

    // ── STEP 2: Fallback to Groq Whisper ─────────────────────────────────────
    if (!transcript) {
      transcript = await transcribeWithGroqWhisper(audioBuffer, fileName, mimeType);
    }

    // ── STEP 3: Return transcript ─────────────────────────────────────────────
    if (transcript && transcript.trim().length > 20) {
      return c.json({
        success: true,
        transcript: transcript.trim(),
        char_count: transcript.length,
        source: 'aws_transcribe'
      });
    }

    return c.json({ 
      error: 'Transcription failed. Audio may be too short, corrupt, or in an unsupported format.',
      tip: 'Supported formats: mp3, wav, m4a, flac, ogg, mp4'
    }, 422);

  } catch (error: any) {
    console.error('Transcription handler error:', error);
    return c.json({ error: error.message || 'Internal transcription error' }, 500);
  }
}
