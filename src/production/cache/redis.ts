import Redis from 'ioredis';
import { kv } from '@vercel/kv';
import * as LZString from 'lz-string';
import pino from 'pino';

const logger = pino({ name: 'redis-cache' });

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  namespace?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  compressionRatio: number;
}

class RedisCache {
  private redis: Redis | null = null;
  private useVercelKV: boolean = false;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    compressionRatio: 0
  };
  private defaultTTL = 3600; // 1 hour
  private defaultNamespace = 'lp-tracker';

  constructor() {
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      // Try to connect to Redis first
      const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
      
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          connectTimeout: 10000,
          family: 4, // IPv4
        });

        await this.redis.ping();
        logger.info('Connected to Redis');
      } else {
        throw new Error('No Redis URL provided');
      }
    } catch (error) {
      logger.warn('Redis connection failed, falling back to Vercel KV', { error });
      this.useVercelKV = true;
      this.redis = null;
      
      // Test Vercel KV connection
      try {
        await kv.ping();
        logger.info('Connected to Vercel KV');
      } catch (kvError) {
        logger.error('Both Redis and Vercel KV connections failed', { kvError });
      }
    }
  }

  private buildKey(key: string, namespace?: string): string {
    const ns = namespace || this.defaultNamespace;
    return `${ns}:${key}`;
  }

  private compressData(data: any): string {
    const json = JSON.stringify(data);
    const compressed = LZString.compressToUTF16(json);
    
    // Update compression ratio stats
    const originalSize = json.length;
    const compressedSize = compressed.length;
    this.stats.compressionRatio = compressedSize / originalSize;
    
    return compressed;
  }

  private decompressData(compressed: string): any {
    try {
      const decompressed = LZString.decompressFromUTF16(compressed);
      return decompressed ? JSON.parse(decompressed) : null;
    } catch (error) {
      logger.error('Failed to decompress data', { error });
      return null;
    }
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const cacheKey = this.buildKey(key, options.namespace);
    
    try {
      let data: string | null = null;
      
      if (this.useVercelKV) {
        data = await kv.get(cacheKey);
      } else if (this.redis) {
        data = await this.redis.get(cacheKey);
      }

      if (data === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      
      // Try to decompress if the data looks compressed
      if (options.compress !== false && data.includes('\u0001')) {
        return this.decompressData(data);
      }
      
      return JSON.parse(data);
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error', { key: cacheKey, error });
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.buildKey(key, options.namespace);
    const ttl = options.ttl || this.defaultTTL;
    
    try {
      let dataToStore: string;
      
      if (options.compress !== false) {
        dataToStore = this.compressData(value);
      } else {
        dataToStore = JSON.stringify(value);
      }

      if (this.useVercelKV) {
        await kv.setex(cacheKey, ttl, dataToStore);
      } else if (this.redis) {
        await this.redis.setex(cacheKey, ttl, dataToStore);
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error', { key: cacheKey, error });
      return false;
    }
  }

  async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.buildKey(key, options.namespace);
    
    try {
      if (this.useVercelKV) {
        await kv.del(cacheKey);
      } else if (this.redis) {
        await this.redis.del(cacheKey);
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error', { key: cacheKey, error });
      return false;
    }
  }

  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.buildKey(key, options.namespace);
    
    try {
      if (this.useVercelKV) {
        const result = await kv.exists(cacheKey);
        return result === 1;
      } else if (this.redis) {
        const result = await this.redis.exists(cacheKey);
        return result === 1;
      }
      
      return false;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache exists error', { key: cacheKey, error });
      return false;
    }
  }

  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    const cacheKeys = keys.map(key => this.buildKey(key, options.namespace));
    
    try {
      let results: (string | null)[] = [];
      
      if (this.useVercelKV) {
        // Vercel KV doesn't have mget, so we'll use Promise.all
        results = await Promise.all(
          cacheKeys.map(key => kv.get(key))
        );
      } else if (this.redis) {
        results = await this.redis.mget(...cacheKeys);
      }

      return results.map((data, index) => {
        if (data === null) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;
        
        try {
          if (options.compress !== false && data.includes('\u0001')) {
            return this.decompressData(data);
          }
          return JSON.parse(data);
        } catch (error) {
          logger.error('Failed to parse cached data', { key: cacheKeys[index], error });
          return null;
        }
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mget error', { keys: cacheKeys, error });
      return keys.map(() => null);
    }
  }

  async mset(items: Array<{ key: string; value: any; ttl?: number }>, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (this.useVercelKV) {
        // Vercel KV doesn't have mset, so we'll use Promise.all
        await Promise.all(
          items.map(item => 
            this.set(item.key, item.value, { 
              ...options, 
              ttl: item.ttl || options.ttl 
            })
          )
        );
      } else if (this.redis) {
        const pipeline = this.redis.pipeline();
        
        items.forEach(item => {
          const cacheKey = this.buildKey(item.key, options.namespace);
          const ttl = item.ttl || options.ttl || this.defaultTTL;
          
          let dataToStore: string;
          if (options.compress !== false) {
            dataToStore = this.compressData(item.value);
          } else {
            dataToStore = JSON.stringify(item.value);
          }
          
          pipeline.setex(cacheKey, ttl, dataToStore);
        });
        
        await pipeline.exec();
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mset error', { error });
      return false;
    }
  }

  async clear(pattern?: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const namespace = options.namespace || this.defaultNamespace;
      const searchPattern = pattern ? `${namespace}:${pattern}` : `${namespace}:*`;

      if (this.useVercelKV) {
        // Vercel KV doesn't support pattern deletion, so we'll need to track keys
        logger.warn('Pattern clearing not fully supported with Vercel KV');
        return false;
      } else if (this.redis) {
        const keys = await this.redis.keys(searchPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear error', { pattern, error });
      return false;
    }
  }

  async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    const cacheKey = this.buildKey(key, options.namespace);
    
    try {
      if (this.useVercelKV) {
        // Vercel KV doesn't expose TTL directly
        return -1;
      } else if (this.redis) {
        return await this.redis.ttl(cacheKey);
      }
      
      return -1;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache TTL error', { key: cacheKey, error });
      return -1;
    }
  }

  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    const cacheKey = this.buildKey(key, options.namespace);
    
    try {
      if (this.useVercelKV) {
        // Vercel KV doesn't support direct expire, need to get and set
        const value = await kv.get(cacheKey);
        if (value !== null) {
          await kv.setex(cacheKey, ttl, value);
          return true;
        }
        return false;
      } else if (this.redis) {
        const result = await this.redis.expire(cacheKey, ttl);
        return result === 1;
      }
      
      return false;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache expire error', { key: cacheKey, error });
      return false;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      compressionRatio: 0
    };
  }

  isConnected(): boolean {
    if (this.useVercelKV) {
      return true; // Assume Vercel KV is available if we're using it
    }
    return this.redis?.status === 'ready';
  }

  async disconnect(): Promise<void> {
    if (this.redis && !this.useVercelKV) {
      await this.redis.quit();
    }
  }
}

// Singleton instance
let redisCache: RedisCache | null = null;

export const getRedisCache = (): RedisCache => {
  if (!redisCache) {
    redisCache = new RedisCache();
  }
  return redisCache;
};

export default RedisCache;