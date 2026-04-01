import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryIntelligence } from './retry.js';
import type { CompletionRequest, CompletionResponse, TokenUsage } from '../types.js';

function mockUsage(): TokenUsage {
  return { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 };
}

function mockResponse(content = 'ok'): CompletionResponse {
  return {
    content,
    model: 'test-model',
    provider: 'anthropic',
    usage: mockUsage(),
    duration: 100,
  };
}

function createMockRouter(completeFn: (...args: any[]) => any) {
  return { complete: completeFn } as any;
}

function createMockContextEngine() {
  return {
    getProjectContext: vi.fn().mockResolvedValue({
      layers: [{ content: 'project context' }],
      totalTokens: 100,
      truncated: false,
    }),
  } as any;
}

describe('RetryIntelligence', () => {
  const request: CompletionRequest = { prompt: 'Hello' };

  describe('execute() - success on first attempt', () => {
    it('returns success without retry', async () => {
      const router = createMockRouter(vi.fn().mockResolvedValue(mockResponse()));
      const retry = new RetryIntelligence(router, createMockContextEngine());

      const result = await retry.execute(request);
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.response?.content).toBe('ok');
    });
  });

  describe('execute() - retry on failure', () => {
    it('retries and succeeds on second attempt', async () => {
      const completeFn = vi.fn()
        .mockRejectedValueOnce(new Error('API 500'))
        .mockResolvedValue(mockResponse('retry success'));

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      const result = await retry.execute(request);
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('fails after max retries exhausted', async () => {
      const completeFn = vi.fn().mockRejectedValue(new Error('persistent failure'));
      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine(), 2);

      const result = await retry.execute(request);
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // initial + 2 retries
      expect(result.error).toContain('persistent failure');
    });
  });

  describe('strategy selection', () => {
    it('selects switch-provider for rate limit errors', async () => {
      const completeFn = vi.fn()
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockResolvedValue(mockResponse());

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      const result = await retry.execute(request);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('switch-provider');
    });

    it('selects switch-provider for 429 errors', async () => {
      const completeFn = vi.fn()
        .mockRejectedValueOnce(new Error('HTTP 429 Too Many Requests'))
        .mockResolvedValue(mockResponse());

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      const result = await retry.execute(request);
      expect(result.strategy).toBe('switch-provider');
    });

    it('selects decompose for token limit errors', async () => {
      const completeFn = vi.fn()
        .mockRejectedValueOnce(new Error('context length exceeded'))
        .mockResolvedValue(mockResponse());

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      const result = await retry.execute(request);
      expect(result.strategy).toBe('decompose');
    });

    it('selects add-schema for JSON parse errors', async () => {
      const completeFn = vi.fn()
        .mockRejectedValueOnce(new Error('Invalid JSON response'))
        .mockResolvedValue(mockResponse());

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      const result = await retry.execute(request);
      expect(result.strategy).toBe('add-schema');
    });

    it('selects add-grounding for hallucination errors', async () => {
      const completeFn = vi.fn()
        .mockRejectedValueOnce(new Error('hallucination detected'))
        .mockResolvedValue(mockResponse());

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      const result = await retry.execute(request);
      expect(result.strategy).toBe('add-grounding');
    });

    it('escalates when all strategies are exhausted', async () => {
      const completeFn = vi.fn().mockRejectedValue(new Error('unknown error'));
      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine(), 5);

      const result = await retry.execute(request);
      expect(result.success).toBe(false);
      expect(result.strategy).toBe('escalate');
    });

    it('cycles through strategies in order for generic errors', async () => {
      const strategies: string[] = [];
      const completeFn = vi.fn().mockRejectedValue(new Error('generic error'));
      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine(), 5);

      const result = await retry.execute(request);
      // After all 5 strategies exhausted, the last should be escalate
      expect(result.strategy).toBe('escalate');
      expect(result.success).toBe(false);
    });
  });

  describe('strategy application', () => {
    it('decompose strategy reduces max tokens', async () => {
      const calls: CompletionRequest[] = [];
      const completeFn = vi.fn().mockImplementation((req: CompletionRequest) => {
        calls.push(req);
        if (calls.length === 1) throw new Error('token limit');
        return mockResponse();
      });

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      await retry.execute({ ...request, maxTokens: 4000 });
      expect(calls.length).toBe(2);
      // The decomposed request should have lower maxTokens
      expect(calls[1].maxTokens!).toBeLessThan(4000);
    });

    it('add-schema strategy lowers temperature', async () => {
      const calls: CompletionRequest[] = [];
      const completeFn = vi.fn().mockImplementation((req: CompletionRequest) => {
        calls.push(req);
        if (calls.length === 1) throw new Error('invalid json format');
        return mockResponse();
      });

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      await retry.execute({ ...request, temperature: 0.7 });
      expect(calls[1].temperature!).toBeLessThan(0.7);
    });

    it('add-grounding strategy adds context to system prompt', async () => {
      const calls: CompletionRequest[] = [];
      const completeFn = vi.fn().mockImplementation((req: CompletionRequest) => {
        calls.push(req);
        if (calls.length === 1) throw new Error('hallucination detected');
        return mockResponse();
      });

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      await retry.execute(request);
      expect(calls[1].systemPrompt).toContain('Grounding Context');
    });

    it('escalate strategy adds error context to prompt', async () => {
      // Force all strategies to be used except escalate, then hit escalate
      const calls: CompletionRequest[] = [];
      let callCount = 0;
      const completeFn = vi.fn().mockImplementation((req: CompletionRequest) => {
        calls.push(req);
        callCount++;
        if (callCount <= 5) throw new Error('error');
        return mockResponse();
      });

      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine(), 5);

      await retry.execute(request);
      // The last request before success should have error context
      const lastRetryReq = calls[calls.length - 1];
      if (lastRetryReq.systemPrompt) {
        expect(lastRetryReq.systemPrompt).toContain('Previous attempt failed');
      }
    });
  });

  describe('max retries configuration', () => {
    it('respects custom max retries', async () => {
      const completeFn = vi.fn().mockRejectedValue(new Error('fail'));
      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine(), 1);

      const result = await retry.execute(request);
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2); // initial + 1 retry
    });

    it('defaults to 5 max retries', async () => {
      const completeFn = vi.fn().mockRejectedValue(new Error('fail'));
      const router = createMockRouter(completeFn);
      const retry = new RetryIntelligence(router, createMockContextEngine());

      const result = await retry.execute(request);
      expect(result.attempts).toBe(6); // initial + 5 retries
    });
  });
});
