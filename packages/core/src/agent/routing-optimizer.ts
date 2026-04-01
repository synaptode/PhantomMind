/**
 * Provider Routing Optimizer
 * Intelligently routes requests to optimal provider based on:
 * - Cost vs quality trade-offs
 * - Provider availability & reliability
 * - Model capabilities (context size, reasoning, etc.)
 * - Performance metrics (latency, error rates)
 */

export interface ProviderMetrics {
  name: string;
  successRate: number; // 0-1
  avgLatency: number; // milliseconds
  errorCount: number;
  requestCount: number;
  costPerKToken: number; // input cost
  contextSize: number; // max tokens
  capabilities: {
    reasoning: boolean;
    vision: boolean;
    streaming: boolean;
    multimodal: boolean;
  };
}

export interface RoutingStrategy {
  // Cost optimization
  costThreshold?: number; // Max cost per request (USD)
  preferCheaper: boolean;

  // Quality optimization  
  qualityThreshold?: number; // Min success rate (0-1)
  preferHighQuality: boolean;

  // Speed optimization
  speedThreshold?: number; // Max latency (ms)
  preferFast: boolean;

  // Context requirements
  minContextSize?: number; // Tokens needed
  requireReasoning?: boolean;
  requireVision?: boolean;
  requireStreaming?: boolean;

  // Weighted scoring
  weights?: {
    cost: number; // 0-1
    quality: number; // 0-1
    speed: number; // 0-1
    capability: number; // 0-1
  };

  // Fallback behavior
  allowFallback: boolean;
  maxRetries: number;
}

export interface RoutingDecision {
  provider: string;
  model: string;
  reason: string;
  score: number;
  alternatives: Array<{ provider: string; score: number }>;
}

/**
 * Provider Routing Optimizer
 * Makes intelligent provider selection decisions for LLM requests
 */
export class RoutingOptimizer {
  private metrics: Map<string, ProviderMetrics> = new Map();
  private routingHistory: RoutingDecision[] = [];
  private maxHistorySize: number = 1000;

  constructor(
    private defaultStrategy: RoutingStrategy = {
      preferCheaper: false,
      preferHighQuality: false,
      preferFast: false,
      allowFallback: true,
      maxRetries: 2,
    },
  ) {}

  /**
   * Register provider metrics
   */
  registerProvider(metrics: ProviderMetrics): void {
    this.metrics.set(metrics.name, metrics);
  }

  /**
   * Update provider metrics after a request
   */
  updateMetrics(providerName: string, success: boolean, latency: number, cost: number): void {
    const metrics = this.metrics.get(providerName);
    if (!metrics) return;

    metrics.requestCount++;
    metrics.avgLatency = (metrics.avgLatency * (metrics.requestCount - 1) + latency) / metrics.requestCount;

    if (success) {
      metrics.successRate = (metrics.successRate * (metrics.requestCount - 1) + 1) / metrics.requestCount;
    } else {
      metrics.errorCount++;
      metrics.successRate = (metrics.successRate * (metrics.requestCount - 1) + 0) / metrics.requestCount;
    }

    this.metrics.set(providerName, metrics);
  }

  /**
   * Calculate provider score (0-100)
   */
  private calculateScore(metrics: ProviderMetrics, strategy: RoutingStrategy): number {
    let weights = strategy.weights ?? {
      cost: 0.3,
      quality: 0.4,
      speed: 0.2,
      capability: 0.1,
    };

    // Adjust weights based on preferences if not explicitly provided
    if (!strategy.weights) {
      if (strategy.preferHighQuality) {
        weights = { cost: 0.1, quality: 0.7, speed: 0.1, capability: 0.1 };
      } else if (strategy.preferCheaper) {
        weights = { cost: 0.7, quality: 0.1, speed: 0.1, capability: 0.1 };
      } else if (strategy.preferFast) {
        weights = { cost: 0.1, quality: 0.1, speed: 0.7, capability: 0.1 };
      }
    }

    // Normalize scores to 0-100 range
    // Quality score (success rate, 0-100)
    const qualityScore = metrics.successRate * 100;

    // Speed score (lower latency is better, capped at 2000ms = 0)
    const speedScore = Math.max(0, 100 - (metrics.avgLatency / 2000) * 100);

    // Cost score (lower is better; cap at $0.01/ktoken = 0)
    const costScore = Math.max(0, 100 - (metrics.costPerKToken / 0.01) * 100);

    // Capability score (sum of binary capabilities)
    let capabilityScore = 0;
    let capabilityCount = 0;
    if (strategy.requireReasoning) {
      capabilityScore += metrics.capabilities.reasoning ? 100 : 0;
      capabilityCount++;
    }
    if (strategy.requireVision) {
      capabilityScore += metrics.capabilities.vision ? 100 : 0;
      capabilityCount++;
    }
    if (strategy.requireStreaming) {
      capabilityScore += metrics.capabilities.streaming ? 100 : 0;
      capabilityCount++;
    }
    if (capabilityCount === 0) {
      capabilityScore = 100; // If no specific capabilities required, full score
    } else {
      capabilityScore = capabilityScore / capabilityCount;
    }

    // Apply hard requirement filters (capabilities)
    if (strategy.requireReasoning && !metrics.capabilities.reasoning) return -1;
    if (strategy.requireVision && !metrics.capabilities.vision) return -1;
    if (strategy.requireStreaming && !metrics.capabilities.streaming) return -1;

    // Apply threshold filters
    if (strategy.qualityThreshold && metrics.successRate < strategy.qualityThreshold) return -1;
    if (strategy.speedThreshold && metrics.avgLatency > strategy.speedThreshold) return -1;
    if (strategy.minContextSize && metrics.contextSize < strategy.minContextSize) return -1;

    // Normalize weights to sum to 1.0 if needed
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const normalizedWeights = {
      cost: weights.cost / totalWeight,
      quality: weights.quality / totalWeight,
      speed: weights.speed / totalWeight,
      capability: weights.capability / totalWeight,
    };

    // Weighted combination (0-100)
    const score =
      costScore * normalizedWeights.cost +
      qualityScore * normalizedWeights.quality +
      speedScore * normalizedWeights.speed +
      capabilityScore * normalizedWeights.capability;

    return score;
  }

