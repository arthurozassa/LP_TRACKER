/**
 * Uniswap V3 Position Scanner
 * Combines subgraph data with on-chain NFT position data for comprehensive V3 scanning
 */

import { ethers, string } from 'ethers';
import { 
  UniswapV3Position, 
  UniswapChain, 
  Token, 
  PoolV3, 
  ScanParams, 
  UniswapError, 
  UniswapErrorCodes,
  PositionScanProgress
} from '../common/types';
import { 
  createTokenAmount, 
  formatTokenAmount, 
  measureExecutionTime,
  normalizeAddress
} from '../common/utils';
import { 
  V3SubgraphClient, 
  createV3SubgraphClient, 
  V3PositionResponse,
  subgraphPoolToPoolV3,
  subgraphTokenToToken
} from './subgraph';
import { 
  V3NFTPositionManager, 
  createV3NFTPositionManager,
  NFTPositionInfo,
  tickToPrice,
  calculateInRangePercentage
} from './nft';
import { V3Calculator } from './calculations';

// ============================================================================
// SCANNER CONFIGURATION
// ============================================================================

export interface V3ScanConfig {
  useSubgraph: boolean;
  useOnChain: boolean;
  includeInactive: boolean;
  minLiquidityUSD: number;
  maxPositions: number;
  timeout: number;
  retryCount: number;
}

export const DEFAULT_V3_SCAN_CONFIG: V3ScanConfig = {
  useSubgraph: true,
  useOnChain: true,
  includeInactive: false,
  minLiquidityUSD: 1,
  maxPositions: 1000,
  timeout: 60000,
  retryCount: 3
};

// ============================================================================
// POSITION SCANNER
// ============================================================================

export class V3PositionScanner {
  private subgraphClient: V3SubgraphClient;
  private nftManager: V3NFTPositionManager;
  private calculator: V3Calculator;
  private chain: UniswapChain;
  private config: V3ScanConfig;
  private networkConfig: any;

