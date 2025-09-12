/**
 * Main exports for Web3 providers
 */

// Base types and interfaces
export * from './base/types';
export * from './base/provider';

// Ethereum provider
export * from './ethereum/config';
export * from './ethereum/provider';
export type { 
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  EthereumBlock,
  EthereumTransaction,
  EthereumLog,
  EthereumProviderError
} from './ethereum/utils';

export { 
  ERROR_CODES,
  isValidEthereumAddress,
  isValidEthereumHash,
  formatWei,
  parseWei,
  normalizeAddress,
  formatBlockNumber,
  parseBlockNumber
} from './ethereum/utils';

// Solana provider  
export * from './solana/config';
export * from './solana/provider';
export type {
  SolanaJsonRpcRequest,
  SolanaJsonRpcResponse,
  SolanaJsonRpcError,
  SolanaAccount,
  SolanaTransaction,
  SolanaBlock,
  SolanaSignatureStatus,
  SolanaTokenAccount,
  SolanaProviderError
} from './solana/utils';

export {
  SOLANA_ERROR_CODES,
  isValidSolanaAddress,
  isValidSolanaSignature,
  formatLamports,
  parseLamports,
  normalizeAccount
} from './solana/utils';

import { EthereumProvider, createEthereumProvider } from './ethereum/provider';
import { SolanaProvider, createSolanaProvider } from './solana/provider';
import { getEthereumConfig, EthereumConfig } from './ethereum/config';
import { getSolanaConfig, SolanaConfig } from './solana/config';
import { ChainType, ProviderConfig } from './base/types';

/**
 * Provider factory for creating providers based on chain type
 */
export class ProviderFactory {
  private static ethereumProvider: EthereumProvider | null = null;
  private static solanaProvider: SolanaProvider | null = null;

  /**
   * Get or create an Ethereum provider
   */
  static async getEthereumProvider(
    network: 'mainnet' | 'sepolia' | 'arbitrum' | 'polygon' | 'base' = 'mainnet',
    config?: Partial<EthereumConfig>
  ): Promise<EthereumProvider> {
    if (!this.ethereumProvider) {
      const defaultConfig = getEthereumConfig(network);
      const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
      
      this.ethereumProvider = createEthereumProvider(finalConfig);
      await this.ethereumProvider.initialize();
    }
    
    return this.ethereumProvider;
  }

  /**
   * Get or create a Solana provider
   */
  static async getSolanaProvider(
    cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta',
    config?: Partial<SolanaConfig>
  ): Promise<SolanaProvider> {
    if (!this.solanaProvider) {
      const defaultConfig = getSolanaConfig(cluster);
      const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
      
      this.solanaProvider = createSolanaProvider(finalConfig);
      await this.solanaProvider.initialize();
    }
    
    return this.solanaProvider;
  }

  /**
   * Create a provider based on address format
   */
  static async getProviderForAddress(address: string): Promise<EthereumProvider | SolanaProvider> {
    if (this.isEthereumAddress(address)) {
      return this.getEthereumProvider();
    } else if (this.isSolanaAddress(address)) {
      return this.getSolanaProvider();
    } else {
      throw new Error(`Unsupported address format: ${address}`);
    }
  }

  /**
   * Check if address is Ethereum format
   */
  static isEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Check if address is Solana format
   */
  static isSolanaAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  /**
   * Get chain type from address
   */
  static getChainType(address: string): ChainType | null {
    if (this.isEthereumAddress(address)) {
      return ChainType.ETHEREUM;
    } else if (this.isSolanaAddress(address)) {
      return ChainType.SOLANA;
    }
    return null;
  }

  /**
   * Destroy all providers and clean up resources
   */
  static async destroyAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (this.ethereumProvider) {
      promises.push(this.ethereumProvider.destroy());
      this.ethereumProvider = null;
    }
    
    if (this.solanaProvider) {
      promises.push(this.solanaProvider.destroy());
      this.solanaProvider = null;
    }
    
    await Promise.all(promises);
  }

  /**
   * Get stats for all providers
   */
  static getProviderStats(): {
    ethereum?: any;
    solana?: any;
    overallHealth: boolean;
  } {
    const stats: any = {};
    let overallHealth = false;

    if (this.ethereumProvider) {
      stats.ethereum = this.ethereumProvider.getProviderStats();
      overallHealth = overallHealth || stats.ethereum.overallHealth;
    }

    if (this.solanaProvider) {
      stats.solana = this.solanaProvider.getProviderStats();
      overallHealth = overallHealth || stats.solana.overallHealth;
    }

    return {
      ...stats,
      overallHealth
    };
  }
}

/**
 * Multi-chain provider that can handle both Ethereum and Solana requests
 */
export class MultiChainProvider {
  private ethereumProvider?: EthereumProvider;
  private solanaProvider?: SolanaProvider;

