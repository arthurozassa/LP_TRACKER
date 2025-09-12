import { Job, JobsOptions } from 'bullmq';
import { ChainType, ProtocolType, Position, ScanResults } from '../../../types';
import { getMultiLevelCache, CacheStrategies } from '../../cache/strategies';
import { getCacheInvalidationManager } from '../../cache/invalidation';
import pino from 'pino';

const logger = pino({ name: 'refresh-jobs' });

export interface PriceRefreshJobData {
  tokens: string[];
  chains: ChainType[];
  source?: 'coingecko' | 'defillama' | 'chainlink';
  priority?: 'low' | 'normal' | 'high';
}

export interface PriceRefreshJobResult {
  success: boolean;
  pricesUpdated: number;
  duration: number;
  errors: string[];
}

export interface PositionRefreshJobData {
  walletAddress: string;
  chain: ChainType;
  positionIds?: string[];
  protocols?: ProtocolType[];
  force?: boolean;
}

export interface PositionRefreshJobResult {
  walletAddress: string;
  chain: ChainType;
  positionsRefreshed: number;
  positionsUpdated: number;
  duration: number;
  errors: string[];
}

export interface ProtocolTVLRefreshJobData {
  protocols: ProtocolType[];
  chains: ChainType[];
  source?: 'defillama' | 'coingecko';
}

export interface ProtocolTVLRefreshJobResult {
  protocolsUpdated: number;
  duration: number;
  errors: string[];
}

export interface CacheWarmupJobData {
  type: 'popular_wallets' | 'top_protocols' | 'trending_tokens';
  limit?: number;
  chains?: ChainType[];
}

export interface CacheWarmupJobResult {
  type: string;
  itemsWarmed: number;
  cacheHits: number;
  duration: number;
}

export interface StaleDataCleanupJobData {
  maxAge: number; // Max age in milliseconds
  patterns?: string[];
  dryRun?: boolean;
}

export interface StaleDataCleanupJobResult {
  itemsChecked: number;
  itemsRemoved: number;
  spaceFreed: number; // Estimated bytes freed
  duration: number;
}

class RefreshJobProcessor {
  private cache = getMultiLevelCache();
  private invalidationManager = getCacheInvalidationManager();

  // Price refresh job - updates token prices across all chains
  async processPriceRefresh(job: Job<PriceRefreshJobData>): Promise<PriceRefreshJobResult> {
    const startTime = Date.now();
    const { tokens, chains, source = 'coingecko' } = job.data;

    logger.info({
      tokenCount: tokens.length,
      chains: chains.length,
      source,
      jobId: job.id
    }, 'Processing price refresh job');

    try {
      let pricesUpdated = 0;
      const errors: string[] = [];
      const totalTasks = tokens.length * chains.length;
      let completedTasks = 0;

      await job.updateProgress(0);

      // Update prices for each token on each chain
      for (const chain of chains) {
        for (const token of tokens) {
          try {
            const price = await this.fetchTokenPrice(token, chain, source);
            
            if (price !== null) {
              const cacheKey = `price:${token}:${chain}`;
              await this.cache.set(cacheKey, {
                token,
                chain,
                price,
                timestamp: Date.now(),
                source
              }, { strategy: CacheStrategies.FAST_ACCESS });

              // Invalidate related caches
              await this.invalidationManager.invalidatePriceData(token, chain, 'price-refresh');
              
              pricesUpdated++;
            }

          } catch (error) {
            const errorMsg = `Failed to update price for ${token} on ${chain}: ${error}`;
            errors.push(errorMsg);
            logger.error({ error }, errorMsg);
          }

          completedTasks++;
          const progress = (completedTasks / totalTasks) * 100;
          await job.updateProgress(progress);
        }
      }

      const result: PriceRefreshJobResult = {
        success: errors.length === 0,
        pricesUpdated,
        duration: Date.now() - startTime,
        errors
      };

      logger.info({
        pricesUpdated,
        errors: errors.length,
        duration: result.duration,
        jobId: job.id
      }, 'Job completed');

      return result;

    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Job failed');
      throw error;
    }
  }

