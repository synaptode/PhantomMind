/**
 * PhantomindAI — Cross-File Consistency Enforcer
 * Detect naming, pattern, and architecture inconsistencies.
 */

import { readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import fastGlob from 'fast-glob';
import type { ConsistencyReport, ConsistencyIssue } from '../types.js';

export class ConsistencyEnforcer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Run full consistency scan
   */
  async scan(scope: 'naming' | 'pattern' | 'architecture' | 'all' = 'all'): Promise<ConsistencyReport> {
    const start = Date.now();
    const issues: ConsistencyIssue[] = [];

    const files = await fastGlob('**/*.{ts,tsx,js,jsx,swift,go,py}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**', '.git/**'],
    });

    const fileContents: Map<string, string> = new Map();
    for (const file of files) {
      try {
        const content = await readFile(join(this.projectRoot, file), 'utf-8');
        fileContents.set(file, content);
      } catch {
        continue;
      }
    }

    if (scope === 'all' || scope === 'naming') {
      issues.push(...this.checkNamingConsistency(fileContents));
    }

    if (scope === 'all' || scope === 'pattern') {
      issues.push(...this.checkPatternConsistency(fileContents));
    }

    if (scope === 'all' || scope === 'architecture') {
      issues.push(...this.checkArchitectureConsistency(fileContents));
    }

    return {
      issues,
      scannedFiles: files.length,
      duration: Date.now() - start,
    };
  }

  /**
   * Check naming convention consistency
   */
  private checkNamingConsistency(files: Map<string, string>): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const errorTypes: Map<string, string[]> = new Map();
    const serviceTypes: Map<string, string[]> = new Map();

    for (const [file, content] of files) {
      // Check error type naming
      const errorMatches = content.match(/(?:class|type|interface)\s+(\w*(?:Error|Exception|Failure)\w*)/g) ?? [];
      for (const match of errorMatches) {
        const name = match.split(/\s+/).pop()!;
        const suffix = name.endsWith('Error') ? 'Error' : name.endsWith('Exception') ? 'Exception' : 'Failure';
        const list = errorTypes.get(suffix) ?? [];
        list.push(file);
        errorTypes.set(suffix, list);
      }

      // Check service naming
      const serviceMatches = content.match(/(?:class|type|interface)\s+(\w*(?:Service|Manager|Controller|Handler)\w*)/g) ?? [];
      for (const match of serviceMatches) {
        const name = match.split(/\s+/).pop()!;
        for (const suffix of ['Service', 'Manager', 'Controller', 'Handler']) {
          if (name.endsWith(suffix)) {
            const list = serviceTypes.get(suffix) ?? [];
            list.push(file);
            serviceTypes.set(suffix, list);
          }
        }
      }
    }

    // Flag if multiple error naming conventions
    if (errorTypes.size > 1) {
      const allFiles = [...errorTypes.values()].flat();
      issues.push({
        type: 'naming',
        description: `Mixed error type naming: ${[...errorTypes.keys()].join(', ')}. Use one convention.`,
        files: [...new Set(allFiles)],
        suggestion: 'Standardize error types to use a single suffix (e.g., always "Error").',
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * Check async pattern consistency
   */
  private checkPatternConsistency(files: Map<string, string>): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const asyncPatterns: Map<string, string[]> = new Map();

    for (const [file, content] of files) {
      const ext = extname(file);
      if (ext !== '.ts' && ext !== '.tsx' && ext !== '.js' && ext !== '.jsx') continue;

      // Check for mixed callback and async/await
      const hasCallbacks = /\.then\s*\(/.test(content);
      const hasAsyncAwait = /async\s+/.test(content);

      if (hasCallbacks && hasAsyncAwait) {
        const list = asyncPatterns.get('mixed') ?? [];
        list.push(file);
        asyncPatterns.set('mixed', list);
      }
    }

    if (asyncPatterns.has('mixed') && (asyncPatterns.get('mixed')?.length ?? 0) > 2) {
      issues.push({
        type: 'pattern',
        description: 'Mixed async patterns: both .then() callbacks and async/await used.',
        files: asyncPatterns.get('mixed')!,
        suggestion: 'Prefer async/await consistently over .then() callbacks.',
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * Check architecture layer consistency
   */
  private checkArchitectureConsistency(files: Map<string, string>): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    for (const [file, content] of files) {
      // Check if ViewModels import from data layer directly
      if (file.includes('ViewModel') || file.includes('viewmodel') || file.includes('view-model')) {
        if (content.includes('import') && (
          content.match(/from\s+['"].*(?:database|db|sql|prisma|mongoose|typeorm)/i) ||
          content.match(/from\s+['"].*(?:repository|repo)/i)
        )) {
          issues.push({
            type: 'architecture',
            description: `ViewModel directly imports data layer in ${file}.`,
            files: [file],
            suggestion: 'ViewModels should access data through a service/use-case layer, not directly.',
            autoFixable: false,
          });
        }
      }

      // Check if Views import from data layer
      if (file.includes('View') || file.includes('Component') || file.includes('.vue') || file.includes('.svelte')) {
        if (content.match(/from\s+['"].*(?:database|db|sql|prisma|mongoose|typeorm)/i)) {
          issues.push({
            type: 'architecture',
            description: `View/Component directly imports data layer in ${file}.`,
            files: [file],
            suggestion: 'Views should never access the data layer directly.',
            autoFixable: false,
          });
        }
      }
    }

    return issues;
  }
}
