/**
 * PhantomMindAI — CLI Stats Command
 * Display project statistics and context info.
 */

import { loadConfig } from '../config/loader.js';
import { ContextEngine } from '../context/engine.js';
import { CodebaseEmbedder } from '../context/embedder.js';
import { ContextLearner } from '../context/learner.js';

export interface StatsOptions {
  verbose?: boolean;
  learn?: boolean;
}

export async function statsCommand(
  projectRoot: string,
  options: StatsOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n📈 PhantomMindAI — Project Stats\n'));

  const spinner = ora('Analyzing project...').start();

  try {
    const config = await loadConfig(projectRoot);

    // Context Engine stats
    spinner.text = 'Gathering context...';
    const engine = new ContextEngine(config, projectRoot);
    const context = await engine.getProjectContext({ maxTokens: 5000 });

    // Codebase embeddings stats
    spinner.text = 'Analyzing codebase...';
    const embedder = new CodebaseEmbedder(projectRoot);
    await embedder.build();

    spinner.stop();

    console.log(chalk.bold('Project Context:'));
    console.log(`  Layers:        ${context.layers.length}`);
    console.log(`  Total Tokens:  ~${context.totalTokens.toLocaleString()}`);
    console.log('');

    for (const layer of context.layers) {
      const tokenCount = Math.ceil(layer.content.length / 4);
      console.log(`  ${chalk.dim('─')} ${chalk.cyan(layer.type)} (relevance: ${layer.relevanceScore.toFixed(2)}, ~${tokenCount} tokens)`);
    }
    console.log('');

    console.log(chalk.bold('Codebase Index:'));
    console.log(`  Status: built`);
    console.log('');

    // Learn patterns
    if (options.learn) {
      spinner.start('Learning project patterns...');
      const learner = new ContextLearner(projectRoot);
      await learner.learn();
      const learnedSkills = learner.generateSkillsContent();
      spinner.stop();

      console.log(chalk.bold('Learned Patterns:'));
      const lines = learnedSkills.split('\n').slice(0, 20);
      for (const line of lines) {
        console.log(`  ${line}`);
      }
      if (learnedSkills.split('\n').length > 20) {
        console.log(chalk.dim(`  ... and ${learnedSkills.split('\n').length - 20} more lines`));
      }
      console.log('');
    }

    // Config summary
    console.log(chalk.bold('Configuration:'));
    console.log(`  Primary Provider: ${config.providers?.primary?.name ?? 'none'}`);
    console.log(`  Adapters:         ${config.adapters?.join(', ') ?? 'none'}`);
    console.log(`  MCP Server:       ${config.mcp?.enabled ? 'enabled' : 'disabled'}`);
    console.log(`  Budget (daily):   ${config.budget?.maxCostPerDay ? `$${config.budget.maxCostPerDay}` : 'unlimited'}`);
    console.log('');
  } catch (error) {
    spinner.fail('Stats collection failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
