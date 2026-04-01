/**
 * PhantomindAI — Tune Command
 * Auto-tunes configuration based on project analysis
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import fastGlob from 'fast-glob';

export interface ConfigRecommendation {
  setting: string;
  current: unknown;
  recommended: unknown;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export async function tuneCommand(projectRoot: string): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🔧 PhantomindAI — Config Auto-Tuning\n'));

  const spinner = ora('Analyzing project...').start();

  try {
    // Gather project metrics
    const sourceFiles = await fastGlob('**/*.ts', {
      cwd: projectRoot,
      ignore: ['node_modules/**', 'dist/**', '**/*.test.ts'],
    });
    const testFiles = await fastGlob('**/*.test.ts', {
      cwd: projectRoot,
      ignore: ['node_modules/**', 'dist/**'],
    });

    const projectSize = sourceFiles.length;
    const hasComplexPatterns = sourceFiles.length > 50;
    const hasGoodTestCoverage = testFiles.length > projectSize * 0.3;

    // Load current config
    const configPath = join(projectRoot, '.phantomind', 'config.yaml');
    let currentConfig: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try {
        const yaml = require('js-yaml');
        currentConfig = yaml.load(readFileSync(configPath, 'utf-8')) as Record<string, unknown> || {};
      } catch {
        // Use empty config
      }
    }

    const recommendations: ConfigRecommendation[] = [];

    // Budget recommendations
    if (projectSize < 10) {
      const budgetCfg = currentConfig['budget'] as Record<string, unknown> | undefined;
      recommendations.push({
        setting: 'budget.maxCostPerDay',
        current: budgetCfg?.maxCostPerDay ?? 10,
        recommended: 5,
        reason: 'Small project - lower budget should suffice',
        priority: 'low',
      });
    } else if (projectSize < 50) {
      const budgetCfg = currentConfig['budget'] as Record<string, unknown> | undefined;
      recommendations.push({
        setting: 'budget.maxCostPerDay',
        current: budgetCfg?.maxCostPerDay ?? 10,
        recommended: 20,
        reason: 'Medium-sized project - increase budget for active development',
        priority: 'medium',
      });
    } else {
      const budgetCfg = (currentConfig['budget'] ?? {}) as Record<string, unknown>;
      recommendations.push({
        setting: 'budget.maxCostPerDay',
        current: (budgetCfg?.['maxCostPerDay'] ?? 10) as unknown,
        recommended: 50,
        reason: 'Large project - higher budget for complex tasks',
        priority: 'high',
      });
    }

    // Agent step recommendations
    if (hasComplexPatterns) {
      const agentCfg = (currentConfig['agent'] ?? {}) as Record<string, unknown>;
      recommendations.push({
        setting: 'agent.maxSteps',
        current: (agentCfg?.['maxSteps'] ?? 20) as unknown,
        recommended: 30,
        reason: 'Complex codebase detected - tasks may need more steps',
        priority: 'medium',
      });
    }

    // Sandbox recommendations
    if (!hasGoodTestCoverage) {
      recommendations.push({
        setting: 'agent.sandbox.requiresApproval',
        current: false,
        recommended: true,
        reason: 'Low test coverage detected - human approval recommended for code changes',
        priority: 'high',
      });
    }

    // Anomaly detection sensitivity
    if (hasComplexPatterns) {
      recommendations.push({
        setting: 'quality.anomaly.sensitivity',
        current: 0.5,
        recommended: 0.7,
        reason: 'Complex patterns detected - raise anomaly sensitivity threshold',
        priority: 'medium',
      });
    }

    spinner.succeed(`Found ${recommendations.length} recommendations`);

    console.log(chalk.bold('\n📋 Configuration Recommendations:\n'));

    for (const rec of recommendations.sort((a, b) => (b.priority === 'high' ? 1 : -1))) {
      const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`${icon} ${rec.setting}`);
      console.log(`   Current:      ${JSON.stringify(rec.current)}`);
      console.log(`   Recommended:  ${JSON.stringify(rec.recommended)}`);
      console.log(`   Reason:       ${rec.reason}`);
      console.log('');
    }

    console.log(chalk.dim(`Project Analysis:`));
    console.log(chalk.dim(`  • Source files: ${sourceFiles.length}`));
    console.log(chalk.dim(`  • Test files: ${testFiles.length}`));
    console.log(chalk.dim(`  • Test coverage ratio: ${(testFiles.length > 0 ? ((testFiles.length / sourceFiles.length) * 100).toFixed(1) : 0)}%`));
    console.log('');

    console.log(chalk.dim('Next steps:'));
    console.log(chalk.dim('  1. Review recommendations above'));
    console.log(chalk.dim('  2. Update .phantomind/config.yaml manually or use presets'));
    console.log(chalk.dim('  3. Run `phantomind check` to validate configuration'));
    console.log('');
  } catch (error) {
    throw error;
  }
}
