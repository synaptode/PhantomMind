import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CostAnalyzer } from './cost-analyzer';

describe('CostAnalyzer', () => {
  let analyzer: CostAnalyzer;

  beforeEach(() => {
    analyzer = new CostAnalyzer({
      dailyLimit: 10.0,
      weeklyLimit: 50.0,
      monthlyLimit: 200.0,
      warningThreshold: 0.8,
      hardStop: false,
    });
  });

  describe('Cost Recording', () => {
    it('should record cost entries', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, true);
      const stats = analyzer.getStats();

      expect(stats.entriesCount).toBe(1);
      expect(stats.totalCost).toBeCloseTo(0.05, 2);
    });

    it('should track successful vs failed requests', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, false); // Failed

      const stats = analyzer.getStats();
      expect(stats.entriesCount).toBe(1); // Only successful counted
    });

    it('should prevent memory overflow', () => {
      // Record more than max size
      for (let i = 0; i < 101000; i++) {
        analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.01, true);
      }

      // Should keep only recent entries (100k)
      const entries = analyzer.exportEntries();
      expect(entries.length).toBeLessThanOrEqual(100000);
    });
  });

  describe('Period-based Costs', () => {
    it('should calculate daily costs', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 5.0, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 3.0, true);

      const today = analyzer.getCostToday();
      expect(today).toBeCloseTo(8.0, 2);
    });

    it('should only count today\'s costs', (done) => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 5.0, true);

      // Mock tomorrow
      vi.useFakeTimers();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      vi.setSystemTime(tomorrow);

      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 3.0, true);

      const today = analyzer.getCostToday();
      expect(today).toBeCloseTo(3.0, 2);

      vi.useRealTimers();
      done();
    });

    it('should calculate weekly costs', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 5.0, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 10.0, true);

      const week = analyzer.getCostThisWeek();
      expect(week).toBeCloseTo(15.0, 2);
    });

    it('should calculate monthly costs', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 50.0, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 30.0, true);

      const month = analyzer.getCostThisMonth();
      expect(month).toBeCloseTo(80.0, 2);
    });
  });

  describe('Budget Tracking', () => {
    it('should detect budget warning', () => {
      // 80% of $10 daily limit = $8
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 8.5, true);

      expect(analyzer.isBudgetWarning('daily')).toBe(true);
      expect(analyzer.isBudgetExceeded('daily')).toBe(false);
    });

    it('should detect budget exceeded', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 10.5, true);

      expect(analyzer.isBudgetExceeded('daily')).toBe(true);
    });

    it('should calculate remaining budget', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 3.0, true);

      const remaining = analyzer.getRemainingBudget('daily');
      expect(remaining).toBeCloseTo(7.0, 2); // $10 - $3
    });

    it('should return zero remaining budget when exceeded', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 15.0, true);

      const remaining = analyzer.getRemainingBudget('daily');
      expect(remaining).toBe(0);
    });

    it('should update budget configuration', () => {
      analyzer.setBudget({ dailyLimit: 20.0 });
      const budget = analyzer.getBudget();

      expect(budget.dailyLimit).toBe(20.0);
      expect(budget.weeklyLimit).toBe(50.0); // Unchanged
    });
  });

  describe('Cost Breakdown', () => {
    beforeEach(() => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.06, true);
      analyzer.recordCost('openai', 'gpt-4', 'completion', 100, 50, 0.08, true);
      analyzer.recordCost('groq', 'llama-3', 'completion', 100, 50, 0.01, true);
    });

    it('should break down costs by provider', () => {
      const byProvider = analyzer.getCostByProvider();

      expect(byProvider.length).toBeGreaterThan(0);
      expect(byProvider.some(s => s.provider === 'anthropic')).toBe(true);
      expect(byProvider.some(s => s.provider === 'openai')).toBe(true);
    });

    it('should calculate per-provider statistics', () => {
      const byProvider = analyzer.getCostByProvider();
      const anthropic = byProvider.find(s => s.provider === 'anthropic')!;

      expect(anthropic.entries).toBe(2);
      expect(anthropic.totalCostUSD).toBeCloseTo(0.11, 2);
      expect(anthropic.avgCostPerRequest).toBeCloseTo(0.055, 2);
    });

    it('should sort providers by cost descending', () => {
      const byProvider = analyzer.getCostByProvider();

      for (let i = 0; i < byProvider.length - 1; i++) {
        expect(byProvider[i].totalCostUSD).toBeGreaterThanOrEqual(byProvider[i + 1].totalCostUSD);
      }
    });

    it('should break down costs by task', () => {
      const byTask = analyzer.getCostByTask();

      expect(byTask['agent']).toBeDefined();
      expect(byTask['completion']).toBeDefined();
    });

    it('should calculate per-task statistics', () => {
      const byTask = analyzer.getCostByTask();

      expect(byTask['agent'].count).toBe(2);
      expect(byTask['agent'].cost).toBeCloseTo(0.11, 2);
      expect(byTask['completion'].count).toBe(2);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect cost anomalies', () => {
      // Normal costs
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.04, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, true);

      // Anomaly (much higher)
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 1000, 500, 50.0, true);

      const anomalies = analyzer.detectAnomalies(2); // 2 std dev threshold
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.costUSD === 50.0)).toBe(true);
    });

    it('should respect anomaly threshold', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 1.0, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 1.1, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.9, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 10.0, true);

      const anomalies1 = analyzer.detectAnomalies(1); // Stricter
      const anomalies2 = analyzer.detectAnomalies(3); // Lenient

      expect(anomalies1.length).toBeGreaterThanOrEqual(anomalies2.length);
    });

    it('should not detect anomalies when insufficient data', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, true);

      const anomalies = analyzer.detectAnomalies();
      expect(anomalies.length).toBe(0);
    });
  });

  describe('Trend Analysis', () => {
    it('should calculate monthly trend', () => {
      // Simulate last month costs
      vi.useFakeTimers();
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      vi.setSystemTime(lastMonth);

      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 50.0, true);

      // Simulate current month
      const thisMonth = new Date();
      vi.setSystemTime(thisMonth);

      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 75.0, true);

      const trend = analyzer.calculateTrend('monthly');
      expect(trend).toBeGreaterThan(0); // Positive trend (cost increased)

      vi.useRealTimers();
    });

    it('should return 0 trend when no previous data', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 10.0, true);

      const trend = analyzer.calculateTrend('daily');
      expect(trend).toBe(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, true);
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.06, true);
      analyzer.recordCost('openai', 'gpt-4', 'completion', 100, 50, 0.08, true);
    });

    it('should provide comprehensive stats', () => {
      const stats = analyzer.getStats();

      expect(stats.totalCost).toBeCloseTo(0.19, 2);
      expect(stats.entriesCount).toBe(3);
      expect(stats.avgCostPerEntry).toBeGreaterThan(0);
      expect(stats.topProvider).toBeDefined();
      expect(stats.topTask).toBeDefined();
    });

    it('should identify top provider', () => {
      const stats = analyzer.getStats();
      expect(['anthropic', 'openai']).toContain(stats.topProvider);
    });

    it('should handle empty stats', () => {
      const emptyAnalyzer = new CostAnalyzer();
      const stats = emptyAnalyzer.getStats();

      expect(stats.totalCost).toBe(0);
      expect(stats.entriesCount).toBe(0);
    });
  });

  describe('Serialization', () => {
    it('should export entries', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, true);
      analyzer.recordCost('openai', 'gpt-4', 'completion', 100, 50, 0.08, true);

      const exported = analyzer.exportEntries();
      expect(exported).toHaveLength(2);
      expect(exported[0]).toHaveProperty('provider');
      expect(exported[0]).toHaveProperty('costUSD');
    });

    it('should import entries', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 0.05, true);
      const exported = analyzer.exportEntries();

      const newAnalyzer = new CostAnalyzer();
      newAnalyzer.importEntries(exported);

      const stats = newAnalyzer.getStats();
      expect(stats.entriesCount).toBe(1);
      expect(stats.totalCost).toBeCloseTo(0.05, 2);
    });
  });

  describe('Formatting', () => {
    it('should format cost report', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 5.0, true);

      const report = analyzer.formatReport();
      expect(report).toContain('Cost Analysis Report');
      expect(report).toContain('Period Costs');
      expect(report).toContain('Metrics');
    });

    it('should include warnings in report', () => {
      analyzer.recordCost('anthropic', 'claude-3', 'agent', 100, 50, 8.5, true);

      const report = analyzer.formatReport();
      expect(report).toContain('warning');
    });
  });
});
