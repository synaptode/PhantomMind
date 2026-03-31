import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initCommand } from './init.js';

const tempDirs: string[] = [];

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'phantomind-init-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'demo-cli',
    type: 'module',
    scripts: { build: 'tsc', test: 'vitest' },
    bin: { demo: 'dist/index.js' },
    dependencies: { commander: '^13.1.0' },
    devDependencies: { typescript: '^5.8.2', vitest: '^3.1.1' },
  }, null, 2));
  writeFileSync(join(dir, 'src', 'index.ts'), 'export const demo = 1;\n');
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('initCommand', () => {
  it('creates config and learned context without provider setup', async () => {
    const dir = makeProject();

    await initCommand(dir, {
      yes: true,
      adapters: ['copilot', 'cursor'],
      template: 'node-cli',
    });

    expect(existsSync(join(dir, '.phantomind', 'config.yaml'))).toBe(true);
    expect(existsSync(join(dir, '.phantomind', 'SKILLS.md'))).toBe(true);
    expect(existsSync(join(dir, '.phantomind', 'RULES.md'))).toBe(true);
    expect(existsSync(join(dir, '.phantomind', '.env.example'))).toBe(false);

    const config = readFileSync(join(dir, '.phantomind', 'config.yaml'), 'utf-8');
    expect(config).toContain('copilot');
    expect(config).toContain('cursor');
  });
});