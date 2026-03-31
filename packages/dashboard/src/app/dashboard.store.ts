import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import type { AuditEntry, CostPeriod, CostReport, DashboardMetrics } from '@phantomind/contracts';
import { DASHBOARD_API, DASHBOARD_CONFIG } from './dashboard.tokens';

export type LoadState = 'idle' | 'loading' | 'error' | 'ready';

export interface MetricTile {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}

export interface AuditItem {
  id: string;
  time: string;
  action: string;
  agent: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private api = inject(DASHBOARD_API);
  private config = inject(DASHBOARD_CONFIG);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  readonly metrics = signal<DashboardMetrics | null>(null);
  readonly costs = signal<CostReport | null>(null);
  readonly audit = signal<AuditEntry[]>([]);
  readonly state = signal<LoadState>('idle');
  readonly error = signal<string | null>(null);
  readonly updatedAt = signal<Date | null>(null);
  readonly period = signal<CostPeriod>(this.config.defaultPeriod);

  readonly overviewTiles = computed<MetricTile[]>(() => {
    const m = this.metrics();
    if (!m) return [];
    return [
      {
        label: 'Requests',
        value: formatNumber(m.overview.totalRequests),
        hint: 'Total calls (period)',
      },
      {
        label: 'Cost',
        value: formatCurrency(m.overview.totalCost),
        hint: `Avg ${formatCurrency(m.overview.avgCostPerRequest)} / request`,
      },
      {
        label: 'Tokens',
        value: formatNumber(m.overview.totalTokens),
        hint: `Providers: ${m.overview.activeProviders.length}`,
      },
      {
        label: 'Success Rate',
        value: formatPercent(m.performance.successRate),
        hint: `${m.performance.errorCount} errors`,
        tone: m.performance.errorCount > 0 ? 'warn' : 'good',
      },
    ];
  });

  readonly performanceTiles = computed<MetricTile[]>(() => {
    const m = this.metrics();
    if (!m) return [];
    return [
      {
        label: 'Avg Response',
        value: formatDuration(m.performance.avgResponseTime),
        hint: 'Across providers',
      },
      {
        label: 'Errors',
        value: formatNumber(m.performance.errorCount),
        hint: 'Failed requests',
        tone: m.performance.errorCount > 0 ? 'bad' : 'good',
      },
    ];
  });

  readonly qualityTiles = computed<MetricTile[]>(() => {
    const m = this.metrics();
    if (!m) return [];
    return [
      {
        label: 'Secrets',
        value: formatNumber(m.quality.secretsDetected),
        hint: 'Secret scan hits',
        tone: m.quality.secretsDetected > 0 ? 'warn' : 'good',
      },
      {
        label: 'Hallucinations',
        value: formatNumber(m.quality.hallucinationsDetected),
        hint: 'Validation events',
        tone: m.quality.hallucinationsDetected > 0 ? 'warn' : 'good',
      },
      {
        label: 'Consistency',
        value: formatNumber(m.quality.consistencyIssues),
        hint: 'Policy violations',
        tone: m.quality.consistencyIssues > 0 ? 'warn' : 'good',
      },
    ];
  });

  readonly agentTiles = computed<MetricTile[]>(() => {
    const m = this.metrics();
    if (!m) return [];
    return [
      {
        label: 'Tasks Completed',
        value: formatNumber(m.agents.tasksCompleted),
        hint: 'Successful runs',
      },
      {
        label: 'Tasks Failed',
        value: formatNumber(m.agents.tasksFailed),
        hint: 'Failed runs',
        tone: m.agents.tasksFailed > 0 ? 'warn' : 'good',
      },
    ];
  });

  readonly providerChips = computed(() => {
    const m = this.metrics();
    if (!m) return [];
    return m.overview.activeProviders;
  });

  readonly auditItems = computed<AuditItem[]>(() => {
    return this.audit().map(entry => ({
      id: entry.id,
      time: formatTime(entry.timestamp),
      action: entry.action,
      agent: entry.agent,
    }));
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.startPolling();
    } else {
      void this.refresh();
    }
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    this.state.set('loading');
    this.error.set(null);

    try {
      const period = this.period();
      const [metrics, audit, costs] = await Promise.all([
        this.api.getMetrics(period),
        this.api.getAudit(this.config.auditLimit),
        this.api.getCosts(period),
      ]);

      this.metrics.set(metrics);
      this.audit.set(audit);
      this.costs.set(costs);
      this.updatedAt.set(new Date());
      this.state.set('ready');
    } catch (error) {
      this.error.set((error as Error).message);
      this.state.set('error');
    } finally {
      this.refreshing = false;
    }
  }

  startPolling(): void {
    this.stopPolling();
    void this.refresh();

    this.pollHandle = setInterval(() => {
      void this.refresh();
    }, this.config.refreshMs);

    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  setPeriod(period: CostPeriod): void {
    if (this.period() === period) return;
    this.period.set(period);
    void this.refresh();
  }

  stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0.00s';
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
