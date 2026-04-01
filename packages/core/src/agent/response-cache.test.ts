import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResponseCache } from './response-cache';

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache(10, 1000); // 10 entries, 1 second TTL for testing
  });

  describe('Basic Operations', () => {
    it('should store and retrieve a response', () => {
      cache.set('test prompt', 'test response', 'claude-3', 'anthropic', 0.01);
      const result = cache.get('test prompt', 'claude-3');
      expect(result).toBe('test response');
    });

    it('should return null for unknown prompts', () => {
      const result = cache.get('unknown prompt', 'claude-3');
      expect(result).toBeNull();
    });

    it('should track cache hits and misses', () => {
      cache.set('prompt', 'response', 'model', 'provider', 0.01);
      cache.get('prompt', 'model');
      cache.get('nonexistent', 'model');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should check cache existence without retrieval', () => {
      cache.set('prompt', 'response', 'model', 'provider', 0.01);
      expect(cache.has('prompt', 'model')).toBe(true);
      expect(cache.has('unknown', 'model')).toBe(false);
    });
  });

  describe('Semantic Deduplication', () => {
    it('should deduplicate similar prompts with different whitespace', () => {
      cache.set('test   prompt', 'response1', 'model', 'provider', 0.01);
      cache.set('test prompt', 'response2', 'model', 'provider', 0.02);

      // Should retrieve first response (cached)
      const result = cache.get('test   prompt', 'model');
      expect(result).toBe('response1');
    });

    it('should deduplicate prompts with timestamps removed', () => {
      cache.set('Created at 1234567890 timestamp', 'response1', 'model', 'provider', 0.01);
      cache.set('Created at 9876543210 timestamp', 'response1', 'model', 'provider', 0.01);

      // Both should be treated as same semantic prompt
      const result = cache.get('Created at 9999999999 timestamp', 'model');
      expect(result).toBe('response1');
    });

    it('should deduplicate prompts with UUIDs removed', () => {
      const uuid1 = 'Process UUID a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const uuid2 = 'Process UUID f1e2d3c4-b5a6-9870-dcba-ef9876543210';

      cache.set(uuid1, 'response', 'model', 'provider', 0.01);
      const result = cache.get(uuid2, 'model');
      expect(result).toBe('response');
    });

    it('should differentiate by model', () => {
      cache.set('prompt', 'response1', 'claude-3', 'anthropic', 0.01);
      cache.set('prompt', 'response2', 'gpt-4', 'openai', 0.02);

      expect(cache.get('prompt', 'claude-3')).toBe('response1');
      expect(cache.get('prompt', 'gpt-4')).toBe('response2');
    });

    it('should be case-insensitive', () => {
      cache.set('Test Prompt', 'response', 'model', 'provider', 0.01);
      const result = cache.get('test prompt', 'model');
      expect(result).toBe('response');
    });
  });

  describe('TTL & Expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTtl = 100; // 100ms
      cache.set('prompt', 'response', 'model', 'provider', 0.01, shortTtl);

      expect(cache.get('prompt', 'model')).toBe('response');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.get('prompt', 'model')).toBeNull();
    });

    it('should use default TTL if not specified', () => {
      cache.set('prompt', 'response', 'model', 'provider', 0.01);
      const stats = cache.getStats();
      expect(stats.entries).toBe(1);
    });

    it('should prune expired entries', async () => {
      cache.set('prompt1', 'response1', 'model', 'provider', 0.01, 100);
      cache.set('prompt2', 'response2', 'model', 'provider', 0.01, 5000);

      await new Promise(resolve => setTimeout(resolve, 150));

      const pruned = cache.prune();
      expect(pruned).toBe(1);
      expect(cache.size()).toBe(1);
      expect(cache.has('prompt2', 'model')).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should evict oldest entry when at capacity', () => {
      const smallCache = new ResponseCache(3, 1000);

      smallCache.set('p1', 'r1', 'model', 'provider', 0.01);
      smallCache.set('p2', 'r2', 'model', 'provider', 0.01);
      smallCache.set('p3', 'r3', 'model', 'provider', 0.01);

      const statsBefore = smallCache.getStats();
      expect(statsBefore.entries).toBe(3);

      // This should trigger eviction of oldest (p1)
      smallCache.set('p4', 'r4', 'model', 'provider', 0.01);

      const statsAfter = smallCache.getStats();
      expect(statsAfter.entries).toBe(3); // Still at capacity
      expect(smallCache.get('p1', 'model')).toBeNull(); // p1 was evicted
      expect(smallCache.get('p4', 'model')).toBe('r4'); // p4 exists
    });

    it('should not evict when adding duplicate', () => {
      const smallCache = new ResponseCache(2, 1000);

      smallCache.set('p1', 'r1', 'model', 'provider', 0.01);
      smallCache.set('p2', 'r2', 'model', 'provider', 0.01);

      // Update existing entry (should not evict)
      smallCache.set('p1', 'r1-updated', 'model', 'provider', 0.01);

      expect(smallCache.size()).toBe(2);
      expect(smallCache.get('p2', 'model')).toBe('r2');
    });

    it('should clear all entries', () => {
      cache.set('p1', 'r1', 'model', 'provider', 0.01);
      cache.set('p2', 'r2', 'model', 'provider', 0.01);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('p1', 'model')).toBeNull();
    });
  });

  describe('Statistics & Metrics', () => {
    it('should track total cost saved', () => {
      cache.set('p1', 'r1', 'model', 'provider', 0.05);
      cache.set('p2', 'r2', 'model', 'provider', 0.03);

      cache.get('p1', 'model'); // Hit: +$0.05
      cache.get('p1', 'model'); // Hit: +$0.05
      cache.get('p2', 'model'); // Hit: +$0.03

      const stats = cache.getStats();
      expect(stats.totalSaved).toBeCloseTo(0.13, 2);
    });

    it('should calculate hit rate percentage', () => {
      cache.set('p1', 'r1', 'model', 'provider', 0.01);

      cache.get('p1', 'model'); // Hit
      cache.get('p1', 'model'); // Hit
      cache.get('unknown', 'model'); // Miss

      const hitRate = cache.getHitRate();
      expect(hitRate).toBe(66); // 2 hits / 3 total = 66%
    });

    it('should return 0 hit rate if no queries', () => {
      expect(cache.getHitRate()).toBe(0);
    });

    it('should format status for display', () => {
      cache.set('p1', 'r1', 'model', 'provider', 0.01);
      cache.get('p1', 'model');

      const status = cache.formatStatus();
      expect(status).toContain('Cache Status');
      expect(status).toContain('Entries: 1/');
      expect(status).toContain('Hits:');
      expect(status).toContain('Cost Saved');
    });
  });

  describe('Serialization', () => {
    it('should export cache as JSON', () => {
      cache.set('p1', 'r1', 'claude-3', 'anthropic', 0.01);
      cache.set('p2', 'r2', 'gpt-4', 'openai', 0.02);

      const json = cache.toJSON();
      expect(json).toHaveLength(2);
      expect(json[0]).toHaveProperty('prompt');
      expect(json[0]).toHaveProperty('response');
      expect(json[0]).toHaveProperty('model');
      expect(json[0]).toHaveProperty('provider');
      expect(json[0]).toHaveProperty('cost');
    });

    it('should import cache from JSON', () => {
      cache.set('p1', 'r1', 'model', 'provider', 0.01);
      const exported = cache.toJSON();

      const newCache = new ResponseCache();
      newCache.fromJSON(exported);

      expect(newCache.size()).toBe(1);
      expect(newCache.get('p1', 'model')).toBe('r1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prompts', () => {
      cache.set('', 'response', 'model', 'provider', 0.01);
      expect(cache.get('', 'model')).toBe('response');
    });

    it('should handle very long responses', () => {
      const longResponse = 'x'.repeat(100000);
      cache.set('prompt', longResponse, 'model', 'provider', 0.01);
      expect(cache.get('prompt', 'model')).toBe(longResponse);
    });

    it('should handle special characters in prompts', () => {
      const specialPrompt = 'Test @#$%^&*(){}[]|\\:;"<>?,./';
      cache.set(specialPrompt, 'response', 'model', 'provider', 0.01);
      expect(cache.get(specialPrompt, 'model')).toBe('response');
    });

    it('should handle zero cost', () => {
      cache.set('prompt', 'response', 'model', 'provider', 0);
      cache.get('prompt', 'model');

      const stats = cache.getStats();
      expect(stats.totalSaved).toBe(0);
    });
  });
});
