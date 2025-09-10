/**
 * Orca Whirlpool Calculations
 * Advanced calculations for Orca concentrated liquidity positions
 */

import {
  OrcaPosition,
  OrcaPool,
  SolanaCalculationConfig,
  SolanaPositionMetrics,
  SolanaIntegrationError
} from '../common/types';
import {
  tokenAmountToUi,
  uiAmountToToken,
  formatTokenAmount,
  formatPrice
} from '../common/utils';
import { ProtocolType } from '../../../../types';

// ============================================================================
// ORCA CONSTANTS
// ============================================================================

export const ORCA_CONSTANTS = {
  TICK_BASE: 1.0001,
  Q64: Math.pow(2, 64),
  Q128: Math.pow(2, 128),
  MAX_TICK: 443636,
  MIN_TICK: -443636,
  SECONDS_PER_DAY: 86400,
  SECONDS_PER_YEAR: 31536000,
  BASIS_POINT_MAX: 10000,
  FEE_RATE_DENOMINATOR: 1000000,
};

// Common tick spacings used by Orca
export const ORCA_TICK_SPACINGS = {
  STABLE: 1,      // 0.01%
  LOW: 8,         // 0.05%
  MEDIUM: 64,     // 0.3%
  HIGH: 128,      // 1%
  VOLATILE: 256,  // 2%
};

// ============================================================================
// PRICE AND TICK CALCULATIONS
// ============================================================================

/**
 * Convert tick to price
 */
