/**
 * Cost Analyzer
 * Tracks, analyzes, and optimizes LLM API costs
 * - Per-provider cost breakdown
 * - Cost trending & forecasting
 * - Cost anomaly detection
 * - Budget tracking & alerts
 */

export interface CostEntry {
  timestamp: number;
  provider: string;
  model: string;
  task: string; // What was the cost for? (agent, completion, validation, etc.)
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  success: boolean;
}

export interface CostSummary {
  provider: string;
  model: string;
  entries: number;
  totalCostUSD: number;
  avgCostPerRequest: number;
  successRate: number;
  totalTokens: number;
}

export interface BudgetConfig {
  dailyLimit: number; // USD
  weeklyLimit: number; // USD
  monthlyLimit: number; // USD
  warningThreshold: number; // Percentage (0-1) of limit to trigger warning
  hardStop: boolean; // Stop all requests when limit exceeded?
}

export interface CostStats {
  totalCost: number;
  entriesCount: number;
  avgCostPerEntry: number;
  costTrend: number; // Percentage change from previous period
  topProvider: string;
  topTask: string;
  topModel: string;
  anomaliesDetected: number;
}

/**
 * Cost Analyzer
 * Comprehensive cost tracking and optimization
 */
export class CostAnalyzer {
  private entries: CostEntry[] = [];
  private budget: BudgetConfig = {
    dailyLimit: 10.0,
    weeklyLimit: 50.0,
    monthlyLimit: 200.0,
    warningThreshold: 0.8,
    hardStop: false,
  };

  private maxEntriesSize: number = 100000; // Keep last 100k entries

  constructor(budget?: Partial<BudgetConfig>) {
    if (budget) {
      this.budget = { ...this.budget, ...budget };
    }
  }

  /**
   * Record a cost entry
   */
  recordCost(
    provider: string,
    model: string,
    task: string,
    inputTokens: number,
    outputTokens: number,
    costUSD: number,
    success: boolean = true,
  ): void {
    const entry: CostEntry = {
      timestamp: Date.now(),
      provider,
      model,
      task,
      inputTokens,
      outputTokens,
      costUSD,
      success,
    };

    this.entries.push(entry);

    // Keep memory bounded
    if (this.entries.length > this.maxEntriesSize) {
      this.entries = this.entries.slice(-this.maxEntriesSize);
    }
  }

  /**
   * Get cost for current day
   */
  getCostToday(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    return this.entries
      .filter(e => e.timestamp >= todayStart && e.success)
      .reduce((sum, e) => sum + e.costUSD, 0);
  }

  /**
   * Get cost for current week
   */
  getCostThisWeek(): number {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    return this.entries
      .filter(e => e.timestamp >= weekStart.getTime() && e.success)
      .reduce((sum, e) => sum + e.costUSD, 0);
  }

  /**
   * Get cost for current month
   */
  getCostThisMonth(): number {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.entries
      .filter(e => e.timestamp >= monthStart.getTime() && e.success)
      .reduce((sum, e) => sum + e.costUSD, 0);
  }

  /**
   * Check if budget limit exceeded
   */
  isBudgetExceeded(period: 'daily' | 'weekly' | 'monthly'): boolean {
    const cost =
      period === 'daily' ? this.getCostToday() : period === 'weekly' ? this.getCostThisWeek() : this.getCostThisMonth();
    const limit = period === 'daily' ? this.budget.dailyLimit : period === 'weekly' ? this.budget.weeklyLimit : this.budget.monthlyLimit;

    return cost > limit;
  }

  /**
   * Check if warning threshold reached
   */
  isBudgetWarning(period: 'daily' | 'weekly' | 'monthly'): boolean {
    const cost =
      period === 'daily' ? this.getCostToday() : period === 'weekly' ? this.getCostThisWeek() : this.getCostThisMonth();
    const limit = period === 'daily' ? this.budget.dailyLimit : period === 'weekly' ? this.budget.weeklyLimit : this.budget.monthlyLimit;

    return cost > limit * this.budget.warningThreshold;
  }

