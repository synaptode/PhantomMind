/**
 * PhantomMindAI — CLI Init Command
 * Interactive project initialization with adapter & provider wizard.
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PhantomConfig, AdapterName, ProviderName } from '../types.js';
import { getDefaultConfig } from '../config/loader.js';

const ADAPTER_CHOICES: { value: AdapterName; name: string; description: string }[] = [
  { value: 'copilot',     name: 'GitHub Copilot',  description: '.github/copilot-instructions.md' },
  { value: 'cursor',      name: 'Cursor',          description: '.cursorrules' },
  { value: 'cline',       name: 'Cline',           description: '.clinerules' },
  { value: 'continue',    name: 'Continue',        description: '.continue/config.json' },
  { value: 'windsurf',    name: 'Windsurf',        description: '.windsurfrules' },
  { value: 'zed',         name: 'Zed',             description: '.zed/settings.json' },
  { value: 'aider',       name: 'Aider',           description: '.aider.conf.yml' },
  { value: 'claude-code', name: 'Claude Code CLI', description: '.claude/CLAUDE.md' },
  { value: 'codex',       name: 'OpenAI Codex CLI', description: 'AGENTS.md' },
];

const PROVIDER_CHOICES: { value: ProviderName; name: string }[] = [
  { value: 'anthropic',  name: 'Anthropic (Claude)' },
  { value: 'openai',     name: 'OpenAI (GPT)' },
  { value: 'gemini',     name: 'Google Gemini' },
  { value: 'groq',       name: 'Groq' },
  { value: 'mistral',    name: 'Mistral' },
  { value: 'ollama',     name: 'Ollama (local)' },
  { value: 'deepseek',   name: 'DeepSeek' },
  { value: 'openrouter', name: 'OpenRouter' },
];

export interface InitOptions {
  adapters?: string[];
  provider?: string;
  model?: string;
  yes?: boolean;
}

export async function initCommand(
  projectRoot: string,
  options: InitOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🔮 PhantomMindAI — Project Initialization\n'));

  // Interactive wizard unless --yes or all flags provided
  const skipWizard = options.yes || (options.adapters && options.provider);
  let selectedAdapters: AdapterName[] = (options.adapters as AdapterName[]) ?? [];
  let selectedProvider: ProviderName = (options.provider as ProviderName) ?? 'anthropic';

  if (!skipWizard) {
    const inquirer = (await import('inquirer')).default;

    // Step 1: Select AI tools
    if (!options.adapters) {
      const detected = detectAdapters(projectRoot);
      const { adapters } = await inquirer.prompt<{ adapters: AdapterName[] }>([{
        type: 'checkbox',
        name: 'adapters',
        message: 'Which AI tools do you use? (space to select, enter to confirm)',
        choices: ADAPTER_CHOICES.map(a => ({
          value: a.value,
          name: `${a.name}  ${chalk.dim(a.description)}`,
          checked: detected.includes(a.value),
        })),
        validate: (input: AdapterName[]) =>
          input.length > 0 || 'Select at least one AI tool',
      }]);
      selectedAdapters = adapters;
    }

    // Step 2: Select primary LLM provider
    if (!options.provider) {
      const { provider } = await inquirer.prompt<{ provider: ProviderName }>([{
        type: 'list',
        name: 'provider',
        message: 'Primary LLM provider:',
        choices: PROVIDER_CHOICES,
        default: 'anthropic',
      }]);
      selectedProvider = provider;
    }

    console.log('');
  }

  if (selectedAdapters.length === 0) {
    selectedAdapters = getDefaultConfig().adapters;
  }

  const spinner = ora('Setting up PhantomMindAI...').start();

  try {
    // Create .phantomind directory
    const phantomDir = join(projectRoot, '.phantomind');
    const dirs = [
      phantomDir,
      join(phantomDir, 'memory'),
      join(phantomDir, 'cache'),
      join(phantomDir, 'audit'),
      join(phantomDir, 'schemas'),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    spinner.text = 'Generating configuration...';

    // Build config with user selections
    const config: PhantomConfig = {
      ...getDefaultConfig(),
      adapters: selectedAdapters,
      providers: {
        ...getDefaultConfig().providers,
        primary: {
          ...getDefaultConfig().providers.primary,
          name: selectedProvider,
          ...(options.model ? { model: options.model } : {}),
        },
      },
    };

    // Write config file
    const configPath = join(projectRoot, 'phantomind.config.json');
    if (!existsSync(configPath)) {
      await writeFile(configPath, JSON.stringify(config, null, 2));
      spinner.succeed('Created phantomind.config.json');
    } else {
      spinner.info('phantomind.config.json already exists, skipping');
    }

    // Create SKILLS.md
    const skillsPath = join(phantomDir, 'SKILLS.md');
    if (!existsSync(skillsPath)) {
      const projectName = detectProjectName(projectRoot);
      const skillsContent = [
        `# ${projectName} — AI Skills & Context`,
        '',
        '> Auto-generated by PhantomMindAI. Customize to improve AI assistance.',
        '',
        '## Project Overview',
        `- **Root**: ${projectRoot}`,
        `- **Initialized**: ${new Date().toISOString()}`,
        '',
        '## Tech Stack',
        '<!-- Add your tech stack here -->',
        '',
        '## Coding Conventions',
        '<!-- Add your conventions here -->',
        '',
        '## Key Files',
        '<!-- Add important files here -->',
        '',
      ].join('\n');
      await writeFile(skillsPath, skillsContent);
    }

    // Create RULES.md
    const rulesPath = join(phantomDir, 'RULES.md');
    if (!existsSync(rulesPath)) {
      const projectName = detectProjectName(projectRoot);
      const rulesContent = [
        `# ${projectName} — AI Rules`,
        '',
        '> Auto-generated by PhantomMindAI. Customize to set boundaries.',
        '',
        '## General Rules',
        '1. Follow the existing code style',
        '2. Never hardcode secrets or credentials',
        '3. Always handle errors appropriately',
        '4. Write self-documenting code',
        '5. Keep functions focused and small',
        '',
        '## Forbidden Patterns',
        '- Do not use `any` type in TypeScript',
        '- Do not use `console.log` for production logging',
        '- Do not commit commented-out code',
        '',
      ].join('\n');
      await writeFile(rulesPath, rulesContent);
    }

    // Create .env.example
    const envExamplePath = join(projectRoot, '.env.phantomind.example');
    if (!existsSync(envExamplePath)) {
      const envContent = [
        '# PhantomMindAI Environment Variables',
        '# Copy to .env.phantomind and fill in your values',
        '',
        '# Provider API Keys (set the ones you need)',
        'ANTHROPIC_API_KEY=',
        'OPENAI_API_KEY=',
        'GOOGLE_API_KEY=',
        'GROQ_API_KEY=',
        'MISTRAL_API_KEY=',
        'DEEPSEEK_API_KEY=',
        'OPENROUTER_API_KEY=',
        '',
        '# Optional: Ollama (local models)',
        '# OLLAMA_HOST=http://localhost:11434',
        '',
      ].join('\n');
      await writeFile(envExamplePath, envContent);
    }

    const chalk2 = chalk;
    console.log('');
    console.log(chalk2.green('✅ PhantomMindAI initialized successfully!'));
    console.log('');
    console.log(chalk2.dim('  Adapters: ') + selectedAdapters.map(a => chalk2.white(a)).join(', '));
    console.log(chalk2.dim('  Provider: ') + chalk2.white(selectedProvider));
    console.log('');
    console.log(chalk2.dim('Next steps:'));
    console.log(chalk2.dim(`  1. Copy ${chalk2.white('.env.phantomind.example')} → ${chalk2.white('.env.phantomind')} and add your API keys`));
    console.log(chalk2.dim(`  2. Customize ${chalk2.white('.phantomind/SKILLS.md')} with your project context`));
    console.log(chalk2.dim(`  3. Run ${chalk2.white('phantomind sync')} to generate adapter configs`));
    console.log(chalk2.dim(`  4. Run ${chalk2.white('phantomind serve')} to start the MCP server`));
    console.log('');
  } catch (error) {
    spinner.fail('Initialization failed');
    throw error;
  }
}

/**
 * Auto-detect which AI tools the user likely uses based on existing config files.
 */
function detectAdapters(projectRoot: string): AdapterName[] {
  const detected: AdapterName[] = [];
  const checks: [string, AdapterName][] = [
    ['.github/copilot-instructions.md', 'copilot'],
    ['.cursorrules', 'cursor'],
    ['.clinerules', 'cline'],
    ['.continue', 'continue'],
    ['.windsurfrules', 'windsurf'],
    ['.zed/settings.json', 'zed'],
    ['.aider.conf.yml', 'aider'],
    ['.claude/CLAUDE.md', 'claude-code'],
    ['AGENTS.md', 'codex'],
  ];
  for (const [path, adapter] of checks) {
    if (existsSync(join(projectRoot, path))) {
      detected.push(adapter);
    }
  }
  return detected;
}

function detectProjectName(root: string): string {
  try {
    const pkgPath = join(root, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath));
      return pkg.name ?? root.split('/').pop() ?? 'project';
    }
    return root.split('/').pop() ?? 'project';
  } catch {
    return root.split('/').pop() ?? 'project';
  }
}

// Sync import for simple file read in detectProjectName
function readFileSync(filePath: string): string {
  const { readFileSync: rfs } = require('node:fs');
  return rfs(filePath, 'utf-8');
}