export function tickToPrice(tick: number): number {
  try {
    if (tick < ORCA_CONSTANTS.MIN_TICK || tick > ORCA_CONSTANTS.MAX_TICK) {
      throw new Error(`Tick ${tick} out of bounds`);
    }
    
    return Math.pow(ORCA_CONSTANTS.TICK_BASE, tick);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate price from tick ${tick}`,
      ProtocolType.ORCA,
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Convert price to tick
 */
export function priceToTick(price: number): number {
  try {
    if (price <= 0) {
      throw new Error('Price must be positive');
    }
    
    return Math.floor(Math.log(price) / Math.log(ORCA_CONSTANTS.TICK_BASE));
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate tick from price ${price}`,
      ProtocolType.ORCA,
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Convert sqrt price Q64.64 to regular price
 */
export function sqrtPriceX64ToPrice(sqrtPriceX64: string): number {
  try {
    const sqrtPrice = Number(sqrtPriceX64) / ORCA_CONSTANTS.Q64;
    return sqrtPrice * sqrtPrice;
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to convert sqrt price ${sqrtPriceX64} to price`,
      ProtocolType.ORCA,
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Convert price to sqrt price Q64.64
 */
export function priceToSqrtPriceX64(price: number): string {
  try {
    if (price <= 0) {
      throw new Error('Price must be positive');
    }
    
    const sqrtPrice = Math.sqrt(price);
    return (sqrtPrice * ORCA_CONSTANTS.Q64).toString();
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to convert price ${price} to sqrt price`,
      ProtocolType.ORCA,
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
      ProtocolType.ORCA,
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
      ProtocolType.ORCA,
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
  position: OrcaPosition,
  pool: OrcaPool,
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
      position.tickLowerIndex,
      position.tickUpperIndex,
      pool.tickCurrent || 0
    );
    
    // Convert to UI amounts
    const token0AmountUi = tokenAmountToUi(tokenAmounts.amount0, position.tokens.token0.decimals);
    const token1AmountUi = tokenAmountToUi(tokenAmounts.amount1, position.tokens.token1.decimals);
    
    // Calculate values
    const token0Value = token0AmountUi * prices.token0;
    const token1Value = token1AmountUi * prices.token1;
    const totalValue = token0Value + token1Value;
    
    // Check if in range
    const inRange = (pool.tickCurrent || 0) >= position.tickLowerIndex && 
                   (pool.tickCurrent || 0) <= position.tickUpperIndex;
    
    // Calculate utilization rate
    let utilizationRate = 0;
    if (inRange) {
      utilizationRate = 1; // Full utilization when in range
    } else {
      // Partial utilization based on how far out of range
      const rangeTicks = position.tickUpperIndex - position.tickLowerIndex;
      const currentTick = pool.tickCurrent || 0;
      
      if (currentTick < position.tickLowerIndex) {
        const distance = position.tickLowerIndex - currentTick;
        utilizationRate = Math.max(0, 1 - (distance / rangeTicks));
      } else if (currentTick > position.tickUpperIndex) {
        const distance = currentTick - position.tickUpperIndex;
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
      ProtocolType.ORCA,
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate impermanent loss for concentrated liquidity
 */
export function calculateImpermanentLoss(
  position: OrcaPosition,
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
    
    // Calculate price ranges
    const priceLower = tickToPrice(position.tickLowerIndex);
    const priceUpper = tickToPrice(position.tickUpperIndex);
    
    // Calculate position multiplier for concentrated liquidity
    let positionMultiplier = 1;
    
    if (currentPrice < priceLower) {
      // All token0 - no IL but opportunity cost
      positionMultiplier = entryAmounts.token0 / (entryAmounts.token0 + entryAmounts.token1 / entryPrice);
    } else if (currentPrice > priceUpper) {
      // All token1 - no IL but opportunity cost
      positionMultiplier = (entryAmounts.token1 * entryPrice) / (entryAmounts.token0 * entryPrice + entryAmounts.token1);
    } else {
      // In range - calculate IL
      const priceRatio = currentPrice / entryPrice;
      const pa = priceLower / entryPrice;
      const pb = priceUpper / entryPrice;
      
      // Concentrated liquidity IL formula
      const numerator = 2 * Math.sqrt(priceRatio * pa) - pa - priceRatio;
      const denominator = pa + priceRatio;
      positionMultiplier = 1 + (numerator / denominator);
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
      ProtocolType.ORCA,
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
  position: OrcaPosition,
  pool: OrcaPool,
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
      position.tokensOwed0 || '0',
      position.tokens.token0.decimals
    );
    const feesToken1Ui = tokenAmountToUi(
      position.tokensOwed1 || '0',
      position.tokens.token1.decimals
    );
    
    // Calculate fee values in USD
    const feesToken0 = feesToken0Ui * prices.token0;
    const feesToken1 = feesToken1Ui * prices.token1;
    const totalFees = feesToken0 + feesToken1;
    
    // Estimate daily fees based on position age
    const positionAge = (Date.now() - position.createdAt) / (1000 * 60 * 60 * 24);
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
      ProtocolType.ORCA,
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate expected fee earnings based on pool activity
 */
export function calculateExpectedFees(
  position: OrcaPosition,
  pool: OrcaPool,
  volume24h: number,
  tvl: number
): {
  expectedDailyFees: number;
  expectedAPR: number;
  feeMultiplier: number;
} {
  try {
    // Calculate position's share of liquidity
    const positionLiquidity = Number(position.liquidity);
    const poolLiquidity = Number(pool.liquidity);
    const liquidityShare = poolLiquidity > 0 ? positionLiquidity / poolLiquidity : 0;
    
    // Calculate fee tier
    const feeRate = pool.feeRate || 0.003; // Default 0.3%
    
    // Estimate daily fees from volume
    const poolDailyFees = volume24h * feeRate;
    const expectedDailyFees = poolDailyFees * liquidityShare;
    
    // Calculate position value for APR
    const positionValue = calculatePositionValue(position, pool, { token0: 1, token1: 1 });
    const expectedAPR = positionValue.totalValue > 0 
      ? (expectedDailyFees / positionValue.totalValue) * 365 * 100
      : 0;
    
    // Calculate fee multiplier based on range efficiency
    const currentTick = pool.tickCurrent || 0;
    const inRange = currentTick >= position.tickLowerIndex && currentTick <= position.tickUpperIndex;
    const feeMultiplier = inRange ? 1 : 0; // Simplified - actual calculation is more complex
    
    return {
      expectedDailyFees: expectedDailyFees * feeMultiplier,
      expectedAPR: expectedAPR * feeMultiplier,
      feeMultiplier
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate expected fees for position ${position.id}`,
      ProtocolType.ORCA,
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
  position: OrcaPosition,
  pool: OrcaPool,
  rewardPrices: Map<string, number>
): {
  totalRewardValue: number;
  rewardBreakdown: Array<{
    mint: string;
    amount: string;
    value: number;
    apr?: number;
    emissionRate?: number;
  }>;
  rewardAPR: number;
} {
  try {
    const rewardBreakdown = position.rewardInfos?.map((reward, index) => {
      const poolReward = pool.rewardInfos?.[index];
      const mint = poolReward?.mint || '';
      const price = rewardPrices.get(mint) || 0;
      const amountUi = tokenAmountToUi(reward.amountOwed, 9); // Assume 9 decimals
      const value = amountUi * price;

      // Calculate emission rate if available
      let emissionRate = 0;
      let apr = 0;
      
      if (poolReward && poolReward.emissionsPerSecondX64) {
        const emissionsPerSecond = Number(poolReward.emissionsPerSecondX64) / ORCA_CONSTANTS.Q64;
        emissionRate = emissionsPerSecond * ORCA_CONSTANTS.SECONDS_PER_DAY;
        
        // Calculate APR based on emissions and position share
        const positionValue = calculatePositionValue(position, pool, { token0: 1, token1: 1 });
        if (positionValue.totalValue > 0) {
          const dailyRewardValue = emissionRate * price;
          apr = (dailyRewardValue / positionValue.totalValue) * 365 * 100;
        }
      }

      return {
        mint,
        amount: reward.amountOwed,
        value,
        apr,
        emissionRate
      };
    }) || [];

    const totalRewardValue = rewardBreakdown.reduce((sum, reward) => sum + reward.value, 0);
    const rewardAPR = rewardBreakdown.reduce((sum, reward) => sum + (reward.apr || 0), 0);
    
    return {
      totalRewardValue,
      rewardBreakdown,
      rewardAPR
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate rewards for position ${position.id}`,
      ProtocolType.ORCA,
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
  position: OrcaPosition,
  pool: OrcaPool,
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
    const priceLower = tickToPrice(position.tickLowerIndex);
    const priceUpper = tickToPrice(position.tickUpperIndex);
    const currentPrice = tickToPrice(pool.tickCurrent || 0);
    const priceRange = (priceUpper - priceLower) / currentPrice;
    const concentrationRisk = Math.max(0, Math.min(1, 1 / (1 + priceRange)));

    // Liquidity risk - based on pool TVL and volume
    let liquidityRisk = 0.5; // Default medium risk
    if (marketData) {
      const volumeToLiquidityRatio = marketData.volume24h / marketData.liquidity;
      liquidityRisk = Math.min(volumeToLiquidityRatio / 2, 1);
    }

    // Price risk - based on volatility
    let priceRisk = 0.5; // Default medium risk
    if (marketData) {
      priceRisk = Math.min(marketData.volatility24h / 100, 1);
    }

    // Range risk - likelihood of going out of range
    const currentTick = pool.tickCurrent || 0;
    const tickRange = position.tickUpperIndex - position.tickLowerIndex;
    const distanceToLower = Math.abs(currentTick - position.tickLowerIndex);
    const distanceToUpper = Math.abs(currentTick - position.tickUpperIndex);
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
      ProtocolType.ORCA,
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// COMPREHENSIVE POSITION METRICS
// ============================================================================

/**
 * Calculate comprehensive Orca position metrics
 */
export function calculateOrcaPositionMetrics(
  position: OrcaPosition,
  pool: OrcaPool,
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
  orca: {
    tickRange: { lower: number; upper: number; current: number };
    priceRange: { lower: number; upper: number; current: number };
    liquidity: string;
    inRange: boolean;
    utilizationRate: number;
    tickSpacing: number;
    feeRate: number;
    fees: {
      totalFees: number;
      feesToken0: number;
      feesToken1: number;
      feeAPR: number;
      expectedDailyFees: number;
      expectedAPR: number;
    };
    rewards: {
      totalRewardValue: number;
      rewardAPR: number;
      rewardBreakdown: Array<{
        mint: string;
        amount: string;
        value: number;
        apr?: number;
      }>;
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
    const expectedFees = calculateExpectedFees(
      position,
      pool,
      marketData?.volume24h || 0,
      marketData?.liquidity || 0
    );
    
    // Calculate rewards
    const rewardData = calculateRewards(position, pool, prices.rewards);
    
    // Calculate risk metrics
    const riskMetrics = calculateRiskMetrics(position, pool, prices, marketData);
    
    // Calculate age in days
    const ageInDays = (Date.now() - position.createdAt) / (1000 * 60 * 60 * 24);

    // Calculate price ranges
    const priceLower = tickToPrice(position.tickLowerIndex);
    const priceUpper = tickToPrice(position.tickUpperIndex);
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
      lastRewardClaim: position.updatedAt,

      // Orca-specific metrics
      orca: {
        tickRange: {
          lower: position.tickLowerIndex,
          upper: position.tickUpperIndex,
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
        tickSpacing: pool.tickSpacing || 64,
        feeRate: pool.feeRate || 0.003,
        fees: {
          totalFees: feeData.totalFees,
          feesToken0: feeData.feesToken0,
          feesToken1: feeData.feesToken1,
          feeAPR: feeData.feeAPR,
          expectedDailyFees: expectedFees.expectedDailyFees,
          expectedAPR: expectedFees.expectedAPR
        },
        rewards: {
          totalRewardValue: rewardData.totalRewardValue,
          rewardAPR: rewardData.rewardAPR,
          rewardBreakdown: rewardData.rewardBreakdown
        },
        risk: riskMetrics
      }
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate comprehensive metrics for position ${position.id}`,
      ProtocolType.ORCA,
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format Orca position data for display
 */
export function formatOrcaPosition(
  position: OrcaPosition,
  metrics: ReturnType<typeof calculateOrcaPositionMetrics>
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
    const summary = `${metrics.orca.inRange ? 'In Range' : 'Out of Range'} Whirlpool position earning ${
      metrics.totalAPR.toFixed(2)
    }% APR`;

    const details = [
      { label: 'Total Value', value: formatPrice(metrics.totalValue) },
      { label: 'Total APR', value: `${metrics.totalAPR.toFixed(2)}%` },
      { label: 'Fee APR', value: `${metrics.feeAPR.toFixed(2)}%` },
      { label: 'Reward APR', value: `${metrics.rewardAPR.toFixed(2)}%` },
      { label: 'Liquidity', value: formatTokenAmount(metrics.orca.liquidity, 18) },
      { label: 'Utilization', value: `${(metrics.orca.utilizationRate * 100).toFixed(1)}%` },
      { label: 'Risk Level', value: metrics.orca.risk.overallRisk },
      { label: 'Fee Rate', value: `${(metrics.orca.feeRate * 100).toFixed(3)}%` },
    ];

    const rangeInfo = {
      inRange: metrics.orca.inRange,
      currentTick: metrics.orca.tickRange.current,
      tickRange: `${metrics.orca.tickRange.lower} to ${metrics.orca.tickRange.upper}`,
      priceRange: `${formatPrice(metrics.orca.priceRange.lower)} - ${formatPrice(metrics.orca.priceRange.upper)}`,
      utilizationRate: `${(metrics.orca.utilizationRate * 100).toFixed(1)}%`
    };

    return {
      summary,
      details,
      rangeInfo
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to format position ${position.id}`,
      ProtocolType.ORCA,
      'FORMAT_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ORCA_CONSTANTS,
  ORCA_TICK_SPACINGS,
  tickToPrice,
  priceToTick,
  sqrtPriceX64ToPrice,
  priceToSqrtPriceX64,
  calculateTokenAmounts,
  calculateLiquidityFromAmounts,
  calculatePositionValue,
  calculateImpermanentLoss,
  calculateFeesEarned,
  calculateExpectedFees,
  calculateRewards,
  calculateRiskMetrics,
  calculateOrcaPositionMetrics,
  formatOrcaPosition,
};