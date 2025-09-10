/**
 * Uniswap V3 Calculations Engine
 * Advanced calculations for V3 concentrated liquidity positions
 */

// import { BigNumber } from 'ethers'; // Removed BigNumber import for compatibility
import { 
  UniswapV3Position, 
  PriceData, 
  FeesCalculation, 
  ImpermanentLossCalculation, 
  PositionMetrics,
  UniswapError,
  UniswapErrorCodes,
  V3_FEE_TIERS
} from '../common/types';
import { 
  formatTokenAmount, 
  parseTokenAmount,
  safeDivide, 
  calculatePercentageChange, 
  calculateGeometricMean,
  daysBetween
} from '../common/utils';

// ============================================================================
// V3 SPECIFIC CALCULATION INTERFACES
// ============================================================================

export interface V3PositionSnapshot {
  timestamp: Date;
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
  tokensOwed0: string;
  tokensOwed1: string;
  token0PriceUSD: number;
  token1PriceUSD: number;
}

export interface V3LiquidityCalculation {
  token0Amount: string;
  token1Amount: string;
  token0AmountUSD: number;
  token1AmountUSD: number;
  totalValueUSD: number;
  utilizationRate: number;
}

export interface V3RangeAnalysis {
  inRange: boolean;
  ticksFromLower: number;
  ticksFromUpper: number;
  percentFromCenter: number;
  rangeWidth: number;
  concentrationRatio: number;
  efficiency: number;
}

export interface V3FeeTierInfo {
  feeTier: number;
  feeRate: number;
  tickSpacing: number;
  description: string;
}

// ============================================================================
// V3 CALCULATOR CLASS
// ============================================================================

export class V3Calculator {
  private readonly SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
  private readonly Q96 = Math.pow(2, 96);
  private readonly Q128 = Math.pow(2, 128);

  /**
   * Calculates current liquidity amounts from position
   */
  calculateLiquidity(
    position: UniswapV3Position,
    currentSqrtPriceX96: string,
    currentPrices: { token0PriceUSD: number; token1PriceUSD: number }
  ): V3LiquidityCalculation {
    try {
      const sqrtPriceX96 = BigNumber.from(currentSqrtPriceX96);
      const liquidity = BigNumber.from(position.liquidity);
      
      if (liquidity.isZero()) {
        return {
          token0Amount: '0',
          token1Amount: '0',
          token0AmountUSD: 0,
          token1AmountUSD: 0,
          totalValueUSD: 0,
          utilizationRate: 0
        };
      }

      // Calculate sqrt prices for tick bounds
      const sqrtPriceLowerX96 = this.tickToSqrtPrice(position.tickLower);
      const sqrtPriceUpperX96 = this.tickToSqrtPrice(position.tickUpper);

      // Calculate token amounts based on current price and range
      let token0Amount = BigNumber.from(0);
      let token1Amount = BigNumber.from(0);

      if (sqrtPriceX96.lte(sqrtPriceLowerX96)) {
        // Price is below range - all liquidity in token0
        token0Amount = this.getToken0AmountFromLiquidity(
          liquidity,
          sqrtPriceLowerX96,
          sqrtPriceUpperX96
        );
      } else if (sqrtPriceX96.gte(sqrtPriceUpperX96)) {
        // Price is above range - all liquidity in token1
        token1Amount = this.getToken1AmountFromLiquidity(
          liquidity,
          sqrtPriceLowerX96,
          sqrtPriceUpperX96
        );
      } else {
        // Price is in range - liquidity split between both tokens
        token0Amount = this.getToken0AmountFromLiquidity(
          liquidity,
          sqrtPriceX96,
          sqrtPriceUpperX96
        );
        token1Amount = this.getToken1AmountFromLiquidity(
          liquidity,
          sqrtPriceLowerX96,
          sqrtPriceX96
        );
      }

      // Convert to human readable and USD values
      const token0AmountFormatted = parseFloat(
        formatTokenAmount(token0Amount, position.pool.token0.decimals)
      );
      const token1AmountFormatted = parseFloat(
        formatTokenAmount(token1Amount, position.pool.token1.decimals)
      );

      const token0AmountUSD = token0AmountFormatted * currentPrices.token0PriceUSD;
      const token1AmountUSD = token1AmountFormatted * currentPrices.token1PriceUSD;
      const totalValueUSD = token0AmountUSD + token1AmountUSD;

      // Calculate utilization rate (how much of the range is being used)
      const utilizationRate = position.inRange ? 100 : 0;

      return {
        token0Amount: token0Amount.toString(),
        token1Amount: token1Amount.toString(),
        token0AmountUSD,
        token1AmountUSD,
        totalValueUSD,
        utilizationRate
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to calculate V3 liquidity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR,
        position.chain,
        'v3'
      );
    }
  }

