/**
 * PhantomMindAI — Adapter Registry & Factory
 */

import { BaseAdapter } from './base.js';
import { CopilotAdapter } from './copilot.js';
import { CursorAdapter } from './cursor.js';
import { ClineAdapter } from './cline.js';
import { ContinueAdapter } from './continue.js';
import { WindsurfAdapter } from './windsurf.js';
import { ZedAdapter } from './zed.js';
import { AiderAdapter } from './aider.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { CodexAdapter } from './codex.js';
import type { AdapterName, SyncResult, PhantomConfig } from '../types.js';

export { BaseAdapter } from './base.js';
export { CopilotAdapter } from './copilot.js';
export { CursorAdapter } from './cursor.js';
export { ClineAdapter } from './cline.js';
export { ContinueAdapter } from './continue.js';
export { WindsurfAdapter } from './windsurf.js';
export { ZedAdapter } from './zed.js';
export { AiderAdapter } from './aider.js';
export { ClaudeCodeAdapter } from './claude-code.js';
export { CodexAdapter } from './codex.js';

const ADAPTER_REGISTRY: Record<AdapterName, () => BaseAdapter> = {
  copilot: () => new CopilotAdapter(),
  cursor: () => new CursorAdapter(),
  cline: () => new ClineAdapter(),
  continue: () => new ContinueAdapter(),
  windsurf: () => new WindsurfAdapter(),
  zed: () => new ZedAdapter(),
  aider: () => new AiderAdapter(),
  'claude-code': () => new ClaudeCodeAdapter(),
  'codex': () => new CodexAdapter(),
};

/**
 * Get an adapter by name
 */
export function getAdapter(name: AdapterName): BaseAdapter {
  const factory = ADAPTER_REGISTRY[name];
  if (!factory) {
    throw new Error(`Unknown adapter: ${name}. Available: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`);
  }
  return factory();
}

/**
 * Get all adapters from config
 */
export function getAdapters(config: PhantomConfig): BaseAdapter[] {
  return config.adapters.map(name => getAdapter(name));
}

/**
 * Sync all configured adapters
 */
export async function syncAllAdapters(
  projectRoot: string,
  config: PhantomConfig,
  dryRun = false,
): Promise<SyncResult[]> {
  const adapters = getAdapters(config);
  const results = await Promise.all(
    adapters.map(adapter => adapter.sync(projectRoot, config, dryRun)),
  );
  return results;
}

/**
 * List all available adapters
 */
export function listAvailableAdapters(): AdapterName[] {
  return Object.keys(ADAPTER_REGISTRY) as AdapterName[];
}
