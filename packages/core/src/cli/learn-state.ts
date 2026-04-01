/**
 * PhantomindAI — Learn State Management
 * Tracks file hashes to enable incremental learning (--only-changes)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import fastGlob from 'fast-glob';

export interface LearnStateSnapshot {
  timestamp: string;
  version: string;
  fileHashes: Record<string, string>; // file path → hash
  packageNames?: string[]; // for monorepos: package names scanned
}

export class LearnStateManager {
  private projectRoot: string;
  private stateFile: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.stateFile = join(projectRoot, '.phantomind', 'cache', 'learn-state.json');
  }

  /**
   * Get the last saved learning state
   */
  getPreviousState(): LearnStateSnapshot | null {
    if (!existsSync(this.stateFile)) {
      return null;
    }

    try {
      return JSON.parse(readFileSync(this.stateFile, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * Compute file hashes for given paths
   */
  private computeHashes(filePaths: string[]): Record<string, string> {
    const hashes: Record<string, string> = {};

    for (const file of filePaths) {
      try {
        const content = readFileSync(join(this.projectRoot, file), 'utf-8');
        const hash = createHash('sha256').update(content).digest('hex');
        hashes[file] = hash;
      } catch {
        // Skip files that can't be read
      }
    }

    return hashes;
  }

  /**
   * Find files that have changed since last learn
   */
  async getChangedFiles(
    filePaths: string[],
    previousState: LearnStateSnapshot | null
  ): Promise<string[]> {
    if (!previousState) {
      return filePaths; // First run: all files are "new"
    }

    const newHashes = this.computeHashes(filePaths);
    const changed: string[] = [];

    for (const file of filePaths) {
      const oldHash = previousState.fileHashes[file];
      const newHash = newHashes[file];

      if (oldHash !== newHash) {
        changed.push(file);
      }
    }

    return changed;
  }

  /**
   * Save current learn state
   */
  async saveState(
    filePaths: string[],
    packageNames?: string[]
  ): Promise<void> {
    const hashes = this.computeHashes(filePaths);

    const state: LearnStateSnapshot = {
      timestamp: new Date().toISOString(),
      version: '1',
      fileHashes: hashes,
      packageNames,
    };

    // Ensure cache directory exists
    const cacheDir = dirname(this.stateFile);
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
  }

  /**
   * Get all learnable files for the project
   */
  async getLearnableFiles(): Promise<string[]> {
    const patterns = [
      'package.json',
      'tsconfig.json',
      'vite.config.*',
      'webpack.config.*',
      'jest.config.*',
      'vitest.config.*',
      'eslint.config.*',
      '.eslintrc*',
      'babel.config.*',
      '.npmrc',
      '.nvmrc',
      '*.md',
      'src/**/*.{ts,tsx,js,jsx}',
      'packages/*/package.json', // Monorepo packages
      'packages/*/.{ts,tsx,js,jsx}', // Monorepo files
    ];

    const files = await fastGlob(patterns, {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
      dot: true,
    });

    return [...new Set(files)]; // Deduplicate
  }

  /**
   * Filter files by package (for monorepos)
   */
  filterFilesByPackage(files: string[], packageName: string): string[] {
    return files.filter(f =>
      f.startsWith(`packages/${packageName}/`) || f === `packages/${packageName}/package.json`
    );
  }
}
