/**
 * Uniswap V2 Contract Interactions
 * Handles direct contract calls for V2 pools and positions
 */

import { ethers } from 'ethers'; // Removed string import for compatibility
import { 
  Token, 
  PoolV2, 
  UniswapChain, 
  UniswapError, 
  UniswapErrorCodes,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  ERC20_ABI
} from '../common/types';
import { 
  normalizeAddress, 
  sortTokens, 
  formatTokenAmount, 
  retryWithBackoff,
  withTimeout,
  validateToken,
  getNetworkConfig
} from '../common/utils';

// ============================================================================
// CONTRACT INTERFACES
// ============================================================================

export interface V2FactoryContract {
  getPair(tokenA: string, tokenB: string): Promise<string>;
  allPairs(index: string): Promise<string>;
  allPairsLength(): Promise<string>;
}

export interface V2PairContract {
  getReserves(): Promise<{
    reserve0: string;
    reserve1: string;
    blockTimestampLast: number;
  }>;
  token0(): Promise<string>;
  token1(): Promise<string>;
  totalSupply(): Promise<string>;
  balanceOf(address: string): Promise<string>;
  kLast(): Promise<string>;
}

export interface ERC20Contract {
  decimals(): Promise<number>;
  symbol(): Promise<string>;
  name(): Promise<string>;
  balanceOf(address: string): Promise<string>;
}

// ============================================================================
// CONTRACT FACTORY
// ============================================================================

export class V2ContractFactory {
  private provider: ethers.Provider;
  private chain: UniswapChain;
  private networkConfig: any;

  constructor(provider: ethers.Provider, chain: UniswapChain) {
    this.provider = provider;
    this.chain = chain;
    this.networkConfig = getNetworkConfig(chain);
    
    if (!this.networkConfig.contracts.v2Factory) {
      throw new UniswapError(
        `Uniswap V2 not available on ${chain}`,
        UniswapErrorCodes.UNSUPPORTED_CHAIN,
        chain,
        'v2'
      );
    }
  }

  /**
   * Creates a V2 Factory contract instance
   */
  getFactoryContract(): ethers.Contract {
    return new ethers.Contract(
      this.networkConfig.contracts.v2Factory,
      UNISWAP_V2_FACTORY_ABI,
      this.provider
    );
  }

  /**
   * Creates a V2 Pair contract instance
   */
  getPairContract(pairAddress: string): ethers.Contract {
    return new ethers.Contract(
      normalizeAddress(pairAddress),
      UNISWAP_V2_PAIR_ABI,
      this.provider
    );
  }

  /**
   * Creates an ERC20 contract instance
   */
  getERC20Contract(tokenAddress: string): ethers.Contract {
    return new ethers.Contract(
      normalizeAddress(tokenAddress),
      ERC20_ABI,
      this.provider
    );
  }

  /**
   * Gets provider for read operations
   */
  getProvider(): ethers.Provider {
    return this.provider;
  }

  /**
   * Gets chain for this factory
   */
  getChain(): UniswapChain {
    return this.chain;
  }
}

// ============================================================================
// CONTRACT OPERATIONS
// ============================================================================

export class V2ContractOperations {
  private contractFactory: V2ContractFactory;
  private factoryContract: ethers.Contract;

  constructor(contractFactory: V2ContractFactory) {
    this.contractFactory = contractFactory;
    this.factoryContract = contractFactory.getFactoryContract();
  }

