/**
 * PhantomMindAI — Context Versioning
 * Track changes to context files with git-like versioning.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { ContextVersionEntry } from '../types.js';

export class ContextVersioning {
  private projectRoot: string;
  private historyPath: string;
  private history: ContextVersionEntry[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.historyPath = join(projectRoot, '.phantomind', 'memory', 'context-versions.json');
  }

  /**
   * Load version history
   */
  async load(): Promise<void> {
    try {
      const raw = await readFile(this.historyPath, 'utf-8');
      this.history = JSON.parse(raw);
    } catch {
      this.history = [];
    }
  }

  /**
   * Record a new version snapshot
   */
  async snapshot(files: string[], message: string, author = 'phantomind'): Promise<ContextVersionEntry> {
    const contents = await Promise.all(
      files.map(async (f) => {
        try {
          return await readFile(join(this.projectRoot, f), 'utf-8');
        } catch {
          return '';
        }
      }),
    );

    const combined = contents.join('\n---\n');
    const hash = createHash('sha256').update(combined).digest('hex').slice(0, 12);

    const entry: ContextVersionEntry = {
      hash,
      timestamp: new Date().toISOString(),
      author,
      message,
      files,
    };

    await this.load();

    // Only add if content has changed
    if (this.history.length === 0 || this.history[this.history.length - 1].hash !== hash) {
      this.history.push(entry);
      await this.save();
    }

    return entry;
  }

  /**
   * Get version history
   */
  async getHistory(limit = 20): Promise<ContextVersionEntry[]> {
    await this.load();
    return this.history.slice(-limit);
  }

  /**
   * Get a specific version by hash
   */
  async getVersion(hash: string): Promise<ContextVersionEntry | undefined> {
    await this.load();
    return this.history.find(e => e.hash === hash);
  }

  private async save(): Promise<void> {
    try {
      await mkdir(join(this.projectRoot, '.phantomind', 'memory'), { recursive: true });
      await writeFile(this.historyPath, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }
}
