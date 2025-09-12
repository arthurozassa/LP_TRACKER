/**
 * Uniswap V2 Position Scanner
 * Scans and tracks V2 LP positions for a given wallet
 */

import { ethers } from 'ethers'; // Removed BigNumber import for compatibility
import { 
  UniswapV2Position, 
  UniswapChain, 
  Token, 
  PoolV2, 
  ScanParams, 
  UniswapError, 
  UniswapErrorCodes,
  PositionScanProgress
} from '../common/types';
import { 
  createTokenAmount, 
  formatTokenAmount, 
  safeDivide, 
  measureExecutionTime,
  batchArray
} from '../common/utils';
import { V2ContractOperations, createV2ContractOperations } from './contracts';
import { V2Calculator } from './calculations';

// ============================================================================
// SCANNER CONFIGURATION
// ============================================================================

export interface V2ScanConfig {
  batchSize: number;
  maxPairs: number;
  minLiquidityUSD: number;
  includeInactive: boolean;
  timeout: number;
  retryCount: number;
}

export const DEFAULT_V2_SCAN_CONFIG: V2ScanConfig = {
  batchSize: 50,
  maxPairs: 10000,
  minLiquidityUSD: 10,
  includeInactive: false,
  timeout: 30000,
  retryCount: 3
};

// ============================================================================
// POSITION SCANNER
// ============================================================================

export class V2PositionScanner {
  private contractOps: V2ContractOperations;
  private calculator: V2Calculator;
  private chain: UniswapChain;
  private config: V2ScanConfig;

  constructor(
    provider: ethers.Provider,
    chain: UniswapChain,
    config: Partial<V2ScanConfig> = {}
  ) {
    this.chain = chain;
    this.config = { ...DEFAULT_V2_SCAN_CONFIG, ...config };
    this.contractOps = createV2ContractOperations(provider, chain);
    this.calculator = new V2Calculator();
  }

  /**
   * Scans for V2 positions for a given address
   */
  async scanPositions(address: string, onProgress?: (progress: PositionScanProgress) => void): Promise<UniswapV2Position[]> {
    const progress: PositionScanProgress = {
      chain: this.chain,
      protocol: 'v2',
      status: 'scanning',
      positionsFound: 0
    };

    if (onProgress) onProgress(progress);

    try {
      const { result: positions } = await measureExecutionTime(
        `V2 scan for ${address} on ${this.chain}`,
        () => this.performScan(address, onProgress)
      );

      progress.status = 'completed';
      progress.positionsFound = positions.length;
      if (onProgress) onProgress(progress);

      return positions;
    } catch (error) {
      progress.status = 'error';
      progress.error = error instanceof Error ? error.message : 'Unknown error';
      if (onProgress) onProgress(progress);
      throw error;
    }
  }

  /**
   * Performs the actual scanning logic
   */
  private async performScan(address: string, onProgress?: (progress: PositionScanProgress) => void): Promise<UniswapV2Position[]> {
    // Strategy 1: Scan through known popular pairs first
    const popularPairs = await this.getPopularPairs();
    let positions = await this.scanSpecificPairs(address, popularPairs, onProgress);

    // Strategy 2: If config allows, do a broader scan
    if (positions.length < 10 && this.config.maxPairs > popularPairs.length) {
      const additionalPositions = await this.scanAllPairs(address, popularPairs.length, onProgress);
      positions.push(...additionalPositions);
    }

    // Filter and enrich positions
    positions = positions.filter(pos => 
      this.config.includeInactive || pos.isActive
    );

    // Calculate additional metrics for each position
    for (const position of positions) {
      await this.enrichPosition(position);
    }

    return positions;
  }

  /**
   * Gets list of popular/high TVL pairs to scan first
   */
  private async getPopularPairs(): Promise<string[]> {
    // In a real implementation, this would query a subgraph or API for high-TVL pairs
    // For now, we'll get the first 1000 pairs from the factory
    try {
      const totalPairs = await this.contractOps.getTotalPairsCount();
      const limit = Math.min(1000, totalPairs, this.config.maxPairs);
      
      return await this.contractOps.getAllPairs(0, limit);
    } catch (error) {
      console.warn(`Failed to get popular pairs: ${error}`);
      return [];
    }
  }

