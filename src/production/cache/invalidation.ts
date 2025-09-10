import { getMultiLevelCache, CacheStrategy } from './strategies';
import { ChainType, ProtocolType } from '../../types';
import pino from 'pino';

const logger = pino({ name: 'cache-invalidation' });

export interface InvalidationEvent {
  type: InvalidationType;
  scope: InvalidationScope;
  data: any;
  timestamp: number;
  source: string;
}

export type InvalidationType = 
  | 'block_update'           // New block on chain
  | 'position_change'        // LP position modified
  | 'price_update'          // Token price changed
  | 'protocol_update'       // Protocol data updated
  | 'wallet_activity'       // Wallet transaction
  | 'manual'                // Manual invalidation
  | 'time_based'            // Time-based expiration
  | 'dependency_change';    // Dependent data changed

export interface InvalidationScope {
  chain?: ChainType;
  protocol?: ProtocolType;
  wallet?: string;
  position?: string;
  token?: string;
  global?: boolean;
}

export interface InvalidationRule {
  type: InvalidationType;
  matcher: (event: InvalidationEvent) => boolean;
  keys: (event: InvalidationEvent) => string[];
  strategy?: CacheStrategy;
  delay?: number; // Delay before invalidation (ms)
  batch?: boolean; // Batch multiple invalidations
}

export interface InvalidationStats {
  totalInvalidations: number;
  invalidationsByType: Record<InvalidationType, number>;
  averageInvalidationTime: number;
  lastInvalidation: number;
  queuedInvalidations: number;
}

class CacheInvalidationManager {
  private cache = getMultiLevelCache();
  private rules: InvalidationRule[] = [];
  private eventQueue: InvalidationEvent[] = [];
  private processing = false;
  private stats: InvalidationStats = {
    totalInvalidations: 0,
    invalidationsByType: {} as Record<InvalidationType, number>,
    averageInvalidationTime: 0,
    lastInvalidation: 0,
    queuedInvalidations: 0
  };
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchDelay = 1000; // 1 second batch delay

  constructor() {
    this.setupDefaultRules();
    this.startProcessing();
  }

  private setupDefaultRules(): void {
    // Block update invalidation
    this.addRule({
      type: 'block_update',
      matcher: (event) => event.type === 'block_update',
      keys: (event) => [
        `positions:${event.scope.chain}:*`,
        `protocols:${event.scope.chain}:*`,
        `analytics:${event.scope.chain}:*`
      ],
      batch: true
    });

    // Position change invalidation
    this.addRule({
      type: 'position_change',
      matcher: (event) => event.type === 'position_change',
      keys: (event) => {
        const keys = [];
        if (event.scope.wallet) {
          keys.push(`scan:${event.scope.wallet}`);
          keys.push(`positions:${event.scope.wallet}:*`);
          keys.push(`analytics:${event.scope.wallet}:*`);
        }
        if (event.scope.position) {
          keys.push(`position:${event.scope.position}`);
        }
        return keys;
      }
    });

    // Price update invalidation
    this.addRule({
      type: 'price_update',
      matcher: (event) => event.type === 'price_update',
      keys: (event) => {
        const keys = [];
        if (event.scope.token) {
          keys.push(`prices:${event.scope.token}`);
          keys.push(`positions:*:${event.scope.token}:*`);
        }
        return keys;
      },
      delay: 2000, // Delay price updates to avoid thrashing
      batch: true
    });

    // Protocol update invalidation
    this.addRule({
      type: 'protocol_update',
      matcher: (event) => event.type === 'protocol_update',
      keys: (event) => {
        const keys = [];
        if (event.scope.protocol) {
          keys.push(`protocol:${event.scope.protocol}:*`);
          keys.push(`positions:*:${event.scope.protocol}:*`);
        }
        return keys;
      }
    });

    // Wallet activity invalidation
    this.addRule({
      type: 'wallet_activity',
      matcher: (event) => event.type === 'wallet_activity',
      keys: (event) => {
        const keys = [];
        if (event.scope.wallet) {
          keys.push(`scan:${event.scope.wallet}`);
          keys.push(`positions:${event.scope.wallet}:*`);
          keys.push(`analytics:${event.scope.wallet}:*`);
          keys.push(`history:${event.scope.wallet}:*`);
        }
        return keys;
      }
    });

    // Global invalidation
    this.addRule({
      type: 'manual',
      matcher: (event) => event.type === 'manual' && event.scope.global,
      keys: () => ['*'], // Invalidate everything
      delay: 0
    });

    logger.info('Default invalidation rules set up', { ruleCount: this.rules.length });
  }

  addRule(rule: InvalidationRule): void {
    this.rules.push(rule);
    logger.debug('Invalidation rule added', { type: rule.type, hasMatcher: !!rule.matcher });
  }

  removeRule(type: InvalidationType, matcher?: (event: InvalidationEvent) => boolean): boolean {
    const initialLength = this.rules.length;
    
    if (matcher) {
      this.rules = this.rules.filter(rule => !(rule.type === type && rule.matcher === matcher));
    } else {
      this.rules = this.rules.filter(rule => rule.type !== type);
    }

    const removed = initialLength - this.rules.length;
    logger.debug('Invalidation rules removed', { type, removed });
    return removed > 0;
  }

