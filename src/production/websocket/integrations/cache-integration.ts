/**
 * WebSocket Cache Integration
 * Integrates WebSocket real-time updates with existing cache systems
 */

import { WebSocketMessage, RealTimePosition } from '../types/messages';
import { getMemoryCache } from '../../cache/memory';
import { getRedisCache } from '../../cache/redis';
import CacheInvalidation from '../../cache/invalidation';
import pino from 'pino';

// ============================================================================
// CACHE INTEGRATION INTERFACES
// ============================================================================

export interface CacheWebSocketConfig {
  enableRealTimeUpdates: boolean;
  cacheTTL: {
    positions: number;
    prices: number;
    portfolio: number;
    analytics: number;
  };
  invalidationStrategy: 'immediate' | 'batched' | 'scheduled';
  batchSize: number;
  batchInterval: number;
}

export interface CacheUpdateEvent {
  type: 'set' | 'delete' | 'invalidate';
  key: string;
  value?: any;
  ttl?: number;
  timestamp: Date;
  source: 'websocket' | 'api' | 'job';
}

// ============================================================================
// CACHE WEBSOCKET INTEGRATION CLASS
// ============================================================================

export class CacheWebSocketIntegration {
  private memoryCache: any;
  private redisCache?: any;
  private invalidationManager: CacheInvalidation;
  private config: CacheWebSocketConfig;
  private logger: pino.Logger;
  private pendingUpdates: Map<string, CacheUpdateEvent>;
  private batchTimer: NodeJS.Timeout | null;

  constructor(
    memoryCache: any,
    redisCache: any | undefined,
    invalidationManager: CacheInvalidation,
    config: CacheWebSocketConfig,
    logger?: pino.Logger
  ) {
    this.memoryCache = memoryCache;
    this.redisCache = redisCache;
    this.invalidationManager = invalidationManager;
    this.config = config;
    this.logger = logger || pino({ name: 'cache-websocket-integration' });
    this.pendingUpdates = new Map();
    this.batchTimer = null;

    this.startBatchProcessor();
  }

  // ============================================================================
  // PUBLIC METHODS - MESSAGE PROCESSING
  // ============================================================================

