/**
 * PhantomindAI — Anthropic Provider (Claude)
 */

import { BaseProvider } from './base.js';
import type {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../types.js';

export class AnthropicProvider extends BaseProvider {
  private client: any;

  private async getClient() {
    if (!this.client) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      this.client = new Anthropic({
        apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
        ...(this.config.baseUrl && { baseURL: this.config.baseUrl }),
      });
    }
    return this.client;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const client = await this.getClient();
    const messages = this.buildMessages(request);
    const start = Date.now();

    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await client.messages.create({
      model: this.config.model,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 8096,
      temperature: request.temperature ?? this.config.temperature ?? 0.2,
      ...(systemMessage && { system: systemMessage.content }),
      messages: chatMessages,
    });

    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      estimatedCost: this.estimateCost({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }),
    };

    return {
      content,
      model: this.config.model,
      provider: 'anthropic',
      usage,
      duration: Date.now() - start,
    };
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const client = await this.getClient();
    const messages = this.buildMessages(request);

    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const stream = await client.messages.stream({
      model: this.config.model,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 8096,
      temperature: request.temperature ?? this.config.temperature ?? 0.2,
      ...(systemMessage && { system: systemMessage.content }),
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { content: event.delta.text, done: false };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      content: '',
      done: true,
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
        estimatedCost: this.estimateCost({
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        }),
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    return !!apiKey;
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-5-haiku-20241022',
    ];
  }
}