  /**
   * Find optimal provider for a request
   */
  findOptimalProvider(strategy?: RoutingStrategy): RoutingDecision {
    const effectiveStrategy = { ...this.defaultStrategy, ...strategy };
    const candidates = Array.from(this.metrics.values());

    if (candidates.length === 0) {
      throw new Error('No providers registered');
    }

    // Score all providers
    const scored = candidates
      .map(metrics => ({
        metrics,
        score: this.calculateScore(metrics, effectiveStrategy),
      }))
      .filter(item => item.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      if (!effectiveStrategy.allowFallback) {
        throw new Error('No providers meet routing criteria and fallback disabled');
      }

      // Return highest quality provider as fallback
      const fallback = candidates.reduce((a, b) => (a.successRate > b.successRate ? a : b));
      return {
        provider: fallback.name,
        model: 'default',
        reason: 'Fallback: no providers met criteria',
        score: 0,
        alternatives: [],
      };
    }

    // Top choice
    const winner = scored[0];

    // Build decision
    const decision: RoutingDecision = {
      provider: winner.metrics.name,
      model: 'default',
      reason: this.buildReasonString(winner.metrics, effectiveStrategy),
      score: winner.score,
      alternatives: scored
        .slice(1, 3)
        .map(item => ({
          provider: item.metrics.name,
          score: item.score,
        })),
    };

    // Record decision
    this.routingHistory.push(decision);
    if (this.routingHistory.length > this.maxHistorySize) {
      this.routingHistory.shift();
    }

    return decision;
  }

  /**
   * Generate human-readable reason for routing decision
   */
  private buildReasonString(metrics: ProviderMetrics, strategy: RoutingStrategy): string {
    const reasons: string[] = [];

    if (strategy.preferCheaper) {
      reasons.push(`lowest cost ($${metrics.costPerKToken}/ktoken)`);
    }

    if (strategy.preferHighQuality) {
      reasons.push(`highest quality (${(metrics.successRate * 100).toFixed(0)}% success)`);
    }

    if (strategy.preferFast) {
      reasons.push(`fastest (${metrics.avgLatency}ms avg)`);
    }

    if (strategy.minContextSize && metrics.contextSize >= strategy.minContextSize) {
      reasons.push(`sufficient context (${metrics.contextSize} tokens)`);
    }

    return reasons.join(' + ') || 'default selection';
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    totalDecisions: number;
    uniqueProviders: number;
    avgScore: number;
    providerDistribution: Record<string, number>;
  } {
    const distribution: Record<string, number> = {};

    for (const decision of this.routingHistory) {
      distribution[decision.provider] = (distribution[decision.provider] ?? 0) + 1;
    }

    const avgScore = this.routingHistory.reduce((sum, d) => sum + d.score, 0) / this.routingHistory.length || 0;

    return {
      totalDecisions: this.routingHistory.length,
      uniqueProviders: this.metrics.size,
      avgScore,
      providerDistribution: distribution,
    };
  }

  /**
   * Get detailed performance report for a provider
   */
  getProviderReport(providerName: string): ProviderMetrics | null {
    return this.metrics.get(providerName) ?? null;
  }

  /**
   * Export metrics for persistence
   */
  exportMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Import metrics from backup
   */
  importMetrics(metrics: ProviderMetrics[]): void {
    this.metrics.clear();
    for (const metric of metrics) {
      this.metrics.set(metric.name, metric);
    }
  }

  /**
   * Get routing history for analysis
   */
  getRoutingHistory(limit: number = 10): RoutingDecision[] {
    return this.routingHistory.slice(-limit);
  }

  /**
   * Format routing decision for display
   */
  formatDecision(decision: RoutingDecision): string {
    const lines = [
      `🎯 Routing Decision: ${decision.provider}`,
      `  Reason: ${decision.reason}`,
      `  Score: ${decision.score.toFixed(2)}/100`,
    ];

    if (decision.alternatives.length > 0) {
      lines.push(`  Alternatives:`);
      for (const alt of decision.alternatives) {
        lines.push(`    - ${alt.provider} (${alt.score.toFixed(2)})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format optimization stats for display
   */
  formatStats(): string {
    const stats = this.getOptimizationStats();

    const distributionLines = Object.entries(stats.providerDistribution).map(
      ([provider, count]) => `    ${provider}: ${count} times`,
    );

    return [
      `✨ Routing Optimizer Stats`,
      `  Total Routing Decisions: ${stats.totalDecisions}`,
      `  Average Score: ${stats.avgScore.toFixed(2)}/100`,
      `  Providers Available: ${stats.uniqueProviders}`,
      `  Provider Usage Distribution:`,
      ...distributionLines,
    ].join('\n');
  }
}

export default RoutingOptimizer;