  /**
   * Scans specific pairs for user positions
   */
  private async scanSpecificPairs(
    address: string, 
    pairAddresses: string[],
    onProgress?: (progress: PositionScanProgress) => void
  ): Promise<UniswapV2Position[]> {
    const positions: UniswapV2Position[] = [];
    
    // Get all LP balances in batches
    const lpPositions = await this.contractOps.getUserLPPositions(address, pairAddresses);
    
    if (lpPositions.length === 0) {
      return positions;
    }

    // Process positions with balances
    const batches = batchArray(lpPositions, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchPromises = batch.map(lpPos => 
        this.createPositionFromLPBalance(address, lpPos.pairAddress, lpPos.balance)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          positions.push(result.value);
        }
      }

      // Update progress
      if (onProgress) {
        onProgress({
          chain: this.chain,
          protocol: 'v2',
          status: 'scanning',
          positionsFound: positions.length
        }, 'Logger message');
      }
    }

    return positions;
  }

  /**
   * Scans all pairs (expensive operation)
   */
  private async scanAllPairs(
    address: string,
    startIndex: number,
    onProgress?: (progress: PositionScanProgress) => void
  ): Promise<UniswapV2Position[]> {
    const positions: UniswapV2Position[] = [];
    const totalPairs = await this.contractOps.getTotalPairsCount();
    const endIndex = Math.min(totalPairs, startIndex + this.config.maxPairs);

    for (let i = startIndex; i < endIndex; i += this.config.batchSize) {
      const batchEnd = Math.min(i + this.config.batchSize, endIndex);
      const pairAddresses = await this.contractOps.getAllPairs(i, batchEnd);
      
      if (pairAddresses.length === 0) break;

      const batchPositions = await this.scanSpecificPairs(address, pairAddresses, onProgress);
      positions.push(...batchPositions);

      // Update progress
      if (onProgress) {
        onProgress({
          chain: this.chain,
          protocol: 'v2',
          status: 'scanning',
          positionsFound: positions.length
        }, 'Logger message');
      }

      // Early exit if we found enough positions
      if (positions.length >= 50) break;
    }

    return positions;
  }

  /**
   * Creates a position object from LP balance
   */
  private async createPositionFromLPBalance(
    userAddress: string,
    pairAddress: string,
    lpBalance: string
  ): Promise<UniswapV2Position | null> {
    try {
      // Get detailed pair info
      const pairInfo = await this.contractOps.getDetailedPairInfo(pairAddress);
      
      // Check if position meets minimum liquidity requirements
      if (lpBalance === '0') {
        return null;
      }

      // Calculate user's share of the pool
      const shareOfPool = safeDivide(Number(lpBalance), Number(pairInfo.totalSupply));
      
      if (shareOfPool < 0.000001) { // Less than 0.0001% of pool
        return null;
      }

      // Calculate token amounts based on pool share (simplified calculation)
      const token0Amount = Math.floor((Number(pairInfo.reserve0) * Number(lpBalance)) / Number(pairInfo.totalSupply)).toString();
      const token1Amount = Math.floor((Number(pairInfo.reserve1) * Number(lpBalance)) / Number(pairInfo.totalSupply)).toString();

      // Create pool object
      const pool: PoolV2 = {
        id: pairAddress.toLowerCase(),
        address: pairAddress,
        token0: pairInfo.token0,
        token1: pairInfo.token1,
        reserve0: pairInfo.reserve0.toString(),
        reserve1: pairInfo.reserve1.toString(),
        totalSupply: pairInfo.totalSupply.toString(),
        tvlUSD: 0, // Will be calculated later with price data
        volumeUSD24h: 0, // Would need subgraph data
        feesUSD24h: 0, // Would need subgraph data
        createdAt: new Date() // Would need subgraph data for actual creation time
      };

      // Create position object
      const position: UniswapV2Position = {
        id: `${pairAddress.toLowerCase()}-${userAddress.toLowerCase()}`,
        protocol: 'uniswap-v2',
        chain: this.chain,
        pool,
        owner: userAddress.toLowerCase(),
        
        // Liquidity info
        liquidity: lpBalance.toString(),
        liquidityUSD: 0, // Will be calculated with price data
        
        // Token amounts
        token0Amount: createTokenAmount(pairInfo.token0, token0Amount),
        token1Amount: createTokenAmount(pairInfo.token1, token1Amount),
        
        // Fee info (will be calculated)
        feesEarned0: createTokenAmount(pairInfo.token0, '0'),
        feesEarned1: createTokenAmount(pairInfo.token1, '0'),
        feesEarnedUSD: 0,
        
        // Performance metrics (will be calculated)
        apr: 0,
        apy: 0,
        impermanentLoss: 0,
        
        // V2 specific
        lpTokenBalance: lpBalance.toString(),
        shareOfPool: shareOfPool * 100, // Convert to percentage
        
        // Metadata
        createdAt: new Date(), // Would need transaction history for actual date
        lastUpdate: new Date(),
        isActive: lpBalance !== '0'
      };

      return position;
    } catch (error) {
      console.warn(`Failed to create position for pair ${pairAddress}:`, error);
      return null;
    }
  }

  /**
   * Enriches position with additional calculated data
   */
  private async enrichPosition(position: UniswapV2Position): Promise<void> {
    try {
      // Calculate current USD values (would need price oracle integration)
      // For now, set basic values
      
      // Calculate fees earned (would need historical data)
      const feesCalculation = await this.calculator.calculateFeesEarned(
        position,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        new Date()
      );
      
      position.feesEarnedUSD = feesCalculation.feesUSD;
      position.apr = feesCalculation.apr;
      position.apy = feesCalculation.apy;

      // Calculate impermanent loss (would need entry price data)
      const ilCalculation = await this.calculator.calculateImpermanentLoss(
        position,
        { token0PriceUSD: 1, token1PriceUSD: 1 }, // Entry prices
        { token0PriceUSD: 1, token1PriceUSD: 1 }  // Current prices
      );
      
      position.impermanentLoss = ilCalculation.impermanentLossPercent;

    } catch (error) {
      console.warn(`Failed to enrich position ${position.id}:`, error);
    }
  }

  /**
   * Gets position by specific pair and user
   */
  async getPosition(userAddress: string, pairAddress: string): Promise<UniswapV2Position | null> {
    try {
      const lpBalance = await this.contractOps.getLPBalance(pairAddress, userAddress);
      
      if (lpBalance === '0') {
        return null;
      }

      const position = await this.createPositionFromLPBalance(userAddress, pairAddress, lpBalance);
      
      if (position) {
        await this.enrichPosition(position);
      }

      return position;
    } catch (error) {
      throw new UniswapError(
        `Failed to get V2 position for ${userAddress} in ${pairAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.POSITION_NOT_FOUND,
        this.chain,
        'v2'
      );
    }
  }

  /**
   * Validates if an address has any V2 positions
   */
  async hasPositions(address: string): Promise<boolean> {
    try {
      // Quick check - scan first 100 popular pairs
      const popularPairs = await this.contractOps.getAllPairs(0, 100);
      const lpPositions = await this.contractOps.getUserLPPositions(address, popularPairs);
      
      return lpPositions.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets scanner statistics
   */
  getStats() {
    return {
      chain: this.chain,
      protocol: 'v2',
      config: this.config
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Creates a V2 position scanner
 */
export function createV2Scanner(
  provider: ethers.Provider,
  chain: UniswapChain,
  config?: Partial<V2ScanConfig>
): V2PositionScanner {
  return new V2PositionScanner(provider, chain, config);
}

export default V2PositionScanner;