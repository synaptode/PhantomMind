import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DualVerifier } from './dual-verifier.js';
import type { ProviderRouter } from '../providers/router.js';
import type { ContextEngine } from '../context/engine.js';
import type { PhantomConfig, CompletionResponse, TokenUsage } from '../types.js';

function mockUsage(): TokenUsage {
  return { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 };
}

function makeApprovedResponse(): CompletionResponse {
  return {
    content: JSON.stringify({ approved: true, issues: [] }),
    model: 'gpt-4o',
    provider: 'openai',
    usage: mockUsage(),
    duration: 120,
  };
}

function makeRejectedResponse(): CompletionResponse {
  return {
    content: JSON.stringify({
      approved: false,
      issues: [
        {
          severity: 'error',
          category: 'security',
          description: 'Potential SQL injection',
          suggestion: 'Use parameterized queries',
        },
      ],
    }),
    model: 'gpt-4o',
    provider: 'openai',
    usage: mockUsage(),
    duration: 130,
  };
}

function makeRouter(providerReturn: CompletionResponse | null): Partial<ProviderRouter> {
  const mockProvider = providerReturn
    ? {
        complete: vi.fn().mockResolvedValue(providerReturn),
        isAvailable: vi.fn().mockResolvedValue(true),
      }
    : null;

  return {
    getProvider: vi.fn().mockReturnValue(mockProvider),
    getSlotProvider: vi.fn().mockReturnValue(mockProvider),
  };
}

function makeContextEngine(): Partial<ContextEngine> {
  return {
    getProjectContext: vi.fn().mockResolvedValue({
      layers: [{ type: 'skills', content: '# Skills\nUse TypeScript.', relevanceScore: 1 }],
    }),
  };
}

function makePhantomConfig(overrides: Partial<PhantomConfig['quality']> = {}): PhantomConfig {
  return {
    adapters: ['copilot'],
    providers: { primary: { name: 'openai', model: 'gpt-4o', apiKey: 'test' } },
    quality: {
      dualVerification: true,
      dualVerificationProvider: 'openai',
      secretScanning: true,
      hallucinationGuard: true,
      ...overrides,
    },
    context: {
      skills: '.phantomind/SKILLS.md',
      rules: '.phantomind/RULES.md',
      schema: '.phantomind/schema.json',
      prds: '.phantomind/prds',
      decisions: '.phantomind/decisions',
    },
  } as PhantomConfig;
}

describe('DualVerifier', () => {
  let verifier: DualVerifier;

  describe('verify() — provider available', () => {
    beforeEach(() => {
      verifier = new DualVerifier(
        makeRouter(makeApprovedResponse()) as ProviderRouter,
        makeContextEngine() as ContextEngine,
        makePhantomConfig(),
      );
    });

    it('returns approved=true when provider approves content', async () => {
      const result = await verifier.verify('const x = 1;', 'implement counter');
      expect(result.approved).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('includes provider name in result', async () => {
      const result = await verifier.verify('const x = 1;', 'implement counter');
      expect(result.provider).toBe('openai');
    });

    it('includes cost in result', async () => {
      const result = await verifier.verify('const x = 1;', 'implement counter');
      expect(result.cost.totalTokens).toBe(150);
    });
  });

  describe('verify() — provider rejects content', () => {
    beforeEach(() => {
      verifier = new DualVerifier(
        makeRouter(makeRejectedResponse()) as ProviderRouter,
        makeContextEngine() as ContextEngine,
        makePhantomConfig(),
      );
    });

    it('returns approved=false with issues when provider rejects', async () => {
      const result = await verifier.verify('SELECT * FROM users WHERE id=' + "' OR 1=1'", 'query users');
      expect(result.approved).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].severity).toBe('error');
      expect(result.issues[0].category).toBe('security');
    });
  });

  describe('verify() — provider not available', () => {
    beforeEach(() => {
      verifier = new DualVerifier(
        makeRouter(null) as ProviderRouter,
        makeContextEngine() as ContextEngine,
        makePhantomConfig(),
      );
    });

    it('gracefully skips when provider is unavailable', async () => {
      const result = await verifier.verify('const x = 1;', 'implement counter');
      expect(result.approved).toBe(true);
      expect(result.issues[0].severity).toBe('info');
      expect(result.issues[0].description).toContain('not available');
    });
  });

  describe('verify() — provider throws error', () => {
    beforeEach(() => {
      const errorProvider = {
        complete: vi.fn().mockRejectedValue(new Error('Network timeout')),
        isAvailable: vi.fn().mockResolvedValue(true),
      };
      const router: Partial<ProviderRouter> = {
        getProvider: vi.fn().mockReturnValue(errorProvider),
        getSlotProvider: vi.fn().mockReturnValue(errorProvider),
      };
      verifier = new DualVerifier(
        router as ProviderRouter,
        makeContextEngine() as ContextEngine,
        makePhantomConfig(),
      );
    });

    it('falls back gracefully when provider throws', async () => {
      const result = await verifier.verify('const x = 1;', 'implement counter');
      expect(result.approved).toBe(true);
      expect(result.issues[0].description).toContain('Network timeout');
    });
  });

  describe('verify() — malformed JSON response', () => {
    beforeEach(() => {
      const badProvider = {
        complete: vi.fn().mockResolvedValue({
          content: 'This is not JSON at all',
          model: 'gpt-4o',
          provider: 'openai',
          usage: mockUsage(),
          duration: 100,
        }),
        isAvailable: vi.fn().mockResolvedValue(true),
      };
      const router: Partial<ProviderRouter> = {
        getProvider: vi.fn().mockReturnValue(badProvider),
        getSlotProvider: vi.fn().mockReturnValue(badProvider),
      };
      verifier = new DualVerifier(
        router as ProviderRouter,
        makeContextEngine() as ContextEngine,
        makePhantomConfig(),
      );
    });

    it('defaults to approved=true when JSON parse fails', async () => {
      const result = await verifier.verify('const x = 1;', 'implement counter');
      expect(result.approved).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});
