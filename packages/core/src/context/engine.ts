/**
 * PhantomMindAI — Smart Context Engine
 * Semantic ranking of context layers based on current file/task relevance.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';
import { findProjectRoot } from '../config/index.js';
import type { ContextLayer, ContextOptions, ContextResult, PhantomConfig } from '../types.js';

/**
 * Context sections parsed from markdown files
 */
interface ContextSection {
  heading: string;
  content: string;
  level: number;
  keywords: string[];
  source: string;
}

/**
 * Smart Context Engine — performs semantic ranking and token-aware context injection
 */
export class ContextEngine {
  private projectRoot: string;
  private config: PhantomConfig;
  private sectionCache: Map<string, ContextSection[]> = new Map();

  constructor(config: PhantomConfig, projectRoot: string) {
    this.config = config;
    this.projectRoot = projectRoot;
  }

  /**
   * Get full project context, optionally ranked for a specific file
   */
  async getProjectContext(options?: ContextOptions): Promise<ContextResult> {
    const layers: ContextLayer[] = [];
    const maxTokens = options?.maxTokens ?? 4000;

    // Load SKILLS.md
    if (options?.includeSkills !== false) {
      const skills = await this.loadContextFile(this.config.context.skills, 'skills');
      if (skills) layers.push(skills);
    }

    // Load RULES.md
    if (options?.includeRules !== false) {
      const rules = await this.loadContextFile(this.config.context.rules, 'rules');
      if (rules) layers.push(rules);
    }

    // Load schema
    if (options?.includeSchema !== false) {
      const schema = await this.loadContextFile(this.config.context.schema, 'schema');
      if (schema) layers.push(schema);
    }

    // Load specific PRD
    if (options?.includePrd) {
      const prd = await this.loadPrd(options.includePrd);
      if (prd) layers.push(prd);
    }

    // Rank by relevance to current file
    if (options?.file && options?.semanticRank !== false) {
      await this.rankLayers(layers, options.file);
    }

    // Sort by relevance
    layers.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Trim to token budget
    return this.trimToTokenBudget(layers, maxTokens);
  }

  /**
   * Get context relevant to a specific file
   */
  async getFileContext(filePath: string, maxTokens = 2000): Promise<ContextResult> {
    return this.getProjectContext({
      file: filePath,
      maxTokens,
      semanticRank: true,
    });
  }

  /**
   * Get a specific PRD section
   */
  async getPrdContext(prdName: string): Promise<ContextLayer | null> {
    return this.loadPrd(prdName);
  }

