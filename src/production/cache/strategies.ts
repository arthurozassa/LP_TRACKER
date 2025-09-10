import { getMemoryCache, MemoryCacheOptions, MemoryCacheStats } from './memory';
import { getRedisCache, CacheOptions as RedisCacheOptions, CacheStats as RedisCacheStats } from './redis';
import pino from 'pino';

const logger = pino({ name: 'cache-strategies' });

export interface CacheStrategy {
  memory?: MemoryCacheOptions;
  redis?: RedisCacheOptions;
  writeThrough?: boolean;
  writeBack?: boolean;
  refreshAhead?: boolean;
}

export interface MultiLevelCacheOptions {
  strategy: CacheStrategy;
  refreshThreshold?: number; // Percentage of TTL when refresh should trigger
  fallbackToDb?: boolean;
}

export interface CacheLayerStats {
  memory: MemoryCacheStats | null;
  redis: RedisCacheStats;
  combined: {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    memoryHitRate: number;
    redisHitRate: number;
  };
}

export type CacheLoader<T> = () => Promise<T>;
export type CacheValidator<T> = (value: T) => boolean;

class MultiLevelCache {
  private memoryCache = getMemoryCache();
  private redisCache = getRedisCache();
  private refreshTimeouts = new Map<string, NodeJS.Timeout>();

  async get<T>(
    key: string, 
    options: MultiLevelCacheOptions, 
    loader?: CacheLoader<T>,
    validator?: CacheValidator<T>
  ): Promise<T | null> {
    const { strategy } = options;
    
    // Level 1: Check memory cache first
    if (strategy.memory) {
      const memoryResult = this.memoryCache.get<T>(key, strategy.memory);
      if (memoryResult !== null) {
        // Validate if validator is provided
        if (!validator || validator(memoryResult)) {
          logger.debug('Cache hit: memory', { key });
          
          // Check if refresh-ahead is needed
          if (strategy.refreshAhead && loader) {
            await this.checkRefreshAhead(key, options, loader);
          }
          
          return memoryResult;
        } else {
          // Invalid data, remove from memory cache
          this.memoryCache.delete(key, strategy.memory);
        }
      }
    }

    // Level 2: Check Redis cache
    if (strategy.redis) {
      const redisResult = await this.redisCache.get<T>(key, strategy.redis);
      if (redisResult !== null) {
        // Validate if validator is provided
        if (!validator || validator(redisResult)) {
          logger.debug('Cache hit: redis', { key });
          
          // Write to memory cache if enabled
          if (strategy.memory) {
            this.memoryCache.set(key, redisResult, strategy.memory);
          }
          
          // Check if refresh-ahead is needed
          if (strategy.refreshAhead && loader) {
            await this.checkRefreshAhead(key, options, loader);
          }
          
          return redisResult;
        } else {
          // Invalid data, remove from Redis
          await this.redisCache.del(key, strategy.redis);
        }
      }
    }

    // Level 3: Load from source if loader provided
    if (loader) {
      logger.debug('Cache miss: loading from source', { key });
      
      try {
        const freshData = await loader();
        
        // Validate loaded data
        if (!validator || validator(freshData)) {
          await this.set(key, freshData, options);
          return freshData;
        } else {
          logger.warn('Loaded data failed validation', { key });
          return null;
        }
      } catch (error) {
        logger.error('Failed to load data from source', { key, error });
        
        // Fallback to database if enabled (this would be implemented by the caller)
        if (options.fallbackToDb) {
          logger.info('Attempting database fallback', { key });
        }
        
        return null;
      }
    }

    return null;
  }

