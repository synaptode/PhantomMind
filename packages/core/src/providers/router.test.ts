import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderRouter, createProvider } from './router.js';
import type { ProviderConfig, ProviderRouting, CompletionRequest, CompletionResponse, TokenUsage } from '../types.js';

// Mock all provider modules to avoid real API calls
vi.mock('./anthropic.js', () => ({
  AnthropicProvider: vi.fn().mockImplementation((config: ProviderConfig) => createMockProvider(config)),
}));
vi.mock('./openai.js', () => ({
  OpenAIProvider: vi.fn().mockImplementation((config: ProviderConfig) => createMockProvider(config)),
}));
vi.mock('./gemini.js', () => ({
  GeminiProvider: vi.fn().mockImplementation((config: ProviderConfig) => createMockProvider(config)),
}));
vi.mock('./groq.js', () => ({
  GroqProvider: vi.fn().mockImplementation((config: ProviderConfig) => createMockProvider(config)),
}));
vi.mock('./mistral.js', () => ({
  MistralProvider: vi.fn().mockImplementation((config: ProviderConfig) => createMockProvider(config)),
}));
vi.mock('./ollama.js', () => ({
  OllamaProvider: vi.fn().mockImplementation((config: ProviderConfig) => createMockProvider(config)),
}));
vi.mock('./deepseek.js', () => ({
  DeepSeekProvider: vi.fn().mockImplementation((config: ProviderConfig) => createMockProvider(config)),
}));
vi.mock('./openrouter.js', () => ({
  OpenRouterProvider: vi.fn().mockImplementation((config: ProviderConfig) => createMockProvider(config)),
}));

function mockUsage(): TokenUsage {
  return { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 };
}

function mockResponse(provider: string, model: string): CompletionResponse {
  return {
    content: `Response from ${provider}`,
    model,
    provider: provider as any,
    usage: mockUsage(),
    duration: 100,
  };
}

function createMockProvider(config: ProviderConfig) {
  return {
    providerName: config.name,
    getModel: () => config.model,
    getConfig: () => ({ name: config.name, model: config.model }),
    complete: vi.fn().mockResolvedValue(mockResponse(config.name, config.model)),
    stream: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue([config.model]),
  };
}

function makeRouting(overrides?: Partial<ProviderRouting>): ProviderRouting {
  return {
    primary: { name: 'anthropic', model: 'claude-sonnet-4-20250514', apiKey: 'test-key' },
    fallback: { name: 'openai', model: 'gpt-4o', apiKey: 'test-key' },
    budget: { name: 'groq', model: 'llama-3.3-70b-versatile', apiKey: 'test-key' },
    ...overrides,
  };
}

