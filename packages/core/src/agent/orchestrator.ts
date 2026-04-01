/**
 * PhantomindAI — Multi-Agent Orchestrator
 * Parallel specialized agent execution with role-based coordination.
 */

import { EventEmitter } from 'eventemitter3';
import type { ProviderRouter } from '../providers/router.js';
import type { ContextEngine } from '../context/engine.js';
import type { AgentRole, AgentConfig, AgentResult, TokenUsage } from '../types.js';
import { AgentExecutor } from './executor.js';
import { AgentMemory } from './memory.js';
import { getRoleDefinition } from './roles.js';

export interface OrchestrationPlan {
  sequential: OrchestrationPhase[];
}

export interface OrchestrationPhase {
  name: string;
  description: string;
  agents: Array<{
    role: AgentRole;
    task: string;
  }>;
  aggregation: 'merge' | 'best' | 'consensus';
}

export interface OrchestrationResult {
  success: boolean;
  phases: Array<{
    name: string;
    results: Array<{
      role: AgentRole;
      result: AgentResult;
    }>;
    aggregatedOutput: string;
  }>;
  totalUsage: TokenUsage;
  duration: number;
}

export class AgentOrchestrator extends EventEmitter {
  private router: ProviderRouter;
  private contextEngine: ContextEngine;
  private projectRoot: string;
  private memory: AgentMemory;

  constructor(
    router: ProviderRouter,
    contextEngine: ContextEngine,
    projectRoot: string,
  ) {
    super();
    this.router = router;
    this.contextEngine = contextEngine;
    this.projectRoot = projectRoot;
    this.memory = new AgentMemory(projectRoot);
  }

  /**
   * Orchestrate multiple agents working on a complex task
   */
  async orchestrate(
    description: string,
    roles: AgentRole[] = ['architect', 'implementer', 'securityReviewer'],
  ): Promise<OrchestrationResult> {
    await this.memory.load();
    const startTime = Date.now();
    const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 };

    // Build orchestration plan
    const plan = this.buildPlan(description, roles);
    this.emit('orchestration:start', { description, plan });

    const phaseResults: OrchestrationResult['phases'] = [];

    for (const phase of plan.sequential) {
      this.emit('orchestration:phase', { phase: phase.name });

      const results: Array<{ role: AgentRole; result: AgentResult }> = [];

      // Execute agents in parallel within a phase
      const agentPromises = phase.agents.map(async ({ role, task }) => {
        const config: AgentConfig = {
          role,
          maxSteps: 15,
        };

        const executor = new AgentExecutor(
          this.router,
          this.contextEngine,
          this.projectRoot,
          config,
        );

        const result = await executor.run(task);
        return { role, result };
      });

      const agentResults = await Promise.allSettled(agentPromises);

      for (const settledResult of agentResults) {
        if (settledResult.status === 'fulfilled') {
          results.push(settledResult.value);
          this.addUsage(totalUsage, settledResult.value.result.totalTokenUsage);
        }
      }

      // Aggregate results
      const aggregatedOutput = await this.aggregate(
        phase.aggregation,
        results,
        description,
      );

      phaseResults.push({
        name: phase.name,
        results,
        aggregatedOutput,
      });

      this.emit('orchestration:phase-complete', {
        phase: phase.name,
        results,
        aggregatedOutput,
      });
    }

    const success = phaseResults.every(p =>
      p.results.some(r => r.result.success),
    );

    // Record to memory
    this.memory.recordDecision(
      'orchestration',
      `Orchestrated ${roles.join(', ')} for: ${description.slice(0, 100)}`,
      `${phaseResults.length} phases, ${success ? 'succeeded' : 'failed'}`,
      [],
    );
    await this.memory.save();

    const result: OrchestrationResult = {
      success,
      phases: phaseResults,
      totalUsage,
      duration: Date.now() - startTime,
    };

    this.emit('orchestration:complete', result);
    return result;
  }

  /**
   * Build an orchestration plan based on roles and task
   */
  private buildPlan(description: string, roles: AgentRole[]): OrchestrationPlan {
    const phases: OrchestrationPhase[] = [];

    // Phase 1: Analysis (architect)
    if (roles.includes('architect')) {
      phases.push({
        name: 'analysis',
        description: 'Analyze task and design solution',
        agents: [{
          role: 'architect',
          task: `Analyze this task and provide a detailed architecture/design plan: ${description}`,
        }],
        aggregation: 'best',
      });
    }

    // Phase 2: Implementation + Security Review (parallel)
    const implPhase: OrchestrationPhase = {
      name: 'implementation',
      description: 'Implement and review',
      agents: [],
      aggregation: 'merge',
    };

    if (roles.includes('implementer')) {
      implPhase.agents.push({
        role: 'implementer',
        task: `Implement this task following best practices: ${description}`,
      });
    }
    if (roles.includes('securityReviewer')) {
      implPhase.agents.push({
        role: 'securityReviewer',
        task: `Security review for this implementation: ${description}`,
      });
    }
    if (implPhase.agents.length > 0) {
      phases.push(implPhase);
    }

    // Phase 3: Testing + Documentation (parallel)
    const verifyPhase: OrchestrationPhase = {
      name: 'verification',
      description: 'Test and document',
      agents: [],
      aggregation: 'merge',
    };

    if (roles.includes('testWriter')) {
      verifyPhase.agents.push({
        role: 'testWriter',
        task: `Write comprehensive tests for: ${description}`,
      });
    }
    if (roles.includes('documentWriter')) {
      verifyPhase.agents.push({
        role: 'documentWriter',
        task: `Write documentation for: ${description}`,
      });
    }
    if (verifyPhase.agents.length > 0) {
      phases.push(verifyPhase);
    }

    // Fallback: if no phases were created
    if (phases.length === 0) {
      phases.push({
        name: 'execution',
        description: 'Execute task',
        agents: roles.map(role => ({
          role,
          task: `${getRoleDefinition(role).displayName}: ${description}`,
        })),
        aggregation: 'merge',
      });
    }

    return { sequential: phases };
  }

  /**
   * Aggregate results from multiple agents
   */
  private async aggregate(
    method: 'merge' | 'best' | 'consensus',
    results: Array<{ role: AgentRole; result: AgentResult }>,
    originalTask: string,
  ): Promise<string> {
    if (results.length === 0) return 'No results';
    if (results.length === 1) return results[0].result.summary;

    switch (method) {
      case 'best':
        return results.reduce((best, current) =>
          current.result.success && !best.result.success ? current : best,
        ).result.summary;

      case 'merge':
        return results.map(r =>
          `### ${getRoleDefinition(r.role).displayName}\n${r.result.summary}`,
        ).join('\n\n');

      case 'consensus':
        // Use LLM to find consensus among agent outputs
        try {
          const summaries = results.map(r =>
            `**${getRoleDefinition(r.role).displayName}**: ${r.result.summary}`,
          ).join('\n\n');

          const response = await this.router.complete({
            systemPrompt: 'You are synthesizing outputs from multiple specialized agents into a coherent consensus.',
            prompt: `Original task: ${originalTask}\n\nAgent outputs:\n${summaries}\n\nSynthesize these into a unified recommendation.`,
            temperature: 0.3,
            maxTokens: 1500,
          });

          return response.content;
        } catch {
          return results.map(r => r.result.summary).join('\n\n');
        }
    }
  }

  private addUsage(total: TokenUsage, add: TokenUsage): void {
    total.inputTokens += add.inputTokens;
    total.outputTokens += add.outputTokens;
    total.totalTokens += add.totalTokens;
    total.estimatedCost += add.estimatedCost;
  }
}
