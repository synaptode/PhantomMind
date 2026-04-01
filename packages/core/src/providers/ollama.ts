/**
 * PhantomindAI — Ollama Provider (local models)
 */

import { BaseProvider } from './base.js';
import type { CompletionRequest, CompletionResponse, StreamChunk } from '../types.js';

export class OllamaProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages = this.buildMessages(request);
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
        options: {
          num_predict: request.maxTokens ?? this.config.maxTokens ?? 8096,
          temperature: request.temperature ?? this.config.temperature ?? 0.2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as any;
    const content = data.message?.content ?? '';
    const inputTokens = data.prompt_eval_count ?? 0;
    const outputTokens = data.eval_count ?? 0;

    return {
      content,
      model: this.config.model,
      provider: 'ollama',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost: 0, // local models are free
      },
      duration: Date.now() - start,
    };
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const messages = this.buildMessages(request);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        options: {
          num_predict: request.maxTokens ?? this.config.maxTokens ?? 8096,
          temperature: request.temperature ?? this.config.temperature ?? 0.2,
        },
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream error: ${response.status}`);
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
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              yield { content: data.message.content, done: false };
            }
            if (data.done) {
              yield {
                content: '',
                done: true,
                usage: {
                  inputTokens: data.prompt_eval_count ?? 0,
                  outputTokens: data.eval_count ?? 0,
                  totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
                  estimatedCost: 0,
                },
              };
              return;
            }
          } catch { /* skip */ }
        }
      }
    }
    yield { content: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json() as any;
      return (data.models ?? []).map((m: any) => m.name);
    } catch {
      return [];
    }
  }
}