  // Position refresh job - updates LP position data
  async processPositionRefresh(job: Job<PositionRefreshJobData>): Promise<PositionRefreshJobResult> {
    const startTime = Date.now();
    const { walletAddress, chain, positionIds, protocols, force = false } = job.data;

    logger.info({
      walletAddress,
      chain,
      positionCount: positionIds?.length,
      protocols: protocols?.length,
      force,
      jobId: job.id
    }, 'Job completed');

    try {
      await job.updateProgress(0);

      let positionsRefreshed = 0;
      let positionsUpdated = 0;
      const errors: string[] = [];

      // Get current scan results
      const scanCacheKey = `scan:${walletAddress}:${chain}`;
      const currentScan = await this.cache.get<ScanResults>(
        scanCacheKey,
        { strategy: CacheStrategies.READ_HEAVY }
      );

      if (!currentScan) {
        throw new Error(`No scan data found for wallet ${walletAddress} on ${chain}`);
      }

      await job.updateProgress(10);

      // Determine which protocols to refresh
      const protocolsToRefresh = protocols || Object.keys(currentScan.protocols) as ProtocolType[];
      const totalProtocols = protocolsToRefresh.length;

      // Refresh each protocol
      for (let i = 0; i < protocolsToRefresh.length; i++) {
        const protocol = protocolsToRefresh[i];
        
        try {
          const refreshResult = await this.refreshProtocolPositions(
            walletAddress,
            chain,
            protocol,
            positionIds,
            force
          );

          positionsRefreshed += refreshResult.refreshed;
          positionsUpdated += refreshResult.updated;

          // Update progress
          const progress = 10 + ((i + 1) / totalProtocols) * 80;
          await job.updateProgress(progress);

        } catch (error) {
          const errorMsg = `Failed to refresh ${protocol} positions: ${error}`;
          errors.push(errorMsg);
          logger.error({ error }, errorMsg);
        }
      }

      // Update scan results cache if positions were updated
      if (positionsUpdated > 0) {
        await this.invalidationManager.invalidateWalletData(walletAddress, chain, 'position-refresh');
      }

      await job.updateProgress(100);

      const result: PositionRefreshJobResult = {
        walletAddress,
        chain,
        positionsRefreshed,
        positionsUpdated,
        duration: Date.now() - startTime,
        errors
      };

      logger.info({
        walletAddress,
        chain,
        positionsRefreshed,
        positionsUpdated,
        errors: errors.length,
        duration: result.duration,
        jobId: job.id
      }, 'Job completed');

      return result;

    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Job failed');
      throw error;
    }
  }

  // Protocol TVL refresh job - updates protocol TVL data
  async processProtocolTVLRefresh(job: Job<ProtocolTVLRefreshJobData>): Promise<ProtocolTVLRefreshJobResult> {
    const startTime = Date.now();
    const { protocols, chains, source = 'defillama' } = job.data;

    logger.info({
      protocolCount: protocols.length,
      chains: chains.length,
      source,
      jobId: job.id
    }, 'Job completed');

    try {
      let protocolsUpdated = 0;
      const errors: string[] = [];
      const totalTasks = protocols.length * chains.length;
      let completedTasks = 0;

      await job.updateProgress(0);

      // Update TVL for each protocol on each chain
      for (const chain of chains) {
        for (const protocol of protocols) {
          try {
            const tvlData = await this.fetchProtocolTVL(protocol, chain, source);
            
            if (tvlData) {
              const cacheKey = `tvl:${protocol}:${chain}`;
              await this.cache.set(cacheKey, {
                protocol,
                chain,
                tvl: tvlData.tvl,
                volume24h: tvlData.volume24h,
                fees24h: tvlData.fees24h,
                timestamp: Date.now(),
                source
              }, { strategy: CacheStrategies.PERSISTENT });

              // Invalidate related caches
              await this.invalidationManager.invalidateProtocolData(protocol, chain, 'tvl-refresh');
              
              protocolsUpdated++;
            }

          } catch (error) {
            const errorMsg = `Failed to update TVL for ${protocol} on ${chain}: ${error}`;
            errors.push(errorMsg);
            logger.error({ error }, errorMsg);
          }

          completedTasks++;
          const progress = (completedTasks / totalTasks) * 100;
          await job.updateProgress(progress);
        }
      }

      const result: ProtocolTVLRefreshJobResult = {
        protocolsUpdated,
        duration: Date.now() - startTime,
        errors
      };

      logger.info({
        protocolsUpdated,
        errors: errors.length,
        duration: result.duration,
        jobId: job.id
      }, 'Job completed');

      return result;

    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Job failed');
      throw error;
    }
  }

