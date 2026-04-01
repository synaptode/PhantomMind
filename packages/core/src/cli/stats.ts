/**
 * PhantomindAI — CLI Stats Command
 * Display project statistics, context info, and health insights.
 *
 * Features:
 * - Context layers and token analysis
 * - Project health scoring (testing, TypeScript, docs, patterns, security, performance)
 * - Learned patterns and tech stack
 * - Configuration summary
 * - --diagnose flag for troubleshooting
 */

import { loadConfig } from '../config/loader.js';
import { ContextEngine } from '../context/engine.js';
import { CodebaseEmbedder } from '../context/embedder.js';
import { ContextLearner } from '../context/learner.js';
import { HealthScorer } from './health-scorer.js';

export interface StatsOptions {
  verbose?: boolean;
  learn?: boolean;
  diagnose?: boolean; // Run troubleshoot after stats
}

export async function statsCommand(
  projectRoot: string,
  options: StatsOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n📈 PhantomindAI — Project Stats\n'));

  let spinner = ora('Analyzing project...').start();

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

    // Health insights
    spinner.text = 'Scoring project health...';
    const healthScorer = new HealthScorer(projectRoot);
    const healthReport = await healthScorer.analyze();

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

    // Health insights summary
    console.log(chalk.bold('Project Health:'));
    console.log(`  Overall Score: ${chalk.bold(healthReport.projectMaturityScore)}/100`);
    console.log(`  Status: ${
      healthReport.projectMaturityScore >= 80 ? chalk.green('Excellent') :
      healthReport.projectMaturityScore >= 60 ? chalk.yellow('Good') :
      healthReport.projectMaturityScore >= 40 ? chalk.yellow('Fair') :
      chalk.red('Needs Work')
    }`);
    console.log('');

    // Show top 3 insights (sorted by lowest score)
    const topInsights = healthReport.insights.slice(0, 3);
    console.log(chalk.dim('  Top Areas for Improvement:'));
    for (const insight of topInsights) {
      const scoreColor = insight.score >= 70 ? chalk.green : insight.score >= 50 ? chalk.yellow : chalk.red;
      console.log(`  ${chalk.dim('└')} ${insight.title} (${scoreColor(insight.score)}/100)`);
      console.log(`     ${chalk.dim(insight.message)}`);
      if (insight.recommendations.length > 0) {
        console.log(`     ${chalk.dim('→ ' + insight.recommendations[0])}`);
      }
    }
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

    // Diagnostics if requested
    if (options.diagnose) {
      console.log('');
      const { troubleshootCommand } = await import('./troubleshoot.js');
      await troubleshootCommand(projectRoot, {});
    }
  } catch (error) {
    spinner.fail('Stats collection failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
