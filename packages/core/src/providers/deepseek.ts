/**
 * PhantomMindAI — DeepSeek Provider
 */

import { BaseProvider } from './base.js';
import type { CompletionRequest, CompletionResponse, StreamChunk } from '../types.js';

export class DeepSeekProvider extends BaseProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: any) {
    super(config);
    this.apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.deepseek.com/v1';
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages = this.buildMessages(request);
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 8096,
        temperature: request.temperature ?? this.config.temperature ?? 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content ?? '';
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    return {
      content,
      model: this.config.model,
      provider: 'deepseek',
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
    const messages = this.buildMessages(request);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 8096,
        temperature: request.temperature ?? this.config.temperature ?? 0.2,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`DeepSeek stream error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.choices?.[0]?.delta?.content ?? '';
            if (text) yield { content: text, done: false };
          } catch { /* skip */ }
        }
      }
    }
    yield { content: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.config.apiKey || process.env.DEEPSEEK_API_KEY);
  }

  async listModels(): Promise<string[]> {
    return ['deepseek-coder', 'deepseek-chat'];
  }
}
