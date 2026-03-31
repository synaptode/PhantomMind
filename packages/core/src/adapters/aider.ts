/**
 * PhantomMindAI — Aider Adapter
 */

import { BaseAdapter } from './base.js';
import type { AdapterName } from '../types.js';

export class AiderAdapter extends BaseAdapter {
  readonly name: AdapterName = 'aider';
  readonly outputPath = '.aider.conf.yml';
  readonly format = 'yaml' as const;

  generate(skills: string, rules: string, _schema: string): string {
    const lines: string[] = [];

    const combinedContext = [
      skills ? `Project Knowledge:\n${skills}` : '',
      rules ? `Rules:\n${rules}` : '',
    ].filter(Boolean).join('\n\n');

    if (combinedContext) {
      // Escape for YAML multiline string
      lines.push('read:');
      lines.push('  - .phantomind/SKILLS.md');
      lines.push('  - .phantomind/RULES.md');
    }

    return lines.join('\n');
  }
}
