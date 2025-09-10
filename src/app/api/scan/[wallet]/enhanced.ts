// Enhanced Scan API Route - Demonstrates integration with production infrastructure
// This file shows how to integrate the caching and queue system with the existing scan API

import { NextRequest, NextResponse } from 'next/server';
import { 
  initializeProductionInfrastructure, 
  getProductionInfrastructure, 
  DefaultProductionConfig,
  WalletScanJobData,
  QuickScanJobData
} from '../../../../production';
import { validateWalletAddress } from '@/lib/validators';
import { detectChainType } from '@/types';
import type { ScanResults, ChainType, ProtocolType } from '@/types';

// Initialize infrastructure (this would typically be done in middleware or app startup)
let infrastructureReady = false;

async function ensureInfrastructure() {
  if (!infrastructureReady) {
    try {
      await initializeProductionInfrastructure(DefaultProductionConfig);
      infrastructureReady = true;
    } catch (error) {
      console.error('Failed to initialize production infrastructure:', error);
      throw error;
    }
  }
}

// Enhanced scan endpoint with caching and background processing
export async function POST(
  request: NextRequest, 
  { params }: { params: { wallet: string } }
) {
  try {
    // Ensure production infrastructure is ready
    await ensureInfrastructure();
    
    const { wallet } = params;
    const body = await request.json().catch(() => ({}));
    
    // Validate wallet address
    const addressValidation = validateWalletAddress(wallet);
    if (!addressValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid wallet address', details: addressValidation.error },
        { status: 400 }
      );
    }

    // Detect chain from address
    const chain = detectChainType(wallet);
    if (!chain) {
      return NextResponse.json(
        { error: 'Unable to detect chain from wallet address' },
        { status: 400 }
      );
    }

    const infrastructure = getProductionInfrastructure();
    const cache = infrastructure.getCache();
    const queueManager = infrastructure.getQueueManager();

    if (!queueManager) {
      return NextResponse.json(
        { error: 'Queue system not available' },
        { status: 503 }
      );
    }

    // Parse request options
    const { 
      quick = false, 
      refresh = false, 
      priority = 'normal',
      protocols,
      includeHistory = false,
      includePrices = true 
    } = body;

    // Check cache first (unless refresh is requested)
    const cacheKey = `scan:${wallet}:${chain}`;
    let cachedResults: ScanResults | null = null;

    if (!refresh) {
      cachedResults = await cache.multiLevel.get<ScanResults>(
        cacheKey,
        { 
          strategy: {
            memory: { namespace: 'scans', ttl: 300000 }, // 5 minutes in memory
            redis: { namespace: 'scans', ttl: 1800, compress: true }, // 30 minutes in Redis
            writeThrough: true
          }
        },
        undefined, // No loader for cache check
        (data) => {
          // Validate cached data is not too old (1 hour for regular scans, 5 minutes for quick scans)
          const maxAge = quick ? 5 * 60 * 1000 : 60 * 60 * 1000;
          const age = Date.now() - new Date(data.lastUpdated).getTime();
          return age < maxAge;
        }
      );

      if (cachedResults) {
        return NextResponse.json({
          success: true,
          data: cachedResults,
          cached: true,
          age: Date.now() - new Date(cachedResults.lastUpdated).getTime()
        });
      }
    }

    // Prepare job data
    const jobData: WalletScanJobData | QuickScanJobData = quick ? {
      walletAddress: wallet,
      chain: chain as ChainType,
      maxDuration: 10000, // 10 seconds max for quick scan
      topProtocols: 3
    } : {
      walletAddress: wallet,
      chain: chain as ChainType,
      protocols: protocols as ProtocolType[],
      priority: priority as 'low' | 'normal' | 'high' | 'critical',
      options: {
        refresh,
        includeHistory,
        includePrices,
        maxPositions: 100
      }
    };

    // Add job to queue
    const queueName = quick ? 'quick-scan' : 'wallet-scan';
    const jobName = quick ? 'quick-wallet-scan' : 'full-wallet-scan';
    
    const job = await queueManager.addJob(queueName, jobName, jobData, {
      priority: quick ? 10 : 5, // Higher priority for quick scans
      jobId: `${queueName}-${wallet}-${Date.now()}`, // Prevent duplicate jobs
      delay: 0,
      removeOnComplete: 10,
      removeOnFail: 5
    });

    // For quick scans, wait a bit for immediate results
    if (quick) {
      // Wait up to 15 seconds for quick scan results
      const startTime = Date.now();
      const timeout = 15000;

      while (Date.now() - startTime < timeout) {
        const jobStatus = await queueManager.getJob(queueName, job.id!);
        
        if (jobStatus?.finishedOn) {
          // Job completed, check cache for results
          const freshResults = await cache.multiLevel.get<ScanResults>(
            cacheKey,
            { 
              strategy: {
                memory: { namespace: 'scans' },
                redis: { namespace: 'scans', compress: true }
              }
            }
          );

          if (freshResults) {
            return NextResponse.json({
              success: true,
              data: freshResults,
              cached: false,
              quick: true,
              jobId: job.id
            });
          }
          break;
        } else if (jobStatus?.failedReason) {
          return NextResponse.json(
            { 
              error: 'Quick scan failed', 
              reason: jobStatus.failedReason,
              jobId: job.id 
            },
            { status: 500 }
          );
        }

        // Wait 500ms before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Return job information for async tracking
    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: 'queued',
      queue: queueName,
      estimated: quick ? '10-15 seconds' : '30-60 seconds',
      message: quick ? 
        'Quick scan initiated - results should be available soon' : 
        'Full scan initiated - check back using the job ID'
    });

  } catch (error) {
    console.error('Enhanced scan API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Get scan status or results
export async function GET(
  request: NextRequest, 
  { params }: { params: { wallet: string } }
) {
  try {
    await ensureInfrastructure();
    
    const { wallet } = params;
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    const includeMetrics = url.searchParams.get('metrics') === 'true';

    // Validate wallet
    const addressValidation = validateWalletAddress(wallet);
    if (!addressValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const chain = detectChainType(wallet);
    if (!chain) {
      return NextResponse.json(
        { error: 'Unable to detect chain from wallet address' },
        { status: 400 }
      );
    }

    const infrastructure = getProductionInfrastructure();
    const cache = infrastructure.getCache();
    const queueManager = infrastructure.getQueueManager();

    // If jobId provided, check job status
    if (jobId && queueManager) {
      const job = await queueManager.getJob('wallet-scan', jobId) || 
                   await queueManager.getJob('quick-scan', jobId);

      if (!job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }

      // Return job status and results if available
      const response: any = {
        jobId: job.id,
        status: job.finishedOn ? 'completed' : 
               job.failedReason ? 'failed' : 
               job.processedOn ? 'processing' : 'waiting',
        progress: job.progress || 0,
        createdAt: job.timestamp,
        processedAt: job.processedOn,
        completedAt: job.finishedOn,
        failedReason: job.failedReason
      };

      // If job is completed, try to get results from cache
      if (job.finishedOn) {
        const cacheKey = `scan:${wallet}:${chain}`;
        const results = await cache.multiLevel.get<ScanResults>(
          cacheKey,
          { 
            strategy: {
              memory: { namespace: 'scans' },
              redis: { namespace: 'scans', compress: true }
            }
          }
        );

        if (results) {
          response.data = results;
        }
      }

      return NextResponse.json(response);
    }

    // No jobId, return cached results if available
    const cacheKey = `scan:${wallet}:${chain}`;
    const cachedResults = await cache.multiLevel.get<ScanResults>(
      cacheKey,
      { 
        strategy: {
          memory: { namespace: 'scans' },
          redis: { namespace: 'scans', compress: true }
        }
      }
    );

    if (cachedResults) {
      const response: any = {
        success: true,
        data: cachedResults,
        cached: true,
        age: Date.now() - new Date(cachedResults.lastUpdated).getTime()
      };

      // Include cache metrics if requested
      if (includeMetrics) {
        const cacheStats = cache.multiLevel.getStats('scans');
        response.metrics = {
          cacheHitRate: cacheStats.combined.hitRate,
          memoryHitRate: cacheStats.combined.memoryHitRate,
          redisHitRate: cacheStats.combined.redisHitRate
        };
      }

      return NextResponse.json(response);
    }

    return NextResponse.json(
      { message: 'No scan results found. Initiate a scan first.' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Enhanced scan GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Analytics endpoint - get scan analytics for a wallet
export async function PUT(
  request: NextRequest, 
  { params }: { params: { wallet: string } }
) {
  try {
    await ensureInfrastructure();
    
    const { wallet } = params;
    const body = await request.json();
    const { type = 'portfolio', ...options } = body;

    // Validate wallet
    const addressValidation = validateWalletAddress(wallet);
    if (!addressValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const chain = detectChainType(wallet);
    if (!chain) {
      return NextResponse.json(
        { error: 'Unable to detect chain from wallet address' },
        { status: 400 }
      );
    }

    const infrastructure = getProductionInfrastructure();
    const queueManager = infrastructure.getQueueManager();

    if (!queueManager) {
      return NextResponse.json(
        { error: 'Queue system not available' },
        { status: 503 }
      );
    }

    // Queue analytics job
    let jobData: any;
    let queueName: string;
    
    switch (type) {
      case 'portfolio':
        queueName = 'portfolio-analytics';
        jobData = {
          walletAddress: wallet,
          chain: chain as ChainType,
          timeframes: options.timeframes || ['24h', '7d', '30d'],
          includeHodlComparison: options.includeHodlComparison || false,
          includeBenchmarks: options.includeBenchmarks || false
        };
        break;
        
      case 'risk':
        queueName = 'risk-analysis';
        jobData = {
          walletAddress: wallet,
          chain: chain as ChainType,
          analysisDepth: options.depth || 'basic',
          includeImpermanentLoss: options.includeIL !== false,
          includeCorrelation: options.includeCorrelation !== false
        };
        break;
        
      case 'optimization':
        queueName = 'yield-optimization';
        jobData = {
          walletAddress: wallet,
          chain: chain as ChainType,
          riskTolerance: options.riskTolerance || 'medium',
          minAmount: options.minAmount || 1000,
          protocols: options.protocols
        };
        break;
        
      default:
        return NextResponse.json(
          { error: `Unknown analytics type: ${type}` },
          { status: 400 }
        );
    }

    const job = await queueManager.addJob(queueName, `${type}-analytics`, jobData, {
      priority: 3, // Medium priority for analytics
      removeOnComplete: 5,
      removeOnFail: 3
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      type,
      queue: queueName,
      status: 'queued',
      estimated: '2-5 minutes'
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Cache management endpoints
export async function DELETE(
  request: NextRequest, 
  { params }: { params: { wallet: string } }
) {
  try {
    await ensureInfrastructure();
    
    const { wallet } = params;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // Validate wallet
    const addressValidation = validateWalletAddress(wallet);
    if (!addressValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const chain = detectChainType(wallet);
    if (!chain) {
      return NextResponse.json(
        { error: 'Unable to detect chain from wallet address' },
        { status: 400 }
      );
    }

    const infrastructure = getProductionInfrastructure();
    const cache = infrastructure.getCache();

    switch (action) {
      case 'clear-cache':
        // Clear all cache entries for this wallet
        const patterns = [
          `scan:${wallet}:*`,
          `positions:${wallet}:*`,
          `analytics:${wallet}:*`
        ];

        for (const pattern of patterns) {
          await cache.multiLevel.clear(pattern, {
            strategy: {
              memory: { namespace: 'scans' },
              redis: { namespace: 'scans' }
            }
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Cache cleared for wallet',
          patterns
        });

      case 'invalidate':
        // Trigger cache invalidation
        await cache.invalidation.invalidateWalletData(wallet, chain as ChainType, 'manual-api');
        
        return NextResponse.json({
          success: true,
          message: 'Cache invalidation triggered for wallet'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: clear-cache, invalidate' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Cache management error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Example usage:
/*
  POST /api/scan/0x742d35Cc6634C0532925a3b8D6Cd2f59E3Ce0Bd2/enhanced
  Body: { "quick": true, "priority": "high" }
  
  GET /api/scan/0x742d35Cc6634C0532925a3b8D6Cd2f59E3Ce0Bd2/enhanced?jobId=scan_123&metrics=true
  
  PUT /api/scan/0x742d35Cc6634C0532925a3b8D6Cd2f59E3Ce0Bd2/enhanced
  Body: { "type": "portfolio", "timeframes": ["24h", "7d"], "includeHodlComparison": true }
  
  DELETE /api/scan/0x742d35Cc6634C0532925a3b8D6Cd2f59E3Ce0Bd2/enhanced?action=clear-cache
*/