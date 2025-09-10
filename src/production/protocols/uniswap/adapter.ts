/**
 * Uniswap Protocol Adapter
 * Integrates Uniswap service with the existing scan API infrastructure
 */

import { UniswapService, createUniswapService, UniswapScanResults } from './index';
import { UniswapChain } from './common/types';
import type { Position, ProtocolData } from '../../../types';
import { ProviderFactory } from '../../providers';

// ============================================================================
// ADAPTER CONFIGURATION
// ============================================================================

export interface UniswapAdapterConfig {
  enableV2: boolean;
  enableV3: boolean;
  chains: UniswapChain[];
  enableCaching: boolean;
  providerConfig?: {
    timeout: number;
    retryCount: number;
  };
}

export const DEFAULT_ADAPTER_CONFIG: UniswapAdapterConfig = {
  enableV2: true,
  enableV3: true,
  chains: [UniswapChain.ETHEREUM, UniswapChain.ARBITRUM, UniswapChain.POLYGON, UniswapChain.BASE],
  enableCaching: true,
  providerConfig: {
    timeout: 30000,
    retryCount: 3
  }
};

// ============================================================================
// ADAPTER CLASS
// ============================================================================

export class UniswapProtocolAdapter {
  private uniswapService: UniswapService;
  private config: UniswapAdapterConfig;

  constructor(config: Partial<UniswapAdapterConfig> = {}) {
    this.config = { ...DEFAULT_ADAPTER_CONFIG, ...config };
    this.uniswapService = createUniswapService({
      chains: this.config.chains,
      enableV2: this.config.enableV2,
      enableV3: this.config.enableV3,
      enableCaching: this.config.enableCaching,
      providerConfig: this.config.providerConfig
    });
  }

  /**
   * Scans Uniswap positions for a wallet address
   * Converts to format expected by existing API
   */
  async scanUniswapPositions(
    walletAddress: string,
    protocols: string[],
    chains: string[],
    onProgress?: (protocol: string, progress: number) => void
  ): Promise<Record<string, ProtocolData>> {
    // Map string chains to UniswapChain enum
    const uniswapChains = this.mapChainsToUniswap(chains);
    
    // Determine which protocols to scan
    const includeV2 = protocols.some(p => this.isV2Protocol(p));
    const includeV3 = protocols.some(p => this.isV3Protocol(p));

    if (!includeV2 && !includeV3) {
      return {};
    }

    try {
      // Perform scan with progress updates
      let lastProgress = 0;
      const scanResults = await this.uniswapService.scanPositions(
        walletAddress,
        {
          chains: uniswapChains,
          includeV2,
          includeV3,
          includeInactive: false
        },
        (update) => {
          if (onProgress && update.totalPositionsFound !== lastProgress) {
            // Report progress for each protocol type
            const protocols = this.getRequestedProtocols(includeV2, includeV3, uniswapChains);
            const currentProtocol = protocols[Math.floor(protocols.length * (update.totalPositionsFound / 100))];
            onProgress(currentProtocol, update.totalPositionsFound);
            lastProgress = update.totalPositionsFound;
          }
        }
      );

      // Convert results to API format
      return this.convertToApiFormat(scanResults, protocols, chains);

    } catch (error) {
      console.error('Uniswap scan failed:', error);
      
      // Return empty protocol data for failed scans
      const protocolData: Record<string, ProtocolData> = {};
      
      for (const protocol of protocols) {
        if (this.isUniswapProtocol(protocol)) {
          protocolData[protocol] = this.createEmptyProtocolData(protocol, chains[0], 'Failed to scan Uniswap positions');
        }
      }
      
      return protocolData;
    }
  }

  /**
   * Gets a specific position by ID
   */
  async getPosition(positionId: string, walletAddress: string): Promise<Position | null> {
    // Position IDs for V3 are typically token IDs
    // For V2, they would be pair addresses
    try {
      const [protocolType, chainStr, identifier] = positionId.split('-');
      
      if (!protocolType || !chainStr || !identifier) {
        return null;
      }

      const chain = this.mapStringToUniswapChain(chainStr);
      if (!chain) return null;

      if (protocolType === 'v3' && this.config.enableV3) {
        // Get V3 position by token ID
        // Implementation would need access to individual scanner
        return null; // Placeholder
      } else if (protocolType === 'v2' && this.config.enableV2) {
        // Get V2 position by pair address  
        // Implementation would need access to individual scanner
        return null; // Placeholder
      }

      return null;
    } catch (error) {
      console.error('Failed to get position:', error);
      return null;
    }
  }