  /**
   * Get remaining budget for period
   */
  getRemainingBudget(period: 'daily' | 'weekly' | 'monthly'): number {
    const cost =
      period === 'daily' ? this.getCostToday() : period === 'weekly' ? this.getCostThisWeek() : this.getCostThisMonth();
    const limit = period === 'daily' ? this.budget.dailyLimit : period === 'weekly' ? this.budget.weeklyLimit : this.budget.monthlyLimit;

    return Math.max(0, limit - cost);
  }

  /**
   * Get cost breakdown by provider
   */
  getCostByProvider(): CostSummary[] {
    const summaries = new Map<string, CostSummary>();

    for (const entry of this.entries) {
      const key = `${entry.provider}:${entry.model}`;

      if (!summaries.has(key)) {
        summaries.set(key, {
          provider: entry.provider,
          model: entry.model,
          entries: 0,
          totalCostUSD: 0,
          avgCostPerRequest: 0,
          successRate: 0,
          totalTokens: 0,
        });
      }

      const summary = summaries.get(key)!;
      summary.entries++;
      summary.totalCostUSD += entry.costUSD;
      summary.totalTokens += entry.inputTokens + entry.outputTokens;
      if (entry.success) summary.successRate++;
    }

    // Calculate averages
    for (const summary of summaries.values()) {
      summary.avgCostPerRequest = summary.totalCostUSD / summary.entries;
      summary.successRate = summary.successRate / summary.entries;
    }

    return Array.from(summaries.values()).sort((a, b) => b.totalCostUSD - a.totalCostUSD);
  }

  /**
   * Get cost breakdown by task
   */
  getCostByTask(): Record<string, { count: number; cost: number; avgCost: number }> {
    const taskCosts: Record<string, { count: number; cost: number }> = {};

    for (const entry of this.entries) {
      if (!taskCosts[entry.task]) {
        taskCosts[entry.task] = { count: 0, cost: 0 };
      }
      if (entry.success) {
        taskCosts[entry.task].count++;
        taskCosts[entry.task].cost += entry.costUSD;
      }
    }

    // Calculate averages
    const result: Record<string, { count: number; cost: number; avgCost: number }> = {};
    for (const [task, data] of Object.entries(taskCosts)) {
      result[task] = {
        ...data,
        avgCost: data.cost / (data.count || 1),
      };
    }

    return result;
  }

  /**
   * Detect cost anomalies (unusual costs)
   */
  detectAnomalies(stdDevThreshold: number = 2): CostEntry[] {
    if (this.entries.length < 2) return [];

    // Calculate mean and std dev
    const costs = this.entries.filter(e => e.success).map(e => e.costUSD);
    const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
    const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
    const stdDev = Math.sqrt(variance);

    // Find anomalies (beyond threshold * std dev from mean)
    return this.entries.filter(e => {
      const zScore = Math.abs((e.costUSD - mean) / (stdDev || 1));
      return zScore > stdDevThreshold;
    });
  }

