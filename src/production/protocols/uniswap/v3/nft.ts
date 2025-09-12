/**
 * Uniswap V3 NFT Position Manager
 * Handles V3 NFT positions and on-chain data retrieval
 */

import { ethers } from 'ethers'; // Removed string for compatibility
import { 
  Token,
  UniswapChain, 
  UniswapError, 
  UniswapErrorCodes,
  NFT_POSITION_MANAGER_ABI,
  ERC20_ABI,
  NetworkConfig
} from '../common/types';
import { 
  normalizeAddress, 
  formatTokenAmount, 
  retryWithBackoff, 
  withTimeout,
  batchArray,
  validateToken
} from '../common/utils';

// ============================================================================
// NFT POSITION INTERFACES
// ============================================================================

export interface NFTPositionData {
  tokenId: string;
  nonce: string;
  operator: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
  tokensOwed0: string;
  tokensOwed1: string;
}

export interface NFTPositionInfo {
  tokenId: string;
  owner: string;
  position: NFTPositionData;
  token0Metadata: Token;
  token1Metadata: Token;
  isActive: boolean;
  collectableTokens0: string;
  collectableTokens1: string;
}

export interface NFTCollectionSummary {
  totalPositions: number;
  activePositions: number;
  totalValueUSD: number;
  totalFeesCollectable: number;
  tokenIds: string[];
}

// ============================================================================
// NFT POSITION MANAGER CONTRACT
// ============================================================================

export class V3NFTPositionManager {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private chain: UniswapChain;
  private networkConfig: any;

  constructor(provider: ethers.Provider, chain: UniswapChain) {
    this.provider = provider;
    this.chain = chain;
    // TODO: Get network config for chain
    this.networkConfig = { contracts: { nftPositionManager: '' } } as any;

    if (!this.networkConfig.contracts.nftPositionManager) {
      throw new UniswapError(
        `NFT Position Manager not available on ${chain}`,
        UniswapErrorCodes.UNSUPPORTED_CHAIN,
        chain,
        'v3'
      );
    }

    this.contract = new ethers.Contract(
      this.networkConfig.contracts.nftPositionManager,
      NFT_POSITION_MANAGER_ABI,
      provider
    );
  }

  /**
   * Gets all NFT token IDs owned by an address
   */
  async getTokenIds(owner: string): Promise<string[]> {
    try {
      const ownerAddress = normalizeAddress(owner);
      
      const balance = await retryWithBackoff(async () => {
        return await withTimeout(
          this.contract.balanceOf(ownerAddress),
          10000
        );
      });

      if (balance === '0') {
        return [];
      }

      // Get all token IDs
      const tokenIds: string[] = [];
      const balanceNumber = balance.toNumber();

      // Process in batches to avoid RPC limits
      const batchSize = 20;
      for (let i = 0; i < balanceNumber; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, balanceNumber);
        const promises: Promise<string>[] = [];

        for (let j = i; j < batchEnd; j++) {
          promises.push(
            retryWithBackoff(async () => {
              return await withTimeout(
                this.contract.tokenOfOwnerByIndex(ownerAddress, j),
                10000
              );
            })
          );
        }

        const batchResults = await Promise.allSettled(promises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            tokenIds.push(result.value.toString());
          }
        }
      }

