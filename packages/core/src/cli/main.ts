#!/usr/bin/env node

/**
 * PhantomMindAI — CLI Entry Point
 * Universal AI development enhancement layer.
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}

const program = new Command();

program
  .name('phantomind')
  .description('🔮 PhantomMindAI — Universal AI Development Enhancement Layer')
  .version(getVersion());

// phantomind init
program
  .command('init')
  .description('Initialize PhantomMindAI in your project')
  .option('-a, --adapters <adapters...>', 'Target adapters (copilot, cursor, cline, etc.)')
  .option('-p, --provider <provider>', 'Primary LLM provider')
  .option('-m, --model <model>', 'Default model to use')
  .option('-t, --template <template>', 'Project template (auto, default, node-library, node-cli, react-app, nextjs-app)')
  .option('-y, --yes', 'Skip interactive prompts')
  .action(async (options) => {
    const { initCommand } = await import('./init.js');
    await initCommand(process.cwd(), options);
  });

// phantomind sync
// phantomind learn
program
  .command('learn')
  .description('Scan codebase and auto-detect tech stack, patterns, and conventions')
  .option('-s, --sync', 'Also run sync after learning')
  .option('-v, --verbose', 'Detailed output')
  .action(async (options) => {
    const { learnCommand } = await import('./learn.js');
    await learnCommand(process.cwd(), options);
  });

program
  .command('sync')
  .description('Sync adapter configurations for AI tools')
  .option('-a, --adapters <adapters...>', 'Target adapters to sync')
  .option('-d, --dry-run', 'Show what would change without writing')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    const { syncCommand } = await import('./sync.js');
    await syncCommand(process.cwd(), options);
  });

program
  .command('diff')
  .description('Show adapter output diffs without writing files')
  .option('-a, --adapters <adapters...>', 'Target adapters to diff')
  .option('-v, --verbose', 'Show full diff output')
  .action(async (options) => {
    const { diffCommand } = await import('./diff.js');
    await diffCommand(process.cwd(), options);
  });

program
  .command('context')
  .description('Preview ranked context or search context sections')
  .option('-f, --file <file>', 'Preview context ranked for a specific file')
  .option('-s, --search <query>', 'Search context files for relevant sections')
  .option('-m, --max-tokens <tokens>', 'Maximum token budget to display')
  .option('--json', 'Output raw JSON')
  .action(async (options) => {
    const { contextCommand } = await import('./context.js');
    await contextCommand(process.cwd(), options);
  });

program
  .command('compare')
  .description('Compare generated adapter payloads side by side')
  .option('-a, --adapters <adapters...>', 'Target adapters to compare')
  .option('-p, --preview', 'Show preview of generated output')
  .action(async (options) => {
    const { compareCommand } = await import('./compare.js');
    await compareCommand(process.cwd(), options);
  });

program
  .command('watch')
  .description('Watch project files and refresh learned context automatically')
  .option('-s, --sync', 'Also sync adapters after learning')
  .action(async (options) => {
    const { watchCommand } = await import('./watch.js');
    await watchCommand(process.cwd(), options);
  });

program
  .command('hooks')
  .description('Install git hooks to keep context in sync')
  .option('-f, --force', 'Overwrite existing hooks')
  .action(async (options) => {
    const { hooksCommand } = await import('./hooks.js');
    await hooksCommand(process.cwd(), options);
  });

// phantomind serve
program
  .command('serve')
  .description('Start the MCP server')
  .option('-p, --port <port>', 'Server port (for HTTP transport)', '3100')
  .option('-t, --transport <type>', 'Transport type (stdio, http)', 'stdio')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (options) => {
    const { serveCommand } = await import('./serve.js');
    await serveCommand(process.cwd(), options);
  });

// phantomind eval
program
  .command('eval')
  .description('Evaluate AI provider connection and response')
  .option('-p, --provider <provider>', 'Provider to test')
  .option('-m, --model <model>', 'Model to test')
  .option('--prompt <prompt>', 'Custom test prompt')
  .action(async (options) => {
    const { evalCommand } = await import('./eval.js');
    await evalCommand(process.cwd(), options);
  });

// phantomind validate
program
  .command('validate')
  .description('Validate code for quality issues')
  .argument('[files...]', 'Files to validate')
  .option('--no-secrets', 'Skip secret scanning')
  .option('--no-hallucinations', 'Skip hallucination checking')
  .option('--no-consistency', 'Skip consistency checking')
  .option('--fix', 'Auto-fix issues where possible')
  .action(async (files, options) => {
    const { validateCommand } = await import('./validate.js');
    await validateCommand(process.cwd(), { ...options, files });
  });

// phantomind audit
program
  .command('audit')
  .description('View audit trail and analytics')
  .option('-p, --period <period>', 'Time period (today, week, month, all)', 'today')
  .option('-f, --format <format>', 'Output format (terminal, markdown, json)', 'terminal')
  .option('-t, --type <type>', 'Report type (dashboard, costs, actions)', 'dashboard')
  .action(async (options) => {
    const { auditCommand } = await import('./audit.js');
    await auditCommand(process.cwd(), options);
  });

// phantomind stats
program
  .command('stats')
  .description('Show project statistics and context info')
  .option('-v, --verbose', 'Detailed output')
  .option('-l, --learn', 'Run pattern learning')
  .action(async (options) => {
    const { statsCommand } = await import('./stats.js');
    await statsCommand(process.cwd(), options);
  });

// phantomind agent
program
  .command('agent <task>')
  .description('Run an agentic task')
  .option('-r, --role <role>', 'Agent role (architect, implementer, securityReviewer, testWriter, documentWriter)', 'implementer')
  .option('-o, --orchestrate', 'Use multi-agent orchestration')
  .option('--roles <roles...>', 'Roles for orchestration')
  .option('--max-steps <steps>', 'Maximum execution steps', '30')
  .action(async (task, options) => {
    const { agentCommand } = await import('./agent.js');
    await agentCommand(process.cwd(), task, {
      ...options,
      maxSteps: parseInt(options.maxSteps, 10),
    });
  });

// phantomind schema
program
  .command('schema [name]')
  .description('List or show schema definitions')
  .option('-l, --list', 'List all schemas')
  .option('-s, --search <query>', 'Search schemas')
  .action(async (name, options) => {
    const { SchemaRegistry } = await import('../schemas/index.js');
    const registry = new SchemaRegistry(process.cwd());
    await registry.loadCustomSchemas();

    if (options.list || !name) {
      const schemas = options.search
        ? registry.search(options.search)
        : registry.list();
      console.log(`\nAvailable Schemas (${schemas.length}):\n`);
      for (const s of schemas) {
        console.log(`  ${s.name} — ${s.description} ${s.tags ? `[${s.tags.join(', ')}]` : ''}`);
      }
      console.log('');
    } else {
      const schema = registry.get(name);
      if (schema) {
        console.log(`\n${schema.name} — ${schema.description}\n`);
        console.log(JSON.stringify(schema.schema, null, 2));
        console.log('');
      } else {
        console.error(`Schema '${name}' not found`);
        process.exit(1);
      }
    }
  });

program.parse();
