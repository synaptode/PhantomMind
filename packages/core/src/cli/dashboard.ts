/**
 * PhantomMindAI — CLI Dashboard Command
 * Starts the observability dashboard server.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { startDashboardServer } from '../observability/dashboard-server.js';

export interface DashboardOptions {
  port?: string;
  host?: string;
  ui?: string;
  cors?: boolean;
  token?: string;
  tokenEnv?: string;
  tokenQuery?: string;
}

export async function dashboardCommand(
  projectRoot: string,
  options: DashboardOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;

  console.log(chalk.bold.cyan('\n📈 PhantomMindAI — Observability Dashboard\n'));

  const port = Number.parseInt(options.port ?? '3101', 10);
  const host = options.host ?? '127.0.0.1';
  const tokenEnv = options.tokenEnv ?? 'PHANTOMIND_DASHBOARD_TOKEN';
  const authToken = options.token ?? (tokenEnv ? process.env[tokenEnv] : undefined);

  let staticDir: string | undefined;
  if (options.ui) {
    staticDir = resolve(projectRoot, options.ui);
  } else {
    const defaultDir = resolve(projectRoot, 'packages', 'dashboard', 'dist');
    if (existsSync(defaultDir)) {
      staticDir = defaultDir;
    }
  }

  if (!staticDir) {
    console.log(chalk.yellow('Static dashboard build not found. Starting API-only server.'));
    console.log(chalk.dim('Build the UI or pass --ui <path> to serve static assets.'));
    console.log('');
  }

  await startDashboardServer(projectRoot, {
    port: Number.isFinite(port) ? port : 3101,
    host,
    cors: options.cors ?? false,
    staticDir,
    authToken,
    authQueryParam: options.tokenQuery,
  });

  if (staticDir) {
    console.log(chalk.dim(`Serving UI from: ${staticDir}`));
  }
  if (authToken) {
    console.log(chalk.dim('API auth: enabled'));
  } else {
    console.log(chalk.dim('API auth: disabled'));
  }
  console.log(chalk.dim('API endpoints: /api/metrics, /api/costs, /api/audit'));
  console.log('');
}
