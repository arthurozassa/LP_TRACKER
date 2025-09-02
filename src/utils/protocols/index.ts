// Types
export type { Chain, ProtocolConfig, ProtocolScanConfig, ScanUtility } from './types';
import type { Chain, ProtocolConfig } from './types';
import { protocolRegistry, ProtocolRegistry } from './registry';
import { scanningUtils } from './scanners';

// Protocol configurations
export { 
  ethereumProtocols, 
  l2Protocols 
} from './ethereum';
export { solanaProtocols } from './solana';

// Protocol registry and management
export { 
  protocolRegistry, 
  ProtocolRegistry,
  ETHEREUM_PROTOCOLS,
  L2_PROTOCOLS,
  SOLANA_PROTOCOLS,
  ALL_PROTOCOL_IDS
} from './registry';

// Scanning utilities
export {
  DEFAULT_SCAN_CONFIG,
  BaseProtocolScanner,
  EthereumProtocolScanner,
  SolanaProtocolScanner,
  ScannerFactory,
  UniversalProtocolScanner,
  scanningUtils
} from './scanners';

// Constants and demo data
export * from './constants';

// Helper functions
export * from './helpers';

// Convenience exports for commonly used functions
export const getProtocolsByChain = ProtocolRegistry.getProtocolsByChain;
export const getProtocolById = ProtocolRegistry.getProtocolById;
export const getActiveProtocols = ProtocolRegistry.getActiveProtocols;
export const getProtocolsByFeatures = ProtocolRegistry.getProtocolsByFeatures;
export const getDisplayName = ProtocolRegistry.getDisplayName;
export const getManageUrl = ProtocolRegistry.getManageUrl;
export const getSupportedChains = ProtocolRegistry.getSupportedChains;
export const getProtocolStats = ProtocolRegistry.getProtocolStats;

export const detectWalletType = scanningUtils.detectWalletType;
export const getSupportedProtocols = scanningUtils.getSupportedProtocols;
export const createProgressTracker = scanningUtils.createProgressTracker;

// Protocol constants for easy reference
export const PROTOCOL_EMOJIS = {
  UNISWAP: '🦄',
  SUSHISWAP: '🍣',
  CURVE: '🌊',
  BALANCER: '⚖️',
  METEORA: '☄️',
  RAYDIUM: '⚡',
  ORCA: '🐋',
  LIFINITY: '♾️',
  JUPITER: '🪐',
  PHOENIX: '🔥',
  CAMELOT: '🐪',
  QUICKSWAP: '⚡',
  AERODROME: '✈️',
  ALDRIN: '🌟',
} as const;

export const CHAIN_COLORS = {
  ethereum: '#627EEA',
  arbitrum: '#2D374B',
  polygon: '#8247E5',
  base: '#0052FF',
  solana: '#9945FF',
} as const;

// Helper function to get all protocols with their display info
export function getProtocolDisplayInfo() {
  return Object.values(protocolRegistry).map((protocol: ProtocolConfig) => ({
    id: protocol.id,
    name: protocol.name,
    displayName: `${protocol.emoji} ${protocol.name}`,
    emoji: protocol.emoji,
    color: protocol.color,
    chain: protocol.chain,
    isActive: protocol.isActive,
    features: protocol.supportedFeatures,
  }));
}

// Helper function to get chain-specific protocol info
export function getChainProtocols(chain: Chain) {
  const protocols = ProtocolRegistry.getProtocolsByChain(chain);
  return {
    chain,
    count: protocols.length,
    protocols: protocols.map((p: ProtocolConfig) => ({
      id: p.id,
      name: p.name,
      displayName: `${p.emoji} ${p.name}`,
      emoji: p.emoji,
      color: p.color,
      isActive: p.isActive,
    })),
  };
}