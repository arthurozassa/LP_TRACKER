import { YieldOptimization, TimeSeriesDataPoint } from '../types';

// DeFiLlama API configuration
const DEFILLAMA_API_BASE = 'https://api.llama.fi';
const YIELDS_API_BASE = 'https://yields.llama.fi';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const REQUEST_DELAY = 500; // 500ms delay between requests

// Cache for API responses
const cache = new Map<string, { data: any; timestamp: number }>();

// Rate limiting
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < REQUEST_DELAY) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url);
}

function getCacheKey(endpoint: string, params: Record<string, any>): string {
  return `${endpoint}_${JSON.stringify(params)}`;
}

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION;
}

interface ProtocolInfo {
  id: string;
  name: string;
  address?: string;
  symbol: string;
  url: string;
  description: string;
  chain: string;
  logo: string;
  audits: string;
  audit_note: string;
  gecko_id: string;
  cmcId: string;
  category: string;
  chains: string[];
  module: string;
  twitter: string;
  forkedFrom: string[];
  oracles: string[];
  listedAt: number;
  methodology: string;
  slug: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  tokenBreakdowns: Record<string, number>;
  mcap: number;
}

interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apy: number;
  rewardTokens: string[];
  pool: string;
  apyPct1D: number;
  apyPct7D: number;
  apyPct30D: number;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  predictions: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  };
  poolMeta: string;
  mu: number;
  sigma: number;
  count: number;
  outlier: boolean;
  underlyingTokens: string[];
  url: string;
}