  public async processWebSocketMessage(message: WebSocketMessage): Promise<void> {
    if (!this.config.enableRealTimeUpdates) return;

    try {
      switch (message.type) {
        case 'position_update':
          await this.handlePositionUpdate(message);
          break;

        case 'position_created':
          await this.handlePositionCreated(message);
          break;

        case 'position_removed':
          await this.handlePositionRemoved(message);
          break;

        case 'positions_batch_update':
          await this.handlePositionsBatchUpdate(message);
          break;

        case 'price_update':
          await this.handlePriceUpdate(message);
          break;

        case 'price_batch_update':
          await this.handlePriceBatchUpdate(message);
          break;

        case 'portfolio_update':
          await this.handlePortfolioUpdate(message);
          break;

        case 'analytics_update':
          await this.handleAnalyticsUpdate(message);
          break;

        default:
          // Handle other message types if needed
          break;
      }

    } catch (error) {
      this.logger.error({
        messageType: message.type,
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to process WebSocket message for cache');
    }
  }

  // ============================================================================
  // PRIVATE METHODS - MESSAGE HANDLERS
  // ============================================================================

  private async handlePositionUpdate(message: any): Promise<void> {
    const { position } = message.data as { position: RealTimePosition };
    
    // Update position cache
    const positionKey = this.getPositionCacheKey((position as any).walletAddress, position.id);
    await this.scheduleUpdateCache(positionKey, position, this.config.cacheTTL.positions);

    // Invalidate related caches
    await this.invalidateRelatedCaches('position', (position as any).walletAddress, position.protocol, position.chain);

    this.logger.debug({
      positionId: position.id,
      walletAddress: (position as any).walletAddress,
      protocol: position.protocol,
    }, 'Processed position update for cache');
  }

  private async handlePositionCreated(message: any): Promise<void> {
    const { position } = message.data as { position: RealTimePosition };
    
    // Add position to cache
    const positionKey = this.getPositionCacheKey((position as any).walletAddress, position.id);
    await this.scheduleUpdateCache(positionKey, position, this.config.cacheTTL.positions);

    // Update positions list cache
    const positionsListKey = this.getPositionsListCacheKey((position as any).walletAddress);
    await this.scheduleInvalidateCache(positionsListKey);

    // Invalidate portfolio cache
    await this.invalidateRelatedCaches('position_created', (position as any).walletAddress, position.protocol, position.chain);

    this.logger.debug({
      positionId: position.id,
      walletAddress: (position as any).walletAddress,
    }, 'Processed position creation for cache');
  }

  private async handlePositionRemoved(message: any): Promise<void> {
    const { positionId } = message.data as { positionId: string };
    
    // Get wallet address from position ID (would need to parse or have additional data)
    // For now, we'll invalidate more broadly
    await this.scheduleInvalidateCache(`position:*:${positionId}`);
    
    // Invalidate positions lists
    await this.scheduleInvalidateCache('positions:*');

    this.logger.debug({
      positionId,
    }, 'Processed position removal for cache');
  }

  private async handlePositionsBatchUpdate(message: any): Promise<void> {
    const { positions } = message.data as { positions: RealTimePosition[] };
    
    // Group positions by wallet address
    const positionsByWallet = positions.reduce((acc, position) => {
      if (!acc[(position as any).walletAddress]) {
        acc[(position as any).walletAddress] = [];
      }
      acc[(position as any).walletAddress].push(position);
      return acc;
    }, {} as Record<string, RealTimePosition[]>);

    // Update caches for each wallet
    for (const [walletAddress, walletPositions] of Object.entries(positionsByWallet)) {
      // Update individual positions
      for (const position of walletPositions) {
        const positionKey = this.getPositionCacheKey(walletAddress, position.id);
        await this.scheduleUpdateCache(positionKey, position, this.config.cacheTTL.positions);
      }

      // Update positions list
      const positionsListKey = this.getPositionsListCacheKey(walletAddress);
      await this.scheduleUpdateCache(positionsListKey, walletPositions, this.config.cacheTTL.positions);

      // Invalidate related caches
      await this.invalidateRelatedCaches('positions_batch', walletAddress);
    }

    this.logger.debug({
      positionCount: positions.length,
      walletCount: Object.keys(positionsByWallet).length,
    }, 'Processed positions batch update for cache');
  }

  private async handlePriceUpdate(message: any): Promise<void> {
    const { token, price, timestamp } = message.data;
    
    // Update price cache
    const priceKey = this.getPriceCacheKey(token);
    const priceData = {
      price,
      timestamp,
      lastUpdate: new Date(),
    };
    
    await this.scheduleUpdateCache(priceKey, priceData, this.config.cacheTTL.prices);

    // Invalidate related position caches that depend on this token
    await this.scheduleInvalidateCache(`positions:*:${token}:*`);

    this.logger.debug({
      token,
      price,
    }, 'Processed price update for cache');
  }

  private async handlePriceBatchUpdate(message: any): Promise<void> {
    const { prices } = message.data;
    
    for (const priceUpdate of prices) {
      const priceKey = this.getPriceCacheKey(priceUpdate.token);
      const priceData = {
        price: priceUpdate.price,
        change24h: priceUpdate.change24h,
        volume24h: priceUpdate.volume24h,
        timestamp: priceUpdate.timestamp,
        lastUpdate: new Date(),
      };
      
      await this.scheduleUpdateCache(priceKey, priceData, this.config.cacheTTL.prices);
    }

    // Invalidate broader caches
    await this.scheduleInvalidateCache('portfolio:*');

    this.logger.debug({
      priceCount: prices.length,
    }, 'Processed price batch update for cache');
  }

  private async handlePortfolioUpdate(message: any): Promise<void> {
    const { totalValue, totalPnL, totalPnLPercentage, positionCount, protocolDistribution, chainDistribution } = message.data;
    
    const portfolioData = {
      totalValue,
      totalPnL,
      totalPnLPercentage,
      positionCount,
      protocolDistribution,
      chainDistribution,
      lastUpdate: new Date(),
    };

    // Update portfolio cache
    const portfolioKey = this.getPortfolioCacheKey(message.walletAddress || 'unknown');
    await this.scheduleUpdateCache(portfolioKey, portfolioData, this.config.cacheTTL.portfolio);

    this.logger.debug({
      walletAddress: message.walletAddress,
      totalValue,
      positionCount,
    }, 'Processed portfolio update for cache');
  }

  private async handleAnalyticsUpdate(message: any): Promise<void> {
    const { metrics, trends } = message.data;
    
    const analyticsData = {
      metrics,
      trends,
      timestamp: new Date(),
    };

    // Update analytics cache
    const analyticsKey = this.getAnalyticsCacheKey(message.walletAddress || 'global');
    await this.scheduleUpdateCache(analyticsKey, analyticsData, this.config.cacheTTL.analytics);

    this.logger.debug({
      walletAddress: message.walletAddress,
    }, 'Processed analytics update for cache');
  }

  // ============================================================================
  // PRIVATE METHODS - CACHE OPERATIONS
  // ============================================================================

  private async scheduleUpdateCache(key: string, value: any, ttl: number): Promise<void> {
    const updateEvent: CacheUpdateEvent = {
      type: 'set',
      key,
      value,
      ttl,
      timestamp: new Date(),
      source: 'websocket',
    };

    if (this.config.invalidationStrategy === 'immediate') {
      await this.executeUpdateCache(updateEvent);
    } else {
      this.pendingUpdates.set(key, updateEvent);
    }
  }

  private async scheduleInvalidateCache(keyPattern: string): Promise<void> {
    const invalidateEvent: CacheUpdateEvent = {
      type: 'invalidate',
      key: keyPattern,
      timestamp: new Date(),
      source: 'websocket',
    };

    if (this.config.invalidationStrategy === 'immediate') {
      await this.executeInvalidateCache(invalidateEvent);
    } else {
      this.pendingUpdates.set(`invalidate:${keyPattern}`, invalidateEvent);
    }
  }

  private async executeUpdateCache(event: CacheUpdateEvent): Promise<void> {
    try {
      // Update memory cache
      await this.memoryCache.set(event.key, event.value, event.ttl);

      // Update Redis cache if available
      if (this.redisCache) {
        await this.redisCache.set(event.key, event.value, event.ttl);
      }

    } catch (error) {
      this.logger.error({
        key: event.key,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to update cache');
    }
  }

  private async executeInvalidateCache(event: CacheUpdateEvent): Promise<void> {
    try {
      // Use invalidation manager
      await (this.invalidationManager as any).invalidatePattern(event.key);

    } catch (error) {
      this.logger.error({
        keyPattern: event.key,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to invalidate cache');
    }
  }

  private async invalidateRelatedCaches(
    eventType: string, 
    walletAddress?: string, 
    protocol?: string, 
    chain?: string
  ): Promise<void> {
    const invalidationPatterns = [];

    // Wallet-specific invalidations
    if (walletAddress) {
      invalidationPatterns.push(
        this.getPortfolioCacheKey(walletAddress),
        this.getAnalyticsCacheKey(walletAddress),
        `positions:${walletAddress}:*`
      );
    }

    // Protocol-specific invalidations
    if (protocol) {
      invalidationPatterns.push(`protocol:${protocol}:*`);
    }

    // Chain-specific invalidations
    if (chain) {
      invalidationPatterns.push(`chain:${chain}:*`);
    }

    // Execute invalidations
    for (const pattern of invalidationPatterns) {
      await this.scheduleInvalidateCache(pattern);
    }
  }

  // ============================================================================
  // PRIVATE METHODS - BATCH PROCESSING
  // ============================================================================

  private startBatchProcessor(): void {
    if (this.config.invalidationStrategy !== 'batched') return;

    this.batchTimer = setInterval(async () => {
      await this.processPendingUpdates();
    }, this.config.batchInterval);
  }

  private async processPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) return;

    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    // Group updates by type
    const setUpdates = updates.filter(u => u.type === 'set');
    const invalidateUpdates = updates.filter(u => u.type === 'invalidate');

    // Process set updates
    for (const update of setUpdates.slice(0, this.config.batchSize)) {
      await this.executeUpdateCache(update);
    }

    // Process invalidate updates
    for (const update of invalidateUpdates) {
      await this.executeInvalidateCache(update);
    }

    this.logger.debug({
      setUpdates: setUpdates.length,
      invalidateUpdates: invalidateUpdates.length,
    }, 'Processed batch cache updates');
  }

  // ============================================================================
  // PRIVATE METHODS - CACHE KEY GENERATION
  // ============================================================================

  private getPositionCacheKey(walletAddress: string, positionId: string): string {
    return `position:${walletAddress}:${positionId}`;
  }

  private getPositionsListCacheKey(walletAddress: string): string {
    return `positions:${walletAddress}`;
  }

  private getPriceCacheKey(token: string): string {
    return `price:${token}`;
  }

  private getPortfolioCacheKey(walletAddress: string): string {
    return `portfolio:${walletAddress}`;
  }

  private getAnalyticsCacheKey(walletAddress: string): string {
    return `analytics:${walletAddress}`;
  }

  // ============================================================================
  // PUBLIC METHODS - MANAGEMENT
  // ============================================================================

  public updateConfig(config: Partial<CacheWebSocketConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart batch processor if strategy changed
    if (config.invalidationStrategy || config.batchInterval) {
      if (this.batchTimer) {
        clearInterval(this.batchTimer);
        this.batchTimer = null;
      }
      this.startBatchProcessor();
    }

    this.logger.info({
      config: this.config,
    }, 'Cache WebSocket integration config updated');
  }

  public async flushPendingUpdates(): Promise<void> {
    await this.processPendingUpdates();
  }

  public getPendingUpdatesCount(): number {
    return this.pendingUpdates.size;
  }

  public cleanup(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    this.pendingUpdates.clear();
    
    this.logger.info('Cache WebSocket integration cleaned up');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createCacheWebSocketIntegration(
  memoryCache: any,
  redisCache: any | undefined,
  invalidationManager: CacheInvalidation,
  config?: Partial<CacheWebSocketConfig>
): CacheWebSocketIntegration {
  const defaultConfig: CacheWebSocketConfig = {
    enableRealTimeUpdates: true,
    cacheTTL: {
      positions: 300, // 5 minutes
      prices: 60,     // 1 minute
      portfolio: 120, // 2 minutes
      analytics: 600, // 10 minutes
    },
    invalidationStrategy: 'batched',
    batchSize: 50,
    batchInterval: 1000, // 1 second
  };

  return new CacheWebSocketIntegration(
    memoryCache,
    redisCache,
    invalidationManager,
    { ...defaultConfig, ...config }
  );
}