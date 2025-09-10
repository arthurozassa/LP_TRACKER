/**
 * Main Solana DEX Service Aggregator
 * Combines all Solana protocol integrations into a unified service
 */

import {
  SolanaContext,
  SolanaScanConfig,
  SolanaScanResult,
  SolanaPosition,
  SolanaPool,
  SolanaCalculationConfig,
  SolanaPositionMetrics,
  SolanaIntegrationError,
  isValidSolanaAddress
} from './common/types';
import {
  retryWithBackoff,
  handleRpcError
} from './common/utils';
import { ProtocolType, ChainType } from '../../../types';

// Protocol implementations
import {
  scanMeteoraPools,
  scanMeteoraPositions,
  enrichMeteoraPosition,
  METEORA_PROGRAM_ID
} from './meteora/dlmm';
import { MeteoraAPIClient } from './meteora/api';
import { calculateMeteoraPositionMetrics } from './meteora/calculations';

import {
  scanRaydiumPools,
  scanRaydiumPositions,
  enrichRaydiumPosition,
  RAYDIUM_CLMM_PROGRAM_ID
} from './raydium/clmm';
import { calculateRaydiumPositionMetrics } from './raydium/calculations';

import {
  scanOrcaPools,
  scanOrcaPositions,
  enrichOrcaPosition,
  ORCA_WHIRLPOOL_PROGRAM_ID
} from './orca/whirlpools';
import { createOrcaSDK } from './orca/sdk';
import { calculateOrcaPositionMetrics } from './orca/calculations';

import {
  scanJupiterPositions,
  getJupiterPoolInfo,
  JUPITER_PERP_PROGRAM_ID
} from './jupiter/perp';
import { JupiterAPIClient } from './jupiter/api';

// ============================================================================
// MAIN SOLANA DEX SERVICE
// ============================================================================

export class SolanaDEXService {
  private context: SolanaContext;
  private config: SolanaScanConfig;
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private poolCache = new Map<string, { pools: SolanaPool[]; timestamp: number }>();
  
  // API clients
  private meteoraAPI: MeteoraAPIClient;
  private jupiterAPI: JupiterAPIClient;
  
  constructor(context: SolanaContext, config?: Partial<SolanaScanConfig>) {
    this.context = context;
    this.config = {
      walletAddress: '',
      protocols: [
        {
          name: 'meteora-dlmm',
          programIds: [METEORA_PROGRAM_ID],
          enabled: true,
          scanDepth: 100
        },
        {
          name: 'raydium-clmm',
          programIds: [RAYDIUM_CLMM_PROGRAM_ID],
          enabled: true,
          scanDepth: 100
        },
        {
          name: 'orca-whirlpools',
          programIds: [ORCA_WHIRLPOOL_PROGRAM_ID],
          enabled: true,
          scanDepth: 100
        },
        {
          name: 'jupiter',
          programIds: [JUPITER_PERP_PROGRAM_ID],
          enabled: true,
          scanDepth: 50
        }
      ],
      includeZeroBalances: false,
      includeClosedPositions: false,
      maxSlotLag: 100,
      commitment: 'confirmed',
      ...config
    };
    
    // Initialize API clients
    this.meteoraAPI = new MeteoraAPIClient();
    this.jupiterAPI = new JupiterAPIClient();
  }

  // ============================================================================
  // MAIN SCANNING FUNCTIONS
  // ============================================================================

