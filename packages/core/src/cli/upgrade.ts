/**
 * PhantomindAI — CLI Upgrade Command
 * Self-update: check npm for newer version and install if available.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getInstalledVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getLatestVersion(): string {
  const raw = execSync('npm view @phantomind/core version --json', { encoding: 'utf-8', timeout: 10000 });
  return raw.trim().replace(/"/g, '');
}

function isNewer(latest: string, installed: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [lMaj, lMin, lPat] = parse(latest);
  const [iMaj, iMin, iPat] = parse(installed);
  if (lMaj !== iMaj) return lMaj > iMaj;
  if (lMin !== iMin) return lMin > iMin;
  return lPat > iPat;
}

export async function upgradeCommand(): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  console.log(chalk.bold.cyan('\n⬆  PhantomindAI — Upgrade\n'));

  const installed = getInstalledVersion();
  const spinner = ora(`Checking npm for latest version (installed: v${installed})...`).start();

  let latest: string;
  try {
    latest = getLatestVersion();
  } catch {
    spinner.fail('Could not reach npm registry. Check your internet connection.');
    return;
  }

  if (!isNewer(latest, installed)) {
    spinner.succeed(`Already up to date: v${installed} is the latest.`);
    console.log('');
    return;
  }

  spinner.text = `Upgrading from v${installed} → v${latest}...`;
  try {
    execSync(`npm install -g @phantomind/core@${latest}`, { stdio: 'pipe', timeout: 60000 });
    spinner.succeed(`Upgraded to v${latest} 🎉`);
    console.log('');
    console.log(chalk.dim('  Run `phantomind check` to verify the new installation.'));
  } catch (err) {
    spinner.fail(`Upgrade failed: ${(err as Error).message}`);
    console.log(chalk.dim('  Try manually: npm install -g @phantomind/core@latest'));
  }
  console.log('');
}
