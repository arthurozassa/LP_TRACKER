/**
 * Orca SDK Integration
 * Wraps Orca Whirlpools SDK for advanced calculations and utilities
 */

import {
  OrcaPosition,
  OrcaPool,
  SolanaContext,
  SolanaIntegrationError,
  SolanaCalculationConfig,
  SolanaPositionMetrics
} from '../common/types';
import {
  tokenAmountToUi,
  uiAmountToToken,
  retryWithBackoff,
  calculatePositionValue
} from '../common/utils';
import { ProtocolType } from '../../../../types';

// ============================================================================
// SDK WRAPPER TYPES
// ============================================================================

export interface OrcaSDKConfig {
  connection: any; // Solana Connection
  whirlpoolProgramId: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export interface WhirlpoolData {
  address: string;
  whirlpoolsConfig: string;
  tokenMintA: string;
  tokenMintB: string;
  tokenVaultA: string;
  tokenVaultB: string;
  tickSpacing: number;
  tickCurrentIndex: number;
  sqrtPrice: string;
  liquidity: string;
  feeRate: number;
  protocolFeeRate: number;
  rewardInfos: Array<{
    address: string;
    vault: string;
    authority: string;
    emissionsPerSecondX64: string;
    growthGlobalX64: string;
  }>;
}

export interface PositionData {
  address: string;
  whirlpool: string;
  positionMint: string;
  liquidity: string;
  tickLowerIndex: number;
  tickUpperIndex: number;
  feeGrowthCheckpointA: string;
  feeGrowthCheckpointB: string;
  feeOwedA: string;
  feeOwedB: string;
  rewardInfos: Array<{
    growthInsideCheckpoint: string;
    amountOwed: string;
  }>;
}

export interface PriceRange {
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
}

export interface TokenAmounts {
  tokenA: string;
  tokenB: string;
}

export interface FeeCalculation {
  feeOwedA: string;
  feeOwedB: string;
  totalFeesUSD: number;
  apr: number;
}

// ============================================================================
// ORCA SDK WRAPPER CLASS
// ============================================================================

export class OrcaSDKWrapper {
  private config: OrcaSDKConfig;
  private whirlpoolsConfigCache = new Map<string, any>();
  private poolCache = new Map<string, WhirlpoolData>();

  constructor(config: OrcaSDKConfig) {
    this.config = config;
  }

  // ============================================================================
  // POOL OPERATIONS
  // ============================================================================

  /**
   * Get whirlpool data with SDK enhancements
   */
  async getWhirlpool(address: string): Promise<WhirlpoolData> {
    try {
      // Check cache first
      if (this.poolCache.has(address)) {
        return this.poolCache.get(address)!;
      }

      // In a real implementation, this would use the Orca SDK
      // For now, we'll simulate the SDK behavior
      const poolData = await this.fetchWhirlpoolData(address);
      
      // Cache the result
      this.poolCache.set(address, poolData);
      
      return poolData;
    } catch (error) {
      throw new SolanaIntegrationError(
        `Failed to get whirlpool ${address}`,
        'orca-whirlpools',
        'SDK_ERROR',
        error as Error
      );
    }
  }

  /**
   * Calculate token amounts for a position
   */
  async calculateTokenAmounts(
    poolAddress: string,
    liquidity: string,
    tickLower: number,
    tickUpper: number
  ): Promise<TokenAmounts> {
    try {
      const pool = await this.getWhirlpool(poolAddress);
      const liquidityBN = Number(liquidity);
      
      if (liquidityBN === 0) {
        return { tokenA: '0', tokenB: '0' };
      }

      // Calculate sqrt prices
      const sqrtPriceLower = Math.sqrt(Math.pow(1.0001, tickLower));
      const sqrtPriceUpper = Math.sqrt(Math.pow(1.0001, tickUpper));
      const sqrtPriceCurrent = Number(pool.sqrtPrice) / Math.pow(2, 64);

      let tokenA = 0;
      let tokenB = 0;

      if (pool.tickCurrentIndex < tickLower) {
        // Only token A
        tokenA = liquidityBN * (sqrtPriceUpper - sqrtPriceLower) / (sqrtPriceUpper * sqrtPriceLower);
      } else if (pool.tickCurrentIndex >= tickUpper) {
        // Only token B
        tokenB = liquidityBN * (sqrtPriceUpper - sqrtPriceLower);
      } else {
        // Both tokens
        tokenA = liquidityBN * (sqrtPriceUpper - sqrtPriceCurrent) / (sqrtPriceUpper * sqrtPriceCurrent);
        tokenB = liquidityBN * (sqrtPriceCurrent - sqrtPriceLower);
      }

      return {
        tokenA: Math.floor(tokenA).toString(),
        tokenB: Math.floor(tokenB).toString()
      };
    } catch (error) {
      throw new SolanaIntegrationError(
        `Failed to calculate token amounts for pool ${poolAddress}`,
        'orca-whirlpools',
        'CALCULATION_ERROR',
        error as Error
      );
    }
  }

