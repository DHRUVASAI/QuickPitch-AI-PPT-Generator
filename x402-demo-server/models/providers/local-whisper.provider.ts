import type { ITranscriptionProvider } from '../types.js';
import { withRetryAndTimeout } from '../../core/utils/retry.js';

export interface LocalWhisperTranscribeOptions {
  model?: string;
  language?: string;
  task?: 'transcribe' | 'translate';
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

async function unloadOllama(): Promise<void> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  try {
    console.log(`[LocalWhisperProvider: VRAM] Unloading Ollama model ${model} (keep_alive: 0)...`);
    await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: 0 }),
      signal: AbortSignal.timeout(4000),
    });
    console.log(`[LocalWhisperProvider: VRAM] Successfully unloaded ${model} to maximize GPU VRAM.`);
  } catch (err: any) {
    console.warn(`[LocalWhisperProvider: VRAM] Warning: Ollama unload call failed: ${err.message}`);
  }
}

async function reloadOllama(): Promise<void> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  try {
    console.log(`[LocalWhisperProvider: VRAM] Reloading Ollama model ${model}...`);
    await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: '', stream: false }),
      signal: AbortSignal.timeout(10000),
    });
    console.log(`[LocalWhisperProvider: VRAM] Successfully reloaded ${model}.`);
  } catch (err: any) {
    console.warn(`[LocalWhisperProvider: VRAM] Warning: Ollama reload call failed: ${err.message}`);
  }
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
    const isHeavyModel = options?.model === 'medium' || options?.model === 'large-v3' || (options?.model && options.model.includes('large'));
    if (isHeavyModel) {
      await unloadOllama();
    }

    try {
      return await withRetryAndTimeout(
        async (signal) => {
        const formData = new FormData();
        formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: contentType }), fileName);

        const task = options?.task || 'transcribe';
        formData.append('task', task);
        if (options?.model) {
          formData.append('model', options.model);
        }
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

        console.log(`[LocalWhisperProvider] Sending to sidecar: model=${options?.model || 'default'}, language=${options?.language || 'auto'}, task=${task}, vad=${options?.vadFilter !== false}`);

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
      { name: 'Local Whisper Transcribe', timeoutMs: 300000, retries: 1, initialDelayMs: 500 }
    );
  } finally {
    if (isHeavyModel) {
      await reloadOllama();
    }
  }
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
