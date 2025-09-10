/**
 * Uniswap V2 Calculations Engine
 * Handles fee calculations, APR/APY, and impermanent loss calculations
 */

import { BigNumber } from 'ethers';
import { 
  UniswapV2Position, 
  PriceData, 
  FeesCalculation, 
  ImpermanentLossCalculation, 
  PositionMetrics,
  UniswapError,
  UniswapErrorCodes
} from '../common/types';
import { 
  formatTokenAmount, 
  safeDivide, 
  calculatePercentageChange, 
  calculateGeometricMean,
  daysBetween
} from '../common/utils';

// ============================================================================
// CALCULATION INTERFACES
// ============================================================================

export interface V2PositionSnapshot {
  timestamp: Date;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  lpBalance: string;
  token0PriceUSD: number;
  token1PriceUSD: number;
}

export interface V2FeePeriod {
  startDate: Date;
  endDate: Date;
  volume0: string;
  volume1: string;
  volumeUSD: number;
  fees0: string;
  fees1: string;
  feesUSD: number;
}

export interface V2PoolMetrics {
  tvlUSD: number;
  volume24hUSD: number;
  fees24hUSD: number;
  apr: number;
  apy: number;
  utilization: number;
}

// ============================================================================
// V2 CALCULATOR CLASS
// ============================================================================

export class V2Calculator {
  private readonly FEE_RATE = 0.003; // 0.3% fee for Uniswap V2
  private readonly DAYS_PER_YEAR = 365.25;

  /**
   * Calculates fees earned for a V2 position over a time period
   */
  async calculateFeesEarned(
    position: UniswapV2Position,
    startDate: Date,
    endDate: Date,
    historicalData?: V2FeePeriod[]
  ): Promise<FeesCalculation> {
    try {
      const daysPassed = daysBetween(startDate, endDate);
      
      if (!historicalData || historicalData.length === 0) {
        // Fallback calculation without historical data
        return this.calculateFeesEstimate(position, daysPassed);
      }

      // Calculate actual fees from historical data
      const totalFees0 = historicalData.reduce((sum, period) => {
        const fees = BigNumber.from(period.fees0 || '0');
        return sum.add(fees.mul(BigNumber.from(position.lpTokenBalance)).div(BigNumber.from(position.pool.totalSupply)));
      }, BigNumber.from(0));

      const totalFees1 = historicalData.reduce((sum, period) => {
        const fees = BigNumber.from(period.fees1 || '0');
        return sum.add(fees.mul(BigNumber.from(position.lpTokenBalance)).div(BigNumber.from(position.pool.totalSupply)));
      }, BigNumber.from(0));

      const fees0Formatted = formatTokenAmount(totalFees0, position.pool.token0.decimals);
      const fees1Formatted = formatTokenAmount(totalFees1, position.pool.token1.decimals);

      // Calculate USD value (would need price data)
      const feesUSD = parseFloat(fees0Formatted) * 1 + parseFloat(fees1Formatted) * 1; // Placeholder prices
      
      // Calculate APR and APY
      const apr = daysPassed > 0 ? (feesUSD / position.liquidityUSD) * (365.25 / daysPassed) * 100 : 0;
      const apy = daysPassed > 0 ? ((1 + (feesUSD / position.liquidityUSD)) ** (365.25 / daysPassed) - 1) * 100 : 0;

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
        `Failed to calculate fees for position ${position.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR,
        position.chain,
        'v2'
      );
    }
  }

  /**
   * Estimates fees based on current position and average pool metrics
   */
  private calculateFeesEstimate(position: UniswapV2Position, daysPassed: number): FeesCalculation {
    // Estimate based on position share and typical V2 yields
    const estimatedDailyYield = 0.0001; // 0.01% daily yield estimate
    const totalYield = estimatedDailyYield * daysPassed;
    
    const feesUSD = position.liquidityUSD * totalYield;
    const apr = totalYield * (365.25 / daysPassed) * 100;
    const apy = ((1 + estimatedDailyYield) ** 365.25 - 1) * 100;

    // Distribute fees proportionally between tokens
    const fees0USD = feesUSD * 0.5;
    const fees1USD = feesUSD * 0.5;

    // Convert to token amounts (would need current prices)
    const fees0Amount = BigNumber.from(Math.floor(fees0USD * Math.pow(10, position.pool.token0.decimals)));
    const fees1Amount = BigNumber.from(Math.floor(fees1USD * Math.pow(10, position.pool.token1.decimals)));

    return {
      fees0: fees0Amount.toString(),
      fees1: fees1Amount.toString(),
      feesUSD,
      apr,
      apy,
      period: daysPassed
    };
  }

  /**
   * Calculates impermanent loss for a V2 position
   */
  async calculateImpermanentLoss(
    position: UniswapV2Position,
    entryPrices: { token0PriceUSD: number; token1PriceUSD: number },
    currentPrices: { token0PriceUSD: number; token1PriceUSD: number }
  ): Promise<ImpermanentLossCalculation> {
    try {
      // Get position token amounts
      const token0Amount = parseFloat(position.token0Amount.amountHuman);
      const token1Amount = parseFloat(position.token1Amount.amountHuman);

      // Calculate entry values
      const entryValue0 = token0Amount * entryPrices.token0PriceUSD;
      const entryValue1 = token1Amount * entryPrices.token1PriceUSD;
      const totalEntryValue = entryValue0 + entryValue1;

      // Calculate current LP value
      const currentValue0 = token0Amount * currentPrices.token0PriceUSD;
      const currentValue1 = token1Amount * currentPrices.token1PriceUSD;
      const currentValue = currentValue0 + currentValue1;

      // Calculate hold value (if tokens were held separately)
      const hodlValue = (entryValue0 / entryPrices.token0PriceUSD * currentPrices.token0PriceUSD) +
                       (entryValue1 / entryPrices.token1PriceUSD * currentPrices.token1PriceUSD);

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
        `Failed to calculate impermanent loss for position ${position.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR,
        position.chain,
        'v2'
      );
    }
  }

