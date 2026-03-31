/**
 * PhantomMindAI — Cursor Adapter
 */

import { BaseAdapter } from './base.js';
import type { AdapterName } from '../types.js';

export class CursorAdapter extends BaseAdapter {
  readonly name: AdapterName = 'cursor';
  readonly outputPath = '.cursorrules';
  readonly format = 'text' as const;

  generate(skills: string, rules: string, schema: string): string {
    const sections: string[] = [];

    if (skills) {
      sections.push('# Project Knowledge');
      sections.push('');
      sections.push(skills);
      sections.push('');
    }

    if (rules) {
      sections.push('# Rules & Constraints');
      sections.push('');
      sections.push(rules);
      sections.push('');
    }

    if (schema) {
      sections.push('# Output Schemas');
      sections.push('');
      sections.push('```json');
      sections.push(schema);
      sections.push('```');
      sections.push('');
    }

    return this.wrapHeader(sections.join('\n'));
  }
}
