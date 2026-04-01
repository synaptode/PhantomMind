/**
 * PhantomindAI — GitHub Copilot Adapter
 */

import { BaseAdapter } from './base.js';
import type { AdapterName } from '../types.js';

export class CopilotAdapter extends BaseAdapter {
  readonly name: AdapterName = 'copilot';
  readonly outputPath = '.github/copilot-instructions.md';
  readonly format = 'markdown' as const;

  generate(skills: string, rules: string, schema: string): string {
    const sections: string[] = [];

    if (skills) {
      sections.push('## Project Knowledge\n');
      sections.push(skills);
      sections.push('');
    }

    if (rules) {
      sections.push('## Rules & Constraints\n');
      sections.push(rules);
      sections.push('');
    }

    if (schema) {
      sections.push('## Output Schemas\n');
      sections.push('```json');
      sections.push(schema);
      sections.push('```');
      sections.push('');
    }

    return this.wrapHeader(sections.join('\n'));
  }
}
