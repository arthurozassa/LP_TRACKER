import { NextRequest } from 'next/server';
import { asyncHandler, successResponse, errorResponse } from '@/lib/middleware/errorHandler';
import { cors, setCorsHeaders } from '@/lib/middleware/cors';
import { createEndpointRateLimit, addRateLimitHeaders } from '@/lib/middleware/rateLimit';
import { validateUrlParam, validateTimeframe } from '@/lib/validators';
import type { PositionDetailsResponse, PositionHistoricalData, PositionPrediction } from '@/types/api';
import { HTTP_STATUS, ERROR_CODES } from '@/types/api';
import { Position } from '@/types';

// Mock position database (in production, use actual database)
const positionsDatabase: Record<string, Position> = {
  'uniswap-v3-0x1234-0': {
    id: 'uniswap-v3-0x1234-0',
    protocol: 'uniswap-v3',
    chain: 'ethereum',
    pool: 'ETH/USDC-0.05%',
    poolAddress: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
    liquidity: 125000,
    value: 45000,
    feesEarned: 2850,
    apr: 18.5,
    apy: 20.2,
    inRange: true,
    tokens: {
      token0: {
        symbol: 'ETH',
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        amount: 12.5,
        decimals: 18,
      },
      token1: {
        symbol: 'USDC',
        address: '0xa0b86a33e6411a3abca62c8f2f8b2d20d94fcc87',
        amount: 32500,
        decimals: 6,
      },
    },
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: new Date().toISOString(),
    tickLower: 195000,
    tickUpper: 205000,
    currentTick: 200000,
    priceRange: {
      lower: 2800,
      upper: 3200,
      current: 3000,
    },
    manageUrl: 'https://app.uniswap.org/#/pool/123456',
    yield24h: 125.50,
    yield7d: 890.25,
    yield30d: 3850.75,
    impermanentLoss: -150.25,
  },
  'raydium-clmm-9wz-1': {
    id: 'raydium-clmm-9wz-1',
    protocol: 'raydium-clmm',
    chain: 'solana',
    pool: 'SOL/USDC',
    poolAddress: '58oQChx4yWmvKdwLLZzBi4ChoCKR9EZjKHfxC4H2zFnf',
    liquidity: 85000,
    value: 28500,
    feesEarned: 1250,
    apr: 22.8,
    apy: 25.6,
    inRange: false,
    tokens: {
      token0: {
        symbol: 'SOL',
        address: 'So11111111111111111111111111111111111111112',
        amount: 185.5,
        decimals: 9,
      },
      token1: {
        symbol: 'USDC',
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 14250,
        decimals: 6,
      },
    },
    createdAt: '2024-02-20T14:22:00Z',
    updatedAt: new Date().toISOString(),
    tickLower: 180000,
    tickUpper: 220000,
    currentTick: 225000,
    priceRange: {
      lower: 120,
      upper: 180,
      current: 185,
    },
    manageUrl: 'https://raydium.io/clmm/pools/123456',
    yield24h: 85.25,
    yield7d: 592.50,
    yield30d: 2548.75,
    impermanentLoss: -85.50,
  },
};

// Generate mock historical data
function generateMockHistoricalData(
  position: Position,
  timeframe: string
): PositionHistoricalData[] {
  const now = Date.now();
  const intervals: Record<string, { count: number; step: number }> = {
    '1h': { count: 60, step: 60 * 1000 }, // 60 minutes
    '24h': { count: 48, step: 30 * 60 * 1000 }, // 30 min intervals
    '7d': { count: 168, step: 60 * 60 * 1000 }, // 1 hour intervals
    '30d': { count: 120, step: 6 * 60 * 60 * 1000 }, // 6 hour intervals
    '90d': { count: 180, step: 12 * 60 * 60 * 1000 }, // 12 hour intervals
    '1y': { count: 365, step: 24 * 60 * 60 * 1000 }, // daily intervals
  };

  const config = intervals[timeframe] || intervals['30d'];
  const data: PositionHistoricalData[] = [];

  for (let i = 0; i < config.count; i++) {
    const timestamp = new Date(now - (config.count - i) * config.step).toISOString();
    
    // Add some realistic variation to the data
    const timeProgress = i / config.count;
    const baseValue = position.value * (0.8 + 0.4 * timeProgress);
    const variation = 1 + 0.1 * Math.sin(i * 0.1) * Math.random();
    
    data.push({
      timestamp,
      value: baseValue * variation,
      fees: position.feesEarned * timeProgress + Math.random() * 10,
      apr: position.apr * (0.9 + 0.2 * Math.random()),
      impermanentLoss: position.impermanentLoss || 0 + Math.random() * 50 - 25,
      inRange: Math.random() > 0.2, // 80% in range historically
    });
  }

  return data;
}

