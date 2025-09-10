import { NextRequest, NextResponse } from 'next/server';
import { asyncHandler, successResponse, errorResponse } from '@/lib/middleware/errorHandler';
import { cors, setCorsHeaders } from '@/lib/middleware/cors';
import { createEndpointRateLimit, addRateLimitHeaders } from '@/lib/middleware/rateLimit';
import { validateChain, validatePagination } from '@/lib/validators';
import type { ProtocolDetailsResponse, ProtocolMetrics, PaginatedResponse } from '@/types/api';
import { HTTP_STATUS, ERROR_CODES } from '@/types/api';
import { ETHEREUM_PROTOCOLS, SOLANA_PROTOCOLS, L2_PROTOCOLS, ChainType } from '@/types';

// Mock protocol data (replace with actual data source)
const protocolDatabase: Record<string, ProtocolDetailsResponse> = {
  'uniswap-v3': {
    id: 'uniswap-v3',
    name: 'Uniswap V3',
    chain: 'ethereum',
    description: 'The most popular decentralized exchange protocol with concentrated liquidity.',
    logoUri: 'https://cryptologos.cc/logos/uniswap-uni-logo.png',
    website: 'https://uniswap.org',
    documentation: 'https://docs.uniswap.org',
    supported: true,
    version: '3.0.0',
    fees: {
      trading: 0.05, // 0.05%
      withdrawal: 0,
    },
    supportedFeatures: ['concentrated-liquidity', 'multiple-fee-tiers', 'range-orders', 'flash-swaps'],
    riskLevel: 'medium',
    metrics: {
      tvl: 4200000000, // $4.2B
      volume24h: 1500000000, // $1.5B
      users24h: 45000,
      avgApr: 15.5,
      positions: 180000,
      lastUpdated: new Date().toISOString(),
    },
  },
  'uniswap-v2': {
    id: 'uniswap-v2',
    name: 'Uniswap V2',
    chain: 'ethereum',
    description: 'The original automated market maker that pioneered DeFi trading.',
    logoUri: 'https://cryptologos.cc/logos/uniswap-uni-logo.png',
    website: 'https://uniswap.org',
    documentation: 'https://docs.uniswap.org',
    supported: true,
    version: '2.0.0',
    fees: {
      trading: 0.30, // 0.30%
      withdrawal: 0,
    },
    supportedFeatures: ['constant-product', 'flash-swaps', 'price-oracles'],
    riskLevel: 'low',
    metrics: {
      tvl: 1800000000, // $1.8B
      volume24h: 800000000, // $800M
      users24h: 25000,
      avgApr: 8.2,
      positions: 95000,
      lastUpdated: new Date().toISOString(),
    },
  },
  'sushiswap': {
    id: 'sushiswap',
    name: 'SushiSwap',
    chain: 'ethereum',
    description: 'Community-driven DEX with additional features like lending and yield farming.',
    logoUri: 'https://cryptologos.cc/logos/sushiswap-sushi-logo.png',
    website: 'https://sushi.com',
    documentation: 'https://docs.sushi.com',
    supported: true,
    version: '2.0.0',
    fees: {
      trading: 0.25, // 0.25%
      withdrawal: 0,
    },
    supportedFeatures: ['liquidity-mining', 'governance', 'multi-chain', 'yield-farming'],
    riskLevel: 'medium',
    metrics: {
      tvl: 420000000, // $420M
      volume24h: 180000000, // $180M
      users24h: 12000,
      avgApr: 12.8,
      positions: 35000,
      lastUpdated: new Date().toISOString(),
    },
  },
  'curve': {
    id: 'curve',
    name: 'Curve Finance',
    chain: 'ethereum',
    description: 'Specialized AMM for stablecoins and similar assets with low slippage.',
    logoUri: 'https://cryptologos.cc/logos/curve-dao-token-crv-logo.png',
    website: 'https://curve.fi',
    documentation: 'https://curve.readthedocs.io',
    supported: true,
    version: '1.0.0',
    fees: {
      trading: 0.04, // 0.04%
      withdrawal: 0,
    },
    supportedFeatures: ['stablecoin-amm', 'low-slippage', 'governance', 'vote-escrowed-tokens'],
    riskLevel: 'low',
    metrics: {
      tvl: 3100000000, // $3.1B
      volume24h: 450000000, // $450M
      users24h: 8500,
      avgApr: 6.5,
      positions: 22000,
      lastUpdated: new Date().toISOString(),
    },
  },
  'balancer': {
    id: 'balancer',
    name: 'Balancer',
    chain: 'ethereum',
    description: 'Flexible AMM supporting custom pool weights and multiple assets.',
    logoUri: 'https://cryptologos.cc/logos/balancer-bal-logo.png',
    website: 'https://balancer.fi',
    documentation: 'https://docs.balancer.fi',
    supported: true,
    version: '2.0.0',
    fees: {
      trading: 0.10, // Variable, 0.10% average
      withdrawal: 0,
    },
    supportedFeatures: ['weighted-pools', 'stable-pools', 'liquidity-bootstrapping', 'managed-pools'],
    riskLevel: 'medium',
    metrics: {
      tvl: 890000000, // $890M
      volume24h: 120000000, // $120M
      users24h: 3500,
      avgApr: 11.2,
      positions: 15000,
      lastUpdated: new Date().toISOString(),
    },
  },
  'meteora-dlmm': {
    id: 'meteora-dlmm',
    name: 'Meteora DLMM',
    chain: 'solana',
    description: 'Dynamic Liquidity Market Maker on Solana with concentrated liquidity.',
    logoUri: 'https://raw.githubusercontent.com/meteora-ag/dlmm-sdk/main/assets/logo.png',
    website: 'https://meteora.ag',
    documentation: 'https://docs.meteora.ag',
    supported: true,
    version: '1.0.0',
    fees: {
      trading: 0.08, // Variable
      withdrawal: 0,
    },
    supportedFeatures: ['dynamic-fees', 'concentrated-liquidity', 'auto-compounding', 'yield-optimization'],
    riskLevel: 'medium',
    metrics: {
      tvl: 180000000, // $180M
      volume24h: 85000000, // $85M
      users24h: 2800,
      avgApr: 18.5,
      positions: 12000,
      lastUpdated: new Date().toISOString(),
    },
  },
  'raydium-clmm': {
    id: 'raydium-clmm',
    name: 'Raydium CLMM',
    chain: 'solana',
    description: 'Concentrated Liquidity Market Maker integrated with Serum orderbook.',
    logoUri: 'https://raydium.io/logo.png',
    website: 'https://raydium.io',
    documentation: 'https://docs.raydium.io',
    supported: true,
    version: '2.0.0',
    fees: {
      trading: 0.25, // Variable
      withdrawal: 0,
    },
    supportedFeatures: ['concentrated-liquidity', 'orderbook-integration', 'yield-farming', 'multiple-fee-tiers'],
    riskLevel: 'medium',
    metrics: {
      tvl: 350000000, // $350M
      volume24h: 220000000, // $220M
      users24h: 8500,
      avgApr: 22.1,
      positions: 25000,
      lastUpdated: new Date().toISOString(),
    },
  },
  'orca-whirlpools': {
    id: 'orca-whirlpools',
    name: 'Orca Whirlpools',
    chain: 'solana',
    description: 'User-friendly concentrated liquidity DEX on Solana.',
    logoUri: 'https://www.orca.so/static/media/orca_logo.svg',
    website: 'https://www.orca.so',
    documentation: 'https://orca-so.gitbook.io/orca-developer-portal',
    supported: true,
    version: '1.0.0',
    fees: {
      trading: 0.30, // Variable
      withdrawal: 0,
    },
    supportedFeatures: ['concentrated-liquidity', 'fair-price-indicator', 'position-bundles', 'auto-compounding'],
    riskLevel: 'medium',
    metrics: {
      tvl: 125000000, // $125M
      volume24h: 45000000, // $45M
      users24h: 3200,
      avgApr: 16.8,
      positions: 8500,
      lastUpdated: new Date().toISOString(),
    },
  },
};

