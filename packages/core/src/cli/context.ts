import { loadConfig } from '../config/loader.js';
import { ContextEngine } from '../context/engine.js';

export interface ContextCommandOptions {
  file?: string;
  search?: string;
  maxTokens?: string;
  json?: boolean;
}

export async function contextCommand(
  projectRoot: string,
  options: ContextCommandOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const config = await loadConfig(projectRoot);
  const engine = new ContextEngine(config, projectRoot);
  const maxTokens = options.maxTokens ? parseInt(options.maxTokens, 10) : 3000;

  console.log(chalk.bold.cyan('\n🧠 PhantomMindAI — Context Preview\n'));

  if (options.search) {
    const sections = await engine.searchContext(options.search, 8);
    if (options.json) {
      console.log(JSON.stringify(sections, null, 2));
      return;
    }
    for (const section of sections) {
      console.log(`${chalk.bold(section.heading)} ${chalk.dim(`(${section.source})`)}`);
      console.log(section.content.slice(0, 400));
      console.log('');
    }
    return;
  }

  const context = options.file
    ? await engine.getFileContext(options.file, maxTokens)
    : await engine.getProjectContext({ maxTokens });

  if (options.json) {
    console.log(JSON.stringify(context, null, 2));
    return;
  }

  console.log(chalk.dim(`Total tokens: ~${context.totalTokens}`));
  console.log('');
  for (const layer of context.layers) {
    console.log(`${chalk.bold(layer.type)} ${chalk.dim(`(${layer.source}, relevance ${layer.relevanceScore.toFixed(2)})`)}`);
    console.log(layer.content.slice(0, 500));
    console.log('');
  }
}