// Generate mock predictions
function generateMockPredictions(position: Position): PositionPrediction[] {
  const predictions: PositionPrediction[] = [];
  
  ['1h', '24h', '7d'].forEach(timeframe => {
    const multiplier = timeframe === '1h' ? 1.001 : timeframe === '24h' ? 1.02 : 1.15;
    const confidence = timeframe === '1h' ? 0.95 : timeframe === '24h' ? 0.85 : 0.65;
    
    predictions.push({
      timeframe: timeframe as any,
      predictedValue: position.value * multiplier,
      predictedFees: position.feesEarned * multiplier * 0.1,
      predictedIL: (position.impermanentLoss || 0) * multiplier,
      confidence,
      scenarios: {
        optimistic: {
          value: position.value * multiplier * 1.1,
          fees: position.feesEarned * multiplier * 0.15,
          il: (position.impermanentLoss || 0) * multiplier * 0.8,
        },
        realistic: {
          value: position.value * multiplier,
          fees: position.feesEarned * multiplier * 0.1,
          il: (position.impermanentLoss || 0) * multiplier,
        },
        pessimistic: {
          value: position.value * multiplier * 0.9,
          fees: position.feesEarned * multiplier * 0.05,
          il: (position.impermanentLoss || 0) * multiplier * 1.2,
        },
      },
    });
  });

  return predictions;
}

// Generate recommendations
function generateRecommendations(position: Position) {
  if (!position.inRange) {
    return {
      action: 'rebalance' as const,
      reasoning: 'Position is out of range and not earning fees. Consider rebalancing to current price range.',
      urgency: 'high' as const,
      expectedImpact: {
        aprChange: 15,
        valueChange: 0,
        riskChange: 'maintain' as const,
      },
    };
  }

  if (position.apr < 5) {
    return {
      action: 'exit' as const,
      reasoning: 'APR is below market average. Consider moving to higher-yielding opportunities.',
      urgency: 'medium' as const,
      expectedImpact: {
        aprChange: 10,
        valueChange: -2,
        riskChange: 'decrease' as const,
      },
    };
  }

  if (position.apr > 25) {
    return {
      action: 'increase' as const,
      reasoning: 'Position is performing well with high APR. Consider increasing position size.',
      urgency: 'low' as const,
      expectedImpact: {
        aprChange: 0,
        valueChange: 20,
        riskChange: 'increase' as const,
      },
    };
  }

  return {
    action: 'hold' as const,
    reasoning: 'Position is performing well and within optimal parameters.',
    urgency: 'low' as const,
    expectedImpact: {
      aprChange: 0,
      valueChange: 0,
      riskChange: 'maintain' as const,
    },
  };
}

