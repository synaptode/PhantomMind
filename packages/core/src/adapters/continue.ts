/**
 * PhantomMindAI — Continue Adapter
 */

import { BaseAdapter } from './base.js';
import type { AdapterName } from '../types.js';

export class ContinueAdapter extends BaseAdapter {
  readonly name: AdapterName = 'continue';
  readonly outputPath = '.continue/config.json';
  readonly format = 'json' as const;

  generate(skills: string, rules: string, schema: string): string {
    const config = {
      systemMessage: [
        skills ? `## Project Knowledge\n${skills}` : '',
        rules ? `## Rules\n${rules}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      models: [],
      customCommands: [
        {
          name: 'phantomind-context',
          description: 'Inject PhantomMindAI project context',
          prompt: skills || 'No project context available.',
        },
      ],
    };

    return JSON.stringify(config, null, 2);
  }
}
