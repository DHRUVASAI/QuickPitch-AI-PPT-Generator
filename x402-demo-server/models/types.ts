/**
 * Model Access Layer - Interfaces & Types
 * Defines the swappable provider interface for all LLM and Transcription operations.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  jsonMode?: boolean;
}

export interface ModelCompletionResult {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Standard interface that all LLM providers must implement
 */
export interface ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  isAvailable(): Promise<boolean>;
  complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ModelCompletionResult>;
}

/**
 * Standard interface that all Speech-to-Text providers must implement
 */
export interface ITranscriptionProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  transcribeAudio(audioBuffer: Buffer, fileName: string, contentType: string): Promise<string>;
}
