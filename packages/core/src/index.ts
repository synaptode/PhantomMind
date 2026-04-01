/**
 * PhantomindAI — Main Entry Point
 * Universal AI Development Enhancement Layer
 *
 * @example
 * ```ts
 * import { phantom } from '@phantomind/core';
 *
 * // Initialize
 * await phantom.init();
 *
 * // Get context
 * const ctx = await phantom.ctx();
 *
 * // Complete with auto-routing
 * const response = await phantom.complete('Explain this code');
 *
 * // Run agent
 * const result = await phantom.agent('refactor auth module');
 *
 * // Orchestrate multi-agent
 * const orchestrated = await phantom.orchestrate(
 *   'build user dashboard',
 *   ['architect', 'implementer', 'testWriter'],
 * );
 * ```
 */

import { loadConfig } from './config/loader.js';
import { ContextEngine } from './context/engine.js';
import { CodebaseEmbedder } from './context/embedder.js';
import { ContextLearner } from './context/learner.js';
import { ProviderRouter } from './providers/router.js';
import { AgentExecutor } from './agent/executor.js';
import { AgentOrchestrator } from './agent/orchestrator.js';
import { TaskDecomposer } from './agent/decomposer.js';
import { RetryIntelligence } from './agent/retry.js';
import { TaskQueue } from './agent/queue.js';
import { AgentMemory } from './agent/memory.js';
import { SchemaRegistry } from './schemas/registry.js';
import { AuditTrail } from './observability/audit.js';
import { CostTracker } from './observability/cost-tracker.js';
import { AnalyticsDashboard } from './observability/dashboard.js';
import { SecretScanner } from './quality/secret-scanner.js';
import { HallucinationGuard } from './quality/hallucination-guard.js';
import { ConsistencyEnforcer } from './quality/consistency.js';
import { syncAllAdapters } from './adapters/index.js';
import type {
  PhantomConfig,
  CompletionRequest,
  CompletionResponse,
  ContextResult,
  AgentResult,
  AgentRole,
  AdapterName,
} from './types.js';

