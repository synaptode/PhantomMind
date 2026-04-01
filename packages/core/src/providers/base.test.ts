import { describe, it, expect, beforeEach } from 'vitest';
import { BaseProvider, PROVIDER_PRICING } from './base.js';

// Create a concrete test implementation since BaseProvider is abstract
class TestProvider extends BaseProvider {
  async complete() {
    return {
      content: 'test',
      model: this.getModel(),
      provider: this.providerName,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
      duration: 0,
    };
  }

  async *stream(): AsyncGenerator<any> {
    yield { content: 'chunk', done: true };
  }

  async isAvailable() {
    return true;
  }

  async listModels() {
    return [this.getModel()];
  }

  // Expose protected methods for testing
  testBuildMessages(request: any) {
    return this.buildMessages(request);
  }

  testEstimateCost(usage: { inputTokens: number; outputTokens: number }) {
    return this.estimateCost(usage);
  }
}

describe('BaseProvider', () => {
  const config = { name: 'anthropic' as const, model: 'claude-sonnet-4-20250514', apiKey: 'test' };
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider(config);
  });

  describe('constructor', () => {
    it('sets provider name from config', () => {
      expect(provider.providerName).toBe('anthropic');
    });

    it('exposes model via getModel()', () => {
      expect(provider.getModel()).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('getConfig()', () => {
    it('returns config without apiKey', () => {
      const result = provider.getConfig();
      expect(result.name).toBe('anthropic');
      expect(result.model).toBe('claude-sonnet-4-20250514');
      expect('apiKey' in result).toBe(false);
    });
  });

  describe('buildMessages()', () => {
    it('builds messages with system prompt', () => {
      const messages = provider.testBuildMessages({
        prompt: 'Hello',
        systemPrompt: 'You are helpful',
      });
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'system', content: 'You are helpful' });
      expect(messages[1]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('builds messages with chat history', () => {
      const messages = provider.testBuildMessages({
        prompt: 'Follow up',
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
        ],
      });
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('First response');
      expect(messages[2].content).toBe('Follow up');
    });

    it('handles prompt-only request', () => {
      const messages = provider.testBuildMessages({ prompt: 'Just a prompt' });
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: 'user', content: 'Just a prompt' });
    });

    it('handles empty request', () => {
      const messages = provider.testBuildMessages({});
      expect(messages).toHaveLength(0);
    });
  });

  describe('estimateCost()', () => {
    it('calculates cost using known model pricing', () => {
      const cost = provider.testEstimateCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
      // claude-sonnet-4: input=3.0, output=15.0 per 1M
      expect(cost).toBe(18.0);
    });

    it('uses fallback pricing for unknown models', () => {
      const unknownProvider = new TestProvider({ name: 'anthropic' as const, model: 'unknown-model' });
      const cost = unknownProvider.testEstimateCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
      // fallback: input=1.0, output=2.0 per 1M
      expect(cost).toBe(3.0);
    });

    it('returns 0 for zero token usage', () => {
      const cost = provider.testEstimateCost({ inputTokens: 0, outputTokens: 0 });
      expect(cost).toBe(0);
    });
  });
});

describe('PROVIDER_PRICING', () => {
  it('contains pricing for major models', () => {
    expect(PROVIDER_PRICING).toHaveProperty('claude-sonnet-4-20250514');
    expect(PROVIDER_PRICING).toHaveProperty('gpt-4o');
    expect(PROVIDER_PRICING).toHaveProperty('llama-3.3-70b-versatile');
    expect(PROVIDER_PRICING).toHaveProperty('gemini-2.0-flash');
  });

  it('all pricing entries have input and output fields', () => {
    for (const [model, pricing] of Object.entries(PROVIDER_PRICING)) {
      expect(pricing).toHaveProperty('input');
      expect(pricing).toHaveProperty('output');
      expect(typeof pricing.input).toBe('number');
      expect(typeof pricing.output).toBe('number');
      expect(pricing.input).toBeGreaterThanOrEqual(0);
      expect(pricing.output).toBeGreaterThanOrEqual(0);
    }
  });
});
