/**
 * PhantomMindAI — Anomaly Detector
 * Real-time monitoring of agent behavior to detect stuck loops, thrashing, etc.
 */

import type { AnomalyReport, AnomalyMetrics } from '../types.js';

interface ActionRecord {
  action: string;
  file?: string;
  timestamp: number;
  success: boolean;
  tokenUsage: number;
}

export class AnomalyDetector {
  private actions: ActionRecord[] = [];
  private fileAccessCounts: Map<string, number> = new Map();
  private tokenHistory: number[] = [];
  private windowMs = 60000; // 60 second window

  // Thresholds
  private maxFileAccess = 5;
  private maxStepsWithoutProgress = 10;
  private maxErrorRate = 0.5;
  private tokenSpikeMultiplier = 3.0;

  /**
   * Record an agent action
   */
  recordAction(action: string, file: string | undefined, success: boolean, tokenUsage: number): void {
    const record: ActionRecord = {
      action,
      file,
      timestamp: Date.now(),
      success,
      tokenUsage,
    };

    this.actions.push(record);
    this.tokenHistory.push(tokenUsage);

    if (file) {
      this.fileAccessCounts.set(file, (this.fileAccessCounts.get(file) ?? 0) + 1);
    }
  }

  /**
   * Check for anomalies in recent behavior
   */
  check(): AnomalyReport {
    const metrics = this.getMetrics();

    // Check: Same file accessed >5 times in 60s
    const now = Date.now();
    const recentActions = this.actions.filter(a => now - a.timestamp < this.windowMs);
    const recentFileAccess: Map<string, number> = new Map();
    for (const action of recentActions) {
      if (action.file) {
        recentFileAccess.set(action.file, (recentFileAccess.get(action.file) ?? 0) + 1);
      }
    }

    for (const [file, count] of recentFileAccess) {
      if (count > this.maxFileAccess) {
        return {
          detected: true,
          type: 'stuck-loop',
          description: `File "${file}" accessed ${count} times in the last 60 seconds. Agent may be stuck in a loop.`,
          metrics,
        };
      }
    }

    // Check: No progress after N steps
    if (metrics.stepsWithoutProgress > this.maxStepsWithoutProgress) {
      return {
        detected: true,
        type: 'no-progress',
        description: `No measurable progress after ${metrics.stepsWithoutProgress} steps. Agent may be stuck.`,
        metrics,
      };
    }

    // Check: High error rate
    if (this.actions.length >= 5 && metrics.errorRate > this.maxErrorRate) {
      return {
        detected: true,
        type: 'high-error-rate',
        description: `Error rate is ${(metrics.errorRate * 100).toFixed(0)}% in the last 5 actions. Agent may be failing.`,
        metrics,
      };
    }

    // Check: Token usage spike
    if (this.tokenHistory.length >= 3 && metrics.averageTokenUsage > 0) {
      const lastUsage = this.tokenHistory[this.tokenHistory.length - 1];
      if (lastUsage > metrics.averageTokenUsage * this.tokenSpikeMultiplier) {
        return {
          detected: true,
          type: 'token-spike',
          description: `Token usage spike: ${lastUsage} tokens (avg: ${metrics.averageTokenUsage.toFixed(0)}). Possible runaway prompt.`,
          metrics,
        };
      }
    }

    return { detected: false, metrics };
  }

  /**
   * Get current metrics
   */
  getMetrics(): AnomalyMetrics {
    const last5 = this.actions.slice(-5);
    const errorRate = last5.length > 0
      ? last5.filter(a => !a.success).length / last5.length
      : 0;

    const avgTokens = this.tokenHistory.length > 0
      ? this.tokenHistory.reduce((a, b) => a + b, 0) / this.tokenHistory.length
      : 0;

    // Compute steps without progress (consecutive failed or no-op steps)
    let stepsWithoutProgress = 0;
    for (let i = this.actions.length - 1; i >= 0; i--) {
      if (!this.actions[i].success || this.actions[i].action === 'read_file') {
        stepsWithoutProgress++;
      } else {
        break;
      }
    }

    return {
      fileAccessCounts: Object.fromEntries(this.fileAccessCounts),
      stepsWithoutProgress,
      errorRate,
      tokenUsageHistory: this.tokenHistory.slice(-20),
      averageTokenUsage: avgTokens,
    };
  }

  /**
   * Reset metrics (e.g., after human intervention)
   */
  reset(): void {
    this.actions = [];
    this.fileAccessCounts.clear();
    this.tokenHistory = [];
  }
}
