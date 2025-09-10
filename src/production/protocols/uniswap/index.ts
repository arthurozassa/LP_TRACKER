/**
 * Main Uniswap Service
 * Integrates V2 and V3 scanners with caching and provider management
 */

import { ethers } from 'ethers';
import { 
  UniswapPosition,
  UniswapV2Position,
  UniswapV3Position,
  UniswapChain, 
  ScanParams, 
  ScanResult,
  UniswapError, 
  UniswapErrorCodes,
  PositionScanProgress,
  chainToChainType
} from './common/types';
import { 
  measureExecutionTime,
  normalizeAddress,
  isValidEthereumAddress,
  retryWithBackoff
} from './common/utils';
import { V2PositionScanner, createV2Scanner, V2ScanConfig } from './v2/scanner';
import { V3PositionScanner, createV3Scanner, V3ScanConfig } from './v3/scanner';

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

export interface UniswapServiceConfig {
  chains: UniswapChain[];
  v2Config?: Partial<V2ScanConfig>;
  v3Config?: Partial<V3ScanConfig>;
  enableV2: boolean;
  enableV3: boolean;
  enableCaching: boolean;
  cacheConfig?: {
    ttl: number;
    maxSize: number;
  };
  providerConfig?: {
    timeout: number;
    retryCount: number;
    apiKeys?: Record<string, string>;
  };
}

export const DEFAULT_UNISWAP_SERVICE_CONFIG: UniswapServiceConfig = {
  chains: [UniswapChain.ETHEREUM, UniswapChain.ARBITRUM, UniswapChain.POLYGON, UniswapChain.BASE],
  enableV2: true,
  enableV3: true,
  enableCaching: true,
  cacheConfig: {
    ttl: 300, // 5 minutes
    maxSize: 1000
  },
  providerConfig: {
    timeout: 30000,
    retryCount: 3
  }
};

// ============================================================================
// SCAN RESULTS AGGREGATION
// ============================================================================

export interface UniswapScanResults extends ScanResult {
  v2Positions: UniswapV2Position[];
  v3Positions: UniswapV3Position[];
  v2Stats: {
    totalPositions: number;
    totalValueUSD: number;
    totalFeesUSD: number;
    avgAPR: number;
  };
  v3Stats: {
    totalPositions: number;
    totalValueUSD: number;
    totalFeesUSD: number;
    avgAPR: number;
    inRangePositions: number;
    outOfRangePositions: number;
  };
  chainStats: Record<UniswapChain, {
    v2Positions: number;
    v3Positions: number;
    totalValueUSD: number;
  }>;
}

export interface ProgressUpdate {
  phase: 'initializing' | 'scanning_v2' | 'scanning_v3' | 'aggregating' | 'completed' | 'error';
  chain?: UniswapChain;
  progress: PositionScanProgress[];
  totalPositionsFound: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

// ============================================================================
// MAIN UNISWAP SERVICE
// ============================================================================

export class UniswapService {
  private config: UniswapServiceConfig;
  private providers: Map<UniswapChain, ethers.providers.Provider>;
  private v2Scanners: Map<UniswapChain, V2PositionScanner>;
  private v3Scanners: Map<UniswapChain, V3PositionScanner>;
  private cache: Map<string, { data: any; timestamp: number; expiry: number }>;

  constructor(config: Partial<UniswapServiceConfig> = {}) {
    this.config = { ...DEFAULT_UNISWAP_SERVICE_CONFIG, ...config };
    this.providers = new Map();
    this.v2Scanners = new Map();
    this.v3Scanners = new Map();
    this.cache = new Map();

    this.initializeServices();
  }

  /**
   * Initialize providers and scanners for all configured chains
   */
  private async initializeServices(): Promise<void> {
    for (const chain of this.config.chains) {
      try {
        // Create provider for chain
        const provider = await this.createProvider(chain);
        this.providers.set(chain, provider);

        // Create V2 scanner if enabled
        if (this.config.enableV2) {
          const v2Scanner = createV2Scanner(provider, chain, this.config.v2Config);
          this.v2Scanners.set(chain, v2Scanner);
        }

        // Create V3 scanner if enabled
        if (this.config.enableV3) {
          const v3Scanner = createV3Scanner(provider, chain, this.config.v3Config);
          this.v3Scanners.set(chain, v3Scanner);
        }
      } catch (error) {
        console.warn(`Failed to initialize services for ${chain}:`, error);
      }
    }
  }

