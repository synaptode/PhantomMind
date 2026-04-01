/**
 * PhantomindAI — CLI Sync Command
 * Generates and syncs adapter configurations for all AI tools.
 *
 * Features:
 * - Sync to multiple adapters (Copilot, Cursor, Cline, Continue, Windsurf, etc.)
 * - Dry-run mode to preview changes
 * - --diagnose flag for troubleshooting
 */

import type { PhantomConfig } from '../types.js';
import { loadConfig } from '../config/loader.js';
import { ContextEngine } from '../context/engine.js';
import { syncAllAdapters } from '../adapters/index.js';

export interface SyncOptions {
  adapters?: string[];
  dryRun?: boolean;
  verbose?: boolean;
  diagnose?: boolean; // Run troubleshoot after sync
}

export async function syncCommand(
  projectRoot: string,
  options: SyncOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🔄 PhantomindAI — Sync Adapters\n'));

  let spinner = ora('Loading configuration...').start();

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

    // Run diagnostics if requested
    if (options.diagnose) {
      const { troubleshootCommand } = await import('./troubleshoot.js');
      await troubleshootCommand(projectRoot, {});
    }
  } catch (error) {
    spinner.fail('Sync failed');
    console.error((error as Error).message);
    process.exit(1);
  }
}
