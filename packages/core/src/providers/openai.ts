/**
 * PhantomMindAI — OpenAI Provider
 */

import { BaseProvider } from './base.js';
import type {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../types.js';

export class OpenAIProvider extends BaseProvider {
  private client: any;

  private async getClient() {
    if (!this.client) {
      const { default: OpenAI } = await import('openai');
      this.client = new OpenAI({
        apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
        ...(this.config.baseUrl && { baseURL: this.config.baseUrl }),
      });
    }
    return this.client;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const client = await this.getClient();
    const messages = this.buildMessages(request);
    const start = Date.now();

    const response = await client.chat.completions.create({
      model: this.config.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 8096,
      temperature: request.temperature ?? this.config.temperature ?? 0.2,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    return {
      content,
      model: this.config.model,
      provider: 'openai',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost: this.estimateCost({ inputTokens, outputTokens }),
      },
      duration: Date.now() - start,
    };
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const client = await this.getClient();
    const messages = this.buildMessages(request);

    const stream = await client.chat.completions.create({
      model: this.config.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 8096,
      temperature: request.temperature ?? this.config.temperature ?? 0.2,
      stream: true,
    });

    let totalContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      totalContent += delta;
      if (delta) {
        yield { content: delta, done: false };
      }
    }

    yield {
      content: '',
      done: true,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    return !!apiKey;
  }

  async listModels(): Promise<string[]> {
    return ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3'];
  }
}
