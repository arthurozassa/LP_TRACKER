import { Job, JobsOptions } from 'bullmq';
import { ChainType, ProtocolType, ScanResults, Position } from '../../../types';
import { getMultiLevelCache, CacheStrategies } from '../../cache/strategies';
import { getCacheInvalidationManager } from '../../cache/invalidation';
import pino from 'pino';

const logger = pino({ name: 'scan-jobs' });

export interface WalletScanJobData {
  walletAddress: string;
  chain: ChainType;
  protocols?: ProtocolType[];
  priority?: 'low' | 'normal' | 'high' | 'critical';
  requestId?: string;
  userId?: string;
  options?: {
    refresh?: boolean;
    includeHistory?: boolean;
    includePrices?: boolean;
    maxPositions?: number;
  };
}

export interface WalletScanJobResult {
  walletAddress: string;
  chain: ChainType;
  scanResults: ScanResults;
  duration: number;
  cached: boolean;
  positionsFound: number;
  protocolsScanned: number;
}

export interface ProtocolScanJobData {
  walletAddress: string;
  protocol: ProtocolType;
  chain: ChainType;
  retryCount?: number;
  parentJobId?: string;
}

export interface ProtocolScanJobResult {
  walletAddress: string;
  protocol: ProtocolType;
  chain: ChainType;
  positions: Position[];
  success: boolean;
  error?: string;
  duration: number;
}

export interface QuickScanJobData {
  walletAddress: string;
  chain: ChainType;
  maxDuration: number; // Max scan duration in ms
  topProtocols?: number; // Only scan top N protocols
}

export interface BulkScanJobData {
  walletAddresses: string[];
  chain: ChainType;
  batchSize?: number;
  concurrency?: number;
  priority?: 'low' | 'normal' | 'high';
}

class ScanJobProcessor {
  private cache = getMultiLevelCache();
  private invalidationManager = getCacheInvalidationManager();

  // Main wallet scan job
  async processWalletScan(job: Job<WalletScanJobData>): Promise<WalletScanJobResult> {
    const startTime = Date.now();
    const { walletAddress, chain, protocols, options = {}, requestId } = job.data;

    logger.info('Processing wallet scan job', { 
      walletAddress, 
      chain, 
      protocols: protocols?.length,
      requestId,
      jobId: job.id 
    }, 'Logger message');

    try {
      // Update job progress
      await job.updateProgress(0);

      // Check cache first (unless refresh is requested)
      const cacheKey = `scan:${walletAddress}:${chain}`;
      let scanResults: ScanResults | null = null;
      let cached = false;

      if (!options.refresh) {
        scanResults = await this.cache.get<ScanResults>(
          cacheKey,
          { strategy: CacheStrategies.READ_HEAVY },
          undefined,
          this.validateScanResults
        );
        
        if (scanResults) {
          cached = true;
          logger.info('Wallet scan cache hit', { walletAddress, chain });
        }
      }

      // If no cached results, perform fresh scan
      if (!scanResults) {
        await job.updateProgress(10);
        scanResults = await this.performWalletScan(job);
        
        // Cache the results
        await this.cache.set(cacheKey, scanResults, {
          strategy: CacheStrategies.READ_HEAVY,
          refreshThreshold: 0.7
        }, 'Logger message');
      }

      await job.updateProgress(100);

      const result: WalletScanJobResult = {
        walletAddress,
        chain,
        scanResults,
        duration: Date.now() - startTime,
        cached,
        positionsFound: scanResults.totalPositions,
        protocolsScanned: Object.keys(scanResults.protocols).length
      };

      logger.info('Wallet scan job completed', {
        walletAddress,
        chain,
        duration: result.duration,
        cached,
        positionsFound: result.positionsFound,
        jobId: job.id
      }, 'Logger message');

      return result;

    } catch (error) {
      logger.error('Wallet scan job failed', {
        walletAddress,
        chain,
        error,
        jobId: job.id
      }, 'Logger message');
      throw error;
    }
  }