  // Cache warmup job - preloads popular data
  async processCacheWarmup(job: Job<CacheWarmupJobData>): Promise<CacheWarmupJobResult> {
    const startTime = Date.now();
    const { type, limit = 100, chains } = job.data;

    logger.info({
      type,
      limit,
      chains: chains?.length,
      jobId: job.id
    }, 'Job completed');

    try {
      await job.updateProgress(0);

      let itemsWarmed = 0;
      let cacheHits = 0;

      switch (type) {
        case 'popular_wallets':
          ({ itemsWarmed, cacheHits } = await this.warmupPopularWallets(limit, chains, job));
          break;
          
        case 'top_protocols':
          ({ itemsWarmed, cacheHits } = await this.warmupTopProtocols(limit, chains, job));
          break;
          
        case 'trending_tokens':
          ({ itemsWarmed, cacheHits } = await this.warmupTrendingTokens(limit, chains, job));
          break;
          
        default:
          throw new Error(`Unknown warmup type: ${type}`);
      }

      await job.updateProgress(100);

      const result: CacheWarmupJobResult = {
        type,
        itemsWarmed,
        cacheHits,
        duration: Date.now() - startTime
      };

      logger.info({
        type,
        itemsWarmed,
        cacheHits,
        duration: result.duration,
        jobId: job.id
      }, 'Job completed');

      return result;

    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Job failed');
      throw error;
    }
  }

