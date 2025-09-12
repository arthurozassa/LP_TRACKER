import { Worker, Queue, Job, ConnectionOptions, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';

// Import job processors
import ScanJobProcessor, { 
  WalletScanJobData, 
  ProtocolScanJobData, 
  QuickScanJobData, 
  BulkScanJobData, 
  ScanJobOptions 
} from '../jobs/scan';

import RefreshJobProcessor, { 
  PriceRefreshJobData,
  PositionRefreshJobData,
  ProtocolTVLRefreshJobData,
  CacheWarmupJobData,
  StaleDataCleanupJobData,
  RefreshJobOptions 
} from '../jobs/refresh';

import AnalyticsJobProcessor, { 
  PortfolioAnalyticsJobData,
  ProtocolAnalyticsJobData,
  YieldOptimizationJobData,
  RiskAnalysisJobData,
  HistoricalPerformanceJobData,
  AnalyticsJobOptions 
} from '../jobs/analytics';

const logger = pino({ name: 'queue-processors' });

export interface QueueConfig {
  redis: ConnectionOptions;
  defaultJobOptions?: any;
  concurrency?: number;
  rateLimiter?: {
    max: number;
    duration: number;
  };
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface WorkerStats {
  processed: number;
  failed: number;
  active: number;
  stalled: number;
}

class QueueManager {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private processors: {
    scan: ScanJobProcessor;
    refresh: RefreshJobProcessor;
    analytics: AnalyticsJobProcessor;
  };

  constructor(private config: QueueConfig) {
    this.redis = new Redis(config.redis);
    this.processors = {
      scan: new ScanJobProcessor(),
      refresh: new RefreshJobProcessor(),
      analytics: new AnalyticsJobProcessor()
    };
    
    this.setupQueuesAndWorkers();
  }

  private setupQueuesAndWorkers(): void {
    // Scan queues
    this.createQueue('wallet-scan', {
      ...ScanJobOptions.WALLET_SCAN,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3
      }
    });

    this.createQueue('protocol-scan', {
      ...ScanJobOptions.PROTOCOL_SCAN,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 30
      }
    });

    this.createQueue('quick-scan', {
      ...ScanJobOptions.QUICK_SCAN,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10
      }
    });

    this.createQueue('bulk-scan', {
      ...ScanJobOptions.BULK_SCAN,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5
      }
    });

    // Refresh queues
    this.createQueue('price-refresh', {
      ...RefreshJobOptions.PRICE_REFRESH,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5
      }
    });

    this.createQueue('position-refresh', {
      ...RefreshJobOptions.POSITION_REFRESH,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10
      }
    });

    this.createQueue('protocol-tvl-refresh', {
      ...RefreshJobOptions.PROTOCOL_TVL_REFRESH,
      defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 3
      }
    });

    this.createQueue('cache-warmup', {
      ...RefreshJobOptions.CACHE_WARMUP,
      defaultJobOptions: {
        removeOnComplete: 3,
        removeOnFail: 2
      }
    });

    this.createQueue('stale-data-cleanup', {
      ...RefreshJobOptions.STALE_DATA_CLEANUP,
      defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 2
      }
    });

    // Analytics queues
    this.createQueue('portfolio-analytics', {
      ...AnalyticsJobOptions.PORTFOLIO_ANALYTICS,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10
      }
    });

    this.createQueue('protocol-analytics', {
      ...AnalyticsJobOptions.PROTOCOL_ANALYTICS,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5
      }
    });

    this.createQueue('yield-optimization', {
      ...AnalyticsJobOptions.YIELD_OPTIMIZATION,
      defaultJobOptions: {
        removeOnComplete: 15,
        removeOnFail: 8
      }
    });

    this.createQueue('risk-analysis', {
      ...AnalyticsJobOptions.RISK_ANALYSIS,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5
      }
    });

    this.createQueue('historical-performance', {
      ...AnalyticsJobOptions.HISTORICAL_PERFORMANCE,
      defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 3
      }
    });

    logger.info('Queue manager initialized', { 
      queueCount: this.queues.size,
      workerCount: this.workers.size 
    });
  }

  private createQueue(name: string, options: any): void {
    // Create queue
    const queue = new Queue(name, {
      connection: this.config.redis,
      defaultJobOptions: {
        ...this.config.defaultJobOptions,
        ...options.defaultJobOptions
      }
    });

    // Create worker with appropriate processor
    const worker = new Worker(name, async (job: Job) => {
      return this.processJob(name, job);
    }, {
      connection: this.config.redis,
      concurrency: this.config.concurrency || 5,
      limiter: this.config.rateLimiter
    });

    // Create queue events listener
    const queueEvents = new QueueEvents(name, {
      connection: this.config.redis
    });

    // Set up event listeners
    this.setupWorkerEventListeners(worker, name);
    this.setupQueueEventListeners(queueEvents, name);

    // Store references
    this.queues.set(name, queue);
    this.workers.set(name, worker);
    this.queueEvents.set(name, queueEvents);

    logger.debug('Queue created', { name, concurrency: this.config.concurrency });
  }

  private async processJob(queueName: string, job: Job): Promise<any> {
    const startTime = Date.now();
    
    logger.info('Processing job', {
      queue: queueName,
      jobId: job.id,
      jobName: job.name,
      attempts: job.attemptsMade,
      data: this.sanitizeJobData(job.data)
    });

    try {
      let result: any;

      // Route to appropriate processor based on queue name
      switch (queueName) {
        // Scan jobs
        case 'wallet-scan':
          result = await this.processors.scan.processWalletScan(job as Job<WalletScanJobData>);
          break;
        case 'protocol-scan':
          result = await this.processors.scan.processProtocolScan(job as Job<ProtocolScanJobData>);
          break;
        case 'quick-scan':
          result = await this.processors.scan.processQuickScan(job as Job<QuickScanJobData>);
          break;
        case 'bulk-scan':
          result = await this.processors.scan.processBulkScan(job as Job<BulkScanJobData>);
          break;

        // Refresh jobs
        case 'price-refresh':
          result = await this.processors.refresh.processPriceRefresh(job as Job<PriceRefreshJobData>);
          break;
        case 'position-refresh':
          result = await this.processors.refresh.processPositionRefresh(job as Job<PositionRefreshJobData>);
          break;
        case 'protocol-tvl-refresh':
          result = await this.processors.refresh.processProtocolTVLRefresh(job as Job<ProtocolTVLRefreshJobData>);
          break;
        case 'cache-warmup':
          result = await this.processors.refresh.processCacheWarmup(job as Job<CacheWarmupJobData>);
          break;
        case 'stale-data-cleanup':
          result = await this.processors.refresh.processStaleDataCleanup(job as Job<StaleDataCleanupJobData>);
          break;

        // Analytics jobs
        case 'portfolio-analytics':
          result = await this.processors.analytics.processPortfolioAnalytics(job as Job<PortfolioAnalyticsJobData>);
          break;
        case 'protocol-analytics':
          result = await this.processors.analytics.processProtocolAnalytics(job as Job<ProtocolAnalyticsJobData>);
          break;
        case 'yield-optimization':
          result = await this.processors.analytics.processYieldOptimization(job as Job<YieldOptimizationJobData>);
          break;
        case 'risk-analysis':
          result = await this.processors.analytics.processRiskAnalysis(job as Job<RiskAnalysisJobData>);
          break;
        case 'historical-performance':
          result = await this.processors.analytics.processHistoricalPerformance(job as Job<HistoricalPerformanceJobData>);
          break;

        default:
          throw new Error(`Unknown queue: ${queueName}`);
      }

      const duration = Date.now() - startTime;
      
      logger.info('Job completed successfully', {
        queue: queueName,
        jobId: job.id,
        duration,
        resultSize: JSON.stringify(result).length
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Job failed', {
        queue: queueName,
        jobId: job.id,
        duration,
        attempts: job.attemptsMade,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      throw error;
    }
  }

  private setupWorkerEventListeners(worker: Worker, queueName: string): void {
    worker.on('completed', (job, result) => {
      logger.debug('Worker job completed', {
        queue: queueName,
        jobId: job.id,
        processingTime: job.processedOn ? Date.now() - job.processedOn : 0
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('Worker job failed', {
        queue: queueName,
        jobId: job?.id,
        error: error.message,
        attempts: job?.attemptsMade,
        maxAttempts: job?.opts.attempts
      });
    });

    worker.on('stalled', (jobId) => {
      logger.warn('Worker job stalled', {
        queue: queueName,
        jobId
      });
    });

    worker.on('error', (error) => {
      logger.error('Worker error', {
        queue: queueName,
        error: error.message
      });
    });

    worker.on('ready', () => {
      logger.info('Worker ready', { queue: queueName });
    });

    worker.on('closing', () => {
      logger.info('Worker closing', { queue: queueName });
    });
  }

  private setupQueueEventListeners(queueEvents: QueueEvents, queueName: string): void {
    queueEvents.on('waiting', ({ jobId }) => {
      logger.debug('Job waiting', { queue: queueName, jobId });
    });

    queueEvents.on('active', ({ jobId, prev }) => {
      logger.debug('Job active', { queue: queueName, jobId, prev });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug('Job progress', { queue: queueName, jobId, progress: data });
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.debug('Job completed event', { queue: queueName, jobId });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed event', { queue: queueName, jobId, reason: failedReason });
    });

    queueEvents.on('removed', ({ jobId, prev }) => {
      logger.debug('Job removed', { queue: queueName, jobId, prev });
    });
  }

  private sanitizeJobData(data: any): any {
    // Remove sensitive or large data from logs
    const sanitized = { ...data };
    
    // Remove potential sensitive fields
    if (sanitized.privateKey) delete sanitized.privateKey;
    if (sanitized.secret) delete sanitized.secret;
    if (sanitized.apiKey) delete sanitized.apiKey;
    
    // Truncate large arrays/objects for logging
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key]) && sanitized[key].length > 5) {
        sanitized[key] = `[Array of ${sanitized[key].length} items]`;
      } else if (typeof sanitized[key] === 'string' && sanitized[key].length > 100) {
        sanitized[key] = sanitized[key].substring(0, 100) + '...';
      }
    });
    
    return sanitized;
  }

  // Public API methods

  async addJob<T = any>(queueName: string, jobName: string, data: T, options?: any): Promise<Job<T>> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobName, data, options);
    
    logger.info('Job added to queue', {
      queue: queueName,
      jobName,
      jobId: job.id,
      priority: options?.priority,
      delay: options?.delay
    });

    return job;
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return queue.getJob(jobId);
  }

  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
      queue.isPaused()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused ? 1 : 0
    };
  }

  async getWorkerStats(queueName: string): Promise<WorkerStats | null> {
    const worker = this.workers.get(queueName);
    if (!worker) {
      return null;
    }

    // Get worker metrics (these would be tracked internally)
    return {
      processed: 0, // Would be tracked
      failed: 0,    // Would be tracked
      active: 0,    // Current active jobs
      stalled: 0    // Would be tracked
    };
  }

  async getAllQueueStats(): Promise<Record<string, QueueStats>> {
    const stats: Record<string, QueueStats> = {};
    
    for (const queueName of this.queues.keys()) {
      try {
        stats[queueName] = await this.getQueueStats(queueName);
      } catch (error) {
        logger.error('Failed to get queue stats', { queueName, error });
      }
    }
    
    return stats;
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info('Queue paused', { queueName });
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info('Queue resumed', { queueName });
  }

  async pauseWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (!worker) {
      throw new Error(`Worker for ${queueName} not found`);
    }

    await worker.pause();
    logger.info('Worker paused', { queueName });
  }

  async resumeWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (!worker) {
      throw new Error(`Worker for ${queueName} not found`);
    }

    worker.resume();
    logger.info('Worker resumed', { queueName });
  }

  async drainQueue(queueName: string, delayed: boolean = true): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.drain(delayed);
    logger.info('Queue drained', { queueName, delayed });
  }

  async cleanQueue(queueName: string, grace: number = 5000, status?: string): Promise<Job[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cleaned = await queue.clean(grace, -1, status as any);
    logger.info('Queue cleaned', { queueName, cleaned: cleaned.length, grace, status });
    
    return cleaned;
  }

  async getHealth(): Promise<{ healthy: boolean; queues: Record<string, boolean>; redis: boolean }> {
    const queueHealth: Record<string, boolean> = {};
    
    // Check each queue
    for (const [name, queue] of this.queues) {
      try {
        await queue.getWaiting();
        queueHealth[name] = true;
      } catch (error) {
        queueHealth[name] = false;
        logger.error('Queue health check failed', { queue: name, error });
      }
    }

    // Check Redis connection
    let redisHealthy = true;
    try {
      await this.redis.ping();
    } catch (error) {
      redisHealthy = false;
      logger.error('Redis health check failed', { error });
    }

    const allQueuesHealthy = Object.values(queueHealth).every(h => h);
    
    return {
      healthy: allQueuesHealthy && redisHealthy,
      queues: queueHealth,
      redis: redisHealthy
    };
  }

  async gracefulShutdown(): Promise<void> {
    logger.info('Starting graceful shutdown of queue manager');

    // Close all workers first
    const workerClosePromises = Array.from(this.workers.values()).map(worker => 
      worker.close()
    );

    await Promise.all(workerClosePromises);
    logger.info('All workers closed');

    // Close all queue event listeners
    const eventClosePromises = Array.from(this.queueEvents.values()).map(events => 
      events.close()
    );

    await Promise.all(eventClosePromises);
    logger.info('All queue event listeners closed');

    // Close all queues
    const queueClosePromises = Array.from(this.queues.values()).map(queue => 
      queue.close()
    );

    await Promise.all(queueClosePromises);
    logger.info('All queues closed');

    // Close Redis connection
    await this.redis.quit();
    logger.info('Redis connection closed');

    logger.info('Queue manager graceful shutdown completed');
  }

  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  isQueueRegistered(queueName: string): boolean {
    return this.queues.has(queueName);
  }
}

// Singleton instance
let queueManager: QueueManager | null = null;

export const createQueueManager = (config: QueueConfig): QueueManager => {
  if (queueManager) {
    throw new Error('Queue manager already exists. Use getQueueManager() instead.');
  }
  
  queueManager = new QueueManager(config);
  return queueManager;
};

export const getQueueManager = (): QueueManager => {
  if (!queueManager) {
    throw new Error('Queue manager not initialized. Call createQueueManager() first.');
  }
  
  return queueManager;
};

export default QueueManager;

// Export job data types for consumers
export type {
  WalletScanJobData,
  ProtocolScanJobData,
  QuickScanJobData,
  BulkScanJobData,
  PriceRefreshJobData,
  PositionRefreshJobData,
  ProtocolTVLRefreshJobData,
  CacheWarmupJobData,
  StaleDataCleanupJobData,
  PortfolioAnalyticsJobData,
  ProtocolAnalyticsJobData,
  YieldOptimizationJobData,
  RiskAnalysisJobData,
  HistoricalPerformanceJobData
};

// Export queue and worker stats types
export type { QueueStats, WorkerStats };