  async invalidate(event: InvalidationEvent): Promise<void> {
    logger.debug('Invalidation event received', { 
      type: event.type, 
      scope: event.scope, 
      source: event.source 
    });

    this.eventQueue.push(event);
    this.stats.queuedInvalidations = this.eventQueue.length;

    // Start processing if not already running
    if (!this.processing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const batchedEvents = new Map<string, InvalidationEvent[]>();
      const immediateEvents: InvalidationEvent[] = [];

      // Separate batched and immediate events
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        const matchingRules = this.rules.filter(rule => rule.matcher(event));

        if (matchingRules.some(rule => rule.batch)) {
          const batchKey = `${event.type}:${event.scope.chain || 'global'}`;
          if (!batchedEvents.has(batchKey)) {
            batchedEvents.set(batchKey, []);
          }
          batchedEvents.get(batchKey)!.push(event);
        } else {
          immediateEvents.push(event);
        }
      }

      // Process immediate events
      for (const event of immediateEvents) {
        await this.processEvent(event);
      }

      // Process batched events
      for (const [batchKey, events] of batchedEvents) {
        await this.processBatchedEvents(events);
      }

      this.stats.queuedInvalidations = 0;
    } catch (error) {
      logger.error('Error processing invalidation queue', { error });
    } finally {
      this.processing = false;
      
      // Check if more events were added while processing
      if (this.eventQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  private async processEvent(event: InvalidationEvent): Promise<void> {
    const startTime = Date.now();
    const matchingRules = this.rules.filter(rule => rule.matcher(event));

    if (matchingRules.length === 0) {
      logger.debug('No matching rules for invalidation event', { type: event.type });
      return;
    }

    const allKeys = new Set<string>();
    const strategiesUsed = new Set<CacheStrategy>();

    // Collect all keys and strategies from matching rules
    for (const rule of matchingRules) {
      const keys = rule.keys(event);
      keys.forEach(key => allKeys.add(key));
      
      if (rule.strategy) {
        strategiesUsed.add(rule.strategy);
      }
    }

    // Apply delay if specified
    const maxDelay = Math.max(...matchingRules.map(rule => rule.delay || 0));
    if (maxDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, maxDelay));
    }

    // Invalidate keys
    await this.invalidateKeys(Array.from(allKeys), Array.from(strategiesUsed));

    // Update stats
    this.updateStats(event, Date.now() - startTime);

    logger.debug('Invalidation event processed', {
      type: event.type,
      keysInvalidated: allKeys.size,
      processingTime: Date.now() - startTime
    });
  }

  private async processBatchedEvents(events: InvalidationEvent[]): Promise<void> {
    if (events.length === 0) return;

    const startTime = Date.now();
    const allKeys = new Set<string>();
    const strategiesUsed = new Set<CacheStrategy>();

    // Collect keys from all events in batch
    for (const event of events) {
      const matchingRules = this.rules.filter(rule => rule.matcher(event));
      
      for (const rule of matchingRules) {
        const keys = rule.keys(event);
        keys.forEach(key => allKeys.add(key));
        
        if (rule.strategy) {
          strategiesUsed.add(rule.strategy);
        }
      }
    }

    // Invalidate all collected keys
    await this.invalidateKeys(Array.from(allKeys), Array.from(strategiesUsed));

    // Update stats for all events
    const processingTime = Date.now() - startTime;
    for (const event of events) {
      this.updateStats(event, processingTime / events.length);
    }

    logger.info('Batched invalidation processed', {
      eventCount: events.length,
      keysInvalidated: allKeys.size,
      processingTime
    });
  }

  private async invalidateKeys(keys: string[], strategies: CacheStrategy[]): Promise<void> {
    if (keys.length === 0) return;

    const promises: Promise<boolean>[] = [];

    // Use provided strategies or default
    const cacheStrategies = strategies.length > 0 ? strategies : [
      { 
        memory: { namespace: 'default' }, 
        redis: { namespace: 'lp-tracker' } 
      }
    ];

    for (const strategy of cacheStrategies) {
      for (const key of keys) {
        // Handle wildcard patterns
        if (key.includes('*')) {
          promises.push(this.invalidatePattern(key, strategy));
        } else {
          promises.push(this.cache.delete(key, { strategy }));
        }
      }
    }

    const results = await Promise.allSettled(promises);
    const failures = results.filter(result => result.status === 'rejected' || !result.value).length;
    
    if (failures > 0) {
      logger.warn('Some cache invalidations failed', { 
        total: promises.length, 
        failures,
        keys: keys.slice(0, 10) // Log first 10 keys for debugging
      });
    }
  }

  private async invalidatePattern(pattern: string, strategy: CacheStrategy): Promise<boolean> {
    try {
      await this.cache.clear(pattern, { strategy });
      return true;
    } catch (error) {
      logger.error('Pattern invalidation failed', { pattern, error });
      return false;
    }
  }