  /**
   * Scan all enabled protocols for positions
   */
  async scanAllPositions(walletAddress: string): Promise<SolanaScanResult> {
    try {
      if (!isValidSolanaAddress(walletAddress)) {
        throw new SolanaIntegrationError(
          `Invalid wallet address: ${walletAddress}`,
          'meteora-dlmm',
          'INVALID_ADDRESS'
        );
      }

      const results: SolanaScanResult = {
        walletAddress,
        protocol: 'meteora-dlmm', // Will aggregate multiple protocols
        positions: [],
        pools: [],
        totalValue: 0,
        totalPositions: 0,
        scanTime: Date.now(),
        lastSlot: 0,
        confidence: 1.0,
        errors: []
      };

      const enabledProtocols = this.config.protocols.filter(p => p.enabled);
      const scanPromises = [];

      // Scan each enabled protocol
      for (const protocolConfig of enabledProtocols) {
        switch (protocolConfig.name) {
          case 'meteora-dlmm':
            scanPromises.push(this.scanMeteoraProtocol(walletAddress));
            break;
          case 'raydium-clmm':
            scanPromises.push(this.scanRaydiumProtocol(walletAddress));
            break;
          case 'orca-whirlpools':
            scanPromises.push(this.scanOrcaProtocol(walletAddress));
            break;
          case 'jupiter':
            scanPromises.push(this.scanJupiterProtocol(walletAddress));
            break;
        }
      }

      // Wait for all scans to complete
      const protocolResults = await Promise.allSettled(scanPromises);

      // Aggregate results
      for (const result of protocolResults) {
        if (result.status === 'fulfilled') {
          const scanResult = result.value;
          results.positions.push(...scanResult.positions);
          results.pools.push(...scanResult.pools);
          results.totalPositions += scanResult.totalPositions;
          results.totalValue += scanResult.totalValue;
          
          // Update confidence based on scan success
          if (scanResult.errors.length > 0) {
            results.confidence *= 0.9; // Slight confidence reduction for errors
            results.errors.push(...scanResult.errors);
          }
        } else {
          results.errors.push(`Protocol scan failed: ${result.reason}`);
          results.confidence *= 0.8; // More significant confidence reduction for failures
        }
      }

      // Get current slot for freshness
      try {
        const currentSlot = await this.context.connection.getSlot(this.config.commitment);
        results.lastSlot = currentSlot;
      } catch (error) {
        console.warn('Failed to get current slot:', error);
      }

      results.scanTime = Date.now() - results.scanTime; // Convert to duration

      console.log(`Solana scan completed: ${results.totalPositions} positions across ${enabledProtocols.length} protocols`);
      
      return results;
    } catch (error) {
      throw new SolanaIntegrationError(
        `Failed to scan Solana positions for ${walletAddress}`,
        'meteora-dlmm',
        'SCAN_FAILED',
        error as Error
      );
    }
  }

  /**
   * Get enhanced positions with enriched data
   */
  async getEnhancedPositions(
    positions: SolanaPosition[],
    includePrices: boolean = true
  ): Promise<SolanaPosition[]> {
    try {
      const enhancedPositions: SolanaPosition[] = [];
      
      // Get prices if requested
      let priceFeeds: Map<string, number> | undefined;
      if (includePrices) {
        const allMints = new Set<string>();
        positions.forEach(pos => {
          if (pos.tokens.token0?.address) allMints.add(pos.tokens.token0.address);
          if (pos.tokens.token1?.address) allMints.add(pos.tokens.token1.address);
        });
        
        priceFeeds = await this.fetchTokenPrices(Array.from(allMints));
      }

      // Enhance each position based on its protocol
      for (const position of positions) {
        try {
          let enhanced = position;
          
          switch (position.protocol) {
            case 'meteora-dlmm':
              enhanced = await enrichMeteoraPosition(this.context, position as any, priceFeeds);
              break;
            case 'raydium-clmm':
              enhanced = await enrichRaydiumPosition(this.context, position as any, priceFeeds);
              break;
            case 'orca-whirlpools':
              enhanced = await enrichOrcaPosition(this.context, position as any, priceFeeds);
              break;
            // Jupiter positions don't need enrichment as they're already complete
            case 'jupiter':
            default:
              break;
          }
          
          enhancedPositions.push(enhanced);
        } catch (error) {
          console.warn(`Failed to enhance position ${position.id}:`, error);
          enhancedPositions.push(position); // Include original if enhancement fails
        }
      }

      return enhancedPositions;
    } catch (error) {
      throw new SolanaIntegrationError(
        'Failed to enhance Solana positions',
        'meteora-dlmm',
        'ENHANCEMENT_FAILED',
        error as Error
      );
    }
  }

