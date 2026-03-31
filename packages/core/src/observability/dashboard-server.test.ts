import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDashboardServer } from './dashboard-server.js';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';

/**
 * Finds a free TCP port by briefly binding a server.
 */
async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

async function get(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { headers });
}

describe('DashboardServer', () => {
  let tmpDir: string;
  let port: number;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pm-srv-test-'));
    port = await freePort();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('starts and responds to /api/health', async () => {
    await startDashboardServer(tmpDir, { port, host: '127.0.0.1' });
    const res = await get(`http://127.0.0.1:${port}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it('/api/metrics returns DashboardMetrics shape', async () => {
    await startDashboardServer(tmpDir, { port, host: '127.0.0.1' });
    const res = await get(`http://127.0.0.1:${port}/api/metrics?period=today`);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty('overview');
    expect(json).toHaveProperty('performance');
    expect(json).toHaveProperty('quality');
    expect(json).toHaveProperty('agents');
  });

  it('/api/costs returns CostReport shape', async () => {
    await startDashboardServer(tmpDir, { port, host: '127.0.0.1' });
    const res = await get(`http://127.0.0.1:${port}/api/costs?period=today`);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty('period', 'today');
    expect(json).toHaveProperty('totalCost');
  });

  it('/api/audit returns array', async () => {
    await startDashboardServer(tmpDir, { port, host: '127.0.0.1' });
    const res = await get(`http://127.0.0.1:${port}/api/audit?limit=5`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });

  it('returns 401 for protected API when token required', async () => {
    await startDashboardServer(tmpDir, {
      port,
      host: '127.0.0.1',
      authToken: 'secret',
    });
    const res = await get(`http://127.0.0.1:${port}/api/metrics`);
    expect(res.status).toBe(401);
  });

  it('returns 200 when correct bearer token supplied', async () => {
    await startDashboardServer(tmpDir, {
      port,
      host: '127.0.0.1',
      authToken: 'mysecret',
    });
    const res = await get(
      `http://127.0.0.1:${port}/api/metrics`,
      'mysecret',
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 for unknown API endpoint', async () => {
    await startDashboardServer(tmpDir, { port, host: '127.0.0.1' });
    const res = await get(`http://127.0.0.1:${port}/api/unknown`);
    expect(res.status).toBe(404);
  });

  it('handles CORS preflight when cors enabled', async () => {
    await startDashboardServer(tmpDir, {
      port,
      host: '127.0.0.1',
      cors: true,
    });
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: 'OPTIONS',
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
