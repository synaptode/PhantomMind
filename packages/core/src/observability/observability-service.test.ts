import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ObservabilityService } from './observability-service.js';

describe('ObservabilityService', () => {
  let tmpDir: string;
  let service: ObservabilityService;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pm-obs-test-'));
    service = new ObservabilityService(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('initializes without existing data files', async () => {
    await expect(service.init()).resolves.not.toThrow();
  });

  it('returns baseline metrics after init', async () => {
    await service.init();
    const metrics = service.getDashboardMetrics('today');
    expect(metrics).toMatchObject({
      overview: expect.objectContaining({ totalRequests: expect.any(Number) }),
      performance: expect.objectContaining({ successRate: expect.any(Number) }),
      quality: expect.objectContaining({ secretsDetected: expect.any(Number) }),
      agents: expect.objectContaining({ tasksCompleted: expect.any(Number) }),
    });
  });

  it('returns baseline cost report after init', async () => {
    await service.init();
    const report = service.getCostReport('today');
    expect(report).toMatchObject({
      period: 'today',
      totalCost: expect.any(Number),
      byProvider: expect.any(Object),
    });
  });

  it('returns empty audit list after init with no data', async () => {
    await service.init();
    const entries = service.getRecentAudit(10);
    expect(Array.isArray(entries)).toBe(true);
  });

  it('throws if getDashboardMetrics called before init', () => {
    expect(() => service.getDashboardMetrics('today')).toThrow(
      'ObservabilityService not initialized',
    );
  });

  it('refresh resolves after init', async () => {
    await service.init();
    await expect(service.refresh()).resolves.not.toThrow();
  });
});
