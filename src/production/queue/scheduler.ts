import * as cron from 'node-cron';
import { getQueueManager, QueueManager } from './processors';
import { ChainType, ProtocolType } from '../../types';
import pino from 'pino';

const logger = pino({ name: 'job-scheduler' });

export interface ScheduledJob {
  name: string;
  schedule: string;
  queue: string;
  jobName: string;
  data: any;
  options?: any;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  failCount: number;
}

export interface SchedulerConfig {
  timezone?: string;
  scheduled?: boolean;
}

class JobScheduler {
  private queueManager: QueueManager;
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private config: SchedulerConfig;

  constructor(queueManager: QueueManager, config: SchedulerConfig = {}) {
    this.queueManager = queueManager;
    this.config = {
      timezone: 'UTC',
      scheduled: true,
      ...config
    };

    this.setupDefaultScheduledJobs();
  }

  private setupDefaultScheduledJobs(): void {
    // Price refresh - every minute
    this.addScheduledJob({
      name: 'price-refresh-frequent',
      schedule: '* * * * *', // Every minute
      queue: 'price-refresh',
      jobName: 'frequent-price-update',
      data: {
        tokens: ['ETH', 'BTC', 'SOL', 'USDC', 'USDT'],
        chains: ['ethereum', 'solana'] as ChainType[],
        source: 'coingecko',
        priority: 'high'
      },
      enabled: true,
      runCount: 0,
      failCount: 0
    });

    // Protocol TVL refresh - every 5 minutes
    this.addScheduledJob({
      name: 'protocol-tvl-refresh',
      schedule: '*/5 * * * *', // Every 5 minutes
      queue: 'protocol-tvl-refresh',
      jobName: 'tvl-update',
      data: {
        protocols: [
          'uniswap-v3', 'uniswap-v2', 'sushiswap', 'curve', 'balancer',
          'raydium-clmm', 'orca-whirlpools', 'meteora-dlmm'
        ] as ProtocolType[],
        chains: ['ethereum', 'solana', 'arbitrum', 'polygon', 'base'] as ChainType[],
        source: 'defillama'
      },
      enabled: true,
      runCount: 0,
      failCount: 0
    });

    // Protocol analytics - every 30 minutes
    this.addScheduledJob({
      name: 'protocol-analytics',
      schedule: '*/30 * * * *', // Every 30 minutes
      queue: 'protocol-analytics',
      jobName: 'protocol-metrics-update',
      data: {
        protocols: [
          'uniswap-v3', 'uniswap-v2', 'sushiswap', 'curve',
          'raydium-clmm', 'orca-whirlpools'
        ] as ProtocolType[],
        chains: ['ethereum', 'solana'] as ChainType[],
        metrics: ['tvl', 'volume', 'fees', 'users', 'apy'],
        timeframe: '24h' as const
      },
      enabled: true,
      runCount: 0,
      failCount: 0
    });

    // Cache warmup - every hour
    this.addScheduledJob({
      name: 'cache-warmup-popular',
      schedule: '0 * * * *', // Every hour
      queue: 'cache-warmup',
      jobName: 'warmup-popular-data',
      data: {
        type: 'popular_wallets' as const,
        limit: 100,
        chains: ['ethereum', 'solana'] as ChainType[]
      },
      enabled: true,
      runCount: 0,
      failCount: 0
    });

    this.addScheduledJob({
      name: 'cache-warmup-protocols',
      schedule: '15 */2 * * *', // Every 2 hours at 15 minutes
      queue: 'cache-warmup',
      jobName: 'warmup-protocol-data',
      data: {
        type: 'top_protocols' as const,
        limit: 50,
        chains: ['ethereum', 'solana'] as ChainType[]
      },
      enabled: true,
      runCount: 0,
      failCount: 0
    });

    this.addScheduledJob({
      name: 'cache-warmup-tokens',
      schedule: '30 */3 * * *', // Every 3 hours at 30 minutes
      queue: 'cache-warmup',
      jobName: 'warmup-token-data',
      data: {
        type: 'trending_tokens' as const,
        limit: 200,
        chains: ['ethereum', 'solana'] as ChainType[]
      },
      enabled: true,
      runCount: 0,
      failCount: 0
    });

    // Stale data cleanup - daily at 3 AM
    this.addScheduledJob({
      name: 'stale-data-cleanup-daily',
      schedule: '0 3 * * *', // Daily at 3 AM
      queue: 'stale-data-cleanup',
      jobName: 'daily-cleanup',
      data: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        patterns: ['scan:*', 'positions:*', 'prices:*'],
        dryRun: false
      },
      enabled: true,
      runCount: 0,
      failCount: 0
    });