  // Protocol-specific scan job
  async processProtocolScan(job: Job<ProtocolScanJobData>): Promise<ProtocolScanJobResult> {
    const startTime = Date.now();
    const { walletAddress, protocol, chain, parentJobId } = job.data;

    logger.info('Processing protocol scan job', {
      walletAddress,
      protocol,
      chain,
      parentJobId,
      jobId: job.id
    }, 'Logger message');

    try {
      await job.updateProgress(0);

      // Check cache first
      const cacheKey = `positions:${walletAddress}:${protocol}:${chain}`;
      let positions = await this.cache.get<Position[]>(
        cacheKey,
        { strategy: CacheStrategies.FAST_ACCESS }
      );

      if (!positions) {
        await job.updateProgress(25);
        
        // Simulate protocol scanning (replace with actual implementation)
        positions = await this.scanProtocol(walletAddress, protocol, chain, job);
        
        // Cache the results
        if (positions.length > 0) {
          await this.cache.set(cacheKey, positions, {
            strategy: CacheStrategies.FAST_ACCESS
          }, 'Logger message');
        }
      }

      await job.updateProgress(100);

      const result: ProtocolScanJobResult = {
        walletAddress,
        protocol,
        chain,
        positions,
        success: true,
        duration: Date.now() - startTime
      };

      logger.info('Protocol scan job completed', {
        walletAddress,
        protocol,
        chain,
        positionsFound: positions.length,
        duration: result.duration,
        jobId: job.id
      }, 'Logger message');

      return result;

    } catch (error) {
      const result: ProtocolScanJobResult = {
        walletAddress,
        protocol,
        chain,
        positions: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };

      logger.error('Protocol scan job failed', {
        walletAddress,
        protocol,
        chain,
        error,
        jobId: job.id
      }, 'Logger message');

      return result;
    }
  }

  // Quick scan job for fast responses
  async processQuickScan(job: Job<QuickScanJobData>): Promise<WalletScanJobResult> {
    const startTime = Date.now();
    const { walletAddress, chain, maxDuration, topProtocols = 3 } = job.data;

    logger.info('Processing quick scan job', {
      walletAddress,
      chain,
      maxDuration,
      topProtocols,
      jobId: job.id
    }, 'Logger message');

    try {
      await job.updateProgress(0);

      // Get top protocols for quick scan
      const protocols = await this.getTopProtocols(chain, topProtocols);
      const timePerProtocol = Math.floor((maxDuration * 0.8) / protocols.length);

      await job.updateProgress(20);

      // Scan protocols with time limit
      const scanPromises = protocols.map(protocol =>
        this.scanProtocolWithTimeout(walletAddress, protocol, chain, timePerProtocol)
      );

      const protocolResults = await Promise.allSettled(scanPromises);
      
      await job.updateProgress(80);

      // Build scan results from successful scans
      const scanResults = this.buildScanResults(
        walletAddress,
        chain,
        protocolResults,
        protocols
      );

      await job.updateProgress(100);

      const result: WalletScanJobResult = {
        walletAddress,
        chain,
        scanResults,
        duration: Date.now() - startTime,
        cached: false,
        positionsFound: scanResults.totalPositions,
        protocolsScanned: protocols.length
      };

      logger.info('Quick scan job completed', {
        walletAddress,
        chain,
        duration: result.duration,
        positionsFound: result.positionsFound,
        jobId: job.id
      }, 'Logger message');

      return result;

    } catch (error) {
      logger.error('Quick scan job failed', {
        walletAddress,
        chain,
        error,
        jobId: job.id
      }, 'Logger message');
      throw error;
    }
  }

  // Bulk scan job for multiple wallets
  async processBulkScan(job: Job<BulkScanJobData>): Promise<WalletScanJobResult[]> {
    const { walletAddresses, chain, batchSize = 5, concurrency = 3 } = job.data;

    logger.info('Processing bulk scan job', {
      walletCount: walletAddresses.length,
      chain,
      batchSize,
      concurrency,
      jobId: job.id
    }, 'Logger message');

    try {
      const results: WalletScanJobResult[] = [];
      const totalWallets = walletAddresses.length;
      let processedWallets = 0;

      // Process in batches
      for (let i = 0; i < walletAddresses.length; i += batchSize) {
        const batch = walletAddresses.slice(i, i + batchSize);
        
        // Process batch with limited concurrency
        const batchPromises = batch.map(async (walletAddress) => {
          try {
            // Create individual scan job data
            const scanJobData: WalletScanJobData = {
              walletAddress,
              chain,
              priority: 'normal'
            };

            // Process the scan (simulate creating and processing a child job)
            const childJob = {
              data: scanJobData,
              id: `bulk-${job.id}-${walletAddress}`,
              updateProgress: async () => {}
            } as Job<WalletScanJobData>;

            return await this.processWalletScan(childJob);
          } catch (error) {
            logger.error('Bulk scan wallet failed', { walletAddress, error });
            return null;
          }
        }, 'Logger message');

        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect successful results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          }
        }, 'Logger message');

