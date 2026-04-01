import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnomalyDetector } from './anomaly.js';

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  describe('recordAction()', () => {
    it('records actions and makes them visible in metrics', () => {
      detector.recordAction('write_file', 'src/index.ts', true, 100);
      const metrics = detector.getMetrics();
      expect(metrics.fileAccessCounts['src/index.ts']).toBe(1);
      expect(metrics.tokenUsageHistory).toContain(100);
    });

    it('keeps tokenHistory bounded to 100 entries', () => {
      for (let i = 0; i < 150; i++) {
        detector.recordAction('read_file', undefined, true, i);
      }
      const metrics = detector.getMetrics();
      expect(metrics.tokenUsageHistory.length).toBeLessThanOrEqual(100);
    });

    it('prunes actions older than 2 windows and rebuilds fileAccessCounts', () => {
      const windowMs = 60_000;
      const now = Date.now();

      // Inject old records directly by manipulating time
      vi.useFakeTimers();

      // Record an action far in the past (3 windows ago)
      vi.setSystemTime(now - windowMs * 3);
      detector.recordAction('write_file', 'old-file.ts', true, 10);

      // Record a recent action — this should trigger pruning of the old one
      vi.setSystemTime(now);
      detector.recordAction('write_file', 'new-file.ts', true, 20);

      vi.useRealTimers();

      const metrics = detector.getMetrics();
      // old-file.ts should have been pruned from fileAccessCounts
      expect(metrics.fileAccessCounts['old-file.ts']).toBeUndefined();
      expect(metrics.fileAccessCounts['new-file.ts']).toBe(1);
    });

    it('does not prune entries within 2 windows', () => {
      detector.recordAction('write_file', 'recent.ts', true, 50);
      detector.recordAction('read_file', 'recent.ts', true, 30);
      const metrics = detector.getMetrics();
      expect(metrics.fileAccessCounts['recent.ts']).toBe(2);
    });
  });

  describe('check()', () => {
    it('returns no anomaly for normal activity', () => {
      detector.recordAction('write_file', 'src/a.ts', true, 100);
      detector.recordAction('read_file', 'src/b.ts', true, 80);
      const report = detector.check();
      expect(report.detected).toBe(false);
    });

    it('detects stuck-loop when same file accessed > 5 times in window', () => {
      for (let i = 0; i < 6; i++) {
        detector.recordAction('write_file', 'src/loop.ts', true, 100);
      }
      const report = detector.check();
      expect(report.detected).toBe(true);
      expect(report.type).toBe('stuck-loop');
      expect(report.description).toContain('src/loop.ts');
    });

    it('detects high-error-rate after 5 consecutive failures', () => {
      for (let i = 0; i < 5; i++) {
        detector.recordAction('write_file', `src/f${i}.ts`, false, 50);
      }
      const report = detector.check();
      expect(report.detected).toBe(true);
      expect(report.type).toBe('high-error-rate');
    });

    it('detects token spike when last usage is 3x average', () => {
      // 10 baseline entries at 100 tokens each, then a spike of 1000
      // avg = (10*100 + 1000) / 11 ≈ 181  →  threshold = 181 * 3 = 543  →  1000 > 543 ✓
      for (let i = 0; i < 10; i++) {
        detector.recordAction('write_file', `f${i}.ts`, true, 100);
      }
      detector.recordAction('write_file', 'spike.ts', true, 1000);
      const report = detector.check();
      expect(report.detected).toBe(true);
      expect(report.type).toBe('token-spike');
    });
  });

  describe('reset()', () => {
    it('clears all state', () => {
      detector.recordAction('write_file', 'src/a.ts', true, 100);
      detector.reset();
      const metrics = detector.getMetrics();
      expect(metrics.tokenUsageHistory).toHaveLength(0);
      expect(Object.keys(metrics.fileAccessCounts)).toHaveLength(0);
      const report = detector.check();
      expect(report.detected).toBe(false);
    });
  });
});
