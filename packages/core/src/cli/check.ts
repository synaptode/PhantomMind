/**
 * PhantomindAI — CLI Check Command (Doctor)
 * Pre-flight environment check: validates all configuration,
 * adapter files, provider connectivity, and .phantomind setup.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, findProjectRoot } from '../config/index.js';
import { createProvider } from '../providers/index.js';

export interface CheckOptions {
  fix?: boolean;
  json?: boolean;
}

interface CheckResult {
  category: string;
  name: string;
  status: 'ok' | 'warn' | 'error' | 'skip';
  message: string;
  fix?: string;
}

export async function checkCommand(
  projectRoot: string,
  options: CheckOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;
  const results: CheckResult[] = [];

  if (!options.json) {
    console.log(chalk.bold.cyan('\n🩺 PhantomindAI — Doctor\n'));
  }

  const spinner = options.json ? null : ora('Running checks...').start();

  // ─── 1. Node.js version ───────────────────────────────────
  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split('.').map(Number);
  results.push({
    category: 'environment',
    name: 'Node.js version',
    status: major >= 18 ? 'ok' : 'error',
    message: `Node.js v${nodeVersion} ${major >= 18 ? '(≥18 required)' : '— upgrade to v18+'}`,
    fix: major < 18 ? 'Install Node.js v18 or later from https://nodejs.org' : undefined,
  });

  // ─── 2. .phantomind/ directory ────────────────────────────
  const phantomDir = join(projectRoot, '.phantomind');
  const hasPhantomDir = existsSync(phantomDir);
  results.push({
    category: 'setup',
    name: '.phantomind/ directory',
    status: hasPhantomDir ? 'ok' : 'error',
    message: hasPhantomDir ? 'Found .phantomind/' : 'Missing — project not initialized',
    fix: !hasPhantomDir ? 'Run: phantomind init' : undefined,
  });

  // ─── 3. config.yaml ────────────────────────────────────────
  const configPath = join(phantomDir, 'config.yaml');
  const hasConfig = existsSync(configPath);
  results.push({
    category: 'setup',
    name: 'config.yaml',
    status: hasConfig ? 'ok' : 'warn',
    message: hasConfig ? 'Found .phantomind/config.yaml' : 'Not found — using defaults',
    fix: !hasConfig ? 'Run: phantomind init to generate config.yaml' : undefined,
  });

  // ─── 4. SKILLS.md ──────────────────────────────────────────
  const skillsPath = join(phantomDir, 'SKILLS.md');
  const hasSkills = existsSync(skillsPath);
  let skillsLines = 0;
  if (hasSkills) {
    skillsLines = readFileSync(skillsPath, 'utf-8').split('\n').length;
  }
  results.push({
    category: 'setup',
    name: 'SKILLS.md',
    status: hasSkills ? (skillsLines > 5 ? 'ok' : 'warn') : 'error',
    message: hasSkills
      ? `Found (${skillsLines} lines)`
      : 'Not found — project context not learned',
    fix: !hasSkills ? 'Run: phantomind learn' : undefined,
  });

  // ─── 5. RULES.md ───────────────────────────────────────────
  const rulesPath = join(phantomDir, 'RULES.md');
  const hasRules = existsSync(rulesPath);
  results.push({
    category: 'setup',
    name: 'RULES.md',
    status: hasRules ? 'ok' : 'warn',
    message: hasRules ? 'Found .phantomind/RULES.md' : 'Not found — no custom AI rules yet',
    fix: !hasRules ? 'Run: phantomind init to generate RULES.md' : undefined,
  });

  // ─── 6. .env file ──────────────────────────────────────────
  const envPath = join(phantomDir, '.env');
  const hasEnv = existsSync(envPath);
  results.push({
    category: 'setup',
    name: '.phantomind/.env',
    status: hasEnv ? 'ok' : 'warn',
    message: hasEnv
      ? 'Found .phantomind/.env'
      : 'Not found — API keys must be in shell environment',
    fix: !hasEnv
      ? 'Create .phantomind/.env with ANTHROPIC_API_KEY=... (or other provider keys)'
      : undefined,
  });

  // ─── 7. Adapter files ─────────────────────────────────────
  let config;
  try {
    config = await loadConfig(projectRoot);
  } catch {
    config = null;
  }

  if (config) {
    const ADAPTER_PATHS: Record<string, string> = {
      copilot: '.github/copilot-instructions.md',
      cursor: '.cursorrules',
      cline: '.clinerules',
      continue: '.continue/config.json',
      windsurf: '.windsurfrules',
      zed: '.zed/settings.json',
      aider: '.aider.conf.yml',
      'claude-code': '.claude/CLAUDE.md',
      codex: 'AGENTS.md',
    };

    for (const adapter of config.adapters) {
      const outPath = ADAPTER_PATHS[adapter];
      if (!outPath) continue;
      const fullPath = join(projectRoot, outPath);
      const exists = existsSync(fullPath);
      results.push({
        category: 'adapters',
        name: `${adapter} adapter`,
        status: exists ? 'ok' : 'warn',
        message: exists ? `${outPath} in sync` : `${outPath} not yet generated`,
        fix: !exists ? `Run: phantomind sync` : undefined,
      });
    }
  }

  // ─── 8. Provider API key ──────────────────────────────────
  if (config?.providers?.primary) {
    const primary = config.providers.primary;
    const KEY_VARS: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      gemini: 'GEMINI_API_KEY',
      groq: 'GROQ_API_KEY',
      mistral: 'MISTRAL_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      ollama: '',
    };
    const keyVar = KEY_VARS[primary.name] ?? '';
    const hasKey = !keyVar || !!primary.apiKey || !!process.env[keyVar];
    results.push({
      category: 'providers',
      name: `${primary.name} API key`,
      status: hasKey ? 'ok' : 'warn',
      message: hasKey
        ? `${primary.name} key configured`
        : `${keyVar} not set — agent/eval commands will fail`,
      fix: !hasKey
        ? `Set ${keyVar} in .phantomind/.env or shell environment`
        : undefined,
    });

    // ─── 9. Live provider ping ────────────────────────────────
    if (hasKey) {
      spinner?.stop();
      const pingSpinner = options.json ? null : ora(`Pinging ${primary.name}...`).start();
      try {
        const provider = createProvider(primary);
        const available = await provider.isAvailable();
        results.push({
          category: 'providers',
          name: `${primary.name} connectivity`,
          status: available ? 'ok' : 'warn',
          message: available
            ? `${primary.name} (${primary.model}) reachable`
            : `${primary.name} unreachable — check API key and network`,
          fix: !available ? `Verify ${primary.name} API key is valid` : undefined,
        });
        pingSpinner?.succeed(`${primary.name} reachable`);
      } catch {
        results.push({
          category: 'providers',
          name: `${primary.name} connectivity`,
          status: 'warn',
          message: `${primary.name} ping failed (skipped)`,
        });
        pingSpinner?.warn(`${primary.name} ping skipped`);
      }
      spinner?.start('Running checks...');
    }
  } else {
    results.push({
      category: 'providers',
      name: 'LLM provider',
      status: 'warn',
      message: 'No primary provider configured — agent/eval commands unavailable',
      fix: 'Add providers.primary to .phantomind/config.yaml',
    });
  }

  // ─── 10. Git repo ─────────────────────────────────────────
  const hasGit = existsSync(join(projectRoot, '.git'));
  results.push({
    category: 'environment',
    name: 'Git repository',
    status: hasGit ? 'ok' : 'warn',
    message: hasGit ? 'Git repository detected' : 'Not a git repo — git hooks unavailable',
    fix: !hasGit ? 'Run: git init' : undefined,
  });

  // ─── 11. .gitignore contains .phantomind/.env ─────────────
  const gitignorePath = join(projectRoot, '.gitignore');
  let envIgnored = false;
  if (existsSync(gitignorePath)) {
    const gi = readFileSync(gitignorePath, 'utf-8');
    envIgnored = gi.includes('.phantomind/.env') || gi.includes('.env');
  }
  results.push({
    category: 'security',
    name: '.phantomind/.env gitignored',
    status: envIgnored ? 'ok' : 'warn',
    message: envIgnored
      ? '.phantomind/.env is gitignored'
      : '.phantomind/.env may not be gitignored — risk of leaking API keys',
    fix: !envIgnored
      ? 'Add ".phantomind/.env" to .gitignore'
      : undefined,
  });

  spinner?.stop();

  // ─── Output ────────────────────────────────────────────────
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const categories = [...new Set(results.map(r => r.category))];
  const icons = { ok: chalk.green('✓'), warn: chalk.yellow('⚠'), error: chalk.red('✖'), skip: chalk.dim('–') };
  const counts = { ok: 0, warn: 0, error: 0, skip: 0 };

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    console.log(chalk.bold(`  ${category.toUpperCase()}`));
    for (const r of categoryResults) {
      counts[r.status]++;
      const line = `  ${icons[r.status]}  ${r.name.padEnd(32)} ${chalk.dim(r.message)}`;
      console.log(line);
      if (r.fix && (r.status === 'error' || r.status === 'warn')) {
        console.log(`     ${chalk.dim.italic('→ ' + r.fix)}`);
      }
    }
    console.log('');
  }

  console.log('──────────────────────────────────────────────────');
  const summary = [
    counts.ok > 0 ? chalk.green(`${counts.ok} passed`) : '',
    counts.warn > 0 ? chalk.yellow(`${counts.warn} warnings`) : '',
    counts.error > 0 ? chalk.red(`${counts.error} errors`) : '',
  ].filter(Boolean).join('  ');
  console.log(`  ${summary}`);

  if (counts.error > 0) {
    console.log(`\n  ${chalk.red('Fix errors above before using PhantomindAI.')}`);
    console.log('');
    process.exit(1);
  } else if (counts.warn > 0) {
    console.log(`\n  ${chalk.yellow('Some optional features may be unavailable.')}`);
  } else {
    console.log(`\n  ${chalk.green('✅ PhantomindAI is fully configured!')}`);
  }
  console.log('');
}
