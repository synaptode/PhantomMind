/**
 * PhantomindAI — CLI Learn Command
 * Scans codebase, detects tech stack & patterns, writes SKILLS.md,
 * and optionally runs sync to update adapter files.
 *
 * Features:
 * - --packages for scoped monorepo learning
 * - --only-changes for incremental learning (only changed files)
 * - --diagnose to run troubleshooting after learning
 */

import { ContextLearner } from '../context/learner.js';
import { LearnStateManager } from './learn-state.js';

export interface LearnOptions {
  sync?: boolean;
  verbose?: boolean;
  packages?: string[]; // Scoped learning for monorepos: 'core,adapter,agent'
  onlyChanges?: boolean; // Incremental learning
  diagnose?: boolean; // Run diagnose after learning
}

export async function learnCommand(
  projectRoot: string,
  options: LearnOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🧠 PhantomindAI — Learn Project Context\n'));

  let spinner = ora('Scanning codebase...').start();

  try {
    const learner = new ContextLearner(projectRoot);
    const stateManager = new LearnStateManager(projectRoot);

    // Handle incremental learning
    let scopedInfo = '';
    if (options.packages && options.packages.length > 0) {
      scopedInfo = ` (packages: ${options.packages.join(', ')})`;
      console.log(chalk.dim(`  Scoped to: ${options.packages.join(', ')}`));
    }

    if (options.onlyChanges) {
      spinner.text = 'Checking for changed files...';
      const prevState = stateManager.getPreviousState();
      const allFiles = await stateManager.getLearnableFiles();
      const changedFiles = await stateManager.getChangedFiles(allFiles, prevState);

      if (changedFiles.length === 0) {
        spinner.warn('No changes detected since last learn');
        console.log('');
        console.log(chalk.dim(`  Your project context is up to date.`));
        console.log(chalk.dim(`  Run ${chalk.white('phantomind learn')} to force re-scan all files.`));
        console.log('');
        return;
      }

      const unchanged = allFiles.length - changedFiles.length;
      spinner.succeed(`Found ${changedFiles.length} changed file(s) (${unchanged} unchanged)`);
      console.log('');
    }

    spinner.start('Detecting tech stack...');
    const patterns = await learner.learn();

    spinner.text = 'Writing SKILLS.md...';
    const content = await learner.writeSkills();

    spinner.succeed('Project context learned!');

    // Show summary
    const lines = content.split('\n');
    const techLines = lines.filter(l => l.startsWith('- **'));
    const patternCount = patterns.length;

    console.log('');
    console.log(chalk.bold('  Detected:'));
    for (const line of techLines.slice(0, 12)) {
      console.log(`  ${chalk.green('✓')} ${line.replace('- **', '').replace('**:', ':').replace('**', '')}`);
    }
    if (patternCount > 0) {
      console.log(`  ${chalk.green('✓')} ${patternCount} code patterns detected`);
    }

    console.log('');
    console.log(chalk.dim(`  Written to: .phantomind/SKILLS.md (${lines.length} lines)${scopedInfo}`));

    // Save learning state for incremental mode
    if (options.onlyChanges) {
      const allFiles = await stateManager.getLearnableFiles();
      await stateManager.saveState(allFiles, options.packages);
      console.log(chalk.dim(`  State saved for next incremental learn`));
    }

    // Auto-sync if requested
    if (options.sync) {
      console.log('');
      const { syncCommand } = await import('./sync.js');
      await syncCommand(projectRoot, { verbose: options.verbose });
    } else {
      console.log('');
      console.log(chalk.dim(`  Run ${chalk.white('phantomind sync')} to push this context to your AI tools.`));
    }

    // Run troubleshoot if requested
    if (options.diagnose) {
      console.log('');
      const { troubleshootCommand } = await import('./troubleshoot.js');
      await troubleshootCommand(projectRoot, {});
    }

    console.log('');
  } catch (error) {
    spinner.fail('Learning failed');
    throw error;
  }
}
