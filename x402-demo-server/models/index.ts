import { OllamaProvider } from './providers/ollama.provider.js';
import { GroqProvider } from './providers/groq.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { AWSTranscribeProvider } from './providers/aws-transcribe.provider.js';
import { LocalWhisperProvider } from './providers/local-whisper.provider.js';
import { UnifiedModelClient } from './unified-client.js';

export * from './types.js';
export * from './unified-client.js';
export * from './providers/ollama.provider.js';
export * from './providers/groq.provider.js';
export * from './providers/gemini.provider.js';
export * from './providers/aws-transcribe.provider.js';
export * from './providers/local-whisper.provider.js';

let defaultModelClient: UnifiedModelClient | null = null;
let defaultTranscriptionProvider: AWSTranscribeProvider | null = null;
let defaultLocalWhisperProvider: LocalWhisperProvider | null = null;

/**
 * Returns the application-wide UnifiedModelClient configured with Ollama, Groq, and Gemini
 */
export function getModelClient(): UnifiedModelClient {
  if (!defaultModelClient) {
    const ollama = new OllamaProvider();
    const groq = new GroqProvider();
    const gemini = new GeminiProvider();

    // Default: try local Ollama first for private local GPU, then cloud Groq, then Gemini
    defaultModelClient = new UnifiedModelClient([ollama, groq, gemini]);
  }
  return defaultModelClient;
}

/**
 * Returns the local faster-whisper sidecar client
 */
export function getLocalWhisperClient(): LocalWhisperProvider {
  if (!defaultLocalWhisperProvider) {
    defaultLocalWhisperProvider = new LocalWhisperProvider();
  }
  return defaultLocalWhisperProvider;
}

/**
 * Returns the default speech transcription provider (AWS Transcribe + S3)
 */
export function getTranscriptionClient(): AWSTranscribeProvider {
  if (!defaultTranscriptionProvider) {
    defaultTranscriptionProvider = new AWSTranscribeProvider();
  }
  return defaultTranscriptionProvider;
}
