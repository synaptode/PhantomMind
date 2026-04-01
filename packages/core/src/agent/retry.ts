/**
 * PhantomindAI — Retry Intelligence
 * 5 strategies: decompose, add-schema, switch-provider, add-grounding, escalate.
 */

import type { ProviderRouter } from '../providers/router.js';
import type { ContextEngine } from '../context/engine.js';
import type { CompletionRequest, CompletionResponse } from '../types.js';

export type RetryStrategy =
  | 'decompose'
  | 'add-schema'
  | 'switch-provider'
  | 'add-grounding'
  | 'escalate';

export interface RetryContext {
  request: CompletionRequest;
  error: Error;
  attempt: number;
  previousStrategies: RetryStrategy[];
}

export interface RetryResult {
  success: boolean;
  response?: CompletionResponse;
  strategy: RetryStrategy;
  attempts: number;
  error?: string;
}

export class RetryIntelligence {
  private router: ProviderRouter;
  private contextEngine: ContextEngine;
  private maxRetries: number;

  private strategyOrder: RetryStrategy[] = [
    'decompose',
    'add-schema',
    'switch-provider',
    'add-grounding',
    'escalate',
  ];

  constructor(
    router: ProviderRouter,
    contextEngine: ContextEngine,
    maxRetries = 5,
  ) {
    this.router = router;
    this.contextEngine = contextEngine;
    this.maxRetries = maxRetries;
  }

  /**
   * Execute a request with intelligent retry
   */
  async execute(request: CompletionRequest): Promise<RetryResult> {
    let lastError: Error | undefined;
    const usedStrategies: RetryStrategy[] = [];

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.router.complete(request);
        return {
          success: true,
          response,
          strategy: usedStrategies[usedStrategies.length - 1] ?? 'decompose',
          attempts: attempt + 1,
        };
      } catch (error) {
        lastError = error as Error;

        if (attempt >= this.maxRetries) break;

        const strategy = this.selectStrategy({
          request,
          error: lastError,
          attempt,
          previousStrategies: usedStrategies,
        });

        usedStrategies.push(strategy);
        request = await this.applyStrategy(strategy, request, lastError);
      }
    }

    return {
      success: false,
      strategy: usedStrategies[usedStrategies.length - 1] ?? 'escalate',
      attempts: this.maxRetries + 1,
      error: lastError?.message,
    };
  }

  /**
   * Select the best retry strategy based on the error and context
   */
  private selectStrategy(ctx: RetryContext): RetryStrategy {
    const errorMsg = ctx.error.message.toLowerCase();

    // Rate limiting or quota → switch provider
    if (errorMsg.includes('rate limit') || errorMsg.includes('429') || errorMsg.includes('quota')) {
      if (!ctx.previousStrategies.includes('switch-provider')) return 'switch-provider';
    }

    // Token limit exceeded → decompose
    if (errorMsg.includes('token') || errorMsg.includes('context length') || errorMsg.includes('too long')) {
      if (!ctx.previousStrategies.includes('decompose')) return 'decompose';
    }

    // JSON parse error or format issue → add schema
    if (errorMsg.includes('json') || errorMsg.includes('parse') || errorMsg.includes('format')) {
      if (!ctx.previousStrategies.includes('add-schema')) return 'add-schema';
    }

    // Hallucination or accuracy issue → add grounding
    if (errorMsg.includes('hallucination') || errorMsg.includes('incorrect') || errorMsg.includes('invalid')) {
      if (!ctx.previousStrategies.includes('add-grounding')) return 'add-grounding';
    }

    // Use the next unused strategy in order
    for (const strategy of this.strategyOrder) {
      if (!ctx.previousStrategies.includes(strategy)) {
        return strategy;
      }
    }

    return 'escalate';
  }

  /**
   * Apply a retry strategy to the request
   */
  private async applyStrategy(
    strategy: RetryStrategy,
    request: CompletionRequest,
    error: Error,
  ): Promise<CompletionRequest> {
    switch (strategy) {
      case 'decompose':
        return this.strategyDecompose(request);
      case 'add-schema':
        return this.strategyAddSchema(request);
      case 'switch-provider':
        return this.strategySwitchProvider(request);
      case 'add-grounding':
        return await this.strategyAddGrounding(request);
      case 'escalate':
        return this.strategyEscalate(request, error);
    }
  }

  /**
   * Strategy: Decompose — simplify the prompt
   */
  private strategyDecompose(request: CompletionRequest): CompletionRequest {
    return {
      ...request,
      prompt: `Focus on the most important aspect of this request and provide a concise response:\n\n${request.prompt}`,
      maxTokens: Math.min(request.maxTokens ?? 2000, 1000),
    };
  }

  /**
   * Strategy: Add Schema — enforce JSON output format
   */
  private strategyAddSchema(request: CompletionRequest): CompletionRequest {
    const schemaInstruction = `\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no explanations outside JSON. If you need to include code, escape it properly within JSON strings.`;

    return {
      ...request,
      systemPrompt: (request.systemPrompt ?? '') + schemaInstruction,
      temperature: Math.max((request.temperature ?? 0.7) - 0.2, 0),
    };
  }

  /**
   * Strategy: Switch Provider — try a different LLM provider
   */
  private strategySwitchProvider(request: CompletionRequest): CompletionRequest {
    return {
      ...request,
      // The router's fallback mechanism will handle provider switching
      // We just need to modify the request slightly to trigger a fresh attempt
      temperature: (request.temperature ?? 0.7) + 0.1,
    };
  }

  /**
   * Strategy: Add Grounding — provide more context
   */
  private async strategyAddGrounding(request: CompletionRequest): Promise<CompletionRequest> {
    const context = await this.contextEngine.getProjectContext({ maxTokens: 1500 });
    const groundingContext = context.layers.map(l => l.content).join('\n\n');

    return {
      ...request,
      systemPrompt: `${request.systemPrompt ?? ''}\n\n## Grounding Context\nUse the following verified project information to ensure accuracy:\n${groundingContext}`,
    };
  }

  /**
   * Strategy: Escalate — last resort, add explicit error context
   */
  private strategyEscalate(request: CompletionRequest, error: Error): CompletionRequest {
    return {
      ...request,
      systemPrompt: `${request.systemPrompt ?? ''}\n\nIMPORTANT: Previous attempt failed with error: "${error.message}". Please adjust your response to avoid this issue. Be more conservative and precise.`,
      temperature: 0.1,
    };
  }
}
