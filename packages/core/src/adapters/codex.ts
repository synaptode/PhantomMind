/**
 * PhantomMindAI — OpenAI Codex CLI Adapter
 *
 * Generates AGENTS.md — the instruction file read by the OpenAI Codex CLI
 * when running in a project directory.
 *
 * Docs: https://github.com/openai/codex
 * Convention: AGENTS.md in project root (and optionally subdirectories)
 */

import { BaseAdapter } from './base.js';
import type { AdapterName } from '../types.js';

export class CodexAdapter extends BaseAdapter {
  readonly name: AdapterName = 'codex';
  readonly outputPath = 'AGENTS.md';
  readonly format = 'markdown' as const;

  generate(skills: string, rules: string, schema: string): string {
    const sections: string[] = [];

    if (skills) {
      sections.push('## Project Knowledge\n');
      sections.push(skills);
      sections.push('');
    }

    if (rules) {
      sections.push('## Coding Guidelines\n');
      sections.push(rules);
      sections.push('');
    }

    if (schema) {
      sections.push('## Data Schemas\n');
      sections.push('Use the following JSON schemas for structured output:\n');
      sections.push('```json');
      sections.push(schema);
      sections.push('```');
      sections.push('');
    }

    return this.wrapHeader(sections.join('\n'));
  }
}
