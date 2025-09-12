import { getQueueManager, QueueStats, WorkerStats } from './processors';
import { getJobScheduler, ScheduledJob } from './scheduler';
import { getMultiLevelCache, CacheLayerStats } from '../cache/strategies';
import { getCacheInvalidationManager, InvalidationStats } from '../cache/invalidation';
import { getMemoryCache } from '../cache/memory';
import pino from 'pino';

const logger = pino({ name: 'queue-monitoring' });

export interface SystemMetrics {
  timestamp: number;
  cache: {
    memory: {
      hitRate: number;
      size: number;
      estimatedBytes: number;
      namespaces: Record<string, { entries: number; hitRate: number }>;
    };
    redis: {
      hitRate: number;
      compressionRatio: number;
      connected: boolean;
    };
    combined: {
      hitRate: number;
      totalHits: number;
      totalMisses: number;
    };
    invalidation: InvalidationStats;
  };
  queues: Record<string, QueueStats & { 
    throughput: number;
    avgProcessingTime: number;
    errorRate: number;
  }>;
  workers: Record<string, WorkerStats & {
    cpu: number;
    memory: number;
    uptime: number;
  }>;
  scheduler: {
    totalJobs: number;
    enabledJobs: number;
    runningJobs: number;
    failureRate: number;
    nextJobRun?: number;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
}

export interface AlertRule {
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  cooldown: number; // Minimum time between alerts in ms
  lastTriggered?: number;
  enabled: boolean;
}

export interface Alert {
  id: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metrics?: Partial<SystemMetrics>;
}

export interface MonitoringConfig {
  metricsInterval: number; // Interval to collect metrics (ms)
  retentionPeriod: number; // How long to keep historical data (ms)
  alertsEnabled: boolean;
  thresholds: {
    cacheHitRate: number;
    queueDepth: number;
    errorRate: number;
    processingTime: number;
    memoryUsage: number;
  };
}

class QueueMonitoring {
  private queueManager: any;
  private scheduler: any;
  private cache = getMultiLevelCache();
  private memoryCache = getMemoryCache();
  private invalidationManager = getCacheInvalidationManager();
  
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private alertRules: AlertRule[] = [];
  private metricsTimer: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.queueManager = getQueueManager();
    this.scheduler = getJobScheduler();
    this.config = config;
    
    this.setupDefaultAlertRules();
  }

  private setupDefaultAlertRules(): void {
    // Cache hit rate alerts
    this.addAlertRule({
      name: 'low-cache-hit-rate',
      condition: (metrics) => metrics.cache.combined.hitRate < this.config.thresholds.cacheHitRate,
      severity: 'medium',
      message: 'Cache hit rate has dropped below threshold',
      cooldown: 5 * 60 * 1000, // 5 minutes
      enabled: true
    });

    // Queue depth alerts
    this.addAlertRule({
      name: 'high-queue-depth',
      condition: (metrics) => {
        return Object.values(metrics.queues).some(queue => 
          (queue.waiting + queue.delayed) > this.config.thresholds.queueDepth
        );
      },
      severity: 'high',
      message: 'Queue depth exceeds threshold',
      cooldown: 2 * 60 * 1000, // 2 minutes
      enabled: true
    });

    // Error rate alerts
    this.addAlertRule({
      name: 'high-error-rate',
      condition: (metrics) => {
        return Object.values(metrics.queues).some(queue => 
          queue.errorRate > this.config.thresholds.errorRate
        );
      },
      severity: 'high',
      message: 'Job error rate exceeds threshold',
      cooldown: 3 * 60 * 1000, // 3 minutes
      enabled: true
    });

    // Processing time alerts
    this.addAlertRule({
      name: 'slow-processing',
      condition: (metrics) => {
        return Object.values(metrics.queues).some(queue => 
          queue.avgProcessingTime > this.config.thresholds.processingTime
        );
      },
      severity: 'medium',
      message: 'Average job processing time exceeds threshold',
      cooldown: 10 * 60 * 1000, // 10 minutes
      enabled: true
    });

    // Memory usage alerts
    this.addAlertRule({
      name: 'high-memory-usage',
      condition: (metrics) => {
        const memUsage = metrics.system.memoryUsage.heapUsed / metrics.system.memoryUsage.heapTotal;
        return memUsage > this.config.thresholds.memoryUsage;
      },
      severity: 'high',
      message: 'System memory usage is high',
      cooldown: 5 * 60 * 1000, // 5 minutes
      enabled: true
    });

    // Redis connection alerts
    this.addAlertRule({
      name: 'redis-disconnected',
      condition: (metrics) => !metrics.cache.redis.connected,
      severity: 'critical',
      message: 'Redis connection lost',
      cooldown: 1 * 60 * 1000, // 1 minute
      enabled: true
    });

    // Scheduler failure alerts
    this.addAlertRule({
      name: 'scheduler-failures',
      condition: (metrics) => metrics.scheduler.failureRate > 0.2, // 20% failure rate
      severity: 'high',
      message: 'Scheduled job failure rate is high',
      cooldown: 15 * 60 * 1000, // 15 minutes
      enabled: true
    });

    // Cache invalidation alerts
    this.addAlertRule({
      name: 'high-invalidation-rate',
      condition: (metrics) => {
        const rate = metrics.cache.invalidation.totalInvalidations / (Date.now() - this.startTime) * 1000; // per second
        return rate > 10; // More than 10 invalidations per second
      },
      severity: 'medium',
      message: 'Cache invalidation rate is unusually high',
      cooldown: 10 * 60 * 1000, // 10 minutes
      enabled: true
    });

    logger.info({ ruleCount: this.alertRules.length }, 'Default alert rules set up');
  }

