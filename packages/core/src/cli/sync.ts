/**
 * PhantomindAI — CLI Sync Command
 * Generates and syncs adapter configurations for all AI tools.
 */

import type { PhantomConfig } from '../types.js';
import { loadConfig } from '../config/loader.js';
import { ContextEngine } from '../context/engine.js';
import { syncAllAdapters } from '../adapters/index.js';

export interface SyncOptions {
  adapters?: string[];
  dryRun?: boolean;
  verbose?: boolean;
}

export async function syncCommand(
  projectRoot: string,
  options: SyncOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🔄 PhantomindAI — Sync Adapters\n'));

  const spinner = ora('Loading configuration...').start();

  try {
    const config = await loadConfig(projectRoot);
    spinner.text = 'Building project context...';

    const engine = new ContextEngine(config, projectRoot);
    await engine.getProjectContext({ maxTokens: 4000 });

    spinner.text = 'Syncing adapters...';

    // Filter adapters if specific ones requested
    let syncConfig = config;
    if (options.adapters && options.adapters.length > 0) {
      syncConfig = { ...config, adapters: options.adapters as any[] };
    }

    const results = await syncAllAdapters(
      projectRoot,
      syncConfig,
      options.dryRun ?? false,
    );

    spinner.stop();

    console.log('');
    for (const result of results) {
      const icon = result.success ? chalk.green('✓') : chalk.red('✗');
      const status = options.dryRun ? chalk.yellow('[dry-run]') : '';

      console.log(`  ${icon} ${chalk.bold(result.adapter)} ${status}`);

      if (options.verbose && result.changed) {
        console.log(chalk.dim(`    → ${result.outputPath}`));
      }

      if (!result.success && result.error) {
        console.log(chalk.red(`    Error: ${result.error}`));
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log('');
    console.log(
      chalk.green(`✅ Synced ${successCount}/${results.length} adapters successfully`),
    );
    console.log('');
  } catch (error) {
    spinner.fail('Sync failed');
    console.error((error as Error).message);
    process.exit(1);
  }
}
