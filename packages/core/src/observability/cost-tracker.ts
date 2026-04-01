/**
 * PhantomindAI — Cost Tracker
 * Real-time cost tracking per provider/model with budget enforcement.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CostReport, TokenUsage } from '../types.js';

export interface CostEntry {
  timestamp: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  action: string;
}

export interface DailyCost {
  date: string;
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  requestCount: number;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  private dailyCosts: Map<string, DailyCost> = new Map();
  private budget: { daily?: number; monthly?: number; total?: number };
  private storePath: string;
  private totalSpent = 0;

  constructor(projectRoot: string, budget: { daily?: number; monthly?: number; total?: number } = {}) {
    this.storePath = join(projectRoot, '.phantomind', 'audit', 'costs.json');
    this.budget = budget;
  }

  /**
   * Record a cost entry
   */
  record(
    provider: string,
    model: string,
    usage: TokenUsage,
    action = 'completion',
  ): CostEntry {
    const entry: CostEntry = {
      timestamp: new Date().toISOString(),
      provider,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cost: usage.estimatedCost,
      action,
    };

    this.entries.push(entry);
    this.totalSpent += entry.cost;

    // Update daily aggregation
    const date = entry.timestamp.slice(0, 10);
    if (!this.dailyCosts.has(date)) {
      this.dailyCosts.set(date, {
        date,
        total: 0,
        byProvider: {},
        byModel: {},
        requestCount: 0,
      });
    }
    const daily = this.dailyCosts.get(date)!;
    daily.total += entry.cost;
    daily.byProvider[provider] = (daily.byProvider[provider] ?? 0) + entry.cost;
    daily.byModel[model] = (daily.byModel[model] ?? 0) + entry.cost;
    daily.requestCount++;

    return entry;
  }

  /**
   * Check if budget is exceeded
   */
  checkBudget(): {
    exceeded: boolean;
    type?: 'daily' | 'monthly' | 'total';
    spent: number;
    limit?: number;
  } {
    const today = new Date().toISOString().slice(0, 10);
    const dailySpent = this.dailyCosts.get(today)?.total ?? 0;

    if (this.budget.daily && dailySpent >= this.budget.daily) {
      return { exceeded: true, type: 'daily', spent: dailySpent, limit: this.budget.daily };
    }

    const monthKey = today.slice(0, 7);
    const monthlySpent = Array.from(this.dailyCosts.values())
      .filter(d => d.date.startsWith(monthKey))
      .reduce((sum, d) => sum + d.total, 0);

    if (this.budget.monthly && monthlySpent >= this.budget.monthly) {
      return { exceeded: true, type: 'monthly', spent: monthlySpent, limit: this.budget.monthly };
    }

    if (this.budget.total && this.totalSpent >= this.budget.total) {
      return { exceeded: true, type: 'total', spent: this.totalSpent, limit: this.budget.total };
    }

    return { exceeded: false, spent: this.totalSpent };
  }

  /**
   * Get cost report
   */
  getReport(period: 'today' | 'week' | 'month' | 'all' = 'today'): CostReport {
    const now = new Date();
    let startDate: string;

    switch (period) {
      case 'today':
        startDate = now.toISOString().slice(0, 10);
        break;
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().slice(0, 10);
        break;
      }
      case 'month':
        startDate = now.toISOString().slice(0, 7) + '-01';
        break;
      default:
        startDate = '2000-01-01';
    }

    const filtered = this.entries.filter(e => e.timestamp >= startDate);

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;

    for (const entry of filtered) {
      totalCost += entry.cost;
      totalInput += entry.inputTokens;
      totalOutput += entry.outputTokens;
      byProvider[entry.provider] = (byProvider[entry.provider] ?? 0) + entry.cost;
      byModel[entry.model] = (byModel[entry.model] ?? 0) + entry.cost;
    }

    return {
      period,
      totalCost,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      byProvider,
      byModel,
      totalTokens: { inputTokens: totalInput, outputTokens: totalOutput, totalTokens: totalInput + totalOutput, estimatedCost: totalCost },
      requestCount: filtered.length,
      budgetRemaining: this.budget.daily
        ? this.budget.daily - (this.dailyCosts.get(now.toISOString().slice(0, 10))?.total ?? 0)
        : undefined,
    };
  }

  /**
   * Get top models by cost
   */
  getTopModels(limit = 5): Array<{ model: string; cost: number; requests: number }> {
    const models = new Map<string, { cost: number; requests: number }>();

    for (const entry of this.entries) {
      if (!models.has(entry.model)) models.set(entry.model, { cost: 0, requests: 0 });
      const m = models.get(entry.model)!;
      m.cost += entry.cost;
      m.requests++;
    }

    return Array.from(models.entries())
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }

  /**
   * Save to disk
   */
  async save(): Promise<void> {
    const dir = join(this.storePath, '..');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const data = {
      entries: this.entries.slice(-5000), // Keep last 5000
      dailyCosts: Object.fromEntries(this.dailyCosts),
      totalSpent: this.totalSpent,
      savedAt: new Date().toISOString(),
    };

    await writeFile(this.storePath, JSON.stringify(data, null, 2));
  }

  /**
   * Load from disk
   */
  async load(): Promise<void> {
    try {
      if (!existsSync(this.storePath)) return;
      const raw = await readFile(this.storePath, 'utf-8');
      const data = JSON.parse(raw);
      this.entries = data.entries ?? [];
      this.totalSpent = data.totalSpent ?? 0;

      if (data.dailyCosts) {
        this.dailyCosts = new Map(Object.entries(data.dailyCosts));
      }
    } catch {
      // Start fresh if corrupted
    }
  }

  /**
   * Format as markdown report
   */
  formatMarkdown(period: 'today' | 'week' | 'month' | 'all' = 'today'): string {
    const report = this.getReport(period);
    const lines = [
      `# Cost Report — ${period}`,
      '',
      `**Total Cost**: $${report.totalCost.toFixed(4)}`,
      `**Requests**: ${report.requestCount ?? 0}`,
      `**Total Tokens**: ${report.totalTokens?.totalTokens?.toLocaleString() ?? '0'}`,
      '',
    ];

    if (report.byProvider && Object.keys(report.byProvider).length > 0) {
      lines.push('## By Provider');
      for (const [provider, cost] of Object.entries(report.byProvider)) {
        lines.push(`- **${provider}**: $${cost.toFixed(4)}`);
      }
      lines.push('');
    }

    if (report.byModel && Object.keys(report.byModel).length > 0) {
      lines.push('## By Model');
      for (const [model, cost] of Object.entries(report.byModel)) {
        lines.push(`- **${model}**: $${cost.toFixed(4)}`);
      }
      lines.push('');
    }

    if (report.budgetRemaining !== undefined) {
      lines.push(`## Budget`);
      lines.push(`- **Remaining today**: $${report.budgetRemaining.toFixed(4)}`);
    }

    return lines.join('\n');
  }
}
