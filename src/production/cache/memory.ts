import { LRUCache } from 'lru-cache';
import pino from 'pino';

const logger = pino({ name: 'memory-cache' });

export interface MemoryCacheOptions {
  maxSize?: number;
  ttl?: number;
  namespace?: string;
}

export interface MemoryCacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  calculatedSize: number;
  maxSize: number;
}

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
}

class MemoryCache {
  private caches: Map<string, LRUCache<string, CacheEntry<any>>> = new Map();
  private stats: Map<string, MemoryCacheStats> = new Map();
  private defaultMaxSize = 1000;
  private defaultTTL = 300000; // 5 minutes in milliseconds

  private getOrCreateCache(namespace: string = 'default', options: MemoryCacheOptions = {}): LRUCache<string, CacheEntry<any>> {
    if (!this.caches.has(namespace)) {
      const maxSize = options.maxSize || this.defaultMaxSize;
      const ttl = options.ttl || this.defaultTTL;

      const cache = new LRUCache<string, CacheEntry<any>>({
        max: maxSize,
        ttl: ttl,
        updateAgeOnGet: true,
        updateAgeOnHas: true,
        sizeCalculation: (value) => {
          return JSON.stringify(value.value).length;
        },
        dispose: (value, key, reason) => {
          logger.debug({ namespace, key, reason } as any, 'Cache entry disposed');
        }
      });

      this.caches.set(namespace, cache);
      this.stats.set(namespace, {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        size: 0,
        calculatedSize: 0,
        maxSize: maxSize
      });
    }

    return this.caches.get(namespace)!;
  }

  private updateStats(namespace: string): void {
    const cache = this.caches.get(namespace);
    const stats = this.stats.get(namespace);
    
    if (cache && stats) {
      stats.size = cache.size;
      stats.calculatedSize = cache.calculatedSize || 0;
    }
  }

  get<T>(key: string, options: MemoryCacheOptions = {}): T | null {
    const namespace = options.namespace || 'default';
    const cache = this.getOrCreateCache(namespace, options);
    const stats = this.stats.get(namespace)!;

    const entry = cache.get(key);
    
    if (entry) {
      entry.accessedAt = Date.now();
      entry.accessCount++;
      stats.hits++;
      this.updateStats(namespace);
      
      logger.debug({ namespace, key, accessCount: entry.accessCount } as any, 'Memory cache hit');
      return entry.value;
    } else {
      stats.misses++;
      logger.debug({ namespace, key } as any, 'Memory cache miss');
      return null;
    }
  }

  set<T>(key: string, value: T, options: MemoryCacheOptions = {}): boolean {
    const namespace = options.namespace || 'default';
    const cache = this.getOrCreateCache(namespace, options);
    const stats = this.stats.get(namespace)!;

    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      accessedAt: now,
      accessCount: 0
    };

