/**
 * Response Cache for LLM Completions
 * Memoizes LLM responses with TTL and semantic deduplication
 * Reduces API calls and costs during development cycles
 */

import type { Readable } from 'node:stream';
import crypto from 'node:crypto';

export interface CacheEntry {
  hash: string;
  prompt: string;
  response: string;
  model: string;
  provider: string;
  timestamp: number;
  ttl: number; // milliseconds
  cost: number; // estimated cost of this response
}

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  totalSaved: number; // estimated cost saved in USD
}

/**
 * LLM Response Cache
 * - TTL-based expiration (configurable per entry)
 * - Semantic deduplication (similar prompts hash to same key)
 * - Memory-bounded (configurable max entries)
 * - Cost tracking (know how much cache saved)
 */
export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    entries: 0,
    totalSaved: 0,
  };

  constructor(
    private maxEntries: number = 500,
    private defaultTtl: number = 24 * 60 * 60 * 1000, // 24 hours
  ) {}

  /**
   * Generate semantic hash of prompt (for deduplication)
   * - Normalizes whitespace & punctuation
   * - Removes variable parts (timestamps, UUIDs)
   * - Creates consistent hash for similar prompts
   */
  private semanticHash(prompt: string, model: string): string {
    // Normalize whitespace
    const normalized = prompt
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    // Remove variable content (timestamps, random IDs)
    const deduplicated = normalized
      .replace(/\b\d{10,}\b/g, '[NUM]') // Unix timestamps
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '[UUID]')
      .replace(/\b[a-f0-9]{32}\b/gi, '[HASH]');

    // Include model in hash (different models = different responses)
    const combined = `${deduplicated}|${model}`;

    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Store a response in cache
   */
  set(
    prompt: string,
    response: string,
    model: string,
    provider: string,
    cost: number,
    ttl?: number,
  ): void {
    const hash = this.semanticHash(prompt, model);

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(hash)) {
      const oldest = Array.from(this.cache.values()).reduce((a, b) =>
        a.timestamp < b.timestamp ? a : b,
      );
      this.cache.delete(oldest.hash);
    }

    this.cache.set(hash, {
      hash,
      prompt,
      response,
      model,
      provider,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
      cost,
    });

    this.stats.entries = this.cache.size;
  }

  /**
   * Retrieve cached response if exists and not expired
   */
  get(prompt: string, model: string): string | null {
    const hash = this.semanticHash(prompt, model);
    const entry = this.cache.get(hash);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(hash);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    this.stats.totalSaved += entry.cost;
    return entry.response;
  }

  /**
   * Check if response exists in cache without retrieving
   */
  has(prompt: string, model: string): boolean {
    const hash = this.semanticHash(prompt, model);
    const entry = this.cache.get(hash);

    if (!entry) return false;

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(hash);
      return false;
    }

    return true;
  }

  /**
   * Clear expired entries
   */
  prune(): number {
    let pruned = 0;
    const now = Date.now();

    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(hash);
        pruned++;
      }
    }

    this.stats.entries = this.cache.size;
    return pruned;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.entries = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache hit rate percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return Math.round((this.stats.hits / total) * 100);
  }

  /**
   * Get number of entries currently in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Export cache as JSON (for persistence)
   */
  toJSON(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Import cache from JSON (for restoration)
   */
  fromJSON(entries: CacheEntry[]): void {
    this.cache.clear();
    for (const entry of entries) {
      this.cache.set(entry.hash, entry);
    }
    this.stats.entries = this.cache.size;
  }

  /**
   * Format cache status for display
   */
  formatStatus(): string {
    const hitRate = this.getHitRate();
    const savedFormatted = `$${this.stats.totalSaved.toFixed(2)}`;

    return [
      `📦 Cache Status`,
      `  Entries: ${this.stats.entries}/${this.maxEntries}`,
      `  Hits: ${this.stats.hits} | Misses: ${this.stats.misses} | Rate: ${hitRate}%`,
      `  Cost Saved: ${savedFormatted}`,
    ].join('\n');
  }
}

export default ResponseCache;
