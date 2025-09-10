/**
 * Enhanced Uniswap-integrated scan route
 * Replaces mock implementation with real Uniswap V2/V3 scanning
 */

import { NextRequest } from 'next/server';
import { asyncHandler, successResponse, errorResponse } from '@/lib/middleware/errorHandler';
import { cors, setCorsHeaders } from '@/lib/middleware/cors';
import { createEndpointRateLimit, addRateLimitHeaders } from '@/lib/middleware/rateLimit';
import { validateWalletAddress, validateScanRequest, validateUrlParam } from '@/lib/validators';
import { getUniswapAdapter } from '@/src/production/protocols/uniswap/adapter';
import type { ScanResults, ScanApiResponse, ProtocolData, Position } from '@/types';
import type { ScanRequest, ScanJobResponse, ScanProgress } from '@/types/api';
import { ERROR_CODES, HTTP_STATUS } from '@/types/api';

// Enhanced in-memory store (in production, use Redis)
const scanJobs = new Map<string, ScanProgress>();
const scanResults = new Map<string, ScanResults>();

// Initialize Uniswap adapter
const uniswapAdapter = getUniswapAdapter();

/**
 * Enhanced protocol scanner that uses real implementations
 */
async function scanProtocolPositions(
  walletAddress: string,
  protocol: string,
  chain: string,
  onProgress?: (progress: number) => void
): Promise<Position[]> {
  // Check if this is a Uniswap protocol
  if (protocol.startsWith('uniswap-')) {
    try {
      const protocolData = await uniswapAdapter.scanUniswapPositions(
        walletAddress,
        [protocol],
        [chain],
        (currentProtocol, progress) => {
          if (onProgress) onProgress(progress);
        }
      );

      return protocolData[protocol]?.positions || [];
    } catch (error) {
      console.error(`Uniswap scan failed for ${protocol}:`, error);
      throw error;
    }
  }

  // For other protocols, use existing mock implementation
  return scanMockProtocolPositions(walletAddress, protocol, chain);
}

/**
 * Mock scanner for non-Uniswap protocols (placeholder)
 */