export class PhantomMind {
  private projectRoot: string;
  private config!: PhantomConfig;
  private router!: ProviderRouter;
  private contextEngine!: ContextEngine;
  private embedder!: CodebaseEmbedder;
  private learner!: ContextLearner;
  private schemaRegistry!: SchemaRegistry;
  private auditTrail!: AuditTrail;
  private costTracker!: CostTracker;
  private memory!: AgentMemory;
  private queue!: TaskQueue;
  private initialized = false;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot ?? process.cwd();
  }

  /**
   * Initialize PhantomindAI
   */
  async init(configOverride?: Partial<PhantomConfig>): Promise<void> {
    this.config = await loadConfig(this.projectRoot);
    if (configOverride) {
      Object.assign(this.config, configOverride);
    }

    this.router = new ProviderRouter(this.config.providers, this.config.budget ? {
      maxCostPerDay: this.config.budget.maxCostPerDay,
      warningAt: this.config.budget.warningAt,
      fallbackOnBudget: this.config.budget.fallbackOnBudget,
    } : undefined);
    this.contextEngine = new ContextEngine(this.config, this.projectRoot);
    this.embedder = new CodebaseEmbedder(this.projectRoot);
    this.learner = new ContextLearner(this.projectRoot);
    this.schemaRegistry = new SchemaRegistry(this.projectRoot);
    this.auditTrail = new AuditTrail(this.projectRoot);
    this.costTracker = new CostTracker(this.projectRoot, {
      daily: this.config.budget?.maxCostPerDay,
    });
    this.memory = new AgentMemory(this.projectRoot);
    this.queue = new TaskQueue({ maxConcurrent: 3 });

    await this.schemaRegistry.loadCustomSchemas();
    await this.auditTrail.init();
    await this.costTracker.load();
    await this.memory.load();

    // Wire up audit logging for provider requests
    this.router.on('provider:response', ({ provider, model, usage, duration }: any) => {
      this.auditTrail.logProviderRequest(provider, model, usage.inputTokens, usage.outputTokens, usage.estimatedCost, duration, true);
      this.costTracker.record(provider, model, usage);
    });

    this.initialized = true;
  }

  private ensureInit(): void {
    if (!this.initialized) {
      throw new Error('PhantomindAI not initialized. Call phantom.init() first.');
    }
  }

  /**
   * Get project context
   */
  async ctx(options?: { maxTokens?: number; files?: string[] }): Promise<ContextResult> {
    this.ensureInit();
    return this.contextEngine.getProjectContext(options);
  }

  /**
   * Complete a prompt with auto-routing
   */
  async complete(prompt: string, options?: Partial<CompletionRequest>): Promise<CompletionResponse> {
    this.ensureInit();

    const context = await this.contextEngine.getProjectContext({ maxTokens: 2000 });
    const contextText = context.layers.map(l => l.content).join('\n\n');

    return this.router.complete({
      systemPrompt: `You are an AI assistant with deep knowledge of this project.\n\n${contextText}`,
      prompt,
      temperature: 0.7,
      maxTokens: 2000,
      ...options,
    });
  }

  /**
   * Complete with intelligent retry
   */
  async completeWithRetry(
    prompt: string,
    options?: Partial<CompletionRequest>,
  ): Promise<CompletionResponse> {
    this.ensureInit();
    const retry = new RetryIntelligence(this.router, this.contextEngine);
    const result = await retry.execute({
      prompt,
      temperature: 0.7,
      maxTokens: 2000,
      ...options,
    });

    if (!result.success || !result.response) {
      throw new Error(`Failed after ${result.attempts} attempts: ${result.error}`);
    }
    return result.response;
  }

  /**
   * Run an agent task
   */
  async agent(
    task: string,
    options?: { role?: AgentRole; maxSteps?: number },
  ): Promise<AgentResult> {
    this.ensureInit();
    const executor = new AgentExecutor(this.router, this.contextEngine, this.projectRoot, {
      role: options?.role ?? 'implementer',
      maxSteps: options?.maxSteps ?? 30,
    }, this.config);
    return executor.run(task);
  }

  /**
   * Orchestrate multi-agent task
   */
  async orchestrate(
    task: string,
    roles?: AgentRole[],
  ): Promise<import('./agent/orchestrator.js').OrchestrationResult> {
    this.ensureInit();
    const orchestrator = new AgentOrchestrator(this.router, this.contextEngine, this.projectRoot, this.config);
    return orchestrator.orchestrate(task, roles);
  }

  /**
   * Decompose a task
   */
  async decompose(task: string): Promise<import('./agent/decomposer.js').DecompositionResult> {
    this.ensureInit();
    const decomposer = new TaskDecomposer(this.router, this.contextEngine);
    return decomposer.decompose(task);
  }

  /**
   * Queue a task
   */
  enqueue(
    task: string,
    options?: { role?: AgentRole; priority?: 'low' | 'normal' | 'high' | 'critical' },
  ): import('./types.js').QueueTask {
    this.ensureInit();
    return this.queue.enqueue(task, options);
  }

  /**
   * Semantic search across codebase
   */
  async search(query: string, limit = 10): Promise<Array<{ path: string; score: number; snippet: string }>> {
    this.ensureInit();
    await this.embedder.build();
    return this.embedder.search(query, limit);
  }

  /**
   * Sync adapter configurations
   */
  async sync(
    targets?: AdapterName[],
    dryRun = false,
  ): Promise<import('./types.js').SyncResult[]> {
    this.ensureInit();
    let syncConfig = this.config;
    if (targets && targets.length > 0) {
      syncConfig = { ...this.config, adapters: targets };
    }
    return syncAllAdapters(this.projectRoot, syncConfig, dryRun);
  }

  /**
   * Validate code
   */
  async validate(
    content: string,
    filename: string,
  ): Promise<{
    secrets: import('./types.js').SecretMatch[];
    hallucinations: import('./types.js').HallucinationCheck[];
  }> {
    this.ensureInit();
    const scanner = new SecretScanner();
    const guard = new HallucinationGuard(this.projectRoot);

    const secrets = scanner.scan(content, filename);
    const hallucinations = await guard.check(content, filename);

    return { secrets, hallucinations };
  }

  /**
   * Check code consistency
   */
  async checkConsistency(): Promise<import('./types.js').ConsistencyReport> {
    this.ensureInit();
    const enforcer = new ConsistencyEnforcer(this.projectRoot);
    return enforcer.scan();
  }

  /**
   * Get schema
   */
  schema(name: string): import('./schemas/registry.js').SchemaDefinition | undefined {
    this.ensureInit();
    return this.schemaRegistry.get(name);
  }

  /**
   * Get cost report
   */
  costs(period?: 'today' | 'week' | 'month' | 'all'): import('./types.js').CostReport {
    this.ensureInit();
    return this.costTracker.getReport(period);
  }

  /**
   * Get dashboard
   */
  dashboard(): AnalyticsDashboard {
    this.ensureInit();
    return new AnalyticsDashboard(this.costTracker, this.auditTrail);
  }

  /**
   * Learn project patterns
   */
  async learn(): Promise<string> {
    this.ensureInit();
    await this.learner.learn();
    return this.learner.generateSkillsContent();
  }

  /**
   * Save state (costs, memory, etc.)
   */
  async save(): Promise<void> {
    this.ensureInit();
    await this.costTracker.save();
    await this.memory.save();
  }

  /**
   * Access internals
   */
  get internals() {
    this.ensureInit();
    return {
      router: this.router,
      contextEngine: this.contextEngine,
      embedder: this.embedder,
      learner: this.learner,
      schemaRegistry: this.schemaRegistry,
      auditTrail: this.auditTrail,
      costTracker: this.costTracker,
      memory: this.memory,
      queue: this.queue,
      config: this.config,
    };
  }
}

/**
 * Default phantom instance
 */
export const phantom = new PhantomMind();

// Re-export everything
export * from './types.js';
export * from './config/index.js';
export * from './providers/index.js';
export * from './context/index.js';
export * from './adapters/index.js';
export * from './mcp/index.js';
export * from './agent/index.js';
export * from './quality/index.js';
export * from './schemas/index.js';
export * from './observability/index.js';
export * from './templates/index.js';