  private updateStats(event: InvalidationEvent, processingTime: number): void {
    this.stats.totalInvalidations++;
    this.stats.invalidationsByType[event.type] = (this.stats.invalidationsByType[event.type] || 0) + 1;
    
    // Update average processing time
    const totalTime = this.stats.averageInvalidationTime * (this.stats.totalInvalidations - 1) + processingTime;
    this.stats.averageInvalidationTime = totalTime / this.stats.totalInvalidations;
    
    this.stats.lastInvalidation = Date.now();
  }

  private startProcessing(): void {
    // Process queue every 100ms if there are events
    setInterval(async () => {
      if (this.eventQueue.length > 0 && !this.processing) {
        await this.processQueue();
      }
    }, 100);
  }

  // Chain-specific invalidation helpers
  async invalidateChainData(chain: ChainType, source: string = 'system'): Promise<void> {
    await this.invalidate({
      type: 'block_update',
      scope: { chain },
      data: { chain },
      timestamp: Date.now(),
      source
    });
  }

  async invalidateWalletData(wallet: string, chain?: ChainType, source: string = 'system'): Promise<void> {
    await this.invalidate({
      type: 'wallet_activity',
      scope: { wallet, chain },
      data: { wallet, chain },
      timestamp: Date.now(),
      source
    });
  }

  async invalidatePositionData(positionId: string, wallet?: string, source: string = 'system'): Promise<void> {
    await this.invalidate({
      type: 'position_change',
      scope: { position: positionId, wallet },
      data: { positionId, wallet },
      timestamp: Date.now(),
      source
    });
  }

  async invalidateProtocolData(protocol: ProtocolType, chain?: ChainType, source: string = 'system'): Promise<void> {
    await this.invalidate({
      type: 'protocol_update',
      scope: { protocol, chain },
      data: { protocol, chain },
      timestamp: Date.now(),
      source
    });
  }

  async invalidatePriceData(token: string, chain?: ChainType, source: string = 'system'): Promise<void> {
    await this.invalidate({
      type: 'price_update',
      scope: { token, chain },
      data: { token, chain },
      timestamp: Date.now(),
      source
    });
  }

  async invalidateAll(source: string = 'manual'): Promise<void> {
    await this.invalidate({
      type: 'manual',
      scope: { global: true },
      data: {},
      timestamp: Date.now(),
      source
    });
  }

  // Time-based invalidation
  scheduleInvalidation(event: InvalidationEvent, delay: number): void {
    setTimeout(async () => {
      await this.invalidate({
        ...event,
        type: 'time_based',
        timestamp: Date.now()
      });
    }, delay);

    logger.debug('Scheduled invalidation', { 
      type: event.type, 
      delay,
      executeAt: new Date(Date.now() + delay).toISOString()
    });
  }

  // Dependency tracking
  private dependencies = new Map<string, Set<string>>();

  addDependency(key: string, dependsOn: string): void {
    if (!this.dependencies.has(dependsOn)) {
      this.dependencies.set(dependsOn, new Set());
    }
    this.dependencies.get(dependsOn)!.add(key);
    
    logger.debug('Cache dependency added', { key, dependsOn });
  }

  removeDependency(key: string, dependsOn: string): void {
    const deps = this.dependencies.get(dependsOn);
    if (deps) {
      deps.delete(key);
      if (deps.size === 0) {
        this.dependencies.delete(dependsOn);
      }
    }
  }

  private async invalidateDependencies(changedKey: string): Promise<void> {
    const dependentKeys = this.dependencies.get(changedKey);
    if (!dependentKeys || dependentKeys.size === 0) {
      return;
    }

    const event: InvalidationEvent = {
      type: 'dependency_change',
      scope: {},
      data: { changedKey, dependentKeys: Array.from(dependentKeys) },
      timestamp: Date.now(),
      source: 'dependency-tracker'
    };

    await this.invalidate(event);
  }

  getStats(): InvalidationStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalInvalidations: 0,
      invalidationsByType: {} as Record<InvalidationType, number>,
      averageInvalidationTime: 0,
      lastInvalidation: 0,
      queuedInvalidations: this.eventQueue.length
    };
  }

  // Health check
  isHealthy(): boolean {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // Check if we're not overwhelmed by events
    const isQueueHealthy = this.eventQueue.length < 1000;
    
    // Check if processing is working (no events stuck for too long)
    const isProcessingHealthy = this.stats.queuedInvalidations === 0 || 
      (this.stats.lastInvalidation > fiveMinutesAgo);

    return isQueueHealthy && isProcessingHealthy;
  }

  async cleanup(): Promise<void> {
    this.processing = false;
    this.eventQueue.length = 0;
    this.dependencies.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    logger.info('Cache invalidation manager cleaned up');
  }
}

// Singleton instance
let invalidationManager: CacheInvalidationManager | null = null;

export const getCacheInvalidationManager = (): CacheInvalidationManager => {
  if (!invalidationManager) {
    invalidationManager = new CacheInvalidationManager();
  }
  return invalidationManager;
};

export default CacheInvalidationManager;