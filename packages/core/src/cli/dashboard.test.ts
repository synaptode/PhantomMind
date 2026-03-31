import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dashboardCommand } from './dashboard.js';

describe('dashboardCommand', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pm-dash-cmd-'));
    await mkdir(join(tmpDir, '.phantomind'), { recursive: true });
    await writeFile(
      join(tmpDir, '.phantomind', 'config.yaml'),
      'adapters:\n  - copilot\n',
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('starts dashboard server on a random port', async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    // Use port 0 is not supported — use a high ephemeral port
    const port = String(49700 + Math.floor(Math.random() * 100));
    try {
      await dashboardCommand(tmpDir, { port, host: '127.0.0.1' });
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');
    expect(output).toContain('Dashboard');
    expect(output).toContain('/api/metrics');
  });
});