  async set<T>(key: string, value: T, options: MultiLevelCacheOptions): Promise<boolean> {
    const { strategy } = options;
    let success = true;

    try {
      // Write-through strategy: write to all cache layers immediately
      if (strategy.writeThrough || !strategy.writeBack) {
        const promises: Promise<boolean>[] = [];

        // Set in memory cache
        if (strategy.memory) {
          const memoryPromise = Promise.resolve(this.memoryCache.set(key, value, strategy.memory));
          promises.push(memoryPromise);
        }

        // Set in Redis cache
        if (strategy.redis) {
          const redisPromise = this.redisCache.set(key, value, strategy.redis);
          promises.push(redisPromise);
        }

        const results = await Promise.allSettled(promises);
        success = results.every(result => result.status === 'fulfilled' && result.value);
        
        if (!success) {
          logger.warn('Some cache layers failed during write-through', { key });
        }
      }
      // Write-back strategy: write to memory immediately, Redis asynchronously
      else if (strategy.writeBack) {
        // Immediate write to memory
        if (strategy.memory) {
          success = this.memoryCache.set(key, value, strategy.memory);
        }

        // Async write to Redis
        if (strategy.redis && success) {
          setImmediate(async () => {
            try {
              await this.redisCache.set(key, value, strategy.redis!);
              logger.debug('Write-back to Redis completed', { key });
            } catch (error) {
              logger.error('Write-back to Redis failed', { key, error });
            }
          });
        }
      }

      logger.debug('Cache set completed', { key, strategy: strategy.writeThrough ? 'write-through' : 'write-back' });
      return success;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  async delete(key: string, options: MultiLevelCacheOptions): Promise<boolean> {
    const { strategy } = options;
    let success = true;

    const promises: Promise<boolean>[] = [];

    // Delete from memory cache
    if (strategy.memory) {
      const memoryPromise = Promise.resolve(this.memoryCache.delete(key, strategy.memory));
      promises.push(memoryPromise);
    }

    // Delete from Redis cache
    if (strategy.redis) {
      const redisPromise = this.redisCache.del(key, strategy.redis);
      promises.push(redisPromise);
    }

    // Cancel any pending refresh timeouts
    const timeoutId = this.refreshTimeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.refreshTimeouts.delete(key);
    }

    const results = await Promise.allSettled(promises);
    success = results.every(result => result.status === 'fulfilled' && result.value);

    logger.debug('Cache delete completed', { key, success });
    return success;
  }

  async exists(key: string, options: MultiLevelCacheOptions): Promise<boolean> {
    const { strategy } = options;

    // Check memory first
    if (strategy.memory && this.memoryCache.has(key, strategy.memory)) {
      return true;
    }

    // Check Redis
    if (strategy.redis) {
      return await this.redisCache.exists(key, strategy.redis);
    }

    return false;
  }

  async mget<T>(keys: string[], options: MultiLevelCacheOptions): Promise<(T | null)[]> {
    const { strategy } = options;
    const results: (T | null)[] = new Array(keys.length).fill(null);
    const missedKeys: { index: number; key: string }[] = [];

    // Level 1: Check memory cache
    if (strategy.memory) {
      keys.forEach((key, index) => {
        const memoryResult = this.memoryCache.get<T>(key, strategy.memory!);
        if (memoryResult !== null) {
          results[index] = memoryResult;
        } else {
          missedKeys.push({ index, key });
        }
      });
    } else {
      // If no memory cache, all keys are misses
      keys.forEach((key, index) => {
        missedKeys.push({ index, key });
      });
    }

    // Level 2: Check Redis for missed keys
    if (strategy.redis && missedKeys.length > 0) {
      const redisKeys = missedKeys.map(item => item.key);
      const redisResults = await this.redisCache.mget<T>(redisKeys, strategy.redis);
      
      const remainingMisses: { index: number; key: string }[] = [];

      redisResults.forEach((result, redisIndex) => {
        const originalIndex = missedKeys[redisIndex].index;
        const originalKey = missedKeys[redisIndex].key;
        
        if (result !== null) {
          results[originalIndex] = result;
          
          // Update memory cache if enabled
          if (strategy.memory) {
            this.memoryCache.set(originalKey, result, strategy.memory);
          }
        } else {
          remainingMisses.push({ index: originalIndex, key: originalKey });
        }
      });

      logger.debug('Multi-get results', { 
        totalKeys: keys.length,
        memoryHits: keys.length - missedKeys.length,
        redisHits: missedKeys.length - remainingMisses.length,
        totalMisses: remainingMisses.length
      });
    }

    return results;
  }

  async mset<T>(items: Array<{ key: string; value: T; ttl?: number }>, options: MultiLevelCacheOptions): Promise<boolean> {
    const { strategy } = options;
    let success = true;

    try {
      const promises: Promise<boolean>[] = [];

      // Set in memory cache
      if (strategy.memory) {
        const memoryItems = items.map(item => ({
          key: item.key,
          value: item.value,
          ttl: item.ttl || strategy.memory!.ttl
        }));

        for (const item of memoryItems) {
          const memoryPromise = Promise.resolve(
            this.memoryCache.set(item.key, item.value, {
              ...strategy.memory,
              ttl: item.ttl
            })
          );
          promises.push(memoryPromise);
        }
      }

      // Set in Redis cache
      if (strategy.redis) {
        const redisItems = items.map(item => ({
          key: item.key,
          value: item.value,
          ttl: item.ttl || strategy.redis!.ttl
        }));

        const redisPromise = this.redisCache.mset(redisItems, strategy.redis);
        promises.push(redisPromise);
      }

      const results = await Promise.allSettled(promises);
      success = results.every(result => result.status === 'fulfilled' && result.value);

      logger.debug('Multi-set completed', { itemCount: items.length, success });
      return success;
    } catch (error) {
      logger.error('Multi-set error', { error });
      return false;
    }
  }

  async clear(pattern?: string, options?: MultiLevelCacheOptions): Promise<boolean> {
    let success = true;

    try {
      const promises: Promise<void | boolean>[] = [];

      // Clear memory cache
      if (!pattern) {
        // Clear all namespaces if no pattern
        const namespaces = this.memoryCache.getNamespaces();
        namespaces.forEach(namespace => {
          promises.push(Promise.resolve(this.memoryCache.clear({ namespace })));
        });
      } else if (options?.strategy.memory) {
        promises.push(Promise.resolve(this.memoryCache.clear(options.strategy.memory)));
      }

      // Clear Redis cache
      if (options?.strategy.redis) {
        const redisPromise = this.redisCache.clear(pattern, options.strategy.redis);
        promises.push(redisPromise);
      }

      const results = await Promise.allSettled(promises);
      success = results.every(result => result.status === 'fulfilled');

      logger.info('Cache clear completed', { pattern, success });
      return success;
    } catch (error) {
      logger.error('Cache clear error', { error });
      return false;
    }
  }

  getStats(namespace?: string): CacheLayerStats {
    const memoryStats = namespace ? 
      this.memoryCache.getStats(namespace) : 
      this.memoryCache.getAllStats();
    
    const redisStats = this.redisCache.getStats();

    let combinedStats;
    if (namespace && memoryStats) {
      // Single namespace stats
      const memStats = memoryStats as MemoryCacheStats;
      combinedStats = {
        totalHits: memStats.hits + redisStats.hits,
        totalMisses: memStats.misses + redisStats.misses,
        hitRate: 0,
        memoryHitRate: memStats.hits / (memStats.hits + memStats.misses) || 0,
        redisHitRate: redisStats.hits / (redisStats.hits + redisStats.misses) || 0
      };
      combinedStats.hitRate = combinedStats.totalHits / (combinedStats.totalHits + combinedStats.totalMisses) || 0;
    } else {
      // All namespaces combined
      const allMemStats = memoryStats as Record<string, MemoryCacheStats>;
      const totalMemHits = Object.values(allMemStats).reduce((sum, stats) => sum + stats.hits, 0);
      const totalMemMisses = Object.values(allMemStats).reduce((sum, stats) => sum + stats.misses, 0);
      
      combinedStats = {
        totalHits: totalMemHits + redisStats.hits,
        totalMisses: totalMemMisses + redisStats.misses,
        hitRate: 0,
        memoryHitRate: totalMemHits / (totalMemHits + totalMemMisses) || 0,
        redisHitRate: redisStats.hits / (redisStats.hits + redisStats.misses) || 0
      };
      combinedStats.hitRate = combinedStats.totalHits / (combinedStats.totalHits + combinedStats.totalMisses) || 0;
    }

    return {
      memory: namespace ? memoryStats as MemoryCacheStats : null,
      redis: redisStats,
      combined: combinedStats
    };
  }

  resetStats(namespace?: string): void {
    this.memoryCache.resetStats(namespace);
    this.redisCache.resetStats();
  }

  private async checkRefreshAhead<T>(key: string, options: MultiLevelCacheOptions, loader: CacheLoader<T>): Promise<void> {
    const { strategy, refreshThreshold = 0.8 } = options;
    
    // Check TTL for the key in Redis
    if (strategy.redis) {
      const ttl = await this.redisCache.ttl(key, strategy.redis);
      const originalTtl = strategy.redis.ttl || 3600;
      
      // If TTL is below threshold, refresh in background
      if (ttl > 0 && ttl < (originalTtl * refreshThreshold)) {
        // Prevent multiple refresh operations for the same key
        if (!this.refreshTimeouts.has(key)) {
          logger.debug('Scheduling refresh-ahead', { key, ttl, threshold: originalTtl * refreshThreshold });
          
          const timeoutId = setTimeout(async () => {
            try {
              const freshData = await loader();
              await this.set(key, freshData, options);
              logger.debug('Refresh-ahead completed', { key });
            } catch (error) {
              logger.error('Refresh-ahead failed', { key, error });
            } finally {
              this.refreshTimeouts.delete(key);
            }
          }, 100); // Small delay to avoid immediate execution
          
          this.refreshTimeouts.set(key, timeoutId);
        }
      }
    }
  }

  // Warmup functionality
  async warmup<T>(
    keys: string[], 
    loader: (key: string) => Promise<T>, 
    options: MultiLevelCacheOptions,
    concurrency: number = 5
  ): Promise<{ successful: number; failed: number; errors: any[] }> {
    const results = { successful: 0, failed: 0, errors: [] as any[] };
    
    // Process keys in batches to control concurrency
    for (let i = 0; i < keys.length; i += concurrency) {
      const batch = keys.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (key) => {
        try {
          // Check if key already exists
          const exists = await this.exists(key, options);
          if (!exists) {
            const data = await loader(key);
            await this.set(key, data, options);
            results.successful++;
            logger.debug('Cache warmed', { key });
          } else {
            results.successful++;
            logger.debug('Cache already warm', { key });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ key, error });
          logger.error('Cache warmup failed', { key, error });
        }
      });

      await Promise.allSettled(batchPromises);
    }

