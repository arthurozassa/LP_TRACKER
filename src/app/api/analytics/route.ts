import { NextRequest } from 'next/server';
import { asyncHandler, successResponse, errorResponse } from '@/lib/middleware/errorHandler';
import { cors, setCorsHeaders } from '@/lib/middleware/cors';
import { createEndpointRateLimit, addRateLimitHeaders } from '@/lib/middleware/rateLimit';
import { validateAnalyticsRequest } from '@/lib/validators';
import type { 
  AnalyticsResponse, 
  AnalyticsAggregates, 
  AnalyticsComparison, 
  AnalyticsForecasting 
} from '@/types/api';
import { HTTP_STATUS, ERROR_CODES } from '@/types/api';

// Mock data for analytics calculations (in production, query from database)
const mockPortfolioData = {
  totalValueLocked: 1250000,
  totalFeesEarned: 85000,
  totalPositions: 15,
  activeProtocols: 6,
  positionsByProtocol: {
    'uniswap-v3': 8,
    'curve': 3,
    'raydium-clmm': 2,
    'orca-whirlpools': 1,
    'balancer': 1,
  },
  valueByProtocol: {
    'uniswap-v3': 750000,
    'curve': 280000,
    'raydium-clmm': 150000,
    'orca-whirlpools': 45000,
    'balancer': 25000,
  },
  aprByProtocol: {
    'uniswap-v3': 18.5,
    'curve': 6.2,
    'raydium-clmm': 22.8,
    'orca-whirlpools': 16.1,
    'balancer': 11.5,
  },
  fesByProtocol: {
    'uniswap-v3': 55000,
    'curve': 12000,
    'raydium-clmm': 15000,
    'orca-whirlpools': 2500,
    'balancer': 500,
  },
  impermanentLossByProtocol: {
    'uniswap-v3': -2500,
    'curve': -100,
    'raydium-clmm': -1800,
    'orca-whirlpools': -350,
    'balancer': -250,
  },
};

// Mock market data for comparisons
const mockMarketData = {
  ethPrice: 3200,
  ethChange24h: 2.5,
  ethChange7d: -1.2,
  ethChange30d: 15.8,
  btcPrice: 68000,
  btcChange24h: 1.8,
  btcChange7d: -2.1,
  btcChange30d: 12.4,
  solPrice: 185,
  solChange24h: 3.2,
  solChange7d: 8.5,
  solChange30d: 22.1,
  defiTvl: 85000000000, // $85B
  defiChange24h: 1.2,
};

// Calculate aggregated metrics
function calculateAggregates(timeframe: string): AnalyticsAggregates {
  const data = mockPortfolioData;
  
  // Calculate weighted average APR
  const totalValue = Object.values(data.valueByProtocol).reduce((sum, value) => sum + value, 0);
  const weightedApr = Object.entries(data.valueByProtocol).reduce((sum, [protocol, value]) => {
    const apr = data.aprByProtocol[protocol as keyof typeof data.aprByProtocol] || 0;
    return sum + (apr * value / totalValue);
  }, 0);

  // Calculate total IL
  const totalIL = Object.values(data.impermanentLossByProtocol).reduce((sum, il) => sum + il, 0);

  // Calculate portfolio ROI (mock calculation)
  const portfolioROI = timeframe === '24h' ? 2.1 : 
                       timeframe === '7d' ? 8.5 :
                       timeframe === '30d' ? 18.2 :
                       timeframe === '90d' ? 42.8 : 85.6;

  // Find best and worst performing protocols
  const protocolPerformances = Object.entries(data.aprByProtocol).map(([protocol, apr]) => ({
    protocol,
    apr,
  }));
  
  const bestProtocol = protocolPerformances.reduce((best, current) => 
    current.apr > best.apr ? current : best
  );
  
  const worstProtocol = protocolPerformances.reduce((worst, current) => 
    current.apr < worst.apr ? current : worst
  );

  return {
    totalValueLocked: data.totalValueLocked,
    totalFeesEarned: data.totalFeesEarned,
    totalPositions: data.totalPositions,
    activeProtocols: data.activeProtocols,
    averageApr: weightedApr,
    totalImpermanentLoss: totalIL,
    portfolioROI,
    bestPerformingProtocol: bestProtocol.protocol,
    worstPerformingProtocol: worstProtocol.protocol,
  };
}

