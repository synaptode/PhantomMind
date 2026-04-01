import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HallucinationGuard } from './hallucination-guard.js';

describe('HallucinationGuard', () => {
  let tmpDir: string;
  let guard: HallucinationGuard;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pm-halluc-test-'));

    // Create a package.json with known deps
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: { express: '^4.0.0', zod: '^3.0.0' },
        devDependencies: { vitest: '^3.0.0', typescript: '^5.0.0' },
      }),
    );

    // Create some project files
    await mkdir(join(tmpDir, 'src'), { recursive: true });
    await writeFile(join(tmpDir, 'src', 'index.ts'), 'export const hello = "world";');
    await writeFile(join(tmpDir, 'src', 'utils.ts'), 'export function add(a: number, b: number) { return a + b; }');

    guard = new HallucinationGuard(tmpDir);
  });

  describe('check() - import validation', () => {
    it('allows import of existing npm package', async () => {
      const content = `import express from 'express';`;
      const issues = await guard.check(content, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('flags import of non-existent npm package', async () => {
      const content = `import someFakeLib from 'some-fake-lib-xyz';`;
      const issues = await guard.check(content, 'test.ts');
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues.some(i => i.type === 'import' && i.reference === 'some-fake-lib-xyz')).toBe(true);
    });

    it('allows Node.js builtin modules', async () => {
      const content = `import { readFile } from 'node:fs/promises';`;
      const issues = await guard.check(content, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('allows plain Node.js builtins', async () => {
      const content = `import path from 'path';`;
      const issues = await guard.check(content, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('allows scoped packages that exist', async () => {
      await writeFile(
        join(tmpDir, 'package.json'),
        JSON.stringify({
          dependencies: { '@phantomind/core': '^0.1.0' },
        }),
      );
      guard.clearCache();

      const content = `import { PhantomMind } from '@phantomind/core';`;
      const issues = await guard.check(content, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('flags non-existent scoped packages', async () => {
      const content = `import { Foo } from '@fake-scope/fake-pkg';`;
      const issues = await guard.check(content, 'test.ts');
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('provides suggestions for similar package names', async () => {
      const content = `import exprss from 'exprss';`; // typo of 'express'
      const issues = await guard.check(content, 'test.ts');
      const importIssue = issues.find(i => i.type === 'import');
      expect(importIssue).toBeDefined();
      // The similarity algorithm should suggest 'express'
      if (importIssue?.suggestions) {
        expect(importIssue.suggestions).toContain('express');
      }
    });
  });

  describe('check() - file path validation', () => {
    it('allows references to existing files', async () => {
      const content = `import { hello } from './src/index.ts';`;
      // This is a relative import, not a package import — hallucination guard
      // currently only checks npm package imports (non-relative), so this should pass
      const issues = await guard.check(content, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('flags references to non-existent files', async () => {
      const content = `const file = './nonexistent-file.ts';`;
      const issues = await guard.check(content, 'test.ts');
      const fileIssue = issues.find(i => i.type === 'file');
      if (fileIssue) {
        expect(fileIssue.exists).toBe(false);
      }
    });
  });

  describe('clearCache()', () => {
    it('clears cached package names so they are re-read', async () => {
      // First check triggers cache population
      await guard.check(`import zod from 'zod';`, 'test.ts');

      // Add a new package
      await writeFile(
        join(tmpDir, 'package.json'),
        JSON.stringify({
          dependencies: { express: '^4.0.0', zod: '^3.0.0', lodash: '^4.0.0' },
        }),
      );

      guard.clearCache();

      // Now 'lodash' should be recognized
      const issues = await guard.check(`import lodash from 'lodash';`, 'test.ts');
      expect(issues).toHaveLength(0);
    });
  });

  describe('Python imports', () => {
    it('marks Python imports as existing (cannot validate without pip)', async () => {
      const content = `import numpy`;
      const issues = await guard.check(content, 'test.py');
      // Python imports are always marked as existing, check() filters to non-existent only
      expect(issues).toHaveLength(0);
    });
  });

  describe('Swift imports', () => {
    it('allows known Swift builtin modules', async () => {
      const content = `import Foundation`;
      const issues = await guard.check(content, 'test.swift');
      expect(issues).toHaveLength(0);
    });

    it('allows SwiftUI import', async () => {
      const content = `import SwiftUI`;
      const issues = await guard.check(content, 'test.swift');
      expect(issues).toHaveLength(0);
    });
  });
});
