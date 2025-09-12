// Production Infrastructure Index
// This file provides a unified interface to initialize and manage the entire caching and queue system

import Redis from 'ioredis';
import pino from 'pino';

// Cache system imports
import { getRedisCache } from './cache/redis';
import { getMemoryCache } from './cache/memory';
import { getMultiLevelCache, CacheStrategies } from './cache/strategies';
import { getCacheInvalidationManager } from './cache/invalidation';

// Queue system imports
import QueueManagerClass, { createQueueManager, getQueueManager, QueueConfig } from './queue/processors';
import JobSchedulerClass, { createJobScheduler, getJobScheduler, SchedulerConfig } from './queue/scheduler';
import QueueMonitoringClass, { createQueueMonitoring, getQueueMonitoring, MonitoringConfig } from './queue/monitoring';

// Type aliases for consistency
type QueueManager = typeof QueueManagerClass;
type JobScheduler = typeof JobSchedulerClass;
type QueueMonitoring = typeof QueueMonitoringClass;

// Job data types
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
} from './queue/processors';

const logger = pino({ name: 'production-infrastructure' } as any);

export interface ProductionConfig {
  redis: {
    url: string;
    keyPrefix?: string;
    maxRetriesPerRequest?: number;
    retryDelayOnFailover?: number;
  };
  cache: {
    defaultTTL?: number;
    compressionEnabled?: boolean;
    memoryMaxSize?: number;
  };
  queue: {
    concurrency?: number;
    rateLimiter?: {
      max: number;
      duration: number;
    };
  };
  scheduler: {
    timezone?: string;
    enabled?: boolean;
  };
  monitoring: {
    metricsInterval?: number;
    retentionPeriod?: number;
    alertsEnabled?: boolean;
    thresholds?: {
      cacheHitRate?: number;
      queueDepth?: number;
      errorRate?: number;
      processingTime?: number;
      memoryUsage?: number;
    };
  };
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    redis: boolean;
    memoryCache: boolean;
    queues: boolean;
    scheduler: boolean;
    monitoring: boolean;
  };
  metrics: {
    cacheHitRate: number;
    queueDepth: number;
    activeJobs: number;
    errorRate: number;
    uptime: number;
  };
  alerts: number;
}

class ProductionInfrastructure {
  private queueManager: QueueManagerClass | null = null;
  private scheduler: JobSchedulerClass | null = null;
  private monitoring: QueueMonitoringClass | null = null;
  private initialized = false;
  private startTime = Date.now();