// GET: Get position details
export const GET = asyncHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  // Apply middleware
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('positions')(request);
  if (rateLimitResult) return rateLimitResult;

  // Validate position ID parameter
  const positionIdValidation = validateUrlParam(params.id, 'id');
  if (!positionIdValidation.isValid) {
    return errorResponse(
      positionIdValidation.error!.code,
      positionIdValidation.error!.message,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const positionId = positionIdValidation.value!;

  // Find position in database
  const position = positionsDatabase[positionId];
  if (!position) {
    return errorResponse(
      ERROR_CODES.POSITION_NOT_FOUND,
      `Position with ID ${positionId} not found`,
      HTTP_STATUS.NOT_FOUND
    );
  }

  // Parse query parameters
  const url = new URL(request.url);
  const includeHistorical = url.searchParams.get('includeHistorical') === 'true';
  const includePredictions = url.searchParams.get('includePredictions') === 'true';
  const timeframe = url.searchParams.get('timeframe') || '30d';

  // Validate timeframe if provided
  if (timeframe && !validateTimeframe(timeframe)) {
    return errorResponse(
      ERROR_CODES.INVALID_TIMEFRAME,
      `Invalid timeframe: ${timeframe}. Must be one of: 1h, 24h, 7d, 30d, 90d, 1y`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Build response
  const response: PositionDetailsResponse = {
    position,
  };

  // Add historical data if requested
  if (includeHistorical) {
    response.historical = generateMockHistoricalData(position, timeframe);
  }

  // Add predictions if requested
  if (includePredictions) {
    response.predictions = generateMockPredictions(position);
  }

  // Always include recommendations
  response.recommendations = generateRecommendations(position);

  const successRes = successResponse<PositionDetailsResponse>(
    response,
    `Position details retrieved successfully`
  );

  return addRateLimitHeaders(setCorsHeaders(successRes, request), request, {});
});

// PUT: Update position (for manual adjustments)
export const PUT = asyncHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  // Apply middleware
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('positions')(request);
  if (rateLimitResult) return rateLimitResult;

  // Validate position ID parameter
  const positionIdValidation = validateUrlParam(params.id, 'id');
  if (!positionIdValidation.isValid) {
    return errorResponse(
      positionIdValidation.error!.code,
      positionIdValidation.error!.message,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const positionId = positionIdValidation.value!;

  // Find position in database
  const position = positionsDatabase[positionId];
  if (!position) {
    return errorResponse(
      ERROR_CODES.POSITION_NOT_FOUND,
      `Position with ID ${positionId} not found`,
      HTTP_STATUS.NOT_FOUND
    );
  }

  // Parse request body
  let updateData: any;
  try {
    updateData = await request.json();
  } catch (error) {
    return errorResponse(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      'Invalid JSON in request body',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Validate update data (only allow certain fields to be updated)
  const allowedUpdates = ['liquidity', 'tickLower', 'tickUpper', 'manageUrl'];
  const updates: Partial<Position> = {};

  for (const [key, value] of Object.entries(updateData)) {
    if (allowedUpdates.includes(key)) {
      (updates as any)[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      `No valid updates provided. Allowed fields: ${allowedUpdates.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Update position
  const updatedPosition = {
    ...position,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Recalculate derived fields if necessary
  if (updates.liquidity || updates.tickLower || updates.tickUpper) {
    // In a real implementation, recalculate value, inRange, etc.
    updatedPosition.updatedAt = new Date().toISOString();
  }

  // Save to database
  positionsDatabase[positionId] = updatedPosition;

  const response = successResponse<Position>(
    updatedPosition,
    'Position updated successfully'
  );

  return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
});

// DELETE: Remove position (soft delete in production)
export const DELETE = asyncHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  // Apply middleware
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('positions')(request);
  if (rateLimitResult) return rateLimitResult;

  // Validate position ID parameter
  const positionIdValidation = validateUrlParam(params.id, 'id');
  if (!positionIdValidation.isValid) {
    return errorResponse(
      positionIdValidation.error!.code,
      positionIdValidation.error!.message,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const positionId = positionIdValidation.value!;

  // Check if position exists
  const position = positionsDatabase[positionId];
  if (!position) {
    return errorResponse(
      ERROR_CODES.POSITION_NOT_FOUND,
      `Position with ID ${positionId} not found`,
      HTTP_STATUS.NOT_FOUND
    );
  }

  // In production, implement soft delete instead of hard delete
  delete positionsDatabase[positionId];

  const response = successResponse(
    { deletedPositionId: positionId },
    'Position deleted successfully'
  );

  return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
});

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return cors()(request) || new Response(null, { status: 200 });
}