export class DefiLlamaService {
  // Get protocol information
  async getProtocol(slug: string): Promise<ProtocolInfo | null> {
    const cacheKey = getCacheKey('protocol', { slug });
    const cached = cache.get(cacheKey);
    
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const url = `${DEFILLAMA_API_BASE}/protocol/${slug}`;
      const response = await rateLimitedFetch(url);
      
      if (!response.ok) {
        throw new Error(`DeFiLlama API error: ${response.status}`);
      }
      
      const data = await response.json();
      cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`Error fetching protocol ${slug}:`, error);
      return null;
    }
  }

  // Get TVL history for a protocol
  async getProtocolTVL(slug: string): Promise<TimeSeriesDataPoint[]> {
    const cacheKey = getCacheKey('protocol_tvl', { slug });
    const cached = cache.get(cacheKey);
    
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const url = `${DEFILLAMA_API_BASE}/protocol/${slug}`;
      const response = await rateLimitedFetch(url);
      
      if (!response.ok) {
        throw new Error(`DeFiLlama API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      const tvlHistory: TimeSeriesDataPoint[] = data.chainTvls?.Ethereum || data.tvl || [];
      const formattedHistory = tvlHistory.map((point: any) => ({
        timestamp: new Date(point.date * 1000).toISOString(),
        value: point.totalLiquidityUSD || point.tvl || 0,
        volume: 0
      }));
      
      cache.set(cacheKey, { data: formattedHistory, timestamp: Date.now() });
      return formattedHistory;
    } catch (error) {
      console.error(`Error fetching TVL for ${slug}:`, error);
      return [];
    }
  }

  // Get yield farming pools
  async getYieldPools(chain?: string): Promise<YieldPool[]> {
    const cacheKey = getCacheKey('yield_pools', { chain: chain || 'all' });
    const cached = cache.get(cacheKey);
    
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const url = chain 
        ? `${YIELDS_API_BASE}/pools?chain=${chain}`
        : `${YIELDS_API_BASE}/pools`;
      
      const response = await rateLimitedFetch(url);
      
      if (!response.ok) {
        throw new Error(`DeFiLlama Yields API error: ${response.status}`);
      }
      
      const data = await response.json();
      const pools = data.data || [];
      
      cache.set(cacheKey, { data: pools, timestamp: Date.now() });
      return pools;
    } catch (error) {
      console.error('Error fetching yield pools:', error);
      return this.getMockYieldPools();
    }
  }

  // Get best yield opportunities for optimization
  async getYieldOptimization(
    userProtocols: string[],
    minTVL: number = 1000000,
    chains: string[] = ['Ethereum', 'Arbitrum', 'Polygon']
  ): Promise<YieldOptimization> {
    try {
      const allPools = await this.getYieldPools();
      
      // Filter pools by criteria
      const suitablePools = allPools.filter(pool => 
        chains.includes(pool.chain) &&
        pool.tvlUsd >= minTVL &&
        !pool.outlier &&
        pool.apy > 0 &&
        pool.apy < 1000 // Remove unrealistic APYs
      );

      // Sort by APY
      const topPools = suitablePools
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 20);

      // Calculate current user APR
      const currentAPR = userProtocols.length > 0 ? 15 : 0; // Mock calculation

      // Generate suggestions
      const suggestedActions = [];
      
      // Find better opportunities
      const betterPools = topPools.filter(pool => pool.apy > currentAPR + 2);
      
      if (betterPools.length > 0) {
        suggestedActions.push({
          action: 'enter' as const,
          protocol: betterPools[0].project,
          pool: betterPools[0].symbol,
          expectedAPR: betterPools[0].apy,
          risk: this.assessRisk(betterPools[0]),
          reasoning: `Higher APY available: ${betterPools[0].apy.toFixed(2)}% vs current ${currentAPR.toFixed(2)}%`,
          urgency: betterPools[0].apy > currentAPR + 10 ? 'high' as const : 'medium' as const
        });
      }

      // Check for rebalancing opportunities
      if (userProtocols.some(protocol => protocol.includes('uniswap'))) {
        const uniswapAlternatives = topPools.filter(pool => 
          pool.project.toLowerCase().includes('sushi') || 
          pool.project.toLowerCase().includes('curve')
        );
        
        if (uniswapAlternatives.length > 0 && uniswapAlternatives[0].apy > currentAPR) {
          suggestedActions.push({
            action: 'rebalance' as const,
            protocol: uniswapAlternatives[0].project,
            pool: uniswapAlternatives[0].symbol,
            expectedAPR: uniswapAlternatives[0].apy,
            risk: this.assessRisk(uniswapAlternatives[0]),
            reasoning: 'Similar protocols with better yields available',
            urgency: 'low' as const
          });
        }
      }

      // Best opportunities
      const bestOpportunities = topPools.slice(0, 10).map(pool => ({
        protocol: pool.project,
        pool: pool.symbol,
        apr: pool.apy,
        tvl: pool.tvlUsd,
        volume24h: 0, // Not available in this API
        risk: this.assessRisk(pool)
      }));

      return {
        currentAPR,
        suggestedActions,
        bestOpportunities
      };

    } catch (error) {
      console.error('Error getting yield optimization:', error);
      return this.getMockYieldOptimization();
    }
  }

  // Get protocol statistics for comparison
  async getProtocolStats(protocols: string[]): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    for (const protocol of protocols) {
      try {
        const protocolData = await this.getProtocol(protocol);
        if (protocolData) {
          stats[protocol] = {
            tvl: protocolData.tvl,
            change1d: protocolData.change_1d,
            change7d: protocolData.change_7d,
            chains: protocolData.chains,
            category: protocolData.category
          };
        }
      } catch (error) {
        console.error(`Error fetching stats for ${protocol}:`, error);
      }
    }
    
    return stats;
  }

  // Assess risk level for a yield pool
  private assessRisk(pool: YieldPool): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    // TVL risk (lower TVL = higher risk)
    if (pool.tvlUsd < 1000000) riskScore += 2;
    else if (pool.tvlUsd < 10000000) riskScore += 1;
    
    // APY risk (extremely high APY = higher risk)
    if (pool.apy > 100) riskScore += 2;
    else if (pool.apy > 50) riskScore += 1;
    
    // Stablecoin risk (non-stablecoin = higher risk)
    if (!pool.stablecoin) riskScore += 1;
    
    // Impermanent loss risk
    if (pool.ilRisk === 'yes' || pool.exposure === 'multi') riskScore += 1;
    
    // Outlier check
    if (pool.outlier) riskScore += 2;
    
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  // Mock data for development
  private getMockYieldPools(): YieldPool[] {
    return [
      {
        chain: 'Ethereum',
        project: 'Uniswap',
        symbol: 'USDC-ETH',
        tvlUsd: 50000000,
        apyBase: 8.5,
        apyReward: 3.2,
        apy: 11.7,
        rewardTokens: ['UNI'],
        pool: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
        apyPct1D: 0.1,
        apyPct7D: -0.5,
        apyPct30D: 2.3,
        stablecoin: false,
        ilRisk: 'yes',
        exposure: 'multi',
        predictions: {
          predictedClass: 'stable',
          predictedProbability: 0.85,
          binnedConfidence: 3
        },
        poolMeta: 'V3 0.05%',
        mu: 0.12,
        sigma: 0.15,
        count: 365,
        outlier: false,
        underlyingTokens: ['USDC', 'WETH'],
        url: 'https://app.uniswap.org/#/pool/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'
      },
      {
        chain: 'Ethereum',
        project: 'Curve',
        symbol: '3Pool',
        tvlUsd: 80000000,
        apyBase: 12.3,
        apyReward: 8.7,
        apy: 21.0,
        rewardTokens: ['CRV'],
        pool: '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
        apyPct1D: -0.2,
        apyPct7D: 1.1,
        apyPct30D: -3.2,
        stablecoin: true,
        ilRisk: 'no',
        exposure: 'stablecoins',
        predictions: {
          predictedClass: 'stable',
          predictedProbability: 0.92,
          binnedConfidence: 4
        },
        poolMeta: 'Stableswap',
        mu: 0.21,
        sigma: 0.08,
        count: 365,
        outlier: false,
        underlyingTokens: ['DAI', 'USDC', 'USDT'],
        url: 'https://curve.fi/#/ethereum/pools/3pool'
      }
    ];
  }

  private getMockYieldOptimization(): YieldOptimization {
    return {
      currentAPR: 15.5,
      suggestedActions: [
        {
          action: 'enter',
          protocol: 'Curve',
          pool: 'stETH-ETH',
          expectedAPR: 24.2,
          risk: 'medium',
          reasoning: 'Higher yields available with acceptable risk',
          urgency: 'medium'
        },
        {
          action: 'rebalance',
          protocol: 'Balancer',
          pool: 'BAL-WETH',
          expectedAPR: 18.7,
          risk: 'low',
          reasoning: 'Better risk-adjusted returns',
          urgency: 'low'
        }
      ],
      bestOpportunities: [
        {
          protocol: 'Curve',
          pool: 'stETH-ETH',
          apr: 24.2,
          tvl: 125000000,
          volume24h: 5000000,
          risk: 'medium'
        },
        {
          protocol: 'Balancer',
          pool: 'BAL-WETH',
          apr: 18.7,
          tvl: 45000000,
          volume24h: 2000000,
          risk: 'low'
        }
      ]
    };
  }
}

// Singleton instance
export const defiLlamaService = new DefiLlamaService();