  /**
   * Maps string chains to UniswapChain enum
   */
  private mapChainsToUniswap(chains: string[]): UniswapChain[] {
    return chains.map(chain => this.mapStringToUniswapChain(chain)).filter(Boolean) as UniswapChain[];
  }

  private mapStringToUniswapChain(chain: string): UniswapChain | null {
    switch (chain.toLowerCase()) {
      case 'ethereum':
        return UniswapChain.ETHEREUM;
      case 'arbitrum':
        return UniswapChain.ARBITRUM;
      case 'polygon':
        return UniswapChain.POLYGON;
      case 'base':
        return UniswapChain.BASE;
      case 'optimism':
        return UniswapChain.OPTIMISM;
      default:
        return null;
    }
  }

  /**
   * Checks if protocol is V2
   */
  private isV2Protocol(protocol: string): boolean {
    return protocol === 'uniswap-v2';
  }

  /**
   * Checks if protocol is V3
   */
  private isV3Protocol(protocol: string): boolean {
    return protocol.startsWith('uniswap-v3') || protocol === 'uniswap-v3';
  }

  /**
   * Checks if protocol is any Uniswap protocol
   */
  private isUniswapProtocol(protocol: string): boolean {
    return this.isV2Protocol(protocol) || this.isV3Protocol(protocol);
  }

  /**
   * Gets list of requested protocols
   */
  private getRequestedProtocols(includeV2: boolean, includeV3: boolean, chains: UniswapChain[]): string[] {
    const protocols: string[] = [];
    
    if (includeV2) {
      protocols.push('uniswap-v2');
    }
    
    if (includeV3) {
      for (const chain of chains) {
        if (chain === UniswapChain.ETHEREUM) {
          protocols.push('uniswap-v3');
        } else {
          protocols.push(`uniswap-v3-${chain}`);
        }
      }
    }
    
    return protocols;
  }

  /**
   * Converts UniswapScanResults to API ProtocolData format
   */
  private convertToApiFormat(
    scanResults: UniswapScanResults,
    requestedProtocols: string[],
    chains: string[]
  ): Record<string, ProtocolData> {
    const protocolData: Record<string, ProtocolData> = {};

    // Convert V2 positions
    if (scanResults.v2Positions.length > 0) {
      const v2Positions = scanResults.v2Positions.map(pos => this.convertV2Position(pos));
      
      protocolData['uniswap-v2'] = {
        protocol: {
          id: 'uniswap-v2',
          name: 'Uniswap V2',
          chain: 'ethereum' as any,
          logoUri: 'https://app.uniswap.org/logo.png',
          website: 'https://app.uniswap.org',
          supported: true,
        },
        positions: v2Positions,
        totalValue: scanResults.v2Stats.totalValueUSD,
        totalPositions: scanResults.v2Stats.totalPositions,
        totalFeesEarned: scanResults.v2Stats.totalFeesUSD,
        avgApr: scanResults.v2Stats.avgAPR,
        isLoading: false,
      };
    }

    // Convert V3 positions (group by chain)
    const v3ByChain = new Map<string, typeof scanResults.v3Positions>();
    
    for (const pos of scanResults.v3Positions) {
      const chainKey = pos.chain;
      if (!v3ByChain.has(chainKey)) {
        v3ByChain.set(chainKey, []);
      }
      v3ByChain.get(chainKey)!.push(pos);
    }

    for (const [chainKey, positions] of v3ByChain) {
      const protocolId = chainKey === UniswapChain.ETHEREUM ? 'uniswap-v3' : `uniswap-v3-${chainKey}`;
      const v3Positions = positions.map(pos => this.convertV3Position(pos));
      
      const totalValue = positions.reduce((sum, pos) => sum + pos.liquidityUSD, 0);
      const totalFees = positions.reduce((sum, pos) => sum + pos.feesEarnedUSD, 0);
      const avgAPR = positions.length > 0 ? positions.reduce((sum, pos) => sum + pos.apr, 0) / positions.length : 0;

      protocolData[protocolId] = {
        protocol: {
          id: protocolId,
          name: `Uniswap V3${chainKey !== UniswapChain.ETHEREUM ? ` (${chainKey})` : ''}`,
          chain: this.mapUniswapChainToString(chainKey) as any,
          logoUri: 'https://app.uniswap.org/logo.png',
          website: 'https://app.uniswap.org',
          supported: true,
        },
        positions: v3Positions,
        totalValue,
        totalPositions: positions.length,
        totalFeesEarned: totalFees,
        avgApr: avgAPR,
        isLoading: false,
      };
    }

    // Add empty data for requested protocols that weren't found
    for (const protocol of requestedProtocols) {
      if (this.isUniswapProtocol(protocol) && !protocolData[protocol]) {
        protocolData[protocol] = this.createEmptyProtocolData(protocol, chains[0]);
      }
    }

    return protocolData;
  }