  /**
   * Calculate comprehensive metrics for positions
   */
  async calculatePositionMetrics(
    positions: SolanaPosition[],
    prices?: Map<string, number>
  ): Promise<Array<SolanaPositionMetrics & { position: SolanaPosition }>> {
    try {
      const metrics: Array<SolanaPositionMetrics & { position: SolanaPosition }> = [];
      
      // Get prices if not provided
      const priceFeeds = prices || await this.fetchTokenPrices(
        positions.flatMap(p => [p.tokens.token0?.address, p.tokens.token1?.address]).filter(Boolean) as string[]
      );

      // Get reward token prices
      const rewardMints = new Set<string>();
      positions.forEach(pos => {
        pos.rewards?.forEach(reward => {
          if (reward.address) rewardMints.add(reward.address);
        });
      });
      const rewardPrices = await this.fetchTokenPrices(Array.from(rewardMints));

      // Calculate metrics for each position
      for (const position of positions) {
        try {
          const prices = {
            token0: priceFeeds.get(position.tokens.token0?.address || '') || 0,
            token1: priceFeeds.get(position.tokens.token1?.address || '') || 0,
            rewards: rewardPrices
          };

          let positionMetrics: SolanaPositionMetrics;

          // Calculate protocol-specific metrics
          switch (position.protocol) {
            case 'meteora-dlmm':
              // Would need to fetch pool data for complete metrics
              positionMetrics = this.calculateBasicMetrics(position, prices);
              break;
            case 'raydium-clmm':
              // Would need pool data for complete metrics
              positionMetrics = this.calculateBasicMetrics(position, prices);
              break;
            case 'orca-whirlpools':
              // Would need pool data for complete metrics
              positionMetrics = this.calculateBasicMetrics(position, prices);
              break;
            case 'jupiter':
              positionMetrics = this.calculateJupiterMetrics(position as any, prices);
              break;
            default:
              positionMetrics = this.calculateBasicMetrics(position, prices);
          }

          metrics.push({
            ...positionMetrics,
            position
          });
        } catch (error) {
          console.warn(`Failed to calculate metrics for position ${position.id}:`, error);
          
          // Add basic metrics as fallback
          metrics.push({
            ...this.calculateBasicMetrics(position, { token0: 0, token1: 0, rewards: new Map() }),
            position
          });
        }
      }

      return metrics;
    } catch (error) {
      throw new SolanaIntegrationError(
        'Failed to calculate position metrics',
        'meteora-dlmm',
        'METRICS_CALCULATION_FAILED',
        error as Error
      );
    }
  }

  // ============================================================================
  // PROTOCOL-SPECIFIC SCANNING
  // ============================================================================

  private async scanMeteoraProtocol(walletAddress: string): Promise<SolanaScanResult> {
    try {
      const [positions, pools] = await Promise.all([
        scanMeteoraPositions(this.context, walletAddress),
        this.getCachedPools('meteora', () => scanMeteoraPools(this.context))
      ]);

      const totalValue = positions.reduce((sum, pos) => sum + (pos.value || 0), 0);

      return {
        walletAddress,
        protocol: 'meteora-dlmm',
        positions,
        pools,
        totalValue,
        totalPositions: positions.length,
        scanTime: Date.now(),
        lastSlot: 0,
        confidence: 1.0,
        errors: []
      };
    } catch (error) {
      return {
        walletAddress,
        protocol: 'meteora-dlmm',
        positions: [],
        pools: [],
        totalValue: 0,
        totalPositions: 0,
        scanTime: Date.now(),
        lastSlot: 0,
        confidence: 0.0,
        errors: [error instanceof Error ? error.message : 'Unknown Meteora scan error']
      };
    }
  }

  private async scanRaydiumProtocol(walletAddress: string): Promise<SolanaScanResult> {
    try {
      const [positions, pools] = await Promise.all([
        scanRaydiumPositions(this.context, walletAddress),
        this.getCachedPools('raydium', () => scanRaydiumPools(this.context))
      ]);

      const totalValue = positions.reduce((sum, pos) => sum + (pos.value || 0), 0);

      return {
        walletAddress,
        protocol: 'raydium-clmm',
        positions,
        pools,
        totalValue,
        totalPositions: positions.length,
        scanTime: Date.now(),
        lastSlot: 0,
        confidence: 1.0,
        errors: []
      };
    } catch (error) {
      return {
        walletAddress,
        protocol: 'raydium-clmm',
        positions: [],
        pools: [],
        totalValue: 0,
        totalPositions: 0,
        scanTime: Date.now(),
        lastSlot: 0,
        confidence: 0.0,
        errors: [error instanceof Error ? error.message : 'Unknown Raydium scan error']
      };
    }
  }

  private async scanOrcaProtocol(walletAddress: string): Promise<SolanaScanResult> {
    try {
      const [positions, pools] = await Promise.all([
        scanOrcaPositions(this.context, walletAddress),
        this.getCachedPools('orca-whirlpools', () => scanOrcaPools(this.context))
      ]);

      const totalValue = positions.reduce((sum, pos) => sum + (pos.value || 0), 0);

      return {
        walletAddress,
        protocol: 'orca-whirlpools',
        positions,
        pools,
        totalValue,
        totalPositions: positions.length,
        scanTime: Date.now(),
        lastSlot: 0,
        confidence: 1.0,
        errors: []
      };
    } catch (error) {
      return {
        walletAddress,
        protocol: 'orca-whirlpools',
        positions: [],
        pools: [],
        totalValue: 0,
        totalPositions: 0,
        scanTime: Date.now(),
        lastSlot: 0,
        confidence: 0.0,
        errors: [error instanceof Error ? error.message : 'Unknown Orca scan error']
      };
    }
  }

