import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface HooksOptions {
  force?: boolean;
}

const HOOK_FILES = ['post-merge', 'post-checkout'];

function getHookScript(): string {
  return [
    '#!/bin/sh',
    'if command -v phantomind >/dev/null 2>&1; then',
    '  phantomind learn --sync >/dev/null 2>&1 || true',
    'fi',
    '',
  ].join('\n');
}

export async function hooksCommand(projectRoot: string, options: HooksOptions): Promise<void> {
  const chalk = (await import('chalk')).default;
  const hooksDir = join(projectRoot, '.git', 'hooks');

  if (!existsSync(join(projectRoot, '.git'))) {
    throw new Error('Git repository not found. Initialize git before installing hooks.');
  }

  await mkdir(hooksDir, { recursive: true });
  const script = getHookScript();

  console.log(chalk.bold.cyan('\n🪝 PhantomMindAI — Git Hooks\n'));

  for (const hookName of HOOK_FILES) {
    const hookPath = join(hooksDir, hookName);
    if (existsSync(hookPath) && !options.force) {
      console.log(chalk.yellow(`Skipped ${hookName} (already exists). Use --force to overwrite.`));
      continue;
    }
    await writeFile(hookPath, script, 'utf-8');
    await chmod(hookPath, 0o755);
    console.log(chalk.green(`Installed ${hookName}`));
  }

  console.log('');
}