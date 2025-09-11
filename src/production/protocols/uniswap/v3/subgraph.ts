/**
 * Uniswap V3 Subgraph Integration
 * Handles queries to The Graph for V3 position and pool data
 */

import { request, gql } from 'graphql-request';
import { 
  UniswapChain, 
  Token, 
  PoolV3, 
  UniswapError, 
  UniswapErrorCodes,
  NetworkConfig 
} from '../common/types';
import { 
  normalizeAddress, 
  retryWithBackoff, 
  withTimeout, 
  validateToken 
} from '../common/utils';

// ============================================================================
// SUBGRAPH QUERIES
// ============================================================================

export const POSITIONS_QUERY = gql`
  query GetPositions($owner: String!, $first: Int = 1000, $skip: Int = 0) {
    positions(
      where: { owner: $owner, liquidity_gt: "0" }
      first: $first
      skip: $skip
      orderBy: liquidity
      orderDirection: desc
    ) {
      id
      owner
      liquidity
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
      collectedFeesToken0
      collectedFeesToken1
      transaction {
        id
        timestamp
        blockNumber
      }
      pool {
        id
        token0 {
          id
          symbol
          name
          decimals
        }
        token1 {
          id
          symbol
          name
          decimals
        }
        feeTier
        sqrtPrice
        tick
        liquidity
        volumeUSD
        totalValueLockedUSD
        feesUSD
        txCount
        createdAtTimestamp
        createdAtBlockNumber
      }
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      tickLower {
        tickIdx
        price0
        price1
      }
      tickUpper {
        tickIdx
        price0
        price1
      }
      feeGrowthInside0LastX128
      feeGrowthInside1LastX128
    }
  }
`;

export const POSITION_SNAPSHOTS_QUERY = gql`
  query GetPositionSnapshots($positionId: String!, $first: Int = 100) {
    positionSnapshots(
      where: { position: $positionId }
      first: $first
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      timestamp
      blockNumber
      liquidity
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
      collectedFeesToken0
      collectedFeesToken1
      feeGrowthInside0LastX128
      feeGrowthInside1LastX128
      transaction {
        id
        gasUsed
        gasPrice
      }
    }
  }
`;

export const POOLS_QUERY = gql`
  query GetPools($tokenAddresses: [String!], $first: Int = 100) {
    pools(
      where: { 
        or: [
          { token0_in: $tokenAddresses }
          { token1_in: $tokenAddresses }
        ]
        totalValueLockedUSD_gt: "1000"
      }
      first: $first
      orderBy: totalValueLockedUSD
      orderDirection: desc
    ) {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      sqrtPrice
      tick
      liquidity
      volumeUSD
      totalValueLockedUSD
      feesUSD
      txCount
      createdAtTimestamp
      createdAtBlockNumber
      token0Price
      token1Price
    }
  }
`;

export const POOL_DETAIL_QUERY = gql`
  query GetPoolDetail($poolId: String!) {
    pool(id: $poolId) {
      id
      token0 {
        id
        symbol
        name
        decimals
        derivedETH
      }
      token1 {
        id
        symbol
        name
        decimals
        derivedETH
      }
      feeTier
      sqrtPrice
      tick
      liquidity
      volumeUSD
      totalValueLockedUSD
      feesUSD
      txCount
      createdAtTimestamp
      createdAtBlockNumber
      token0Price
      token1Price
      poolDayData(first: 7, orderBy: date, orderDirection: desc) {
        date
        volumeUSD
        feesUSD
        tvlUSD
        high
        low
        open
        close
      }
      poolHourData(first: 24, orderBy: periodStartUnix, orderDirection: desc) {
        periodStartUnix
        volumeUSD
        feesUSD
        tvlUSD
        high
        low
        open
        close
      }
    }
  }
`;

export const TICKS_QUERY = gql`
  query GetTicks($poolId: String!, $tickLower: Int!, $tickUpper: Int!) {
    ticks(
      where: { 
        pool: $poolId
        tickIdx_gte: $tickLower
        tickIdx_lte: $tickUpper
      }
      orderBy: tickIdx
    ) {
      tickIdx
      liquidityGross
      liquidityNet
      price0
      price1
      volumeToken0
      volumeToken1
      volumeUSD
      feesUSD
    }
  }
`;

export const TOKEN_PRICES_QUERY = gql`
  query GetTokenPrices($tokenIds: [String!]) {
    tokens(where: { id_in: $tokenIds }) {
      id
      symbol
      name
      decimals
      derivedETH
      totalValueLocked
      totalValueLockedUSD
      volume
      volumeUSD
      feesUSD
      txCount
    }
    bundle(id: "1") {
      ethPriceUSD
    }
  }
`;

// ============================================================================
// SUBGRAPH CLIENT
// ============================================================================

export class V3SubgraphClient {
  private endpoint: string;
  private chain: UniswapChain;
  private timeout: number;
  private maxRetries: number;