  /**
   * Creates a provider for the specified chain
   */
  private async createProvider(chain: UniswapChain): Promise<ethers.providers.Provider> {
    const config = this.config.providerConfig || {};
    
    // Use existing provider system if available
    try {
      const { ProviderFactory } = await import('../../providers');
      const chainType = chainToChainType(chain);
      
      // Map Uniswap chains to provider network names
      let networkName: string;
      switch (chain) {
        case UniswapChain.ETHEREUM:
          networkName = 'mainnet';
          break;
        case UniswapChain.ARBITRUM:
          networkName = 'arbitrum';
          break;
        case UniswapChain.POLYGON:
          networkName = 'polygon';
          break;
        case UniswapChain.BASE:
          networkName = 'base';
          break;
        default:
          networkName = 'mainnet';
      }
      
      const provider = await ProviderFactory.getEthereumProvider(networkName as any);
      return provider.getProvider();
    } catch (error) {
      // Fallback to direct RPC providers
      return this.createFallbackProvider(chain);
    }
  }

  /**
   * Creates a fallback RPC provider
   */
  private createFallbackProvider(chain: UniswapChain): ethers.providers.Provider {
    const { getRpcUrl, getNetworkConfig } = require('./common/utils');
    const networkConfig = getNetworkConfig(chain);
    
    const apiKey = this.config.providerConfig?.apiKeys?.[chain];
    const rpcUrl = getRpcUrl(chain, apiKey);
    
    return new ethers.providers.JsonRpcProvider({
      url: rpcUrl,
      timeout: this.config.providerConfig?.timeout || 30000
    }, {
      chainId: networkConfig.chainId,
      name: networkConfig.name
    });
  }