describe('ProviderRouter', () => {
  let router: ProviderRouter;
  const request: CompletionRequest = { prompt: 'Hello' };

  beforeEach(() => {
    router = new ProviderRouter(makeRouting());
  });

  describe('constructor', () => {
    it('initializes all configured providers', () => {
      expect(router.getSlotProvider('primary')).toBeDefined();
      expect(router.getSlotProvider('fallback')).toBeDefined();
      expect(router.getSlotProvider('budget')).toBeDefined();
    });

    it('handles missing optional providers', () => {
      const r = new ProviderRouter({ primary: { name: 'anthropic', model: 'claude-sonnet-4-20250514' } });
      expect(r.getSlotProvider('primary')).toBeDefined();
      expect(r.getSlotProvider('fallback')).toBeUndefined();
      expect(r.getSlotProvider('budget')).toBeUndefined();
    });
  });

  describe('complete()', () => {
    it('uses primary provider for normal requests', async () => {
      const result = await router.complete(request);
      expect(result.content).toContain('anthropic');
    });

    it('falls back to fallback provider on primary error', async () => {
      const primary = router.getSlotProvider('primary')!;
      (primary.complete as any).mockRejectedValueOnce(new Error('API 500'));

      const result = await router.complete(request);
      expect(result.content).toContain('openai');
    });

    it('falls back to budget provider when fallback also fails', async () => {
      const primary = router.getSlotProvider('primary')!;
      const fallback = router.getSlotProvider('fallback')!;
      (primary.complete as any).mockRejectedValueOnce(new Error('API 500'));
      (fallback.complete as any).mockRejectedValueOnce(new Error('API 500'));

      const result = await router.complete(request);
      expect(result.content).toContain('groq');
    });

    it('throws when all providers fail', async () => {
      const primary = router.getSlotProvider('primary')!;
      const fallback = router.getSlotProvider('fallback')!;
      const budget = router.getSlotProvider('budget')!;
      (primary.complete as any).mockRejectedValueOnce(new Error('fail'));
      (fallback.complete as any).mockRejectedValueOnce(new Error('fail'));
      (budget.complete as any).mockRejectedValueOnce(new Error('fail'));

      await expect(router.complete(request)).rejects.toThrow('fail');
    });

    it('throws when no primary provider configured', async () => {
      // Create a router then remove primary
      const r = new ProviderRouter(makeRouting());
      (r as any).providers.delete('primary');
      await expect(r.complete(request)).rejects.toThrow('No primary provider configured');
    });
  });

  describe('budget management', () => {
    it('tracks daily cost', async () => {
      await router.complete(request);
      expect(router.getDailyCost()).toBeGreaterThan(0);
    });

    it('routes to budget provider when threshold exceeded', async () => {
      const r = new ProviderRouter(makeRouting(), {
        maxCostPerDay: 0.001,
        warningAt: 50,
        fallbackOnBudget: 'budget',
      });

      // First call to accumulate cost
      await r.complete(request);
      // Second call should use budget provider
      const result = await r.complete(request);
      expect(result.content).toContain('groq');
    });

    it('emits budget:warning event when threshold reached', async () => {
      const r = new ProviderRouter(makeRouting(), {
        maxCostPerDay: 0.001,
        warningAt: 50,
      });

      const warnings: any[] = [];
      r.on('budget:warning', (data) => warnings.push(data));

      await r.complete(request);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
    });

    it('emits budget:exceeded event when cost exceeds max', async () => {
      const r = new ProviderRouter(makeRouting(), {
        maxCostPerDay: 0.0005,
        warningAt: 50,
      });

      const exceeded: any[] = [];
      r.on('budget:exceeded', (data) => exceeded.push(data));

      await r.complete(request);
      expect(exceeded.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getProvider()', () => {
    it('returns provider by slot name', () => {
      expect(router.getProvider('primary')).toBeDefined();
    });

    it('returns provider by provider name', () => {
      expect(router.getProvider('anthropic')).toBeDefined();
    });

    it('returns undefined for unknown name', () => {
      expect(router.getProvider('nonexistent')).toBeUndefined();
    });
  });

  describe('event emissions', () => {
    it('emits provider:request on complete', async () => {
      const events: any[] = [];
      router.on('provider:request', (data) => events.push(data));

      await router.complete(request);
      expect(events).toHaveLength(1);
      expect(events[0].provider).toBe('anthropic');
    });

    it('emits provider:response on success', async () => {
      const events: any[] = [];
      router.on('provider:response', (data) => events.push(data));

      await router.complete(request);
      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('usage');
    });

    it('emits provider:fallback on error', async () => {
      const primary = router.getSlotProvider('primary')!;
      (primary.complete as any).mockRejectedValueOnce(new Error('fail'));

      const events: any[] = [];
      router.on('provider:fallback', (data) => events.push(data));

      await router.complete(request);
      expect(events.some(e => e.reason === 'error')).toBe(true);
    });
  });
});

describe('createProvider()', () => {
  it('creates all supported provider types', () => {
    const providers: ProviderConfig['name'][] = [
      'anthropic', 'openai', 'gemini', 'groq', 'mistral', 'ollama', 'deepseek', 'openrouter',
    ];

    for (const name of providers) {
      const provider = createProvider({ name, model: 'test-model' });
      expect(provider).toBeDefined();
    }
  });

  it('throws for unsupported provider', () => {
    expect(() => createProvider({ name: 'invalid' as any, model: 'test' }))
      .toThrow('Unsupported provider');
  });
});