async function scanMockProtocolPositions(
  walletAddress: string,
  protocol: string,
  chain: string
): Promise<Position[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));

  const mockPositions: Position[] = [];
  const hasPositions = Math.random() > 0.7; // Lower chance for non-Uniswap

  if (hasPositions) {
    const numPositions = Math.floor(Math.random() * 2) + 1;
    
    for (let i = 0; i < numPositions; i++) {
      mockPositions.push({
        id: `${protocol}-${walletAddress.slice(0, 8)}-${i}`,
        protocol,
        chain: chain as any,
        pool: `${protocol.toUpperCase()}/USDC`,
        liquidity: Math.random() * 50000 + 5000,
        value: Math.random() * 25000 + 2500,
        feesEarned: Math.random() * 500 + 50,
        apr: Math.random() * 100 + 5,
        inRange: Math.random() > 0.4,
        tokens: {
          token0: {
            symbol: protocol.includes('ethereum') ? 'ETH' : protocol.includes('solana') ? 'SOL' : 'MATIC',
            amount: Math.random() * 5 + 0.5,
          },
          token1: {
            symbol: 'USDC',
            amount: Math.random() * 5000 + 500,
          },
        },
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return mockPositions;
}

/**
 * Enhanced protocol support with real Uniswap integration
 */
function getSupportedProtocols(chain: string): string[] {
  const uniswapProtocols = getUniswapProtocols(chain);
  const otherProtocols = getOtherProtocols(chain);
  
  return [...uniswapProtocols, ...otherProtocols];
}

function getUniswapProtocols(chain: string): string[] {
  switch (chain) {
    case 'ethereum':
      return ['uniswap-v2', 'uniswap-v3'];
    case 'arbitrum':
      return ['uniswap-v3-arbitrum'];
    case 'polygon':
      return ['uniswap-v3-polygon'];
    case 'base':
      return ['uniswap-v3-base'];
    case 'optimism':
      return ['uniswap-v3-optimism'];
    default:
      return [];
  }
}

function getOtherProtocols(chain: string): string[] {
  switch (chain) {
    case 'ethereum':
      return ['sushiswap', 'curve', 'balancer'];
    case 'solana':
      return ['meteora-dlmm', 'raydium-clmm', 'orca-whirlpools', 'lifinity', 'jupiter'];
    default:
      return [];
  }
}

/**
 * Enhanced wallet scan with real Uniswap integration
 */
async function performEnhancedWalletScan(
  walletAddress: string,
  chains: string[],
  protocols: string[],
  scanId: string
): Promise<void> {
  const scanProgress = scanJobs.get(scanId);
  if (!scanProgress) return;

  try {
    scanProgress.status = 'scanning';
    scanProgress.progress = 0;
    
    const allProtocolData: Record<string, ProtocolData> = {};
    let completedCount = 0;
    const totalProtocols = protocols.length;

    // Group Uniswap protocols for batch scanning
    const uniswapProtocols = protocols.filter(p => p.startsWith('uniswap-'));
    const otherProtocols = protocols.filter(p => !p.startsWith('uniswap-'));

    // Scan Uniswap protocols in batch (more efficient)
    if (uniswapProtocols.length > 0) {
      scanProgress.currentProtocol = 'uniswap-batch';
      
      try {
        const uniswapData = await uniswapAdapter.scanUniswapPositions(
          walletAddress,
          uniswapProtocols,
          chains,
          (protocol, progress) => {
            scanProgress.progress = Math.round((progress / 100) * (uniswapProtocols.length / totalProtocols) * 100);
          }
        );

        // Add Uniswap results
        Object.assign(allProtocolData, uniswapData);
        completedCount += uniswapProtocols.length;
        
        for (const protocol of uniswapProtocols) {
          if (uniswapData[protocol]) {
            scanProgress.completedProtocols.push(protocol);
          } else {
            scanProgress.failedProtocols.push(protocol);
          }
        }
      } catch (error) {
        console.error('Uniswap batch scan failed:', error);
        scanProgress.failedProtocols.push(...uniswapProtocols);
        completedCount += uniswapProtocols.length;
      }
    }

    // Scan other protocols individually
    for (const protocol of otherProtocols) {
      if (scanProgress.status === 'failed') break;

      scanProgress.currentProtocol = protocol;
      scanProgress.progress = Math.round((completedCount / totalProtocols) * 100);
      
      try {
        const chain = chains.find(c => getSupportedProtocols(c).includes(protocol)) || chains[0];
        const positions = await scanProtocolPositions(walletAddress, protocol, chain);
        
        const protocolData: ProtocolData = {
          protocol: {
            id: protocol,
            name: protocol.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            chain: chain as any,
            logoUri: `https://example.com/logos/${protocol}.png`,
            website: `https://${protocol.replace('-', '')}.com`,
            supported: true,
          },
          positions,
          totalValue: positions.reduce((sum, p) => sum + p.value, 0),
          totalPositions: positions.length,
          totalFeesEarned: positions.reduce((sum, p) => sum + p.feesEarned, 0),
          avgApr: positions.length > 0 ? positions.reduce((sum, p) => sum + p.apr, 0) / positions.length : 0,
          isLoading: false,
        };

        allProtocolData[protocol] = protocolData;
        scanProgress.completedProtocols.push(protocol);
      } catch (error) {
        console.error(`Error scanning ${protocol}:`, error);
        scanProgress.failedProtocols.push(protocol);
        
        allProtocolData[protocol] = createEmptyProtocolData(protocol, chains[0], 'Failed to scan protocol');
      }

      completedCount++;
    }

    // Compile final results
    const finalResults: ScanResults = {
      chain: chains[0] as any,
      walletAddress,
      totalValue: Object.values(allProtocolData).reduce((sum, pd) => sum + pd.totalValue, 0),
      totalPositions: Object.values(allProtocolData).reduce((sum, pd) => sum + pd.totalPositions, 0),
      totalFeesEarned: Object.values(allProtocolData).reduce((sum, pd) => sum + pd.totalFeesEarned, 0),
      avgApr: Object.values(allProtocolData)
        .filter(pd => pd.avgApr > 0)
        .reduce((sum, pd, _, arr) => sum + pd.avgApr / arr.length, 0),
      protocols: allProtocolData,
      lastUpdated: new Date().toISOString(),
      scanDuration: Date.now() - new Date(scanProgress.startedAt).getTime(),
    };

    // Update scan status
    scanProgress.status = 'completed';
    scanProgress.progress = 100;
    scanProgress.completedAt = new Date().toISOString();
    
    // Store results
    scanResults.set(scanId, finalResults);

  } catch (error) {
    console.error('Enhanced scan failed:', error);
    scanProgress.status = 'failed';
    scanProgress.progress = 0;
    scanProgress.error = error instanceof Error ? error.message : 'Unknown error occurred';
  }
}

function createEmptyProtocolData(protocol: string, chain: string, error?: string): ProtocolData {
  return {
    protocol: {
      id: protocol,
      name: protocol.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      chain: chain as any,
      logoUri: `https://example.com/logos/${protocol}.png`,
      website: `https://${protocol.replace('-', '')}.com`,
      supported: true,
    },
    positions: [],
    totalValue: 0,
    totalPositions: 0,
    totalFeesEarned: 0,
    avgApr: 0,
    isLoading: false,
    error: error || undefined,
  };
}

// GET: Check scan status or retrieve results (unchanged from original)
export const GET = asyncHandler(async (request: NextRequest, { params }: { params: { wallet: string } }) => {
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('scan')(request);
  if (rateLimitResult) return rateLimitResult;

  const walletValidation = validateUrlParam(params.wallet, 'wallet');
  if (!walletValidation.isValid) {
    return errorResponse(
      walletValidation.error!.code,
      walletValidation.error!.message,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const walletAddress = walletValidation.value!;
  const addressValidation = validateWalletAddress(walletAddress);
  
  if (!addressValidation.isValid) {
    return errorResponse(
      ERROR_CODES.INVALID_WALLET_ADDRESS,
      addressValidation.error!,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const url = new URL(request.url);
  const scanId = url.searchParams.get('scanId');

  if (scanId) {
    const scanProgress = scanJobs.get(scanId);
    const scanResult = scanResults.get(scanId);

    if (!scanProgress && !scanResult) {
      return errorResponse(
        ERROR_CODES.SCAN_FAILED,
        'Scan not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (scanResult) {
      const response = successResponse<ScanResults>(scanResult, 'Scan completed successfully');
      return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
    } else if (scanProgress) {
      const response = successResponse<ScanProgress>(scanProgress, 'Scan in progress');
      return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
    }
  }

  return errorResponse(
    ERROR_CODES.MISSING_REQUIRED_FIELD,
    'scanId parameter is required for GET requests',
    HTTP_STATUS.BAD_REQUEST
  );
});

// POST: Start enhanced scan with real Uniswap integration
export const POST = asyncHandler(async (request: NextRequest, { params }: { params: { wallet: string } }) => {
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('scan')(request);
  if (rateLimitResult) return rateLimitResult;

  const walletValidation = validateUrlParam(params.wallet, 'wallet');
  if (!walletValidation.isValid) {
    return errorResponse(
      walletValidation.error!.code,
      walletValidation.error!.message,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const walletAddress = walletValidation.value!;
  const addressValidation = validateWalletAddress(walletAddress);
  
  if (!addressValidation.isValid) {
    return errorResponse(
      ERROR_CODES.INVALID_WALLET_ADDRESS,
      addressValidation.error!,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  let requestBody: any = {};
  try {
    requestBody = await request.json();
  } catch (error) {
    // Empty body is okay
  }

  const validation = validateScanRequest({
    wallet: walletAddress,
    ...requestBody,
  });

  if (!validation.isValid) {
    return errorResponse(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      'Validation failed',
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      validation.errors
    );
  }

  const { chains, protocols: requestedProtocols, refresh } = validation.data!;

  const chainsToScan = chains?.length 
    ? chains 
    : addressValidation.chain 
      ? [addressValidation.chain] 
      : ['ethereum', 'solana'];

  let protocolsToScan: string[] = [];
  for (const chain of chainsToScan) {
    const chainProtocols = getSupportedProtocols(chain);
    if (requestedProtocols?.length) {
      protocolsToScan.push(...chainProtocols.filter(p => requestedProtocols.includes(p)));
    } else {
      protocolsToScan.push(...chainProtocols);
    }
  }

  if (protocolsToScan.length === 0) {
    return errorResponse(
      ERROR_CODES.INVALID_PROTOCOL,
      'No supported protocols found for the specified chains',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Check for existing scan
  const existingScanId = Array.from(scanJobs.entries())
    .find(([_, job]) => 
      job.status === 'scanning' && 
      job.completedProtocols.some(p => p.includes(walletAddress))
    )?.[0];

  if (existingScanId && !refresh) {
    return errorResponse(
      ERROR_CODES.SCAN_IN_PROGRESS,
      'Scan already in progress for this wallet',
      HTTP_STATUS.CONFLICT,
      { scanId: existingScanId }
    );
  }

  // Generate scan ID
  const scanId = `enhanced_scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create scan job with enhanced estimation
  const uniswapProtocolCount = protocolsToScan.filter(p => p.startsWith('uniswap-')).length;
  const otherProtocolCount = protocolsToScan.length - uniswapProtocolCount;
  const estimatedTime = (uniswapProtocolCount > 0 ? 5 : 0) + (otherProtocolCount * 2); // Uniswap batch + others individually

  const scanProgress: ScanProgress = {
    scanId,
    status: 'queued',
    progress: 0,
    completedProtocols: [],
    failedProtocols: [],
    startedAt: new Date().toISOString(),
    estimatedTimeRemaining: estimatedTime,
  };

  scanJobs.set(scanId, scanProgress);

  // Start enhanced scan
  performEnhancedWalletScan(walletAddress, chainsToScan, protocolsToScan, scanId).catch(error => {
    console.error('Enhanced async scan failed:', error);
    const job = scanJobs.get(scanId);
    if (job) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
    }
  });

  const jobResponse: ScanJobResponse = {
    scanId,
    status: 'queued',
    estimatedTime,
  };

  const response = successResponse<ScanJobResponse>(
    jobResponse,
    'Enhanced scan started successfully',
    HTTP_STATUS.CREATED
  );

  return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
});

// OPTIONS handler
export async function OPTIONS(request: NextRequest) {
  return cors()(request) || new Response(null, { status: 200 });
}