  constructor(
    ethereumConfig?: EthereumConfig,
    solanaConfig?: SolanaConfig
  ) {
    if (ethereumConfig) {
      this.ethereumProvider = createEthereumProvider(ethereumConfig);
    }
    
    if (solanaConfig) {
      this.solanaProvider = createSolanaProvider(solanaConfig);
    }
  }

  async initialize(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (this.ethereumProvider) {
      promises.push(this.ethereumProvider.initialize());
    }
    
    if (this.solanaProvider) {
      promises.push(this.solanaProvider.initialize());
    }
    
    await Promise.all(promises);
  }

  async getBalance(address: string): Promise<{
    chain: ChainType;
    balance: string;
    symbol: string;
  }> {
    const chainType = ProviderFactory.getChainType(address);
    
    if (chainType === ChainType.ETHEREUM) {
      if (!this.ethereumProvider) {
        throw new Error('Ethereum provider not initialized');
      }
      const balance = await this.ethereumProvider.getBalance(address);
      return {
        chain: ChainType.ETHEREUM,
        balance,
        symbol: 'ETH'
      };
    } else if (chainType === ChainType.SOLANA) {
      if (!this.solanaProvider) {
        throw new Error('Solana provider not initialized');
      }
      const balance = await this.solanaProvider.getBalance(address);
      return {
        chain: ChainType.SOLANA,
        balance,
        symbol: 'SOL'
      };
    } else {
      throw new Error(`Unsupported address format: ${address}`);
    }
  }

  async getAccountInfo(address: string): Promise<{
    chain: ChainType;
    account: any;
  }> {
    const chainType = ProviderFactory.getChainType(address);
    
    if (chainType === ChainType.ETHEREUM) {
      if (!this.ethereumProvider) {
        throw new Error('Ethereum provider not initialized');
      }
      // For Ethereum, we don't have a direct getAccountInfo, but we can get balance and nonce
      const [balance, nonce] = await Promise.all([
        this.ethereumProvider.getBalance(address),
        this.ethereumProvider.getTransactionCount(address)
      ]);
      
      return {
        chain: ChainType.ETHEREUM,
        account: { balance, nonce, address }
      };
    } else if (chainType === ChainType.SOLANA) {
      if (!this.solanaProvider) {
        throw new Error('Solana provider not initialized');
      }
      const account = await this.solanaProvider.getAccountInfo(address);
      return {
        chain: ChainType.SOLANA,
        account
      };
    } else {
      throw new Error(`Unsupported address format: ${address}`);
    }
  }

  getEthereumProvider(): EthereumProvider {
    if (!this.ethereumProvider) {
      throw new Error('Ethereum provider not initialized');
    }
    return this.ethereumProvider;
  }

  getSolanaProvider(): SolanaProvider {
    if (!this.solanaProvider) {
      throw new Error('Solana provider not initialized');
    }
    return this.solanaProvider;
  }

  isHealthy(): boolean {
    let healthy = false;
    
    if (this.ethereumProvider) {
      healthy = healthy || this.ethereumProvider.isHealthy();
    }
    
    if (this.solanaProvider) {
      healthy = healthy || this.solanaProvider.isHealthy();
    }
    
    return healthy;
  }

  async destroy(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (this.ethereumProvider) {
      promises.push(this.ethereumProvider.destroy());
    }
    
    if (this.solanaProvider) {
      promises.push(this.solanaProvider.destroy());
    }
    
    await Promise.all(promises);
  }
}

// Main classes are already defined above

/**
 * Quick start function to get a provider for a specific address
 */
export async function getProviderForAddress(address: string) {
  return ProviderFactory.getProviderForAddress(address);
}

/**
 * Quick start function to detect chain type from address
 */
export function detectChainType(address: string): ChainType | null {
  return ProviderFactory.getChainType(address);
}

/**
 * Configuration presets for common setups
 */
export const PROVIDER_PRESETS = {
  PRODUCTION: {
    ethereum: getEthereumConfig('mainnet'),
    solana: getSolanaConfig('mainnet-beta')
  },
  
  DEVELOPMENT: {
    ethereum: getEthereumConfig('sepolia'),
    solana: getSolanaConfig('devnet')
  },
  
  TESTING: {
    ethereum: {
      ...getEthereumConfig('sepolia'),
      logging: { enabled: true, level: 'debug' as const, includeMetrics: true },
      healthCheck: { enabled: false, interval: 0, timeout: 0, failureThreshold: 0 }
    },
    solana: {
      ...getSolanaConfig('devnet'),
      logging: { enabled: true, level: 'debug' as const, includeMetrics: true },
      healthCheck: { enabled: false, interval: 0, timeout: 0, failureThreshold: 0 }
    }
  }
} as const;