  constructor(
    chain: UniswapChain,
    customEndpoint?: string,
    options: { timeout?: number; maxRetries?: number } = {}
  ) {
    this.chain = chain;
    this.timeout = options.timeout || 15000;
    this.maxRetries = options.maxRetries || 3;

    if (customEndpoint) {
      this.endpoint = customEndpoint;
    } else {
      const networkConfig = getNetworkConfig(chain);
      if (!networkConfig.subgraphs.v3) {
        throw new UniswapError(
          `V3 subgraph not available for chain: ${chain}`,
          UniswapErrorCodes.SUBGRAPH_ERROR,
          chain,
          'v3'
        );
      }
      this.endpoint = networkConfig.subgraphs.v3;
    }
  }

  /**
   * Executes a GraphQL query with retry logic
   */
  private async executeQuery<T>(query: string, variables?: any): Promise<T> {
    try {
      return await retryWithBackoff(
        async () => {
          return await withTimeout(
            request(this.endpoint, query, variables),
            this.timeout
          );
        },
        this.maxRetries,
        1000,
        10000
      );
    } catch (error) {
      throw new UniswapError(
        `Subgraph query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.SUBGRAPH_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets V3 positions for a given owner address
   */
  async getPositions(owner: string, options: { first?: number; skip?: number } = {}): Promise<V3PositionResponse[]> {
    const { first = 1000, skip = 0 } = options;
    
    try {
      const result = await this.executeQuery<{ positions: V3PositionResponse[] }>(
        POSITIONS_QUERY,
        {
          owner: normalizeAddress(owner).toLowerCase(),
          first,
          skip
        }
      );

      return result.positions || [];
    } catch (error) {
      throw new UniswapError(
        `Failed to get positions for ${owner}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.SUBGRAPH_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets all positions for an owner (handles pagination)
   */
  async getAllPositions(owner: string): Promise<V3PositionResponse[]> {
    const allPositions: V3PositionResponse[] = [];
    let skip = 0;
    const first = 1000;

    while (true) {
      const positions = await this.getPositions(owner, { first, skip });
      
      if (positions.length === 0) {
        break;
      }

      allPositions.push(...positions);
      
      if (positions.length < first) {
        break; // Last page
      }

      skip += first;
    }

    return allPositions;
  }

  /**
   * Gets position snapshots for historical analysis
   */
  async getPositionSnapshots(positionId: string, first = 100): Promise<V3PositionSnapshot[]> {
    try {
      const result = await this.executeQuery<{ positionSnapshots: V3PositionSnapshot[] }>(
        POSITION_SNAPSHOTS_QUERY,
        { positionId, first }
      );

      return result.positionSnapshots || [];
    } catch (error) {
      throw new UniswapError(
        `Failed to get position snapshots for ${positionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.SUBGRAPH_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets pools containing specific tokens
   */
  async getPoolsForTokens(tokenAddresses: string[], first = 100): Promise<V3PoolResponse[]> {
    try {
      const normalizedAddresses = tokenAddresses.map(addr => normalizeAddress(addr).toLowerCase());
      
      const result = await this.executeQuery<{ pools: V3PoolResponse[] }>(
        POOLS_QUERY,
        { tokenAddresses: normalizedAddresses, first }
      );

      return result.pools || [];
    } catch (error) {
      throw new UniswapError(
        `Failed to get pools for tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.SUBGRAPH_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets detailed information for a specific pool
   */
  async getPoolDetail(poolId: string): Promise<V3PoolDetailResponse | null> {
    try {
      const result = await this.executeQuery<{ pool: V3PoolDetailResponse | null }>(
        POOL_DETAIL_QUERY,
        { poolId: poolId.toLowerCase() }
      );

      return result.pool;
    } catch (error) {
      throw new UniswapError(
        `Failed to get pool detail for ${poolId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.SUBGRAPH_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets tick data for a pool within a range
   */
  async getTicks(poolId: string, tickLower: number, tickUpper: number): Promise<V3TickResponse[]> {
    try {
      const result = await this.executeQuery<{ ticks: V3TickResponse[] }>(
        TICKS_QUERY,
        { poolId: poolId.toLowerCase(), tickLower, tickUpper }
      );

      return result.ticks || [];
    } catch (error) {
      throw new UniswapError(
        `Failed to get ticks for pool ${poolId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.SUBGRAPH_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets token prices and metadata
   */
  async getTokenPrices(tokenIds: string[]): Promise<{ tokens: V3TokenResponse[]; ethPriceUSD: string }> {
    try {
      const normalizedIds = tokenIds.map(id => id.toLowerCase());
      
      const result = await this.executeQuery<{
        tokens: V3TokenResponse[];
        bundle: { ethPriceUSD: string };
      }>(
        TOKEN_PRICES_QUERY,
        { tokenIds: normalizedIds }
      );

      return {
        tokens: result.tokens || [],
        ethPriceUSD: result.bundle?.ethPriceUSD || '0'
      };
    } catch (error) {
      throw new UniswapError(
        `Failed to get token prices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        UniswapErrorCodes.SUBGRAPH_ERROR,
        this.chain,
        'v3'
      );
    }
  }

  /**
   * Gets subgraph health and sync status
   */
  async getSubgraphHealth(): Promise<{
    isHealthy: boolean;
    latestBlock: number;
    chainHeadBlock: number;
    syncStatus: string;
  }> {
    try {
      // Query a simple operation to check if subgraph is responding
      const result = await this.executeQuery<{ _meta: any }>(
        gql`query { _meta { block { number } hasIndexingErrors } }`,
        {}
      );

      const latestBlock = result._meta?.block?.number || 0;
      const hasErrors = result._meta?.hasIndexingErrors || false;

      return {
        isHealthy: !hasErrors,
        latestBlock,
        chainHeadBlock: latestBlock, // Approximation
        syncStatus: hasErrors ? 'error' : 'synced'
      };
    } catch (error) {
      return {
        isHealthy: false,
        latestBlock: 0,
        chainHeadBlock: 0,
        syncStatus: 'error'
      };
    }
  }
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface V3PositionResponse {
  id: string;
  owner: string;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
  transaction: {
    id: string;
    timestamp: string;
    blockNumber: string;
  };
  pool: V3PoolResponse;
  token0: V3TokenResponse;
  token1: V3TokenResponse;
  tickLower: {
    tickIdx: string;
    price0: string;
    price1: string;
  };
  tickUpper: {
    tickIdx: string;
    price0: string;
    price1: string;
  };
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
}

export interface V3PositionSnapshot {
  id: string;
  timestamp: string;
  blockNumber: string;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
  transaction: {
    id: string;
    gasUsed: string;
    gasPrice: string;
  };
}

export interface V3PoolResponse {
  id: string;
  token0: V3TokenResponse;
  token1: V3TokenResponse;
  feeTier: string;
  sqrtPrice: string;
  tick: string;
  liquidity: string;
  volumeUSD: string;
  totalValueLockedUSD: string;
  feesUSD: string;
  txCount: string;
  createdAtTimestamp: string;
  createdAtBlockNumber: string;
  token0Price: string;
  token1Price: string;
}

export interface V3PoolDetailResponse extends V3PoolResponse {
  poolDayData: {
    date: number;
    volumeUSD: string;
    feesUSD: string;
    tvlUSD: string;
    high: string;
    low: string;
    open: string;
    close: string;
  }[];
  poolHourData: {
    periodStartUnix: number;
    volumeUSD: string;
    feesUSD: string;
    tvlUSD: string;
    high: string;
    low: string;
    open: string;
    close: string;
  }[];
}

export interface V3TokenResponse {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
  derivedETH?: string;
  totalValueLocked?: string;
  totalValueLockedUSD?: string;
  volume?: string;
  volumeUSD?: string;
  feesUSD?: string;
  txCount?: string;
}

export interface V3TickResponse {
  tickIdx: string;
  liquidityGross: string;
  liquidityNet: string;
  price0: string;
  price1: string;
  volumeToken0: string;
  volumeToken1: string;
  volumeUSD: string;
  feesUSD: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts subgraph token response to internal Token format
 */
export function subgraphTokenToToken(tokenResponse: V3TokenResponse, chainId: number): Token {
  const token: Token = {
    address: normalizeAddress(tokenResponse.id),
    symbol: tokenResponse.symbol,
    name: tokenResponse.name,
    decimals: parseInt(tokenResponse.decimals),
    chainId
  };

  if (!validateToken(token)) {
    throw new UniswapError(
      `Invalid token data from subgraph: ${tokenResponse.id}`,
      UniswapErrorCodes.INVALID_TOKEN
    );
  }

  return token;
}

/**
 * Converts subgraph pool response to internal PoolV3 format
 */
export function subgraphPoolToPoolV3(poolResponse: V3PoolResponse, chainId: number): PoolV3 {
  const token0 = subgraphTokenToToken(poolResponse.token0, chainId);
  const token1 = subgraphTokenToToken(poolResponse.token1, chainId);

  return {
    id: poolResponse.id,
    address: normalizeAddress(poolResponse.id),
    token0,
    token1,
    fee: parseInt(poolResponse.feeTier),
    sqrtPriceX96: poolResponse.sqrtPrice,
    tick: parseInt(poolResponse.tick),
    liquidity: poolResponse.liquidity,
    tickSpacing: getTickSpacing(parseInt(poolResponse.feeTier)),
    tvlUSD: parseFloat(poolResponse.totalValueLockedUSD || '0'),
    volumeUSD24h: parseFloat(poolResponse.volumeUSD || '0'),
    feesUSD24h: parseFloat(poolResponse.feesUSD || '0'),
    createdAt: new Date(parseInt(poolResponse.createdAtTimestamp) * 1000)
  };
}

/**
 * Gets tick spacing for a fee tier
 */
export function getTickSpacing(feeTier: number): number {
  switch (feeTier) {
    case 100: return 1;
    case 500: return 10;
    case 3000: return 60;
    case 10000: return 200;
    default: return 60;
  }
}

/**
 * Creates a V3 subgraph client for a specific chain
 */
export function createV3SubgraphClient(
  chain: UniswapChain,
  customEndpoint?: string,
  options?: { timeout?: number; maxRetries?: number }
): V3SubgraphClient {
  return new V3SubgraphClient(chain, customEndpoint, options);
}

export default V3SubgraphClient;