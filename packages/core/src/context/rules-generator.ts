import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TemplateEngine } from '../templates/engine.js';
import { ContextLearner, type TechStackInfo } from './learner.js';
import {
  PROJECT_TEMPLATES,
  detectProjectTemplate,
  type ProjectTemplateName,
} from './project-template.js';

export interface RulesGenerationOptions {
  template?: ProjectTemplateName;
}

function detectProjectName(projectRoot: string): string {
  try {
    const pkgPath = join(projectRoot, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string };
      return pkg.name ?? projectRoot.split('/').pop() ?? 'project';
    }
  } catch {
    // Ignore invalid package.json
  }
  return projectRoot.split('/').pop() ?? 'project';
}

async function readJson(projectRoot: string, relativePath: string): Promise<Record<string, unknown> | null> {
  const fullPath = join(projectRoot, relativePath);
  if (!existsSync(fullPath)) return null;
  try {
    return JSON.parse(await readFile(fullPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readOptionalText(projectRoot: string, relativePath: string): Promise<string> {
  const fullPath = join(projectRoot, relativePath);
  if (!existsSync(fullPath)) return '';
  try {
    return await readFile(fullPath, 'utf-8');
  } catch {
    return '';
  }
}

function languageRulesFromConfig(techStack: TechStackInfo, tsconfig: Record<string, unknown> | null): string[] {
  const rules: string[] = [];
  if (techStack.languages.includes('TypeScript')) {
    rules.push('Keep TypeScript strictness intact when adding new code.');
    const compilerOptions = (tsconfig?.compilerOptions as Record<string, unknown> | undefined) ?? {};
    if (compilerOptions.strict === true) rules.push('Do not weaken strict TypeScript compiler options.');
    if (compilerOptions.noImplicitAny === true) rules.push('Avoid introducing implicit any types.');
    if (typeof compilerOptions.module === 'string') {
      rules.push(`Preserve the configured module target: ${compilerOptions.module}.`);
    }
  }
  if (techStack.languages.includes('JavaScript')) {
    rules.push('Prefer modern syntax that matches the current runtime target.');
  }
  if (techStack.languages.includes('Python')) {
    rules.push('Prefer explicit dependencies and small modules for Python code.');
  }
  return [...new Set(rules)];
}

function frameworkRulesFromTechStack(techStack: TechStackInfo): string[] {
  const rules: string[] = [];
  if (techStack.frameworks.includes('React')) rules.push('Keep UI state local unless cross-feature coordination is required.');
  if (techStack.frameworks.includes('Next.js')) rules.push('Respect server/client boundaries and route conventions.');
  if (techStack.frameworks.includes('Express')) rules.push('Keep routing, validation, and business logic separated.');
  if (techStack.frameworks.includes('NestJS')) rules.push('Follow module/provider/controller boundaries consistently.');
  return rules;
}

function importRulesFromFiles(techStack: TechStackInfo, eslintText: string): string[] {
  const rules: string[] = [];
  if (techStack.runtime.includes('Node.js')) rules.push('Use the node: prefix for built-in modules where already adopted.');
  if (eslintText.includes('import/order')) rules.push('Preserve configured import ordering.');
  if (eslintText.includes('@typescript-eslint/consistent-type-imports')) {
    rules.push('Use type-only imports when importing types.');
  }
  return [...new Set(rules)];
}

function testingRulesFromTechStack(techStack: TechStackInfo): string[] {
  const rules: string[] = [];
  if (techStack.testingTools.length === 0) {
    rules.push('Add regression coverage when changing behavior in critical paths.');
  }
  if (techStack.testingTools.includes('Vitest')) rules.push('Keep tests fast and focused when using Vitest.');
  if (techStack.testingTools.includes('Playwright')) rules.push('Reserve end-to-end coverage for critical flows.');
  return rules;
}

function forbiddenPatternsFromConfig(eslintText: string, techStack: TechStackInfo): string[] {
  const patterns = ['Hardcoded secrets or credentials', 'Commented-out code committed as dead weight'];
  if (techStack.languages.includes('TypeScript')) patterns.push('Using any in new code without a strong reason');
  if (eslintText.includes('no-console')) patterns.push('Console logging in production code paths');
  return [...new Set(patterns)];
}

export async function generateRulesContent(
  projectRoot: string,
  options: RulesGenerationOptions = {},
): Promise<string> {
  const learner = new ContextLearner(projectRoot);
  await learner.learn();
  const techStack = learner.getTechStack();

  const tsconfig = await readJson(projectRoot, 'tsconfig.json');
  const eslintText = [
    await readOptionalText(projectRoot, '.eslintrc'),
    await readOptionalText(projectRoot, '.eslintrc.json'),
    await readOptionalText(projectRoot, 'eslint.config.js'),
    await readOptionalText(projectRoot, 'eslint.config.mjs'),
  ].join('\n');
  const prettierText = [
    await readOptionalText(projectRoot, '.prettierrc'),
    await readOptionalText(projectRoot, '.prettierrc.json'),
    await readOptionalText(projectRoot, 'prettier.config.js'),
    await readOptionalText(projectRoot, 'prettier.config.mjs'),
  ].join('\n');

  const selectedTemplateName = options.template && options.template !== 'auto'
    ? options.template
    : detectProjectTemplate({
        frameworks: techStack.frameworks,
        entryPoints: techStack.entryPoints,
        projectType: techStack.projectType,
      });
  const template = PROJECT_TEMPLATES[selectedTemplateName];

  return TemplateEngine.renderRules({
    projectName: detectProjectName(projectRoot),
    primaryLanguage: techStack.languages[0] ?? 'Unknown',
    framework: techStack.frameworks[0] ?? template.displayName,
    languageRules: [...template.languageRules, ...languageRulesFromConfig(techStack, tsconfig)],
    frameworkRules: [...template.frameworkRules, ...frameworkRulesFromTechStack(techStack)],
    fileOrganization: template.fileOrganization,
    importRules: [...template.importRules, ...importRulesFromFiles(techStack, eslintText)],
    testingRules: [...template.testingRules, ...testingRulesFromTechStack(techStack)],
    branchNaming: 'feature/*, fix/*, chore/*',
    commitFormat: 'conventional commits',
    prRequirements: 'Explain behavioral changes, risks, and validation steps.',
    securityRules: ['Do not trust unchecked external input.'],
    performanceRules: [...template.performanceRules],
    documentationRules: [
      ...template.documentationRules,
      ...(prettierText ? ['Do not fight formatter output; align changes with configured formatting.'] : []),
    ],
    forbiddenPatterns: [...template.forbiddenPatterns, ...forbiddenPatternsFromConfig(eslintText, techStack)],
    customRules: template.customRules,
  });
}

export async function writeRulesContent(
  projectRoot: string,
  options: RulesGenerationOptions = {},
): Promise<string> {
  const content = await generateRulesContent(projectRoot, options);
  const rulesPath = join(projectRoot, '.phantomind', 'RULES.md');
  await writeFile(rulesPath, content, 'utf-8');
  return content;
}