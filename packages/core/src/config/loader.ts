/**
 * PhantomMindAI — Configuration Loader
 */

import { readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { PhantomConfig, PhantomConfigSchema } from '../types.js';

const DEFAULT_CONFIG: PhantomConfig = {
  version: '1',
  providers: {
    primary: {
      name: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 8096,
      temperature: 0.2,
    },
  },
  context: {
    skills: '.phantomind/SKILLS.md',
    rules: '.phantomind/RULES.md',
    schema: '.phantomind/schema.json',
    prds: '.phantomind/prds/',
    decisions: '.phantomind/decisions/',
  },
  adapters: ['copilot', 'cursor', 'cline', 'continue', 'windsurf'],
  mcp: {
    enabled: true,
    port: 3741,
    autoStart: true,
  },
  quality: {
    secretScanner: true,
    hallucinationGuard: true,
    dualVerification: false,
  },
  agent: {
    maxSteps: 30,
    humanCheckpoint: {
      before: ['write_file', 'delete_file', 'run_command'],
      after: ['run_tests'],
      onError: true,
      onAnomalyDetected: true,
    },
    sandbox: {
      allowedCommands: ['npm test', 'npm run build', 'npx tsc --noEmit'],
      networkAccess: false,
    },
    memory: {
      type: 'persistent',
      path: '.phantomind/memory/',
    },
  },
  budget: {
    maxTokensPerTask: 100000,
    maxCostPerDay: 10.0,
    warningAt: 80,
    fallbackOnBudget: 'budget',
  },
  git: {
    autoCommit: false,
    commitMessageFormat: 'conventional',
    requireApproval: true,
  },
  team: {
    contextSync: false,
    remoteContext: '',
  },
};

/**
 * Find project root by looking for .phantomind/ directory
 */
export async function findProjectRoot(startDir?: string): Promise<string> {
  let dir = startDir ? resolve(startDir) : process.cwd();
  const root = resolve('/');

  while (dir !== root) {
    try {
      await access(join(dir, '.phantomind'));
      return dir;
    } catch {
      dir = resolve(dir, '..');
    }
  }

  // If no .phantomind/ found, use cwd
  return startDir ? resolve(startDir) : process.cwd();
}

/**
 * Resolve environment variable references in config values
 */
function resolveEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)\}/g, (_, envVar: string) => {
      return process.env[envVar] ?? '';
    });
  }
  if (Array.isArray(value)) {
    return value.map(resolveEnvVars);
  }
  if (value !== null && typeof value === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      resolved[key] = resolveEnvVars(val);
    }
    return resolved;
  }
  return value;
}

/**
 * Load PhantomMindAI configuration from .phantomind/config.yaml
 */
export async function loadConfig(projectRoot?: string): Promise<PhantomConfig> {
  const root = projectRoot ?? await findProjectRoot();
  const configPath = join(root, '.phantomind', 'config.yaml');
  const legacyJsonPath = join(root, 'phantomind.config.json');

  try {
    const raw = existsSync(configPath)
      ? await readFile(configPath, 'utf-8')
      : await readFile(legacyJsonPath, 'utf-8');
    const parsed = existsSync(configPath)
      ? yaml.load(raw) as Record<string, unknown>
      : JSON.parse(raw) as Record<string, unknown>;
    const resolved = resolveEnvVars(parsed) as Record<string, unknown>;

    // Deep merge with defaults
    const merged = deepMerge(DEFAULT_CONFIG, resolved) as PhantomConfig;

    // Validate
    const result = PhantomConfigSchema.safeParse(merged);
    if (!result.success) {
      const errors = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Invalid PhantomMindAI config:\n${errors}`);
    }

    return result.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_CONFIG;
    }
    throw err;
  }
}

/**
 * Load .phantomind/.env file into process.env
 */
export async function loadEnvFile(projectRoot?: string): Promise<void> {
  const root = projectRoot ?? await findProjectRoot();
  const envPath = join(root, '.phantomind', '.env');

  try {
    const content = await readFile(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not required
  }
}

/**
 * Get the default configuration
 */
export function getDefaultConfig(): PhantomConfig {
  return structuredClone(DEFAULT_CONFIG);
}

/**
 * Deep merge two objects
 */
export function deepMerge(target: unknown, source: unknown): unknown {
  if (source === undefined || source === null) return target;
  if (target === undefined || target === null) return source;

  if (typeof target !== 'object' || typeof source !== 'object') {
    return source;
  }

  if (Array.isArray(source)) return source;

  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    result[key] = deepMerge(result[key], value);
  }
  return result;
}