  async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = Date.now();

    try {
      // Collect cache metrics
      const cacheStats = this.cache.getStats();
      const memoryUsage = this.memoryCache.getMemoryUsage();
      const invalidationStats = this.invalidationManager.getStats();

      const cacheMetrics = {
        memory: {
          hitRate: this.calculateMemoryHitRate(cacheStats.memory),
          size: memoryUsage.totalEntries,
          estimatedBytes: memoryUsage.estimatedSizeBytes,
          namespaces: this.buildNamespaceMetrics(cacheStats.memory)
        },
        redis: {
          hitRate: cacheStats.redis.hits / (cacheStats.redis.hits + cacheStats.redis.misses) || 0,
          compressionRatio: cacheStats.redis.compressionRatio,
          connected: true // Would check actual connection
        },
        combined: {
          hitRate: cacheStats.combined.hitRate,
          totalHits: cacheStats.combined.totalHits,
          totalMisses: cacheStats.combined.totalMisses
        },
        invalidation: invalidationStats
      };

      // Collect queue metrics
      const queueNames = this.queueManager.getQueueNames();
      const queueMetrics: Record<string, QueueStats & { 
        throughput: number;
        avgProcessingTime: number;
        errorRate: number;
      }> = {};

      for (const queueName of queueNames) {
        const stats = await this.queueManager.getQueueStats(queueName);
        const throughput = this.calculateThroughput(queueName);
        const avgProcessingTime = this.calculateAvgProcessingTime(queueName);
        const errorRate = this.calculateErrorRate(queueName, stats);

        queueMetrics[queueName] = {
          ...stats,
          throughput,
          avgProcessingTime,
          errorRate
        };
      }

      // Collect worker metrics (mock data - would collect real metrics in production)
      const workerMetrics: Record<string, WorkerStats & {
        cpu: number;
        memory: number;
        uptime: number;
      }> = {};

      for (const queueName of queueNames) {
        const workerStats = await this.queueManager.getWorkerStats(queueName);
        if (workerStats) {
          workerMetrics[queueName] = {
            ...workerStats,
            cpu: Math.random() * 100, // Mock CPU usage
            memory: Math.random() * 1000000000, // Mock memory usage
            uptime: timestamp - this.startTime
          };
        }
      }

      // Collect scheduler metrics
      const schedulerStats = this.scheduler.getJobStats();
      const schedulerHealth = await this.scheduler.getHealth();
      const nextJob = this.getNextScheduledJobTime();

      const schedulerMetrics = {
        totalJobs: schedulerStats.total,
        enabledJobs: schedulerStats.enabled,
        runningJobs: schedulerHealth.runningJobs,
        failureRate: schedulerStats.totalFailures / Math.max(schedulerStats.totalRuns, 1),
        nextJobRun: nextJob
      };

      // Collect system metrics
      const systemMetrics = {
        uptime: timestamp - this.startTime,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };

      const metrics: SystemMetrics = {
        timestamp,
        cache: cacheMetrics,
        queues: queueMetrics,
        workers: workerMetrics,
        scheduler: schedulerMetrics,
        system: systemMetrics
      };

      // Store metrics (keep only recent data based on retention period)
      this.metrics.push(metrics);
      this.cleanupOldMetrics();

      // Check for alerts if enabled
      if (this.config.alertsEnabled) {
        await this.checkAlerts(metrics);
      }

      return metrics;

    } catch (error) {
      logger.error({ error }, 'Failed to collect metrics');
      throw error;
    }
  }

  private calculateMemoryHitRate(memoryStats: any): number {
    if (!memoryStats || typeof memoryStats !== 'object') return 0;
    
    if (typeof memoryStats === 'object' && !Array.isArray(memoryStats)) {
      // Single namespace stats
      const stats = memoryStats;
      return stats.hits / (stats.hits + stats.misses) || 0;
    }
    
    // Multiple namespaces
    const allStats = Object.values(memoryStats);
    const totalHits = allStats.reduce((sum: number, s: any) => sum + (s.hits || 0), 0);
    const totalMisses = allStats.reduce((sum: number, s: any) => sum + (s.misses || 0), 0);
    
    return totalHits / (totalHits + totalMisses) || 0;
  }

  private buildNamespaceMetrics(memoryStats: any): Record<string, { entries: number; hitRate: number }> {
    const namespaceMetrics: Record<string, { entries: number; hitRate: number }> = {};
    
    if (typeof memoryStats === 'object' && !Array.isArray(memoryStats)) {
      Object.entries(memoryStats).forEach(([namespace, stats]: [string, any]) => {
        namespaceMetrics[namespace] = {
          entries: stats.size || 0,
          hitRate: stats.hits / (stats.hits + stats.misses) || 0
        };
      });
    }
    
    return namespaceMetrics;
  }

  private calculateThroughput(queueName: string): number {
    // Calculate jobs processed per minute based on recent metrics
    const recentMetrics = this.metrics.slice(-10); // Last 10 data points
    if (recentMetrics.length < 2) return 0;

    const oldMetric = recentMetrics[0];
    const newMetric = recentMetrics[recentMetrics.length - 1];
    
    const oldQueue = oldMetric.queues[queueName];
    const newQueue = newMetric.queues[queueName];
    
    if (!oldQueue || !newQueue) return 0;

    const timeDiff = (newMetric.timestamp - oldMetric.timestamp) / 1000 / 60; // minutes
    const jobsDiff = newQueue.completed - oldQueue.completed;
    
    return jobsDiff / timeDiff;
  }

  private calculateAvgProcessingTime(queueName: string): number {
    // Mock implementation - would track actual processing times
    return Math.random() * 5000; // 0-5 seconds
  }

  private calculateErrorRate(queueName: string, stats: QueueStats): number {
    const total = stats.completed + stats.failed;
    return total > 0 ? stats.failed / total : 0;
  }

  private getNextScheduledJobTime(): number | undefined {
    const jobs = this.scheduler.getAllJobs();
    const enabledJobs = jobs.filter((j: any) => j.enabled && j.nextRun);
    
    if (enabledJobs.length === 0) return undefined;
    
    const nextJob = enabledJobs.sort((a: any, b: any) => 
      (a.nextRun?.getTime() || 0) - (b.nextRun?.getTime() || 0)
    )[0];
    
    return nextJob.nextRun?.getTime();
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }

  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && (Date.now() - rule.lastTriggered) < rule.cooldown) {
        continue;
      }

      try {
        if (rule.condition(metrics)) {
          await this.triggerAlert(rule, metrics);
          rule.lastTriggered = Date.now();
        }
      } catch (error) {
        logger.error({ 
          rule: rule.name, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Alert rule evaluation failed');
      }
    }
  }

  private async triggerAlert(rule: AlertRule, metrics: SystemMetrics): Promise<void> {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      rule: rule.name,
      severity: rule.severity,
      message: rule.message,
      timestamp: Date.now(),
      resolved: false,
      metrics: this.sanitizeMetricsForAlert(metrics)
    };

    this.alerts.push(alert);
    
    logger.warn({
      id: alert.id,
      rule: rule.name,
      severity: rule.severity,
      message: rule.message
    }, 'Alert triggered');

    // Clean up old alerts
    this.cleanupOldAlerts();

    // In a real implementation, you would send notifications here
    // e.g., email, Slack, webhook, etc.
  }

  private sanitizeMetricsForAlert(metrics: SystemMetrics): Partial<SystemMetrics> {
    // Include only relevant metrics to avoid large alert payloads
    return {
      timestamp: metrics.timestamp,
      cache: {
        combined: metrics.cache.combined,
        redis: { connected: metrics.cache.redis.connected, hitRate: metrics.cache.redis.hitRate, compressionRatio: metrics.cache.redis.compressionRatio || 0 },
        memory: metrics.cache.memory,
        invalidation: metrics.cache.invalidation
      },
      scheduler: metrics.scheduler,
      system: {
        uptime: metrics.system.uptime,
        memoryUsage: metrics.system.memoryUsage
      }
    };
  }

  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  // Public API methods

  addAlertRule(rule: Omit<AlertRule, 'lastTriggered'>): void {
    this.alertRules.push({ ...rule, lastTriggered: undefined });
    logger.info({ name: rule.name, severity: rule.severity }, 'Alert rule added');
  }

  removeAlertRule(name: string): boolean {
    const initialLength = this.alertRules.length;
    this.alertRules = this.alertRules.filter(rule => rule.name !== name);
    
    const removed = this.alertRules.length !== initialLength;
    if (removed) {
      logger.info({ name }, 'Alert rule removed');
    }
    
    return removed;
  }

  enableAlertRule(name: string): boolean {
    const rule = this.alertRules.find(r => r.name === name);
    if (rule) {
      rule.enabled = true;
      logger.info({ name }, 'Alert rule enabled');
      return true;
    }
    return false;
  }

  disableAlertRule(name: string): boolean {
    const rule = this.alertRules.find(r => r.name === name);
    if (rule) {
      rule.enabled = false;
      logger.info({ name }, 'Alert rule disabled');
      return true;
    }
    return false;
  }

  getLatestMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(limit?: number): SystemMetrics[] {
    return limit ? this.metrics.slice(-limit) : [...this.metrics];
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  getAllAlerts(limit?: number): Alert[] {
    const sorted = this.alerts.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      logger.info({ id: alertId, rule: alert.rule }, 'Alert resolved');
      return true;
    }
    return false;
  }

  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  async getDashboardData(): Promise<{
    metrics: SystemMetrics;
    alerts: Alert[];
    trends: {
      cacheHitRate: { current: number; trend: number };
      queueThroughput: { current: number; trend: number };
      errorRate: { current: number; trend: number };
    };
  }> {
    const metrics = await this.collectMetrics();
    const activeAlerts = this.getActiveAlerts();
    const trends = this.calculateTrends();

    return {
      metrics,
      alerts: activeAlerts,
      trends
    };
  }

  private calculateTrends(): {
    cacheHitRate: { current: number; trend: number };
    queueThroughput: { current: number; trend: number };
    errorRate: { current: number; trend: number };
  } {
    if (this.metrics.length < 2) {
      return {
        cacheHitRate: { current: 0, trend: 0 },
        queueThroughput: { current: 0, trend: 0 },
        errorRate: { current: 0, trend: 0 }
      };
    }

    const recent = this.metrics.slice(-10); // Last 10 data points
    const current = recent[recent.length - 1];
    const previous = recent[Math.max(0, recent.length - 6)]; // 5 data points ago

    return {
      cacheHitRate: {
        current: current.cache.combined.hitRate,
        trend: current.cache.combined.hitRate - previous.cache.combined.hitRate
      },
      queueThroughput: {
        current: Object.values(current.queues).reduce((sum, q) => sum + q.throughput, 0),
        trend: Object.values(current.queues).reduce((sum, q) => sum + q.throughput, 0) -
               Object.values(previous.queues).reduce((sum, q) => sum + q.throughput, 0)
      },
      errorRate: {
        current: Object.values(current.queues).reduce((sum, q) => sum + q.errorRate, 0) / Object.keys(current.queues).length,
        trend: (Object.values(current.queues).reduce((sum, q) => sum + q.errorRate, 0) / Object.keys(current.queues).length) -
               (Object.values(previous.queues).reduce((sum, q) => sum + q.errorRate, 0) / Object.keys(previous.queues).length)
      }
    };
  }

  start(): void {
    logger.info({
      metricsInterval: this.config.metricsInterval,
      alertsEnabled: this.config.alertsEnabled,
      retentionPeriod: this.config.retentionPeriod
    }, 'Starting queue monitoring');

    // Collect initial metrics
    this.collectMetrics();

    // Set up periodic metrics collection
    this.metricsTimer = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error({ error }, 'Metrics collection failed');
      }
    }, this.config.metricsInterval);

    logger.info('Queue monitoring started');
  }

  stop(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    logger.info('Queue monitoring stopped');
  }

  async getHealth(): Promise<{
    healthy: boolean;
    metricsCollected: number;
    activeAlerts: number;
    lastMetricsTime?: number;
  }> {
    const latestMetrics = this.getLatestMetrics();
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

    return {
      healthy: criticalAlerts.length === 0 && this.metricsTimer !== null,
      metricsCollected: this.metrics.length,
      activeAlerts: activeAlerts.length,
      lastMetricsTime: latestMetrics?.timestamp
    };
  }
}

// Singleton instance
let monitoring: QueueMonitoring | null = null;

export const createQueueMonitoring = (config: MonitoringConfig): QueueMonitoring => {
  if (monitoring) {
    throw new Error('Queue monitoring already exists. Use getQueueMonitoring() instead.');
  }
  
  monitoring = new QueueMonitoring(config);
  return monitoring;
};

export const getQueueMonitoring = (): QueueMonitoring => {
  if (!monitoring) {
    throw new Error('Queue monitoring not initialized. Call createQueueMonitoring() first.');
  }
  
  return monitoring;
};

export default QueueMonitoring;