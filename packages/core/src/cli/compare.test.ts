import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareCommand } from './compare.js';

const tempDirs: string[] = [];

function makeContextProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'phantomind-compare-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, '.phantomind'), { recursive: true });
  writeFileSync(join(dir, '.phantomind', 'config.yaml'), [
    'adapters:',
    '  - copilot',
    'context:',
    '  skills: .phantomind/SKILLS.md',
    '  rules: .phantomind/RULES.md',
    '  schema: .phantomind/schema.json',
    '  prds: .phantomind/prds/',
    '  decisions: .phantomind/decisions/',
  ].join('\n'));
  writeFileSync(join(dir, '.phantomind', 'SKILLS.md'), '# Skills\n');
  writeFileSync(join(dir, '.phantomind', 'RULES.md'), '# Rules\n');
  writeFileSync(join(dir, '.phantomind', 'schema.json'), '{}\n');
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('compareCommand', () => {
  it('prints adapter comparison information', async () => {
    const dir = makeContextProject();
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });

    await compareCommand(dir, { preview: true });

    expect(logs.join('\n')).toContain('copilot');
    expect(logs.join('\n')).toContain('.github/copilot-instructions.md');
  });
});