  /**
   * Calculate price range for a position
   */
  calculatePriceRange(tickLower: number, tickUpper: number, tickCurrent: number): PriceRange {
    try {
      const lowerPrice = Math.pow(1.0001, tickLower);
      const upperPrice = Math.pow(1.0001, tickUpper);
      const currentPrice = Math.pow(1.0001, tickCurrent);

      return {
        lowerPrice,
        upperPrice,
        currentPrice
      };
    } catch (error) {
      throw new SolanaIntegrationError(
        'Failed to calculate price range',
        'orca-whirlpools',
        'CALCULATION_ERROR',
        error as Error
      );
    }
  }

  // ============================================================================
  // FEE CALCULATIONS
  // ============================================================================

  /**
   * Calculate fees earned by a position
   */
  async calculateFees(
    position: PositionData,
    pool: WhirlpoolData,
    prices: { tokenA: number; tokenB: number }
  ): Promise<FeeCalculation> {
    try {
      // This would use the SDK's fee calculation logic
      // For now, we'll use the stored fee amounts
      const feeOwedA = position.feeOwedA;
      const feeOwedB = position.feeOwedB;

      // Convert to UI amounts (assuming decimals)
      const feeOwedAUI = tokenAmountToUi(feeOwedA, 6); // USDC decimals
      const feeOwedBUI = tokenAmountToUi(feeOwedB, 9); // SOL decimals

      // Calculate USD value
      const totalFeesUSD = (feeOwedAUI * prices.tokenA) + (feeOwedBUI * prices.tokenB);

      // Calculate position value for APR
      const tokenAmounts = await this.calculateTokenAmounts(
        pool.address,
        position.liquidity,
        position.tickLowerIndex,
        position.tickUpperIndex
      );

      const tokenAUI = tokenAmountToUi(tokenAmounts.tokenA, 6);
      const tokenBUI = tokenAmountToUi(tokenAmounts.tokenB, 9);
      const positionValueUSD = (tokenAUI * prices.tokenA) + (tokenBUI * prices.tokenB);

      // Calculate APR (simplified)
      const apr = positionValueUSD > 0 ? (totalFeesUSD / positionValueUSD) * 365 * 100 : 0;

      return {
        feeOwedA,
        feeOwedB,
        totalFeesUSD,
        apr
      };
    } catch (error) {
      throw new SolanaIntegrationError(
        'Failed to calculate fees',
        'orca-whirlpools',
        'CALCULATION_ERROR',
        error as Error
      );
    }
  }

  // ============================================================================
  // POSITION ANALYSIS
  // ============================================================================