  // Stale data cleanup job - removes expired cache entries
  async processStaleDataCleanup(job: Job<StaleDataCleanupJobData>): Promise<StaleDataCleanupJobResult> {
    const startTime = Date.now();
    const { maxAge, patterns = ['*'], dryRun = false } = job.data;

    logger.info({
      maxAge,
      patterns,
      dryRun,
      jobId: job.id
    }, 'Job completed');

    try {
      await job.updateProgress(0);

      let itemsChecked = 0;
      let itemsRemoved = 0;
      let spaceFreed = 0;
      
      const cutoffTime = Date.now() - maxAge;

      // Check each pattern
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        
        const { checked, removed, freed } = await this.cleanupStaleData(
          pattern,
          cutoffTime,
          dryRun
        );

        itemsChecked += checked;
        itemsRemoved += removed;
        spaceFreed += freed;

        const progress = ((i + 1) / patterns.length) * 100;
        await job.updateProgress(progress);
      }

      const result: StaleDataCleanupJobResult = {
        itemsChecked,
        itemsRemoved,
        spaceFreed,
        duration: Date.now() - startTime
      };

      logger.info({
        itemsChecked,
        itemsRemoved,
        spaceFreed,
        duration: result.duration,
        dryRun,
        jobId: job.id
      }, 'Job completed');

      return result;

    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Job failed');
      throw error;
    }
  }

  // Helper methods

  private async fetchTokenPrice(token: string, chain: ChainType, source: string): Promise<number | null> {
    // Mock implementation - replace with actual price fetching logic
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Simulate occasional failures
    if (Math.random() < 0.05) {
      throw new Error(`Price API error for ${token}`);
    }
    
    return Math.random() * 1000; // Mock price
  }

  private async refreshProtocolPositions(
    walletAddress: string,
    chain: ChainType,
    protocol: ProtocolType,
    positionIds?: string[],
    force: boolean = false
  ): Promise<{ refreshed: number; updated: number }> {
    
    // Get current positions
    const cacheKey = `positions:${walletAddress}:${protocol}:${chain}`;
    const currentPositions = await this.cache.get<Position[]>(
      cacheKey,
      { strategy: CacheStrategies.FAST_ACCESS }
    );

    if (!currentPositions) {
      return { refreshed: 0, updated: 0 };
    }

    let refreshed = 0;
    let updated = 0;

    // Refresh positions (mock implementation)
    for (const position of currentPositions) {
      if (positionIds && !positionIds.includes(position.id)) {
        continue; // Skip if not in specified position IDs
      }

      refreshed++;

      // Simulate position data refresh
      const refreshedPosition = await this.refreshSinglePosition(position);
      
      // Check if position data actually changed
      if (this.hasPositionChanged(position, refreshedPosition)) {
        updated++;
        
        // Update the position in the array
        const index = currentPositions.findIndex(p => p.id === position.id);
        if (index >= 0) {
          currentPositions[index] = refreshedPosition;
        }
      }
    }

    // Update cache if any positions were updated
    if (updated > 0) {
      await this.cache.set(cacheKey, currentPositions, {
        strategy: CacheStrategies.FAST_ACCESS
      }, 'Logger message');
    }

    return { refreshed, updated };
  }

  private async refreshSinglePosition(position: Position): Promise<Position> {
    // Mock implementation - replace with actual position refresh logic
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    return {
      ...position,
      value: position.value * (0.95 + Math.random() * 0.1), // Slight value change
      feesEarned: position.feesEarned + Math.random() * 10, // Small fee increase
      apr: position.apr * (0.9 + Math.random() * 0.2), // APR variation
      updatedAt: new Date().toISOString()
    };
  }

  private hasPositionChanged(oldPos: Position, newPos: Position): boolean {
    const valueThreshold = 0.01; // 1% change threshold
    const feeThreshold = 0.1; // 10 cents threshold
    const aprThreshold = 1; // 1% APR threshold

    return (
      Math.abs(oldPos.value - newPos.value) / oldPos.value > valueThreshold ||
      Math.abs(oldPos.feesEarned - newPos.feesEarned) > feeThreshold ||
      Math.abs(oldPos.apr - newPos.apr) > aprThreshold
    );
  }

  private async fetchProtocolTVL(
    protocol: ProtocolType,
    chain: ChainType,
    source: string
  ): Promise<{ tvl: number; volume24h: number; fees24h: number } | null> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    
    if (Math.random() < 0.02) {
      throw new Error(`TVL API error for ${protocol}`);
    }
    
    return {
      tvl: Math.random() * 1000000000, // Mock TVL
      volume24h: Math.random() * 100000000, // Mock volume
      fees24h: Math.random() * 1000000 // Mock fees
    };
  }

  private async warmupPopularWallets(
    limit: number,
    chains?: ChainType[],
    job?: Job
  ): Promise<{ itemsWarmed: number; cacheHits: number }> {
    // Mock popular wallets (would come from database/analytics)
    const popularWallets = Array.from({ length: limit }, (_, i) => ({
      address: `0x${'0'.repeat(40 - i.toString().length)}${i}`,
      chain: chains?.[i % (chains.length || 1)] || 'ethereum' as ChainType
    }));

    let itemsWarmed = 0;
    let cacheHits = 0;

    for (let i = 0; i < popularWallets.length; i++) {
      const { address, chain } = popularWallets[i];
      const cacheKey = `scan:${address}:${chain}`;
      
      const existing = await this.cache.get(cacheKey, { strategy: CacheStrategies.READ_HEAVY });
      
      if (existing) {
        cacheHits++;
      } else {
        // Would trigger a scan job or load from database
        itemsWarmed++;
      }

      if (job && i % 10 === 0) {
        await job.updateProgress((i / popularWallets.length) * 100);
      }
    }

    return { itemsWarmed, cacheHits };
  }

  private async warmupTopProtocols(
    limit: number,
    chains?: ChainType[],
    job?: Job
  ): Promise<{ itemsWarmed: number; cacheHits: number }> {
    const targetChains = chains || ['ethereum', 'solana'];
    let itemsWarmed = 0;
    let cacheHits = 0;

    for (const chain of targetChains) {
      const protocols = await this.getTopProtocols(chain, limit);
      
      for (let i = 0; i < protocols.length; i++) {
        const protocol = protocols[i];
        const cacheKey = `tvl:${protocol}:${chain}`;
        
        const existing = await this.cache.get(cacheKey, { strategy: CacheStrategies.PERSISTENT });
        
        if (existing) {
          cacheHits++;
        } else {
          // Would load TVL data
          itemsWarmed++;
        }

        if (job && i % 5 === 0) {
          const progress = ((i + 1) / protocols.length) * 100;
          await job.updateProgress(progress);
        }
      }
    }

    return { itemsWarmed, cacheHits };
  }

  private async warmupTrendingTokens(
    limit: number,
    chains?: ChainType[],
    job?: Job
  ): Promise<{ itemsWarmed: number; cacheHits: number }> {
    const targetChains = chains || ['ethereum', 'solana'];
    let itemsWarmed = 0;
    let cacheHits = 0;

    for (const chain of targetChains) {
      const tokens = await this.getTrendingTokens(chain, limit);
      
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const cacheKey = `price:${token}:${chain}`;
        
        const existing = await this.cache.get(cacheKey, { strategy: CacheStrategies.FAST_ACCESS });
        
        if (existing) {
          cacheHits++;
        } else {
          // Would load price data
          itemsWarmed++;
        }

        if (job && i % 10 === 0) {
          const progress = ((i + 1) / tokens.length) * 100;
          await job.updateProgress(progress);
        }
      }
    }

    return { itemsWarmed, cacheHits };
  }

  private async getTopProtocols(chain: ChainType, limit: number): Promise<ProtocolType[]> {
    // Mock implementation
    const allProtocols: Record<ChainType, ProtocolType[]> = {
      ethereum: ['uniswap-v3', 'uniswap-v2', 'sushiswap', 'curve', 'balancer'],
      solana: ['raydium-clmm', 'orca-whirlpools', 'meteora-dlmm', 'lifinity', 'jupiter'],
      arbitrum: ['uniswap-v3-arbitrum'],
      polygon: ['uniswap-v3-polygon'],
      base: ['uniswap-v3-base']
    };

    return (allProtocols[chain] || []).slice(0, limit);
  }

  private async getTrendingTokens(chain: ChainType, limit: number): Promise<string[]> {
    // Mock implementation
    return Array.from({ length: limit }, (_, i) => `TOKEN_${i}`);
  }

  private async cleanupStaleData(
    pattern: string,
    cutoffTime: number,
    dryRun: boolean
  ): Promise<{ checked: number; removed: number; freed: number }> {
    // Mock implementation - would scan cache keys and remove stale entries
    const mockResults = {
      checked: Math.floor(Math.random() * 1000) + 100,
      removed: 0,
      freed: 0
    };

    if (!dryRun) {
      mockResults.removed = Math.floor(mockResults.checked * (0.1 + Math.random() * 0.2));
      mockResults.freed = mockResults.removed * 1024; // Mock 1KB per entry
    }

    return mockResults;
  }
}

// Job options for different refresh types
export const RefreshJobOptions: Record<string, JobsOptions> = {
  PRICE_REFRESH: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    repeat: {
      every: 60000 // Every minute
    }
  },
  
  POSITION_REFRESH: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000
    }
  },
  
  PROTOCOL_TVL_REFRESH: {
    removeOnComplete: 5,
    removeOnFail: 3,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000
    },
    repeat: {
      every: 300000 // Every 5 minutes
    }
  },
  
  CACHE_WARMUP: {
    removeOnComplete: 3,
    removeOnFail: 2,
    attempts: 1,
    repeat: {
      every: 3600000 // Every hour
    }
  },
  
  STALE_DATA_CLEANUP: {
    removeOnComplete: 5,
    removeOnFail: 2,
    attempts: 1,
    repeat: {
      every: 86400000 // Every 24 hours
    }
  }
};

export default RefreshJobProcessor;