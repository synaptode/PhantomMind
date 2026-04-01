/**
 * PhantomindAI — Gemini Provider (Google)
 */

import { BaseProvider } from './base.js';
import type {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '../types.js';

export class GeminiProvider extends BaseProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: any) {
    super(config);
    this.apiKey = config.apiKey || process.env.GOOGLE_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages = this.buildMessages(request);
    const start = Date.now();

    const systemInstruction = messages.find(m => m.role === 'system');
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const url = `${this.baseUrl}/models/${this.config.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemInstruction && {
          systemInstruction: { parts: [{ text: systemInstruction.content }] },
        }),
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 8096,
          temperature: request.temperature ?? this.config.temperature ?? 0.2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      content,
      model: this.config.model,
      provider: 'gemini',
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

    const systemInstruction = messages.find(m => m.role === 'system');
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const url = `${this.baseUrl}/models/${this.config.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemInstruction && {
          systemInstruction: { parts: [{ text: systemInstruction.content }] },
        }),
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 8096,
          temperature: request.temperature ?? this.config.temperature ?? 0.2,
        },
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Gemini stream error: ${response.status}`);
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
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (text) yield { content: text, done: false };
          } catch {
            // skip malformed JSON
          }
        }
      }
    }

    yield { content: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.config.apiKey || process.env.GOOGLE_API_KEY);
  }

  async listModels(): Promise<string[]> {
    return ['gemini-1.5-pro', 'gemini-2.0-flash'];
  }
}