      return tokenIds;
    } catch (error) {
      throw new UniswapError(
        `Failed to get token IDs for ${owner}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CONTRACT_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets position data for a specific token ID
   */
  async getPosition(tokenId: string): Promise<NFTPositionData> {
    try {
      const result = await retryWithBackoff(async () => {
        return await withTimeout(
          this.contract.positions(tokenId),
          10000
        );
      });

      return {
        tokenId: tokenId.toString(),
        nonce: result.nonce,
        operator: result.operator,
        token0: normalizeAddress(result.token0),
        token1: normalizeAddress(result.token1),
        fee: result.fee,
        tickLower: result.tickLower,
        tickUpper: result.tickUpper,
        liquidity: result.liquidity,
        feeGrowthInside0LastX128: result.feeGrowthInside0LastX128,
        feeGrowthInside1LastX128: result.feeGrowthInside1LastX128,
        tokensOwed0: result.tokensOwed0,
        tokensOwed1: result.tokensOwed1
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to get position for token ID ${tokenId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CONTRACT_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets multiple positions in batch
   */
  async getPositions(tokenIds: string[]): Promise<Map<string, NFTPositionData>> {
    const positions = new Map<string, NFTPositionData>();
    const batchSize = 10;

    const batches = batchArray(tokenIds, batchSize);

    for (const batch of batches) {
      const promises = batch.map(async (tokenId) => {
        try {
          const position = await this.getPosition(tokenId);
          return { tokenId, position };
        } catch (error) {
          console.warn(`Failed to get position for token ID ${tokenId}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result) {
          positions.set(result.tokenId, result.position);
        }
      }
    }

    return positions;
  }

  /**
   * Gets full position info including token metadata
   */
  async getPositionInfo(tokenId: string, owner: string): Promise<NFTPositionInfo> {
    try {
      const position = await this.getPosition(tokenId);
      
      // Get token metadata
      const [token0Metadata, token1Metadata] = await Promise.all([
        this.getTokenMetadata(position.token0),
        this.getTokenMetadata(position.token1)
      ]);

      // Calculate collectable tokens (fees + principal if position is closed)
      const collectableTokens0 = position.tokensOwed0;
      const collectableTokens1 = position.tokensOwed1;

      const isActive = position.liquidity !== '0';

      return {
        tokenId,
        owner: normalizeAddress(owner),
        position,
        token0Metadata,
        token1Metadata,
        isActive,
        collectableTokens0,
        collectableTokens1
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to get position info for token ID ${tokenId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CONTRACT_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets token metadata from contract
   */
  private async getTokenMetadata(tokenAddress: string): Promise<Token> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider
      );

      const [decimals, symbol, name] = await Promise.all([
        retryWithBackoff(() => withTimeout(tokenContract.decimals(), 10000)),
        retryWithBackoff(() => withTimeout(tokenContract.symbol(), 10000)),
        retryWithBackoff(() => withTimeout(tokenContract.name(), 10000))
      ]);

      const token: Token = {
        address: normalizeAddress(tokenAddress),
        symbol,
        name,
        decimals,
        chainId: this.networkConfig.chainId
      };

      if (!validateToken(token)) {
        throw new Error('Invalid token data received');
      }

      return token;
    } catch (error) {
      throw new UniswapError(
        `Failed to get token metadata for ${tokenAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.INVALID_TOKEN,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets comprehensive collection summary for an owner
   */
  async getCollectionSummary(owner: string): Promise<NFTCollectionSummary> {
    try {
      const tokenIds = await this.getTokenIds(owner);
      
      if (tokenIds.length === 0) {
        return {
          totalPositions: 0,
          activePositions: 0,
          totalValueUSD: 0,
          totalFeesCollectable: 0,
          tokenIds: []
        };
      }

      const positions = await this.getPositions(tokenIds);
      
      let activePositions = 0;
      let totalValueUSD = 0;
      let totalFeesCollectable = 0;

      positions.forEach((position, tokenId) => {
        if (position.liquidity !== '0') {
          activePositions++;
        }

        // Would need price data to calculate accurate USD values
        // For now, we'll use placeholder calculations
        const feesCollectable = parseFloat(formatTokenAmount(position.tokensOwed0, 18)) +
                              parseFloat(formatTokenAmount(position.tokensOwed1, 18));
        totalFeesCollectable += feesCollectable;
      });

      return {
        totalPositions: tokenIds.length,
        activePositions,
        totalValueUSD,
        totalFeesCollectable,
        tokenIds
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to get collection summary for ${owner}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CONTRACT_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Checks if a position is in range
   */
  isPositionInRange(position: NFTPositionData, currentTick: number): boolean {
    return currentTick >= position.tickLower && currentTick <= position.tickUpper;
  }

  /**
   * Calculates position's tick range width
   */
  calculateRangeWidth(position: NFTPositionData): number {
    return position.tickUpper - position.tickLower;
  }

  /**
   * Estimates gas cost for collecting fees
   */
  async estimateCollectGas(tokenId: string, recipient: string): Promise<string> {
    try {
      const collectParams = {
        tokenId,
        recipient: normalizeAddress(recipient),
        amount0Max: ethers.MaxUint256, // Using MaxUint256 in ethers v6
        amount1Max: ethers.MaxUint256
      };

      return await this.contract.estimateGas.collect(collectParams);
    } catch (error) {
      // Return reasonable default if estimation fails
      return "150000"; // Typical collect gas usage
    }
  }

  /**
   * Gets the NFT Position Manager contract address
   */
  getContractAddress(): string {
    return this.contract.address;
  }

  /**
   * Gets provider for external use
   */
  getProvider(): ethers.Provider {
    return this.provider;
  }

  /**
   * Validates if a token ID exists and is owned by the specified address
   */
  async validateOwnership(tokenId: string, expectedOwner: string): Promise<boolean> {
    try {
      const ownerTokenIds = await this.getTokenIds(expectedOwner);
      return ownerTokenIds.includes(tokenId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets position history for a token ID (would need event logs)
   */
  async getPositionHistory(tokenId: string, fromBlock = 0): Promise<{
    mints: any[];
    burns: any[];
    collects: any[];
  }> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const toBlock = currentBlock;

      // Get events from the NFT Position Manager
      const mintFilter = this.contract.filters.IncreaseLiquidity(tokenId);
      const burnFilter = this.contract.filters.DecreaseLiquidity(tokenId);
      const collectFilter = this.contract.filters.Collect(tokenId);

      const [mints, burns, collects] = await Promise.all([
        this.contract.queryFilter(mintFilter, fromBlock, toBlock),
        this.contract.queryFilter(burnFilter, fromBlock, toBlock),
        this.contract.queryFilter(collectFilter, fromBlock, toBlock)
      ]);

      return {
        mints: mints.map(event => ({
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          args: event.args
        })),
        burns: burns.map(event => ({
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          args: event.args
        })),
        collects: collects.map(event => ({
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          args: event.args
        }))
      };
    } catch (error) {
      console.warn(`Failed to get position history for token ID ${tokenId}:`, error);
      return {
        mints: [],
        burns: [],
        collects: []
      };
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates tick to price conversion
 */
export function tickToPrice(tick: number, token0Decimals: number, token1Decimals: number): number {
  const price = Math.pow(1.0001, tick);
  return price * Math.pow(10, token0Decimals - token1Decimals);
}

/**
 * Calculates price to tick conversion
 */
export function priceToTick(price: number, token0Decimals: number, token1Decimals: number): number {
  const adjustedPrice = price / Math.pow(10, token0Decimals - token1Decimals);
  return Math.floor(Math.log(adjustedPrice) / Math.log(1.0001));
}

/**
 * Gets the nearest tick for a given tick spacing
 */
export function getNearestTick(tick: number, tickSpacing: number): number {
  return Math.floor(tick / tickSpacing) * tickSpacing;
}

/**
 * Calculates the percentage of a position that is in range
 */
export function calculateInRangePercentage(
  tickLower: number,
  tickUpper: number,
  currentTick: number
): number {
  if (currentTick < tickLower || currentTick > tickUpper) {
    return 0; // Completely out of range
  }
  
  // Position is in range
  return 100;
}

/**
 * Creates NFT Position Manager instance
 */
export function createV3NFTPositionManager(
  provider: ethers.providers.Provider,
  chain: UniswapChain
): V3NFTPositionManager {
  return new V3NFTPositionManager(provider, chain);
}

export default V3NFTPositionManager;