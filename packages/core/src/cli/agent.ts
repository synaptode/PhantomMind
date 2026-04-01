/**
 * PhantomindAI — CLI Agent Command
 * Run agentic tasks from the command line.
 */

import { loadConfig } from '../config/loader.js';
import { ContextEngine } from '../context/engine.js';
import { ProviderRouter } from '../providers/router.js';
import { AgentExecutor } from '../agent/executor.js';
import { AgentOrchestrator } from '../agent/orchestrator.js';
import type { AgentRole } from '../types.js';

export interface AgentOptions {
  role?: string;
  orchestrate?: boolean;
  roles?: string[];
  maxSteps?: number;
}

export async function agentCommand(
  projectRoot: string,
  task: string,
  options: AgentOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🤖 PhantomindAI — Agent Execution\n'));

  const spinner = ora('Initializing agent...').start();

  try {
    const config = await loadConfig(projectRoot);
    const contextEngine = new ContextEngine(config, projectRoot);
    const router = new ProviderRouter(config.providers, config.budget ? {
      maxCostPerDay: config.budget.maxCostPerDay,
      warningAt: config.budget.warningAt,
      fallbackOnBudget: config.budget.fallbackOnBudget,
    } : undefined);

    if (options.orchestrate) {
      // Multi-agent orchestration
      const roles = (options.roles ?? ['architect', 'implementer', 'securityReviewer']) as AgentRole[];
      spinner.text = `Orchestrating ${roles.join(', ')}...`;

      const orchestrator = new AgentOrchestrator(router, contextEngine, projectRoot, config);

      orchestrator.on('orchestration:phase', ({ phase }: any) => {
        spinner.text = `Phase: ${phase}...`;
      });

      spinner.stop();
      console.log(chalk.dim(`  Task:  ${task}`));
      console.log(chalk.dim(`  Roles: ${roles.join(', ')}`));
      console.log(chalk.dim(`  Mode:  orchestrated`));
      console.log('');

      const spinnerRun = ora('Running orchestration...').start();
      const result = await orchestrator.orchestrate(task, roles);
      spinnerRun.stop();

      console.log(chalk.bold(`Result: ${result.success ? chalk.green('Success') : chalk.red('Failed')}`));
      console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
      console.log(`  Cost:     $${result.totalUsage.estimatedCost.toFixed(4)}`);
      console.log(`  Phases:   ${result.phases.length}`);

      for (const phase of result.phases) {
        console.log(`\n  ${chalk.bold(phase.name)}:`);
        console.log(`    ${phase.aggregatedOutput.slice(0, 200)}...`);
      }
    } else {
      // Single agent execution
      const role = (options.role ?? 'implementer') as AgentRole;
      spinner.text = `Running ${role} agent...`;

      const executor = new AgentExecutor(router, contextEngine, projectRoot, {
        role,
        maxSteps: options.maxSteps ?? 30,
      }, config);

      executor.on('agent:step', ({ step }: any) => {
        spinner.text = `Step: ${step.action}...`;
      });

      spinner.stop();
      console.log(chalk.dim(`  Task: ${task}`));
      console.log(chalk.dim(`  Role: ${role}`));
      console.log('');

      const spinnerRun = ora('Executing task...').start();
      const result = await executor.run(task);
      spinnerRun.stop();

      console.log(chalk.bold(`Result: ${result.success ? chalk.green('Success') : chalk.red('Failed')}`));
      console.log(`  ${result.summary}`);
      console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
      console.log(`  Cost:     $${result.totalTokenUsage.estimatedCost.toFixed(4)}`);

      if (result.filesChanged.length > 0) {
        console.log(`  Files Changed:`);
        for (const f of result.filesChanged) {
          console.log(`    - ${f}`);
        }
      }
    }

    console.log('');
  } catch (error) {
    spinner.fail('Agent execution failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
