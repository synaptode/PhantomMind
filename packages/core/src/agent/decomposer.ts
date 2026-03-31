/**
 * PhantomMindAI — Task Decomposer
 * Prompt chaining & automatic task decomposition.
 * Breaks large tasks into analysis → planning → write → validate chains.
 */

import { randomUUID } from 'node:crypto';
import type { ProviderRouter } from '../providers/router.js';
import type { ContextEngine } from '../context/engine.js';
import type { TokenUsage } from '../types.js';

export interface SubTask {
  id: string;
  phase: 'analysis' | 'planning' | 'implementation' | 'validation';
  description: string;
  dependencies: string[];
  estimatedTokens: number;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface DecompositionResult {
  originalTask: string;
  subtasks: SubTask[];
  chain: string[][];
  totalEstimatedTokens: number;
}

export class TaskDecomposer {
  private router: ProviderRouter;
  private contextEngine: ContextEngine;

  constructor(router: ProviderRouter, contextEngine: ContextEngine) {
    this.router = router;
    this.contextEngine = contextEngine;
  }

  /**
   * Estimate token count for a task description
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if a task needs decomposition
   */
  shouldDecompose(description: string, threshold = 500): boolean {
    return this.estimateTokens(description) > threshold;
  }

  /**
   * Decompose a complex task into chainable subtasks
   */
  async decompose(description: string): Promise<DecompositionResult> {
    const context = await this.contextEngine.getProjectContext({ maxTokens: 2000 });
    const contextText = context.layers.map(l => l.content).join('\n\n');

    const response = await this.router.complete({
      systemPrompt: `You are an expert software architect. Your job is to decompose complex tasks into subtasks organized in 4 phases: analysis, planning, implementation, validation.

Project context:
${contextText}`,
      prompt: `Decompose this task into subtasks. Each subtask should be atomic and independently executable.

Task: ${description}

Respond in JSON:
{
  "subtasks": [
    {
      "phase": "analysis|planning|implementation|validation",
      "description": "what to do",
      "dependencies": ["subtask descriptions this depends on"],
      "estimatedTokens": 500
    }
  ]
}

Rules:
- Analysis phase: read files, understand code structure, identify patterns
- Planning phase: design solution, choose approach, identify files to modify
- Implementation phase: write actual code changes
- Validation phase: verify changes, run tests, check consistency`,
      temperature: 0.2,
      maxTokens: 3000,
    });

    const parsed = this.parseDecomposition(response.content);
    const subtasks: SubTask[] = parsed.map(st => ({
      id: randomUUID(),
      phase: st.phase,
      description: st.description,
      dependencies: st.dependencies,
      estimatedTokens: st.estimatedTokens,
      status: 'pending' as const,
    }));

    // Build execution chains (phases run sequentially, within a phase can parallel)
    const chain = this.buildChain(subtasks);

    return {
      originalTask: description,
      subtasks,
      chain,
      totalEstimatedTokens: subtasks.reduce((sum, st) => sum + st.estimatedTokens, 0),
    };
  }

  /**
   * Execute a chain of decomposed subtasks
   */
  async executeChain(
    decomposition: DecompositionResult,
    onProgress?: (subtask: SubTask, index: number) => void,
  ): Promise<{
    outputs: Map<string, string>;
    totalUsage: TokenUsage;
    success: boolean;
  }> {
    const outputs = new Map<string, string>();
    const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 };

    for (const phase of decomposition.chain) {
      // Execute subtasks in each phase sequentially (respecting dependencies)
      for (const subtaskId of phase) {
        const subtask = decomposition.subtasks.find(st => st.id === subtaskId);
        if (!subtask) continue;

        subtask.status = 'running';
        onProgress?.(subtask, decomposition.subtasks.indexOf(subtask));

        // Build context from completed dependencies
        const depContext = subtask.dependencies
          .map(dep => {
            const depTask = decomposition.subtasks.find(
              st => st.description === dep && st.status === 'completed',
            );
            return depTask?.output ? `## ${depTask.description}\n${depTask.output}` : '';
          })
          .filter(Boolean)
          .join('\n\n');

        try {
          const response = await this.router.complete({
            systemPrompt: `You are executing a subtask as part of a larger decomposed task.

Original task: ${decomposition.originalTask}
Current phase: ${subtask.phase}

${depContext ? `Previous phase outputs:\n${depContext}` : ''}`,
            prompt: subtask.description,
            temperature: 0.2,
            maxTokens: subtask.estimatedTokens * 2,
          });

          subtask.output = response.content;
          subtask.status = 'completed';
          outputs.set(subtask.id, response.content);

          totalUsage.inputTokens += response.usage.inputTokens;
          totalUsage.outputTokens += response.usage.outputTokens;
          totalUsage.totalTokens += response.usage.totalTokens;
          totalUsage.estimatedCost += response.usage.estimatedCost;
        } catch (error) {
          subtask.status = 'failed';
          subtask.output = (error as Error).message;
          return { outputs, totalUsage, success: false };
        }
      }
    }

    return { outputs, totalUsage, success: true };
  }

  /**
   * Build execution chain respecting dependencies
   */
  private buildChain(subtasks: SubTask[]): string[][] {
    const phaseOrder: SubTask['phase'][] = ['analysis', 'planning', 'implementation', 'validation'];
    const chain: string[][] = [];

    for (const phase of phaseOrder) {
      const phaseTasks = subtasks.filter(st => st.phase === phase);
      if (phaseTasks.length > 0) {
        chain.push(phaseTasks.map(st => st.id));
      }
    }

    return chain;
  }

  private parseDecomposition(
    content: string,
  ): Array<{
    phase: SubTask['phase'];
    description: string;
    dependencies: string[];
    estimatedTokens: number;
  }> {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.fallbackDecomposition();
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.subtasks ?? []).map((st: any) => ({
        phase: (['analysis', 'planning', 'implementation', 'validation'].includes(st.phase)
          ? st.phase
          : 'implementation') as SubTask['phase'],
        description: st.description ?? '',
        dependencies: Array.isArray(st.dependencies) ? st.dependencies : [],
        estimatedTokens: st.estimatedTokens ?? 500,
      }));
    } catch {
      return this.fallbackDecomposition();
    }
  }

  private fallbackDecomposition() {
    return [
      { phase: 'analysis' as const, description: 'Analyze current codebase', dependencies: [], estimatedTokens: 500 },
      { phase: 'planning' as const, description: 'Plan implementation', dependencies: ['Analyze current codebase'], estimatedTokens: 500 },
      { phase: 'implementation' as const, description: 'Implement changes', dependencies: ['Plan implementation'], estimatedTokens: 1000 },
      { phase: 'validation' as const, description: 'Validate changes', dependencies: ['Implement changes'], estimatedTokens: 500 },
    ];
  }
}
