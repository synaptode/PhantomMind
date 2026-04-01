/**
 * PhantomindAI — Troubleshoot Command
 * Comprehensive diagnostic tool for common issues and remediation suggestions
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface TroubleshootCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  remediation?: string[];
}

export async function troubleshootCommand(projectRoot: string, options: { json?: boolean } = {}): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n🔍 PhantomindAI — Troubleshoot\n'));

  const spinner = ora('Running diagnostics...').start();

  try {
    const checks: TroubleshootCheck[] = [];

    // Check 1: Git repository
    checks.push(checkGitRepo(projectRoot));

    // Check 2: .phantomind directory
    checks.push(checkPhantommindDir(projectRoot));

    // Check 3: Config file
    checks.push(checkConfigFile(projectRoot));

    // Check 4: SKILLS.md
    checks.push(checkSkillsFile(projectRoot));

    // Check 5: .env file
    checks.push(checkEnvFile(projectRoot));

    // Check 6: Provider configuration
    checks.push(checkProviderConfig(projectRoot));

    // Check 7: Adapter files
    checks.push(checkAdapterFiles(projectRoot));

    // Check 8: Security (secrets in repo)
    checks.push(checkSecrets(projectRoot));

    // Check 9: Node modules
    checks.push(checkNodeModules(projectRoot));

    // Check 10: Permissions
    checks.push(checkPermissions(projectRoot));

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(checks, null, 2));
      return;
    }

    // Display results
    const passes = checks.filter(c => c.status === 'pass').length;
    const warns = checks.filter(c => c.status === 'warn').length;
    const fails = checks.filter(c => c.status === 'fail').length;

    console.log(chalk.bold('Diagnostic Results:\n'));

    for (const check of checks) {
      const icon = check.status === 'pass' ? chalk.green('✓') : check.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✖');
      console.log(`${icon} ${check.name}`);
      console.log(`  ${check.message}`);

      if (check.remediation && check.remediation.length > 0) {
        console.log(`  ${chalk.dim('Remediation:')}`);
        for (const step of check.remediation) {
          console.log(`    • ${step}`);
        }
      }
      console.log('');
    }

    // Summary
    console.log(chalk.bold('Summary:'));
    console.log(`  ${chalk.green(`✓ Passed: ${passes}`)}`);
    if (warns > 0) console.log(`  ${chalk.yellow(`⚠ Warnings: ${warns}`)}`);
    if (fails > 0) console.log(`  ${chalk.red(`✖ Failed: ${fails}`)}`);
    console.log('');

    if (fails > 0) {
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Diagnostic failed');
    throw error;
  }
}

function checkGitRepo(projectRoot: string): TroubleshootCheck {
  const gitDir = join(projectRoot, '.git');
  if (existsSync(gitDir)) {
    return { name: 'Git Repository', status: 'pass', message: 'Git repository initialized' };
  }
  return {
    name: 'Git Repository',
    status: 'fail',
    message: 'No .git directory found',
    remediation: ['Run `git init` to initialize a Git repository', 'PhantomindAI requires Git for hooks and version tracking'],
  };
}

function checkPhantommindDir(projectRoot: string): TroubleshootCheck {
  const dir = join(projectRoot, '.phantomind');
  if (existsSync(dir)) {
    return { name: '.phantomind Directory', status: 'pass', message: '.phantomind directory present' };
  }
  return {
    name: '.phantomind Directory',
    status: 'fail',
    message: '.phantomind directory not found',
    remediation: ['Run `phantomind init` to create .phantomind directory and configuration'],
  };
}

function checkConfigFile(projectRoot: string): TroubleshootCheck {
  const configPath = join(projectRoot, '.phantomind', 'config.yaml');
  if (existsSync(configPath)) {
    return { name: 'config.yaml', status: 'pass', message: 'Configuration file present' };
  }
  return {
    name: 'config.yaml',
    status: 'fail',
    message: 'config.yaml not found',
    remediation: ['Run `phantomind init` to generate config.yaml'],
  };
}

function checkSkillsFile(projectRoot: string): TroubleshootCheck {
  const skillsPath = join(projectRoot, '.phantomind', 'SKILLS.md');
  if (existsSync(skillsPath)) {
    return { name: 'SKILLS.md', status: 'pass', message: 'Skills documentation present' };
  }
  return {
    name: 'SKILLS.md',
    status: 'warn',
    message: 'SKILLS.md not found (auto-generated on first learn)',
    remediation: ['Run `phantomind learn` to scan codebase and auto-generate SKILLS.md'],
  };
}

function checkEnvFile(projectRoot: string): TroubleshootCheck {
  const envPath = join(projectRoot, '.phantomind', '.env');
  if (existsSync(envPath)) {
    return { name: '.env File', status: 'pass', message: '.env file present' };
  }
  return {
    name: '.env File',
    status: 'warn',
    message: '.env not found (required for agent/eval commands)',
    remediation: ['Run `phantomind init` to generate .env.example', 'Copy .env.example to .env and add your API keys'],
  };
}

function checkProviderConfig(projectRoot: string): TroubleshootCheck {
  const configPath = join(projectRoot, '.phantomind', 'config.yaml');
  if (!existsSync(configPath)) {
    return { name: 'Provider Configuration', status: 'warn', message: 'Cannot check (config.yaml missing)' };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    if (content.includes('providers:') && !content.includes('name: anthropic') && !content.includes('name: openai')) {
      return {
        name: 'Provider Configuration',
        status: 'warn',
        message: 'No primary provider configured',
        remediation: ['Edit .phantomind/config.yaml and add provider configuration', 'See docs for supported providers: Anthropic, OpenAI, Ollama'],
      };
    }
    return { name: 'Provider Configuration', status: 'pass', message: 'Provider configured' };
  } catch {
    return {
      name: 'Provider Configuration',
      status: 'fail',
      message: 'Error reading config.yaml',
      remediation: ['Check that config.yaml is valid YAML', 'Run `phantomind init` to regenerate'],
    };
  }
}

function checkAdapterFiles(projectRoot: string): TroubleshootCheck {
  const copilotFile = join(projectRoot, '.vscode', 'copilot_instructions.md');
  const cursorFile = join(projectRoot, '.cursor', 'rules', 'rules.md');

  const hasCopilot = existsSync(copilotFile);
  const hasCursor = existsSync(cursorFile);

  if (hasCopilot || hasCursor) {
    const adapters = [hasCopilot && 'Copilot', hasCursor && 'Cursor'].filter(Boolean).join(', ');
    return { name: 'Adapter Files', status: 'pass', message: `Adapter files synced (${adapters})` };
  }

  return {
    name: 'Adapter Files',
    status: 'warn',
    message: 'No adapter files found',
    remediation: ['Run `phantomind sync` to generate adapter configuration files', 'This syncs SKILLS.md and RULES.md to your AI tools'],
  };
}

function checkSecrets(projectRoot: string): TroubleshootCheck {
  const gitignorePath = join(projectRoot, '.gitignore');
  if (!existsSync(gitignorePath)) {
    return {
      name: 'Security (.gitignore)',
      status: 'warn',
      message: 'No .gitignore file found',
      remediation: ['Create a .gitignore file', 'Add `.phantomind/.env` to prevent committing secrets'],
    };
  }

  try {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (content.includes('.env') || content.includes('.phantomind/.env')) {
      return { name: 'Security (.gitignore)', status: 'pass', message: '.env file properly ignored in .gitignore' };
    }
    return {
      name: 'Security (.gitignore)',
      status: 'warn',
      message: '.env file not in .gitignore (potential security risk)',
      remediation: ['Add `.phantomind/.env` to .gitignore to prevent accidentally committing secrets'],
    };
  } catch {
    return { name: 'Security (.gitignore)', status: 'fail', message: 'Error reading .gitignore' };
  }
}

function checkNodeModules(projectRoot: string): TroubleshootCheck {
  const nodeModulesPath = join(projectRoot, 'node_modules');
  if (existsSync(nodeModulesPath)) {
    return { name: 'Dependencies', status: 'pass', message: 'node_modules directory present' };
  }
  return {
    name: 'Dependencies',
    status: 'warn',
    message: 'node_modules not found',
    remediation: ['Run `npm install` to install dependencies', 'This may be needed for project analysis'],
  };
}

function checkPermissions(projectRoot: string): TroubleshootCheck {
  const phantomindDir = join(projectRoot, '.phantomind');
  if (!existsSync(phantomindDir)) {
    return { name: 'File Permissions', status: 'warn', message: 'Cannot check (.phantomind missing)' };
  }

  try {
    const stat = require('node:fs').statSync(phantomindDir);
    if (stat.isDirectory()) {
      return { name: 'File Permissions', status: 'pass', message: '.phantomind directory is readable and writable' };
    }
  } catch {
    return {
      name: 'File Permissions',
      status: 'fail',
      message: 'Cannot access .phantomind directory (permission denied)',
      remediation: ['Check directory permissions: `ls -la .phantomind`', 'Run with appropriate user/sudo if needed'],
    };
  }

  return { name: 'File Permissions', status: 'pass', message: '.phantomind directory accessible' };
}
