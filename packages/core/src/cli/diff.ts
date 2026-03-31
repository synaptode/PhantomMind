import { loadConfig } from '../config/loader.js';
import { syncAllAdapters } from '../adapters/index.js';

export interface DiffOptions {
  adapters?: string[];
  verbose?: boolean;
}

export async function diffCommand(projectRoot: string, options: DiffOptions): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🧾 PhantomMindAI — Adapter Diff\n'));

  const spinner = ora('Calculating adapter diffs...').start();

  try {
    let config = await loadConfig(projectRoot);
    if (options.adapters?.length) {
      config = { ...config, adapters: options.adapters as typeof config.adapters };
    }

    const results = await syncAllAdapters(projectRoot, config, true);
    spinner.stop();

    const changed = results.filter(result => result.changed);
    if (changed.length === 0) {
      console.log(chalk.green('No adapter changes detected.'));
      console.log('');
      return;
    }

    for (const result of changed) {
      console.log(`${chalk.yellow('•')} ${chalk.bold(result.adapter)} → ${result.outputPath}`);
      if (result.diff) {
        const lines = result.diff.split('\n');
        const preview = options.verbose ? lines : lines.slice(0, 20);
        for (const line of preview) {
          const colored = line.startsWith('+')
            ? chalk.green(line)
            : line.startsWith('-')
              ? chalk.red(line)
              : chalk.dim(line);
          console.log(`  ${colored}`);
        }
        if (!options.verbose && lines.length > preview.length) {
          console.log(chalk.dim(`  ... ${lines.length - preview.length} more changed lines`));
        }
      }
      console.log('');
    }
  } catch (error) {
    spinner.fail('Diff failed');
    throw error;
  }
}