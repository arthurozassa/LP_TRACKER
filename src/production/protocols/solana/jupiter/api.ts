/**
 * Jupiter API Integration
 * Handles external API calls to Jupiter services for perpetual positions and trading data
 */

import { 
  JupiterPosition,
  SolanaExternalAPI,
  SolanaAPIConfig,
  SolanaIntegrationError
} from '../common/types';
import { retryWithBackoff } from '../common/utils';
import { ProtocolType } from '../../../../types';

// ============================================================================
// JUPITER API CONFIGURATION
// ============================================================================

export const JUPITER_API_CONFIG: SolanaExternalAPI = {
  name: 'Jupiter',
  baseUrl: 'https://jup.ag/api',
  endpoints: {
    pools: '/perpetuals/pools',
    positions: '/perpetuals/positions/{wallet}',
    prices: '/price',
    analytics: '/perpetuals/stats'
  },
  rateLimits: {
    requestsPerMinute: 600, // Jupiter has high limits
    concurrent: 20
  }
};

// Alternative endpoints for different Jupiter services
export const JUPITER_PERPS_API_CONFIG: SolanaExternalAPI = {
  name: 'Jupiter Perpetuals',
  baseUrl: 'https://perp-api.jup.ag',
  endpoints: {
    pools: '/v1/pools',
    positions: '/v1/positions',
    prices: '/v1/prices',
    analytics: '/v1/stats'
  },
  rateLimits: {
    requestsPerMinute: 300,
    concurrent: 10
  }
};

interface JupiterPoolResponse {
  address: string;
  name: string;
  symbol: string;
  custodies: Array<{
    address: string;
    symbol: string;
    decimals: number;
    oracle: string;
    pricing: {
      minPrice: string;
      maxPrice: string;
    };
    fees: {
      openPosition: string;
      closePosition: string;
      liquidation: string;
    };
    borrowRate: {
      baseRate: string;
      slope1: string;
      slope2: string;
    };
    assets: {
      owned: string;
      locked: string;
    };
    collectedFees: {
      total: string;
      swap: string;
      addRemove: string;
      borrow: string;
    };
  }>;
  stats: {
    aum: string;
    volume24h: string;
    fees24h: string;
    openInterest: string;
    totalTradingVolume: string;
    totalFees: string;
  };
}

interface JupiterPositionResponse {
  address: string;
  owner: string;
  pool: string;
  custody: string;
  side: 'long' | 'short';
  collateral: {
    address: string;
    amount: string;
    usdValue: string;
  };
  size: {
    usdValue: string;
  };
  pnl: {
    unrealized: string;
    realized: string;
    total: string;
  };
  prices: {
    entry: string;
    mark: string;
    liquidation: string;
  };
  leverage: string;
  margin: string;
  liquidationDistance: string;
  openTime: number;
  lastUpdateTime: number;
  status: 'open' | 'closed' | 'liquidated';
}

interface JupiterStatsResponse {
  totalUsers: number;
  totalTradingVolume: string;
  totalFees: string;
  totalOpenInterest: string;
  volume24h: string;
  fees24h: string;
  openInterest24hChange: string;
  topPools: Array<{
    address: string;
    name: string;
    volume24h: string;
    fees24h: string;
    aum: string;
    openInterest: string;
  }>;
  recentTrades: Array<{
    user: string;
    pool: string;
    side: string;
    size: string;
    price: string;
    timestamp: number;
    pnl: string;
  }>;
}

// ============================================================================
// API CLIENT
// ============================================================================

export class JupiterAPIClient {
  private baseUrl: string;
  private perpsUrl: string;
  private requestsThisMinute: number = 0;
  private lastResetTime: number = Date.now();
  private rateLimitConfig: SolanaAPIConfig['rateLimits'];

  constructor(config?: Partial<SolanaAPIConfig>) {
    this.baseUrl = config?.rpcUrl || JUPITER_API_CONFIG.baseUrl;
    this.perpsUrl = JUPITER_PERPS_API_CONFIG.baseUrl;
    this.rateLimitConfig = config?.rateLimits || JUPITER_API_CONFIG.rateLimits as any;
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.lastResetTime > 60000) {
      this.requestsThisMinute = 0;
      this.lastResetTime = now;
    }
    
    // Check if we're over the limit
    if (this.requestsThisMinute >= (this.rateLimitConfig as any).requestsPerMinute) {
      const waitTime = 60000 - (now - this.lastResetTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestsThisMinute = 0;
      this.lastResetTime = Date.now();
    }
    
    this.requestsThisMinute++;
  }

