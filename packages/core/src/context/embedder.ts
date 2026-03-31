/**
 * PhantomMindAI — Live Codebase Embedder
 * Creates and maintains embeddings of project source files for semantic search.
 */

import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import fastGlob from 'fast-glob';

/** Simple TF-IDF based embedding for local, zero-API-key operation */
interface FileEmbedding {
  path: string;
  tokens: string[];
  tfidf: Map<string, number>;
  lastModified: number;
}

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.swift', '.go', '.py', '.rs', '.java',
  '.kt', '.rb', '.php', '.c', '.cpp', '.h', '.cs', '.vue', '.svelte',
  '.md', '.json', '.yaml', '.yml', '.toml',
]);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.phantomind/cache', '.phantomind/memory', '.phantomind/audit',
  'vendor', '__pycache__', '.tox', 'venv', '.venv',
]);

export class CodebaseEmbedder {
  private projectRoot: string;
  private embeddings: Map<string, FileEmbedding> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private totalDocuments = 0;
  private cachePath: string;
  private initialized = false;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.cachePath = join(projectRoot, '.phantomind', 'cache', 'embeddings.json');
  }

  /**
   * Build or update embeddings for the codebase
   */
  async build(): Promise<{ indexed: number; skipped: number }> {
    let indexed = 0;
    let skipped = 0;

    const files = await fastGlob('**/*', {
      cwd: this.projectRoot,
      ignore: [...IGNORE_DIRS].map(d => `${d}/**`),
      onlyFiles: true,
      absolute: false,
    });

    const sourceFiles = files.filter(f => CODE_EXTENSIONS.has(extname(f)));

    // Build TF for each document
    for (const file of sourceFiles) {
      const fullPath = join(this.projectRoot, file);
      try {
        const stats = await stat(fullPath);
        const existing = this.embeddings.get(file);

        // Skip if not modified
        if (existing && existing.lastModified >= stats.mtimeMs) {
          skipped++;
          continue;
        }

        const content = await readFile(fullPath, 'utf-8');
        const tokens = this.tokenize(content);
        const tf = this.computeTF(tokens);

        this.embeddings.set(file, {
          path: file,
          tokens,
          tfidf: tf,
          lastModified: stats.mtimeMs,
        });
        indexed++;
      } catch {
        skipped++;
      }
    }

    // Compute IDF
    this.totalDocuments = this.embeddings.size;
    this.documentFrequency.clear();

    for (const embedding of this.embeddings.values()) {
      const uniqueTokens = new Set(embedding.tokens);
      for (const token of uniqueTokens) {
        this.documentFrequency.set(token, (this.documentFrequency.get(token) ?? 0) + 1);
      }
    }

    // Update TF-IDF scores
    for (const embedding of this.embeddings.values()) {
      for (const [token, tf] of embedding.tfidf.entries()) {
        const df = this.documentFrequency.get(token) ?? 1;
        const idf = Math.log(this.totalDocuments / df) + 1;
        embedding.tfidf.set(token, tf * idf);
      }
    }

    this.initialized = true;
    await this.saveCache();
    return { indexed, skipped };
  }

  /**
   * Semantic search across the codebase
   */
  async search(query: string, limit = 5): Promise<Array<{ path: string; score: number; snippet: string }>> {
    if (!this.initialized) {
      await this.loadCache();
      if (!this.initialized) {
        await this.build();
      }
    }

    const queryTokens = this.tokenize(query);
    const queryTF = this.computeTF(queryTokens);

    const results: Array<{ path: string; score: number }> = [];

    for (const [path, embedding] of this.embeddings) {
      const score = this.cosineSimilarity(queryTF, embedding.tfidf);
      if (score > 0) {
        results.push({ path, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);

    // Load snippets for top results
    const withSnippets = await Promise.all(
      topResults.map(async (r) => {
        const content = await this.getSnippet(r.path, queryTokens);
        return { ...r, snippet: content };
      }),
    );

    return withSnippets;
  }

  /**
   * Get relevant code snippet from a file
   */
  private async getSnippet(filePath: string, queryTokens: string[]): Promise<string> {
    try {
      const content = await readFile(join(this.projectRoot, filePath), 'utf-8');
      const lines = content.split('\n');

      // Find the most relevant line range
      let bestStart = 0;
      let bestScore = 0;
      const windowSize = 15;

      for (let i = 0; i < lines.length - windowSize; i++) {
        const window = lines.slice(i, i + windowSize).join('\n').toLowerCase();
        let score = 0;
        for (const token of queryTokens) {
          if (window.includes(token)) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestStart = i;
        }
      }

      return lines.slice(bestStart, bestStart + windowSize).join('\n');
    } catch {
      return '';
    }
  }

  /**
   * Tokenize text into meaningful words
   */
  private tokenize(text: string): string[] {
    return (text
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
      .replace(/[_\-./\\]/g, ' ') // separator split
      .match(/[a-zA-Z][a-zA-Z0-9]{1,}/g) ?? [])
      .map(w => w.toLowerCase())
      .filter(w => w.length > 2);
  }

  /**
   * Compute term frequency
   */
  private computeTF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    const total = tokens.length || 1;
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }
    for (const [token, count] of tf.entries()) {
      tf.set(token, count / total);
    }
    return tf;
  }

  /**
   * Cosine similarity between two TF-IDF vectors
   */
  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [token, va] of a) {
      const vb = b.get(token) ?? 0;
      dotProduct += va * vb;
      normA += va * va;
    }
    for (const vb of b.values()) {
      normB += vb * vb;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Save embeddings to cache
   */
  private async saveCache(): Promise<void> {
    try {
      await mkdir(join(this.projectRoot, '.phantomind', 'cache'), { recursive: true });
      const data = {
        totalDocuments: this.totalDocuments,
        embeddings: Array.from(this.embeddings.entries()).map(([path, emb]) => ({
          path,
          tokens: emb.tokens.slice(0, 200), // limit for cache size
          tfidf: Object.fromEntries(emb.tfidf),
          lastModified: emb.lastModified,
        })),
        documentFrequency: Object.fromEntries(this.documentFrequency),
      };
      await writeFile(this.cachePath, JSON.stringify(data), 'utf-8');
    } catch {
      // Cache save failure is non-critical
    }
  }

  /**
   * Load embeddings from cache
   */
  private async loadCache(): Promise<void> {
    try {
      const raw = await readFile(this.cachePath, 'utf-8');
      const data = JSON.parse(raw);
      this.totalDocuments = data.totalDocuments;
      this.documentFrequency = new Map(Object.entries(data.documentFrequency));

      for (const emb of data.embeddings) {
        this.embeddings.set(emb.path, {
          path: emb.path,
          tokens: emb.tokens,
          tfidf: new Map(Object.entries(emb.tfidf)),
          lastModified: emb.lastModified,
        });
      }

      this.initialized = true;
    } catch {
      // No cache or invalid cache
    }
  }
}
