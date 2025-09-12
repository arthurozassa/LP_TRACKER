import { TimeSeriesDataPoint, HistoricalData, MarketBenchmark } from '../types';

// CoinGecko API configuration
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const REQUEST_DELAY = 1000; // 1 second delay between requests (rate limiting)

// Token ID mappings for CoinGecko
const TOKEN_IDS = {
  ETH: 'ethereum',
  BTC: 'bitcoin', 
  SOL: 'solana',
  USDC: 'usd-coin',
  USDT: 'tether',
  WBTC: 'wrapped-bitcoin',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  SUSHI: 'sushi',
  CRV: 'curve-dao-token',
  BAL: 'balancer',
  AAVE: 'aave',
  COMP: 'compound-governance-token'
} as const;

// Cache for API responses
const cache = new Map<string, { data: any; timestamp: number }>();

// Rate limiting queue
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

export class HistoricalDataService {
  // Get historical prices for a single token
  async getTokenHistory(
    tokenId: string, 
    days: number = 30,
    currency: string = 'usd'
  ): Promise<TimeSeriesDataPoint[]> {
    const cacheKey = getCacheKey('price_history', { tokenId, days, currency });
    const cached = cache.get(cacheKey);
    
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    try {
      const url = `/api/market-data?coin=${tokenId}&vs_currency=${currency}&days=${days}&interval=${days > 7 ? 'daily' : 'hourly'}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      const priceData: TimeSeriesDataPoint[] = data.prices.map((point: [number, number]) => ({
        timestamp: new Date(point[0]).toISOString(),
        value: point[1],
        price: point[1],
        volume: data.total_volumes.find((v: [number, number]) => v[0] === point[0])?.[1] || 0
      }));
      
      cache.set(cacheKey, { data: priceData, timestamp: Date.now() });
      return priceData;
    } catch (error) {
      console.error(`Error fetching price history for ${tokenId}:`, error);
      // Return mock data for development
      return this.generateMockPriceHistory(days);
    }
  }

  // Get market benchmarks (ETH, BTC, SOL)
  async getMarketBenchmarks(days: number = 30): Promise<MarketBenchmark[]> {
    const benchmarks = ['ethereum', 'bitcoin', 'solana'];
    const results: MarketBenchmark[] = [];
    
    for (const tokenId of benchmarks) {
      try {
        const history = await this.getTokenHistory(tokenId, days);
        const currentPrice = history[history.length - 1]?.value || 0;
        const price24hAgo = history[history.length - 2]?.value || currentPrice;
        const price7dAgo = history[Math.max(0, history.length - 7)]?.value || currentPrice;
        const price30dAgo = history[0]?.value || currentPrice;
        
        results.push({
          asset: tokenId.toUpperCase() as 'ETH' | 'BTC' | 'SOL',
          symbol: tokenId.toUpperCase(),
          price: currentPrice,
          change24h: ((currentPrice - price24hAgo) / price24hAgo) * 100,
          change7d: ((currentPrice - price7dAgo) / price7dAgo) * 100,
          change30d: ((currentPrice - price30dAgo) / price30dAgo) * 100,
          correlation: 0, // Will be calculated later
          beta: 1
        });
      } catch (error) {
        console.error(`Error fetching benchmark data for ${tokenId}:`, error);
      }
    }
    
    return results;
  }

  // Calculate portfolio historical value
  async calculatePortfolioHistory(
    positions: any[],
    days: number = 30
  ): Promise<TimeSeriesDataPoint[]> {
    if (!positions.length) return [];
    
    // Get unique tokens from positions
    const uniqueTokens = new Set<string>();
    positions.forEach(position => {
      if (position.tokens?.token0?.symbol) {
        uniqueTokens.add(position.tokens.token0.symbol.toLowerCase());
      }
      if (position.tokens?.token1?.symbol) {
        uniqueTokens.add(position.tokens.token1.symbol.toLowerCase());
      }
    });
    
    // Get price history for each token
    const tokenHistories = new Map<string, TimeSeriesDataPoint[]>();
    
    for (const token of Array.from(uniqueTokens)) {
      const tokenId = this.getTokenId(token);
      if (tokenId) {
        const history = await this.getTokenHistory(tokenId, days);
        tokenHistories.set(token, history);
      }
    }
    
    // Calculate portfolio value over time
    const portfolioHistory: TimeSeriesDataPoint[] = [];
    const timestamps = tokenHistories.values().next().value?.map((p: TimeSeriesDataPoint) => p.timestamp) || [];
    
    timestamps.forEach((timestamp: string, index: number) => {
      let totalValue = 0;
      let totalFees = 0;
      let totalIL = 0;
      
      positions.forEach(position => {
        const token0Symbol = position.tokens?.token0?.symbol?.toLowerCase();
        const token1Symbol = position.tokens?.token1?.symbol?.toLowerCase();
        
        const token0History = token0Symbol ? tokenHistories.get(token0Symbol) : null;
        const token1History = token1Symbol ? tokenHistories.get(token1Symbol) : null;
        
        const token0Price = token0History?.[index]?.price || 0;
        const token1Price = token1History?.[index]?.price || 0;
        
        const token0Value = (position.tokens?.token0?.amount || 0) * token0Price;
        const token1Value = (position.tokens?.token1?.amount || 0) * token1Price;
        
        totalValue += token0Value + token1Value;
        totalFees += (position.feesEarned || 0) * (index / timestamps.length);
        totalIL += (position.impermanentLoss || 0) * (index / timestamps.length);
      });
      
      portfolioHistory.push({
        timestamp,
        value: totalValue,
        fees: totalFees,
        impermanentLoss: totalIL
      });
    });
    
    return portfolioHistory;
  }

  // Calculate HODL comparison
  async calculateHodlComparison(
    positions: any[],
    days: number = 30
  ): Promise<TimeSeriesDataPoint[]> {
    if (!positions.length) return [];
    
    // Calculate initial token allocation
    const initialAllocation = new Map<string, number>();
    let totalInitialValue = 0;
    
    positions.forEach(position => {
      const token0Symbol = position.tokens?.token0?.symbol?.toLowerCase();
      const token1Symbol = position.tokens?.token1?.symbol?.toLowerCase();
      const token0Amount = position.tokens?.token0?.amount || 0;
      const token1Amount = position.tokens?.token1?.amount || 0;
      
      initialAllocation.set(token0Symbol, (initialAllocation.get(token0Symbol) || 0) + token0Amount);
      initialAllocation.set(token1Symbol, (initialAllocation.get(token1Symbol) || 0) + token1Amount);
      
      totalInitialValue += position.value || 0;
    });
    
    // Get price histories for all tokens
    const tokenHistories = new Map<string, TimeSeriesDataPoint[]>();
    for (const [token] of Array.from(initialAllocation.entries())) {
      const tokenId = this.getTokenId(token);
      if (tokenId) {
        const history = await this.getTokenHistory(tokenId, days);
        tokenHistories.set(token, history);
      }
    }
    
    // Calculate HODL value over time
    const hodlHistory: TimeSeriesDataPoint[] = [];
    const timestamps = tokenHistories.values().next().value?.map((p: TimeSeriesDataPoint) => p.timestamp) || [];
    
    timestamps.forEach((timestamp: string, index: number) => {
      let hodlValue = 0;
      
      initialAllocation.forEach((amount, token) => {
        const tokenHistory = tokenHistories.get(token);
        const price = tokenHistory?.[index]?.price || 0;
        hodlValue += amount * price;
      });
      
      hodlHistory.push({
        timestamp,
        value: hodlValue,
        hodlValue
      });
    });
    
    return hodlHistory;
  }

  // Generate mock price history for development
  private generateMockPriceHistory(days: number): TimeSeriesDataPoint[] {
    const history: TimeSeriesDataPoint[] = [];
    const now = Date.now();
    const basePrice = 2000 + Math.random() * 1000; // Random base price
    
    for (let i = 0; i < days; i++) {
      const timestamp = new Date(now - (days - i) * 24 * 60 * 60 * 1000);
      const volatility = 0.05; // 5% daily volatility
      const change = (Math.random() - 0.5) * 2 * volatility;
      const price = basePrice * (1 + change * i * 0.1);
      
      history.push({
        timestamp: timestamp.toISOString(),
        value: price,
        price: price,
        volume: Math.random() * 1000000
      });
    }
    
    return history;
  }

  // Get CoinGecko token ID from symbol
  private getTokenId(symbol: string): string | null {
    const symbolUpper = symbol.toUpperCase() as keyof typeof TOKEN_IDS;
    return TOKEN_IDS[symbolUpper] || null;
  }

  // Calculate correlation between two price series
  calculateCorrelation(series1: number[], series2: number[]): number {
    if (series1.length !== series2.length || series1.length === 0) {
      return 0;
    }
    
    const n = series1.length;
    const mean1 = series1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = series2.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;
    
    for (let i = 0; i < n; i++) {
      const diff1 = series1[i] - mean1;
      const diff2 = series2[i] - mean2;
      
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Calculate beta (systematic risk)
  calculateBeta(portfolioReturns: number[], marketReturns: number[]): number {
    if (portfolioReturns.length !== marketReturns.length || portfolioReturns.length === 0) {
      return 1;
    }
    
    const marketVariance = this.calculateVariance(marketReturns);
    if (marketVariance === 0) return 1;
    
    const covariance = this.calculateCovariance(portfolioReturns, marketReturns);
    return covariance / marketVariance;
  }

  private calculateVariance(returns: number[]): number {
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    return variance;
  }

  private calculateCovariance(returns1: number[], returns2: number[]): number {
    const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / returns2.length;
    
    const covariance = returns1.reduce((sum, ret1, index) => {
      return sum + (ret1 - mean1) * (returns2[index] - mean2);
    }, 0) / returns1.length;
    
    return covariance;
  }
}

// Singleton instance
export const historicalDataService = new HistoricalDataService();