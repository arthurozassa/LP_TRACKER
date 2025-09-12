import { NextRequest } from 'next/server';
import { asyncHandler, successResponse, errorResponse } from '@/lib/middleware/errorHandler';
import { cors, setCorsHeaders } from '@/lib/middleware/cors';
import { createEndpointRateLimit, addRateLimitHeaders } from '@/lib/middleware/rateLimit';
import { validateWalletAddress, validateScanRequest, validateUrlParam } from '@/lib/validators';
import type { ScanResults, ScanApiResponse, ProtocolData, Position } from '@/types';
import type { ScanRequest, ScanJobResponse, ScanProgress } from '@/types/api';
import { ERROR_CODES, HTTP_STATUS } from '@/types/api';
import { getProductionScanner } from '@/services/productionScanner';

// In-memory store for scan jobs (in production, use Redis or database)
const scanJobs = new Map<string, ScanProgress>();
const scanResults = new Map<string, ScanResults>();

// Initialize production scanner
const productionScanner = getProductionScanner();

// Mock protocol scanner functions (replace with real implementations)
async function scanProtocolPositions(
  walletAddress: string,
  protocol: string,
  chain: string
): Promise<Position[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));

  // Mock positions based on protocol
  const mockPositions: Position[] = [];

  // Simulate finding positions (random for demo)
  const hasPositions = Math.random() > 0.6;
  if (hasPositions) {
    const numPositions = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numPositions; i++) {
      mockPositions.push({
        id: `${protocol}-${walletAddress.slice(0, 8)}-${i}`,
        protocol,
        chain: chain as any,
        pool: `${protocol.toUpperCase()}/USDC`,
        liquidity: Math.random() * 100000 + 10000,
        value: Math.random() * 50000 + 5000,
        feesEarned: Math.random() * 1000 + 100,
        apr: Math.random() * 200 + 10,
        inRange: Math.random() > 0.3,
        tokens: {
          token0: {
            symbol: protocol.includes('ethereum') ? 'ETH' : 'SOL',
            amount: Math.random() * 10 + 1,
          },
          token1: {
            symbol: 'USDC',
            amount: Math.random() * 10000 + 1000,
          },
        },
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return mockPositions;
}

// Get supported protocols for a chain
function getSupportedProtocols(chain: string): string[] {
  switch (chain) {
    case 'ethereum':
      return ['uniswap-v2', 'uniswap-v3', 'sushiswap', 'curve', 'balancer'];
    case 'solana':
      return ['meteora-dlmm', 'raydium-clmm', 'orca-whirlpools', 'lifinity', 'jupiter'];
    case 'arbitrum':
      return ['uniswap-v3-arbitrum'];
    case 'polygon':
      return ['uniswap-v3-polygon'];
    case 'base':
      return ['uniswap-v3-base'];
    default:
      return [];
  }
}

// Perform full wallet scan using production scanner
async function performWalletScan(
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
    
    // Use the production scanner to get real data
    const primaryChain = chains[0] as 'ethereum' | 'solana';
    scanProgress.currentProtocol = `Scanning ${primaryChain} protocols`;
    scanProgress.progress = 50;
    
    const productionScanResponse = await productionScanner.scanWallet(walletAddress, primaryChain);
    
    // Check if the scan was successful
    if (!productionScanResponse.success || !productionScanResponse.data) {
      throw new Error(productionScanResponse.error || 'Production scan failed');
    }
    
    const productionScanResults = productionScanResponse.data;
    
    // Update progress
    scanProgress.progress = 100;
    scanProgress.status = 'completed';
    scanProgress.completedAt = new Date().toISOString();
    scanProgress.completedProtocols = Object.keys(productionScanResults.protocols);
    
    // Store results
    scanResults.set(scanId, productionScanResults);

  } catch (error) {
    console.error('Production scan failed:', error);
    scanProgress.status = 'failed';
    scanProgress.progress = 0;
  }
}

// GET: Check scan status or retrieve results
export const GET = asyncHandler(async (request: NextRequest, { params }: { params: { wallet: string } }) => {
  // Apply middleware
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('scan')(request);
  if (rateLimitResult) return rateLimitResult;

  // Validate wallet parameter
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

  // Get query parameters
  const url = new URL(request.url);
  const scanId = url.searchParams.get('scanId');

  if (scanId) {
    // Return scan progress or results
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
      // Return completed scan results
      const response = successResponse<ScanResults>(scanResult, 'Scan completed successfully');
      return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
    } else if (scanProgress) {
      // Return scan progress
      const response = successResponse<ScanProgress>(scanProgress, 'Scan in progress');
      return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
    }
  }

  // No scanId provided, return error
  return errorResponse(
    ERROR_CODES.MISSING_REQUIRED_FIELD,
    'scanId parameter is required for GET requests',
    HTTP_STATUS.BAD_REQUEST
  );
});

// POST: Start new scan
export const POST = asyncHandler(async (request: NextRequest, { params }: { params: { wallet: string } }) => {
  // Apply middleware
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  const rateLimitResult = createEndpointRateLimit('scan')(request);
  if (rateLimitResult) return rateLimitResult;

  // Validate wallet parameter
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

  // Parse request body
  let requestBody: any = {};
  try {
    requestBody = await request.json();
  } catch (error) {
    // Empty body is okay for POST scan requests
  }

  // Validate request body
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

  // Determine chains to scan
  const chainsToScan = chains?.length 
    ? chains 
    : addressValidation.chain 
      ? [addressValidation.chain] 
      : ['ethereum', 'solana'];

  // Determine protocols to scan
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

  // Check if scan already in progress
  const existingScanId = Array.from(scanJobs.entries())
    .find(([_, job]) => 
      job.status === 'scanning' && 
      job.completedProtocols.includes(walletAddress)
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
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create scan job
  const scanProgress: ScanProgress = {
    scanId,
    status: 'queued',
    progress: 0,
    completedProtocols: [],
    failedProtocols: [],
    startedAt: new Date().toISOString(),
    estimatedTimeRemaining: protocolsToScan.length * 2, // 2 seconds per protocol estimate
  };

  scanJobs.set(scanId, scanProgress);

  // Start scan asynchronously
  performWalletScan(walletAddress, chainsToScan, protocolsToScan, scanId).catch(error => {
    console.error('Async scan failed:', error);
    const job = scanJobs.get(scanId);
    if (job) {
      job.status = 'failed';
    }
  });

  // Return job response
  const jobResponse: ScanJobResponse = {
    scanId,
    status: 'queued',
    estimatedTime: scanProgress.estimatedTimeRemaining!,
  };

  const response = successResponse<ScanJobResponse>(
    jobResponse,
    'Scan started successfully',
    HTTP_STATUS.CREATED
  );

  return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
});

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return cors()(request) || new Response(null, { status: 200 });
}