// Calculate comparison metrics
function calculateComparisons(timeframe: string): AnalyticsComparison {
  const portfolioReturn = timeframe === '24h' ? 2.1 : 
                         timeframe === '7d' ? 8.5 :
                         timeframe === '30d' ? 18.2 : 42.8;
  
  // HODL strategy return (weighted average of underlying assets)
  const ethWeight = 0.6; // 60% ETH exposure
  const solWeight = 0.25; // 25% SOL exposure
  const stableWeight = 0.15; // 15% stablecoin exposure
  
  const ethReturn = timeframe === '24h' ? mockMarketData.ethChange24h :
                   timeframe === '7d' ? mockMarketData.ethChange7d :
                   timeframe === '30d' ? mockMarketData.ethChange30d : 65.2;
  
  const solReturn = timeframe === '24h' ? mockMarketData.solChange24h :
                   timeframe === '7d' ? mockMarketData.solChange7d :
                   timeframe === '30d' ? mockMarketData.solChange30d : 120.5;
  
  const hodlReturn = (ethReturn * ethWeight) + (solReturn * solWeight) + (0 * stableWeight);
  
  return {
    vsHodl: {
      outperformance: portfolioReturn - hodlReturn,
      timeToBreakeven: Math.max(1, Math.round(30 * Math.random())), // Mock calculation
      riskAdjustedReturn: portfolioReturn / 1.15, // Adjust for volatility
    },
    vsMarket: {
      beta: 0.85, // Less volatile than market
      alpha: 5.2, // Excess return vs market
      sharpeRatio: 1.35,
      correlationETH: 0.72,
      correlationBTC: 0.45,
    },
    vsPeers: {
      percentile: 78, // 78th percentile performance
      averageApr: 12.5, // Market average APR
      riskScore: 6.2, // Out of 10
    },
  };
}

// Generate forecasting data
function generateForecasting(): AnalyticsForecasting {
  const currentWeeklyFees = mockPortfolioData.totalFeesEarned / 52; // Approximate weekly fees
  const currentValue = mockPortfolioData.totalValueLocked;

  return {
    nextWeek: {
      expectedFees: currentWeeklyFees * 1.05, // 5% increase expected
      expectedValue: currentValue * 1.02, // 2% value increase
      confidence: 0.75,
    },
    nextMonth: {
      expectedFees: currentWeeklyFees * 4.2 * 1.08, // Monthly with 8% increase
      expectedValue: currentValue * 1.08, // 8% value increase
      confidence: 0.62,
    },
    riskFactors: [
      {
        factor: 'Market Volatility',
        impact: 'high',
        probability: 0.65,
        description: 'Increased crypto market volatility may affect position performance and impermanent loss.',
      },
      {
        factor: 'Protocol Changes',
        impact: 'medium',
        probability: 0.25,
        description: 'Potential changes to protocol fee structures or tokenomics.',
      },
      {
        factor: 'Regulatory Environment',
        impact: 'medium',
        probability: 0.40,
        description: 'Evolving DeFi regulations may impact protocol accessibility and yields.',
      },
      {
        factor: 'Liquidity Migration',
        impact: 'low',
        probability: 0.20,
        description: 'Migration of liquidity to newer protocols with better incentives.',
      },
    ],
  };
}

