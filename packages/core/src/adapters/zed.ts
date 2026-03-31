/**
 * PhantomMindAI — Zed AI Adapter
 */

import { BaseAdapter } from './base.js';
import type { AdapterName } from '../types.js';

export class ZedAdapter extends BaseAdapter {
  readonly name: AdapterName = 'zed';
  readonly outputPath = '.zed/settings.json';
  readonly format = 'json' as const;

  generate(skills: string, rules: string, schema: string): string {
    const systemPrompt = [
      skills ? `## Project Knowledge\n${skills}` : '',
      rules ? `## Rules\n${rules}` : '',
    ].filter(Boolean).join('\n\n');

    const config = {
      assistant: {
        version: '2',
        default_model: {
          provider: 'copilot_chat',
          model: 'gpt-4o',
        },
        system_prompt: systemPrompt,
      },
    };

    return JSON.stringify(config, null, 2);
  }
}
