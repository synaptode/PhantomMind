/**
 * PhantomindAI — Regression Detector
 * Snapshot project state before agent run, compare after, detect breakage.
 */

import { execSync } from 'node:child_process';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { RegressionReport, FileChange } from '../types.js';

interface ProjectSnapshot {
  timestamp: string;
  fileHashes: Record<string, string>;
  testResults?: { total: number; passed: number; failed: number };
}

export class RegressionDetector {
  private projectRoot: string;
  private snapshotPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.snapshotPath = join(projectRoot, '.phantomind', 'cache', 'snapshot.json');
  }

  /**
   * Take a snapshot of current project state
   */
  async takeSnapshot(): Promise<ProjectSnapshot> {
    const snapshot: ProjectSnapshot = {
      timestamp: new Date().toISOString(),
      fileHashes: {},
    };

    // Hash tracked files
    try {
      const gitFiles = execSync('git ls-files', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 10000,
      }).trim().split('\n').filter(Boolean);

      for (const file of gitFiles) {
        try {
          const content = await readFile(join(this.projectRoot, file), 'utf-8');
          snapshot.fileHashes[file] = createHash('sha256').update(content).digest('hex').slice(0, 16);
        } catch {
          // skip unreadable files
        }
      }
    } catch {
      // Not a git repo, skip file hashing
    }

    // Run tests and capture result
    snapshot.testResults = await this.runTests();

    // Save snapshot
    await mkdir(join(this.projectRoot, '.phantomind', 'cache'), { recursive: true });
    await writeFile(this.snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    return snapshot;
  }

  /**
   * Compare current state with snapshot
   */
  async compare(): Promise<RegressionReport> {
    let baseline: ProjectSnapshot;
    try {
      baseline = JSON.parse(await readFile(this.snapshotPath, 'utf-8'));
    } catch {
      return {
        hasRegression: false,
        testsBefore: 0,
        testsAfter: 0,
        testsBroken: 0,
        schemaViolations: 0,
        architectureViolations: 0,
        fileChanges: [],
      };
    }

    const currentTests = await this.runTests();
    const fileChanges = await this.detectFileChanges(baseline);
    const testsBroken = Math.max(
      0,
      (baseline.testResults?.passed ?? 0) - (currentTests?.passed ?? 0),
    );

    return {
      hasRegression: testsBroken > 0,
      testsBefore: baseline.testResults?.total ?? 0,
      testsAfter: currentTests?.total ?? 0,
      testsBroken,
      schemaViolations: 0,
      architectureViolations: 0,
      fileChanges,
    };
  }

  /**
   * Rollback all files to snapshot state
   */
  async rollback(): Promise<{ success: boolean; filesReverted: number }> {
    try {
      execSync('git checkout -- .', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 10000,
      });

      // Also clean untracked files created by agent
      execSync('git clean -fd --exclude=.phantomind', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 10000,
      });

      return { success: true, filesReverted: -1 };
    } catch {
      return { success: false, filesReverted: 0 };
    }
  }

  /**
   * Run project tests and return results
   */
  private async runTests(): Promise<{ total: number; passed: number; failed: number } | undefined> {
    const testCommands = [
      'npm test -- --reporter=json',
      'npx vitest run --reporter=json',
      'go test ./...',
      'swift test',
    ];

    for (const cmd of testCommands) {
      try {
        const result = execSync(cmd, {
          cwd: this.projectRoot,
          encoding: 'utf-8',
          timeout: 60000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Try to parse results
        try {
          const json = JSON.parse(result);
          return {
            total: json.numTotalTests ?? json.testResults?.length ?? 0,
            passed: json.numPassedTests ?? 0,
            failed: json.numFailedTests ?? 0,
          };
        } catch {
          // Non-JSON output — count pass/fail from text
          const passed = (result.match(/✓|passed|PASS/g) ?? []).length;
          const failed = (result.match(/✗|failed|FAIL/g) ?? []).length;
          return { total: passed + failed, passed, failed };
        }
      } catch {
        continue;
      }
    }

    return undefined;
  }

  /**
   * Detect file changes since snapshot
   */
  private async detectFileChanges(baseline: ProjectSnapshot): Promise<FileChange[]> {
    const changes: FileChange[] = [];

    try {
      const diff = execSync('git diff --name-status', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 10000,
      });

      for (const line of diff.trim().split('\n').filter(Boolean)) {
        const [status, path] = line.split('\t');
        if (!path) continue;

        let action: FileChange['action'];
        switch (status) {
          case 'A': action = 'created'; break;
          case 'D': action = 'deleted'; break;
          default: action = 'modified'; break;
        }

        changes.push({ path, action });
      }
    } catch {
      // Not a git repo
    }

    return changes;
  }
}