  /**
   * Analyze position performance
   */
  async analyzePosition(
    position: PositionData,
    prices: { tokenA: number; tokenB: number; rewards?: Map<string, number> }
  ): Promise<{
    currentValue: number;
    feesEarned: number;
    rewardsEarned: number;
    totalReturn: number;
    apr: number;
    inRange: boolean;
    utilizationRate: number;
    priceRange: PriceRange;
  }> {
    try {
      const pool = await this.getWhirlpool(position.whirlpool);
      
      // Calculate token amounts
      const tokenAmounts = await this.calculateTokenAmounts(
        pool.address,
        position.liquidity,
        position.tickLowerIndex,
        position.tickUpperIndex
      );

      // Calculate current value
      const tokenAUI = tokenAmountToUi(tokenAmounts.tokenA, 6);
      const tokenBUI = tokenAmountToUi(tokenAmounts.tokenB, 9);
      const currentValue = (tokenAUI * prices.tokenA) + (tokenBUI * prices.tokenB);

      // Calculate fees
      const fees = await this.calculateFees(position, pool, prices);

      // Calculate rewards
      let rewardsEarned = 0;
      if (prices.rewards) {
        for (const [index, rewardInfo] of Array.from(position.rewardInfos.entries())) {
          if (rewardInfo.amountOwed && pool.rewardInfos[index]) {
            const rewardPrice = prices.rewards.get(pool.rewardInfos[index].address) || 0;
            const rewardAmount = tokenAmountToUi(rewardInfo.amountOwed, 9);
            rewardsEarned += rewardAmount * rewardPrice;
          }
        }
      }

      // Calculate total return
      const totalReturn = fees.totalFeesUSD + rewardsEarned;

      // Check if in range
      const inRange = pool.tickCurrentIndex >= position.tickLowerIndex && 
                     pool.tickCurrentIndex <= position.tickUpperIndex;

      // Calculate utilization rate
      let utilizationRate = 0;
      if (inRange) {
        utilizationRate = 1;
      } else {
        const rangeTicks = position.tickUpperIndex - position.tickLowerIndex;
        if (pool.tickCurrentIndex < position.tickLowerIndex) {
          const distance = position.tickLowerIndex - pool.tickCurrentIndex;
          utilizationRate = Math.max(0, 1 - (distance / rangeTicks));
        } else {
          const distance = pool.tickCurrentIndex - position.tickUpperIndex;
          utilizationRate = Math.max(0, 1 - (distance / rangeTicks));
        }
      }

      // Calculate price range
      const priceRange = this.calculatePriceRange(
        position.tickLowerIndex,
        position.tickUpperIndex,
        pool.tickCurrentIndex
      );

      // Calculate APR
      const apr = currentValue > 0 ? (totalReturn / currentValue) * 365 * 100 : 0;

      return {
        currentValue,
        feesEarned: fees.totalFeesUSD,
        rewardsEarned,
        totalReturn,
        apr,
        inRange,
        utilizationRate,
        priceRange
      };
    } catch (error) {
      throw new SolanaIntegrationError(
        `Failed to analyze position ${position.address}`,
        'orca-whirlpools',
        'ANALYSIS_ERROR',
        error as Error
      );
    }
  }

  // ============================================================================
  // ADVANCED CALCULATIONS
  // ============================================================================