// Get all supported protocols
function getAllProtocols(): ProtocolDetailsResponse[] {
  return Object.values(protocolDatabase);
}

// Filter protocols by chain
function filterProtocolsByChain(protocols: ProtocolDetailsResponse[], chain: string): ProtocolDetailsResponse[] {
  return protocols.filter(p => p.chain === chain);
}

// Filter protocols by support status
function filterProtocolsBySupport(protocols: ProtocolDetailsResponse[], supported: boolean): ProtocolDetailsResponse[] {
  return protocols.filter(p => p.supported === supported);
}

// GET: List all protocols
export const GET = asyncHandler(async (request: NextRequest) => {
  // Apply middleware
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('protocols')(request);
  if (rateLimitResult) return rateLimitResult;

  // Parse query parameters
  const url = new URL(request.url);
  const chain = url.searchParams.get('chain');
  const supported = url.searchParams.get('supported');
  const includeMetrics = url.searchParams.get('includeMetrics') === 'true';
  const page = url.searchParams.get('page');
  const limit = url.searchParams.get('limit');

  // Validate pagination
  const pagination = validatePagination(page || undefined, limit || undefined);
  if (pagination.error) {
    return errorResponse(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      pagination.error,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Validate chain if provided
  if (chain && !validateChain(chain)) {
    return errorResponse(
      ERROR_CODES.UNSUPPORTED_CHAIN,
      `Unsupported chain: ${chain}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Get all protocols
  let protocols = getAllProtocols();

  // Apply filters
  if (chain) {
    protocols = filterProtocolsByChain(protocols, chain);
  }

  if (supported !== null) {
    const supportedBool = supported === 'true';
    protocols = filterProtocolsBySupport(protocols, supportedBool);
  }

  // Remove metrics if not requested
  if (!includeMetrics) {
    protocols = protocols.map(p => {
      const { metrics, ...protocolWithoutMetrics } = p;
      return protocolWithoutMetrics as ProtocolDetailsResponse;
    });
  }

  // Apply pagination
  const startIndex = (pagination.page - 1) * pagination.limit;
  const endIndex = startIndex + pagination.limit;
  const paginatedProtocols = protocols.slice(startIndex, endIndex);

  // Create paginated response
  const response: PaginatedResponse<ProtocolDetailsResponse> = {
    success: true,
    data: paginatedProtocols,
    message: `Retrieved ${paginatedProtocols.length} protocols`,
    timestamp: new Date().toISOString(),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: protocols.length,
      totalPages: Math.ceil(protocols.length / pagination.limit),
      hasNext: endIndex < protocols.length,
      hasPrev: pagination.page > 1,
    },
  };

  const nextResponse = NextResponse.json(response, {
    status: HTTP_STATUS.OK,
  });

  return addRateLimitHeaders(setCorsHeaders(nextResponse, request), request, {});
});

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return cors()(request) || new Response(null, { status: 200 });
}