/**
 * WebSocket Queue Integration
 * Integrates WebSocket system with BullMQ job queues for real-time job status
 */

import { Job, Queue, Worker, QueueEvents } from 'bullmq';
import { WebSocketServer } from '../server/websocket';
import { 
  JobStartedMessage, 
  JobProgressMessage, 
  JobCompletedMessage, 
  JobFailedMessage,
  createMessage 
} from '../types/messages';
import { AnalyticsJob } from '../../types/production';
import pino from 'pino';

// ============================================================================
// QUEUE INTEGRATION INTERFACES
// ============================================================================

export interface QueueWebSocketConfig {
  enableJobUpdates: boolean;
  enableQueueMetrics: boolean;
  updateBroadcast: 'user' | 'wallet' | 'global';
  metricsInterval: number;
  jobTimeout: number;
}

export interface JobWithWebSocket extends Job {
  broadcastUpdate?: (message: any) => Promise<void>;
  websocketConfig?: {
    userId?: string;
    walletAddress?: string;
    connectionId?: string;
  };
}

export interface QueueMetrics {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

// ============================================================================
// QUEUE WEBSOCKET INTEGRATION CLASS
// ============================================================================

export class QueueWebSocketIntegration {
  private webSocketServer: WebSocketServer;
  private queues: Map<string, Queue>;
  private workers: Map<string, Worker>;
  private queueEvents: Map<string, QueueEvents>;
  private config: QueueWebSocketConfig;
  private logger: pino.Logger;
  private metricsInterval: NodeJS.Timeout | null;

  constructor(
    webSocketServer: WebSocketServer,
    config: QueueWebSocketConfig,
    logger?: pino.Logger
  ) {
    this.webSocketServer = webSocketServer;
    this.config = config;
    this.logger = logger || pino({ name: 'queue-websocket-integration' });
    this.queues = new Map();
    this.workers = new Map();
    this.queueEvents = new Map();
    this.metricsInterval = null;

    if (this.config.enableQueueMetrics) {
      this.startMetricsCollection();
    }
  }

  // ============================================================================
  // PUBLIC METHODS - QUEUE REGISTRATION
  // ============================================================================

  public registerQueue(queueName: string, queue: Queue): void {
    this.queues.set(queueName, queue);

    if (this.config.enableJobUpdates) {
      // Create queue events listener
      const queueEvents = new QueueEvents(queueName);
      this.queueEvents.set(queueName, queueEvents);

      this.setupQueueEventHandlers(queueName, queueEvents);
    }

    this.logger.info({
      queueName,
      enableJobUpdates: this.config.enableJobUpdates,
    }, 'Queue registered for WebSocket integration');
  }

  public registerWorker(queueName: string, worker: Worker): void {
    this.workers.set(queueName, worker);

    if (this.config.enableJobUpdates) {
      this.setupWorkerEventHandlers(queueName, worker);
    }

    this.logger.info({
      queueName,
    }, 'Worker registered for WebSocket integration');
  }

  public unregisterQueue(queueName: string): void {
    // Clean up queue events
    const queueEvents = this.queueEvents.get(queueName);
    if (queueEvents) {
      queueEvents.close();
      this.queueEvents.delete(queueName);
    }

    // Remove queue
    this.queues.delete(queueName);
    this.workers.delete(queueName);

    this.logger.info({
      queueName,
    }, 'Queue unregistered from WebSocket integration');
  }

  // ============================================================================
  // PUBLIC METHODS - JOB MANAGEMENT
  // ============================================================================

  public async addJobWithWebSocket<T = any>(
    queueName: string,
    jobName: string,
    jobData: T,
    options: {
      userId?: string;
      walletAddress?: string;
      connectionId?: string;
      priority?: number;
      delay?: number;
      attempts?: number;
    } = {}
  ): Promise<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      this.logger.error({
        queueName,
        jobName,
      }, 'Queue not found for job creation');
      return null;
    }

