/**
 * PhantomMindAI — Task Queue & Scheduler
 * Manages task queue with priority, scheduling, and cron support.
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'eventemitter3';
import type { AgentRole, QueueTask, TokenUsage } from '../types.js';
import type { AgentExecutor } from './executor.js';

export interface QueueOptions {
  maxConcurrent?: number;
  maxQueueSize?: number;
  defaultPriority?: number;
}

export interface ScheduledTask {
  id: string;
  cronExpression: string;
  taskTemplate: {
    description: string;
    role?: AgentRole;
    priority?: QueueTask['priority'];
  };
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export class TaskQueue extends EventEmitter {
  private queue: QueueTask[] = [];
  private running = new Map<string, QueueTask>();
  private completed: QueueTask[] = [];
  private maxConcurrent: number;
  private maxQueueSize: number;
  private defaultPriority: number;
  private executor?: AgentExecutor;
  private scheduledTasks: ScheduledTask[] = [];
  private cronInterval?: ReturnType<typeof setInterval>;
  private processing = false;

  constructor(options: QueueOptions = {}) {
    super();
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.maxQueueSize = options.maxQueueSize ?? 100;
    this.defaultPriority = options.defaultPriority ?? 5;
  }

  /**
   * Set the executor for running tasks
   */
  setExecutor(executor: AgentExecutor): void {
    this.executor = executor;
  }

  /**
   * Add a task to the queue
   */
  enqueue(
    description: string,
    options: {
      role?: AgentRole;
      priority?: QueueTask['priority'];
      dependencies?: string[];
    } = {},
  ): QueueTask {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Queue is full (max ${this.maxQueueSize} tasks)`);
    }

    const task: QueueTask = {
      id: randomUUID(),
      description,
      role: options.role ?? 'implementer',
      priority: options.priority ?? 'normal',
      status: 'queued',
      dependencies: options.dependencies ?? [],
      createdAt: new Date().toISOString(),
    };

    this.queue.push(task);
    this.sortQueue();
    this.emit('task:queued', task);

    // Auto-process if not already
    if (!this.processing) {
      this.processNext();
    }

    return task;
  }

  /**
   * Process the next task in the queue
   */
  async processNext(): Promise<void> {
    if (!this.executor) return;
    if (this.running.size >= this.maxConcurrent) return;

    const task = this.getNextReady();
    if (!task) {
      this.processing = false;
      return;
    }

    this.processing = true;
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    this.running.set(task.id, task);

    // Remove from queue
    this.queue = this.queue.filter(t => t.id !== task.id);
    this.emit('task:running', task);

    try {
      const result = await this.executor.run(task.description);
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = result;
      this.emit('task:completed', { task, result });
    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
      task.error = (error as Error).message;
      this.emit('task:failed', { task, error });
    } finally {
      this.running.delete(task.id);
      this.completed.push(task);
      // Process next
      this.processNext();
    }
  }

  /**
   * Cancel a queued task
   */
  cancel(taskId: string): boolean {
    const idx = this.queue.findIndex(t => t.id === taskId);
    if (idx === -1) return false;

    const [task] = this.queue.splice(idx, 1);
    task.status = 'cancelled';
    this.emit('task:cancelled', task);
    return true;
  }

  /**
   * Get the next task that has all dependencies satisfied
   */
  private getNextReady(): QueueTask | undefined {
    return this.queue.find(task => {
      const deps = task.dependencies ?? [];
      if (deps.length === 0) return true;
      return deps.every(depId =>
        this.completed.some(c => c.id === depId && c.status === 'completed'),
      );
    });
  }

  /**
   * Sort queue by priority (lower number = higher priority)
   */
  private sortQueue(): void {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    this.queue.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
  }

  /**
   * Schedule a recurring task
   */
  schedule(
    cronExpression: string,
    description: string,
    options: { role?: AgentRole; priority?: QueueTask['priority'] } = {},
  ): ScheduledTask {
    const task: ScheduledTask = {
      id: randomUUID(),
      cronExpression,
      taskTemplate: {
        description,
        role: options.role,
        priority: options.priority,
      },
      enabled: true,
    };

    this.scheduledTasks.push(task);
    this.startCron();
    this.emit('task:scheduled', task);
    return task;
  }

  /**
   * Start the cron scheduler
   */
  private startCron(): void {
    if (this.cronInterval) return;

    this.cronInterval = setInterval(() => {
      const now = new Date();
      for (const task of this.scheduledTasks) {
        if (!task.enabled) continue;
        if (this.matchCron(task.cronExpression, now)) {
          task.lastRun = now.toISOString();
          this.enqueue(task.taskTemplate.description, {
            role: task.taskTemplate.role,
            priority: task.taskTemplate.priority,
          });
        }
      }
    }, 60_000); // Check every minute
  }

  /**
   * Simple cron matcher (supports basic patterns)
   */
  private matchCron(expression: string, date: Date): boolean {
    const parts = expression.split(' ');
    if (parts.length !== 5) return false;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = {
      minute: date.getMinutes(),
      hour: date.getHours(),
      dayOfMonth: date.getDate(),
      month: date.getMonth() + 1,
      dayOfWeek: date.getDay(),
    };

    return (
      this.matchCronField(minute, now.minute) &&
      this.matchCronField(hour, now.hour) &&
      this.matchCronField(dayOfMonth, now.dayOfMonth) &&
      this.matchCronField(month, now.month) &&
      this.matchCronField(dayOfWeek, now.dayOfWeek)
    );
  }

  private matchCronField(field: string, value: number): boolean {
    if (field === '*') return true;

    // Handle */n (every n)
    if (field.startsWith('*/')) {
      const interval = parseInt(field.slice(2), 10);
      return value % interval === 0;
    }

    // Handle comma-separated values
    if (field.includes(',')) {
      return field.split(',').some(v => parseInt(v, 10) === value);
    }

    // Handle ranges (n-m)
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(v => parseInt(v, 10));
      return value >= start && value <= end;
    }

    return parseInt(field, 10) === value;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queued: number;
    running: number;
    completed: number;
    tasks: QueueTask[];
  } {
    return {
      queued: this.queue.length,
      running: this.running.size,
      completed: this.completed.length,
      tasks: [
        ...this.queue,
        ...Array.from(this.running.values()),
        ...this.completed.slice(-20),
      ],
    };
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronInterval) {
      clearInterval(this.cronInterval);
      this.cronInterval = undefined;
    }
    this.processing = false;
  }
}
