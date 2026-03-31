/**
 * PhantomMindAI — Windsurf Adapter
 */

import { BaseAdapter } from './base.js';
import type { AdapterName } from '../types.js';

export class WindsurfAdapter extends BaseAdapter {
  readonly name: AdapterName = 'windsurf';
  readonly outputPath = '.windsurfrules';
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
      sections.push('# Rules');
      sections.push('');
      sections.push(rules);
      sections.push('');
    }

    if (schema) {
      sections.push('# Output Schemas');
      sections.push('');
      sections.push(schema);
      sections.push('');
    }

    return this.wrapHeader(sections.join('\n'));
  }
}