    // Deep cleanup - weekly on Sunday at 2 AM
    this.addScheduledJob({
      name: 'stale-data-cleanup-weekly',
      schedule: '0 2 * * 0', // Sunday at 2 AM
      queue: 'stale-data-cleanup',
      jobName: 'weekly-cleanup',
      data: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        patterns: ['analytics:*', 'history:*', 'optimization:*'],
        dryRun: false
      },
      enabled: true,
      runCount: 0,
      failCount: 0
    });

    // Position refresh for active wallets - every 15 minutes
    this.addScheduledJob({
      name: 'active-positions-refresh',
      schedule: '*/15 * * * *', // Every 15 minutes
      queue: 'position-refresh',
      jobName: 'refresh-active-positions',
      data: this.getActiveWalletsRefreshData(),
      enabled: true,
      runCount: 0,
      failCount: 0,
      options: {
        removeOnComplete: 5,
        removeOnFail: 3
      }
    });

    // Market hours price updates - more frequent during active trading
    this.addScheduledJob({
      name: 'market-hours-price-boost',
      schedule: '*/30 * * * * *', // Every 30 seconds
      queue: 'price-refresh',
      jobName: 'market-hours-boost',
      data: {
        tokens: ['ETH', 'BTC', 'SOL'],
        chains: ['ethereum', 'solana'] as ChainType[],
        source: 'coingecko',
        priority: 'critical'
      },
      enabled: false, // Will be enabled during market hours
      runCount: 0,
      failCount: 0
    });

    // Weekend maintenance - less frequent updates
    this.addScheduledJob({
      name: 'weekend-maintenance',
      schedule: '0 */6 * * 6,0', // Every 6 hours on weekends
      queue: 'stale-data-cleanup',
      jobName: 'weekend-maintenance',
      data: {
        maxAge: 6 * 60 * 60 * 1000, // 6 hours
        patterns: ['temp:*', 'cache:*'],
        dryRun: false
      },
      enabled: true,
      runCount: 0,
      failCount: 0
    });

    logger.info('Default scheduled jobs set up', { 
      jobCount: this.scheduledJobs.size 
    });
  }

  addScheduledJob(jobConfig: Omit<ScheduledJob, 'lastRun' | 'nextRun'>): void {
    const job: ScheduledJob = {
      ...jobConfig,
      nextRun: this.getNextRunDate(jobConfig.schedule)
    };

    this.scheduledJobs.set(job.name, job);

    if (job.enabled && this.config.scheduled) {
      this.scheduleJob(job);
    }

    logger.info('Scheduled job added', {
      name: job.name,
      schedule: job.schedule,
      queue: job.queue,
      enabled: job.enabled,
      nextRun: job.nextRun
    });
  }

  private scheduleJob(job: ScheduledJob): void {
    const task = cron.schedule(job.schedule, async () => {
      await this.executeScheduledJob(job);
    }, {
      scheduled: true,
      timezone: this.config.timezone
    });

    this.cronJobs.set(job.name, task);
    
    logger.debug('Cron job scheduled', {
      name: job.name,
      schedule: job.schedule,
      timezone: this.config.timezone
    });
  }

  private async executeScheduledJob(job: ScheduledJob): Promise<void> {
    const startTime = Date.now();

    logger.info('Executing scheduled job', {
      name: job.name,
      queue: job.queue,
      jobName: job.jobName,
      runCount: job.runCount + 1
    });

    try {
      // Dynamic data generation for some jobs
      let jobData = job.data;
      if (job.name === 'active-positions-refresh') {
        jobData = this.getActiveWalletsRefreshData();
      } else if (job.name === 'market-hours-price-boost') {
        jobData = this.getMarketHoursPriceData();
      }

      // Add the job to the queue
      await this.queueManager.addJob(
        job.queue,
        job.jobName,
        jobData,
        {
          priority: this.getJobPriority(job),
          ...job.options
        }
      );

      // Update job statistics
      job.runCount++;
      job.lastRun = new Date();
      job.nextRun = this.getNextRunDate(job.schedule);

      const duration = Date.now() - startTime;

      logger.info('Scheduled job executed successfully', {
        name: job.name,
        duration,
        runCount: job.runCount,
        nextRun: job.nextRun
      });

    } catch (error) {
      job.failCount++;
      const duration = Date.now() - startTime;

      logger.error('Scheduled job execution failed', {
        name: job.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        runCount: job.runCount,
        failCount: job.failCount
      });

      // Disable job if it fails too many times
      if (job.failCount >= 5) {
        await this.disableJob(job.name);
        logger.warn('Scheduled job disabled due to repeated failures', {
          name: job.name,
          failCount: job.failCount
        });
      }
    }
  }

  private getActiveWalletsRefreshData(): any {
    // This would typically query a database for active wallets
    // For now, return mock data
    return {
      // Mock active wallet addresses (would come from analytics/usage data)
      walletAddresses: [
        '0x742d35Cc6634C0532925a3b8D6Cd2f59E3Ce0Bd2',
        '0x8Ba1f109551bD432803012645Hac136c',
        '0x40B38765696e527776e527E2eF4ab5c1234aBf5F'
      ],
      chain: 'ethereum' as ChainType,
      force: false
    };
  }

  private getMarketHoursPriceData(): any {
    const now = new Date();
    const hour = now.getUTCHours();
    
    // Enhanced price updates during market hours (8 AM - 8 PM UTC)
    if (hour >= 8 && hour <= 20) {
      return {
        tokens: ['ETH', 'BTC', 'SOL', 'MATIC', 'ARB'],
        chains: ['ethereum', 'solana', 'polygon', 'arbitrum'] as ChainType[],
        source: 'coingecko',
        priority: 'critical'
      };
    }

    return {
      tokens: ['ETH', 'BTC', 'SOL'],
      chains: ['ethereum', 'solana'] as ChainType[],
      source: 'coingecko',
      priority: 'high'
    };
  }

  private getJobPriority(job: ScheduledJob): number {
    // Assign priority based on job type and time
    const priorityMap: Record<string, number> = {
      'price-refresh-frequent': 10,
      'market-hours-price-boost': 15,
      'protocol-tvl-refresh': 8,
      'protocol-analytics': 6,
      'cache-warmup-popular': 5,
      'cache-warmup-protocols': 4,
      'cache-warmup-tokens': 4,
      'active-positions-refresh': 7,
      'stale-data-cleanup-daily': 2,
      'stale-data-cleanup-weekly': 1,
      'weekend-maintenance': 1
    };

    return priorityMap[job.name] || 5;
  }

  private getNextRunDate(schedule: string): Date {
    try {
      const task = cron.schedule(schedule, () => {}, { scheduled: false });
      // This is a simplified approach - in reality you'd calculate the next run properly
      return new Date(Date.now() + 60000); // Mock: 1 minute from now
    } catch (error) {
      logger.error('Failed to calculate next run date', { schedule, error });
      return new Date(Date.now() + 60000);
    }
  }

  async enableJob(name: string): Promise<boolean> {
    const job = this.scheduledJobs.get(name);
    if (!job) {
      logger.warn('Attempted to enable non-existent job', { name });
      return false;
    }

    if (job.enabled) {
      return true;
    }

    job.enabled = true;
    
    if (this.config.scheduled) {
      this.scheduleJob(job);
    }

    logger.info('Scheduled job enabled', { name });
    return true;
  }

  async disableJob(name: string): Promise<boolean> {
    const job = this.scheduledJobs.get(name);
    if (!job) {
      logger.warn('Attempted to disable non-existent job', { name });
      return false;
    }

    if (!job.enabled) {
      return true;
    }

    job.enabled = false;

    const cronJob = this.cronJobs.get(name);
    if (cronJob) {
      cronJob.destroy();
      this.cronJobs.delete(name);
    }

    logger.info('Scheduled job disabled', { name });
    return true;
  }

  async removeJob(name: string): Promise<boolean> {
    await this.disableJob(name);
    
    const removed = this.scheduledJobs.delete(name);
    if (removed) {
      logger.info('Scheduled job removed', { name });
    }

    return removed;
  }

  async updateJobSchedule(name: string, newSchedule: string): Promise<boolean> {
    const job = this.scheduledJobs.get(name);
    if (!job) {
      return false;
    }

    const wasEnabled = job.enabled;
    
    // Disable the job temporarily
    if (wasEnabled) {
      await this.disableJob(name);
    }

    // Update schedule
    job.schedule = newSchedule;
    job.nextRun = this.getNextRunDate(newSchedule);

    // Re-enable if it was enabled
    if (wasEnabled) {
      await this.enableJob(name);
    }

    logger.info('Job schedule updated', { name, newSchedule, nextRun: job.nextRun });
    return true;
  }

  async updateJobData(name: string, newData: any): Promise<boolean> {
    const job = this.scheduledJobs.get(name);
    if (!job) {
      return false;
    }

    job.data = newData;
    logger.info('Job data updated', { name });
    return true;
  }

  getJob(name: string): ScheduledJob | undefined {
    return this.scheduledJobs.get(name);
  }

  getAllJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values());
  }

  getEnabledJobs(): ScheduledJob[] {
    return this.getAllJobs().filter(job => job.enabled);
  }

  getJobsByQueue(queueName: string): ScheduledJob[] {
    return this.getAllJobs().filter(job => job.queue === queueName);
  }

  getJobStats(): {
    total: number;
    enabled: number;
    disabled: number;
    totalRuns: number;
    totalFailures: number;
  } {
    const jobs = this.getAllJobs();
    
    return {
      total: jobs.length,
      enabled: jobs.filter(j => j.enabled).length,
      disabled: jobs.filter(j => !j.enabled).length,
      totalRuns: jobs.reduce((sum, j) => sum + j.runCount, 0),
      totalFailures: jobs.reduce((sum, j) => sum + j.failCount, 0)
    };
  }

  // Market hours management
  async enableMarketHoursMode(): Promise<void> {
    await this.enableJob('market-hours-price-boost');
    
    // Increase frequency of some jobs during market hours
    await this.updateJobSchedule('price-refresh-frequent', '*/30 * * * * *'); // Every 30 seconds
    
    logger.info('Market hours mode enabled');
  }

  async disableMarketHoursMode(): Promise<void> {
    await this.disableJob('market-hours-price-boost');
    
    // Restore normal frequency
    await this.updateJobSchedule('price-refresh-frequent', '* * * * *'); // Every minute
    
    logger.info('Market hours mode disabled');
  }

  // Weekend mode management
  async enableWeekendMode(): Promise<void> {
    // Reduce frequency of some jobs during weekends
    await this.updateJobSchedule('protocol-tvl-refresh', '*/15 * * * *'); // Every 15 minutes instead of 5
    await this.updateJobSchedule('protocol-analytics', '0 * * * *'); // Every hour instead of 30 minutes
    
    logger.info('Weekend mode enabled');
  }

  async disableWeekendMode(): Promise<void> {
    // Restore normal frequency
    await this.updateJobSchedule('protocol-tvl-refresh', '*/5 * * * *'); // Every 5 minutes
    await this.updateJobSchedule('protocol-analytics', '*/30 * * * *'); // Every 30 minutes
    
    logger.info('Weekend mode disabled');
  }

  // Automatic mode detection
  private startAutomaticModeDetection(): void {
    // Check every hour for mode changes
    setInterval(() => {
      const now = new Date();
      const hour = now.getUTCHours();
      const day = now.getUTCDay();
      
      // Enable market hours mode during trading hours (8 AM - 8 PM UTC)
      const isMarketHours = hour >= 8 && hour <= 20;
      const isWeekend = day === 0 || day === 6;
      
      const marketHoursJob = this.getJob('market-hours-price-boost');
      
      if (isMarketHours && !isWeekend && marketHoursJob && !marketHoursJob.enabled) {
        this.enableMarketHoursMode();
      } else if ((!isMarketHours || isWeekend) && marketHoursJob && marketHoursJob.enabled) {
        this.disableMarketHoursMode();
      }
      
      // Weekend mode detection would go here as well
      
    }, 60 * 60 * 1000); // Check every hour
  }

  start(): void {
    if (!this.config.scheduled) {
      logger.info('Scheduler started in manual mode - jobs will not run automatically');
      return;
    }

    logger.info('Starting job scheduler', { 
      jobCount: this.scheduledJobs.size,
      enabledJobs: this.getEnabledJobs().length,
      timezone: this.config.timezone
    });

    // Start automatic mode detection
    this.startAutomaticModeDetection();

    logger.info('Job scheduler started successfully');
  }

  async stop(): Promise<void> {
    logger.info('Stopping job scheduler');

    // Stop all cron jobs
    for (const [name, cronJob] of this.cronJobs) {
      cronJob.destroy();
      logger.debug('Cron job stopped', { name });
    }

    this.cronJobs.clear();
    logger.info('Job scheduler stopped');
  }

  async getHealth(): Promise<{
    healthy: boolean;
    scheduledJobs: number;
    runningJobs: number;
    failedJobs: number;
    lastFailure?: Date;
  }> {
    const jobs = this.getAllJobs();
    const failedJobs = jobs.filter(j => j.failCount > 0);
    
    let lastFailure: Date | undefined;
    if (failedJobs.length > 0) {
      // Find the most recent failure
      const recentFailures = failedJobs
        .filter(j => j.lastRun)
        .sort((a, b) => (b.lastRun!.getTime() - a.lastRun!.getTime()));
      
      if (recentFailures.length > 0) {
        lastFailure = recentFailures[0].lastRun;
      }
    }

    return {
      healthy: this.cronJobs.size > 0 && failedJobs.length < jobs.length * 0.2, // Less than 20% failed
      scheduledJobs: this.cronJobs.size,
      runningJobs: jobs.filter(j => j.enabled).length,
      failedJobs: failedJobs.length,
      lastFailure
    };
  }
}

// Singleton instance
let scheduler: JobScheduler | null = null;

export const createJobScheduler = (queueManager: QueueManager, config?: SchedulerConfig): JobScheduler => {
  if (scheduler) {
    throw new Error('Job scheduler already exists. Use getJobScheduler() instead.');
  }
  
  scheduler = new JobScheduler(queueManager, config);
  return scheduler;
};

export const getJobScheduler = (): JobScheduler => {
  if (!scheduler) {
    throw new Error('Job scheduler not initialized. Call createJobScheduler() first.');
  }
  
  return scheduler;
};

export default JobScheduler;