  /**
   * Get relevant context by searching all context files for keywords
   */
  async searchContext(query: string, maxResults = 5): Promise<ContextSection[]> {
    const allSections = await this.getAllSections();
    const queryWords = this.extractKeywords(query);

    const scored = allSections.map(section => ({
      section,
      score: this.computeRelevanceScore(queryWords, section.keywords, section.content),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map(s => s.section);
  }

  /**
   * Parse a markdown file into sections
   */
  private async parseMarkdownSections(filePath: string): Promise<ContextSection[]> {
    if (this.sectionCache.has(filePath)) {
      return this.sectionCache.get(filePath)!;
    }

    try {
      const content = await readFile(join(this.projectRoot, filePath), 'utf-8');
      const sections: ContextSection[] = [];
      const lines = content.split('\n');
      let currentSection: ContextSection | null = null;
      let sectionContent: string[] = [];

      for (const line of lines) {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          if (currentSection) {
            currentSection.content = sectionContent.join('\n').trim();
            currentSection.keywords = this.extractKeywords(
              currentSection.heading + ' ' + currentSection.content,
            );
            sections.push(currentSection);
          }
          currentSection = {
            heading: headingMatch[2],
            content: '',
            level: headingMatch[1].length,
            keywords: [],
            source: filePath,
          };
          sectionContent = [];
        } else {
          sectionContent.push(line);
        }
      }

      if (currentSection) {
        currentSection.content = sectionContent.join('\n').trim();
        currentSection.keywords = this.extractKeywords(
          currentSection.heading + ' ' + currentSection.content,
        );
        sections.push(currentSection);
      }

      // If no headings found, create one section from full content
      if (sections.length === 0 && content.trim()) {
        sections.push({
          heading: basename(filePath),
          content: content.trim(),
          level: 1,
          keywords: this.extractKeywords(content),
          source: filePath,
        });
      }

      this.sectionCache.set(filePath, sections);
      return sections;
    } catch {
      return [];
    }
  }

  /**
   * Load a context file as a ContextLayer
   */
  private async loadContextFile(
    filePath: string,
    type: ContextLayer['type'],
  ): Promise<ContextLayer | null> {
    try {
      const fullPath = join(this.projectRoot, filePath);
      const content = await readFile(fullPath, 'utf-8');
      return {
        type,
        content,
        relevanceScore: 1.0,
        tokenCount: this.estimateTokens(content),
        source: filePath,
      };
    } catch {
      return null;
    }
  }

  /**
   * Load a PRD file by name
   */
  private async loadPrd(name: string): Promise<ContextLayer | null> {
    const prdDir = join(this.projectRoot, this.config.context.prds);
    try {
      // Try exact name or with .md extension
      const candidates = [`${name}.md`, name];
      for (const candidate of candidates) {
        try {
          const content = await readFile(join(prdDir, candidate), 'utf-8');
          return {
            type: 'prd',
            content,
            relevanceScore: 1.0,
            tokenCount: this.estimateTokens(content),
            source: join(this.config.context.prds, candidate),
          };
        } catch {
          continue;
        }
      }
    } catch {
      // directory doesn't exist
    }
    return null;
  }

  /**
   * Rank context layers by relevance to a file
   */
  private async rankLayers(layers: ContextLayer[], filePath: string): Promise<void> {
    const fileWords = this.extractKeywords(filePath);
    let fileContent = '';
    try {
      fileContent = await readFile(join(this.projectRoot, filePath), 'utf-8');
    } catch {
      try {
        fileContent = await readFile(filePath, 'utf-8');
      } catch {
        // Can't read file, use path keywords only
      }
    }
    const contentWords = fileContent ? this.extractKeywords(fileContent) : [];
    const allWords = [...fileWords, ...contentWords];

    for (const layer of layers) {
      const layerWords = this.extractKeywords(layer.content);
      layer.relevanceScore = this.computeRelevanceScore(allWords, layerWords, layer.content);
    }
  }

  /**
   * Compute relevance score between two sets of keywords using TF-IDF-like scoring
   */
  private computeRelevanceScore(
    queryWords: string[],
    targetWords: string[],
    targetContent: string,
  ): number {
    if (queryWords.length === 0 || targetWords.length === 0) return 0.5;

    const targetSet = new Set(targetWords.map(w => w.toLowerCase()));
    const querySet = new Set(queryWords.map(w => w.toLowerCase()));

    let matchCount = 0;
    for (const word of querySet) {
      if (targetSet.has(word)) matchCount++;
    }

    // Jaccard similarity
    const union = new Set([...querySet, ...targetSet]);
    const jaccard = matchCount / union.size;

    // Boost for exact phrase matches
    const targetLower = targetContent.toLowerCase();
    let phraseBoost = 0;
    for (const word of querySet) {
      if (targetLower.includes(word) && word.length > 3) {
        phraseBoost += 0.1;
      }
    }

    return Math.min(1.0, jaccard + phraseBoost);
  }

  /**
   * Extract meaningful keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'or', 'and', 'not', 'but', 'it',
      'this', 'that', 'which', 'who', 'what', 'when', 'where', 'how', 'all',
      'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    ]);

    // Extract words, including camelCase and snake_case splitting
    const words: string[] = [];
    const raw = text.match(/[a-zA-Z][a-zA-Z0-9_-]*/g) ?? [];

    for (const word of raw) {
      const lower = word.toLowerCase();
      if (lower.length < 2 || stopWords.has(lower)) continue;

      words.push(lower);

      // Split camelCase
      const parts = word.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_-]+/);
      for (const part of parts) {
        const lp = part.toLowerCase();
        if (lp.length >= 2 && !stopWords.has(lp) && lp !== lower) {
          words.push(lp);
        }
      }
    }

    return [...new Set(words)];
  }

  /**
   * Get all parsed sections from all context files
   */
  private async getAllSections(): Promise<ContextSection[]> {
    const files = [
      this.config.context.skills,
      this.config.context.rules,
    ];

    // Add PRDs
    try {
      const prdDir = join(this.projectRoot, this.config.context.prds);
      const prdFiles = await readdir(prdDir);
      for (const f of prdFiles) {
        if (f.endsWith('.md')) {
          files.push(join(this.config.context.prds, f));
        }
      }
    } catch {
      // no PRDs directory
    }

    const allSections: ContextSection[] = [];
    for (const file of files) {
      const sections = await this.parseMarkdownSections(file);
      allSections.push(...sections);
    }
    return allSections;
  }

  /**
   * Trim layers to fit within token budget
   */
  private trimToTokenBudget(layers: ContextLayer[], maxTokens: number): ContextResult {
    let totalTokens = 0;
    const included: ContextLayer[] = [];
    let truncated = false;

    for (const layer of layers) {
      if (totalTokens + layer.tokenCount <= maxTokens) {
        included.push(layer);
        totalTokens += layer.tokenCount;
      } else if (layer.relevanceScore > 0.3) {
        // Include a summarized version for medium-relevance layers
        const ratio = (maxTokens - totalTokens) / layer.tokenCount;
        if (ratio > 0.1) {
          const truncatedContent = layer.content.slice(
            0,
            Math.floor(layer.content.length * ratio),
          );
          included.push({
            ...layer,
            content: truncatedContent + '\n[... truncated for token budget]',
            tokenCount: Math.ceil(layer.tokenCount * ratio),
          });
          totalTokens += Math.ceil(layer.tokenCount * ratio);
          truncated = true;
        }
        break;
      }
    }

    return { layers: included, totalTokens, truncated };
  }

  /**
   * Rough token estimate (~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Clear section cache
   */
  clearCache(): void {
    this.sectionCache.clear();
  }
}
