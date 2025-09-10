/**
 * Raydium CLMM Calculations
 * Advanced calculations for Raydium concentrated liquidity positions
 */

import {
  RaydiumPosition,
  RaydiumPool,
  SolanaCalculationConfig,
  SolanaPositionMetrics,
  SolanaIntegrationError
} from '../common/types';
import {
  tokenAmountToUi,
  uiAmountToToken,
  tickToSqrtPrice,
  sqrtPriceToTick,
  formatTokenAmount,
  formatPrice
} from '../common/utils';
import { ProtocolType } from '../../../../types';

// ============================================================================
// RAYDIUM CLMM CONSTANTS
// ============================================================================

export const RAYDIUM_CONSTANTS = {
  Q64: Math.pow(2, 64),
  Q128: Math.pow(2, 128),
  TICK_BASE: 1.0001,
  MAX_TICK: 887272,
  MIN_TICK: -887272,
  SECONDS_PER_DAY: 86400,
  SECONDS_PER_YEAR: 31536000,
  BASIS_POINT_MAX: 10000,
  FEE_PRECISION: 1000000,
};

// ============================================================================
// SQRT PRICE AND TICK CALCULATIONS
// ============================================================================

/**
 * Convert tick to sqrt price (Q64.64 format)
 */
export function tickToSqrtPriceX64(tick: number): string {
  try {
    if (tick < RAYDIUM_CONSTANTS.MIN_TICK || tick > RAYDIUM_CONSTANTS.MAX_TICK) {
      throw new Error(`Tick ${tick} out of bounds`);
    }
    
    const sqrtPrice = Math.sqrt(Math.pow(RAYDIUM_CONSTANTS.TICK_BASE, tick));
    return (sqrtPrice * RAYDIUM_CONSTANTS.Q64).toString();
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to convert tick ${tick} to sqrt price`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Convert sqrt price (Q64.64) to tick
 */
export function sqrtPriceX64ToTick(sqrtPriceX64: string): number {
  try {
    const sqrtPrice = Number(sqrtPriceX64) / RAYDIUM_CONSTANTS.Q64;
    const price = sqrtPrice * sqrtPrice;
    const tick = Math.log(price) / Math.log(RAYDIUM_CONSTANTS.TICK_BASE);
    
    return Math.floor(tick);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to convert sqrt price ${sqrtPriceX64} to tick`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate price from tick
 */
export function tickToPrice(tick: number): number {
  try {
    return Math.pow(RAYDIUM_CONSTANTS.TICK_BASE, tick);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate price from tick ${tick}`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate tick from price
 */
export function priceToTick(price: number): number {
  try {
    if (price <= 0) {
      throw new Error('Price must be positive');
    }
    
    return Math.floor(Math.log(price) / Math.log(RAYDIUM_CONSTANTS.TICK_BASE));
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate tick from price ${price}`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// LIQUIDITY CALCULATIONS
// ============================================================================

/**
 * Calculate token amounts from liquidity and tick range
 */
export function calculateTokenAmounts(
  liquidity: string,
  tickLower: number,
  tickUpper: number,
  tickCurrent: number
): { amount0: string; amount1: string } {
  try {
    const liquidityNum = Number(liquidity);
    
    if (liquidityNum === 0) {
      return { amount0: '0', amount1: '0' };
    }
    
    const sqrtPriceLower = Math.sqrt(tickToPrice(tickLower));
    const sqrtPriceUpper = Math.sqrt(tickToPrice(tickUpper));
    const sqrtPriceCurrent = Math.sqrt(tickToPrice(tickCurrent));
    
    let amount0 = 0;
    let amount1 = 0;
    
    if (tickCurrent < tickLower) {
      // Position is entirely in token0
      amount0 = liquidityNum * (sqrtPriceUpper - sqrtPriceLower) / (sqrtPriceUpper * sqrtPriceLower);
    } else if (tickCurrent >= tickUpper) {
      // Position is entirely in token1
      amount1 = liquidityNum * (sqrtPriceUpper - sqrtPriceLower);
    } else {
      // Position spans current tick
      amount0 = liquidityNum * (sqrtPriceUpper - sqrtPriceCurrent) / (sqrtPriceUpper * sqrtPriceCurrent);
      amount1 = liquidityNum * (sqrtPriceCurrent - sqrtPriceLower);
    }
    
    return {
      amount0: Math.floor(amount0).toString(),
      amount1: Math.floor(amount1).toString()
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      'Failed to calculate token amounts from liquidity',
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate liquidity from token amounts
 */
export function calculateLiquidityFromAmounts(
  amount0: string,
  amount1: string,
  tickLower: number,
  tickUpper: number,
  tickCurrent: number
): string {
  try {
    const amount0Num = Number(amount0);
    const amount1Num = Number(amount1);
    
    const sqrtPriceLower = Math.sqrt(tickToPrice(tickLower));
    const sqrtPriceUpper = Math.sqrt(tickToPrice(tickUpper));
    const sqrtPriceCurrent = Math.sqrt(tickToPrice(tickCurrent));
    
    let liquidity = 0;
    
    if (tickCurrent < tickLower) {
      // Only token0
      liquidity = amount0Num * sqrtPriceLower * sqrtPriceUpper / (sqrtPriceUpper - sqrtPriceLower);
    } else if (tickCurrent >= tickUpper) {
      // Only token1
      liquidity = amount1Num / (sqrtPriceUpper - sqrtPriceLower);
    } else {
      // Both tokens - use minimum of the two
      const liquidity0 = amount0Num * sqrtPriceCurrent * sqrtPriceUpper / (sqrtPriceUpper - sqrtPriceCurrent);
      const liquidity1 = amount1Num / (sqrtPriceCurrent - sqrtPriceLower);
      liquidity = Math.min(liquidity0, liquidity1);
    }
    
    return Math.floor(liquidity).toString();
  } catch (error) {
    throw new SolanaIntegrationError(
      'Failed to calculate liquidity from token amounts',
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// POSITION VALUE CALCULATIONS
// ============================================================================

/**
 * Calculate position value with current prices
 */
export function calculatePositionValue(
  position: RaydiumPosition,
  pool: RaydiumPool,
  prices: { token0: number; token1: number }
): {
  totalValue: number;
  token0Value: number;
  token1Value: number;
  inRange: boolean;
  utilizationRate: number;
} {
  try {
    // Calculate actual token amounts based on current pool state
    const tokenAmounts = calculateTokenAmounts(
      position.liquidity.toString(),
      position.tickLower || 0,
      position.tickUpper || 0,
      pool.tickCurrent || 0
    );
    
    // Convert to UI amounts
    const token0AmountUi = tokenAmountToUi(tokenAmounts.amount0, position.tokens.token0.decimals || 9);
    const token1AmountUi = tokenAmountToUi(tokenAmounts.amount1, position.tokens.token1.decimals || 9);
    
    // Calculate values
    const token0Value = token0AmountUi * prices.token0;
    const token1Value = token1AmountUi * prices.token1;
    const totalValue = token0Value + token1Value;
    
    // Check if in range
    const inRange = (pool.tickCurrent || 0) >= (position.tickLower || 0) && 
                   (pool.tickCurrent || 0) <= (position.tickUpper || 0);
    
    // Calculate utilization rate (how much of the range is being used)
    let utilizationRate = 0;
    if (inRange) {
      utilizationRate = 1; // Full utilization when in range
    } else {
      // Partial utilization based on how far out of range
      const rangeTicks = (position.tickUpper || 0) - (position.tickLower || 0);
      const currentTick = pool.tickCurrent || 0;
      
      if (currentTick < (position.tickLower || 0)) {
        const distance = (position.tickLower || 0) - currentTick;
        utilizationRate = Math.max(0, 1 - (distance / rangeTicks));
      } else if (currentTick > (position.tickUpper || 0)) {
        const distance = currentTick - (position.tickUpper || 0);
        utilizationRate = Math.max(0, 1 - (distance / rangeTicks));
      }
    }
    
    return {
      totalValue,
      token0Value,
      token1Value,
      inRange,
      utilizationRate
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate position value for ${position.id}`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate impermanent loss
 */
export function calculateImpermanentLoss(
  position: RaydiumPosition,
  entryPrice: number,
  currentPrice: number,
  entryAmounts: { token0: number; token1: number }
): {
  impermanentLoss: number;
  impermanentLossPercent: number;
  holdValue: number;
  positionValue: number;
} {
  try {
    // Calculate what the position would be worth if we just held the tokens
    const holdValue = (entryAmounts.token0 * currentPrice) + entryAmounts.token1;
    
    // Calculate current position value (simplified - would need full calculation)
    const priceRatio = currentPrice / entryPrice;
    let positionMultiplier: number;
    
    // Simplified impermanent loss calculation for concentrated liquidity
    // Real calculation would need to consider the specific tick range
    if (priceRatio > 1) {
      positionMultiplier = 2 * Math.sqrt(priceRatio) / (1 + priceRatio);
    } else {
      positionMultiplier = 2 * Math.sqrt(priceRatio) / (1 + priceRatio);
    }
    
    const positionValue = holdValue * positionMultiplier;
    const impermanentLoss = holdValue - positionValue;
    const impermanentLossPercent = holdValue > 0 ? (impermanentLoss / holdValue) * 100 : 0;
    
    return {
      impermanentLoss,
      impermanentLossPercent,
      holdValue,
      positionValue
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate impermanent loss for position ${position.id}`,
      'raydium-clmm',
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
export function calculateFeesEarned(
  position: RaydiumPosition,
  pool: RaydiumPool,
  prices: { token0: number; token1: number }
): {
  totalFees: number;
  feesToken0: number;
  feesToken1: number;
  feesToken0Ui: number;
  feesToken1Ui: number;
  feeAPR: number;
  dailyFees: number;
} {
  try {
    // Calculate unclaimed fees in UI amounts
    const feesToken0Ui = tokenAmountToUi(
      position.feeOwedA || position.tokensOwed0 || '0',
      position.tokens.token0.decimals || 9
    );
    const feesToken1Ui = tokenAmountToUi(
      position.feeOwedB || position.tokensOwed1 || '0',
      position.tokens.token1.decimals || 9
    );
    
    // Calculate fee values in USD
    const feesToken0 = feesToken0Ui * prices.token0;
    const feesToken1 = feesToken1Ui * prices.token1;
    const totalFees = feesToken0 + feesToken1;
    
    // Estimate daily fees (would need historical data for accurate calculation)
    const positionAge = (Date.now() - (position.createdAt ? new Date(position.createdAt).getTime() : Date.now())) / (1000 * 60 * 60 * 24);
    const dailyFees = positionAge > 0 ? totalFees / positionAge : 0;
    
    // Calculate fee APR
    const positionValue = calculatePositionValue(position, pool, prices);
    const feeAPR = positionValue.totalValue > 0 && dailyFees > 0
      ? (dailyFees / positionValue.totalValue) * 365 * 100
      : 0;
    
    return {
      totalFees,
      feesToken0,
      feesToken1,
      feesToken0Ui,
      feesToken1Ui,
      feeAPR,
      dailyFees
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate fees for position ${position.id}`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate fee growth and accumulation
 */
export function calculateFeeGrowth(
  position: RaydiumPosition,
  pool: RaydiumPool,
  tickArrays?: Array<{
    startTickIndex: number;
    ticks: Array<{
      tick: number;
      feeGrowthOutside0: string;
      feeGrowthOutside1: string;
    }>;
  }>
): {
  feeGrowthInside0: string;
  feeGrowthInside1: string;
  accruedFees0: string;
  accruedFees1: string;
} {
  try {
    // This would require access to tick data for accurate calculation
    // For now, return the stored values
    const feeGrowthInside0 = position.feeGrowthInsideLastA || position.feeGrowthInside0LastX64 || '0';
    const feeGrowthInside1 = position.feeGrowthInsideLastB || position.feeGrowthInside1LastX64 || '0';
    
    // Calculate accrued fees since last collection
    // This would need the current pool fee growth values
    const accruedFees0 = position.feeOwedA || position.tokensOwed0 || '0';
    const accruedFees1 = position.feeOwedB || position.tokensOwed1 || '0';
    
    return {
      feeGrowthInside0,
      feeGrowthInside1,
      accruedFees0,
      accruedFees1
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate fee growth for position ${position.id}`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// REWARD CALCULATIONS
// ============================================================================

/**
 * Calculate rewards for a position
 */
export function calculateRewards(
  position: RaydiumPosition,
  rewardPrices: Map<string, number>
): {
  totalRewardValue: number;
  rewardBreakdown: Array<{
    address: string;
    amount: string;
    value: number;
    apr?: number;
  }>;
  rewardAPR: number;
} {
  try {
    const rewardBreakdown = position.rewardInfos?.map(reward => {
      const price = rewardPrices.get(reward.rewardMint) || 0;
      const amountUi = tokenAmountToUi(reward.rewardAmountOwed, 9); // Assume 9 decimals
      const value = amountUi * price;

      return {
        address: reward.rewardMint,
        amount: reward.rewardAmountOwed,
        value,
        // APR calculation would need emission rates and time data
        apr: undefined
      };
    }) || [];

    const totalRewardValue = rewardBreakdown.reduce((sum, reward) => sum + reward.value, 0);
    
    // Calculate aggregate reward APR (simplified)
    const rewardAPR = 0; // Would need emission rates and position value
    
    return {
      totalRewardValue,
      rewardBreakdown,
      rewardAPR
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate rewards for position ${position.id}`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// RISK CALCULATIONS
// ============================================================================

/**
 * Calculate position risk metrics
 */
export function calculateRiskMetrics(
  position: RaydiumPosition,
  pool: RaydiumPool,
  prices: { token0: number; token1: number },
  marketData?: {
    volatility24h: number;
    volume24h: number;
    liquidity: number;
  }
): {
  concentrationRisk: number;
  liquidityRisk: number;
  priceRisk: number;
  rangeRisk: number;
  overallRisk: 'low' | 'medium' | 'high' | 'extreme';
} {
  try {
    // Concentration risk - how narrow is the price range
    const priceLower = tickToPrice(position.tickLower || 0);
    const priceUpper = tickToPrice(position.tickUpper || 0);
    const currentPrice = tickToPrice(pool.tickCurrent || 0);
    const priceRange = (priceUpper - priceLower) / currentPrice;
    const concentrationRisk = Math.max(0, Math.min(1, 1 / (1 + priceRange)));

    // Liquidity risk - based on pool TVL and volume
    let liquidityRisk = 0.5; // Default medium risk
    if (marketData) {
      const volumeToLiquidityRatio = marketData.volume24h / marketData.liquidity;
      liquidityRisk = Math.min(volumeToLiquidityRatio / 2, 1); // Cap at 1
    }

    // Price risk - based on volatility
    let priceRisk = 0.5; // Default medium risk
    if (marketData) {
      priceRisk = Math.min(marketData.volatility24h / 100, 1);
    }

    // Range risk - how likely is the position to go out of range
    const currentTick = pool.tickCurrent || 0;
    const tickRange = (position.tickUpper || 0) - (position.tickLower || 0);
    const distanceToLower = Math.abs(currentTick - (position.tickLower || 0));
    const distanceToUpper = Math.abs(currentTick - (position.tickUpper || 0));
    const minDistance = Math.min(distanceToLower, distanceToUpper);
    const rangeRisk = Math.max(0, 1 - (minDistance / tickRange));

    // Overall risk assessment
    const risks = [concentrationRisk, liquidityRisk, priceRisk, rangeRisk];
    const avgRisk = risks.reduce((sum, risk) => sum + risk, 0) / risks.length;
    
    let overallRisk: 'low' | 'medium' | 'high' | 'extreme';
    if (avgRisk < 0.25) {
      overallRisk = 'low';
    } else if (avgRisk < 0.5) {
      overallRisk = 'medium';
    } else if (avgRisk < 0.75) {
      overallRisk = 'high';
    } else {
      overallRisk = 'extreme';
    }

    return {
      concentrationRisk,
      liquidityRisk,
      priceRisk,
      rangeRisk,
      overallRisk
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate risk metrics for position ${position.id}`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// COMPREHENSIVE POSITION METRICS
// ============================================================================

/**
 * Calculate comprehensive position metrics
 */
export function calculateRaydiumPositionMetrics(
  position: RaydiumPosition,
  pool: RaydiumPool,
  prices: {
    token0: number;
    token1: number;
    rewards: Map<string, number>;
  },
  marketData?: {
    volatility24h: number;
    volume24h: number;
    liquidity: number;
  }
): SolanaPositionMetrics & {
  raydium: {
    tickRange: { lower: number; upper: number; current: number };
    priceRange: { lower: number; upper: number; current: number };
    liquidity: string;
    inRange: boolean;
    utilizationRate: number;
    fees: {
      totalFees: number;
      feesToken0: number;
      feesToken1: number;
      feeAPR: number;
      dailyFees: number;
    };
    rewards: {
      totalRewardValue: number;
      rewardAPR: number;
    };
    risk: {
      concentrationRisk: number;
      liquidityRisk: number;
      priceRisk: number;
      rangeRisk: number;
      overallRisk: 'low' | 'medium' | 'high' | 'extreme';
    };
  };
} {
  try {
    // Calculate position value
    const positionValue = calculatePositionValue(position, pool, prices);
    
    // Calculate fees
    const feeData = calculateFeesEarned(position, pool, prices);
    
    // Calculate rewards
    const rewardData = calculateRewards(position, prices.rewards);
    
    // Calculate risk metrics
    const riskMetrics = calculateRiskMetrics(position, pool, prices, marketData);
    
    // Calculate age in days
    const ageInDays = (Date.now() - (position.createdAt ? new Date(position.createdAt).getTime() : Date.now())) / (1000 * 60 * 60 * 24);

    // Calculate price ranges
    const priceLower = tickToPrice(position.tickLower || 0);
    const priceUpper = tickToPrice(position.tickUpper || 0);
    const currentPrice = tickToPrice(pool.tickCurrent || 0);

    return {
      // Standard metrics
      totalValue: positionValue.totalValue,
      token0Value: positionValue.token0Value,
      token1Value: positionValue.token1Value,
      totalFeesEarned: feeData.totalFees,
      fees24h: feeData.dailyFees,
      feeAPR: feeData.feeAPR,
      totalRewardsEarned: rewardData.totalRewardValue,
      rewards24h: 0, // Would need historical data
      rewardAPR: rewardData.rewardAPR,
      totalAPR: feeData.feeAPR + rewardData.rewardAPR,
      impermanentLoss: 0, // Would need entry price data
      impermanentLossPercent: 0,
      utilizationRate: positionValue.utilizationRate,
      concentrationRisk: riskMetrics.concentrationRisk,
      priceRange: {
        lower: priceLower,
        upper: priceUpper,
        current: currentPrice,
        inRange: positionValue.inRange
      },
      ageInDays,
      lastActiveSlot: position.lastSlot,
      lastRewardClaim: position.updatedAt ? new Date(position.updatedAt).getTime() : Date.now(),

      // Raydium-specific metrics
      raydium: {
        tickRange: {
          lower: position.tickLower || 0,
          upper: position.tickUpper || 0,
          current: pool.tickCurrent || 0
        },
        priceRange: {
          lower: priceLower,
          upper: priceUpper,
          current: currentPrice
        },
        liquidity: position.liquidity.toString(),
        inRange: positionValue.inRange,
        utilizationRate: positionValue.utilizationRate,
        fees: {
          totalFees: feeData.totalFees,
          feesToken0: feeData.feesToken0,
          feesToken1: feeData.feesToken1,
          feeAPR: feeData.feeAPR,
          dailyFees: feeData.dailyFees
        },
        rewards: {
          totalRewardValue: rewardData.totalRewardValue,
          rewardAPR: rewardData.rewardAPR
        },
        risk: riskMetrics
      }
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate comprehensive metrics for position ${position.id}`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format Raydium-specific position data for display
 */
export function formatRaydiumPosition(
  position: RaydiumPosition,
  metrics: ReturnType<typeof calculateRaydiumPositionMetrics>
): {
  summary: string;
  details: Array<{ label: string; value: string }>;
  rangeInfo: {
    inRange: boolean;
    currentTick: number;
    tickRange: string;
    priceRange: string;
    utilizationRate: string;
  };
} {
  try {
    const summary = `${metrics.raydium.inRange ? 'In Range' : 'Out of Range'} position with ${
      metrics.feeAPR.toFixed(2)
    }% APR`;

    const details = [
      { label: 'Total Value', value: formatPrice(metrics.totalValue) },
      { label: 'Fee APR', value: `${metrics.feeAPR.toFixed(2)}%` },
      { label: 'Liquidity', value: formatTokenAmount(metrics.raydium.liquidity, 18) },
      { label: 'Utilization', value: `${(metrics.raydium.utilizationRate * 100).toFixed(1)}%` },
      { label: 'Risk Level', value: metrics.raydium.risk.overallRisk },
      { label: 'Unclaimed Fees 0', value: formatTokenAmount(position.feeOwedA || '0', position.tokens.token0.decimals || 9) },
      { label: 'Unclaimed Fees 1', value: formatTokenAmount(position.feeOwedB || '0', position.tokens.token1.decimals || 9) },
    ];

    const rangeInfo = {
      inRange: metrics.raydium.inRange,
      currentTick: metrics.raydium.tickRange.current,
      tickRange: `${metrics.raydium.tickRange.lower} to ${metrics.raydium.tickRange.upper}`,
      priceRange: `${formatPrice(metrics.raydium.priceRange.lower)} - ${formatPrice(metrics.raydium.priceRange.upper)}`,
      utilizationRate: `${(metrics.raydium.utilizationRate * 100).toFixed(1)}%`
    };

    return {
      summary,
      details,
      rangeInfo
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to format position ${position.id}`,
      'raydium-clmm',
      'FORMAT_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  RAYDIUM_CONSTANTS,
  tickToSqrtPriceX64,
  sqrtPriceX64ToTick,
  tickToPrice,
  priceToTick,
  calculateTokenAmounts,
  calculateLiquidityFromAmounts,
  calculatePositionValue,
  calculateImpermanentLoss,
  calculateFeesEarned,
  calculateFeeGrowth,
  calculateRewards,
  calculateRiskMetrics,
  calculateRaydiumPositionMetrics,
  formatRaydiumPosition,
};