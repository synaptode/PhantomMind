/**
 * PhantomindAI — Agent Memory
 * Cross-session persistent agent memory for learning from past interactions.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface MemoryEntry {
  id: string;
  timestamp: string;
  type: 'decision' | 'pattern' | 'preference' | 'error' | 'learning';
  category: string;
  content: string;
  metadata: Record<string, unknown>;
  relevance: number; // 0-1
  accessCount: number;
  lastAccessed: string;
}

export interface AgentMemoryStore {
  version: number;
  entries: MemoryEntry[];
  stats: {
    totalEntries: number;
    totalAccesses: number;
    lastUpdated: string;
  };
}

export class AgentMemory {
  private storePath: string;
  private store: AgentMemoryStore;
  private dirty = false;
  private maxEntries: number;

  constructor(projectRoot: string, maxEntries = 1000) {
    this.storePath = join(projectRoot, '.phantomind', 'memory', 'agent-memory.json');
    this.maxEntries = maxEntries;
    this.store = {
      version: 1,
      entries: [],
      stats: { totalEntries: 0, totalAccesses: 0, lastUpdated: new Date().toISOString() },
    };
  }

  /**
   * Load memory from disk
   */
  async load(): Promise<void> {
    try {
      if (existsSync(this.storePath)) {
        const raw = await readFile(this.storePath, 'utf-8');
        this.store = JSON.parse(raw);
      }
    } catch {
      // Start fresh if corrupted
    }
  }

  /**
   * Save memory to disk
   */
  async save(): Promise<void> {
    if (!this.dirty) return;
    const dir = join(this.storePath, '..');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    this.store.stats.lastUpdated = new Date().toISOString();
    await writeFile(this.storePath, JSON.stringify(this.store, null, 2));
    this.dirty = false;
  }

  /**
   * Add a memory entry
   */
  add(
    type: MemoryEntry['type'],
    category: string,
    content: string,
    metadata: Record<string, unknown> = {},
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      type,
      category,
      content,
      metadata,
      relevance: 1.0,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
    };

    this.store.entries.push(entry);
    this.store.stats.totalEntries++;
    this.dirty = true;

    // Evict old entries if over limit
    if (this.store.entries.length > this.maxEntries) {
      this.evict();
    }

    return entry;
  }

  /**
   * Record a decision for future reference
   */
  recordDecision(
    category: string,
    decision: string,
    reasoning: string,
    filesAffected: string[],
  ): MemoryEntry {
    return this.add('decision', category, decision, { reasoning, filesAffected });
  }

  /**
   * Record a learned pattern
   */
  recordPattern(category: string, pattern: string, examples: string[]): MemoryEntry {
    return this.add('pattern', category, pattern, { examples });
  }

  /**
   * Record an error to avoid repeating mistakes
   */
  recordError(
    category: string,
    error: string,
    resolution: string,
    context: Record<string, unknown> = {},
  ): MemoryEntry {
    return this.add('error', category, `Error: ${error}\nResolution: ${resolution}`, context);
  }

  /**
   * Record a learning insight
   */
  recordLearning(category: string, insight: string): MemoryEntry {
    return this.add('learning', category, insight);
  }

  /**
   * Query memory by type and/or category
   */
  query(
    options: {
      type?: MemoryEntry['type'];
      category?: string;
      search?: string;
      limit?: number;
    } = {},
  ): MemoryEntry[] {
    let entries = [...this.store.entries];

    if (options.type) {
      entries = entries.filter(e => e.type === options.type);
    }
    if (options.category) {
      entries = entries.filter(e => e.category === options.category);
    }
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      entries = entries.filter(e => e.content.toLowerCase().includes(searchLower));
    }

    // Update access counts
    for (const entry of entries) {
      entry.accessCount++;
      entry.lastAccessed = new Date().toISOString();
      this.dirty = true;
    }

    this.store.stats.totalAccesses += entries.length;

    // Sort by relevance (recency + frequency)
    entries.sort((a, b) => {
      const aScore = this.computeRelevance(a);
      const bScore = this.computeRelevance(b);
      return bScore - aScore;
    });

    return entries.slice(0, options.limit ?? 50);
  }

  /**
   * Get memory relevant to a given context
   */
  getRelevantMemories(context: string, limit = 10): MemoryEntry[] {
    const keywords = context
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3);

    const scored = this.store.entries.map(entry => {
      const contentLower = entry.content.toLowerCase();
      const keywordHits = keywords.filter(kw => contentLower.includes(kw)).length;
      const recencyScore = this.computeRelevance(entry);
      const totalScore = (keywordHits / Math.max(keywords.length, 1)) * 0.7 + recencyScore * 0.3;
      return { entry, score: totalScore };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter(s => s.score > 0.1)
      .slice(0, limit)
      .map(s => {
        s.entry.accessCount++;
        s.entry.lastAccessed = new Date().toISOString();
        this.dirty = true;
        return s.entry;
      });
  }

  /**
   * Format memories as context for LLM
   */
  formatAsContext(memories: MemoryEntry[]): string {
    if (memories.length === 0) return '';

    const sections = new Map<string, MemoryEntry[]>();
    for (const mem of memories) {
      const key = mem.type;
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)!.push(mem);
    }

    const parts: string[] = ['## Agent Memory'];
    for (const [type, entries] of sections) {
      parts.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}s`);
      for (const entry of entries) {
        parts.push(`- [${entry.category}] ${entry.content}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Get stats
   */
  getStats(): AgentMemoryStore['stats'] & { entryCount: number } {
    return {
      ...this.store.stats,
      entryCount: this.store.entries.length,
    };
  }

  /**
   * Clear all memories (with confirmation)
   */
  clear(): void {
    this.store.entries = [];
    this.store.stats.totalEntries = 0;
    this.dirty = true;
  }

  /**
   * Compute relevance score combining recency and frequency
   */
  private computeRelevance(entry: MemoryEntry): number {
    const age = Date.now() - new Date(entry.timestamp).getTime();
    const daysSinceCreation = age / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-daysSinceCreation / 30); // Decay over 30 days
    const frequency = Math.min(entry.accessCount / 10, 1); // Cap at 10 accesses
    return recency * 0.6 + frequency * 0.4;
  }

  /**
   * Evict least relevant entries
   */
  private evict(): void {
    this.store.entries.sort((a, b) => this.computeRelevance(b) - this.computeRelevance(a));
    this.store.entries = this.store.entries.slice(0, this.maxEntries);
  }
}