  /**
   * Calculate cost trend (% change from previous period)
   */
  calculateTrend(period: 'daily' | 'weekly' | 'monthly'): number {
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    if (period === 'daily') {
      currentStart = new Date(now);
      currentStart.setHours(0, 0, 0, 0);

      previousEnd = new Date(currentStart);
      previousEnd.setDate(currentStart.getDate() - 1);

      previousStart = new Date(previousEnd);
      previousStart.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      currentStart = new Date(now);
      currentStart.setDate(now.getDate() - now.getDay());
      currentStart.setHours(0, 0, 0, 0);

      previousStart = new Date(currentStart);
      previousStart.setDate(currentStart.getDate() - 7);

      previousEnd = new Date(currentStart);
      previousEnd.setDate(currentStart.getDate() - 1);
    } else {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStart.setHours(0, 0, 0, 0);

      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const currentCost = this.entries
      .filter(e => e.timestamp >= currentStart.getTime() && e.success)
      .reduce((sum, e) => sum + e.costUSD, 0);

    const previousCost = this.entries
      .filter(e => e.timestamp >= previousStart.getTime() && e.timestamp <= previousEnd.getTime() && e.success)
      .reduce((sum, e) => sum + e.costUSD, 0);

    if (previousCost === 0) return 0;
    return ((currentCost - previousCost) / previousCost) * 100;
  }

  /**
   * Get comprehensive cost statistics
   */
  getStats(): CostStats {
    const successfulEntries = this.entries.filter(e => e.success);

    if (successfulEntries.length === 0) {
      return {
        totalCost: 0,
        entriesCount: 0,
        avgCostPerEntry: 0,
        costTrend: 0,
        topProvider: 'N/A',
        topTask: 'N/A',
        topModel: 'N/A',
        anomaliesDetected: 0,
      };
    }

    const totalCost = successfulEntries.reduce((sum, e) => sum + e.costUSD, 0);
    const providerCosts = this.getCostByProvider();
    const taskCosts = this.getCostByTask();
    const anomalies = this.detectAnomalies();

    const topProvider = providerCosts[0]?.provider ?? 'N/A';
    const topTask = Object.entries(taskCosts).reduce((a, b) => (b[1].cost > a[1].cost ? b : a))[0] ?? 'N/A';
    const topModel = providerCosts[0]?.model ?? 'N/A';

    return {
      totalCost,
      entriesCount: successfulEntries.length,
      avgCostPerEntry: totalCost / successfulEntries.length,
      costTrend: this.calculateTrend('monthly'),
      topProvider,
      topTask,
      topModel,
      anomaliesDetected: anomalies.length,
    };
  }

  /**
   * Update budget configuration
   */
  setBudget(budget: Partial<BudgetConfig>): void {
    this.budget = { ...this.budget, ...budget };
  }

  /**
   * Get budget configuration
   */
  getBudget(): BudgetConfig {
    return { ...this.budget };
  }

  /**
   * Format cost report for display
   */
  formatReport(): string {
    const today = this.getCostToday();
    const week = this.getCostThisWeek();
    const month = this.getCostThisMonth();
    const stats = this.getStats();
    const anomalies = this.detectAnomalies();

    const lines = [
      `💰 Cost Analysis Report`,
      ``,
      `📊 Period Costs:`,
      `  Today: $${today.toFixed(2)} / $${this.budget.dailyLimit.toFixed(2)}`,
      `  This Week: $${week.toFixed(2)} / $${this.budget.weeklyLimit.toFixed(2)}`,
      `  This Month: $${month.toFixed(2)} / $${this.budget.monthlyLimit.toFixed(2)}`,
      ``,
      `📈 Metrics:`,
      `  Total Cost: $${stats.totalCost.toFixed(2)}`,
      `  Entries: ${stats.entriesCount}`,
      `  Avg/Entry: $${stats.avgCostPerEntry.toFixed(4)}`,
      `  Monthly Trend: ${stats.costTrend > 0 ? '📈' : '📉'} ${stats.costTrend.toFixed(1)}%`,
      ``,
      `🏆 Top Usage:`,
      `  Provider: ${stats.topProvider}`,
      `  Model: ${stats.topModel}`,
      `  Task: ${stats.topTask}`,
      ``,
      `⚠️  Anomalies: ${anomalies.length} detected`,
    ];

    // Add warnings
    if (this.isBudgetWarning('daily')) {
      lines.push(`  ⚠️  Daily budget warning!`);
    }
    if (this.isBudgetExceeded('daily')) {
      lines.push(`  🚨 Daily budget EXCEEDED!`);
    }

    return lines.join('\n');
  }

  /**
   * Export entries for persistence
   */
  exportEntries(): CostEntry[] {
    return [...this.entries];
  }

  /**
   * Import entries from backup
   */
  importEntries(entries: CostEntry[]): void {
    this.entries = [...entries];
  }
}

export default CostAnalyzer;