        processedWallets += batch.length;
        const progress = (processedWallets / totalWallets) * 100;
        await job.updateProgress(progress);

        logger.debug('Bulk scan batch completed', {
          batchStart: i,
          batchSize: batch.length,
          processed: processedWallets,
          total: totalWallets,
          progress
        }, 'Logger message');
      }

      logger.info('Bulk scan job completed', {
        totalWallets: walletAddresses.length,
        successful: results.length,
        failed: walletAddresses.length - results.length,
        jobId: job.id
      }, 'Logger message');

      return results;

    } catch (error) {
      logger.error('Bulk scan job failed', {
        walletCount: walletAddresses.length,
        chain,
        error,
        jobId: job.id
      }, 'Logger message');
      throw error;
    }
  }

  // Helper methods

  private async performWalletScan(job: Job<WalletScanJobData>): Promise<ScanResults> {
    const { walletAddress, chain, protocols } = job.data;
    
    // Get protocols to scan
    const protocolsToScan = protocols || await this.getAllProtocols(chain);
    const totalProtocols = protocolsToScan.length;
    
    const scanResults: ScanResults = {
      chain,
      walletAddress,
      totalValue: 0,
      totalPositions: 0,
      totalFeesEarned: 0,
      avgApr: 0,
      protocols: {},
      lastUpdated: new Date().toISOString()
    };

    // Scan each protocol
    for (let i = 0; i < protocolsToScan.length; i++) {
      const protocol = protocolsToScan[i];
      const progress = 10 + ((i / totalProtocols) * 80);
      
      await job.updateProgress(progress);
      
      try {
        const positions = await this.scanProtocol(walletAddress, protocol, chain, job);
        
        if (positions.length > 0) {
          const protocolValue = positions.reduce((sum, pos) => sum + pos.value, 0);
          const protocolFees = positions.reduce((sum, pos) => sum + pos.feesEarned, 0);
          const avgApr = positions.reduce((sum, pos) => sum + pos.apr, 0) / positions.length;
          
          scanResults.protocols[protocol] = {
            protocol: {
              id: protocol,
              name: this.getProtocolName(protocol),
              chain,
              logoUri: '',
              website: '',
              supported: true
            },
            positions,
            totalValue: protocolValue,
            totalPositions: positions.length,
            totalFeesEarned: protocolFees,
            avgApr,
            isLoading: false
          };
          
          scanResults.totalValue += protocolValue;
          scanResults.totalPositions += positions.length;
          scanResults.totalFeesEarned += protocolFees;
        }
      } catch (error) {
        logger.warn('Protocol scan failed in wallet scan', {
          walletAddress,
          protocol,
          chain,
          error
        }, 'Logger message');
      }
    }

    // Calculate average APR
    if (scanResults.totalPositions > 0) {
      scanResults.avgApr = Object.values(scanResults.protocols)
        .reduce((sum, p) => sum + (p.avgApr * p.totalPositions), 0) / scanResults.totalPositions;
    }

    return scanResults;
  }

  private async scanProtocol(
    walletAddress: string, 
    protocol: ProtocolType, 
    chain: ChainType,
    job?: Job
  ): Promise<Position[]> {
    // This is a mock implementation - replace with actual protocol scanning logic
    
    const delay = Math.random() * 2000 + 500; // 500-2500ms simulation
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Mock some positions for demonstration
    const mockPositions: Position[] = [];
    const positionCount = Math.floor(Math.random() * 3); // 0-2 positions
    
    for (let i = 0; i < positionCount; i++) {
      mockPositions.push({
        id: `${protocol}-${walletAddress}-${i}`,
        protocol: this.getProtocolName(protocol),
        chain,
        pool: `Pool ${i + 1}`,
        liquidity: Math.random() * 1000000,
        value: Math.random() * 50000,
        feesEarned: Math.random() * 1000,
        apr: Math.random() * 100,
        inRange: Math.random() > 0.3,
        tokens: {
          token0: {
            symbol: 'USDC',
            amount: Math.random() * 10000
          },
          token1: {
            symbol: 'ETH',
            amount: Math.random() * 10
          }
        },
        createdAt: new Date().toISOString()
      }, 'Logger message');
    }
    
    return mockPositions;
  }

  private async scanProtocolWithTimeout(
    walletAddress: string,
    protocol: ProtocolType,
    chain: ChainType,
    timeoutMs: number
  ): Promise<Position[]> {
    return Promise.race([
      this.scanProtocol(walletAddress, protocol, chain),
      new Promise<Position[]>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
  }

  private async getTopProtocols(chain: ChainType, count: number): Promise<ProtocolType[]> {
    // Mock implementation - return top protocols by TVL or popularity
    const allProtocols = await this.getAllProtocols(chain);
    return allProtocols.slice(0, count);
  }

  private async getAllProtocols(chain: ChainType): Promise<ProtocolType[]> {
    // Mock implementation - return all supported protocols for chain
    const protocolMap: Record<ChainType, ProtocolType[]> = {
      ethereum: ['uniswap-v2', 'uniswap-v3', 'sushiswap', 'curve', 'balancer'],
      solana: ['meteora-dlmm', 'raydium-clmm', 'orca-whirlpools', 'lifinity', 'jupiter'],
      arbitrum: ['uniswap-v3-arbitrum'],
      polygon: ['uniswap-v3-polygon'],
      base: ['uniswap-v3-base']
    };
    
    return protocolMap[chain] || [];
  }

  private getProtocolName(protocol: ProtocolType): string {
    const nameMap: Record<string, string> = {
      'uniswap-v2': 'Uniswap V2',
      'uniswap-v3': 'Uniswap V3',
      'sushiswap': 'SushiSwap',
      'curve': 'Curve Finance',
      'balancer': 'Balancer',
      'meteora-dlmm': 'Meteora DLMM',
      'raydium-clmm': 'Raydium CLMM',
      'orca-whirlpools': 'Orca Whirlpools',
      'lifinity': 'Lifinity',
      'jupiter': 'Jupiter'
    };
    
    return nameMap[protocol] || protocol;
  }

  private validateScanResults(results: ScanResults): boolean {
    if (!results || !results.walletAddress || !results.chain) {
      return false;
    }
    
    // Check if results are not too old (1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const lastUpdated = new Date(results.lastUpdated).getTime();
    
    return lastUpdated > oneHourAgo;
  }

  private buildScanResults(
    walletAddress: string,
    chain: ChainType,
    protocolResults: PromiseSettledResult<Position[]>[],
    protocols: ProtocolType[]
  ): ScanResults {
    const scanResults: ScanResults = {
      chain,
      walletAddress,
      totalValue: 0,
      totalPositions: 0,
      totalFeesEarned: 0,
      avgApr: 0,
      protocols: {},
      lastUpdated: new Date().toISOString()
    };

    protocolResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        const protocol = protocols[index];
        const positions = result.value;
        const protocolValue = positions.reduce((sum, pos) => sum + pos.value, 0);
        const protocolFees = positions.reduce((sum, pos) => sum + pos.feesEarned, 0);
        const avgApr = positions.reduce((sum, pos) => sum + pos.apr, 0) / positions.length;
        
        scanResults.protocols[protocol] = {
          protocol: {
            id: protocol,
            name: this.getProtocolName(protocol),
            chain,
            logoUri: '',
            website: '',
            supported: true
          },
          positions,
          totalValue: protocolValue,
          totalPositions: positions.length,
          totalFeesEarned: protocolFees,
          avgApr,
          isLoading: false
        };
        
        scanResults.totalValue += protocolValue;
        scanResults.totalPositions += positions.length;
        scanResults.totalFeesEarned += protocolFees;
      }
    }, 'Logger message');

    // Calculate average APR
    if (scanResults.totalPositions > 0) {
      scanResults.avgApr = Object.values(scanResults.protocols)
        .reduce((sum, p) => sum + (p.avgApr * p.totalPositions), 0) / scanResults.totalPositions;
    }

    return scanResults;
  }
}

// Job options for different scan types
export const ScanJobOptions: Record<string, JobsOptions> = {
  WALLET_SCAN: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  },
  
  PROTOCOL_SCAN: {
    removeOnComplete: 100,
    removeOnFail: 30,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000
    }
  },
  
  QUICK_SCAN: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 1,
    jobId: (job) => `quick-scan-${job.data.walletAddress}-${job.data.chain}`
  },
  
  BULK_SCAN: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
};

export default ScanJobProcessor;