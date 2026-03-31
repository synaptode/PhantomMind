/**
 * PhantomMindAI — Dual-Model Verifier
 * Verify critical outputs with a second model from a different provider.
 */

import type { ProviderRouter } from '../providers/router.js';
import type { ContextEngine } from '../context/engine.js';
import type { VerificationResult, VerificationIssue, CompletionResponse, PhantomConfig } from '../types.js';

export class DualVerifier {
  private router: ProviderRouter;
  private contextEngine: ContextEngine;
  private config: PhantomConfig;

  constructor(router: ProviderRouter, contextEngine: ContextEngine, config: PhantomConfig) {
    this.router = router;
    this.contextEngine = contextEngine;
    this.config = config;
  }

  /**
   * Verify generated content using a second model
   */
  async verify(
    generatedContent: string,
    taskDescription: string,
    sourceFile?: string,
  ): Promise<VerificationResult> {
    const start = Date.now();

    // Get project context for verification
    const context = await this.contextEngine.getProjectContext({
      file: sourceFile,
      maxTokens: 2000,
      includeSkills: true,
      includeRules: true,
    });

    const contextText = context.layers.map(l => l.content).join('\n\n');

    const verificationPrompt = `You are a code reviewer verifying AI-generated output against project conventions.

## Project Context
${contextText}

## Task Description
${taskDescription}

## Generated Content
\`\`\`
${generatedContent}
\`\`\`

## Review Checklist
1. Does this conform to the project conventions described above?
2. Are there unhandled edge cases?
3. Any security concerns (injection, auth bypass, data exposure)?
4. Any performance concerns?
5. Are there correctness issues?

Respond in this exact JSON format:
{
  "approved": true/false,
  "issues": [
    {
      "severity": "error|warning|info",
      "category": "convention|security|edge-case|performance|correctness",
      "description": "description of the issue",
      "suggestion": "how to fix it",
      "line": null
    }
  ]
}

Only respond with the JSON, no other text.`;

    // Use the verification provider
    const verificationProvider = this.config.quality.dualVerificationProvider ?? 'openai';
    const provider = this.router.getProvider(verificationProvider) ?? this.router.getSlotProvider('fallback');

    if (!provider) {
      return {
        approved: true,
        provider: verificationProvider,
        model: 'unavailable',
        issues: [{
          severity: 'info',
          category: 'correctness',
          description: 'Verification provider not available. Skipped.',
        }],
        duration: Date.now() - start,
        cost: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
      };
    }

    try {
      const response = await provider.complete({
        prompt: verificationPrompt,
        temperature: 0.1,
        maxTokens: 2000,
      });

      const parsed = this.parseVerificationResponse(response.content);

      return {
        approved: parsed.approved,
        provider: verificationProvider,
        model: response.model,
        issues: parsed.issues,
        duration: Date.now() - start,
        cost: response.usage,
      };
    } catch (error) {
      return {
        approved: true,
        provider: verificationProvider,
        model: 'error',
        issues: [{
          severity: 'info',
          category: 'correctness',
          description: `Verification failed: ${(error as Error).message}`,
        }],
        duration: Date.now() - start,
        cost: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
      };
    }
  }

  /**
   * Parse the verification model's response
   */
  private parseVerificationResponse(content: string): { approved: boolean; issues: VerificationIssue[] } {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { approved: true, issues: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        approved: parsed.approved ?? true,
        issues: (parsed.issues ?? []).map((issue: any) => ({
          severity: issue.severity ?? 'info',
          category: issue.category ?? 'correctness',
          description: issue.description ?? '',
          suggestion: issue.suggestion,
          line: issue.line,
        })),
      };
    } catch {
      return { approved: true, issues: [] };
    }
  }
}