// Generate top opportunities
function generateTopOpportunities() {
  return [
    {
      protocol: 'meteora-dlmm',
      pool: 'SOL/USDC',
      apr: 24.8,
      tvl: 45000000,
      riskLevel: 'medium' as const,
      reasoning: 'High APR with growing TVL on Solana. Dynamic fee model optimizes returns.',
    },
    {
      protocol: 'uniswap-v3',
      pool: 'ETH/USDT-0.05%',
      apr: 19.5,
      tvl: 180000000,
      riskLevel: 'low' as const,
      reasoning: 'Stable high-volume pair with consistent fee generation and low IL risk.',
    },
    {
      protocol: 'curve',
      pool: 'stETH/ETH',
      apr: 8.2,
      tvl: 820000000,
      riskLevel: 'low' as const,
      reasoning: 'Low-risk liquid staking pair with minimal impermanent loss exposure.',
    },
    {
      protocol: 'balancer',
      pool: 'BAL/WETH 80/20',
      apr: 15.6,
      tvl: 12000000,
      riskLevel: 'high' as const,
      reasoning: 'High yield from protocol token rewards, but higher impermanent loss risk.',
    },
  ];
}

// POST: Get analytics data
export const POST = asyncHandler(async (request: NextRequest) => {
  // Apply middleware
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('analytics')(request);
  if (rateLimitResult) return rateLimitResult;

  // Parse request body
  let requestBody: any = {};
  try {
    requestBody = await request.json();
  } catch (error) {
    // Empty body is okay, use defaults
  }

  // Validate request
  const validation = validateAnalyticsRequest(requestBody);
  if (!validation.isValid) {
    return errorResponse(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      'Validation failed',
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      validation.errors
    );
  }

  const { timeframe, includeComparisons, includeForecasting } = validation.data!;
  const safeTimeframe = timeframe || '24h';

  // Calculate analytics
  const aggregates = calculateAggregates(safeTimeframe);
  
  const response: AnalyticsResponse = {
    aggregates,
    timeframe: safeTimeframe,
    topOpportunities: generateTopOpportunities(),
  };

  // Add comparisons if requested
  if (includeComparisons) {
    response.comparison = calculateComparisons(safeTimeframe);
  }

  // Add forecasting if requested
  if (includeForecasting) {
    response.forecasting = generateForecasting();
  }

  const successRes = successResponse<AnalyticsResponse>(
    response,
    'Analytics data retrieved successfully'
  );

  return addRateLimitHeaders(setCorsHeaders(successRes, request), request, {});
});

// GET: Get basic analytics (simplified endpoint)
export const GET = asyncHandler(async (request: NextRequest) => {
  // Apply middleware
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('analytics')(request);
  if (rateLimitResult) return rateLimitResult;

  // Parse query parameters
  const url = new URL(request.url);
  const timeframe = url.searchParams.get('timeframe') || '30d';
  const includeComparisons = url.searchParams.get('includeComparisons') === 'true';
  const includeForecasting = url.searchParams.get('includeForecasting') === 'true';

  // Validate timeframe
  const validTimeframes = ['24h', '7d', '30d', '90d', '1y'];
  const safeTimeframe2 = timeframe || '24h';
  
  if (!validTimeframes.includes(safeTimeframe2)) {
    return errorResponse(
      ERROR_CODES.INVALID_TIMEFRAME,
      `Invalid timeframe: ${safeTimeframe2}. Must be one of: ${validTimeframes.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Calculate analytics
  const aggregates = calculateAggregates(safeTimeframe2);
  
  const response: AnalyticsResponse = {
    aggregates,
    timeframe: safeTimeframe2,
    topOpportunities: generateTopOpportunities(),
  };

  // Add comparisons if requested
  if (includeComparisons) {
    response.comparison = calculateComparisons(safeTimeframe2);
  }

  // Add forecasting if requested
  if (includeForecasting) {
    response.forecasting = generateForecasting();
  }

  const successRes = successResponse<AnalyticsResponse>(
    response,
    'Analytics data retrieved successfully'
  );

  return addRateLimitHeaders(setCorsHeaders(successRes, request), request, {});
});

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return cors()(request) || new Response(null, { status: 200 });
}