  /**
   * Gets pair address for two tokens
   */
  async getPairAddress(tokenA: string, tokenB: string): Promise<string | null> {
    try {
      const [token0, token1] = sortTokens(tokenA, tokenB);
      
      const pairAddress = await retryWithBackoff(async () => {
        return await withTimeout(
          this.factoryContract.getPair(token0, token1),
          10000
        );
      }, 'Logger message');

      // Check if pair exists (address is not zero)
      if (pairAddress === ethers.ZeroAddress) {
        return null;
      }

      return normalizeAddress(pairAddress);
    } catch (error) {
      throw new UniswapError(
        `Failed to get pair address for ${tokenA}/${tokenB}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CONTRACT_ERROR,
        this.contractFactory.getChain(),
        'v2'
      );
    }
  }

  /**
   * Gets all pairs from factory (paginated)
   */
  async getAllPairs(startIndex = 0, endIndex?: number): Promise<string[]> {
    try {
      const totalPairs = await this.getTotalPairsCount();
      const actualEndIndex = endIndex ? Math.min(endIndex, totalPairs) : totalPairs;
      
      if (startIndex >= totalPairs) {
        return [];
      }

      const pairs: string[] = [];
      const batchSize = 100; // Process in batches to avoid RPC limits
      
      for (let i = startIndex; i < actualEndIndex; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, actualEndIndex);
        const batchPromises: Promise<string>[] = [];
        
        for (let j = i; j < batchEnd; j++) {
          batchPromises.push(
            retryWithBackoff(async () => {
              return await withTimeout(
                this.factoryContract.allPairs(j),
                10000
              );
            })
          );
        }
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            pairs.push(normalizeAddress(result.value));
          }
        }
      }
      
      return pairs;
    } catch (error) {
      throw new UniswapError(
        `Failed to get all pairs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CONTRACT_ERROR,
        this.contractFactory.getChain(),
        'v2'
      );
    }
  }

