import { watch } from 'node:fs';
import { join } from 'node:path';
import { learnCommand } from './learn.js';
import { syncCommand } from './sync.js';

export interface WatchOptions {
  sync?: boolean;
}

function shouldIgnore(path: string): boolean {
  return [
    '.phantomind/',
    '.github/',
    '.continue/',
    '.zed/',
    '.claude/',
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    '.github/copilot-instructions.md',
    '.cursorrules',
    '.clinerules',
    '.windsurfrules',
    '.aider.conf.yml',
    'AGENTS.md',
  ].some(pattern => path.includes(pattern));
}

export async function watchCommand(projectRoot: string, options: WatchOptions): Promise<void> {
  const chalk = (await import('chalk')).default;

  console.log(chalk.bold.cyan('\n👀 PhantomMindAI — Watch Mode\n'));
  console.log(chalk.dim('Watching project files. Press Ctrl+C to stop.'));
  console.log('');

  let timer: NodeJS.Timeout | undefined;
  let running = false;

  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await learnCommand(projectRoot, { verbose: false });
      if (options.sync) {
        await syncCommand(projectRoot, { verbose: false });
      }
    } finally {
      running = false;
    }
  };

  const watcher = watch(projectRoot, { recursive: true }, (_eventType, fileName) => {
    if (!fileName) return;
    if (shouldIgnore(String(fileName))) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      void run();
    }, 500);
  });

  process.on('SIGINT', () => {
    watcher.close();
    console.log(chalk.dim('\nWatch stopped.'));
    process.exit(0);
  });
}