  /**
   * Calculates fees earned for a V3 position
   */
  async calculateFeesEarned(
    position: UniswapV3Position,
    entrySnapshot: V3PositionSnapshot,
    currentSnapshot: V3PositionSnapshot
  ): Promise<FeesCalculation> {
    try {
      const daysPassed = daysBetween(entrySnapshot.timestamp, currentSnapshot.timestamp);
      
      // Calculate fee growth difference
      const feeGrowth0Diff = BigNumber.from(currentSnapshot.feeGrowthInside0LastX128)
        .sub(BigNumber.from(entrySnapshot.feeGrowthInside0LastX128));
      
      const feeGrowth1Diff = BigNumber.from(currentSnapshot.feeGrowthInside1LastX128)
        .sub(BigNumber.from(entrySnapshot.feeGrowthInside1LastX128));

      // Calculate fees from liquidity and fee growth
      const liquidity = BigNumber.from(position.liquidity);
      
      const fees0 = feeGrowth0Diff.mul(liquidity).div(this.Q128);
      const fees1 = feeGrowth1Diff.mul(liquidity).div(this.Q128);

      // Add already collected fees
      const totalFees0 = fees0.add(BigNumber.from(position.tokensOwed0));
      const totalFees1 = fees1.add(BigNumber.from(position.tokensOwed1));

      // Calculate USD values
      const fees0Formatted = parseFloat(
        formatTokenAmount(totalFees0, position.pool.token0.decimals)
      );
      const fees1Formatted = parseFloat(
        formatTokenAmount(totalFees1, position.pool.token1.decimals)
      );

      const feesUSD = fees0Formatted * currentSnapshot.token0PriceUSD + 
                      fees1Formatted * currentSnapshot.token1PriceUSD;

      // Calculate APR and APY
      const positionValueUSD = this.calculatePositionValueUSD(position, currentSnapshot);
      const apr = daysPassed > 0 && positionValueUSD > 0 ? 
                  (feesUSD / positionValueUSD) * (365.25 / daysPassed) * 100 : 0;
      
      const apy = daysPassed > 0 && positionValueUSD > 0 ? 
                  (Math.pow(1 + (feesUSD / positionValueUSD), 365.25 / daysPassed) - 1) * 100 : 0;

      return {
        fees0: totalFees0.toString(),
        fees1: totalFees1.toString(),
        feesUSD,
        apr,
        apy,
        period: daysPassed
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to calculate V3 fees for position ${position.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR,
        position.chain,
        'v3'
      );
    }
  }

  /**
   * Calculates impermanent loss for V3 concentrated liquidity
   */
  async calculateImpermanentLoss(
    position: UniswapV3Position,
    entrySnapshot: V3PositionSnapshot,
    currentSnapshot: V3PositionSnapshot
  ): Promise<ImpermanentLossCalculation> {
    try {
      // Calculate position values at entry and current
      const entryValue = this.calculatePositionValueUSD(position, entrySnapshot);
      const currentValue = this.calculatePositionValueUSD(position, currentSnapshot);

      // Calculate what the value would be if tokens were held individually (HODL value)
      const entryLiquidity = this.calculateLiquidity(
        position,
        entrySnapshot.sqrtPriceX96,
        {
          token0PriceUSD: entrySnapshot.token0PriceUSD,
          token1PriceUSD: entrySnapshot.token1PriceUSD
        }
      );

      // Calculate HODL value with current prices
      const hodlValue = entryLiquidity.token0AmountUSD / entrySnapshot.token0PriceUSD * currentSnapshot.token0PriceUSD +
                       entryLiquidity.token1AmountUSD / entrySnapshot.token1PriceUSD * currentSnapshot.token1PriceUSD;

      // Calculate impermanent loss
      const impermanentLoss = currentValue - hodlValue;
      const impermanentLossPercent = hodlValue > 0 ? (impermanentLoss / hodlValue) * 100 : 0;

      return {
        currentValue,
        hodlValue,
        impermanentLoss,
        impermanentLossPercent
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to calculate V3 impermanent loss for position ${position.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR,
        position.chain,
        'v3'
      );
    }
  }

  /**
   * Analyzes position range efficiency and status
   */
  calculateRangeAnalysis(
    position: UniswapV3Position,
    currentTick: number
  ): V3RangeAnalysis {
    try {
      const { tickLower, tickUpper } = position;
      const inRange = currentTick >= tickLower && currentTick <= tickUpper;
      
      const ticksFromLower = currentTick - tickLower;
      const ticksFromUpper = tickUpper - currentTick;
      const rangeWidth = tickUpper - tickLower;
      const rangeCenter = (tickLower + tickUpper) / 2;
      const percentFromCenter = rangeWidth > 0 ? 
        Math.abs((currentTick - rangeCenter) / (rangeWidth / 2)) * 100 : 0;

      // Calculate concentration ratio (how concentrated vs full range)
      const fullRangeTicks = 887272; // Approximate full range for most tokens
      const concentrationRatio = fullRangeTicks / rangeWidth;

      // Calculate efficiency (how well the range is positioned)
      let efficiency = 0;
      if (inRange) {
        // Efficiency based on how centered the current tick is
        efficiency = Math.max(0, 100 - percentFromCenter);
      } else {
        // Efficiency is 0 when out of range
        efficiency = 0;
      }

      return {
        inRange,
        ticksFromLower,
        ticksFromUpper,
        percentFromCenter,
        rangeWidth,
        concentrationRatio,
        efficiency
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to calculate range analysis for position ${position.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR,
        position.chain,
        'v3'
      );
    }
  }

  /**
   * Calculates comprehensive position metrics
   */
  async calculatePositionMetrics(
    position: UniswapV3Position,
    entrySnapshot: V3PositionSnapshot,
    currentSnapshot: V3PositionSnapshot,
    currentTick: number
  ): Promise<PositionMetrics> {
    try {
      const currentValue = this.calculatePositionValueUSD(position, currentSnapshot);
      const originalValue = this.calculatePositionValueUSD(position, entrySnapshot);

      const pnl = currentValue - originalValue;
      const pnlPercent = originalValue > 0 ? (pnl / originalValue) * 100 : 0;

      // Calculate fees, IL, and other metrics
      const fees = await this.calculateFeesEarned(position, entrySnapshot, currentSnapshot);
      const impermanentLoss = await this.calculateImpermanentLoss(position, entrySnapshot, currentSnapshot);

      // Calculate time-weighted return including fees
      const daysPassed = daysBetween(entrySnapshot.timestamp, currentSnapshot.timestamp);
      const totalReturn = pnl + fees.feesUSD;
      const timeWeightedReturn = daysPassed > 0 && originalValue > 0 ? 
        (totalReturn / originalValue) * (365.25 / daysPassed) * 100 : 0;

      return {
        currentValue,
        originalValue,
        pnl,
        pnlPercent,
        fees,
        impermanentLoss,
        timeWeightedReturn
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to calculate V3 position metrics for ${position.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR,
        position.chain,
        'v3'
      );
    }
  }

  /**
   * Calculates optimal range for maximum fee collection
   */
  calculateOptimalRange(
    currentTick: number,
    feeTier: number,
    volatility: number,
    timeHorizon: number // days
  ): { tickLower: number; tickUpper: number; reasoning: string } {
    try {
      const tickSpacing = this.getTickSpacing(feeTier);
      
      // Base range width on volatility and time horizon
      // Higher volatility and longer time horizon = wider range
      const baseWidth = Math.floor(volatility * timeHorizon * 10);
      const rangeWidth = Math.max(baseWidth, tickSpacing * 10);

      // Ensure range is symmetric around current tick
      const halfRange = Math.floor(rangeWidth / 2);
      
      let tickLower = currentTick - halfRange;
      let tickUpper = currentTick + halfRange;

      // Round to nearest tick spacing
      tickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
      tickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;

      const reasoning = `Optimal range based on ${volatility.toFixed(1)}% volatility and ${timeHorizon} day horizon. Range width: ${tickUpper - tickLower} ticks.`;

      return {
        tickLower,
        tickUpper,
        reasoning
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to calculate optimal range: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR
      );
    }
  }

  /**
   * Helper: Calculate position USD value from snapshot
   */
  private calculatePositionValueUSD(
    position: UniswapV3Position,
    snapshot: V3PositionSnapshot
  ): number {
    const liquidity = this.calculateLiquidity(
      position,
      snapshot.sqrtPriceX96,
      {
        token0PriceUSD: snapshot.token0PriceUSD,
        token1PriceUSD: snapshot.token1PriceUSD
      }
    );
    
    return liquidity.totalValueUSD;
  }

  /**
   * Helper: Convert tick to sqrt price
   */
  private tickToSqrtPrice(tick: number): BigNumber {
    const sqrtPrice = Math.sqrt(Math.pow(1.0001, tick));
    return BigNumber.from(Math.floor(sqrtPrice * Math.pow(2, 96)));
  }

  /**
   * Helper: Get token0 amount from liquidity
   */
  private getToken0AmountFromLiquidity(
    liquidity: BigNumber,
    sqrtPriceAX96: BigNumber,
    sqrtPriceBX96: BigNumber
  ): BigNumber {
    if (sqrtPriceAX96.gt(sqrtPriceBX96)) {
      [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
    }
    
    return liquidity
      .mul(sqrtPriceBX96.sub(sqrtPriceAX96))
      .div(sqrtPriceBX96)
      .div(sqrtPriceAX96)
      .mul(this.Q96);
  }

  /**
   * Helper: Get token1 amount from liquidity
   */
  private getToken1AmountFromLiquidity(
    liquidity: BigNumber,
    sqrtPriceAX96: BigNumber,
    sqrtPriceBX96: BigNumber
  ): BigNumber {
    if (sqrtPriceAX96.gt(sqrtPriceBX96)) {
      [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
    }
    
    return liquidity.mul(sqrtPriceBX96.sub(sqrtPriceAX96)).div(this.Q96);
  }

  /**
   * Helper: Get tick spacing for fee tier
   */
  private getTickSpacing(feeTier: number): number {
    switch (feeTier) {
      case V3_FEE_TIERS.LOWEST: return 1;
      case V3_FEE_TIERS.LOW: return 10;
      case V3_FEE_TIERS.MEDIUM: return 60;
      case V3_FEE_TIERS.HIGH: return 200;
      default: return 60;
    }
  }

  /**
   * Gets fee tier information
   */
  getFeeTierInfo(feeTier: number): V3FeeTierInfo {
    const feeRate = feeTier / 1000000; // Convert basis points to decimal
    let description = '';

    switch (feeTier) {
      case V3_FEE_TIERS.LOWEST:
        description = 'Best for stable pairs';
        break;
      case V3_FEE_TIERS.LOW:
        description = 'Best for stable pairs';
        break;
      case V3_FEE_TIERS.MEDIUM:
        description = 'Best for most pairs';
        break;
      case V3_FEE_TIERS.HIGH:
        description = 'Best for volatile pairs';
        break;
      default:
        description = 'Custom fee tier';
    }

    return {
      feeTier,
      feeRate,
      tickSpacing: this.getTickSpacing(feeTier),
      description
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates the current tick from sqrt price
 */
export function sqrtPriceToTick(sqrtPriceX96: BigNumber): number {
  const sqrtPrice = sqrtPriceX96.div(BigNumber.from(2).pow(96)).toNumber();
  return Math.floor(Math.log(sqrtPrice * sqrtPrice) / Math.log(1.0001));
}

/**
 * Calculates price from sqrt price
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96: BigNumber, token0Decimals: number, token1Decimals: number): number {
  const Q96 = BigNumber.from(2).pow(96);
  const price = sqrtPriceX96.div(Q96).pow(2);
  return price.toNumber() * Math.pow(10, token0Decimals - token1Decimals);
}

/**
 * Estimates gas costs for V3 operations
 */
export function estimateV3GasCosts(): {
  mint: number;
  increaseLiquidity: number;
  decreaseLiquidity: number;
  collect: number;
  burn: number;
} {
  return {
    mint: 300000,
    increaseLiquidity: 200000,
    decreaseLiquidity: 150000,
    collect: 120000,
    burn: 100000
  };
}

/**
 * Calculates the maximum liquidity for a given token amounts and price range
 */
export function calculateMaxLiquidity(
  amount0: BigNumber,
  amount1: BigNumber,
  sqrtPriceX96: BigNumber,
  sqrtPriceLowerX96: BigNumber,
  sqrtPriceUpperX96: BigNumber
): BigNumber {
  if (sqrtPriceX96.lte(sqrtPriceLowerX96)) {
    // Current price below range - only token0 needed
    return amount0.mul(sqrtPriceLowerX96).mul(sqrtPriceUpperX96).div(
      sqrtPriceUpperX96.sub(sqrtPriceLowerX96)
    ).div(BigNumber.from(2).pow(96));
  } else if (sqrtPriceX96.gte(sqrtPriceUpperX96)) {
    // Current price above range - only token1 needed
    return amount1.mul(BigNumber.from(2).pow(96)).div(
      sqrtPriceUpperX96.sub(sqrtPriceLowerX96)
    );
  } else {
    // Current price in range - need both tokens
    const liquidity0 = amount0.mul(sqrtPriceX96).mul(sqrtPriceUpperX96).div(
      sqrtPriceUpperX96.sub(sqrtPriceX96)
    ).div(BigNumber.from(2).pow(96));

    const liquidity1 = amount1.mul(BigNumber.from(2).pow(96)).div(
      sqrtPriceX96.sub(sqrtPriceLowerX96)
    );

    return liquidity0.lt(liquidity1) ? liquidity0 : liquidity1;
  }
}

export default V3Calculator;