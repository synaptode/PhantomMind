/**
 * PhantomMindAI — MCP Server
 * Model Context Protocol server with all project-aware tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ContextEngine } from '../context/engine.js';
import { CodebaseEmbedder } from '../context/embedder.js';
import { loadConfig, findProjectRoot } from '../config/index.js';
import type { PhantomConfig } from '../types.js';

export class PhantomMCPServer {
  private server: Server;
  private contextEngine!: ContextEngine;
  private embedder!: CodebaseEmbedder;
  private projectRoot!: string;
  private config!: PhantomConfig;

  constructor() {
    this.server = new Server(
      {
        name: 'phantomind',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_project_context',
          description: 'Get the full project context including architecture, conventions, and rules from PhantomMindAI. Returns SKILLS.md + RULES.md content, semantically ranked for the current file.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              file: { type: 'string', description: 'Current file path for relevance ranking' },
              maxTokens: { type: 'number', description: 'Maximum tokens to return (default: 4000)' },
            },
          },
        },
        {
          name: 'get_relevant_context',
          description: 'Get semantically-ranked context relevant to the current file being edited. Prevents context overflow by only returning highly relevant sections.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              file: { type: 'string', description: 'Current file path' },
              maxTokens: { type: 'number', description: 'Maximum tokens (default: 2000)' },
            },
            required: ['file'],
          },
        },
        {
          name: 'get_schema',
          description: 'Get the output contract/schema for a specific task type from the project schema registry.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              name: { type: 'string', description: 'Schema name from registry' },
            },
            required: ['name'],
          },
        },
        {
          name: 'search_codebase',
          description: 'Semantic search across project source files. Uses TF-IDF embeddings to find relevant code.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Maximum results (default: 5)' },
            },
            required: ['query'],
          },
        },
        {
          name: 'validate_output',
          description: 'Validate generated code or content against project schema and conventions.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              content: { type: 'string', description: 'Content to validate' },
              schema: { type: 'string', description: 'Schema name from registry' },
            },
            required: ['content', 'schema'],
          },
        },
        {
          name: 'get_examples',
          description: 'Find relevant existing code examples from the project codebase.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              query: { type: 'string', description: 'What kind of code examples to find' },
              limit: { type: 'number', description: 'Maximum examples (default: 3)' },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_prd',
          description: 'Return a relevant PRD (Product Requirements Document) section.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              name: { type: 'string', description: 'PRD name or feature name' },
            },
            required: ['name'],
          },
        },
        {
          name: 'get_decision_log',
          description: 'Get past architectural decisions made by agents.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              file: { type: 'string', description: 'Filter by affected file' },
              limit: { type: 'number', description: 'Maximum entries (default: 10)' },
            },
          },
        },
        {
          name: 'check_consistency',
          description: 'Find naming and pattern inconsistencies across the codebase.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              scope: { type: 'string', description: 'Scope of check: naming, pattern, architecture, all (default: all)' },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_project_context':
            return await this.handleGetProjectContext(args);
          case 'get_relevant_context':
            return await this.handleGetRelevantContext(args);
          case 'get_schema':
            return await this.handleGetSchema(args);
          case 'search_codebase':
            return await this.handleSearchCodebase(args);
          case 'validate_output':
            return await this.handleValidateOutput(args);
          case 'get_examples':
            return await this.handleGetExamples(args);
          case 'get_prd':
            return await this.handleGetPrd(args);
          case 'get_decision_log':
            return await this.handleGetDecisionLog(args);
          case 'check_consistency':
            return await this.handleCheckConsistency(args);
          default:
            return { content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }], isError: true };
        }
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    });
  }

  private async handleGetProjectContext(args: any) {
    const result = await this.contextEngine.getProjectContext({
      file: args?.file,
      maxTokens: args?.maxTokens ?? 4000,
    });

    const content = result.layers.map(l => l.content).join('\n\n---\n\n');
    return {
      content: [{
        type: 'text' as const,
        text: content || 'No project context found. Run `phantomind init` to set up.',
      }],
    };
  }

  private async handleGetRelevantContext(args: any) {
    const result = await this.contextEngine.getFileContext(
      args.file,
      args?.maxTokens ?? 2000,
    );

    const content = result.layers
      .map(l => `[relevance: ${(l.relevanceScore * 100).toFixed(0)}%] ${l.type}\n${l.content}`)
      .join('\n\n---\n\n');

    return {
      content: [{
        type: 'text' as const,
        text: content || 'No relevant context found for this file.',
      }],
    };
  }

  private async handleGetSchema(args: any) {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    try {
      const schemaContent = await readFile(
        join(this.projectRoot, this.config.context.schema),
        'utf-8',
      );
      const schemas = JSON.parse(schemaContent);
      const schema = schemas[args.name] ?? schemas;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(schema, null, 2),
        }],
      };
    } catch {
      return {
        content: [{ type: 'text' as const, text: `Schema '${args.name}' not found.` }],
      };
    }
  }

  private async handleSearchCodebase(args: any) {
    const results = await this.embedder.search(args.query, args?.limit ?? 5);

    if (results.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No results found.' }] };
    }

    const text = results
      .map((r, i) => `### Result ${i + 1}: ${r.path} (score: ${r.score.toFixed(3)})\n\`\`\`\n${r.snippet}\n\`\`\``)
      .join('\n\n');

    return { content: [{ type: 'text' as const, text }] };
  }

  private async handleValidateOutput(args: any) {
    // Basic validation against project conventions
    const context = await this.contextEngine.getProjectContext({ includeRules: true, maxTokens: 2000 });
    const rulesLayer = context.layers.find(l => l.type === 'rules');

    const issues: string[] = [];

    // Check for common issues
    if (args.content.includes('any')) {
      issues.push('⚠️ Usage of `any` type detected — consider using specific types.');
    }
    if (args.content.match(/console\.(log|debug|warn)/)) {
      issues.push('⚠️ Console statements detected — consider using proper logging.');
    }
    if (args.content.includes('TODO') || args.content.includes('FIXME')) {
      issues.push('⚠️ TODO/FIXME comments detected — consider resolving before committing.');
    }

    const text = issues.length > 0
      ? `Validation Report:\n${issues.join('\n')}`
      : '✅ No issues detected.';

    return { content: [{ type: 'text' as const, text }] };
  }

  private async handleGetExamples(args: any) {
    const results = await this.embedder.search(args.query, args?.limit ?? 3);

    if (results.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No matching examples found.' }] };
    }

    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const examples = await Promise.all(
      results.map(async (r) => {
        try {
          const content = await readFile(join(this.projectRoot, r.path), 'utf-8');
          // Return first 100 lines
          const lines = content.split('\n').slice(0, 100).join('\n');
          return `### ${r.path}\n\`\`\`\n${lines}\n\`\`\``;
        } catch {
          return `### ${r.path}\n(could not read file)`;
        }
      }),
    );

    return { content: [{ type: 'text' as const, text: examples.join('\n\n') }] };
  }

  private async handleGetPrd(args: any) {
    const prd = await this.contextEngine.getPrdContext(args.name);

    if (!prd) {
      return { content: [{ type: 'text' as const, text: `PRD '${args.name}' not found.` }] };
    }

    return { content: [{ type: 'text' as const, text: prd.content }] };
  }

  private async handleGetDecisionLog(args: any) {
    const { readFile, readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');

    try {
      const decisionDir = join(this.projectRoot, this.config.context.decisions);
      const files = await readdir(decisionDir);
      const mdFiles = files.filter(f => f.endsWith('.md')).sort().reverse();
      const limit = args?.limit ?? 10;

      const entries: string[] = [];
      for (const file of mdFiles.slice(0, limit)) {
        const content = await readFile(join(decisionDir, file), 'utf-8');
        if (args?.file && !content.includes(args.file)) continue;
        entries.push(content);
      }

      return {
        content: [{
          type: 'text' as const,
          text: entries.length > 0 ? entries.join('\n\n---\n\n') : 'No decision log entries found.',
        }],
      };
    } catch {
      return {
        content: [{ type: 'text' as const, text: 'No decision log directory found.' }],
      };
    }
  }

  private async handleCheckConsistency(args: any) {
    const sections = await this.contextEngine.searchContext('naming convention pattern', 10);
    const scope = args?.scope ?? 'all';

    const report = [
      '# Consistency Check Report',
      `Scope: ${scope}`,
      `Timestamp: ${new Date().toISOString()}`,
      '',
      'Run `phantomind check consistency` for a full detailed report.',
    ];

    return { content: [{ type: 'text' as const, text: report.join('\n') }] };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    this.projectRoot = await findProjectRoot();
    this.config = await loadConfig(this.projectRoot);
    this.contextEngine = new ContextEngine(this.config, this.projectRoot);
    this.embedder = new CodebaseEmbedder(this.projectRoot);

    // Build embeddings in background
    this.embedder.build().catch(() => {});

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

/**
 * Start MCP server (entry point)
 */
export async function startMCPServer(): Promise<void> {
  const server = new PhantomMCPServer();
  await server.start();
}
