/**
 * PhantomindAI — Provider Router & Factory
 * Handles provider creation, automatic fallback, and budget-aware routing.
 */

import { EventEmitter } from 'eventemitter3';
import { BaseProvider } from './base.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';
import { GroqProvider } from './groq.js';
import { MistralProvider } from './mistral.js';
import { OllamaProvider } from './ollama.js';
import { DeepSeekProvider } from './deepseek.js';
import { OpenRouterProvider } from './openrouter.js';
import type {
  ProviderName,
  ProviderConfig,
  ProviderRouting,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
} from '../types.js';

const FALLBACK_TIMEOUT_MS = 2000;

export class ProviderRouter extends EventEmitter {
  private providers: Map<string, BaseProvider> = new Map();
  private routing: ProviderRouting;
  private dailyCost = 0;
  private dailyCostDate = '';
  private maxCostPerDay: number;
  private warningThreshold: number;
  private fallbackOnBudget: string;

  constructor(
    routing: ProviderRouting,
    budgetConfig?: { maxCostPerDay?: number; warningAt?: number; fallbackOnBudget?: string },
  ) {
    super();
    this.routing = routing;
    this.maxCostPerDay = budgetConfig?.maxCostPerDay ?? 10.0;
    this.warningThreshold = budgetConfig?.warningAt ?? 80;
    this.fallbackOnBudget = budgetConfig?.fallbackOnBudget ?? 'budget';

    // Initialize providers
    this.initProvider('primary', routing.primary);
    if (routing.fallback) this.initProvider('fallback', routing.fallback);
    if (routing.budget) this.initProvider('budget', routing.budget);
    if (routing.local) this.initProvider('local', routing.local);
  }

  private initProvider(slot: string, config: ProviderConfig) {
    const provider = createProvider(config);
    this.providers.set(slot, provider);
  }

  /**
   * Complete with automatic fallback and budget awareness
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.resetDailyCostIfNeeded();

    // Check budget
    if (this.shouldUseBudgetProvider()) {
      const budgetProvider = this.providers.get(this.fallbackOnBudget);
      if (budgetProvider) {
        this.emit('provider:fallback', { reason: 'budget', provider: this.fallbackOnBudget });
        return this.executeWithTracking(budgetProvider, request);
      }
    }

    // Try primary
    const primary = this.providers.get('primary');
    if (!primary) throw new Error('No primary provider configured');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.routing.primary.timeout ?? 30000);

      const result = await this.executeWithTracking(primary, request);
      clearTimeout(timeout);
      return result;
    } catch (error) {
      this.emit('provider:fallback', { reason: 'error', error, provider: 'primary' });

      // Try fallback
      const fallback = this.providers.get('fallback');
      if (fallback) {
        try {
          return await this.executeWithTracking(fallback, request);
        } catch (fallbackError) {
          this.emit('provider:fallback', { reason: 'error', error: fallbackError, provider: 'fallback' });
        }
      }

      // Try budget
      const budget = this.providers.get('budget');
      if (budget) {
        return this.executeWithTracking(budget, request);
      }

      // Try local
      const local = this.providers.get('local');
      if (local) {
        return this.executeWithTracking(local, request);
      }

      throw error;
    }
  }

  /**
   * Stream with fallback
   */
  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const primary = this.providers.get('primary');
    if (!primary) throw new Error('No primary provider configured');

    try {
      yield* primary.stream(request);
    } catch (error) {
      const fallback = this.providers.get('fallback');
      if (fallback) {
        yield* fallback.stream(request);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name: string): BaseProvider | undefined {
    // Check slots first
    if (this.providers.has(name)) return this.providers.get(name);

    // Check by provider name
    for (const provider of this.providers.values()) {
      if (provider.providerName === name) return provider;
    }
    return undefined;
  }

  /**
   * Get a provider for a specific slot
   */
  getSlotProvider(slot: 'primary' | 'fallback' | 'budget' | 'local'): BaseProvider | undefined {
    return this.providers.get(slot);
  }

  /**
   * Get daily cost tracking
   */
  getDailyCost(): number {
    this.resetDailyCostIfNeeded();
    return this.dailyCost;
  }

  private async executeWithTracking(
    provider: BaseProvider,
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    this.emit('provider:request', { provider: provider.providerName, model: provider.getModel() });

    const result = await provider.complete(request);
    this.trackCost(result.usage);

    this.emit('provider:response', {
      provider: provider.providerName,
      model: result.model,
      usage: result.usage,
      duration: result.duration,
    });

    return result;
  }

  private trackCost(usage: TokenUsage) {
    this.resetDailyCostIfNeeded();
    this.dailyCost += usage.estimatedCost;

    const percentage = (this.dailyCost / this.maxCostPerDay) * 100;
    if (percentage >= this.warningThreshold) {
      this.emit('budget:warning', { dailyCost: this.dailyCost, maxCost: this.maxCostPerDay, percentage });
    }
    if (percentage >= 100) {
      this.emit('budget:exceeded', { dailyCost: this.dailyCost, maxCost: this.maxCostPerDay });
    }
  }

  private shouldUseBudgetProvider(): boolean {
    const percentage = (this.dailyCost / this.maxCostPerDay) * 100;
    return percentage >= this.warningThreshold && this.providers.has(this.fallbackOnBudget);
  }

  private resetDailyCostIfNeeded() {
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyCostDate !== today) {
      this.dailyCost = 0;
      this.dailyCostDate = today;
    }
  }
}

/**
 * Factory function to create a provider instance
 */
export function createProvider(config: ProviderConfig): BaseProvider {
  switch (config.name) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'groq':
      return new GroqProvider(config);
    case 'mistral':
      return new MistralProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'deepseek':
      return new DeepSeekProvider(config);
    case 'openrouter':
      return new OpenRouterProvider(config);
    default:
      throw new Error(`Unsupported provider: ${config.name}`);
  }
}
