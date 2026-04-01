/**
 * PhantomindAI — CLI Serve Command
 * Starts the MCP server for AI tool integration.
 */

export interface ServeOptions {
  port?: number;
  transport?: 'stdio' | 'http';
  verbose?: boolean;
}

export async function serveCommand(
  projectRoot: string,
  options: ServeOptions,
): Promise<void> {
  const chalk = (await import('chalk')).default;

  console.log(chalk.bold.cyan('\n🌐 PhantomindAI — MCP Server\n'));

  try {
    const { startMCPServer } = await import('../mcp/index.js');

    console.log(chalk.dim(`  Transport: ${options.transport ?? 'stdio'}`));
    console.log(chalk.dim(`  Project:   ${projectRoot}`));
    console.log('');
    console.log(chalk.green('Starting MCP server...'));
    console.log(chalk.dim('Press Ctrl+C to stop'));
    console.log('');

    await startMCPServer();
  } catch (error) {
    console.error(chalk.red('Failed to start MCP server:'), (error as Error).message);
    process.exit(1);
  }
}
