/**
 * PhantomMindAI — CLI Eval Command
 * Evaluate and test AI provider connections.
 */

import { loadConfig } from '../config/loader.js';
import { createProvider } from '../providers/index.js';

export interface EvalOptions {
  provider?: string;
  model?: string;
  prompt?: string;
}

export async function evalCommand(
  projectRoot: string,
  options: EvalOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🧪 PhantomMindAI — Provider Evaluation\n'));

  const spinner = ora('Loading configuration...').start();

  try {
    const config = await loadConfig(projectRoot);
    const providerConfig = config.providers.primary;
    const providerName = providerConfig.name;

    spinner.text = `Connecting to ${providerName}...`;

    const resolvedConfig = options.model
      ? { ...providerConfig, model: options.model }
      : providerConfig;

    const provider = createProvider(resolvedConfig);

    // Check availability
    const available = await provider.isAvailable();
    if (!available) {
      spinner.fail(`Provider ${providerName} is not available. Check your API key.`);
      return;
    }

    spinner.succeed(`Connected to ${providerName}`);

    // Run test prompt
    const testPrompt = options.prompt ?? 'Say "PhantomMindAI is ready!" in one short sentence.';
    const model = resolvedConfig.model;

    console.log('');
    console.log(chalk.dim(`  Provider: ${providerName}`));
    console.log(chalk.dim(`  Model:    ${model}`));
    console.log(chalk.dim(`  Prompt:   ${testPrompt}`));
    console.log('');

    const evalSpinner = ora('Generating response...').start();
    const startTime = Date.now();

    const response = await provider.complete({
      prompt: testPrompt,
      temperature: 0.7,
      maxTokens: 200,
    });

    const duration = Date.now() - startTime;
    evalSpinner.stop();

    console.log(chalk.bold('Response:'));
    console.log(chalk.white(`  ${response.content}`));
    console.log('');
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.dim(`  Model:    ${response.model}`));
    console.log(chalk.dim(`  Provider: ${response.provider}`));
    console.log(chalk.dim(`  Tokens:   ${response.usage.inputTokens} in / ${response.usage.outputTokens} out`));
    console.log(chalk.dim(`  Cost:     $${response.usage.estimatedCost.toFixed(6)}`));
    console.log(chalk.dim(`  Duration: ${duration}ms`));
    console.log('');

    // List available models
    try {
      const models = await provider.listModels();
      if (models.length > 0) {
        console.log(chalk.dim('Available models:'));
        for (const m of models.slice(0, 10)) {
          console.log(chalk.dim(`  - ${m}`));
        }
        if (models.length > 10) {
          console.log(chalk.dim(`  ... and ${models.length - 10} more`));
        }
        console.log('');
      }
    } catch {
      // Not all providers support listing models
    }
  } catch (error) {
    spinner.fail('Evaluation failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
