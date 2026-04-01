/**
 * PhantomindAI — Agent Executor
 * Multi-step agentic task execution with human checkpoints.
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'eventemitter3';
import type { ProviderRouter } from '../providers/router.js';
import type { ContextEngine } from '../context/engine.js';
import { AnomalyDetector } from '../quality/anomaly.js';
import { SecretScanner } from '../quality/secret-scanner.js';
import { HallucinationGuard } from '../quality/hallucination-guard.js';
import { DualVerifier } from '../quality/dual-verifier.js';
import type {
  AgentConfig,
  AgentRole,
  AgentTask,
  AgentStep,
  AgentResult,
  DecisionEntry,
  TokenUsage,
  HumanCheckpointConfig,
  PhantomConfig,
} from '../types.js';
import { getRoleSystemPrompt } from './roles.js';

export type CheckpointHandler = (
  step: AgentStep,
  task: AgentTask,
) => Promise<'approve' | 'reject' | 'modify'>;

export class AgentExecutor extends EventEmitter {
  private router: ProviderRouter;
  private contextEngine: ContextEngine;
  private anomalyDetector: AnomalyDetector;
  private secretScanner: SecretScanner;
  private hallucinationGuard: HallucinationGuard;
  private dualVerifier?: DualVerifier;
  private projectRoot: string;
  private config: AgentConfig;
  private checkpointHandler?: CheckpointHandler;

  constructor(
    router: ProviderRouter,
    contextEngine: ContextEngine,
    projectRoot: string,
    config: AgentConfig,
    phantomConfig?: PhantomConfig,
  ) {
    super();
    this.router = router;
    this.contextEngine = contextEngine;
    this.projectRoot = projectRoot;
    this.config = config;
    this.anomalyDetector = new AnomalyDetector();
    this.secretScanner = new SecretScanner();
    this.hallucinationGuard = new HallucinationGuard(projectRoot);
    if (phantomConfig?.quality?.dualVerification) {
      this.dualVerifier = new DualVerifier(router, contextEngine, phantomConfig);
    }
  }

  /**
   * Set checkpoint handler for human-in-the-loop
   */
  onCheckpoint(handler: CheckpointHandler): void {
    this.checkpointHandler = handler;
  }

  /**
   * Execute a task
   */
  async run(description: string): Promise<AgentResult> {
    const task: AgentTask = {
      id: randomUUID(),
      description,
      status: 'running',
      role: this.config.role,
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.emit('agent:start', { task });
    const startTime = Date.now();
    const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 };
    const decisions: DecisionEntry[] = [];
    const filesChanged: string[] = [];

    try {
      // Get project context
      const context = await this.contextEngine.getProjectContext({ maxTokens: 3000 });
      const contextText = context.layers.map(l => l.content).join('\n\n');

      // Build system prompt
      const rolePrompt = getRoleSystemPrompt((this.config.role ?? 'implementer') as AgentRole);
      const systemPrompt = `${rolePrompt}\n\n## Project Context\n${contextText}`;

      // Planning step
      const planStep = this.createStep('plan', { description });
      task.steps.push(planStep);
      this.emit('agent:step', { task, step: planStep });

      const planResponse = await this.router.complete({
        systemPrompt,
        prompt: `Analyze this task and create a step-by-step execution plan. For each step, specify the action (read_file, write_file, run_tests, analyze) and the target.

Task: ${description}

Respond in JSON format:
{
  "plan": [
    { "action": "read_file", "target": "path/to/file", "reasoning": "why" },
    { "action": "write_file", "target": "path/to/file", "reasoning": "what to write" }
  ]
}`,
        temperature: 0.2,
        maxTokens: 2000,
      });

      this.addUsage(totalUsage, planResponse.usage);
      planStep.status = 'completed';
      planStep.output = planResponse.content;
      planStep.completedAt = new Date().toISOString();
      planStep.tokenUsage = planResponse.usage;

      // Parse plan
      const plan = this.parsePlan(planResponse.content);

      // Execute each step
      for (let i = 0; i < Math.min(plan.length, this.config.maxSteps ?? 30); i++) {
        const planItem = plan[i];
        const step = this.createStep(planItem.action, {
          target: planItem.target,
          reasoning: planItem.reasoning,
        });
        task.steps.push(step);

        // Check for human checkpoint
        const checkpointConfig = this.config.humanCheckpoint;
        if (this.needsCheckpoint(planItem.action, checkpointConfig, 'before')) {
          step.status = 'checkpoint';
          this.emit('agent:checkpoint', { task, step, when: 'before' });

          if (this.checkpointHandler) {
            const decision = await this.checkpointHandler(step, task);
            if (decision === 'reject') {
              step.status = 'skipped';
              continue;
            }
          }
        }

        // Check anomalies
        const anomaly = this.anomalyDetector.check();
        if (anomaly.detected) {
          this.emit('agent:anomaly', { task, anomaly });
          if (checkpointConfig?.onAnomalyDetected) {
            step.status = 'checkpoint';
            this.emit('agent:checkpoint', { task, step, when: 'anomaly', anomaly });
            if (this.checkpointHandler) {
              const decision = await this.checkpointHandler(step, task);
              if (decision === 'reject') {
                task.status = 'paused';
                break;
              }
            }
          }
        }

        // Execute step
        step.status = 'running';
        this.emit('agent:step', { task, step });

        try {
          const stepResponse = await this.router.complete({
            systemPrompt,
            prompt: `Execute this step:
Action: ${planItem.action}
Target: ${planItem.target}
Reasoning: ${planItem.reasoning}

Previous steps completed: ${task.steps
              .filter(s => s.status === 'completed')
              .map(s => `${s.action}: ${JSON.stringify(s.input)}`)
              .join('\n')}

Provide the output for this step. If writing code, provide the full file content.`,
            temperature: 0.2,
            maxTokens: 4000,
          });

          this.addUsage(totalUsage, stepResponse.usage);
          step.output = stepResponse.content;
          step.tokenUsage = stepResponse.usage;
          step.status = 'completed';
          step.completedAt = new Date().toISOString();

          // Quality checks on output
          if (planItem.action === 'write_file') {
            filesChanged.push(planItem.target);

            // Secret scan
            const secrets = this.secretScanner.scan(stepResponse.content, planItem.target);
            if (secrets.length > 0) {
              this.emit('quality:secret-detected', { step, secrets });
            }

            // Hallucination check
            const hallucinations = await this.hallucinationGuard.check(
              stepResponse.content,
              planItem.target,
            );
            if (hallucinations.length > 0) {
              this.emit('quality:hallucination-detected', { step, hallucinations });
            }

            // Dual-model verification
            if (this.dualVerifier) {
              const verification = await this.dualVerifier.verify(
                stepResponse.content,
                description,
                planItem.target,
              );
              this.emit('quality:dual-verification', { step, verification });
            }
          }

          // Record action for anomaly detection
          this.anomalyDetector.recordAction(
            planItem.action,
            planItem.target,
            true,
            stepResponse.usage.totalTokens,
          );

          // Record decision
          decisions.push({
            title: `${planItem.action}: ${planItem.target}`,
            timestamp: new Date().toISOString(),
            agent: this.config.role ?? 'implementer',
            task: description,
            filesAffected: [planItem.target],
            reasoning: planItem.reasoning || '',
            alternativesConsidered: [],
            contextBasis: 'project context',
          });

          // Post-step checkpoint
          if (this.needsCheckpoint(planItem.action, checkpointConfig, 'after')) {
            this.emit('agent:checkpoint', { task, step, when: 'after' });
            if (this.checkpointHandler) {
              await this.checkpointHandler(step, task);
            }
          }
        } catch (error) {
          step.status = 'failed';
          step.error = (error as Error).message;

          this.anomalyDetector.recordAction(
            planItem.action,
            planItem.target,
            false,
            0,
          );

          if (checkpointConfig?.onError) {
            this.emit('agent:checkpoint', { task, step, when: 'error', error });
            if (this.checkpointHandler) {
              const decision = await this.checkpointHandler(step, task);
              if (decision === 'reject') {
                task.status = 'failed';
                break;
              }
            }
          }
        }
      }

      task.status = task.status === 'paused' ? 'paused'
        : task.steps.some(s => s.status === 'failed') ? 'failed'
        : 'completed';
    } catch (error) {
      task.status = 'failed';
      this.emit('agent:error', { task, error });
    }

    const result: AgentResult = {
      success: task.status === 'completed',
      summary: `Task ${task.status}: ${task.steps.filter(s => s.status === 'completed').length}/${task.steps.length} steps completed.`,
      filesChanged,
      decisionLog: decisions,
      totalTokenUsage: totalUsage,
      duration: Date.now() - startTime,
    };

    task.result = result;
    task.updatedAt = new Date().toISOString();
    this.emit('agent:complete', { task, result });

    return result;
  }

  private createStep(action: string, input: Record<string, unknown>): AgentStep {
    return {
      id: randomUUID(),
      action,
      input,
      status: 'pending',
      startedAt: new Date().toISOString(),
    };
  }

  private needsCheckpoint(
    action: string,
    config: HumanCheckpointConfig | undefined,
    when: 'before' | 'after',
  ): boolean {
    if (!config) return false;
    const list = when === 'before' ? config.before : config.after;
    return list?.includes(action) ?? false;
  }

  private parsePlan(content: string): Array<{ action: string; target: string; reasoning: string }> {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.plan ?? []).map((item: any) => ({
        action: item.action ?? 'analyze',
        target: item.target ?? '',
        reasoning: item.reasoning ?? '',
      }));
    } catch {
      return [{ action: 'analyze', target: '', reasoning: 'Failed to parse plan' }];
    }
  }

  private addUsage(total: TokenUsage, add: TokenUsage): void {
    total.inputTokens += add.inputTokens;
    total.outputTokens += add.outputTokens;
    total.totalTokens += add.totalTokens;
    total.estimatedCost += add.estimatedCost;
  }
}
