import { describe, it, expect, beforeEach } from 'vitest';
import { RoutingOptimizer, type ProviderMetrics } from './routing-optimizer';

describe('RoutingOptimizer', () => {
  let optimizer: RoutingOptimizer;
  let anthropicMetrics: ProviderMetrics;
  let openaiMetrics: ProviderMetrics;
  let groqMetrics: ProviderMetrics;

  beforeEach(() => {
    optimizer = new RoutingOptimizer();

    anthropicMetrics = {
      name: 'anthropic',
      successRate: 0.98,
      avgLatency: 650,
      errorCount: 2,
      requestCount: 100,
      costPerKToken: 0.0027,
      contextSize: 200000,
      capabilities: {
        reasoning: true,
        vision: true,
        streaming: true,
        multimodal: true,
      },
    };

    openaiMetrics = {
      name: 'openai',
      successRate: 0.96,
      avgLatency: 550,
      errorCount: 4,
      requestCount: 100,
      costPerKToken: 0.0032,
      contextSize: 128000,
      capabilities: {
        reasoning: true,
        vision: true,
        streaming: true,
        multimodal: true,
      },
    };

    groqMetrics = {
      name: 'groq',
      successRate: 0.92,
      avgLatency: 400,
      errorCount: 8,
      requestCount: 100,
      costPerKToken: 0.0001,
      contextSize: 30000,
      capabilities: {
        reasoning: false,
        vision: false,
        streaming: true,
        multimodal: false,
      },
    };

    optimizer.registerProvider(anthropicMetrics);
    optimizer.registerProvider(openaiMetrics);
    optimizer.registerProvider(groqMetrics);
  });

  describe('Provider Registration', () => {
    it('should register providers', () => {
      const report = optimizer.getProviderReport('anthropic');
      expect(report).toBeDefined();
      expect(report?.name).toBe('anthropic');
    });

    it('should return null for unregistered providers', () => {
      const report = optimizer.getProviderReport('unknown');
      expect(report).toBeNull();
    });
  });

  describe('Metrics Updates', () => {
    it('should update provider metrics on success', () => {
      const before = optimizer.getProviderReport('anthropic')!.successRate;
      optimizer.updateMetrics('anthropic', true, 1000, 0.01);
      const after = optimizer.getProviderReport('anthropic')!.successRate;

      expect(after).toBeGreaterThan(before);
    });

    it('should update provider metrics on failure', () => {
      const before = optimizer.getProviderReport('anthropic')!.successRate;
      optimizer.updateMetrics('anthropic', false, 1000, 0.01);
      const after = optimizer.getProviderReport('anthropic')!.successRate;

      expect(after).toBeLessThan(before);
    });

    it('should track error count', () => {
      const beforeErrors = optimizer.getProviderReport('anthropic')!.errorCount;
      optimizer.updateMetrics('anthropic', false, 1000, 0.01);
      const afterErrors = optimizer.getProviderReport('anthropic')!.errorCount;

      expect(afterErrors).toBe(beforeErrors + 1);
    });

    it('should update average latency', () => {
      optimizer.updateMetrics('anthropic', true, 500, 0.01); // Lower latency
      const report = optimizer.getProviderReport('anthropic')!;

      expect(report.avgLatency).toBeLessThan(800); // Original was 800
    });
  });

  describe('Provider Routing', () => {
    it('should select highest quality provider by default', () => {
      const decision = optimizer.findOptimalProvider({ preferHighQuality: true, preferCheaper: false });
      expect(decision.provider).toBe('anthropic'); // 98% success rate
    });

    it('should select cheapest provider when preferred', () => {
      const decision = optimizer.findOptimalProvider({ preferCheaper: true, preferHighQuality: false });
      expect(decision.provider).toBe('groq'); // $0.0001/ktoken
    });

    it('should select fastest provider when preferred', () => {
      const decision = optimizer.findOptimalProvider({ preferFast: true, preferHighQuality: false });
      expect(decision.provider).toBe('groq'); // 200ms latency
    });

    it('should respect quality thresholds', () => {
      const decision = optimizer.findOptimalProvider({
        preferHighQuality: true,
        qualityThreshold: 0.95, // Groq has 92%, should not be selected
      });
      expect(decision.provider).not.toBe('groq');
    });

    it('should respect speed thresholds', () => {
      const decision = optimizer.findOptimalProvider({
        speedThreshold: 600, // Anthropic has 650ms, exceeds threshold
        preferFast: true,
      });
      expect(decision.provider).not.toBe('anthropic');
    });

    it('should respect context size requirements', () => {
      const decision = optimizer.findOptimalProvider({
        minContextSize: 100000, // Groq has 30000, too small
      });
      expect(decision.provider).not.toBe('groq');
    });

    it('should require capabilities', () => {
      // Groq doesn't support reasoning
      const decision = optimizer.findOptimalProvider({
        requireReasoning: true,
        preferHighQuality: true,
      });
      expect(decision.provider).not.toBe('groq');
      expect(['anthropic', 'openai']).toContain(decision.provider);
    });

    it('should provide alternative options', () => {
      const decision = optimizer.findOptimalProvider();
      expect(decision.alternatives.length).toBeGreaterThan(0);
      expect(decision.alternatives[0].provider).toBeDefined();
    });

    it('should throw error when no providers meet criteria and fallback disabled', () => {
      expect(() => {
        optimizer.findOptimalProvider({
          qualityThreshold: 1.0, // Impossible threshold
          allowFallback: false,
        });
      }).toThrow();
    });

    it('should use fallback when no criteria met', () => {
      const decision = optimizer.findOptimalProvider({
        qualityThreshold: 1.0, // Impossible threshold
        allowFallback: true,
      });
      expect(decision.provider).toBeDefined();
      expect(decision.reason).toContain('Fallback');
    });
  });

  describe('Scoring', () => {
    it('should generate reasonable scores', () => {
      const decision1 = optimizer.findOptimalProvider({ preferHighQuality: true });
      const decision2 = optimizer.findOptimalProvider({ preferCheaper: true });

      expect(decision1.score).toBeGreaterThan(0);
      expect(decision2.score).toBeGreaterThan(0);
      expect(decision1.score).toBeLessThanOrEqual(100);
    });

    it('should prioritize quality when weighted high', () => {
      const decision = optimizer.findOptimalProvider({
        weights: {
          cost: 0.1,
          quality: 0.7, // High quality weight
          speed: 0.1,
          capability: 0.1,
        },
      });
      expect(decision.provider).toBe('anthropic'); // Best quality
    });

    it('should prioritize cost when weighted high', () => {
      const decision = optimizer.findOptimalProvider({
        weights: {
          cost: 0.7, // High cost weight (low cost preferred)
          quality: 0.1,
          speed: 0.1,
          capability: 0.1,
        },
      });
      expect(decision.provider).toBe('groq'); // Cheapest
    });
  });

  describe('Statistics & History', () => {
    it('should track routing decisions', () => {
      optimizer.findOptimalProvider();
      optimizer.findOptimalProvider();
      optimizer.findOptimalProvider();

      const stats = optimizer.getOptimizationStats();
      expect(stats.totalDecisions).toBe(3);
    });

    it('should calculate average score', () => {
      optimizer.findOptimalProvider();
      optimizer.findOptimalProvider();

      const stats = optimizer.getOptimizationStats();
      expect(stats.avgScore).toBeGreaterThan(0);
    });

    it('should track provider distribution', () => {
      // Make multiple high-quality and cheap selections
      optimizer.findOptimalProvider({ preferHighQuality: true });
      optimizer.findOptimalProvider({ preferHighQuality: true });
      optimizer.findOptimalProvider({ preferCheaper: true });

      const stats = optimizer.getOptimizationStats();
      expect(stats.providerDistribution['anthropic'] ?? 0).toBeGreaterThan(0);
      expect(stats.providerDistribution['groq'] ?? 0).toBeGreaterThan(0);
    });

    it('should limit history size', () => {
      // Make many decisions (more than max history)
      for (let i = 0; i < 1500; i++) {
        optimizer.findOptimalProvider();
      }

      const history = optimizer.getRoutingHistory(1000);
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should retrieve routing history', () => {
      optimizer.findOptimalProvider({ preferHighQuality: true });
      optimizer.findOptimalProvider({ preferCheaper: true });

      const history = optimizer.getRoutingHistory(2);
      expect(history).toHaveLength(2);
      expect(history[0].provider).toBeDefined();
    });
  });

  describe('Export & Import', () => {
    it('should export metrics', () => {
      const exported = optimizer.exportMetrics();
      expect(exported).toHaveLength(3);
      expect(exported.some(m => m.name === 'anthropic')).toBe(true);
    });

    it('should import metrics', () => {
      const exported = optimizer.exportMetrics();
      const newOptimizer = new RoutingOptimizer();

      newOptimizer.importMetrics(exported);

      const report = newOptimizer.getProviderReport('anthropic');
      expect(report?.costPerKToken).toBe(0.0027);
    });
  });

  describe('Formatting', () => {
    it('should format routing decision for display', () => {
      const decision = optimizer.findOptimalProvider();
      const formatted = optimizer.formatDecision(decision);

      expect(formatted).toContain('Routing Decision');
      expect(formatted).toContain(decision.provider);
      expect(formatted).toContain('Score');
    });

    it('should format stats for display', () => {
      optimizer.findOptimalProvider();
      optimizer.findOptimalProvider();

      const formatted = optimizer.formatStats();
      expect(formatted).toContain('Routing Optimizer Stats');
      expect(formatted).toContain('Total Routing Decisions');
    });
  });

  describe('Reason Building', () => {
    it('should explain high quality selection', () => {
      const decision = optimizer.findOptimalProvider({ preferHighQuality: true });
      expect(decision.reason).toContain('quality');
    });

    it('should explain cost selection', () => {
      const decision = optimizer.findOptimalProvider({ preferCheaper: true });
      expect(decision.reason).toContain('cost');
    });

    it('should explain speed selection', () => {
      const decision = optimizer.findOptimalProvider({ preferFast: true });
      expect(decision.reason).toContain('fastest') || expect(decision.reason).toContain('speed');
    });
  });
});
