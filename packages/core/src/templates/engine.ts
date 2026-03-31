/**
 * PhantomMindAI — Template Engine
 * Renders mustache-like templates with project data.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface TemplateData {
  projectName: string;
  projectType: string;
  primaryLanguage: string;
  framework: string;
  timestamp: string;
  techStack: string[];
  architectureDescription: string;
  directoryStructure: string;
  namingConventions: string[];
  importPatterns: string[];
  codeStyle: string[];
  commonPatterns: Array<{ name: string; description: string }>;
  antiPatterns: string[];
  keyFiles: Array<{ path: string; description: string }>;
  dependencies: Array<{ name: string; version: string; description: string }>;
  devDependencies: Array<{ name: string; version: string }>;
  testFramework: string;
  testCommand: string;
  testPattern: string;
  buildCommand: string;
  devCommand: string;
  deployTarget: string;
  additionalContext: string;
  // RULES template extras
  languageRules: string[];
  frameworkRules: string[];
  fileOrganization: string[];
  importRules: string[];
  testingRules: string[];
  branchNaming: string;
  commitFormat: string;
  prRequirements: string;
  securityRules: string[];
  performanceRules: string[];
  documentationRules: string[];
  forbiddenPatterns: string[];
  customRules: string[];
}

export class TemplateEngine {
  /**
   * Render a template with data
   */
  static render(template: string, data: Partial<TemplateData>): string {
    let result = template;

    // Handle array sections {{#key}}...{{/key}}
    result = result.replace(
      /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_, key, content) => {
        const value = (data as any)[key];
        if (!value) return '';

        if (Array.isArray(value)) {
          return value.map(item => {
            if (typeof item === 'string') {
              return content.replace(/\{\{\.\}\}/g, item);
            }
            if (typeof item === 'object') {
              let rendered = content;
              for (const [k, v] of Object.entries(item)) {
                rendered = rendered.replace(
                  new RegExp(`\\{\\{${k}\\}\\}`, 'g'),
                  String(v),
                );
              }
              return rendered;
            }
            return content;
          }).join('');
        }

        return value ? content : '';
      },
    );

    // Handle simple variables {{key}}
    result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = (data as any)[key];
      if (value === undefined || value === null) return '';
      return String(value);
    });

    // Clean up empty lines from removed sections
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
  }

  /**
   * Load and render the SKILLS template
   */
  static async renderSkills(data: Partial<TemplateData>): Promise<string> {
    const templatePath = join(__dirname, 'SKILLS.template.md');
    const template = await readFile(templatePath, 'utf-8');
    return this.render(template, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Load and render the RULES template
   */
  static async renderRules(data: Partial<TemplateData>): Promise<string> {
    const templatePath = join(__dirname, 'RULES.template.md');
    const template = await readFile(templatePath, 'utf-8');
    return this.render(template, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
