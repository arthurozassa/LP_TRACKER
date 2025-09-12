/**
 * Meteora DLMM Calculations
 * Advanced calculations for Meteora positions, fees, APR, and risk metrics
 */

import {
  MeteoraPosition,
  MeteoraPool,
  SolanaCalculationConfig,
  SolanaPositionMetrics,
  SolanaIntegrationError
} from '../common/types';
import {
  tokenAmountToUi,
  uiAmountToToken,
  calculatePrice,
  formatTokenAmount,
  formatPrice
} from '../common/utils';
import { ProtocolType } from '../../../../types';

// ============================================================================
// METEORA DLMM CONSTANTS
// ============================================================================

export const METEORA_CONSTANTS = {
  BASIS_POINT_MAX: 10000,
  SECONDS_PER_DAY: 86400,
  SECONDS_PER_YEAR: 31536000,
  BIN_PRICE_BASE: 1.0001, // Price multiplier per bin step
  MAX_BIN_STEP: 1000,
  MIN_BIN_STEP: 1,
  MAX_FEE_BPS: 1000, // 10%
  PRECISION_DECIMALS: 18,
};

// ============================================================================
// PRICE CALCULATIONS
// ============================================================================

/**
 * Calculate bin price from bin ID
 */
export function calculateBinPrice(binId: number, binStep: number = 1): number {
  try {
    const adjustedBinId = binId * binStep;
    return Math.pow(METEORA_CONSTANTS.BIN_PRICE_BASE, adjustedBinId);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate bin price for binId ${binId}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate bin ID from price
 */
export function calculateBinIdFromPrice(price: number, binStep: number = 1): number {
  try {
    if (price <= 0) {
      throw new Error('Price must be positive');
    }
    
    const binId = Math.floor(
      Math.log(price) / Math.log(METEORA_CONSTANTS.BIN_PRICE_BASE) / binStep
    );
    
    return binId;
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate bin ID from price ${price}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate price range for a position
 */
export function calculatePositionPriceRange(
  position: MeteoraPosition
): { minPrice: number; maxPrice: number; currentPrice: number } {
  try {
    if (position.binPositions.length === 0) {
      return { minPrice: 0, maxPrice: 0, currentPrice: 0 };
    }

    const binPrices = position.binPositions.map(bin => bin.price);
    const minPrice = Math.min(...binPrices);
    const maxPrice = Math.max(...binPrices);
    
    // Current price is typically at the active bin
    const activeBin = position.binPositions.find(
      bin => bin.binId === position.activeId
    );
    const currentPrice = activeBin?.price || calculateBinPrice(position.activeId, position.binStep);

    return { minPrice, maxPrice, currentPrice };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate price range for position ${position.id}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// LIQUIDITY CALCULATIONS
// ============================================================================

/**
 * Calculate total liquidity across all bins
 */
export function calculateTotalLiquidity(position: MeteoraPosition): string {
  try {
    const totalLiquidity = position.binPositions.reduce(
      (sum, bin) => sum + Number(bin.liquidity),
      0
    );
    
    return totalLiquidity.toString();
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate total liquidity for position ${position.id}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate liquidity distribution across bins
 */
export function calculateLiquidityDistribution(
  position: MeteoraPosition
): Array<{ binId: number; percentage: number; price: number; liquidity: string }> {
  try {
    const totalLiquidity = Number(calculateTotalLiquidity(position));
    
    if (totalLiquidity === 0) {
      return [];
    }

    return position.binPositions.map(bin => ({
      binId: bin.binId,
      percentage: (Number(bin.liquidity) / totalLiquidity) * 100,
      price: bin.price,
      liquidity: bin.liquidity
    }));
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate liquidity distribution for position ${position.id}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// VALUE CALCULATIONS
// ============================================================================

/**
 * Calculate position value with current prices
 */
export function calculatePositionValue(
  position: MeteoraPosition,
  tokenXPrice: number,
  tokenYPrice: number
): {
  totalValue: number;
  tokenXValue: number;
  tokenYValue: number;
  binValues: Array<{ binId: number; value: number; tokenXValue: number; tokenYValue: number }>;
} {
  try {
    const binValues = position.binPositions.map(bin => {
      const tokenXValueUi = tokenAmountToUi(bin.xAmount, position.tokens.token0.decimals || 9);
      const tokenYValueUi = tokenAmountToUi(bin.yAmount, position.tokens.token1.decimals || 9);
      
      const tokenXValue = tokenXValueUi * tokenXPrice;
      const tokenYValue = tokenYValueUi * tokenYPrice;
      const value = tokenXValue + tokenYValue;

      return {
        binId: bin.binId,
        value,
        tokenXValue,
        tokenYValue
      };
    }, 'Logger message');

    const tokenXValue = binValues.reduce((sum, bin) => sum + bin.tokenXValue, 0);
    const tokenYValue = binValues.reduce((sum, bin) => sum + bin.tokenYValue, 0);
    const totalValue = tokenXValue + tokenYValue;

    return {
      totalValue,
      tokenXValue,
      tokenYValue,
      binValues
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate position value for ${position.id}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate impermanent loss vs holding
 */
export function calculateImpermanentLoss(
  position: MeteoraPosition,
  entryPrices: { tokenX: number; tokenY: number },
  currentPrices: { tokenX: number; tokenY: number }
): {
  impermanentLoss: number;
  impermanentLossPercent: number;
  holdValue: number;
  positionValue: number;
} {
  try {
    // Calculate what the tokens would be worth if held
    const tokenXAmountUi = tokenAmountToUi(
      position.tokens.token0.amount.toString(),
      position.tokens.token0.decimals || 9
    );
    const tokenYAmountUi = tokenAmountToUi(
      position.tokens.token1.amount.toString(),
      position.tokens.token1.decimals || 9
    );

    const holdValue = (tokenXAmountUi * currentPrices.tokenX) + (tokenYAmountUi * currentPrices.tokenY);
    
    // Calculate current position value
    const positionValueData = calculatePositionValue(
      position,
      currentPrices.tokenX,
      currentPrices.tokenY
    );
    
    const impermanentLoss = holdValue - positionValueData.totalValue;
    const impermanentLossPercent = holdValue > 0 ? (impermanentLoss / holdValue) * 100 : 0;

    return {
      impermanentLoss,
      impermanentLossPercent,
      holdValue,
      positionValue: positionValueData.totalValue
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate impermanent loss for position ${position.id}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// FEE CALCULATIONS
// ============================================================================

/**
 * Calculate fees earned per bin
 */
export function calculateBinFees(
  position: MeteoraPosition,
  tokenXPrice: number,
  tokenYPrice: number
): {
  totalFees: number;
  totalFeesX: number;
  totalFeesY: number;
  binFees: Array<{
    binId: number;
    feesX: number;
    feesY: number;
    totalFees: number;
    feesXUi: number;
    feesYUi: number;
  }>;
} {
  try {
    const binFees = position.binPositions.map(bin => {
      const feesXUi = tokenAmountToUi(bin.feeX, position.tokens.token0.decimals || 9);
      const feesYUi = tokenAmountToUi(bin.feeY, position.tokens.token1.decimals || 9);
      
      const feesX = feesXUi * tokenXPrice;
      const feesY = feesYUi * tokenYPrice;
      const totalFees = feesX + feesY;

      return {
        binId: bin.binId,
        feesX,
        feesY,
        totalFees,
        feesXUi,
        feesYUi
      };
    }, 'Logger message');

    // Add unclaimed fees
    const unclaimedFeesXUi = tokenAmountToUi(
      position.unclaimedFees.tokenX,
      position.tokens.token0.decimals || 9
    );
    const unclaimedFeesYUi = tokenAmountToUi(
      position.unclaimedFees.tokenY,
      position.tokens.token1.decimals || 9
    );

    const totalFeesX = binFees.reduce((sum, bin) => sum + bin.feesX, 0) + 
                      (unclaimedFeesXUi * tokenXPrice);
    const totalFeesY = binFees.reduce((sum, bin) => sum + bin.feesY, 0) + 
                      (unclaimedFeesYUi * tokenYPrice);
    const totalFees = totalFeesX + totalFeesY;

    return {
      totalFees,
      totalFeesX,
      totalFeesY,
      binFees
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate bin fees for position ${position.id}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Calculate fee APR for a position
 */
export function calculateFeeAPR(
  position: MeteoraPosition,
  dailyFees: number,
  positionValue: number
): number {
  try {
    if (positionValue === 0) return 0;
    
    const dailyReturn = dailyFees / positionValue;
    return dailyReturn * 365 * 100; // Convert to percentage APR
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate fee APR for position ${position.id}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// REWARD CALCULATIONS
// ============================================================================

/**
 * Calculate rewards earned and pending
 */
export function calculateRewards(
  position: MeteoraPosition,
  rewardPrices: Map<string, number>
): {
  totalRewardValue: number;
  rewardBreakdown: Array<{
    address: string;
    amount: string;
    value: number;
    apr?: number;
  }>;
} {
  try {
    const rewardBreakdown = position.unclaimedRewards.map(reward => {
      const price = rewardPrices.get(reward.address) || 0;
      const amountUi = tokenAmountToUi(reward.amount, 9); // Assume 9 decimals for reward tokens
      const value = amountUi * price;

      return {
        address: reward.address,
        amount: reward.amount,
        value,
        // APR calculation would require emission rates and time data
        apr: undefined
      };
    }, 'Logger message');

    const totalRewardValue = rewardBreakdown.reduce((sum, reward) => sum + reward.value, 0);

    return {
      totalRewardValue,
      rewardBreakdown
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate rewards for position ${position.id}`,
      'meteora-dlmm',
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
  position: MeteoraPosition,
  pool: MeteoraPool,
  marketData?: {
    volatility24h: number;
    volume24h: number;
    liquidity: number;
  }
): {
  concentrationRisk: number;
  liquidityRisk: number;
  volatilityRisk: number;
  overallRisk: 'low' | 'medium' | 'high' | 'extreme';
} {
  try {
    // Concentration risk - how concentrated is the liquidity
    const liquidityDistribution = calculateLiquidityDistribution(position);
    const maxConcentration = Math.max(...liquidityDistribution.map(bin => bin.percentage));
    const concentrationRisk = maxConcentration / 100; // 0-1 scale

    // Liquidity risk - based on pool TVL and volume
    let liquidityRisk = 0.5; // Default medium risk
    if (marketData) {
      const volumeToLiquidityRatio = marketData.volume24h / marketData.liquidity;
      liquidityRisk = Math.min(volumeToLiquidityRatio, 1); // Cap at 1
    }

    // Volatility risk - based on price movements
    let volatilityRisk = 0.5; // Default medium risk
    if (marketData) {
      volatilityRisk = Math.min(marketData.volatility24h / 100, 1); // Convert to 0-1 scale
    }

    // Overall risk assessment
    const avgRisk = (concentrationRisk + liquidityRisk + volatilityRisk) / 3;
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
      volatilityRisk,
      overallRisk
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate risk metrics for position ${position.id}`,
      'meteora-dlmm',
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
export function calculateMeteoraPositionMetrics(
  position: MeteoraPosition,
  pool: MeteoraPool,
  prices: {
    tokenX: number;
    tokenY: number;
    rewards: Map<string, number>;
  },
  marketData?: {
    volatility24h: number;
    volume24h: number;
    liquidity: number;
  }
): SolanaPositionMetrics & {
  meteora: {
    binCount: number;
    liquidityDistribution: Array<{ binId: number; percentage: number; price: number }>;
    priceRange: { minPrice: number; maxPrice: number; currentPrice: number };
    fees: {
      totalFees: number;
      totalFeesX: number;
      totalFeesY: number;
      feeAPR: number;
    };
    rewards: {
      totalRewardValue: number;
      rewardAPR: number;
    };
    risk: {
      concentrationRisk: number;
      liquidityRisk: number;
      volatilityRisk: number;
      overallRisk: 'low' | 'medium' | 'high' | 'extreme';
    };
  };
} {
  try {
    // Calculate basic position values
    const positionValue = calculatePositionValue(position, prices.tokenX, prices.tokenY);
    
    // Calculate fees
    const feeData = calculateBinFees(position, prices.tokenX, prices.tokenY);
    const feeAPR = calculateFeeAPR(position, feeData.totalFees, positionValue.totalValue);
    
    // Calculate rewards
    const rewardData = calculateRewards(position, prices.rewards);
    const rewardAPR = 0; // Would need emission data to calculate
    
    // Calculate risk metrics
    const riskMetrics = calculateRiskMetrics(position, pool, marketData);
    
    // Calculate price range
    const priceRange = calculatePositionPriceRange(position);
    
    // Calculate liquidity distribution
    const liquidityDistribution = calculateLiquidityDistribution(position);
    
    // Calculate age in days
    const createdTimestamp = typeof position.createdAt === 'string' 
      ? new Date(position.createdAt).getTime() 
      : (position.createdAt || Date.now());
    const ageInDays = (Date.now() - createdTimestamp) / (1000 * 60 * 60 * 24);

    return {
      // Standard metrics
      totalValue: positionValue.totalValue,
      token0Value: positionValue.tokenXValue,
      token1Value: positionValue.tokenYValue,
      totalFeesEarned: feeData.totalFees,
      fees24h: feeData.totalFees, // Simplified - would need historical data
      feeAPR,
      totalRewardsEarned: rewardData.totalRewardValue,
      rewards24h: 0, // Would need historical data
      rewardAPR,
      totalAPR: feeAPR + rewardAPR,
      impermanentLoss: 0, // Would need entry price data
      impermanentLossPercent: 0,
      utilizationRate: 1, // DLMM is always utilized
      concentrationRisk: riskMetrics.concentrationRisk,
      priceRange: {
        lower: priceRange.minPrice,
        upper: priceRange.maxPrice,
        current: priceRange.currentPrice,
        inRange: true // DLMM is always in range
      },
      ageInDays,
      lastActiveSlot: position.lastSlot,
      lastRewardClaim: position.updatedAt ? new Date(position.updatedAt).getTime() : 0,

      // Meteora-specific metrics
      meteora: {
        binCount: position.binPositions.length,
        liquidityDistribution,
        priceRange,
        fees: {
          totalFees: feeData.totalFees,
          totalFeesX: feeData.totalFeesX,
          totalFeesY: feeData.totalFeesY,
          feeAPR
        },
        rewards: {
          totalRewardValue: rewardData.totalRewardValue,
          rewardAPR
        },
        risk: riskMetrics
      }
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate comprehensive metrics for position ${position.id}`,
      'meteora-dlmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format Meteora-specific position data for display
 */
export function formatMeteoraPosition(
  position: MeteoraPosition,
  metrics: ReturnType<typeof calculateMeteoraPositionMetrics>
): {
  summary: string;
  details: Array<{ label: string; value: string }>;
  binBreakdown: Array<{ binId: number; price: string; liquidity: string; value: string }>;
} {
  try {
    const summary = `${position.binPositions.length} bins across price range ${
      formatPrice(metrics.meteora.priceRange.minPrice)
    } - ${formatPrice(metrics.meteora.priceRange.maxPrice)}`;

    const details = [
      { label: 'Total Value', value: formatPrice(metrics.totalValue) },
      { label: 'Fee APR', value: `${metrics.feeAPR.toFixed(2)}%` },
      { label: 'Bin Count', value: metrics.meteora.binCount.toString() },
      { label: 'Risk Level', value: metrics.meteora.risk.overallRisk },
      { label: 'Unclaimed Fees X', value: formatTokenAmount(position.unclaimedFees.tokenX, position.tokens.token0.decimals || 9) },
      { label: 'Unclaimed Fees Y', value: formatTokenAmount(position.unclaimedFees.tokenY, position.tokens.token1.decimals || 9) },
    ];

    const binBreakdown = position.binPositions.map(bin => ({
      binId: bin.binId,
      price: formatPrice(bin.price),
      liquidity: formatTokenAmount(bin.liquidity, 18), // Liquidity typically has 18 decimals
      value: formatPrice(
        tokenAmountToUi(bin.xAmount, position.tokens.token0.decimals || 9) * 
        (metrics.meteora.priceRange.currentPrice || 1) +
        tokenAmountToUi(bin.yAmount, position.tokens.token1.decimals || 9)
      )
    }));

    return {
      summary,
      details,
      binBreakdown
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to format position ${position.id}`,
      'meteora-dlmm',
      'FORMAT_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  METEORA_CONSTANTS,
  calculateBinPrice,
  calculateBinIdFromPrice,
  calculatePositionPriceRange,
  calculateTotalLiquidity,
  calculateLiquidityDistribution,
  calculatePositionValue,
  calculateImpermanentLoss,
  calculateBinFees,
  calculateFeeAPR,
  calculateRewards,
  calculateRiskMetrics,
  calculateMeteoraPositionMetrics,
  formatMeteoraPosition,
};