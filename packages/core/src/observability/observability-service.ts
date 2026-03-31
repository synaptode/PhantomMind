import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { AuditTrail } from './audit.js';
import { CostTracker } from './cost-tracker.js';
import { AnalyticsDashboard } from './dashboard.js';
import { loadConfig } from '../config/loader.js';
import type { AuditEntry, CostPeriod, CostReport, DashboardMetrics } from '../types.js';

export class ObservabilityService {
  private auditTrail?: AuditTrail;
  private costTracker?: CostTracker;
  private dashboard?: AnalyticsDashboard;
  private auditLogPath: string;
  private costStorePath: string;
  private auditMtimeMs?: number;
  private costMtimeMs?: number;
  private initialized = false;

  constructor(private projectRoot: string) {
    this.auditLogPath = join(projectRoot, '.phantomind', 'audit', 'audit.jsonl');
    this.costStorePath = join(projectRoot, '.phantomind', 'audit', 'costs.json');
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const config = await loadConfig(this.projectRoot);
    this.auditTrail = new AuditTrail(this.projectRoot);
    this.costTracker = new CostTracker(this.projectRoot, {
      daily: config.budget?.maxCostPerDay,
    });
    this.dashboard = new AnalyticsDashboard(this.costTracker, this.auditTrail);

    await this.auditTrail.loadFromDisk();
    await this.costTracker.load();

    this.initialized = true;
  }

  async refresh(): Promise<void> {
    await this.ensureInit();
    await Promise.all([
      this.refreshAuditIfChanged(),
      this.refreshCostsIfChanged(),
    ]);
  }

  getDashboardMetrics(period: CostPeriod = 'today'): DashboardMetrics {
    this.ensureInitSync();
    return this.dashboard!.getMetrics(period);
  }

  getCostReport(period: CostPeriod = 'today'): CostReport {
    this.ensureInitSync();
    return this.costTracker!.getReport(period) as CostReport;
  }

  getRecentAudit(limit = 50): AuditEntry[] {
    this.ensureInitSync();
    return this.auditTrail!.getRecent(limit) as AuditEntry[];
  }

  private async refreshAuditIfChanged(): Promise<void> {
    if (!this.auditTrail) return;
    if (!existsSync(this.auditLogPath)) {
      await this.auditTrail.loadFromDisk();
      this.auditMtimeMs = undefined;
      return;
    }

    const stats = await stat(this.auditLogPath);
    if (this.auditMtimeMs !== stats.mtimeMs) {
      this.auditMtimeMs = stats.mtimeMs;
      await this.auditTrail.loadFromDisk();
    }
  }

  private async refreshCostsIfChanged(): Promise<void> {
    if (!this.costTracker) return;
    if (!existsSync(this.costStorePath)) {
      this.costMtimeMs = undefined;
      return;
    }

    const stats = await stat(this.costStorePath);
    if (this.costMtimeMs !== stats.mtimeMs) {
      this.costMtimeMs = stats.mtimeMs;
      await this.costTracker.load();
    }
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  private ensureInitSync(): void {
    if (!this.initialized) {
      throw new Error('ObservabilityService not initialized. Call init() first.');
    }
  }
}
