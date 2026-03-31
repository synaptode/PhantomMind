import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { statsCommand } from './stats.js';

describe('statsCommand', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pm-stats-test-'));
    await mkdir(join(tmpDir, '.phantomind'), { recursive: true });
    await writeFile(
      join(tmpDir, '.phantomind', 'config.yaml'),
      'adapters:\n  - copilot\n',
    );
    await writeFile(join(tmpDir, 'index.ts'), 'export const x = 1;\n');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('prints project stats without error', async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    try {
      await statsCommand(tmpDir, {});
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');
    expect(output).toContain('Project Context');
    expect(output).toContain('Layers');
    expect(output).toContain('Configuration');
  });
});
