import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  TranscriptionJobStatus,
} from '@aws-sdk/client-transcribe';
import type { ITranscriptionProvider } from '../types.js';

export class AWSTranscribeProvider implements ITranscriptionProvider {
  public readonly name = 'aws-transcribe';
  private s3Client: S3Client;
  private transcribeClient: TranscribeClient;
  private bucket: string;

  constructor(options?: {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
  }) {
    const region = options?.region || process.env.AWS_REGION || 'us-east-1';
    const credentials = {
      accessKeyId: options?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: options?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
    };

    this.s3Client = new S3Client({ region, credentials });
    this.transcribeClient = new TranscribeClient({ region, credentials });
    this.bucket = options?.bucket || process.env.S3_BUCKET || 'quickpitch-ppts';
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      this.bucket
    );
  }

  async transcribeAudio(audioBuffer: Buffer, fileName: string, contentType: string): Promise<string> {
    const key = `audio-uploads/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // 1. Upload to S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: audioBuffer,
        ContentType: contentType,
      })
    );

    const s3Uri = `s3://${this.bucket}/${key}`;
    const ext = fileName.split('.').pop()?.toLowerCase() || 'mp3';
    const mediaFormat = ['mp3', 'mp4', 'wav', 'flac', 'ogg', 'amr', 'webm', 'm4a'].includes(ext)
      ? ext
      : 'mp3';

    // 2. Start transcription job
    const jobName = `quickpitch-${Date.now()}`;
    await this.transcribeClient.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        Media: { MediaFileUri: s3Uri },
        MediaFormat: mediaFormat as any,
        IdentifyLanguage: true,
        OutputBucketName: this.bucket,
        OutputKey: `transcripts/${jobName}.json`,
      })
    );

    // 3. Poll for results
    const maxWaitMs = 60000;
    const pollIntervalMs = 2500;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(r => setTimeout(r, pollIntervalMs));
      const res = await this.transcribeClient.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
      );
      const status = res.TranscriptionJob?.TranscriptionJobStatus;

      if (status === TranscriptionJobStatus.COMPLETED) {
        const getObj = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucket,
            Key: `transcripts/${jobName}.json`,
          })
        );
        const jsonStr = await getObj.Body?.transformToString();
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          const transcriptText = parsed.results?.transcripts?.[0]?.transcript;
          if (transcriptText) return transcriptText;
        }
        throw new Error('Transcription completed but output was empty.');
      }

      if (status === TranscriptionJobStatus.FAILED) {
        throw new Error(`AWS Transcribe job failed: ${res.TranscriptionJob?.FailureReason || 'Unknown error'}`);
      }
    }

    throw new Error('AWS Transcribe job timed out.');
  }
}