  constructor(private config: ProductionConfig) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Production infrastructure already initialized');
      return;
    }

    logger.info('Initializing production infrastructure', {
      redis: !!this.config.redis.url,
      cache: !!this.config.cache,
      queues: !!this.config.queue,
      scheduler: this.config.scheduler?.enabled !== false,
      monitoring: this.config.monitoring?.alertsEnabled !== false
    } as any);

    try {
      // Initialize cache system
      await this.initializeCacheSystem();

      // Initialize queue system
      await this.initializeQueueSystem();

      // Initialize scheduler if enabled
      if (this.config.scheduler?.enabled !== false) {
        await this.initializeScheduler();
      }

      // Initialize monitoring
      await this.initializeMonitoring();

      // Warm up cache with essential data
      await this.warmupCache();

      this.initialized = true;

      logger.info('Production infrastructure initialized successfully', {
        uptime: Date.now() - this.startTime,
        components: {
          cache: true,
          queues: !!this.queueManager,
          scheduler: !!this.scheduler,
          monitoring: !!this.monitoring
        }
      } as any);

    } catch (error) {
      logger.error('Failed to initialize production infrastructure', { error } as any);
      await this.cleanup();
      throw error;
    }
  }

  private async initializeCacheSystem(): Promise<void> {
    logger.info('Initializing cache system');

    // Initialize Redis cache
    const redisCache = getRedisCache();

    // Initialize memory cache with configuration
    const memoryCache = getMemoryCache();

    // Initialize multi-level cache
    const multiLevelCache = getMultiLevelCache();

    // Initialize cache invalidation manager
    const invalidationManager = getCacheInvalidationManager();

    logger.info('Cache system initialized', {
      redis: redisCache.isConnected(),
      memory: true,
      multiLevel: true,
      invalidation: true
    } as any);
  }

  private async initializeQueueSystem(): Promise<void> {
    logger.info('Initializing queue system');

    const queueConfig: QueueConfig = {
      redis: {
        host: this.extractRedisHost(),
        port: this.extractRedisPort(),
        password: this.extractRedisPassword(),
        db: 0,
        maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest || 3,
        retryDelayOnFailover: this.config.redis.retryDelayOnFailover || 100,
        keyPrefix: this.config.redis.keyPrefix || 'lp-tracker:queue:'
      },
      concurrency: this.config.queue?.concurrency || 5,
      rateLimiter: this.config.queue?.rateLimiter,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    };

    this.queueManager = createQueueManager(queueConfig);
    logger.info('Queue manager created');
  }

  private async initializeScheduler(): Promise<void> {
    if (!this.queueManager) {
      throw new Error('Queue manager must be initialized before scheduler');
    }

    logger.info('Initializing job scheduler');

    const schedulerConfig: SchedulerConfig = {
      timezone: this.config.scheduler?.timezone || 'UTC',
      scheduled: this.config.scheduler?.enabled !== false
    };

    this.scheduler = createJobScheduler(this.queueManager, schedulerConfig);
    this.scheduler.start();

    logger.info('Job scheduler initialized and started');
  }

  private async initializeMonitoring(): Promise<void> {
    logger.info('Initializing monitoring system');

    const monitoringConfig: MonitoringConfig = {
      metricsInterval: this.config.monitoring?.metricsInterval || 30000, // 30 seconds
      retentionPeriod: this.config.monitoring?.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      alertsEnabled: this.config.monitoring?.alertsEnabled !== false,
      thresholds: {
        cacheHitRate: this.config.monitoring?.thresholds?.cacheHitRate || 0.8,
        queueDepth: this.config.monitoring?.thresholds?.queueDepth || 100,
        errorRate: this.config.monitoring?.thresholds?.errorRate || 0.05,
        processingTime: this.config.monitoring?.thresholds?.processingTime || 10000,
        memoryUsage: this.config.monitoring?.thresholds?.memoryUsage || 0.8
      }
    };

    this.monitoring = createQueueMonitoring(monitoringConfig);
    this.monitoring.start();

    logger.info('Monitoring system initialized and started');
  }

  private async warmupCache(): Promise<void> {
    logger.info('Starting cache warmup');

    try {
      if (!this.queueManager) {
        logger.warn('Queue manager not available for cache warmup');
        return;
      }

      // Warm up popular wallets cache
      await this.queueManager.addJob('cache-warmup', 'initial-warmup-wallets', {
        type: 'popular_wallets' as const,
        limit: 50,
        chains: ['ethereum', 'solana']
      }, 'Logger message');

      // Warm up top protocols cache
      await this.queueManager.addJob('cache-warmup', 'initial-warmup-protocols', {
        type: 'top_protocols' as const,
        limit: 20,
        chains: ['ethereum', 'solana']
      }, 'Logger message');

      logger.info('Cache warmup jobs queued');

    } catch (error) {
      logger.error('Cache warmup failed', { error } as any);
    }
  }

  private extractRedisHost(): string {
    try {
      const url = new URL(this.config.redis.url);
      return url.hostname;
    } catch {
      return 'localhost';
    }
  }

  private extractRedisPort(): number {
    try {
      const url = new URL(this.config.redis.url);
      return parseInt(url.port) || 6379;
    } catch {
      return 6379;
    }
  }

  private extractRedisPassword(): string | undefined {
    try {
      const url = new URL(this.config.redis.url);
      return url.password || undefined;
    } catch {
      return undefined;
    }
  }

  // Public API methods

  async getSystemHealth(): Promise<SystemHealth> {
    if (!this.initialized) {
      return {
        overall: 'unhealthy',
        components: {
          redis: false,
          memoryCache: false,
          queues: false,
          scheduler: false,
          monitoring: false
        },
        metrics: {
          cacheHitRate: 0,
          queueDepth: 0,
          activeJobs: 0,
          errorRate: 0,
          uptime: 0
        },
        alerts: 0
      };
    }

    try {
      // Check individual components
      const queueHealth = this.queueManager ? await this.queueManager.getHealth() : { healthy: false };
      const schedulerHealth = this.scheduler ? await this.scheduler.getHealth() : { healthy: false };
      const monitoringHealth = this.monitoring ? await this.monitoring.getHealth() : { healthy: false };
      
      const redisCache = getRedisCache();
      const multiLevelCache = getMultiLevelCache();

      // Get latest metrics
      const latestMetrics = this.monitoring?.getLatestMetrics();
      const activeAlerts = this.monitoring?.getActiveAlerts() || [];

      const components = {
        redis: redisCache.isConnected(),
        memoryCache: true, // Memory cache is always available
        queues: queueHealth.healthy,
        scheduler: schedulerHealth.healthy,
        monitoring: monitoringHealth.healthy
      };

      const metrics = {
        cacheHitRate: latestMetrics?.cache.combined.hitRate || 0,
        queueDepth: latestMetrics ? Object.values(latestMetrics.queues).reduce((sum, q) => sum + q.waiting + q.delayed, 0) : 0,
        activeJobs: latestMetrics ? Object.values(latestMetrics.queues).reduce((sum, q) => sum + q.active, 0) : 0,
        errorRate: latestMetrics ? Object.values(latestMetrics.queues).reduce((sum, q) => sum + q.errorRate, 0) / Object.keys(latestMetrics.queues).length : 0,
        uptime: Date.now() - this.startTime
      };

      // Determine overall health
      const healthyComponents = Object.values(components).filter(Boolean).length;
      const totalComponents = Object.keys(components).length;
      const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;

      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (criticalAlerts > 0 || healthyComponents < totalComponents * 0.5) {
        overall = 'unhealthy';
      } else if (healthyComponents < totalComponents * 0.8) {
        overall = 'degraded';
      } else {
        overall = 'healthy';
      }

      return {
        overall,
        components,
        metrics,
        alerts: activeAlerts.length
      };

    } catch (error) {
      logger.error('Failed to get system health', { error } as any);
      return {
        overall: 'unhealthy',
        components: {
          redis: false,
          memoryCache: false,
          queues: false,
          scheduler: false,
          monitoring: false
        },
        metrics: {
          cacheHitRate: 0,
          queueDepth: 0,
          activeJobs: 0,
          errorRate: 0,
          uptime: Date.now() - this.startTime
        },
        alerts: 0
      };
    }
  }

  getQueueManager(): QueueManagerClass | null {
    return this.queueManager;
  }

  getScheduler(): JobSchedulerClass | null {
    return this.scheduler;
  }

  getMonitoring(): QueueMonitoringClass | null {
    return this.monitoring;
  }

  getCache() {
    return {
      redis: getRedisCache(),
      memory: getMemoryCache(),
      multiLevel: getMultiLevelCache(),
      invalidation: getCacheInvalidationManager()
    };
  }

  async cleanup(): Promise<void> {
    logger.info('Starting production infrastructure cleanup');

    try {
      // Stop monitoring
      if (this.monitoring) {
        this.monitoring.stop();
        logger.debug('Monitoring stopped');
      }

      // Stop scheduler
      if (this.scheduler) {
        await this.scheduler.stop();
        logger.debug('Scheduler stopped');
      }

      // Gracefully shutdown queue manager
      if (this.queueManager) {
        await this.queueManager.gracefulShutdown();
        logger.debug('Queue manager shutdown');
      }

      // Clean up cache invalidation manager
      const invalidationManager = getCacheInvalidationManager();
      await invalidationManager.cleanup();
      logger.debug('Cache invalidation manager cleaned up');

      // Disconnect Redis
      const redisCache = getRedisCache();
      await redisCache.disconnect();
      logger.debug('Redis cache disconnected');

      this.initialized = false;
      logger.info('Production infrastructure cleanup completed');

    } catch (error) {
      logger.error('Error during cleanup', { error } as any);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Singleton instance
let infrastructure: ProductionInfrastructure | null = null;

export const createProductionInfrastructure = (config: ProductionConfig): ProductionInfrastructure => {
  if (infrastructure) {
    throw new Error('Production infrastructure already exists. Use getProductionInfrastructure() instead.');
  }
  
  infrastructure = new ProductionInfrastructure(config);
  return infrastructure;
};

export const getProductionInfrastructure = (): ProductionInfrastructure => {
  if (!infrastructure) {
    throw new Error('Production infrastructure not initialized. Call createProductionInfrastructure() first.');
  }
  
  return infrastructure;
};

// Convenience function for quick setup
export const initializeProductionInfrastructure = async (config: ProductionConfig): Promise<ProductionInfrastructure> => {
  const infra = createProductionInfrastructure(config);
  await infra.initialize();
  return infra;
};

// Export all cache strategies for easy access
export { CacheStrategies };

// Export main classes for advanced usage
export {
  ProductionInfrastructure,
  QueueManagerClass as QueueManager,
  JobSchedulerClass as JobScheduler,
  QueueMonitoringClass as QueueMonitoring
};

// Default configuration for common setups
export const DefaultProductionConfig: ProductionConfig = {
  redis: {
    url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || 'redis://localhost:6379',
    keyPrefix: 'lp-tracker:',
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100
  },
  cache: {
    defaultTTL: 3600,
    compressionEnabled: true,
    memoryMaxSize: 1000
  },
  queue: {
    concurrency: 5,
    rateLimiter: {
      max: 100,
      duration: 60000 // 1 minute
    }
  },
  scheduler: {
    timezone: 'UTC',
    enabled: true
  },
  monitoring: {
    metricsInterval: 30000, // 30 seconds
    retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
    alertsEnabled: true,
    thresholds: {
      cacheHitRate: 0.8,
      queueDepth: 100,
      errorRate: 0.05,
      processingTime: 10000,
      memoryUsage: 0.8
    }
  }
};