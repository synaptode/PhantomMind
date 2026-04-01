/**
 * PhantomindAI — CLI Learn Command
 * Scans codebase, detects tech stack & patterns, writes SKILLS.md,
 * and optionally runs sync to update adapter files.
 */

import { ContextLearner } from '../context/learner.js';

export interface LearnOptions {
  sync?: boolean;
  verbose?: boolean;
}

export async function learnCommand(
  projectRoot: string,
  options: LearnOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🧠 PhantomindAI — Learn Project Context\n'));

  const spinner = ora('Scanning codebase...').start();

  try {
    const learner = new ContextLearner(projectRoot);

    spinner.text = 'Detecting tech stack...';
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
    for (const line of techLines.slice(0, 8)) {
      console.log(`  ${chalk.green('✓')} ${line.replace('- **', '').replace('**:', ':').replace('**', '')}`);
    }
    if (patternCount > 0) {
      console.log(`  ${chalk.green('✓')} ${patternCount} code patterns detected`);
    }

    console.log('');
    console.log(chalk.dim(`  Written to: .phantomind/SKILLS.md (${lines.length} lines)`));

    // Auto-sync if requested
    if (options.sync) {
      console.log('');
      const { syncCommand } = await import('./sync.js');
      await syncCommand(projectRoot, { verbose: options.verbose });
    } else {
      console.log('');
      console.log(chalk.dim(`  Run ${chalk.white('phantomind sync')} to push this context to your AI tools.`));
    }

    console.log('');
  } catch (error) {
    spinner.fail('Learning failed');
    throw error;
  }
}