  /**
   * Scans for all Uniswap positions across all chains and protocols
   */
  async scanPositions(
    address: string,
    options: {
      chains?: UniswapChain[];
      includeV2?: boolean;
      includeV3?: boolean;
      includeInactive?: boolean;
    } = {},
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<UniswapScanResults> {
    if (!isValidEthereumAddress(address)) {
      throw new UniswapError(
        `Invalid Ethereum address: ${address}`,
        UniswapErrorCodes.INVALID_ADDRESS
      );
    }

    const normalizedAddress = normalizeAddress(address);
    const chainsToScan = options.chains || this.config.chains;
    const includeV2 = options.includeV2 !== false && this.config.enableV2;
    const includeV3 = options.includeV3 !== false && this.config.enableV3;

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache(normalizedAddress, { chains: chainsToScan, includeV2, includeV3 });
      if (cached) {
        return cached;
      }
    }

    const startTime = Date.now();
    let progressTracker: PositionScanProgress[] = [];
    
    // Initialize progress tracking
    for (const chain of chainsToScan) {
      if (includeV2) {
        progressTracker.push({
          chain,
          protocol: 'v2',
          status: 'pending',
          positionsFound: 0
        });
      }
      if (includeV3) {
        progressTracker.push({
          chain,
          protocol: 'v3',
          status: 'pending',
          positionsFound: 0
        });
      }
    }

    if (onProgress) {
      onProgress({
        phase: 'initializing',
        progress: progressTracker,
        totalPositionsFound: 0
      });
    }

    try {
      const { result: scanResults } = await measureExecutionTime(
        `Full Uniswap scan for ${normalizedAddress}`,
        () => this.performFullScan(
          normalizedAddress,
          chainsToScan,
          includeV2,
          includeV3,
          options.includeInactive,
          (updates) => {
            progressTracker = updates;
            const totalFound = updates.reduce((sum, u) => sum + u.positionsFound, 0);
            
            if (onProgress) {
              onProgress({
                phase: 'scanning_v2', // Will be updated based on current phase
                progress: updates,
                totalPositionsFound: totalFound,
                estimatedTimeRemaining: this.estimateRemainingTime(updates, startTime)
              });
            }
          }
        )
      );

      // Cache results
      if (this.config.enableCaching) {
        this.setInCache(normalizedAddress, { chains: chainsToScan, includeV2, includeV3 }, scanResults);
      }

      if (onProgress) {
        onProgress({
          phase: 'completed',
          progress: progressTracker,
          totalPositionsFound: scanResults.totalPositions
        });
      }

      return scanResults;

    } catch (error) {
      if (onProgress) {
        onProgress({
          phase: 'error',
          progress: progressTracker,
          totalPositionsFound: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  /**
   * Performs the full scan across chains and protocols
   */
  private async performFullScan(
    address: string,
    chains: UniswapChain[],
    includeV2: boolean,
    includeV3: boolean,
    includeInactive = false,
    onProgress?: (updates: PositionScanProgress[]) => void
  ): Promise<UniswapScanResults> {
    const allV2Positions: UniswapV2Position[] = [];
    const allV3Positions: UniswapV3Position[] = [];
    const chainStats: Record<string, any> = {};
    let progressUpdates: PositionScanProgress[] = [];

    // Initialize chain stats
    for (const chain of chains) {
      chainStats[chain] = {
        v2Positions: 0,
        v3Positions: 0,
        totalValueUSD: 0
      };
    }

    // Scan each chain
    for (const chain of chains) {
      const chainStart = Date.now();

      try {
        // Scan V2 positions
        if (includeV2 && this.v2Scanners.has(chain)) {
          const v2Scanner = this.v2Scanners.get(chain)!;
          
          const v2Positions = await v2Scanner.scanPositions(
            address,
            (progress) => {
              progressUpdates = this.updateProgressArray(progressUpdates, progress);
              if (onProgress) onProgress(progressUpdates);
            }
          );

          const filteredV2 = includeInactive ? v2Positions : v2Positions.filter(p => p.isActive);
          allV2Positions.push(...filteredV2);
          chainStats[chain].v2Positions = filteredV2.length;
        }

        // Scan V3 positions
        if (includeV3 && this.v3Scanners.has(chain)) {
          const v3Scanner = this.v3Scanners.get(chain)!;
          
          const v3Positions = await v3Scanner.scanPositions(
            address,
            (progress) => {
              progressUpdates = this.updateProgressArray(progressUpdates, progress);
              if (onProgress) onProgress(progressUpdates);
            }
          );

          const filteredV3 = includeInactive ? v3Positions : v3Positions.filter(p => p.isActive);
          allV3Positions.push(...filteredV3);
          chainStats[chain].v3Positions = filteredV3.length;
        }

      } catch (error) {
        console.warn(`Scan failed for chain ${chain}:`, error);
        // Mark chain scans as errored in progress
        progressUpdates = progressUpdates.map(p => {
          if (p.chain === chain) {
            return { ...p, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
          }
          return p;
        });
      }
    }

    // Calculate statistics
    const v2Stats = this.calculateV2Stats(allV2Positions);
    const v3Stats = this.calculateV3Stats(allV3Positions);

    // Combine all positions
    const allPositions: UniswapPosition[] = [...allV2Positions, ...allV3Positions];

    return {
      address,
      totalValueUSD: v2Stats.totalValueUSD + v3Stats.totalValueUSD,
      totalFeesEarnedUSD: v2Stats.totalFeesUSD + v3Stats.totalFeesUSD,
      positions: allPositions,
      chains,
      protocols: [
        ...(includeV2 ? ['uniswap-v2' as const] : []),
        ...(includeV3 ? ['uniswap-v3' as const] : [])
      ],
      scannedAt: new Date(),
      processingTimeMs: Date.now() - Date.now(), // Will be set by measureExecutionTime
      
      // Extended results
      v2Positions: allV2Positions,
      v3Positions: allV3Positions,
      v2Stats,
      v3Stats,
      chainStats: chainStats as any
    };
  }

  /**
   * Updates progress array with new progress info
   */
  private updateProgressArray(
    currentProgress: PositionScanProgress[],
    newProgress: PositionScanProgress
  ): PositionScanProgress[] {
    const index = currentProgress.findIndex(
      p => p.chain === newProgress.chain && p.protocol === newProgress.protocol
    );
    
    if (index >= 0) {
      currentProgress[index] = newProgress;
    } else {
      currentProgress.push(newProgress);
    }
    
    return [...currentProgress];
  }

  /**
   * Estimates remaining scan time
   */
  private estimateRemainingTime(progress: PositionScanProgress[], startTime: number): number {
    const completedScans = progress.filter(p => p.status === 'completed').length;
    const totalScans = progress.length;
    const elapsedTime = Date.now() - startTime;
    
    if (completedScans === 0) return 0;
    
    const avgTimePerScan = elapsedTime / completedScans;
    const remainingScans = totalScans - completedScans;
    
    return remainingScans * avgTimePerScan;
  }

  /**
   * Calculates V2 statistics
   */
  private calculateV2Stats(positions: UniswapV2Position[]) {
    const totalPositions = positions.length;
    const totalValueUSD = positions.reduce((sum, p) => sum + p.liquidityUSD, 0);
    const totalFeesUSD = positions.reduce((sum, p) => sum + p.feesEarnedUSD, 0);
    const avgAPR = totalPositions > 0 ? positions.reduce((sum, p) => sum + p.apr, 0) / totalPositions : 0;

    return {
      totalPositions,
      totalValueUSD,
      totalFeesUSD,
      avgAPR
    };
  }

  /**
   * Calculates V3 statistics
   */
  private calculateV3Stats(positions: UniswapV3Position[]) {
    const totalPositions = positions.length;
    const inRangePositions = positions.filter(p => p.inRange).length;
    const outOfRangePositions = totalPositions - inRangePositions;
    const totalValueUSD = positions.reduce((sum, p) => sum + p.liquidityUSD, 0);
    const totalFeesUSD = positions.reduce((sum, p) => sum + p.feesEarnedUSD, 0);
    const avgAPR = totalPositions > 0 ? positions.reduce((sum, p) => sum + p.apr, 0) / totalPositions : 0;

    return {
      totalPositions,
      totalValueUSD,
      totalFeesUSD,
      avgAPR,
      inRangePositions,
      outOfRangePositions
    };
  }

  /**
   * Cache management
   */
  private getFromCache(address: string, options: any): UniswapScanResults | null {
    if (!this.config.enableCaching) return null;

    const key = this.getCacheKey(address, options);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    
    // Clean up expired entry
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  private setInCache(address: string, options: any, data: UniswapScanResults): void {
    if (!this.config.enableCaching) return;

    const key = this.getCacheKey(address, options);
    const ttl = this.config.cacheConfig?.ttl || 300;
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl * 1000
    });

    // Clean up old entries if cache is too large
    const maxSize = this.config.cacheConfig?.maxSize || 1000;
    if (this.cache.size > maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  private getCacheKey(address: string, options: any): string {
    return `uniswap:${address.toLowerCase()}:${JSON.stringify(options)}`;
  }

  /**
   * Gets service health and statistics
   */
  getServiceHealth(): {
    isHealthy: boolean;
    chains: Record<UniswapChain, {
      v2Available: boolean;
      v3Available: boolean;
      providerHealthy: boolean;
    }>;
    cacheStats: {
      size: number;
      hitRate: number;
    };
  } {
    const chainHealth: Record<string, any> = {};
    
    for (const chain of this.config.chains) {
      chainHealth[chain] = {
        v2Available: this.v2Scanners.has(chain),
        v3Available: this.v3Scanners.has(chain),
        providerHealthy: this.providers.has(chain)
      };
    }

    return {
      isHealthy: this.providers.size > 0,
      chains: chainHealth as any,
      cacheStats: {
        size: this.cache.size,
        hitRate: 0 // Would need to track hits/misses
      }
    };
  }

  /**
   * Clears all caches
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets supported chains
   */
  getSupportedChains(): UniswapChain[] {
    return this.config.chains;
  }

  /**
   * Checks if a specific protocol is supported on a chain
   */
  isProtocolSupported(chain: UniswapChain, protocol: 'v2' | 'v3'): boolean {
    if (protocol === 'v2') {
      return this.config.enableV2 && this.v2Scanners.has(chain);
    } else {
      return this.config.enableV3 && this.v3Scanners.has(chain);
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Creates a new Uniswap service instance
 */
export function createUniswapService(config?: Partial<UniswapServiceConfig>): UniswapService {
  return new UniswapService(config);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default UniswapService;

// Re-export everything needed by consumers
export * from './common/types';
export * from './common/utils';
export * from './v2/scanner';
export * from './v3/scanner';
export { V2Calculator } from './v2/calculations';
export { V3Calculator } from './v3/calculations';