  /**
   * Converts UniswapV2Position to API Position format
   */
  private convertV2Position(pos: any): Position {
    return {
      id: pos.id,
      protocol: pos.protocol,
      chain: this.mapUniswapChainToString(pos.chain) as any,
      pool: `${pos.pool.token0.symbol}/${pos.pool.token1.symbol}`,
      liquidity: pos.liquidity,
      value: pos.liquidityUSD,
      feesEarned: pos.feesEarnedUSD,
      apr: pos.apr,
      inRange: true, // V2 is always "in range"
      tokens: {
        token0: {
          symbol: pos.token0Amount.token.symbol,
          amount: parseFloat(pos.token0Amount.amountHuman),
        },
        token1: {
          symbol: pos.token1Amount.token.symbol,
          amount: parseFloat(pos.token1Amount.amountHuman),
        },
      },
      createdAt: pos.createdAt.toISOString(),
      updatedAt: pos.lastUpdate.toISOString(),
    };
  }

  /**
   * Converts UniswapV3Position to API Position format
   */
  private convertV3Position(pos: any): Position {
    return {
      id: pos.id,
      protocol: pos.protocol,
      chain: this.mapUniswapChainToString(pos.chain) as any,
      pool: `${pos.pool.token0.symbol}/${pos.pool.token1.symbol} (${pos.pool.fee / 10000}%)`,
      liquidity: pos.liquidity,
      value: pos.liquidityUSD,
      feesEarned: pos.feesEarnedUSD,
      apr: pos.apr,
      inRange: pos.inRange,
      tokens: {
        token0: {
          symbol: pos.token0Amount.token.symbol,
          amount: parseFloat(pos.token0Amount.amountHuman),
        },
        token1: {
          symbol: pos.token1Amount.token.symbol,
          amount: parseFloat(pos.token1Amount.amountHuman),
        },
      },
      createdAt: pos.createdAt.toISOString(),
      updatedAt: pos.lastUpdate.toISOString(),
      // V3 specific fields
      tokenId: pos.tokenId,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      priceRange: pos.priceRange,
    };
  }

  /**
   * Maps UniswapChain to string
   */
  private mapUniswapChainToString(chain: UniswapChain): string {
    switch (chain) {
      case UniswapChain.ETHEREUM:
        return 'ethereum';
      case UniswapChain.ARBITRUM:
        return 'arbitrum';
      case UniswapChain.POLYGON:
        return 'polygon';
      case UniswapChain.BASE:
        return 'base';
      case UniswapChain.OPTIMISM:
        return 'optimism';
      default:
        return 'ethereum';
    }
  }

  /**
   * Creates empty protocol data for failed scans
   */
  private createEmptyProtocolData(protocol: string, chain: string, error?: string): ProtocolData {
    const isV3 = this.isV3Protocol(protocol);
    const chainSuffix = protocol.includes('-') ? protocol.split('-').pop() : '';
    
    return {
      protocol: {
        id: protocol,
        name: `Uniswap ${isV3 ? 'V3' : 'V2'}${chainSuffix ? ` (${chainSuffix})` : ''}`,
        chain: chain as any,
        logoUri: 'https://app.uniswap.org/logo.png',
        website: 'https://app.uniswap.org',
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

  /**
   * Gets adapter health status
   */
  getHealth(): {
    isHealthy: boolean;
    uniswapService: any;
    config: UniswapAdapterConfig;
  } {
    return {
      isHealthy: true,
      uniswapService: this.uniswapService.getServiceHealth(),
      config: this.config
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let adapterInstance: UniswapProtocolAdapter | null = null;

/**
 * Gets singleton adapter instance
 */
export function getUniswapAdapter(): UniswapProtocolAdapter {
  if (!adapterInstance) {
    adapterInstance = new UniswapProtocolAdapter();
  }
  return adapterInstance;
}

/**
 * Factory function for creating adapter
 */
export function createUniswapAdapter(config?: Partial<UniswapAdapterConfig>): UniswapProtocolAdapter {
  return new UniswapProtocolAdapter(config);
}

export default UniswapProtocolAdapter;