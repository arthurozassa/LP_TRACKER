/**
 * Chain detection utility types for LP Position Tracker
 */

export type SupportedChain = 'ethereum' | 'solana';

export type EthereumNetwork = 
  | 'ethereum'
  | 'arbitrum' 
  | 'polygon'
  | 'base'
  | 'optimism';

export type SolanaNetwork = 'solana';

export type AllNetworks = EthereumNetwork | SolanaNetwork;

export interface ChainInfo {
  id: string;
  name: string;
  type: SupportedChain;
  network: AllNetworks;
  displayName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  chainId?: number; // Only for Ethereum-based chains
}

export interface AddressValidationResult {
  isValid: boolean;
  chain: SupportedChain | null;
  network: AllNetworks | null;
  error?: string;
}

export interface NetworkDetectionResult {
  chain: SupportedChain;
  network: AllNetworks;
  chainInfo: ChainInfo;
  isTestnet: boolean;
}

export interface ValidationConfig {
  allowTestnets?: boolean;
  strictValidation?: boolean;
  supportedNetworks?: AllNetworks[];
}

// Error types for better error handling
export class ChainDetectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public address?: string
  ) {
    super(message);
    this.name = 'ChainDetectionError';
  }
}

export class InvalidAddressError extends ChainDetectionError {
  constructor(address: string, reason?: string) {
    super(
      `Invalid address format: ${address}${reason ? ` - ${reason}` : ''}`,
      'INVALID_ADDRESS',
      address
    );
  }
}

export class UnsupportedChainError extends ChainDetectionError {
  constructor(chain: string) {
    super(
      `Unsupported chain: ${chain}`,
      'UNSUPPORTED_CHAIN'
    );
  }
}