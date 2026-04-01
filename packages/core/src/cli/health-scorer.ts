/**
 * PhantomindAI — Health Scoring & Insights
 * Analyzes project maturity, test coverage, patterns, and best practices
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fastGlob from 'fast-glob';

export interface HealthInsight {
  category: 'testing' | 'typescript' | 'documentation' | 'patterns' | 'security' | 'performance';
  score: number; // 0-100
  title: string;
  message: string;
  findings: string[];
  recommendations: string[];
}

export interface HealthReport {
  timestamp: string;
  projectMaturityScore: number; // 0-100
  insights: HealthInsight[];
  summary: string;
}

export class HealthScorer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async analyze(): Promise<HealthReport> {
    const insights: HealthInsight[] = [];

    insights.push(await this.analyzeTestCoverage());
    insights.push(await this.analyzeTypeScriptUsage());
    insights.push(await this.analyzeDocumentation());
    insights.push(await this.analyzeCodePatterns());
    insights.push(await this.analyzeSecurity());
    insights.push(await this.analyzePerformance());

    const avgScore = insights.reduce((sum, i) => sum + i.score, 0) / insights.length;

    return {
      timestamp: new Date().toISOString(),
      projectMaturityScore: Math.round(avgScore),
      insights: insights.sort((a, b) => a.score - b.score), // Lowest scores first for improvement focus
      summary: this.generateSummary(avgScore),
    };
  }

  private async analyzeTestCoverage(): Promise<HealthInsight> {
    const testFiles = await fastGlob('**/*.test.ts', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**'],
    });
    const sourceFiles = await fastGlob('**/*.ts', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**', '**/*.test.ts'],
    });

    const coverage = sourceFiles.length > 0 ? (testFiles.length / sourceFiles.length) * 100 : 0;
    const score = Math.min(coverage * 2, 100); // Max 100, trending toward 50% coverage = 100%

    const findings: string[] = [];
    findings.push(`Found ${testFiles.length} test files`);
    findings.push(`Found ${sourceFiles.length} source files`);
    findings.push(`Test file ratio: ${(coverage * 2).toFixed(1)}%`);

    const recommendations: string[] = [];
    if (coverage < 50) {
      recommendations.push('Increase test coverage to at least 50% of source files');
      recommendations.push('Focus on critical paths and business logic first');
    } else {
      recommendations.push('Consider adding edge case testing');
    }

    return {
      category: 'testing',
      score: Math.round(score),
      title: 'Test Coverage',
      message: `Test-to-source ratio: ${(coverage * 2).toFixed(1)}%`,
      findings,
      recommendations,
    };
  }

  private async analyzeTypeScriptUsage(): Promise<HealthInsight> {
    const tsconfigPath = join(this.projectRoot, 'tsconfig.json');
    const tsFiles = await fastGlob('**/*.ts', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**'],
    });

    let score = 0;
    const findings: string[] = [];
    const recommendations: string[] = [];

    if (existsSync(tsconfigPath)) {
      score += 40;
      findings.push('TypeScript configured');

      try {
        const config = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
        if (config.compilerOptions?.strict === true) {
          score += 40;
          findings.push('TypeScript strict mode enabled');
        } else {
          findings.push('TypeScript strict mode not enabled');
          recommendations.push('Enable `"strict": true` in tsconfig.json for better type safety');
        }
      } catch {
        findings.push('Could not parse tsconfig.json');
      }
    } else {
      findings.push('No tsconfig.json found');
      recommendations.push('Create tsconfig.json to enable TypeScript');
    }

    score += Math.min((tsFiles.length / 10) * 20, 20); // Up to 20 points for number of TS files

    return {
      category: 'typescript',
      score: Math.min(score, 100),
      title: 'TypeScript Configuration',
      message: score > 70 ? 'Strong TypeScript setup' : 'TypeScript could be better configured',
      findings,
      recommendations,
    };
  }

  private async analyzeDocumentation(): Promise<HealthInsight> {
    const files = [
      { name: 'README.md', points: 30, path: join(this.projectRoot, 'README.md') },
      { name: 'SKILLS.md', points: 20, path: join(this.projectRoot, '.phantomind', 'SKILLS.md') },
      { name: 'RULES.md', points: 20, path: join(this.projectRoot, '.phantomind', 'RULES.md') },
      { name: 'CONTRIBUTING.md', points: 15, path: join(this.projectRoot, 'CONTRIBUTING.md') },
      { name: 'docs/', points: 15, path: join(this.projectRoot, 'docs') },
    ];

    let score = 0;
    const findings: string[] = [];
    const recommendations: string[] = [];

    for (const doc of files) {
      if (existsSync(doc.path)) {
        score += doc.points;
        findings.push(`✓ ${doc.name} present`);
      } else {
        recommendations.push(`Consider adding ${doc.name}`);
      }
    }

    return {
      category: 'documentation',
      score: Math.min(score, 100),
      title: 'Project Documentation',
      message: `Documentation score: ${Math.min(score, 100)}/100`,
      findings,
      recommendations,
    };
  }

  private async analyzeCodePatterns(): Promise<HealthInsight> {
    const sourceFiles = await fastGlob('**/*.ts', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**', '**/*.test.ts'],
    });

    let score = 50; // Base score
    const findings: string[] = [];
    const recommendations: string[] = [];

    let errorHandlingCount = 0;
    let tryBlockCount = 0;
    let customErrorCount = 0;

    for (const file of sourceFiles.slice(0, 20)) {
      // Sample 20 files for performance
      try {
        const content = readFileSync(join(this.projectRoot, file), 'utf-8');
        if (content.includes('try {')) tryBlockCount++;
        if (content.match(/throw new \w+Error/)) errorHandlingCount++;
        if (content.match(/class \w+Error/)) customErrorCount++;
      } catch {
        continue;
      }
    }

    if (errorHandlingCount > sourceFiles.length * 0.1) {
      score += 20;
      findings.push('Good error handling patterns detected');
    } else {
      recommendations.push('Add more explicit error handling throughout codebase');
    }

    if (customErrorCount > 0) {
      score += 15;
      findings.push('Custom error classes used');
    }

    if (tryBlockCount > sourceFiles.length * 0.05) {
      score += 15;
      findings.push('Try-catch blocks found');
    }

    return {
      category: 'patterns',
      score: Math.min(score, 100),
      title: 'Code Pattern Analysis',
      message: `Error handling: ${errorHandlingCount > 0 ? 'Good' : 'Could improve'}`,
      findings,
      recommendations,
    };
  }

  private async analyzeSecurity(): Promise<HealthInsight> {
    const gitignorePath = join(this.projectRoot, 'gitignore');
    const envExamplePath = join(this.projectRoot, '.phantomind', '.env.example');

    let score = 50;
    const findings: string[] = [];
    const recommendations: string[] = [];

    if (existsSync(gitignorePath)) {
      try {
        const content = readFileSync(gitignorePath, 'utf-8');
        if (content.includes('.env') || content.includes('secrets')) {
          score += 30;
          findings.push('.env properly gitignored');
        } else {
          recommendations.push('Add .env and secrets patterns to .gitignore');
        }
      } catch {
        // ignored
      }
    } else {
      recommendations.push('Create .gitignore and exclude sensitive files');
    }

    if (existsSync(envExamplePath)) {
      score += 20;
      findings.push('.env.example documentation present');
    } else {
      recommendations.push('Create .env.example as a template for environment variables');
    }

    return {
      category: 'security',
      score: Math.min(score, 100),
      title: 'Security Configuration',
      message: 'Security baseline check',
      findings,
      recommendations,
    };
  }

  private async analyzePerformance(): Promise<HealthInsight> {
    const packageJsonPath = join(this.projectRoot, 'package.json');
    let score = 50;
    const findings: string[] = [];
    const recommendations: string[] = [];

    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        if (pkg.devDependencies?.['vitest'] || pkg.devDependencies?.['jest']) {
          score += 15;
          findings.push('Testing framework configured');
        }

        if (pkg.devDependencies?.['eslint'] || pkg.devDependencies?.['@biomejs/biome']) {
          score += 15;
          findings.push('Linting configured');
        }

        if (pkg.devDependencies?.['typescript']) {
          score += 10;
          findings.push('Type checking enabled');
        }

        if (pkg.scripts?.['build'] && pkg.scripts?.['dev']) {
          score += 10;
          findings.push('Development workflow configured');
        }
      } catch {
        // ignored
      }
    }

    recommendations.push('Consider adding performance monitoring for production deployments');

    return {
      category: 'performance',
      score: Math.min(score, 100),
      title: 'Performance & Tooling',
      message: 'Development tooling assessment',
      findings,
      recommendations,
    };
  }

  private generateSummary(score: number): string {
    if (score >= 80) return '🌟 Excellent project health - well maintained and documented';
    if (score >= 60) return '✅ Good project health - solid foundation with room for improvement';
    if (score >= 40) return '⚠️  Moderate health - consider prioritizing recommendations';
    return '❌ Low health score - prioritize improvements listed above';
  }
}
