import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contextCommand } from './context.js';

const tempDirs: string[] = [];

function makeContextProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'phantomind-context-'));
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
  writeFileSync(join(dir, '.phantomind', 'SKILLS.md'), '# Provider Notes\n\nUse provider fallback routing.\n');
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

describe('contextCommand', () => {
  it('prints matching context sections for a search query', async () => {
    const dir = makeContextProject();
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });

    await contextCommand(dir, { search: 'provider' });

    expect(logs.join('\n')).toContain('Provider Notes');
    expect(logs.join('\n')).toContain('provider fallback routing');
  });
});