  /**
   * Gets total number of pairs in factory
   */
  async getTotalPairsCount(): Promise<number> {
    try {
      const count = await retryWithBackoff(async () => {
        return await withTimeout(
          this.factoryContract.allPairsLength(),
          10000
        );
      }, 'Logger message');
      
      return count.toNumber();
    } catch (error) {
      throw new UniswapError(
        `Failed to get total pairs count: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CONTRACT_ERROR,
        this.contractFactory.getChain(),
        'v2'
      );
    }
  }

  /**
   * Gets pair reserves and metadata
   */
  async getPairData(pairAddress: string): Promise<{
    token0Address: string;
    token1Address: string;
    reserve0: string;
    reserve1: string;
    totalSupply: string;
    blockTimestampLast: number;
  }> {
    try {
      const pairContract = this.contractFactory.getPairContract(pairAddress);
      
      const [reservesResult, token0Address, token1Address, totalSupply] = await Promise.all([
        retryWithBackoff(() => withTimeout(pairContract.getReserves(), 10000)),
        retryWithBackoff(() => withTimeout(pairContract.token0(), 10000)),
        retryWithBackoff(() => withTimeout(pairContract.token1(), 10000)),
        retryWithBackoff(() => withTimeout(pairContract.totalSupply(), 10000))
      ]);

      return {
        token0Address: normalizeAddress(token0Address),
        token1Address: normalizeAddress(token1Address),
        reserve0: reservesResult.reserve0,
        reserve1: reservesResult.reserve1,
        totalSupply,
        blockTimestampLast: reservesResult.blockTimestampLast
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to get pair data for ${pairAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CONTRACT_ERROR,
        this.contractFactory.getChain(),
        'v2'
      );
    }
  }

  /**
   * Gets LP token balance for an address
   */
  async getLPBalance(pairAddress: string, userAddress: string): Promise<string> {
    try {
      const pairContract = this.contractFactory.getPairContract(pairAddress);
      
      return await retryWithBackoff(async () => {
        return await withTimeout(
          pairContract.balanceOf(normalizeAddress(userAddress)),
          10000
        );
      }, 'Logger message');
    } catch (error) {
      throw new UniswapError(
        `Failed to get LP balance for ${userAddress} in ${pairAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.CONTRACT_ERROR,
        this.contractFactory.getChain(),
        'v2'
      );
    }
  }

  /**
   * Gets token metadata
   */
  async getTokenMetadata(tokenAddress: string): Promise<Token> {
    try {
      const tokenContract = this.contractFactory.getERC20Contract(tokenAddress);
      const networkConfig = getNetworkConfig(this.contractFactory.getChain());
      
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
        chainId: networkConfig.chainId
      };

      if (!validateToken(token)) {
        throw new Error('Invalid token data received');
      }

      return token;
    } catch (error) {
      throw new UniswapError(
        `Failed to get token metadata for ${tokenAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.INVALID_TOKEN,
        this.contractFactory.getChain(),
        'v2'
      );
    }
  }

  /**
   * Gets multiple token metadata in batch
   */
  async getTokensMetadata(tokenAddresses: string[]): Promise<Map<string, Token>> {
    const tokens = new Map<string, Token>();
    const batchSize = 10;
    
    for (let i = 0; i < tokenAddresses.length; i += batchSize) {
      const batch = tokenAddresses.slice(i, i + batchSize);
      const promises = batch.map(address => 
        this.getTokenMetadata(address).catch(error => {
          console.warn(`Failed to get metadata for token ${address}:`, error.message);
          return null;
        })
      );
      
      const results = await Promise.all(promises);
      
      for (let j = 0; j < results.length; j++) {
        const token = results[j];
        if (token) {
          tokens.set(token.address.toLowerCase(), token);
        }
      }
    }
    
    return tokens;
  }

  /**
   * Checks if a pair has sufficient liquidity
   */
  async hasMinimumLiquidity(pairAddress: string, minReserveUSD = 1000): Promise<boolean> {
    try {
      const pairData = await this.getPairData(pairAddress);
      
      // This is a basic check - in production you'd want to get USD values
      // For now, we just check that reserves are not zero
      return pairData.reserve0 !== '0' && pairData.reserve1 !== '0';
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets user's LP positions across multiple pairs
   */
  async getUserLPPositions(userAddress: string, pairAddresses: string[]): Promise<{
    pairAddress: string;
    balance: string;
    hasPosition: boolean;
  }[]> {
    const batchSize = 20;
    const results: {
      pairAddress: string;
      balance: string;
      hasPosition: boolean;
    }[] = [];

    for (let i = 0; i < pairAddresses.length; i += batchSize) {
      const batch = pairAddresses.slice(i, i + batchSize);
      const promises = batch.map(async (pairAddress) => {
        try {
          const balance = await this.getLPBalance(pairAddress, userAddress);
          return {
            pairAddress,
            balance,
            hasPosition: balance !== '0'
          };
        } catch (error) {
          return {
            pairAddress,
            balance: '0',
            hasPosition: false
          };
        }
      }, 'Logger message');

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results.filter(result => result.hasPosition);
  }

  /**
   * Gets detailed pair information including tokens
   */
  async getDetailedPairInfo(pairAddress: string): Promise<{
    address: string;
    token0: Token;
    token1: Token;
    reserve0: string;
    reserve1: string;
    totalSupply: string;
    blockTimestampLast: number;
  }> {
    const pairData = await this.getPairData(pairAddress);
    
    const [token0, token1] = await Promise.all([
      this.getTokenMetadata(pairData.token0Address),
      this.getTokenMetadata(pairData.token1Address)
    ]);

    return {
      address: normalizeAddress(pairAddress),
      token0,
      token1,
      reserve0: pairData.reserve0,
      reserve1: pairData.reserve1,
      totalSupply: pairData.totalSupply,
      blockTimestampLast: pairData.blockTimestampLast
    };
  }
}

// ============================================================================
// EXPORT FACTORY FUNCTION
// ============================================================================

/**
 * Creates V2 contract operations instance
 */
export function createV2ContractOperations(
  provider: ethers.Provider,
  chain: UniswapChain
): V2ContractOperations {
  const contractFactory = new V2ContractFactory(provider, chain);
  return new V2ContractOperations(contractFactory);
}

export default V2ContractOperations;