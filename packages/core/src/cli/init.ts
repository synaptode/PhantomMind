/**
 * PhantomMindAI — CLI Init Command
 * Interactive project initialization with adapter selection and optional provider setup.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { PhantomConfig, AdapterName, ProviderName } from '../types.js';
import { getDefaultConfig } from '../config/loader.js';
import { ContextLearner } from '../context/learner.js';
import { writeRulesContent } from '../context/rules-generator.js';
import { PROJECT_TEMPLATES, detectProjectTemplate, type ProjectTemplateName } from '../context/project-template.js';

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
  template?: string;
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
  const skipWizard = options.yes || !!options.adapters;
  let selectedAdapters: AdapterName[] = (options.adapters as AdapterName[]) ?? [];
  let selectedProvider: ProviderName = (options.provider as ProviderName) ?? 'anthropic';
  let selectedTemplate: ProjectTemplateName = (options.template as ProjectTemplateName) ?? 'auto';
  let providerConfigured = Boolean(options.provider);

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

    // Step 2: Select template strategy
    if (!options.template) {
      const { template } = await inquirer.prompt<{ template: ProjectTemplateName }>([{
        type: 'list',
        name: 'template',
        message: `Project template ${chalk.dim('(used for RULES.md defaults)')}:`,
        choices: [
          { value: 'auto', name: `Auto detect ${chalk.dim('(recommended)')}` },
          ...Object.values(PROJECT_TEMPLATES).map(templateOption => ({
            value: templateOption.name,
            name: templateOption.displayName,
          })),
        ],
        default: 'auto',
      }]);
      selectedTemplate = template;
    }

    // Step 3: Optionally configure LLM provider (only needed for agent/eval)
    if (!options.provider) {
      const { wantProvider } = await inquirer.prompt<{ wantProvider: boolean }>([{
        type: 'confirm',
        name: 'wantProvider',
        message: `Configure LLM provider? ${chalk.dim('(only needed for agent/eval commands, not for sync)')}`,
        default: false,
      }]);

      if (wantProvider) {
        const { provider } = await inquirer.prompt<{ provider: ProviderName }>([{
          type: 'list',
          name: 'provider',
          message: 'Primary LLM provider:',
          choices: PROVIDER_CHOICES,
          default: 'anthropic',
        }]);
        selectedProvider = provider;
        providerConfigured = true;
      }
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
    const configPath = join(phantomDir, 'config.yaml');
    if (!existsSync(configPath)) {
      await writeFile(configPath, yaml.dump(config, { noRefs: true, lineWidth: 120 }), 'utf-8');
      spinner.succeed('Created .phantomind/config.yaml');
    } else {
      spinner.info('.phantomind/config.yaml already exists, skipping');
    }

    // Auto-learn project context and write SKILLS.md
    spinner.text = 'Learning project context...';
    const learner = new ContextLearner(projectRoot);
    await learner.learn();
    await learner.writeSkills(detectProjectName(projectRoot));

    // Create RULES.md
    spinner.text = 'Generating project rules...';
    const resolvedTemplate = selectedTemplate === 'auto'
      ? detectProjectTemplate({
          frameworks: learner.getTechStack().frameworks,
          entryPoints: learner.getTechStack().entryPoints,
          projectType: learner.getTechStack().projectType,
        })
      : selectedTemplate;
    await writeRulesContent(projectRoot, { template: resolvedTemplate });

    // Create .env.example
    const envExamplePath = join(phantomDir, '.env.example');
    if (providerConfigured && !existsSync(envExamplePath)) {
      const envContent = [
        '# PhantomMindAI Environment Variables',
        '# Copy to .phantomind/.env and fill in your values',
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
    console.log(chalk2.dim('  Provider: ') + chalk2.white(providerConfigured ? selectedProvider : 'not configured'));
    console.log(chalk2.dim('  Template: ') + chalk2.white(resolvedTemplate));
    console.log('');
    console.log(chalk2.dim('Next steps:'));
    console.log(chalk2.dim(`  1. Review ${chalk2.white('.phantomind/SKILLS.md')} — auto-detected project context`));
    console.log(chalk2.dim(`  2. Run ${chalk2.white('phantomind sync')} to generate adapter configs`));
    console.log(chalk2.dim(`  3. Run ${chalk2.white('phantomind learn --sync')} anytime to re-scan & sync`));
    console.log(chalk2.dim(`  4. ${chalk2.dim('(Optional)')} Configure provider + ${chalk2.white('.phantomind/.env')} only if you use ${chalk2.white('agent')} or ${chalk2.white('eval')}`));
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
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string };
      return pkg.name ?? root.split('/').pop() ?? 'project';
    }
    return root.split('/').pop() ?? 'project';
  } catch {
    return root.split('/').pop() ?? 'project';
  }
}