  private async scanJupiterProtocol(walletAddress: string): Promise<SolanaScanResult> {
    try {
      const positions = await scanJupiterPositions(this.context, walletAddress);
      const totalValue = positions.reduce((sum, pos) => sum + (pos.value || 0), 0);

      return {
        walletAddress,
        protocol: 'jupiter',
        positions,
        pools: [], // Jupiter perps don't have traditional pools
        totalValue,
        totalPositions: positions.length,
        scanTime: Date.now(),
        lastSlot: 0,
        confidence: 1.0,
        errors: []
      };
    } catch (error) {
      return {
        walletAddress,
        protocol: 'jupiter',
        positions: [],
        pools: [],
        totalValue: 0,
        totalPositions: 0,
        scanTime: Date.now(),
        lastSlot: 0,
        confidence: 0.0,
        errors: [error instanceof Error ? error.message : 'Unknown Jupiter scan error']
      };
    }
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  private async getCachedPools(
    protocol: string,
    fetchFunction: () => Promise<SolanaPool[]>
  ): Promise<SolanaPool[]> {
    const cacheKey = protocol;
    const cached = this.poolCache.get(cacheKey);
    const cacheTimeout = 5 * 60 * 1000; // 5 minutes

    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.pools;
    }

    try {
      const pools = await fetchFunction();
      this.poolCache.set(cacheKey, {
        pools,
        timestamp: Date.now()
      });
      return pools;
    } catch (error) {
      console.warn(`Failed to fetch ${protocol} pools:`, error);
      return cached?.pools || [];
    }
  }

