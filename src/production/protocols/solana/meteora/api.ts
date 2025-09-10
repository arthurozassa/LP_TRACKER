/**
 * Meteora API Integration
 * Handles external API calls to Meteora services for pool data, analytics, and prices
 */

import { 
  MeteoraPool, 
  MeteoraPosition,
  SolanaExternalAPI,
  SolanaAPIConfig,
  SolanaIntegrationError
} from '../common/types';
import { retryWithBackoff } from '../common/utils';
import { ProtocolType } from '../../../../types';

// ============================================================================
// METEORA API CONFIGURATION
// ============================================================================

export const METEORA_API_CONFIG: SolanaExternalAPI = {
  name: 'Meteora',
  baseUrl: 'https://dlmm-api.meteora.ag',
  endpoints: {
    pools: '/pair/all',
    positions: '/user-positions',
    prices: '/pair/{pairAddress}/price',
    analytics: '/pair/{pairAddress}/stats'
  },
  rateLimits: {
    requestsPerMinute: 120,
    concurrent: 10
  }
};

interface MeteoraPoolResponse {
  address: string;
  name: string;
  mint_x: string;
  mint_y: string;
  reserve_x: string;
  reserve_y: string;
  bin_step: number;
  base_fee_percentage: number;
  max_fee_percentage: number;
  protocol_fee_percentage: number;
  liquidity: string;
  reward_infos: Array<{
    address: string;
    vault: string;
    funder: string;
    reward_duration: number;
    reward_duration_end: number;
    reward_rate: string;
    last_update_time: number;
  }>;
  fees_24h: number;
  today_fees: number;
  trade_volume_24h: number;
  cumulative_trade_volume: string;
  cumulative_fee_volume: string;
  current_price: number;
  apr: number;
  apy: number;
  farm_apr: number;
  farm_apy: number;
  hide: boolean;
  activation_slot: number;
}

interface MeteoraPositionResponse {
  position_address: string;
  lb_pair: string;
  owner: string;
  liquidity: string;
  total_x_amount: string;
  total_y_amount: string;
  bin_data: Array<{
    bin_id: number;
    x_amount: string;
    y_amount: string;
    liquidity_share: string;
    bin_liquidity: string;
  }>;
  unclaimed_fee_x: string;
  unclaimed_fee_y: string;
  unclaimed_rewards: Array<{
    address: string;
    amount: string;
  }>;
  position_value_usd: number;
  fee_value_usd: number;
  reward_value_usd: number;
  total_value_usd: number;
}

interface MeteoraPoolStatsResponse {
  address: string;
  volume_24h: number;
  fees_24h: number;
  tvl: number;
  price_change_24h: number;
  apr: number;
  apy: number;
  active_bin: number;
  bin_step: number;
  liquidity: string;
  total_bins: number;
  active_bins: number;
}

// ============================================================================
// API CLIENT
// ============================================================================

export class MeteoraAPIClient {
  private baseUrl: string;
  private requestsThisMinute: number = 0;
  private lastResetTime: number = Date.now();
  private rateLimitConfig: SolanaAPIConfig['rateLimits'];

  constructor(config?: Partial<SolanaAPIConfig>) {
    this.baseUrl = config?.rpcUrl || METEORA_API_CONFIG.baseUrl;
    this.rateLimitConfig = config?.rateLimits || METEORA_API_CONFIG.rateLimits as any;
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.lastResetTime > 60000) {
      this.requestsThisMinute = 0;
      this.lastResetTime = now;
    }
    
