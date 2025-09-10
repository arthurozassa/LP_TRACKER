import { NextRequest } from 'next/server';
import { asyncHandler, successResponse, errorResponse } from '@/lib/middleware/errorHandler';
import { cors, setCorsHeaders } from '@/lib/middleware/cors';
import { createEndpointRateLimit, addRateLimitHeaders } from '@/lib/middleware/rateLimit';
import { validateChain, validateUrlParam } from '@/lib/validators';
import type { ProtocolDetailsResponse } from '@/types/api';
import { HTTP_STATUS, ERROR_CODES } from '@/types/api';
import { ChainType } from '@/types';

// Import protocol data from the main protocols route
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
      trading: 0.05,
      withdrawal: 0,
    },
    supportedFeatures: ['concentrated-liquidity', 'multiple-fee-tiers', 'range-orders', 'flash-swaps'],
    riskLevel: 'medium',
    metrics: {
      tvl: 4200000000,
      volume24h: 1500000000,
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
      trading: 0.30,
      withdrawal: 0,
    },
    supportedFeatures: ['constant-product', 'flash-swaps', 'price-oracles'],
    riskLevel: 'low',
    metrics: {
      tvl: 1800000000,
      volume24h: 800000000,
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
      trading: 0.25,
      withdrawal: 0,
    },
    supportedFeatures: ['liquidity-mining', 'governance', 'multi-chain', 'yield-farming'],
    riskLevel: 'medium',
    metrics: {
      tvl: 420000000,
      volume24h: 180000000,
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
      trading: 0.04,
      withdrawal: 0,
    },
    supportedFeatures: ['stablecoin-amm', 'low-slippage', 'governance', 'vote-escrowed-tokens'],
    riskLevel: 'low',
    metrics: {
      tvl: 3100000000,
      volume24h: 450000000,
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
      trading: 0.10,
      withdrawal: 0,
    },
    supportedFeatures: ['weighted-pools', 'stable-pools', 'liquidity-bootstrapping', 'managed-pools'],
    riskLevel: 'medium',
    metrics: {
      tvl: 890000000,
      volume24h: 120000000,
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
      trading: 0.08,
      withdrawal: 0,
    },
    supportedFeatures: ['dynamic-fees', 'concentrated-liquidity', 'auto-compounding', 'yield-optimization'],
    riskLevel: 'medium',
    metrics: {
      tvl: 180000000,
      volume24h: 85000000,
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
      trading: 0.25,
      withdrawal: 0,
    },
    supportedFeatures: ['concentrated-liquidity', 'orderbook-integration', 'yield-farming', 'multiple-fee-tiers'],
    riskLevel: 'medium',
    metrics: {
      tvl: 350000000,
      volume24h: 220000000,
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
      trading: 0.30,
      withdrawal: 0,
    },
    supportedFeatures: ['concentrated-liquidity', 'fair-price-indicator', 'position-bundles', 'auto-compounding'],
    riskLevel: 'medium',
    metrics: {
      tvl: 125000000,
      volume24h: 45000000,
      users24h: 3200,
      avgApr: 16.8,
      positions: 8500,
      lastUpdated: new Date().toISOString(),
    },
  },
};

// Chain-specific protocol mappings
const chainProtocolMap: Record<ChainType, string[]> = {
  ethereum: ['uniswap-v2', 'uniswap-v3', 'sushiswap', 'curve', 'balancer'],
  solana: ['meteora-dlmm', 'raydium-clmm', 'orca-whirlpools', 'lifinity', 'jupiter'],
  arbitrum: ['uniswap-v3-arbitrum'],
  polygon: ['uniswap-v3-polygon'],
  base: ['uniswap-v3-base'],
};

// GET: Get protocols for specific chain
export const GET = asyncHandler(async (request: NextRequest, { params }: { params: { chain: string } }) => {
  // Apply middleware
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('protocols')(request);
  if (rateLimitResult) return rateLimitResult;

  // Validate chain parameter
  const chainValidation = validateUrlParam(params.chain, 'chain');
  if (!chainValidation.isValid) {
    return errorResponse(
      chainValidation.error!.code,
      chainValidation.error!.message,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const chain = chainValidation.value!.toLowerCase();
  
  if (!validateChain(chain)) {
    return errorResponse(
      ERROR_CODES.UNSUPPORTED_CHAIN,
      `Unsupported chain: ${chain}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Parse query parameters
  const url = new URL(request.url);
  const supported = url.searchParams.get('supported');
  const includeMetrics = url.searchParams.get('includeMetrics') === 'true';

  // Get protocols for the specified chain
  const protocolIds = chainProtocolMap[chain as ChainType] || [];
  let protocols = protocolIds
    .map(id => protocolDatabase[id])
    .filter(Boolean) // Remove undefined protocols
    .filter(p => p.chain === chain); // Double check chain match

  // Apply supported filter if provided
  if (supported !== null) {
    const supportedBool = supported === 'true';
    protocols = protocols.filter(p => p.supported === supportedBool);
  }

  // Remove metrics if not requested
  if (!includeMetrics) {
    protocols = protocols.map(p => {
      const { metrics, ...protocolWithoutMetrics } = p;
      return protocolWithoutMetrics as ProtocolDetailsResponse;
    });
  }

  // Calculate chain-level aggregated metrics
  const chainMetrics = protocols.reduce(
    (acc, protocol) => {
      if (protocol.metrics && includeMetrics) {
        acc.totalTvl += protocol.metrics.tvl;
        acc.totalVolume24h += protocol.metrics.volume24h;
        acc.totalUsers24h += protocol.metrics.users24h;
        acc.totalPositions += protocol.metrics.positions;
        acc.avgAprs.push(protocol.metrics.avgApr);
      }
      return acc;
    },
    {
      totalTvl: 0,
      totalVolume24h: 0,
      totalUsers24h: 0,
      totalPositions: 0,
      avgAprs: [] as number[],
    }
  );

  const aggregatedMetrics = includeMetrics ? {
    totalTvl: chainMetrics.totalTvl,
    totalVolume24h: chainMetrics.totalVolume24h,
    totalUsers24h: chainMetrics.totalUsers24h,
    totalPositions: chainMetrics.totalPositions,
    averageApr: chainMetrics.avgAprs.length > 0 
      ? chainMetrics.avgAprs.reduce((sum, apr) => sum + apr, 0) / chainMetrics.avgAprs.length 
      : 0,
    protocolCount: protocols.length,
    supportedProtocolCount: protocols.filter(p => p.supported).length,
  } : undefined;

  // Prepare response
  const responseData = {
    chain: chain as ChainType,
    protocols,
    ...(aggregatedMetrics && { aggregatedMetrics }),
    lastUpdated: new Date().toISOString(),
  };

  const response = successResponse(
    responseData,
    `Retrieved ${protocols.length} protocols for ${chain}`
  );

  return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
});

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return cors()(request) || new Response(null, { status: 200 });
}