    try {
      cache.set(key, entry);
      stats.sets++;
      this.updateStats(namespace);
      
      logger.debug({ namespace, key, size: JSON.stringify(value).length } as any, 'Memory cache set');
      return true;
    } catch (error) {
      logger.error({ namespace, key, error } as any, 'Memory cache set error');
      return false;
    }
  }

  has(key: string, options: MemoryCacheOptions = {}): boolean {
    const namespace = options.namespace || 'default';
    const cache = this.getOrCreateCache(namespace, options);
    
    return cache.has(key);
  }

  delete(key: string, options: MemoryCacheOptions = {}): boolean {
    const namespace = options.namespace || 'default';
    const cache = this.getOrCreateCache(namespace, options);
    const stats = this.stats.get(namespace)!;

    const result = cache.delete(key);
    
    if (result) {
      stats.deletes++;
      this.updateStats(namespace);
      logger.debug({ namespace, key } as any, 'Memory cache delete');
    }

    return result;
  }

  clear(options: MemoryCacheOptions = {}): void {
    const namespace = options.namespace || 'default';
    const cache = this.caches.get(namespace);
    
    if (cache) {
      const size = cache.size;
      cache.clear();
      this.updateStats(namespace);
      logger.info({ namespace, entriesCleared: size } as any, 'Memory cache cleared');
    }
  }

  keys(options: MemoryCacheOptions = {}): string[] {
    const namespace = options.namespace || 'default';
    const cache = this.caches.get(namespace);
    
    if (cache) {
      return Array.from(cache.keys());
    }
    
    return [];
  }

  values<T>(options: MemoryCacheOptions = {}): T[] {
    const namespace = options.namespace || 'default';
    const cache = this.caches.get(namespace);
    
    if (cache) {
      return Array.from(cache.values()).map(entry => entry.value);
    }
    
    return [];
  }

  entries<T>(options: MemoryCacheOptions = {}): Array<[string, T]> {
    const namespace = options.namespace || 'default';
    const cache = this.caches.get(namespace);
    
    if (cache) {
      return Array.from(cache.entries()).map(([key, entry]) => [key, entry.value]);
    }
    
    return [];
  }

  size(options: MemoryCacheOptions = {}): number {
    const namespace = options.namespace || 'default';
    const cache = this.caches.get(namespace);
    
    return cache ? cache.size : 0;
  }

  getStats(namespace: string = 'default'): MemoryCacheStats | null {
    const stats = this.stats.get(namespace);
    if (stats) {
      this.updateStats(namespace);
      return { ...stats };
    }
    return null;
  }

  getAllStats(): Record<string, MemoryCacheStats> {
    const allStats: Record<string, MemoryCacheStats> = {};
    
    for (const [namespace, stats] of Array.from(this.stats.entries())) {
      this.updateStats(namespace);
      allStats[namespace] = { ...stats };
    }
    
    return allStats;
  }

  resetStats(namespace?: string): void {
    if (namespace) {
      const stats = this.stats.get(namespace);
      if (stats) {
        const cache = this.caches.get(namespace);
        stats.hits = 0;
        stats.misses = 0;
        stats.sets = 0;
        stats.deletes = 0;
        stats.size = cache?.size || 0;
        stats.calculatedSize = cache?.calculatedSize || 0;
      }
    } else {
      // Reset all namespace stats
      for (const [ns, stats] of Array.from(this.stats.entries())) {
        const cache = this.caches.get(ns);
        stats.hits = 0;
        stats.misses = 0;
        stats.sets = 0;
        stats.deletes = 0;
        stats.size = cache?.size || 0;
        stats.calculatedSize = cache?.calculatedSize || 0;
      }
    }
  }

  // Advanced cache operations
  getHitRate(namespace: string = 'default'): number {
    const stats = this.stats.get(namespace);
    if (!stats || (stats.hits + stats.misses) === 0) {
      return 0;
    }
    return stats.hits / (stats.hits + stats.misses);
  }

  getMostAccessed(limit: number = 10, options: MemoryCacheOptions = {}): Array<{ key: string; value: any; accessCount: number }> {
    const namespace = options.namespace || 'default';
    const cache = this.caches.get(namespace);
    
    if (!cache) {
      return [];
    }

    const entries = Array.from(cache.entries())
      .map(([key, entry]) => ({
        key,
        value: entry.value,
        accessCount: entry.accessCount
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return entries;
  }

  getOldest(limit: number = 10, options: MemoryCacheOptions = {}): Array<{ key: string; value: any; age: number }> {
    const namespace = options.namespace || 'default';
    const cache = this.caches.get(namespace);
    
    if (!cache) {
      return [];
    }

    const now = Date.now();
    const entries = Array.from(cache.entries())
      .map(([key, entry]) => ({
        key,
        value: entry.value,
        age: now - entry.createdAt
      }))
      .sort((a, b) => b.age - a.age)
      .slice(0, limit);

    return entries;
  }

  // Cleanup and maintenance
  prune(options: MemoryCacheOptions = {}): number {
    const namespace = options.namespace || 'default';
    const cache = this.caches.get(namespace);
    
    if (!cache) {
      return 0;
    }

    const initialSize = cache.size;
    cache.purgeStale();
    const finalSize = cache.size;
    const pruned = initialSize - finalSize;

    this.updateStats(namespace);
    logger.info({ namespace, entriesPruned: pruned } as any, 'Memory cache pruned');

    return pruned;
  }

  // Namespace management
  deleteNamespace(namespace: string): boolean {
    const cache = this.caches.get(namespace);
    const stats = this.stats.get(namespace);
    
    if (cache) {
      const size = cache.size;
      cache.clear();
      this.caches.delete(namespace);
      this.stats.delete(namespace);
      
      logger.info({ namespace, entriesDeleted: size } as any, 'Memory cache namespace deleted');
      return true;
    }
    
    return false;
  }

  getNamespaces(): string[] {
    return Array.from(this.caches.keys());
  }

  // Memory usage estimation
  getMemoryUsage(): { totalEntries: number; estimatedSizeBytes: number; namespaces: Record<string, { entries: number; sizeBytes: number }> } {
    let totalEntries = 0;
    let estimatedSizeBytes = 0;
    const namespaces: Record<string, { entries: number; sizeBytes: number }> = {};

    for (const [namespace, cache] of Array.from(this.caches.entries())) {
      const entries = cache.size;
      const sizeBytes = cache.calculatedSize || 0;
      
      totalEntries += entries;
      estimatedSizeBytes += sizeBytes;
      namespaces[namespace] = { entries, sizeBytes };
    }

    return {
      totalEntries,
      estimatedSizeBytes,
      namespaces
    };
  }
}

// Singleton instance
let memoryCache: MemoryCache | null = null;

export const getMemoryCache = (): MemoryCache => {
  if (!memoryCache) {
    memoryCache = new MemoryCache();
  }
  return memoryCache;
};

export default MemoryCache;