  constructor(
    provider: ethers.Provider,
    chain: UniswapChain,
    config: Partial<V3ScanConfig> = {}
  ) {
    this.chain = chain;
    this.config = { ...DEFAULT_V3_SCAN_CONFIG, ...config };
    
    try {
      if (this.config.useSubgraph) {
        this.subgraphClient = createV3SubgraphClient(chain);
      }
      
      if (this.config.useOnChain) {
        this.nftManager = createV3NFTPositionManager(provider, chain);
      }
      
      this.calculator = new V3Calculator();
    } catch (error) {
      throw new UniswapError(
        `Failed to initialize V3 scanner for ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.UNSUPPORTED_CHAIN,
        chain,
        'v3'
      );
    }
  }

  /**
   * Scans for V3 positions using both subgraph and on-chain data
   */
  async scanPositions(address: string, onProgress?: (progress: PositionScanProgress) => void): Promise<UniswapV3Position[]> {
    const progress: PositionScanProgress = {
      chain: this.chain,
      protocol: 'v3',
      status: 'scanning',
      positionsFound: 0
    };

    if (onProgress) onProgress(progress);

    try {
      const { result: positions } = await measureExecutionTime(
        `V3 scan for ${address} on ${this.chain}`,
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
  private async performScan(address: string, onProgress?: (progress: PositionScanProgress) => void): Promise<UniswapV3Position[]> {
    const positions: UniswapV3Position[] = [];
    
    // Strategy 1: Use subgraph data (faster, more comprehensive)
    if (this.config.useSubgraph && this.subgraphClient) {
      try {
        const subgraphPositions = await this.scanWithSubgraph(address, onProgress);
        positions.push(...subgraphPositions);
      } catch (error) {
        console.warn(`Subgraph scan failed for ${address}:`, error);
        
        // Fall back to on-chain if subgraph fails
        if (this.config.useOnChain && this.nftManager) {
          const onChainPositions = await this.scanWithOnChain(address, onProgress);
          positions.push(...onChainPositions);
        }
      }
    }
    
    // Strategy 2: Use on-chain data (slower, always accurate)
    else if (this.config.useOnChain && this.nftManager) {
      const onChainPositions = await this.scanWithOnChain(address, onProgress);
      positions.push(...onChainPositions);
    }

    // Filter positions based on config
    const filteredPositions = positions.filter(pos => {
      if (!this.config.includeInactive && !pos.isActive) {
        return false;
      }
      
      if (pos.liquidityUSD < this.config.minLiquidityUSD) {
        return false;
      }
      
      return true;
    });

    // Limit number of positions
    return filteredPositions.slice(0, this.config.maxPositions);
  }

  /**
   * Scans positions using subgraph data
   */
  private async scanWithSubgraph(address: string, onProgress?: (progress: PositionScanProgress) => void): Promise<UniswapV3Position[]> {
    const positions: UniswapV3Position[] = [];
    
    // Get all positions from subgraph
    const subgraphPositions = await this.subgraphClient.getAllPositions(address);
    
    for (let i = 0; i < subgraphPositions.length; i++) {
      const subgraphPosition = subgraphPositions[i];
      
      try {
        const position = await this.convertSubgraphPosition(subgraphPosition, address);
        if (position) {
          positions.push(position);
        }
      } catch (error) {
        console.warn(`Failed to convert subgraph position ${subgraphPosition.id}:`, error);
      }

      // Update progress periodically
      if (onProgress && i % 10 === 0) {
        onProgress({
          chain: this.chain,
          protocol: 'v3',
          status: 'scanning',
          positionsFound: positions.length
        });
      }
    }

    return positions;
  }

  /**
   * Scans positions using on-chain NFT data
   */
  private async scanWithOnChain(address: string, onProgress?: (progress: PositionScanProgress) => void): Promise<UniswapV3Position[]> {
    const positions: UniswapV3Position[] = [];
    
    // Get NFT token IDs owned by address
    const tokenIds = await this.nftManager.getTokenIds(address);
    
    if (tokenIds.length === 0) {
      return positions;
    }

    // Get position data for each token ID
    const nftPositions = await this.nftManager.getPositions(tokenIds);
    
    let processed = 0;
    for (const [tokenId, nftPosition] of nftPositions) {
      try {
        const positionInfo = await this.nftManager.getPositionInfo(tokenId, address);
        const position = await this.convertNFTPosition(positionInfo);
        
        if (position) {
          positions.push(position);
        }
      } catch (error) {
        console.warn(`Failed to convert NFT position ${tokenId}:`, error);
      }

      processed++;
      
      // Update progress
      if (onProgress && processed % 5 === 0) {
        onProgress({
          chain: this.chain,
          protocol: 'v3',
          status: 'scanning',
          positionsFound: positions.length
        });
      }
    }

    return positions;
  }

  /**
   * Converts subgraph position data to internal format
   */
  private async convertSubgraphPosition(subgraphPos: V3PositionResponse, owner: string): Promise<UniswapV3Position | null> {
    try {
      const networkConfig = this.networkConfig || { chainId: 1 };
      
      // Convert pool data
      const pool = subgraphPoolToPoolV3(subgraphPos.pool, networkConfig.chainId);
      
      // Convert token data
      const token0 = subgraphTokenToToken(subgraphPos.token0, networkConfig.chainId);
      const token1 = subgraphTokenToToken(subgraphPos.token1, networkConfig.chainId);

      // Calculate current tick and price info
      const currentTick = parseInt(subgraphPos.pool.tick);
      const tickLower = parseInt(subgraphPos.tickLower.tickIdx);
      const tickUpper = parseInt(subgraphPos.tickUpper.tickIdx);
      
      const inRange = currentTick >= tickLower && currentTick <= tickUpper;
      
      // Calculate price ranges
      const priceLower = tickToPrice(tickLower, token0.decimals, token1.decimals);
      const priceUpper = tickToPrice(tickUpper, token0.decimals, token1.decimals);
      const currentPrice = tickToPrice(currentTick, token0.decimals, token1.decimals);

      // Create token amounts (would need current liquidity calculation)
      const liquidityBN = string.from(subgraphPos.liquidity);
      const token0Amount = createTokenAmount(token0, '0'); // Would need calculation
      const token1Amount = createTokenAmount(token1, '0'); // Would need calculation

      // Create fees amounts
      const feesEarned0 = createTokenAmount(token0, subgraphPos.collectedFeesToken0 || '0');
      const feesEarned1 = createTokenAmount(token1, subgraphPos.collectedFeesToken1 || '0');

      const position: UniswapV3Position = {
        id: subgraphPos.id,
        protocol: 'uniswap-v3',
        chain: this.chain,
        pool,
        owner: owner.toLowerCase(),
        
        // Liquidity info
        liquidity: subgraphPos.liquidity,
        liquidityUSD: 0, // Would need price calculation
        
        // Token amounts
        token0Amount,
        token1Amount,
        
        // Fee information
        feesEarned0,
        feesEarned1,
        feesEarnedUSD: 0, // Would need price calculation
        
        // Performance metrics
        apr: 0,
        apy: 0,
        impermanentLoss: 0,
        
        // V3 specific
        tokenId: subgraphPos.id.split('#')[1] || subgraphPos.id,
        tickLower,
        tickUpper,
        inRange,
        priceLower,
        priceUpper,
        priceRange: {
          min: priceLower.toString(),
          max: priceUpper.toString(),
          current: currentPrice.toString()
        },
        feeGrowthInside0LastX128: subgraphPos.feeGrowthInside0LastX128,
        feeGrowthInside1LastX128: subgraphPos.feeGrowthInside1LastX128,
        tokensOwed0: '0',
        tokensOwed1: '0',
        
        // Metadata
        createdAt: new Date(parseInt(subgraphPos.transaction.timestamp) * 1000),
        lastUpdate: new Date(),
        isActive: !liquidityBN.isZero()
      };

      return position;
    } catch (error) {
      console.warn(`Failed to convert subgraph position:`, error);
      return null;
    }
  }

  /**
   * Converts NFT position data to internal format
   */
  private async convertNFTPosition(nftInfo: NFTPositionInfo): Promise<UniswapV3Position | null> {
    try {
      const position = nftInfo.position;
      
      // Get pool data (would need to query pool contract or subgraph)
      const pool: PoolV3 = {
        id: `${position.token0.toLowerCase()}-${position.token1.toLowerCase()}-${position.fee}`,
        address: '0x', // Would need to calculate pool address
        token0: nftInfo.token0Metadata,
        token1: nftInfo.token1Metadata,
        fee: position.fee,
        sqrtPriceX96: '0', // Would need from pool contract
        tick: 0, // Would need from pool contract
        liquidity: '0', // Would need from pool contract
        tickSpacing: this.getTickSpacing(position.fee),
        tvlUSD: 0,
        volumeUSD24h: 0,
        feesUSD24h: 0,
        createdAt: new Date()
      };

      // Calculate if position is in range (would need current tick)
      const inRange = true; // Placeholder
      
      // Calculate price ranges
      const priceLower = tickToPrice(position.tickLower, nftInfo.token0Metadata.decimals, nftInfo.token1Metadata.decimals);
      const priceUpper = tickToPrice(position.tickUpper, nftInfo.token0Metadata.decimals, nftInfo.token1Metadata.decimals);

      // Create token amounts (would need current calculation based on liquidity)
      const token0Amount = createTokenAmount(nftInfo.token0Metadata, '0');
      const token1Amount = createTokenAmount(nftInfo.token1Metadata, '0');

      // Create fees amounts
      const feesEarned0 = createTokenAmount(nftInfo.token0Metadata, position.tokensOwed0);
      const feesEarned1 = createTokenAmount(nftInfo.token1Metadata, position.tokensOwed1);

      const v3Position: UniswapV3Position = {
        id: `nft-${nftInfo.tokenId}`,
        protocol: 'uniswap-v3',
        chain: this.chain,
        pool,
        owner: nftInfo.owner.toLowerCase(),
        
        // Liquidity info
        liquidity: position.liquidity.toString(),
        liquidityUSD: 0, // Would need price calculation
        
        // Token amounts
        token0Amount,
        token1Amount,
        
        // Fee information
        feesEarned0,
        feesEarned1,
        feesEarnedUSD: 0, // Would need price calculation
        
        // Performance metrics
        apr: 0,
        apy: 0,
        impermanentLoss: 0,
        
        // V3 specific
        tokenId: nftInfo.tokenId,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        inRange,
        priceLower,
        priceUpper,
        priceRange: {
          min: priceLower.toString(),
          max: priceUpper.toString(),
          current: '0' // Would need current price
        },
        feeGrowthInside0LastX128: position.feeGrowthInside0LastX128.toString(),
        feeGrowthInside1LastX128: position.feeGrowthInside1LastX128.toString(),
        tokensOwed0: position.tokensOwed0.toString(),
        tokensOwed1: position.tokensOwed1.toString(),
        
        // Metadata
        createdAt: new Date(), // Would need from transaction history
        lastUpdate: new Date(),
        isActive: nftInfo.isActive
      };

      return v3Position;
    } catch (error) {
      console.warn(`Failed to convert NFT position:`, error);
      return null;
    }
  }

  /**
   * Gets tick spacing for fee tier
   */
  private getTickSpacing(fee: number): number {
    switch (fee) {
      case 100: return 1;
      case 500: return 10;
      case 3000: return 60;
      case 10000: return 200;
      default: return 60;
    }
  }

  /**
   * Gets a specific position by token ID
   */
  async getPosition(tokenId: string, owner: string): Promise<UniswapV3Position | null> {
    try {
      if (this.config.useOnChain && this.nftManager) {
        const positionInfo = await this.nftManager.getPositionInfo(tokenId, owner);
        return await this.convertNFTPosition(positionInfo);
      }
      
      if (this.config.useSubgraph && this.subgraphClient) {
        // Would need to query subgraph by token ID
        const positions = await this.subgraphClient.getPositions(owner, { first: 1000 });
        const subgraphPos = positions.find(p => p.id.includes(tokenId));
        
        if (subgraphPos) {
          return await this.convertSubgraphPosition(subgraphPos, owner);
        }
      }
      
      return null;
    } catch (error) {
      throw new UniswapError(
        `Failed to get V3 position ${tokenId} for ${owner}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.POSITION_NOT_FOUND,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Checks if an address has any V3 positions
   */
  async hasPositions(address: string): Promise<boolean> {
    try {
      if (this.config.useOnChain && this.nftManager) {
        const tokenIds = await this.nftManager.getTokenIds(address);
        return tokenIds.length > 0;
      }
      
      if (this.config.useSubgraph && this.subgraphClient) {
        const positions = await this.subgraphClient.getPositions(address, { first: 1 });
        return positions.length > 0;
      }
      
      return false;
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
      protocol: 'v3',
      config: this.config,
      subgraphAvailable: !!this.subgraphClient,
      onChainAvailable: !!this.nftManager
    };
  }

  /**
   * Gets subgraph health
   */
  async getSubgraphHealth() {
    if (!this.subgraphClient) {
      return { isHealthy: false, error: 'Subgraph client not available' };
    }
    
    try {
      return await this.subgraphClient.getSubgraphHealth();
    } catch (error) {
      return { 
        isHealthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Creates a V3 position scanner
 */
export function createV3Scanner(
  provider: ethers.Provider,
  chain: UniswapChain,
  config?: Partial<V3ScanConfig>
): V3PositionScanner {
  return new V3PositionScanner(provider, chain, config);
}

export default V3PositionScanner;