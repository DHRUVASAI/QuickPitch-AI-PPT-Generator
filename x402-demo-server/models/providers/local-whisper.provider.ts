import type { ITranscriptionProvider } from '../types.js';
import { withRetryAndTimeout } from '../../core/utils/retry.js';

export interface LocalWhisperTranscribeOptions {
  language?: string;
  initialPrompt?: string;
  vadFilter?: boolean;
  unloadAfter?: boolean;
}

export interface LocalWhisperResult {
  text: string;
  language: string;
  languageProbability: number;
  duration: number;
  segments?: Array<{ start: number; end: number; text: string }>;
}

export class LocalWhisperProvider implements ITranscriptionProvider {
  public readonly name = 'local-whisper';
  public readonly isLocal = true;
  private baseUrl: string;

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl || process.env.LOCAL_WHISPER_URL || 'http://127.0.0.1:8000';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!resp.ok) return false;
      const data: any = await resp.json().catch(() => ({}));
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  async detectLanguage(
    audioBuffer: Buffer,
    fileName: string = 'probe.mp3'
  ): Promise<{ language: string; probability: number; duration: number }> {
    return withRetryAndTimeout(
      async (signal) => {
        const formData = new FormData();
        formData.append('file', new Blob([new Uint8Array(audioBuffer)]), fileName);

        const resp = await fetch(`${this.baseUrl}/detect-language`, {
          method: 'POST',
          body: formData,
          signal,
        });

        if (!resp.ok) {
          throw new Error(`Language detection failed with status ${resp.status}`);
        }

        const data: any = await resp.json();
        return {
          language: data.language,
          probability: data.probability,
          duration: data.duration,
        };
      },
      { name: 'Local Whisper Language Detection', timeoutMs: 15000, retries: 1 }
    );
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    fileName: string,
    contentType: string = 'audio/mpeg',
    options?: LocalWhisperTranscribeOptions
  ): Promise<string> {
    const full = await this.transcribeAudioDetailed(audioBuffer, fileName, contentType, options);
    return full.text;
  }

  async transcribeAudioDetailed(
    audioBuffer: Buffer,
    fileName: string,
    contentType: string = 'audio/mpeg',
    options?: LocalWhisperTranscribeOptions
  ): Promise<LocalWhisperResult> {
    return withRetryAndTimeout(
      async (signal) => {
        const formData = new FormData();
        formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: contentType }), fileName);

        if (options?.language && options.language.toLowerCase() !== 'auto') {
          formData.append('language', options.language);
        }
        if (options?.initialPrompt) {
          formData.append('initial_prompt', options.initialPrompt);
        }
        formData.append('vad_filter', options?.vadFilter !== false ? 'true' : 'false');
        if (options?.unloadAfter) {
          formData.append('unload_after', 'true');
        }

        const resp = await fetch(`${this.baseUrl}/v1/audio/transcriptions`, {
          method: 'POST',
          body: formData,
          signal,
        });

        if (!resp.ok) {
          const err = await resp.text().catch(() => '');
          throw new Error(`Local Whisper error (${resp.status}): ${err || resp.statusText}`);
        }

        const data: any = await resp.json();
        return {
          text: data.text || '',
          language: data.language || 'en',
          languageProbability: data.language_probability ?? 1.0,
          duration: data.duration ?? 0,
          segments: data.segments,
        };
      },
      { name: 'Local Whisper Transcribe', timeoutMs: 120000, retries: 1, initialDelayMs: 500 }
    );
  }

  async unload(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/unload`, {
        method: 'POST',
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }
}
