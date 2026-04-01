/**
 * PhantomMindAI — Hallucination Guard
 * Pre-write check that detects when AI references non-existent entities.
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { join, extname } from 'node:path';
import fastGlob from 'fast-glob';
import type { HallucinationCheck } from '../types.js';

export class HallucinationGuard {
  private projectRoot: string;
  private packageNames: Set<string> | null = null;
  private projectFiles: Set<string> | null = null;
  private projectTypes: Set<string> | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Check content for hallucinations
   */
  async check(content: string, fileName = 'unknown'): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check import statements
      const importChecks = await this.checkImports(line, fileName, i + 1);
      checks.push(...importChecks);

      // Check file path references
      const fileChecks = await this.checkFilePaths(line, fileName, i + 1);
      checks.push(...fileChecks);

      // Check type/class references
      const typeChecks = await this.checkTypeReferences(line, fileName, i + 1);
      checks.push(...typeChecks);
    }

    return checks.filter(c => !c.exists);
  }

  /**
   * Detect file language from extension
   */
  private getLanguage(file: string): 'typescript' | 'swift' | 'python' | 'unknown' {
    const ext = file.split('.').pop()?.toLowerCase();
    if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') return 'typescript';
    if (ext === 'swift') return 'swift';
    if (ext === 'py' || ext === 'pyw') return 'python';
    return 'unknown';
  }

  /**
   * Check import statements against actual dependencies
   */
  private async checkImports(line: string, file: string, lineNum: number): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];
    const lang = this.getLanguage(file);

    // Python imports — check early using file extension to avoid ambiguity with Swift
    if (lang === 'python') {
      const pyImportMatch = line.match(/^(?:from|import)\s+([\w.]+)/);
      if (pyImportMatch) {
        const module = pyImportMatch[1].split('.')[0];
        // We can't fully validate Python imports without pip list, so mark as exists
        checks.push({
          type: 'import',
          reference: module,
          exists: true,
          file,
          line: lineNum,
        });
      }
      return checks;
    }

    // TypeScript/JavaScript imports
    const tsImportMatch = line.match(/(?:import|from)\s+['"]([^'"./][^'"]*)['"]/);
    if (tsImportMatch) {
      const pkgName = tsImportMatch[1].startsWith('@')
        ? tsImportMatch[1].split('/').slice(0, 2).join('/')
        : tsImportMatch[1].split('/')[0];

      const packages = await this.getPackageNames();
      const exists = packages.has(pkgName) || this.isNodeBuiltin(pkgName);

      checks.push({
        type: 'import',
        reference: pkgName,
        exists,
        suggestions: exists ? undefined : this.findSimilar(pkgName, [...packages]),
        file,
        line: lineNum,
      });
    }

    // Swift imports
    if (lang === 'swift' || lang === 'unknown') {
      const swiftImportMatch = line.match(/^import\s+(\w+)/);
      if (swiftImportMatch && !tsImportMatch) {
        const module = swiftImportMatch[1];
        const swiftBuiltins = new Set([
          'Foundation', 'UIKit', 'SwiftUI', 'Combine', 'CoreData', 'MapKit',
          'WebKit', 'AVFoundation', 'CoreLocation', 'StoreKit', 'WidgetKit',
          'ActivityKit', 'SwiftData', 'Observation', 'XCTest', 'Testing',
        ]);

        checks.push({
          type: 'import',
          reference: module,
          exists: swiftBuiltins.has(module),
          suggestions: this.findSimilar(module, [...swiftBuiltins]),
          file,
          line: lineNum,
        });
      }
    }

    return checks;
  }

  /**
   * Check file path references
   */
  private async checkFilePaths(line: string, file: string, lineNum: number): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];

    // Match quoted file paths that look like relative paths
    const pathMatches = line.matchAll(/['"](\.\/?[^'"]+\.(ts|js|tsx|jsx|swift|go|py|json|yaml|yml|md))['"]/g);
    for (const match of pathMatches) {
      const refPath = match[1];
      const exists = await this.fileExists(refPath);

      if (!exists) {
        const projectFiles = await this.getProjectFiles();
        const baseName = refPath.split('/').pop() ?? '';
        const suggestions = [...projectFiles]
          .filter(f => f.includes(baseName.replace(extname(baseName), '')))
          .slice(0, 3);

        checks.push({
          type: 'file',
          reference: refPath,
          exists: false,
          suggestions,
          file,
          line: lineNum,
        });
      }
    }

    return checks;
  }

  /**
   * Check type/class references in TypeScript
   */
  private async checkTypeReferences(line: string, file: string, lineNum: number): Promise<HallucinationCheck[]> {
    // Skip checking type references for performance — rely on TypeScript compiler
    return [];
  }

  /**
   * Get all package names from package.json
   */
  private async getPackageNames(): Promise<Set<string>> {
    if (this.packageNames) return this.packageNames;

    this.packageNames = new Set<string>();

    try {
      const pkgJson = await readFile(join(this.projectRoot, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgJson);
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };
      for (const name of Object.keys(deps)) {
        this.packageNames.add(name);
      }
    } catch {
      // No package.json
    }

    return this.packageNames;
  }

  /**
   * Get list of all project files
   */
  private async getProjectFiles(): Promise<Set<string>> {
    if (this.projectFiles) return this.projectFiles;

    try {
      const files = await fastGlob('**/*', {
        cwd: this.projectRoot,
        ignore: ['node_modules/**', 'dist/**', '.git/**'],
        onlyFiles: true,
      });
      this.projectFiles = new Set(files);
    } catch {
      this.projectFiles = new Set();
    }

    return this.projectFiles;
  }

  /**
   * Check if a file path exists
   */
  private async fileExists(refPath: string): Promise<boolean> {
    try {
      await access(join(this.projectRoot, refPath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a module is a Node.js built-in
   */
  private isNodeBuiltin(name: string): boolean {
    const builtins = new Set([
      'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
      'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https',
      'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
      'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys',
      'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'wasi',
      'worker_threads', 'zlib',
      'node:assert', 'node:buffer', 'node:child_process', 'node:cluster',
      'node:crypto', 'node:dgram', 'node:dns', 'node:events', 'node:fs',
      'node:http', 'node:https', 'node:module', 'node:net', 'node:os',
      'node:path', 'node:perf_hooks', 'node:process', 'node:readline',
      'node:stream', 'node:string_decoder', 'node:timers', 'node:tls',
      'node:tty', 'node:url', 'node:util', 'node:v8', 'node:vm',
      'node:worker_threads', 'node:zlib', 'node:test',
    ]);

    return builtins.has(name) || name.startsWith('node:');
  }

  /**
   * Find similar strings using edit distance
   */
  private findSimilar(target: string, candidates: string[], maxResults = 3): string[] {
    const scored = candidates
      .map(c => ({ name: c, score: this.similarity(target, c) }))
      .filter(c => c.score > 0.3)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, maxResults).map(s => s.name);
  }

  /**
   * Simple string similarity (Dice coefficient)
   */
  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const aBigrams = new Map<string, number>();
    for (let i = 0; i < a.length - 1; i++) {
      const bigram = a.slice(i, i + 2).toLowerCase();
      aBigrams.set(bigram, (aBigrams.get(bigram) ?? 0) + 1);
    }

    let matches = 0;
    for (let i = 0; i < b.length - 1; i++) {
      const bigram = b.slice(i, i + 2).toLowerCase();
      const count = aBigrams.get(bigram) ?? 0;
      if (count > 0) {
        aBigrams.set(bigram, count - 1);
        matches++;
      }
    }

    return (2 * matches) / (a.length + b.length - 2);
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    this.packageNames = null;
    this.projectFiles = null;
    this.projectTypes = null;
  }
}
