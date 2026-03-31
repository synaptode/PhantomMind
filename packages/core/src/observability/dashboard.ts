/**
 * PhantomMindAI — Analytics Dashboard
 * Terminal-based usage analytics and metrics visualization.
 */

import type { CostTracker } from './cost-tracker.js';
import type { AuditTrail } from './audit.js';
import type { CostPeriod, DashboardMetrics } from '../types.js';

export class AnalyticsDashboard {
  private costTracker: CostTracker;
  private auditTrail: AuditTrail;

  constructor(costTracker: CostTracker, auditTrail: AuditTrail) {
    this.costTracker = costTracker;
    this.auditTrail = auditTrail;
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(period: CostPeriod = 'today'): DashboardMetrics {
    const costReport = this.costTracker.getReport(period);
    const recentAudit = this.auditTrail.getRecent(500);

    const providerRequests = recentAudit.filter(e => e.action === 'provider:request');
    const qualityEvents = recentAudit.filter(e => e.action.startsWith('quality:'));
    const agentEvents = recentAudit.filter(e => e.action.startsWith('agent:'));

    const successfulRequests = providerRequests.filter(
      e => (e.details as any)?.success === true,
    );
    const responseTimes = providerRequests
      .map(e => (e.details as any)?.duration as number)
      .filter((d): d is number => typeof d === 'number');

    return {
      overview: {
        totalRequests: costReport.requestCount ?? 0,
        totalCost: costReport.totalCost,
        avgCostPerRequest: (costReport.requestCount ?? 0) > 0
          ? costReport.totalCost / costReport.requestCount!
          : 0,
        totalTokens: costReport.totalTokens?.totalTokens ?? 0,
        activeProviders: Object.keys(costReport.byProvider ?? {}),
      },
      performance: {
        avgResponseTime: responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0,
        successRate: providerRequests.length > 0
          ? successfulRequests.length / providerRequests.length
          : 1,
        errorCount: providerRequests.length - successfulRequests.length,
      },
      quality: {
        secretsDetected: qualityEvents.filter(e => e.action === 'quality:secret-scan').length,
        hallucinationsDetected: qualityEvents.filter(e => e.action === 'quality:hallucination').length,
        consistencyIssues: qualityEvents.filter(e => e.action === 'quality:consistency').length,
      },
      agents: {
        tasksCompleted: agentEvents.filter(e => e.action === 'agent:complete').length,
        tasksFailed: agentEvents.filter(e => e.action === 'agent:error').length,
        avgStepsPerTask: 0, // Computed separately if needed
      },
    };
  }

  /**
   * Format metrics as terminal-friendly text
   */
  formatTerminal(period: CostPeriod = 'today'): string {
    const m = this.getMetrics(period);
    const width = 52;
    const hr = '─'.repeat(width);

    const lines = [
      `┌${hr}┐`,
      `│${'  PhantomMindAI Dashboard'.padEnd(width)}│`,
      `├${hr}┤`,
      `│${'  OVERVIEW'.padEnd(width)}│`,
      `│  Requests: ${String(m.overview.totalRequests).padEnd(width - 14)}│`,
      `│  Cost:     $${m.overview.totalCost.toFixed(4).padEnd(width - 15)}│`,
      `│  Tokens:   ${m.overview.totalTokens.toLocaleString().padEnd(width - 14)}│`,
      `│  Providers: ${m.overview.activeProviders.join(', ').padEnd(width - 15) || 'none'.padEnd(width - 15)}│`,
      `├${hr}┤`,
      `│${'  PERFORMANCE'.padEnd(width)}│`,
      `│  Avg Response: ${(m.performance.avgResponseTime / 1000).toFixed(2).padEnd(width - 18)}s│`,
      `│  Success Rate: ${(m.performance.successRate * 100).toFixed(1).padEnd(width - 18)}%│`,
      `│  Errors:       ${String(m.performance.errorCount).padEnd(width - 18)}│`,
      `├${hr}┤`,
      `│${'  QUALITY'.padEnd(width)}│`,
      `│  Secrets Found:     ${String(m.quality.secretsDetected).padEnd(width - 23)}│`,
      `│  Hallucinations:    ${String(m.quality.hallucinationsDetected).padEnd(width - 23)}│`,
      `│  Consistency Issues: ${String(m.quality.consistencyIssues).padEnd(width - 24)}│`,
      `├${hr}┤`,
      `│${'  AGENTS'.padEnd(width)}│`,
      `│  Completed: ${String(m.agents.tasksCompleted).padEnd(width - 15)}│`,
      `│  Failed:    ${String(m.agents.tasksFailed).padEnd(width - 15)}│`,
      `└${hr}┘`,
    ];

    return lines.join('\n');
  }

  /**
   * Format as markdown
   */
  formatMarkdown(period: CostPeriod = 'today'): string {
    const m = this.getMetrics(period);

    return `# PhantomMindAI Analytics Dashboard

## Overview
| Metric | Value |
|--------|-------|
| Total Requests | ${m.overview.totalRequests} |
| Total Cost | $${m.overview.totalCost.toFixed(4)} |
| Avg Cost/Request | $${m.overview.avgCostPerRequest.toFixed(6)} |
| Total Tokens | ${m.overview.totalTokens.toLocaleString()} |
| Active Providers | ${m.overview.activeProviders.join(', ') || 'none'} |

## Performance
| Metric | Value |
|--------|-------|
| Avg Response Time | ${(m.performance.avgResponseTime / 1000).toFixed(2)}s |
| Success Rate | ${(m.performance.successRate * 100).toFixed(1)}% |
| Errors | ${m.performance.errorCount} |

## Quality
| Metric | Value |
|--------|-------|
| Secrets Detected | ${m.quality.secretsDetected} |
| Hallucinations Detected | ${m.quality.hallucinationsDetected} |
| Consistency Issues | ${m.quality.consistencyIssues} |

## Agent Activity
| Metric | Value |
|--------|-------|
| Tasks Completed | ${m.agents.tasksCompleted} |
| Tasks Failed | ${m.agents.tasksFailed} |
`;
  }

  /**
   * Export as JSON
   */
  toJSON(period: CostPeriod = 'today'): DashboardMetrics {
    return this.getMetrics(period);
  }
}