  private async request<T>(
    endpoint: string, 
    params: Record<string, string> = {},
    usePerpsAPI: boolean = false
  ): Promise<T> {
    await this.checkRateLimit();
    
    return retryWithBackoff(async () => {
      let url = `${usePerpsAPI ? this.perpsUrl : this.baseUrl}${endpoint}`;
      
      // Replace path parameters
      for (const [key, value] of Object.entries(params)) {
        url = url.replace(`{${key}}`, encodeURIComponent(value));
      }
      
      // Add query parameters
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (!endpoint.includes(`{${key}}`)) {
          queryParams.append(key, value);
        }
      }
      
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LP-Tracker/1.0'
        }
      }, 'Logger message');
      
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
   * Fetch Jupiter perpetual pools
   */
  async fetchPerpetualPools(): Promise<JupiterPoolResponse[]> {
    try {
      const response = await this.request<JupiterPoolResponse[]>(
        '/v1/pools',
        {},
        true // Use perps API
      );
      
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.warn('Failed to fetch Jupiter perpetual pools:', error);
      return [];
    }
  }

  /**
   * Fetch positions for a wallet
   */
  async fetchWalletPositions(walletAddress: string): Promise<JupiterPositionResponse[]> {
    try {
      const response = await this.request<JupiterPositionResponse[]>(
        `/v1/positions/${walletAddress}`,
        {},
        true // Use perps API
      );
      
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.warn(`Failed to fetch Jupiter positions for ${walletAddress}:`, error);
      return [];
    }
  }

  /**
   * Fetch overall Jupiter perpetuals statistics
   */
  async fetchStats(): Promise<JupiterStatsResponse | null> {
    try {
      const response = await this.request<JupiterStatsResponse>(
        '/v1/stats',
        {},
        true // Use perps API
      );
      
      return response;
    } catch (error) {
      console.warn('Failed to fetch Jupiter stats:', error);
      return null;
    }
  }

  /**
   * Fetch current token prices
   */
  async fetchPrices(mints: string[]): Promise<Map<string, number>> {
    try {
      const prices = new Map<string, number>();
      
      // Jupiter price API expects comma-separated mints
      const mintsParam = mints.join(',');
      
      const response = await this.request<Record<string, { price: number }>>(
        '/price',
        { ids: mintsParam },
        false // Use main API
      );
      
      for (const [mint, data] of Object.entries(response)) {
        prices.set(mint, data.price);
      }
      
      return prices;
    } catch (error) {
      console.warn('Failed to fetch prices from Jupiter:', error);
      return new Map();
    }
  }

  /**
   * Fetch pool-specific statistics
   */
  async fetchPoolStats(poolAddress: string): Promise<{
    volume24h: number;
    fees24h: number;
    aum: number;
    openInterest: number;
    apr: number;
  } | null> {
    try {
      const response = await this.request<{
        volume24h: string;
        fees24h: string;
        aum: string;
        openInterest: string;
        apr: string;
      }>(`/v1/pools/${poolAddress}/stats`, {}, true);
      
      return {
        volume24h: parseFloat(response.volume24h),
        fees24h: parseFloat(response.fees24h),
        aum: parseFloat(response.aum),
        openInterest: parseFloat(response.openInterest),
        apr: parseFloat(response.apr)
      };
    } catch (error) {
      console.warn(`Failed to fetch pool stats for ${poolAddress}:`, error);
      return null;
    }
  }

  // ============================================================================
  // DATA TRANSFORMATION
  // ============================================================================

  /**
   * Transform Jupiter API position to standard format
   */
  transformPosition(apiPosition: JupiterPositionResponse): JupiterPosition {
    const currentTime = Date.now();
    
    return {
      id: `jupiter-${apiPosition.pool}-${apiPosition.owner}`,
      protocol: 'jupiter',
      chain: 'solana' as any,
      pool: apiPosition.pool,
      
      // Position data
      liquidity: 0, // N/A for perps
      value: parseFloat(apiPosition.collateral.usdValue),
      feesEarned: Math.max(0, parseFloat(apiPosition.pnl.realized)), // Positive PnL as fees
      apr: 0, // Would calculate based on performance
      inRange: true, // Perps are always "active"
      
      // Tokens
      tokens: {
        token0: {
          address: apiPosition.collateral.address,
          symbol: 'USDC', // Most Jupiter positions use USDC
          amount: parseFloat(apiPosition.collateral.amount),
          decimals: 6
        },
        token1: {
          address: '',
          symbol: '',
          amount: 0,
          decimals: 0
        }
      },

      // Solana specific
      accounts: {
        position: apiPosition.address,
        mint0: apiPosition.collateral.address,
        mint1: '',
      },
      
      programId: 'PERPHjGBqRHArX4DySjwM6UJHiGZs9zrePdEbJ5KPY4', // Jupiter Perps program
      rewards: [],
      
      // Jupiter perp specific
      perpetuals: apiPosition.pool,
      custody: apiPosition.custody,
      owner: apiPosition.owner,
      collateralMint: apiPosition.collateral.address,
      collateralAmount: apiPosition.collateral.amount,
      sizeUsd: (parseFloat(apiPosition.size.usdValue) * 1e6).toString(), // Convert to micro USD
      collateralUsd: (parseFloat(apiPosition.collateral.usdValue) * 1e6).toString(),
      unrealizedPnlUsd: (parseFloat(apiPosition.pnl.unrealized) * 1e6).toString(),
      realizedPnlUsd: (parseFloat(apiPosition.pnl.realized) * 1e6).toString(),
      side: apiPosition.side,
      entryPrice: (parseFloat(apiPosition.prices.entry) * 1e6).toString(),
      markPrice: (parseFloat(apiPosition.prices.mark) * 1e6).toString(),
      liquidationPrice: (parseFloat(apiPosition.prices.liquidation) * 1e6).toString(),
      openTime: apiPosition.openTime,
      lastUpdateTime: apiPosition.lastUpdateTime,
      
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
 * Get enhanced Jupiter positions with API data
 */
export async function getEnhancedJupiterPositions(
  walletAddress: string,
  client?: JupiterAPIClient
): Promise<JupiterPosition[]> {
  const apiClient = client || new JupiterAPIClient();
  
  try {
    const apiPositions = await apiClient.fetchWalletPositions(walletAddress);
    return apiPositions.map(pos => apiClient.transformPosition(pos));
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to get enhanced Jupiter positions for ${walletAddress}`,
      'jupiter',
      'ENHANCEMENT_ERROR',
      error as Error
    );
  }
}

/**
 * Get Jupiter market data and statistics
 */
export async function getJupiterMarketData(
  client?: JupiterAPIClient
): Promise<{
  stats: JupiterStatsResponse | null;
  pools: JupiterPoolResponse[];
  topPools: Array<{ address: string; volume24h: number; fees24h: number; aum: number }>;
}> {
  const apiClient = client || new JupiterAPIClient();
  
  try {
    const [stats, pools] = await Promise.all([
      apiClient.fetchStats(),
      apiClient.fetchPerpetualPools()
    ]);
    
    // Extract top pools by volume
    const topPools = pools
      .map(pool => ({
        address: pool.address,
        volume24h: parseFloat(pool.stats.volume24h),
        fees24h: parseFloat(pool.stats.fees24h),
        aum: parseFloat(pool.stats.aum)
      }))
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10);
    
    return {
      stats,
      pools,
      topPools
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      'Failed to get Jupiter market data',
      'jupiter',
      'MARKET_DATA_ERROR',
      error as Error
    );
  }
}

/**
 * Get current prices for Jupiter-related tokens
 */
export async function getJupiterPrices(
  tokenMints: string[],
  client?: JupiterAPIClient
): Promise<Map<string, number>> {
  const apiClient = client || new JupiterAPIClient();
  
  try {
    return await apiClient.fetchPrices(tokenMints);
  } catch (error) {
    console.warn('Failed to fetch Jupiter prices:', error);
    return new Map();
  }
}

/**
 * Monitor Jupiter position updates
 */
export async function monitorJupiterPosition(
  positionAddress: string,
  callback: (position: JupiterPosition) => void,
  intervalMs: number = 30000
): Promise<() => void> {
  const apiClient = new JupiterAPIClient();
  let isMonitoring = true;
  
  const monitor = async () => {
    while (isMonitoring) {
      try {
        // This would need to be implemented with WebSocket or polling
        // For now, we'll just show the structure
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.warn('Error monitoring Jupiter position:', error);
      }
    }
  };
  
  // Start monitoring
  monitor();
  
  // Return cleanup function
  return () => {
    isMonitoring = false;
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  JUPITER_API_CONFIG,
  JUPITER_PERPS_API_CONFIG,
  JupiterAPIClient,
  getEnhancedJupiterPositions,
  getJupiterMarketData,
  getJupiterPrices,
  monitorJupiterPosition,
};