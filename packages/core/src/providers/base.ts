/**
 * PhantomindAI — Abstract Provider Base
 */

import type {
  ProviderName,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  ChatMessage,
  TokenUsage,
  StreamChunk,
} from '../types.js';

/**
 * Pricing per 1M tokens for cost estimation
 */
export const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'o1': { input: 15.0, output: 60.0 },
  'o3': { input: 10.0, output: 40.0 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
  'mistral-large-latest': { input: 2.0, output: 6.0 },
  'codestral-latest': { input: 0.3, output: 0.9 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
};

export abstract class BaseProvider {
  readonly providerName: ProviderName;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.providerName = config.name;
    this.config = config;
  }

  /**
   * Send a completion request to the provider
   */
  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Stream a completion from the provider
   */
  abstract stream(request: CompletionRequest): AsyncGenerator<StreamChunk>;

  /**
   * Check if provider is available (API key set, endpoint reachable)
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get list of available models from this provider
   */
  abstract listModels(): Promise<string[]>;

  /**
   * Build chat messages from a CompletionRequest
   */
  protected buildMessages(request: CompletionRequest): ChatMessage[] {
    const messages: ChatMessage[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    if (request.messages) {
      messages.push(...request.messages);
    }

    if (request.prompt) {
      messages.push({ role: 'user', content: request.prompt });
    }

    return messages;
  }

  /**
   * Estimate cost based on token usage
   */
  protected estimateCost(usage: { inputTokens: number; outputTokens: number }): number {
    const pricing = PROVIDER_PRICING[this.config.model] ?? { input: 1.0, output: 2.0 };
    return (
      (usage.inputTokens / 1_000_000) * pricing.input +
      (usage.outputTokens / 1_000_000) * pricing.output
    );
  }

  /**
   * Get model configuration
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Get provider configuration (redacted)
   */
  getConfig(): Omit<ProviderConfig, 'apiKey'> {
    const { apiKey: _, ...rest } = this.config;
    return rest;
  }
}