    logger.info('Cache warmup completed', results);
    return results;
  }

  // Cleanup and maintenance
  async cleanup(): Promise<void> {
    // Clear all refresh timeouts
    for (const [key, timeoutId] of this.refreshTimeouts) {
      clearTimeout(timeoutId);
      logger.debug('Cleared refresh timeout', { key });
    }
    this.refreshTimeouts.clear();

    // Prune memory cache
    const namespaces = this.memoryCache.getNamespaces();
    for (const namespace of namespaces) {
      this.memoryCache.prune({ namespace });
    }

    logger.info('Cache cleanup completed');
  }
}

// Singleton instance
let multiLevelCache: MultiLevelCache | null = null;

export const getMultiLevelCache = (): MultiLevelCache => {
  if (!multiLevelCache) {
    multiLevelCache = new MultiLevelCache();
  }
  return multiLevelCache;
};

// Predefined cache strategies
export const CacheStrategies = {
  // Fast access, short-lived data
  FAST_ACCESS: {
    memory: { maxSize: 1000, ttl: 300000, namespace: 'fast' }, // 5 minutes
    redis: { ttl: 1800, compress: true, namespace: 'fast' }, // 30 minutes
    writeThrough: true,
    refreshAhead: false
  },

  // Long-lived, frequently accessed data
  PERSISTENT: {
    memory: { maxSize: 500, ttl: 1800000, namespace: 'persistent' }, // 30 minutes
    redis: { ttl: 86400, compress: true, namespace: 'persistent' }, // 24 hours
    writeThrough: true,
    refreshAhead: true
  },

  // Write-heavy workloads
  WRITE_HEAVY: {
    memory: { maxSize: 2000, ttl: 600000, namespace: 'write_heavy' }, // 10 minutes
    redis: { ttl: 3600, compress: true, namespace: 'write_heavy' }, // 1 hour
    writeThrough: false,
    writeBack: true,
    refreshAhead: false
  },

  // Read-heavy workloads
  READ_HEAVY: {
    memory: { maxSize: 5000, ttl: 1800000, namespace: 'read_heavy' }, // 30 minutes
    redis: { ttl: 43200, compress: true, namespace: 'read_heavy' }, // 12 hours
    writeThrough: true,
    refreshAhead: true
  }
} as const;

export default MultiLevelCache;