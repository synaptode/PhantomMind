import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { getAdapter } from '../adapters/index.js';

export interface CompareOptions {
  adapters?: string[];
  preview?: boolean;
}

export async function compareCommand(projectRoot: string, options: CompareOptions): Promise<void> {
  const chalk = (await import('chalk')).default;
  const config = await loadConfig(projectRoot);
  const adapterNames = options.adapters?.length
    ? options.adapters as typeof config.adapters
    : config.adapters;

  const skills = await readFile(join(projectRoot, config.context.skills), 'utf-8').catch(() => '');
  const rules = await readFile(join(projectRoot, config.context.rules), 'utf-8').catch(() => '');
  const schema = await readFile(join(projectRoot, config.context.schema), 'utf-8').catch(() => '');

  console.log(chalk.bold.cyan('\n⚖️ PhantomMindAI — Adapter Compare\n'));

  for (const adapterName of adapterNames) {
    const adapter = getAdapter(adapterName);
    const output = adapter.generate(skills, rules, schema);
    const lineCount = output.split('\n').length;
    const approxTokens = Math.ceil(output.length / 4);

    console.log(`${chalk.bold(adapter.name)} ${chalk.dim(`→ ${adapter.outputPath}`)}`);
    console.log(`  format: ${adapter.format}`);
    console.log(`  lines: ${lineCount}`);
    console.log(`  tokens: ~${approxTokens}`);

    if (options.preview) {
      console.log('');
      const preview = output.split('\n').slice(0, 12);
      for (const line of preview) {
        console.log(`  ${line}`);
      }
    }

    console.log('');
  }
}