    try {
      // Add WebSocket configuration to job data
      const enhancedJobData = {
        ...jobData,
        websocketConfig: {
          userId: options.userId,
          walletAddress: options.walletAddress,
          connectionId: options.connectionId,
        },
      };

      // Create job with WebSocket options
      const job = await queue.add(jobName, enhancedJobData, {
        priority: options.priority || 0,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 5,      // Keep last 5 failed jobs
      }, 'Logger message');

      // Send job started message
      await this.broadcastJobStarted(job, queueName);

      this.logger.info({
        queueName,
        jobName,
        jobId: job.id,
        userId: options.userId,
        walletAddress: options.walletAddress,
      }, 'Job added with WebSocket integration');

      return job;

    } catch (error) {
      this.logger.error({
        queueName,
        jobName,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to add job with WebSocket integration');
      
      return null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - EVENT HANDLERS
  // ============================================================================

  private setupQueueEventHandlers(queueName: string, queueEvents: QueueEvents): void {
    queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      try {
        const queue = this.queues.get(queueName);
        if (!queue) return;

        const job = await queue.getJob(jobId);
        if (!job) return;

        await this.broadcastJobCompleted(job, queueName, returnvalue);

      } catch (error) {
        this.logger.error({
          queueName,
          jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Error handling job completed event');
      }
    }, 'Logger message');

    queueEvents.on('failed', async ({ jobId, failedReason }) => {
      try {
        const queue = this.queues.get(queueName);
        if (!queue) return;

        const job = await queue.getJob(jobId);
        if (!job) return;

        await this.broadcastJobFailed(job, queueName, failedReason);

      } catch (error) {
        this.logger.error({
          queueName,
          jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Error handling job failed event');
      }
    }, 'Logger message');

    queueEvents.on('progress', async ({ jobId, data }) => {
      try {
        const queue = this.queues.get(queueName);
        if (!queue) return;

        const job = await queue.getJob(jobId);
        if (!job) return;

        await this.broadcastJobProgress(job, queueName, data);

      } catch (error) {
        this.logger.error({
          queueName,
          jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Error handling job progress event');
      }
    }, 'Logger message');
  }

  private setupWorkerEventHandlers(queueName: string, worker: Worker): void {
    worker.on('active', async (job: Job) => {
      await this.broadcastJobStarted(job, queueName);
    }, 'Logger message');

    worker.on('progress', async (job: Job, progress: any) => {
      await this.broadcastJobProgress(job, queueName, progress);
    }, 'Logger message');

    worker.on('completed', async (job: Job, result: any) => {
      await this.broadcastJobCompleted(job, queueName, result);
    }, 'Logger message');

    worker.on('failed', async (job: Job, error: Error) => {
      await this.broadcastJobFailed(job, queueName, error.message);
    }, 'Logger message');
  }

  // ============================================================================
  // PRIVATE METHODS - MESSAGE BROADCASTING
  // ============================================================================

  private async broadcastJobStarted(job: Job, queueName: string): Promise<void> {
    const websocketConfig = this.extractWebSocketConfig(job);
    
    const message = createMessage<JobStartedMessage>('job_started', {
      jobId: job.id!,
      type: `${queueName}:${job.name}`,
      estimatedDuration: this.estimateJobDuration(job, queueName),
      steps: this.getJobSteps(job, queueName),
    }, {
      userId: websocketConfig?.userId,
      walletAddress: websocketConfig?.walletAddress,
    }, 'Logger message');

    await this.broadcastJobMessage(message, websocketConfig);

    this.logger.debug({
      queueName,
      jobId: job.id,
      jobName: job.name,
    }, 'Broadcast job started');
  }

  private async broadcastJobProgress(job: Job, queueName: string, progressData: any): Promise<void> {
    const websocketConfig = this.extractWebSocketConfig(job);
    
    // Parse progress data
    const progress = typeof progressData === 'number' ? progressData : 
                    typeof progressData === 'object' && progressData.progress ? progressData.progress : 0;
    
    const message = createMessage<JobProgressMessage>('job_progress', {
      jobId: job.id!,
      progress: Math.min(100, Math.max(0, progress)),
      currentStep: progressData.currentStep || progressData.step || 'Processing',
      completedSteps: progressData.completedSteps || [],
      remainingSteps: progressData.remainingSteps || [],
      estimatedTimeRemaining: progressData.estimatedTimeRemaining,
    }, {
      userId: websocketConfig?.userId,
      walletAddress: websocketConfig?.walletAddress,
    }, 'Logger message');

    await this.broadcastJobMessage(message, websocketConfig);

    this.logger.debug({
      queueName,
      jobId: job.id,
      progress,
    }, 'Broadcast job progress');
  }

  private async broadcastJobCompleted(job: Job, queueName: string, result: any): Promise<void> {
    const websocketConfig = this.extractWebSocketConfig(job);
    const duration = job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined;
    
    const message = createMessage<JobCompletedMessage>('job_completed', {
      jobId: job.id!,
      result,
      duration,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : new Date(),
    }, {
      userId: websocketConfig?.userId,
      walletAddress: websocketConfig?.walletAddress,
    }, 'Logger message');

    await this.broadcastJobMessage(message, websocketConfig);

    this.logger.debug({
      queueName,
      jobId: job.id,
      duration,
    }, 'Broadcast job completed');
  }

  private async broadcastJobFailed(job: Job, queueName: string, error: string): Promise<void> {
    const websocketConfig = this.extractWebSocketConfig(job);
    
    const message = createMessage<JobFailedMessage>('job_failed', {
      jobId: job.id!,
      error,
      code: 'job_execution_failed',
      retryable: (job.attemptsMade || 0) < (job.opts?.attempts || 3),
      failedAt: job.failedReason ? new Date() : new Date(),
    }, {
      userId: websocketConfig?.userId,
      walletAddress: websocketConfig?.walletAddress,
    }, 'Logger message');

    await this.broadcastJobMessage(message, websocketConfig);

    this.logger.debug({
      queueName,
      jobId: job.id,
      error,
      attemptsMade: job.attemptsMade,
    }, 'Broadcast job failed');
  }

  private async broadcastJobMessage(message: any, websocketConfig?: any): Promise<void> {
    if (!this.config.enableJobUpdates) return;

    try {
      switch (this.config.updateBroadcast) {
        case 'user':
          if (websocketConfig?.userId) {
            this.webSocketServer.sendToUser(websocketConfig.userId, message);
          }
          break;

        case 'wallet':
          if (websocketConfig?.walletAddress) {
            this.webSocketServer.sendToWallet(websocketConfig.walletAddress, message);
          }
          break;

        case 'global':
          this.webSocketServer.broadcast(message);
          break;

        default:
          // Try to send to specific connection first, then fallback to user/wallet
          if (websocketConfig?.connectionId) {
            const sent = this.webSocketServer.sendToConnection(websocketConfig.connectionId, message);
            if (!sent) {
              // Fallback to user or wallet
              if (websocketConfig.userId) {
                this.webSocketServer.sendToUser(websocketConfig.userId, message);
              } else if (websocketConfig.walletAddress) {
                this.webSocketServer.sendToWallet(websocketConfig.walletAddress, message);
              }
            }
          }
          break;
      }

    } catch (error) {
      this.logger.error({
        messageType: message.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to broadcast job message');
    }
  }

  // ============================================================================
  // PRIVATE METHODS - UTILITIES
  // ============================================================================

  private extractWebSocketConfig(job: Job): any {
    return (job.data as any)?.websocketConfig || {};
  }

  private estimateJobDuration(job: Job, queueName: string): number | undefined {
    // This would be based on historical data or job type
    // For now, return some defaults based on queue name
    const estimates: Record<string, number> = {
      'scan': 30000,      // 30 seconds
      'analytics': 60000, // 1 minute
      'refresh': 15000,   // 15 seconds
    };

    return estimates[queueName] || estimates[job.name] || undefined;
  }

  private getJobSteps(job: Job, queueName: string): string[] | undefined {
    // This would be based on job type and configuration
    // For now, return some defaults
    const stepsByQueue: Record<string, string[]> = {
      'scan': [
        'Validating wallet address',
        'Connecting to blockchain',
        'Scanning protocols',
        'Aggregating positions',
        'Calculating metrics',
        'Finalizing results'
      ],
      'analytics': [
        'Loading position data',
        'Calculating performance',
        'Analyzing risk metrics',
        'Generating insights',
        'Creating report'
      ],
      'refresh': [
        'Fetching latest prices',
        'Updating positions',
        'Recalculating totals'
      ],
    };

    return stepsByQueue[queueName] || stepsByQueue[job.name];
  }

  // ============================================================================
  // PRIVATE METHODS - METRICS COLLECTION
  // ============================================================================

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.collectAndBroadcastMetrics();
    }, this.config.metricsInterval);
  }

  private async collectAndBroadcastMetrics(): Promise<void> {
    try {
      const allMetrics: Record<string, QueueMetrics> = {};

      for (const [queueName, queue] of this.queues.entries()) {
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();
        const delayed = await queue.getDelayed();
        const paused = await queue.isPaused();

        allMetrics[queueName] = {
          active: active.length,
          waiting: waiting.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: paused ? 1 : 0,
        };
      }

      // Broadcast queue metrics
      const metricsMessage = createMessage('queue_metrics', {
        queues: allMetrics,
        timestamp: new Date(),
      }, 'Logger message');

      this.webSocketServer.broadcast(metricsMessage, 'analytics:global');

      this.logger.debug({
        queueCount: Object.keys(allMetrics).length,
      }, 'Queue metrics collected and broadcast');

    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to collect queue metrics');
    }
  }

  // ============================================================================
  // PUBLIC METHODS - MANAGEMENT
  // ============================================================================

  public updateConfig(config: Partial<QueueWebSocketConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart metrics collection if interval changed
    if (config.metricsInterval && this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      
      if (this.config.enableQueueMetrics) {
        this.startMetricsCollection();
      }
    }

    this.logger.info({
      config: this.config,
    }, 'Queue WebSocket integration config updated');
  }

  public async getQueueStatus(): Promise<Record<string, QueueMetrics>> {
    const status: Record<string, QueueMetrics> = {};

    for (const [queueName, queue] of this.queues.entries()) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      const delayed = await queue.getDelayed();
      const paused = await queue.isPaused();

      status[queueName] = {
        active: active.length,
        waiting: waiting.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: paused ? 1 : 0,
      };
    }

    return status;
  }

  public cleanup(): void {
    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Close queue events
    for (const [queueName, queueEvents] of this.queueEvents.entries()) {
      queueEvents.close();
    }

    this.queues.clear();
    this.workers.clear();
    this.queueEvents.clear();

    this.logger.info('Queue WebSocket integration cleaned up');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createQueueWebSocketIntegration(
  webSocketServer: WebSocketServer,
  config?: Partial<QueueWebSocketConfig>
): QueueWebSocketIntegration {
  const defaultConfig: QueueWebSocketConfig = {
    enableJobUpdates: true,
    enableQueueMetrics: true,
    updateBroadcast: 'user',
    metricsInterval: 30000, // 30 seconds
    jobTimeout: 300000,     // 5 minutes
  };

  return new QueueWebSocketIntegration(
    webSocketServer,
    { ...defaultConfig, ...config }
  );
}