    // Check if we're over the limit
    if (this.requestsThisMinute >= this.rateLimitConfig.requestsPerSecond * 60) {
      const waitTime = 60000 - (now - this.lastResetTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestsThisMinute = 0;
      this.lastResetTime = Date.now();
    }
    
    this.requestsThisMinute++;
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    await this.checkRateLimit();
    
    return retryWithBackoff(async () => {
      let url = `${this.baseUrl}${endpoint}`;
      
      // Replace path parameters
      for (const [key, value] of Object.entries(params)) {
        url = url.replace(`{${key}}`, encodeURIComponent(value));
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LP-Tracker/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    }, 3, 1000);
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /**
   * Fetch all Meteora pools
   */
  async fetchPools(): Promise<MeteoraPool[]> {
    try {
      const response = await this.request<MeteoraPoolResponse[]>(
        METEORA_API_CONFIG.endpoints.pools
      );
      
      return response.map(pool => this.transformPoolResponse(pool));
    } catch (error) {
      throw new SolanaIntegrationError(
        'Failed to fetch Meteora pools from API',
        'meteora-dlmm',
        'API_ERROR',
        error as Error
      );
    }
  }

  /**
   * Fetch pool statistics
   */
  async fetchPoolStats(poolAddress: string): Promise<MeteoraPoolStatsResponse> {
    try {
      const response = await this.request<MeteoraPoolStatsResponse>(
        METEORA_API_CONFIG.endpoints.analytics,
        { pairAddress: poolAddress }
      );
      
      return response;
    } catch (error) {
      throw new SolanaIntegrationError(
        `Failed to fetch pool stats for ${poolAddress}`,
        'meteora-dlmm',
        'API_ERROR',
        error as Error
      );
    }
  }

  /**
   * Fetch current pool price
   */
  async fetchPoolPrice(poolAddress: string): Promise<number> {
    try {
      const response = await this.request<{ price: number }>(
        METEORA_API_CONFIG.endpoints.prices,
        { pairAddress: poolAddress }
      );
      
      return response.price;
    } catch (error) {
      throw new SolanaIntegrationError(
        `Failed to fetch pool price for ${poolAddress}`,
        'meteora-dlmm',
        'API_ERROR',
        error as Error
      );
    }
  }

  /**
   * Fetch user positions
   */
  async fetchUserPositions(walletAddress: string): Promise<MeteoraPosition[]> {
    try {
      const response = await this.request<MeteoraPositionResponse[]>(
        `${METEORA_API_CONFIG.endpoints.positions}/${walletAddress}`
      );
      
      return response.map(position => this.transformPositionResponse(position));
    } catch (error) {
      console.warn(`Failed to fetch Meteora positions for ${walletAddress}:`, error);
      return []; // Return empty array instead of throwing
    }
  }

  // ============================================================================
  // DATA TRANSFORMATION
  // ============================================================================

  private transformPoolResponse(pool: MeteoraPoolResponse): MeteoraPool {
    const currentTime = Date.now();
    
    return {
      address: pool.address,
      programId: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
      
      tokenA: {
        address: pool.mint_x,
        vault: '', // Not provided by API
        decimals: 9, // Default, would need to fetch from mint
        symbol: 'UNKNOWN',
        reserve: pool.reserve_x
      },
      
      tokenB: {
        address: pool.mint_y,
        vault: '', // Not provided by API
        decimals: 9, // Default, would need to fetch from mint
        symbol: 'UNKNOWN',
        reserve: pool.reserve_y
      },
      
      feeRate: pool.base_fee_percentage,
      
      // DLMM specific
      binStep: pool.bin_step,
      activeId: 0, // Not provided by this endpoint
      reserve: {
        tokenX: pool.reserve_x,
        tokenY: pool.reserve_y
      },
      binArray: '',
      oracle: '',
      parameters: {
        baseFactor: 0,
        filterPeriod: 0,
        decayPeriod: 0,
        reductionFactor: 0,
        variableFeeControl: 0,
        maxVolatilityAccumulator: 0,
        minBinId: 0,
        maxBinId: 0
      },
      
      // Statistics
      volume24h: pool.trade_volume_24h,
      fees24h: pool.fees_24h,
      tvl: Number(pool.liquidity),
      apr: pool.apr,
      
      // Metadata
      lastSlot: 0,
      createdAt: currentTime
    };
  }

  private transformPositionResponse(position: MeteoraPositionResponse): MeteoraPosition {
    const currentTime = Date.now();
    
    const binPositions = position.bin_data.map(bin => ({
      binId: bin.bin_id,
      xAmount: bin.x_amount,
      yAmount: bin.y_amount,
      price: Math.pow(1.0001, bin.bin_id), // Calculate price from bin ID
      liquidity: bin.bin_liquidity,
      feeX: '0', // Not provided
      feeY: '0'  // Not provided
    }));

    return {
      id: `meteora-${position.lb_pair}-${position.owner}`,
      protocol: 'meteora-dlmm',
      chain: 'solana' as any,
      pool: position.lb_pair,
      
      // Position data
      liquidity: Number(position.liquidity),
      value: position.total_value_usd,
      feesEarned: position.fee_value_usd,
      apr: 0, // Would calculate
      inRange: true, // DLMM is always in range
      
      // Tokens
      tokens: {
        token0: {
          address: '', // Would get from pool
          symbol: 'UNKNOWN',
          amount: Number(position.total_x_amount),
          decimals: 9
        },
        token1: {
          address: '', // Would get from pool
          symbol: 'UNKNOWN',
          amount: Number(position.total_y_amount),
          decimals: 9
        }
      },

      // Solana specific
      accounts: {
        position: position.position_address,
        mint0: '',
        mint1: ''
      },
      
      programId: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
      rewards: [], // Would transform reward data
      
      // DLMM specific
      binStep: 0, // Would get from pool
      activeId: 0, // Would get from pool
      minBinId: Math.min(...binPositions.map(p => p.binId)),
      maxBinId: Math.max(...binPositions.map(p => p.binId)),
      binPositions,
      
      unclaimedFees: {
        tokenX: position.unclaimed_fee_x,
        tokenY: position.unclaimed_fee_y
      },
      
      unclaimedRewards: position.unclaimed_rewards.map(reward => ({
        address: reward.address,
        amount: reward.amount
      })),
      
      // Metadata
      lastSlot: 0,
      createdAt: currentTime.toString(),
      updatedAt: currentTime.toString()
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get pool data with statistics
 */
export async function getMeteoraPoolData(
  poolAddress: string,
  client?: MeteoraAPIClient
): Promise<{ pool: MeteoraPool; stats: MeteoraPoolStatsResponse }> {
  const apiClient = client || new MeteoraAPIClient();
  
  try {
    const [pools, stats] = await Promise.all([
      apiClient.fetchPools(),
      apiClient.fetchPoolStats(poolAddress)
    ]);
    
    const pool = pools.find(p => p.address === poolAddress);
    if (!pool) {
      throw new Error(`Pool ${poolAddress} not found`);
    }
    
    return { pool, stats };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to get pool data for ${poolAddress}`,
      'meteora-dlmm',
      'POOL_DATA_ERROR',
      error as Error
    );
  }
}

/**
 * Get enhanced positions with pool context
 */
export async function getEnhancedMeteoraPositions(
  walletAddress: string,
  client?: MeteoraAPIClient
): Promise<MeteoraPosition[]> {
  const apiClient = client || new MeteoraAPIClient();
  
  try {
    const [positions, pools] = await Promise.all([
      apiClient.fetchUserPositions(walletAddress),
      apiClient.fetchPools()
    ]);
    
    // Create pool lookup map
    const poolMap = new Map(pools.map(pool => [pool.address, pool]));
    
    // Enhance positions with pool data
    return positions.map(position => {
      const pool = poolMap.get(position.pool);
      if (pool) {
        position.binStep = pool.binStep;
        position.activeId = pool.activeId;
        position.tokens.token0.address = pool.tokenA.address;
        position.tokens.token1.address = pool.tokenB.address;
        position.accounts.mint0 = pool.tokenA.address;
        position.accounts.mint1 = pool.tokenB.address;
      }
      return position;
    });
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to get enhanced positions for ${walletAddress}`,
      'meteora-dlmm',
      'POSITION_ENHANCEMENT_ERROR',
      error as Error
    );
  }
}

/**
 * Get real-time pool prices for multiple pools
 */
export async function getMeteoraPoolPrices(
  poolAddresses: string[],
  client?: MeteoraAPIClient
): Promise<Map<string, number>> {
  const apiClient = client || new MeteoraAPIClient();
  const prices = new Map<string, number>();
  
  // Batch requests to respect rate limits
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < poolAddresses.length; i += BATCH_SIZE) {
    const batch = poolAddresses.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (poolAddress) => {
      try {
        const price = await apiClient.fetchPoolPrice(poolAddress);
        return { poolAddress, price };
      } catch (error) {
        console.warn(`Failed to fetch price for pool ${poolAddress}:`, error);
        return { poolAddress, price: 0 };
      }
    });
    
    const results = await Promise.allSettled(batchPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        prices.set(result.value.poolAddress, result.value.price);
      }
    }
    
    // Add delay between batches to respect rate limits
    if (i + BATCH_SIZE < poolAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return prices;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  METEORA_API_CONFIG,
  MeteoraAPIClient,
  getMeteoraPoolData,
  getEnhancedMeteoraPositions,
  getMeteoraPoolPrices,
};