// Import existing types from the main type definitions
import type { 
  ChainType, 
  ProtocolType, 
  EthereumProtocol, 
  SolanaProtocol, 
  L2Protocol 
} from '../../types';

export type Chain = ChainType;

export interface ProtocolConfig {
  id: ProtocolType;
  name: string;
  emoji: string;
  color: string;
  chain: ChainType;
  website: string;
  logoUri?: string;
  manageUrl?: string;
  apiEndpoint?: string;
  subgraphUrl?: string;
  programId?: string; // For Solana protocols
  factoryAddress?: string; // For Ethereum protocols
  isActive: boolean;
  tvl?: number;
  supportedFeatures: {
    v2: boolean;
    v3: boolean;
    concentrated: boolean;
    stable: boolean;
  };
}

export interface ProtocolScanConfig {
  rpcUrl: string;
  timeout: number;
  retryAttempts: number;
  batchSize: number;
}

export interface ScanUtility {
  scanPositions: (walletAddress: string, config?: ProtocolScanConfig) => Promise<any[]>;
  getPositionDetails: (positionId: string, config?: ProtocolScanConfig) => Promise<any>;
  calculateMetrics: (positions: any[]) => Promise<{
    totalValue: number;
    totalFees: number;
    averageAPR: number;
  }>;
}