  /**
   * Calculate impermanent loss for a position
   */
  calculateImpermanentLoss(
    entryPrice: number,
    currentPrice: number,
    tickLower: number,
    tickUpper: number
  ): {
    impermanentLoss: number;
    impermanentLossPercent: number;
  } {
    try {
      // Simplified IL calculation for concentrated liquidity
      const priceRatio = currentPrice / entryPrice;
      const lowerPrice = Math.pow(1.0001, tickLower);
      const upperPrice = Math.pow(1.0001, tickUpper);

      // Check if current price is within range
      const inRange = currentPrice >= lowerPrice && currentPrice <= upperPrice;

      let il = 0;
      if (inRange) {
        // Standard concentrated liquidity IL formula
        const pa = lowerPrice / entryPrice;
        const pb = upperPrice / entryPrice;
        const p = priceRatio;

        if (p <= pa) {
          il = 0; // No IL when out of range on lower side
        } else if (p >= pb) {
          il = 0; // No IL when out of range on upper side
        } else {
          // IL calculation for in-range positions
          const numerator = 2 * Math.sqrt(p * pa) - pa - p;
          const denominator = pa + p;
          il = numerator / denominator;
        }
      }

      return {
        impermanentLoss: il,
        impermanentLossPercent: il * 100
      };
    } catch (error) {
      throw new SolanaIntegrationError(
        'Failed to calculate impermanent loss',
        'orca-whirlpools',
        'CALCULATION_ERROR',
        error as Error
      );
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Convert Orca position to standard format
   */
  convertToStandardPosition(
    positionData: PositionData,
    poolData: WhirlpoolData,
    analysis: any
  ): OrcaPosition {
    const currentTime = Date.now();

    return {
      id: `orca-${positionData.whirlpool}-${positionData.positionMint}`,
      protocol: 'orca-whirlpools',
      chain: 'solana' as any,
      pool: positionData.whirlpool,
      
      liquidity: Number(positionData.liquidity),
      value: analysis.currentValue,
      feesEarned: analysis.feesEarned,
      apr: analysis.apr,
      inRange: analysis.inRange,
      
      tokens: {
        token0: {
          address: poolData.tokenMintA,
          symbol: 'UNKNOWN',
          amount: Number(analysis.tokenAmounts?.tokenA || '0'),
          decimals: 6
        },
        token1: {
          address: poolData.tokenMintB,
          symbol: 'UNKNOWN',
          amount: Number(analysis.tokenAmounts?.tokenB || '0'),
          decimals: 9
        }
      },

      accounts: {
        position: positionData.address,
        mint0: poolData.tokenMintA,
        mint1: poolData.tokenMintB,
      },
      
      programId: this.config.whirlpoolProgramId,
      rewards: [],
      
      // Whirlpool specific
      whirlpool: positionData.whirlpool,
      positionMint: positionData.positionMint,
      tickLowerIndex: positionData.tickLowerIndex,
      tickUpperIndex: positionData.tickUpperIndex,
      rewardInfos: (poolData.rewardInfos || []).map(reward => ({
        ...reward,
        amountOwed: '0' // Default to 0, will be updated from position data
      })),
      
      // Metadata
      lastSlot: 0,
      createdAt: currentTime,
      updatedAt: currentTime
    };
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.whirlpoolsConfigCache.clear();
    this.poolCache.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async fetchWhirlpoolData(address: string): Promise<WhirlpoolData> {
    // This would use the actual Orca SDK to fetch whirlpool data
    // For now, return a mock structure
    return {
      address,
      whirlpoolsConfig: '',
      tokenMintA: '',
      tokenMintB: '',
      tokenVaultA: '',
      tokenVaultB: '',
      tickSpacing: 64,
      tickCurrentIndex: 0,
      sqrtPrice: '0',
      liquidity: '0',
      feeRate: 0.003, // 0.3%
      protocolFeeRate: 0.0001, // 0.01%
      rewardInfos: []
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create Orca SDK wrapper instance
 */
export function createOrcaSDK(context: SolanaContext): OrcaSDKWrapper {
  return new OrcaSDKWrapper({
    connection: context.connection,
    whirlpoolProgramId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    commitment: context.commitment
  });
}

/**
 * Get enhanced position data using SDK
 */
export async function getEnhancedOrcaPosition(
  context: SolanaContext,
  position: OrcaPosition,
  prices: { tokenA: number; tokenB: number; rewards?: Map<string, number> }
): Promise<OrcaPosition & { analysis: any }> {
  try {
    const sdk = createOrcaSDK(context);
    
    const positionData: PositionData = {
      address: position.accounts.position,
      whirlpool: position.whirlpool,
      positionMint: position.positionMint,
      liquidity: position.liquidity.toString(),
      tickLowerIndex: position.tickLowerIndex,
      tickUpperIndex: position.tickUpperIndex,
      feeGrowthCheckpointA: position.feeGrowthInside0LastX64 || '0',
      feeGrowthCheckpointB: position.feeGrowthInside1LastX64 || '0',
      feeOwedA: position.tokensOwed0 || '0',
      feeOwedB: position.tokensOwed1 || '0',
      rewardInfos: position.rewardInfos?.map(r => ({
        growthInsideCheckpoint: r.growthGlobalX64,
        amountOwed: r.amountOwed
      })) || []
    };
    
    const analysis = await sdk.analyzePosition(positionData, prices);
    
    // Update position with analysis results
    position.value = analysis.currentValue;
    position.feesEarned = analysis.feesEarned;
    position.apr = analysis.apr;
    position.inRange = analysis.inRange;
    
    return { ...position, analysis };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to enhance Orca position ${position.id}`,
      'orca-whirlpools',
      'ENHANCEMENT_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  OrcaSDKWrapper,
  createOrcaSDK,
  getEnhancedOrcaPosition,
};