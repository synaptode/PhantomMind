/**
 * PhantomMindAI — Incremental Context Learner
 * Scans codebase to auto-detect tech stack, patterns, conventions,
 * and writes actionable SKILLS.md content.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import fastGlob from 'fast-glob';

export interface LearnedPattern {
  type: 'naming' | 'structure' | 'import' | 'architecture' | 'convention';
  pattern: string;
  confidence: number;
  examples: string[];
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
}

export interface TechStackInfo {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  testingTools: string[];
  linters: string[];
  databases: string[];
  runtime: string[];
  packageManager: string;
  nodeVersion?: string;
  projectType: string;
  entryPoints: string[];
  scripts: Record<string, string>;
}

interface LearningState {
  patterns: LearnedPattern[];
  techStack: TechStackInfo;
  fileHistory: Array<{ path: string; timestamp: string }>;
  lastScanTimestamp: string;
}

export const EMPTY_TECH_STACK: TechStackInfo = {
  languages: [],
  frameworks: [],
  buildTools: [],
  testingTools: [],
  linters: [],
  databases: [],
  runtime: [],
  packageManager: 'npm',
  projectType: 'unknown',
  entryPoints: [],
  scripts: {},
};

export class ContextLearner {
  private projectRoot: string;
  private state: LearningState;
  private statePath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.statePath = join(projectRoot, '.phantomind', 'memory', 'learning-state.json');
    this.state = { patterns: [], techStack: { ...EMPTY_TECH_STACK }, fileHistory: [], lastScanTimestamp: '' };
  }

  /**
   * Load persisted learning state
   */
  async load(): Promise<void> {
    try {
      const raw = await readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(raw);
    } catch {
      // Fresh state
    }
  }

  /**
   * Scan project and learn patterns + tech stack
   */
  async learn(): Promise<LearnedPattern[]> {
    await this.load();

    // Phase 1: Detect tech stack from config files
    this.state.techStack = await this.detectTechStack();

    // Phase 2: Scan source files for patterns
    const files = await fastGlob('**/*.{ts,tsx,js,jsx,swift,go,py,rs,java,kt,rb,php,vue,svelte}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**', 'vendor/**', '__pycache__/**'],
    });

    const namingPatterns: Map<string, number> = new Map();
    const importPatterns: Map<string, number> = new Map();
    const structurePatterns: Map<string, string[]> = new Map();
    const conventionPatterns: Map<string, string[]> = new Map();

    for (const file of files) {
      try {
        const content = await readFile(join(this.projectRoot, file), 'utf-8');
        const ext = extname(file);

        this.detectNamingPatterns(content, ext, namingPatterns);
        this.detectImportPatterns(content, ext, importPatterns);
        this.detectStructurePatterns(file, structurePatterns);
        this.detectConventionPatterns(file, content, conventionPatterns);
      } catch {
        continue;
      }
    }

    // Convert to learned patterns
    const newPatterns: LearnedPattern[] = [];
    const now = new Date().toISOString();

    for (const [pattern, count] of namingPatterns) {
      if (count >= 3) {
        newPatterns.push({
          type: 'naming',
          pattern,
          confidence: Math.min(count / 10, 1.0),
          examples: [],
          firstSeen: now,
          lastSeen: now,
          occurrences: count,
        });
      }
    }

    for (const [pattern, count] of importPatterns) {
      if (count >= 2) {
        newPatterns.push({
          type: 'import',
          pattern,
          confidence: Math.min(count / 5, 1.0),
          examples: [],
          firstSeen: now,
          lastSeen: now,
          occurrences: count,
        });
      }
    }

    for (const [pattern, examples] of structurePatterns) {
      if (examples.length >= 2) {
        newPatterns.push({
          type: 'structure',
          pattern,
          confidence: Math.min(examples.length / 5, 1.0),
          examples: examples.slice(0, 5),
          firstSeen: now,
          lastSeen: now,
          occurrences: examples.length,
        });
      }
    }

    for (const [pattern, examples] of conventionPatterns) {
      if (examples.length >= 2) {
        newPatterns.push({
          type: 'convention',
          pattern,
          confidence: Math.min(examples.length / 5, 1.0),
          examples: examples.slice(0, 5),
          firstSeen: now,
          lastSeen: now,
          occurrences: examples.length,
        });
      }
    }

    // Merge with existing patterns
    this.mergePatterns(newPatterns);
    this.state.lastScanTimestamp = now;
    await this.save();

    return this.state.patterns;
  }

  /**
   * Generate rich SKILLS.md content from detected tech stack + patterns
   */
  generateSkillsContent(projectName: string = 'Project'): string {
    const ts = this.state.techStack;
    const lines: string[] = [];

    lines.push(`# ${projectName} — AI Skills & Context`);
    lines.push('');
    lines.push('> Auto-generated by PhantomMindAI. Review and customize as needed.');
    lines.push(`> Last scanned: ${this.state.lastScanTimestamp || new Date().toISOString()}`);
    lines.push('');

    // Tech Stack
    lines.push('## Tech Stack');
    lines.push('');
    if (ts.languages.length) lines.push(`- **Languages**: ${ts.languages.join(', ')}`);
    if (ts.frameworks.length) lines.push(`- **Frameworks**: ${ts.frameworks.join(', ')}`);
    if (ts.runtime.length) lines.push(`- **Runtime**: ${ts.runtime.join(', ')}`);
    if (ts.buildTools.length) lines.push(`- **Build Tools**: ${ts.buildTools.join(', ')}`);
    if (ts.testingTools.length) lines.push(`- **Testing**: ${ts.testingTools.join(', ')}`);
    if (ts.linters.length) lines.push(`- **Linting/Formatting**: ${ts.linters.join(', ')}`);
    if (ts.databases.length) lines.push(`- **Databases**: ${ts.databases.join(', ')}`);
    lines.push(`- **Package Manager**: ${ts.packageManager}`);
    if (ts.nodeVersion) lines.push(`- **Node.js**: ${ts.nodeVersion}`);
    lines.push(`- **Project Type**: ${ts.projectType}`);
    lines.push('');

    // Key Scripts
    if (Object.keys(ts.scripts).length > 0) {
      lines.push('## Key Commands');
      lines.push('');
      const importantScripts = ['build', 'dev', 'start', 'test', 'lint', 'format', 'typecheck'];
      for (const key of importantScripts) {
        if (ts.scripts[key]) {
          lines.push(`- \`npm run ${key}\` → \`${ts.scripts[key]}\``);
        }
      }
      lines.push('');
    }

    // Entry Points
    if (ts.entryPoints.length > 0) {
      lines.push('## Entry Points');
      lines.push('');
      for (const ep of ts.entryPoints) {
        lines.push(`- \`${ep}\``);
      }
      lines.push('');
    }

    // Naming Conventions
    const namingPatterns = this.state.patterns.filter(p => p.type === 'naming' && p.confidence > 0.3);
    if (namingPatterns.length > 0) {
      lines.push('## Naming Conventions');
      lines.push('');
      for (const p of namingPatterns.sort((a, b) => b.occurrences - a.occurrences)) {
        lines.push(`- ${p.pattern} (${p.occurrences}× found)`);
      }
      lines.push('');
    }

    // Import Patterns
    const importP = this.state.patterns.filter(p => p.type === 'import' && p.confidence > 0.3);
    if (importP.length > 0) {
      lines.push('## Import Patterns');
      lines.push('');
      for (const p of importP) {
        lines.push(`- ${p.pattern}`);
      }
      lines.push('');
    }

    // Architecture Patterns
    const structureP = this.state.patterns.filter(p => p.type === 'structure' && p.confidence > 0.3);
    if (structureP.length > 0) {
      lines.push('## Architecture Patterns');
      lines.push('');
      for (const p of structureP) {
        lines.push(`- ${p.pattern}`);
        for (const ex of p.examples.slice(0, 3)) {
          lines.push(`  - e.g. \`${ex}\``);
        }
      }
      lines.push('');
    }

    const conventionP = this.state.patterns.filter(p => p.type === 'convention' && p.confidence > 0.3);
    if (conventionP.length > 0) {
      lines.push('## Project Conventions');
      lines.push('');
      for (const p of conventionP.sort((a, b) => b.occurrences - a.occurrences)) {
        lines.push(`- ${p.pattern}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  getTechStack(): TechStackInfo {
    return structuredClone(this.state.techStack);
  }

  getPatterns(): LearnedPattern[] {
    return structuredClone(this.state.patterns);
  }

  /**
   * Write the generated SKILLS.md to the project's .phantomind directory
   */
  async writeSkills(projectName?: string): Promise<string> {
    const name = projectName ?? this.detectProjectName();
    const content = this.generateSkillsContent(name);
    const skillsPath = join(this.projectRoot, '.phantomind', 'SKILLS.md');
    await mkdir(dirname(skillsPath), { recursive: true });
    await writeFile(skillsPath, content, 'utf-8');
    return content;
  }

  /** Detect tech stack from package.json, config files, etc. */
  private async detectTechStack(): Promise<TechStackInfo> {
    const ts: TechStackInfo = { ...EMPTY_TECH_STACK, languages: [], frameworks: [], buildTools: [], testingTools: [], linters: [], databases: [], runtime: [], entryPoints: [], scripts: {} };

    // Detect package manager
    if (existsSync(join(this.projectRoot, 'pnpm-lock.yaml'))) ts.packageManager = 'pnpm';
    else if (existsSync(join(this.projectRoot, 'yarn.lock'))) ts.packageManager = 'yarn';
    else if (existsSync(join(this.projectRoot, 'bun.lockb'))) ts.packageManager = 'bun';
    else ts.packageManager = 'npm';

    // Parse package.json
    const pkgPath = join(this.projectRoot, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        // Languages
        if (allDeps['typescript'] || existsSync(join(this.projectRoot, 'tsconfig.json'))) ts.languages.push('TypeScript');
        ts.languages.push('JavaScript');

        // Module type
        if (pkg.workspaces) ts.projectType = 'Monorepo';
        else if (pkg.type === 'module') ts.projectType = 'ESM (ES Modules)';
        else ts.projectType = 'CommonJS';

        // Frameworks
        if (allDeps['next']) ts.frameworks.push('Next.js');
        if (allDeps['react']) ts.frameworks.push('React');
        if (allDeps['vue']) ts.frameworks.push('Vue.js');
        if (allDeps['@angular/core']) ts.frameworks.push('Angular');
        if (allDeps['svelte']) ts.frameworks.push('Svelte');
        if (allDeps['express']) ts.frameworks.push('Express');
        if (allDeps['fastify']) ts.frameworks.push('Fastify');
        if (allDeps['koa']) ts.frameworks.push('Koa');
        if (allDeps['hono']) ts.frameworks.push('Hono');
        if (allDeps['nestjs'] || allDeps['@nestjs/core']) ts.frameworks.push('NestJS');
        if (allDeps['nuxt']) ts.frameworks.push('Nuxt');
        if (allDeps['astro']) ts.frameworks.push('Astro');
        if (allDeps['remix'] || allDeps['@remix-run/node']) ts.frameworks.push('Remix');
        if (allDeps['electron']) ts.frameworks.push('Electron');

        // Build tools
        if (allDeps['vite']) ts.buildTools.push('Vite');
        if (allDeps['webpack']) ts.buildTools.push('Webpack');
        if (allDeps['esbuild']) ts.buildTools.push('esbuild');
        if (allDeps['rollup']) ts.buildTools.push('Rollup');
        if (allDeps['turbo'] || existsSync(join(this.projectRoot, 'turbo.json'))) ts.buildTools.push('Turborepo');
        if (allDeps['tsup']) ts.buildTools.push('tsup');
        if (existsSync(join(this.projectRoot, 'tsconfig.json'))) ts.buildTools.push('tsc');

        // Testing
        if (allDeps['vitest']) ts.testingTools.push('Vitest');
        if (allDeps['jest']) ts.testingTools.push('Jest');
        if (allDeps['mocha']) ts.testingTools.push('Mocha');
        if (allDeps['@testing-library/react'] || allDeps['@testing-library/vue']) ts.testingTools.push('Testing Library');
        if (allDeps['playwright'] || allDeps['@playwright/test']) ts.testingTools.push('Playwright');
        if (allDeps['cypress']) ts.testingTools.push('Cypress');

        // Linters
        if (allDeps['eslint']) ts.linters.push('ESLint');
        if (allDeps['prettier']) ts.linters.push('Prettier');
        if (allDeps['biome'] || allDeps['@biomejs/biome']) ts.linters.push('Biome');
        if (allDeps['oxlint'] || allDeps['@oxlint/core']) ts.linters.push('oxlint');

        // Databases
        if (allDeps['prisma'] || allDeps['@prisma/client']) ts.databases.push('Prisma');
        if (allDeps['drizzle-orm']) ts.databases.push('Drizzle');
        if (allDeps['typeorm']) ts.databases.push('TypeORM');
        if (allDeps['mongoose']) ts.databases.push('MongoDB (Mongoose)');
        if (allDeps['pg'] || allDeps['postgres']) ts.databases.push('PostgreSQL');
        if (allDeps['redis'] || allDeps['ioredis']) ts.databases.push('Redis');
        if (allDeps['better-sqlite3'] || allDeps['sql.js']) ts.databases.push('SQLite');

        // Runtime
        ts.runtime.push('Node.js');
        if (pkg.engines?.node) ts.nodeVersion = pkg.engines.node;

        // Scripts
        ts.scripts = pkg.scripts ?? {};

        // Entry points
        if (pkg.main) ts.entryPoints.push(pkg.main);
        if (pkg.bin) {
          const bins = typeof pkg.bin === 'string' ? { [pkg.name]: pkg.bin } : pkg.bin;
          for (const [name, path] of Object.entries(bins)) {
            ts.entryPoints.push(`${name} → ${path}`);
          }
        }
        if (pkg.workspaces) ts.entryPoints.push('workspaces → packages/*');
      } catch { /* skip */ }
    }

    // Python
    if (existsSync(join(this.projectRoot, 'requirements.txt')) || existsSync(join(this.projectRoot, 'pyproject.toml'))) {
      ts.languages.push('Python');
      ts.runtime.push('Python');
    }

    // Go
    if (existsSync(join(this.projectRoot, 'go.mod'))) {
      ts.languages.push('Go');
      ts.runtime.push('Go');
    }

    // Rust
    if (existsSync(join(this.projectRoot, 'Cargo.toml'))) {
      ts.languages.push('Rust');
      ts.runtime.push('Rust');
    }

    // Swift
    if (existsSync(join(this.projectRoot, 'Package.swift'))) {
      ts.languages.push('Swift');
    }

    // Docker
    if (existsSync(join(this.projectRoot, 'Dockerfile')) || existsSync(join(this.projectRoot, 'docker-compose.yml'))) {
      ts.buildTools.push('Docker');
    }

    // Deduplicate
    ts.languages = [...new Set(ts.languages)];
    ts.frameworks = [...new Set(ts.frameworks)];
    ts.buildTools = [...new Set(ts.buildTools)];
    ts.testingTools = [...new Set(ts.testingTools)];
    ts.linters = [...new Set(ts.linters)];
    ts.databases = [...new Set(ts.databases)];
    ts.runtime = [...new Set(ts.runtime)];

    return ts;
  }

  private detectProjectName(): string {
    try {
      const pkgPath = join(this.projectRoot, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return pkg.name ?? basename(this.projectRoot);
      }
    } catch { /* skip */ }
    return basename(this.projectRoot);
  }

  /**
   * Reset all learned patterns
   */
  async reset(): Promise<void> {
    this.state = { patterns: [], techStack: { ...EMPTY_TECH_STACK }, fileHistory: [], lastScanTimestamp: '' };
    await this.save();
  }

  private detectNamingPatterns(content: string, ext: string, patterns: Map<string, number>): void {
    // Detect class naming patterns
    const classNames = content.match(/(?:class|interface|type|struct|enum)\s+([A-Z][a-zA-Z0-9]*)/g) ?? [];
    for (const match of classNames) {
      const name = match.split(/\s+/)[1];
      if (name.endsWith('Service')) this.incr(patterns, 'Classes ending with "Service" suffix');
      if (name.endsWith('Controller')) this.incr(patterns, 'Classes ending with "Controller" suffix');
      if (name.endsWith('Repository')) this.incr(patterns, 'Classes ending with "Repository" suffix');
      if (name.endsWith('ViewModel')) this.incr(patterns, 'Classes ending with "ViewModel" suffix');
      if (name.endsWith('UseCase')) this.incr(patterns, 'Classes ending with "UseCase" suffix');
      if (name.endsWith('Handler')) this.incr(patterns, 'Classes ending with "Handler" suffix');
      if (name.endsWith('Manager')) this.incr(patterns, 'Classes ending with "Manager" suffix');
      if (name.endsWith('Provider')) this.incr(patterns, 'Classes ending with "Provider" suffix');
      if (name.startsWith('I') && name[1]?.match(/[A-Z]/)) this.incr(patterns, 'Interfaces use "I" prefix (IService)');
    }

    // Detect function naming
    if (content.match(/async\s+function\s+[a-z]/g)?.length) {
      this.incr(patterns, 'Functions use camelCase naming');
    }

    // Detect constants
    if (content.match(/const\s+[A-Z_]+\s*=/g)?.length) {
      this.incr(patterns, 'Constants use UPPER_SNAKE_CASE');
    }
  }

  private detectImportPatterns(content: string, ext: string, patterns: Map<string, number>): void {
    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      if (content.includes("from 'node:")) this.incr(patterns, 'Use node: protocol for Node.js built-in imports');
      if (content.match(/import type/g)?.length) this.incr(patterns, 'Use type-only imports (import type {})');
      if (content.match(/import \* as/g)?.length) this.incr(patterns, 'Use namespace imports (import * as)');
    }
  }

  private detectConventionPatterns(file: string, content: string, patterns: Map<string, string[]>): void {
    if (/\b(createSlice|configureStore|useSelector|useDispatch)\b/.test(content)) {
      this.addToList(patterns, 'Redux-style state management present', file);
    }
    if (/\b(create|use)Store\b|zustand/.test(content)) {
      this.addToList(patterns, 'Store-based client state management present', file);
    }
    if (/\b(passport|next-auth|jsonwebtoken|jwt|session)\b/i.test(content)) {
      this.addToList(patterns, 'Authentication/session patterns present', file);
    }
    if (/\b(?:router|app)\.(?:get|post|put|delete|patch)\b/.test(content)) {
      this.addToList(patterns, 'Express-style route handlers present', file);
    }
    if (/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(content)) {
      this.addToList(patterns, 'File-based HTTP handlers present', file);
    }
    if (/(^|\/)packages\//.test(file) || /(^|\/)apps\//.test(file)) {
      this.addToList(patterns, 'Workspace package layout present', file);
    }
  }

  private detectStructurePatterns(file: string, patterns: Map<string, string[]>): void {
    const parts = file.split('/');
    if (parts.length >= 2) {
      const dirName = parts[parts.length - 2];
      const fileName = basename(file, extname(file));

      // Detect co-located patterns
      if (fileName.endsWith('.test') || fileName.endsWith('.spec')) {
        this.addToList(patterns, 'Tests co-located with source files', file);
      }

      // Detect feature-based structure
      const featureDirs = ['features', 'modules', 'domains', 'pages', 'routes'];
      if (featureDirs.includes(parts[0] || '')) {
        this.addToList(patterns, `Feature-based directory structure (/${parts[0]}/)`, file);
      }

      // Detect layer-based structure
      const layerDirs = ['models', 'services', 'controllers', 'views', 'utils', 'helpers'];
      if (layerDirs.includes(dirName)) {
        this.addToList(patterns, `Layer-based directory structure (/${dirName}/)`, file);
      }
    }
  }

  private mergePatterns(newPatterns: LearnedPattern[]): void {
    for (const np of newPatterns) {
      const existing = this.state.patterns.find(p => p.pattern === np.pattern && p.type === np.type);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, np.confidence);
        existing.occurrences = Math.max(existing.occurrences, np.occurrences);
        existing.lastSeen = np.lastSeen;
      } else {
        this.state.patterns.push(np);
      }
    }
  }

  private incr(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private addToList(map: Map<string, string[]>, key: string, value: string): void {
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  }

  private async save(): Promise<void> {
    try {
      await mkdir(join(this.projectRoot, '.phantomind', 'memory'), { recursive: true });
      await writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch {
      // Non-critical
    }
  }
}
