/**
 * PhantomindAI — CLI Validate Command
 * Validate code output for quality issues.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { SecretScanner } from '../quality/secret-scanner.js';
import { HallucinationGuard } from '../quality/hallucination-guard.js';
import { ConsistencyEnforcer } from '../quality/consistency.js';

export interface ValidateOptions {
  files?: string[];
  secrets?: boolean;
  hallucinations?: boolean;
  consistency?: boolean;
  fix?: boolean;
}

export async function validateCommand(
  projectRoot: string,
  options: ValidateOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;
  const fastGlob = (await import('fast-glob')).default;

  console.log(chalk.bold.cyan('\n🔍 PhantomindAI — Code Validation\n'));

  const spinner = ora('Scanning files...').start();
  let totalIssues = 0;

  try {
    // Determine files to scan
    let files: string[];
    if (options.files && options.files.length > 0) {
      files = options.files.filter(f => existsSync(f));
    } else {
      files = await fastGlob(['**/*.{ts,tsx,js,jsx,py,go,rs,java,kt,swift}'], {
        cwd: projectRoot,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
        absolute: true,
      });
    }

    spinner.text = `Found ${files.length} files to validate`;

    // Secret scanning
    if (options.secrets !== false) {
      spinner.text = 'Scanning for secrets...';
      const scanner = new SecretScanner();
      let secretCount = 0;

      for (const file of files) {
        const content = await readFile(file, 'utf-8');
        const secrets = scanner.scan(content, file);
        if (secrets.length > 0) {
          secretCount += secrets.length;
          for (const secret of secrets) {
            const relPath = file.replace(projectRoot + '/', '');
            console.log(
              `  ${chalk.red('SECRET')} ${chalk.dim(relPath)}:${secret.line} ${chalk.yellow(secret.pattern)} ${chalk.dim(`[${secret.severity}]`)}`,
            );

            if (options.fix) {
              const { cleaned } = scanner.scanAndReplace(content, file);
              await import('node:fs/promises').then(fs => fs.writeFile(file, cleaned));
            }
          }
        }
      }

      totalIssues += secretCount;
      if (secretCount > 0) {
        console.log(chalk.red(`\n  Found ${secretCount} secret(s)${options.fix ? ' (auto-fixed)' : ''}`));
      } else {
        console.log(chalk.green('  ✓ No secrets detected'));
      }
      console.log('');
    }

    // Hallucination checking
    if (options.hallucinations !== false) {
      spinner.text = 'Checking for hallucinations...';
      const guard = new HallucinationGuard(projectRoot);
      let hallucinationCount = 0;

      for (const file of files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'))) {
        const content = await readFile(file, 'utf-8');
        const issues = await guard.check(content, file);
        if (issues.length > 0) {
          hallucinationCount += issues.length;
          for (const issue of issues) {
            const relPath = file.replace(projectRoot + '/', '');
            console.log(
              `  ${chalk.yellow('HALLUCINATION')} ${chalk.dim(relPath)}:${issue.line} [${issue.type}] ${issue.reference} ${issue.exists ? chalk.green('exists') : chalk.red('not found')}`,
            );
            if (issue.suggestions && issue.suggestions.length > 0) {
              console.log(chalk.dim(`    Suggestions: ${issue.suggestions.join(', ')}`));
            }
          }
        }
      }

      totalIssues += hallucinationCount;
      if (hallucinationCount > 0) {
        console.log(chalk.yellow(`\n  Found ${hallucinationCount} potential hallucination(s)`));
      } else {
        console.log(chalk.green('  ✓ No hallucinations detected'));
      }
      console.log('');
    }

    // Consistency checking
    if (options.consistency !== false) {
      spinner.text = 'Checking consistency...';
      const enforcer = new ConsistencyEnforcer(projectRoot);
      const report = await enforcer.scan();

      if (report.issues.length > 0) {
        totalIssues += report.issues.length;
        for (const issue of report.issues) {
          console.log(
            `  ${chalk.magenta('CONSISTENCY')} ${chalk.dim(issue.files.join(', '))} ${issue.description} ${chalk.dim(`[${issue.severity}]`)}`,
          );
        }
        console.log(chalk.magenta(`\n  Found ${report.issues.length} consistency issue(s)`));
      } else {
        console.log(chalk.green('  ✓ No consistency issues'));
      }
      console.log('');
    }

    spinner.stop();

    // Summary
    console.log(chalk.dim('─'.repeat(50)));
    if (totalIssues > 0) {
      console.log(chalk.yellow(`\n⚠️  Total: ${totalIssues} issue(s) found`));
    } else {
      console.log(chalk.green('\n✅ All checks passed!'));
    }
    console.log('');

    if (totalIssues > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    spinner.fail('Validation failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