  private async fetchTokenPrices(mints: string[]): Promise<Map<string, number>> {
    if (mints.length === 0) return new Map();

    try {
      // Try Jupiter price API first
      const jupiterPrices = await this.jupiterAPI.fetchPrices(mints);
      
      // Cache prices
      for (const [mint, price] of Array.from(jupiterPrices.entries())) {
        this.priceCache.set(mint, {
          price,
          timestamp: Date.now()
        });
      }

      return jupiterPrices;
    } catch (error) {
      console.warn('Failed to fetch prices:', error);
      
      // Return cached prices as fallback
      const prices = new Map<string, number>();
      for (const mint of mints) {
        const cached = this.priceCache.get(mint);
        if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
          prices.set(mint, cached.price);
        }
      }
      return prices;
    }
  }

  private calculateBasicMetrics(
    position: SolanaPosition,
    prices: { token0: number; token1: number; rewards: Map<string, number> }
  ): SolanaPositionMetrics {
    const ageInDays = (Date.now() - new Date(position.createdAt || '').getTime()) / (1000 * 60 * 60 * 24);
    
    return {
      totalValue: position.value || 0,
      token0Value: (position.tokens.token0?.amount || 0) * prices.token0,
      token1Value: (position.tokens.token1?.amount || 0) * prices.token1,
      totalFeesEarned: position.feesEarned || 0,
      fees24h: (position.feesEarned || 0) / Math.max(ageInDays, 1),
      feeAPR: position.apr || 0,
      totalRewardsEarned: 0,
      rewards24h: 0,
      rewardAPR: 0,
      totalAPR: position.apr || 0,
      impermanentLoss: 0,
      impermanentLossPercent: 0,
      utilizationRate: position.inRange ? 1 : 0,
      concentrationRisk: 0.5,
      priceRange: {
        lower: 0,
        upper: 0,
        current: prices.token0 / Math.max(prices.token1, 0.0001),
        inRange: position.inRange
      },
      ageInDays,
      lastActiveSlot: position.lastSlot,
      lastRewardClaim: position.updatedAt ? new Date(position.updatedAt).getTime() : 0
    };
  }

  private calculateJupiterMetrics(
    position: any, // JupiterPosition
    prices: { token0: number; token1: number; rewards: Map<string, number> }
  ): SolanaPositionMetrics {
    const sizeUsd = Number(position.sizeUsd) / 1e6;
    const collateralUsd = Number(position.collateralUsd) / 1e6;
    const unrealizedPnl = Number(position.unrealizedPnlUsd) / 1e6;
    const realizedPnl = Number(position.realizedPnlUsd) / 1e6;
    
    const totalValue = collateralUsd + unrealizedPnl;
    const totalPnL = unrealizedPnl + realizedPnl;
    const ageInDays = (Date.now() - position.openTime) / (1000 * 60 * 60 * 24);
    
    // Calculate APR based on PnL
    const apr = totalValue > 0 && ageInDays > 0 
      ? (totalPnL / totalValue) * (365 / ageInDays) * 100 
      : 0;

    return {
      totalValue,
      token0Value: totalValue,
      token1Value: 0,
      totalFeesEarned: Math.max(0, realizedPnl),
      fees24h: Math.max(0, totalPnL) / Math.max(ageInDays, 1),
      feeAPR: apr,
      totalRewardsEarned: 0,
      rewards24h: 0,
      rewardAPR: 0,
      totalAPR: apr,
      impermanentLoss: Math.min(0, totalPnL),
      impermanentLossPercent: totalValue > 0 ? (Math.min(0, totalPnL) / totalValue) * 100 : 0,
      utilizationRate: 1, // Perps are always "utilized"
      concentrationRisk: sizeUsd > 0 ? Math.min(sizeUsd / totalValue, 10) / 10 : 0,
      priceRange: {
        lower: Number(position.liquidationPrice) / 1e6,
        upper: Number(position.liquidationPrice) / 1e6,
        current: Number(position.markPrice) / 1e6,
        inRange: true
      },
      ageInDays,
      lastActiveSlot: 0,
      lastRewardClaim: position.lastUpdateTime
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.priceCache.clear();
    this.poolCache.clear();
  }

  /**
   * Get service statistics
   */
  getStats(): {
    cacheSize: { prices: number; pools: number };
    enabledProtocols: string[];
    scanConfig: SolanaScanConfig;
  } {
    return {
      cacheSize: {
        prices: this.priceCache.size,
        pools: this.poolCache.size
      },
      enabledProtocols: this.config.protocols.filter(p => p.enabled).map(p => p.name),
      scanConfig: this.config
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create Solana DEX service with default configuration
 */
export function createSolanaDEXService(
  connection: any, // Solana Connection
  config?: Partial<SolanaScanConfig>
): SolanaDEXService {
  const context: SolanaContext = {
    connection,
    commitment: config?.commitment || 'confirmed',
    timeout: 30000
  };

  return new SolanaDEXService(context, config);
}

/**
 * Quick scan function for easy usage
 */
export async function scanSolanaWallet(
  walletAddress: string,
  connection: any,
  options?: {
    includeMetrics?: boolean;
    includePrices?: boolean;
    protocols?: ProtocolType[];
  }
): Promise<{
  positions: SolanaPosition[];
  totalValue: number;
  totalPositions: number;
  byProtocol: Record<string, { positions: number; value: number }>;
  metrics?: Array<SolanaPositionMetrics & { position: SolanaPosition }>;
}> {
  const enabledProtocols = options?.protocols || [
    'meteora-dlmm',
    'raydium-clmm',
    'orca-whirlpools',
    'jupiter'
  ];

  const service = createSolanaDEXService(connection, {
    walletAddress,
    protocols: enabledProtocols.map(name => ({
      name,
      programIds: [], // Will be filled by service
      enabled: true,
      scanDepth: 100
    }))
  });

  // Scan all positions
  const scanResult = await service.scanAllPositions(walletAddress);
  
  // Enhance positions if requested
  const positions = options?.includePrices 
    ? await service.getEnhancedPositions(scanResult.positions, true)
    : scanResult.positions;

  // Calculate metrics if requested
  let metrics;
  if (options?.includeMetrics) {
    metrics = await service.calculatePositionMetrics(positions);
  }

  // Group by protocol
  const byProtocol: Record<string, { positions: number; value: number }> = {};
  for (const position of positions) {
    const protocol = position.protocol;
    if (!byProtocol[protocol]) {
      byProtocol[protocol] = { positions: 0, value: 0 };
    }
    byProtocol[protocol].positions++;
    byProtocol[protocol].value += position.value || 0;
  }

  return {
    positions,
    totalValue: scanResult.totalValue,
    totalPositions: scanResult.totalPositions,
    byProtocol,
    metrics
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SolanaDEXService,
  createSolanaDEXService,
  scanSolanaWallet,
  
  // Re-export protocol services
  METEORA_PROGRAM_ID,
  RAYDIUM_CLMM_PROGRAM_ID,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  JUPITER_PERP_PROGRAM_ID,
};

// Export common types
export * from './common/types';