  /**
   * Calculates comprehensive position metrics
   */
  async calculatePositionMetrics(
    position: UniswapV2Position,
    entrySnapshot: V2PositionSnapshot,
    currentSnapshot: V2PositionSnapshot,
    historicalData?: V2FeePeriod[]
  ): Promise<PositionMetrics> {
    try {
      const startDate = entrySnapshot.timestamp;
      const endDate = currentSnapshot.timestamp;

      // Calculate current and original values
      const currentValue = this.calculatePositionValueUSD(position, {
        token0PriceUSD: currentSnapshot.token0PriceUSD,
        token1PriceUSD: currentSnapshot.token1PriceUSD
      });

      const originalValue = this.calculatePositionValueUSD(position, {
        token0PriceUSD: entrySnapshot.token0PriceUSD,
        token1PriceUSD: entrySnapshot.token1PriceUSD
      });

      // Calculate P&L
      const pnl = currentValue - originalValue;
      const pnlPercent = originalValue > 0 ? (pnl / originalValue) * 100 : 0;

      // Calculate fees
      const fees = await this.calculateFeesEarned(position, startDate, endDate, historicalData);

      // Calculate impermanent loss
      const impermanentLoss = await this.calculateImpermanentLoss(
        position,
        {
          token0PriceUSD: entrySnapshot.token0PriceUSD,
          token1PriceUSD: entrySnapshot.token1PriceUSD
        },
        {
          token0PriceUSD: currentSnapshot.token0PriceUSD,
          token1PriceUSD: currentSnapshot.token1PriceUSD
        }
      );

      // Calculate time-weighted return
      const daysPassed = daysBetween(startDate, endDate);
      const totalReturn = pnl + fees.feesUSD;
      const timeWeightedReturn = daysPassed > 0 ? (totalReturn / originalValue) * (365.25 / daysPassed) * 100 : 0;

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
        `Failed to calculate position metrics for ${position.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR,
        position.chain,
        'v2'
      );
    }
  }

  /**
   * Calculates USD value of a position
   */
  private calculatePositionValueUSD(
    position: UniswapV2Position,
    prices: { token0PriceUSD: number; token1PriceUSD: number }
  ): number {
    const token0Amount = parseFloat(position.token0Amount.amountHuman);
    const token1Amount = parseFloat(position.token1Amount.amountHuman);

    return (token0Amount * prices.token0PriceUSD) + (token1Amount * prices.token1PriceUSD);
  }

  /**
   * Calculates pool metrics for V2 pools
   */
  async calculatePoolMetrics(
    reserve0: string,
    reserve1: string,
    token0Decimals: number,
    token1Decimals: number,
    prices: { token0PriceUSD: number; token1PriceUSD: number },
    volume24hUSD?: number
  ): Promise<V2PoolMetrics> {
    try {
      // Calculate TVL
      const reserve0Formatted = parseFloat(formatTokenAmount(reserve0, token0Decimals));
      const reserve1Formatted = parseFloat(formatTokenAmount(reserve1, token1Decimals));
      
      const tvlUSD = (reserve0Formatted * prices.token0PriceUSD) + (reserve1Formatted * prices.token1PriceUSD);

      // Calculate 24h fees (0.3% of volume)
      const volume24h = volume24hUSD || 0;
      const fees24hUSD = volume24h * this.FEE_RATE;

      // Calculate APR and APY
      const apr = tvlUSD > 0 ? (fees24hUSD * this.DAYS_PER_YEAR / tvlUSD) * 100 : 0;
      const apy = tvlUSD > 0 ? ((1 + (fees24hUSD / tvlUSD)) ** this.DAYS_PER_YEAR - 1) * 100 : 0;

      // Calculate utilization (volume to TVL ratio)
      const utilization = tvlUSD > 0 ? volume24h / tvlUSD : 0;

      return {
        tvlUSD,
        volume24hUSD: volume24h,
        fees24hUSD,
        apr,
        apy,
        utilization
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to calculate pool metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR
      );
    }
  }

  /**
   * Calculates optimal token amounts for a given USD value
   */
  calculateOptimalTokenAmounts(
    targetUSD: number,
    reserve0: string,
    reserve1: string,
    token0Decimals: number,
    token1Decimals: number,
    prices: { token0PriceUSD: number; token1PriceUSD: number }
  ): { token0Amount: string; token1Amount: string; ratio: number } {
    try {
      const reserve0Formatted = parseFloat(formatTokenAmount(reserve0, token0Decimals));
      const reserve1Formatted = parseFloat(formatTokenAmount(reserve1, token1Decimals));

      // Calculate current pool ratio
      const poolRatio = reserve0Formatted / reserve1Formatted;
      const priceRatio = prices.token0PriceUSD / prices.token1PriceUSD;

      // Calculate optimal allocation
      const totalValue = targetUSD;
      const token0ValueUSD = totalValue / (1 + (priceRatio / poolRatio));
      const token1ValueUSD = totalValue - token0ValueUSD;

      const token0Amount = token0ValueUSD / prices.token0PriceUSD;
      const token1Amount = token1ValueUSD / prices.token1PriceUSD;

      return {
        token0Amount: token0Amount.toString(),
        token1Amount: token1Amount.toString(),
        ratio: poolRatio
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to calculate optimal token amounts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR
      );
    }
  }

  /**
   * Calculates price impact for a swap
   */
  calculatePriceImpact(
    amountIn: string,
    reserve0: string,
    reserve1: string,
    tokenInDecimals: number,
    tokenOutDecimals: number,
    zeroForOne: boolean
  ): { amountOut: string; priceImpact: number } {
    try {
      const amountInBN = BigNumber.from(amountIn);
      const reserve0BN = BigNumber.from(reserve0);
      const reserve1BN = BigNumber.from(reserve1);

      const reserveIn = zeroForOne ? reserve0BN : reserve1BN;
      const reserveOut = zeroForOne ? reserve1BN : reserve0BN;

      // Apply 0.3% fee
      const amountInWithFee = amountInBN.mul(997);
      const numerator = amountInWithFee.mul(reserveOut);
      const denominator = reserveIn.mul(1000).add(amountInWithFee);
      
      const amountOut = numerator.div(denominator);

      // Calculate price impact
      const priceBeforeDecimals = zeroForOne ? tokenOutDecimals : tokenInDecimals;
      const priceAfterDecimals = zeroForOne ? tokenInDecimals : tokenOutDecimals;
      
      const priceBefore = safeDivide(reserveOut, reserveIn);
      const priceAfter = safeDivide(reserveOut.sub(amountOut), reserveIn.add(amountInBN));
      
      const priceImpact = Math.abs((priceAfter - priceBefore) / priceBefore) * 100;

      return {
        amountOut: amountOut.toString(),
        priceImpact
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to calculate price impact: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CALCULATION_ERROR
      );
    }
  }

  /**
   * Gets fee tier information for V2 (always 0.3%)
   */
  getFeeInfo(): { feeRate: number; feeTier: string } {
    return {
      feeRate: this.FEE_RATE,
      feeTier: '0.30%'
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates constant product (k = x * y) for a V2 pool
 */
export function calculateConstantProduct(reserve0: string, reserve1: string): BigNumber {
  return BigNumber.from(reserve0).mul(BigNumber.from(reserve1));
}

/**
 * Calculates the square root of a BigNumber (for price calculations)
 */
export function sqrt(value: BigNumber): BigNumber {
  if (value.isZero()) return BigNumber.from(0);
  
  let z = value;
  let x = value.div(2).add(1);
  
  while (x.lt(z)) {
    z = x;
    x = value.div(x).add(x).div(2);
  }
  
  return z;
}

/**
 * Formats a fee calculation result for display
 */
export function formatFeesCalculation(calc: FeesCalculation, token0Symbol: string, token1Symbol: string): string {
  return `Fees: ${parseFloat(formatTokenAmount(calc.fees0, 18)).toFixed(6)} ${token0Symbol} + ${parseFloat(formatTokenAmount(calc.fees1, 18)).toFixed(6)} ${token1Symbol} ($${calc.feesUSD.toFixed(2)}) | APR: ${calc.apr.toFixed(2)}%`;
}

export default V2Calculator;