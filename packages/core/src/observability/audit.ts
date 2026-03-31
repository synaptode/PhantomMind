/**
 * PhantomMindAI — Audit Trail
 * Immutable audit logging for all agent actions and decisions.
 */

import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditEntry } from '../types.js';

export class AuditTrail {
  private logDir: string;
  private logFile: string;
  private entries: AuditEntry[] = [];
  private maxInMemory = 500;

  constructor(projectRoot: string) {
    this.logDir = join(projectRoot, '.phantomind', 'audit');
    this.logFile = join(this.logDir, 'audit.jsonl');
  }

  /**
   * Initialize audit directory
   */
  async init(): Promise<void> {
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
    }
  }

  /**
   * Log an audit entry
   */
  async log(entry: Omit<AuditEntry, 'timestamp' | 'id'>): Promise<AuditEntry> {
    const full: AuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };

    this.entries.push(full);
    if (this.entries.length > this.maxInMemory) {
      this.entries = this.entries.slice(-this.maxInMemory);
    }

    // Append to JSONL file
    await this.init();
    await appendFile(this.logFile, JSON.stringify(full) + '\n');

    return full;
  }

  /**
   * Log a provider request
   */
  async logProviderRequest(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    duration: number,
    success: boolean,
    error?: string,
  ): Promise<AuditEntry> {
    return this.log({
      action: 'provider:request',
      agent: 'system',
      details: {
        provider,
        model,
        inputTokens,
        outputTokens,
        cost,
        duration,
        success,
        error,
      },
    });
  }

  /**
   * Log an agent action
   */
  async logAgentAction(
    agent: string,
    action: string,
    details: Record<string, unknown>,
  ): Promise<AuditEntry> {
    return this.log({ action: `agent:${action}`, agent, details });
  }

  /**
   * Log a quality check
   */
  async logQualityCheck(
    checkType: string,
    passed: boolean,
    details: Record<string, unknown>,
  ): Promise<AuditEntry> {
    return this.log({
      action: `quality:${checkType}`,
      agent: 'quality',
      details: { ...details, passed },
    });
  }

  /**
   * Log a sync event
   */
  async logSync(
    adapter: string,
    filesChanged: string[],
    dryRun: boolean,
  ): Promise<AuditEntry> {
    return this.log({
      action: 'sync',
      agent: 'sync',
      details: { adapter, filesChanged, dryRun },
    });
  }

  /**
   * Query recent entries
   */
  getRecent(limit = 50): AuditEntry[] {
    return this.entries.slice(-limit);
  }

  /**
   * Query entries by action type
   */
  getByAction(action: string, limit = 50): AuditEntry[] {
    return this.entries
      .filter(e => e.action === action || e.action.startsWith(action))
      .slice(-limit);
  }

  /**
   * Query entries by agent
   */
  getByAgent(agent: string, limit = 50): AuditEntry[] {
    return this.entries
      .filter(e => e.agent === agent)
      .slice(-limit);
  }

  /**
   * Load entries from disk
   */
  async loadFromDisk(limit = 500): Promise<AuditEntry[]> {
    if (!existsSync(this.logFile)) {
      this.entries = [];
      return [];
    }

    const content = await readFile(this.logFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries = lines
      .slice(-limit)
      .map(line => {
        try { return JSON.parse(line) as AuditEntry; } catch { return null; }
      })
      .filter((e): e is AuditEntry => e !== null);

    this.entries = entries;
    return entries;
  }

  /**
   * Export audit log as markdown report
   */
  exportMarkdown(): string {
    const lines = ['# Audit Trail Report', `Generated: ${new Date().toISOString()}`, ''];

    // Group by action
    const groups = new Map<string, AuditEntry[]>();
    for (const entry of this.entries) {
      const key = entry.action.split(':')[0];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }

    for (const [group, items] of groups) {
      lines.push(`## ${group} (${items.length} events)`);
      for (const item of items.slice(-10)) {
        lines.push(`- \`${item.timestamp}\` ${item.action} by ${item.agent}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Rotate log file (archive old entries)
   */
  async rotate(): Promise<void> {
    if (!existsSync(this.logFile)) return;

    const archiveName = `audit-${new Date().toISOString().slice(0, 10)}.jsonl`;
    const archivePath = join(this.logDir, archiveName);

    const content = await readFile(this.logFile, 'utf-8');
    await writeFile(archivePath, content);
    await writeFile(this.logFile, '');
    this.entries = [];
  }
}
