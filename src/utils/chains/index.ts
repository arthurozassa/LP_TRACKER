/**
 * Chain Detection Utility - Universal LP Position Tracker
 * 
 * A comprehensive utility for detecting and validating blockchain addresses,
 * determining networks, and providing chain-specific configurations.
 * 
 * Features:
 * - Ethereum address validation (including L2s: Arbitrum, Polygon, Base, Optimism)
 * - Solana address validation with program ID filtering
 * - Automatic chain detection from address format
 * - Network-specific configurations and RPC URLs
 * - Protocol support mapping by network
 * - Robust error handling with custom error types
 * - TypeScript strict mode compatibility
 */

// Export types
export type {
  SupportedChain,
  EthereumNetwork,
  SolanaNetwork,
  AllNetworks,
  ChainInfo,
  AddressValidationResult,
  NetworkDetectionResult,
  ValidationConfig,
} from './types';

// Export error classes
export {
  ChainDetectionError,
  InvalidAddressError,
  UnsupportedChainError,
} from './types';

// Export constants
export {
  ADDRESS_PATTERNS,
  CHAIN_IDS,
  CHAIN_CONFIGS,
  SUPPORTED_PROTOCOLS,
  TESTNET_CONFIGS,
  SOLANA_PROGRAM_IDS,
} from './constants';

// Export validation functions
export {
  isValidEthereumAddress,
  isValidSolanaAddress,
  isValidSolanaAddressStrict,
  detectChainFromAddress,
  validateAddress,
  validateAddresses,
  isValidAddressForChain,
  normalizeAddress,
  normalizeAddresses,
} from './validation';

// Export detection functions
export {
  detectEthereumNetworkFromChainId,
  getChainInfo,
  getSupportedNetworks,
  isTestnet,
  getSupportedProtocols,
  detectNetworkFromAddress,
  autoDetectScanningNetwork,
  getAllScanningNetworks,
  isProtocolSupported,
  getValidatedChainConfig,
  batchDetectNetworks,
  getRpcUrl,
  getBlockExplorerUrl,
} from './detection';

// Convenience functions for common use cases

/**
 * Quick address validation - returns boolean
 */
export function isValidAddress(address: string): boolean {
  const { validateAddress } = require('./validation');
  const result = validateAddress(address);
  return result.isValid;
}

/**
 * Quick chain detection - returns chain or null
 */
export function getChainType(address: string) {
  const { detectChainFromAddress } = require('./validation');
  return detectChainFromAddress(address);
}

/**
 * Quick network detection - returns primary network for scanning
 */
export function getPrimaryNetwork(address: string) {
  try {
    const { autoDetectScanningNetwork } = require('./detection');
    const detection = autoDetectScanningNetwork(address);
    return detection.primaryNetwork;
  } catch {
    return null;
  }
}

/**
 * Gets all networks that should be scanned for an address
 */
export function getScanNetworks(address: string) {
  try {
    const { getAllScanningNetworks } = require('./detection');
    return getAllScanningNetworks(address);
  } catch {
    return [];
  }
}

/**
 * Checks if an address is Ethereum-compatible (including L2s)
 */
export function isEthereumCompatible(address: string): boolean {
  const { detectChainFromAddress } = require('./validation');
  const chain = detectChainFromAddress(address);
  return chain === 'ethereum';
}

/**
 * Checks if an address is Solana
 */
export function isSolanaAddress(address: string): boolean {
  const { detectChainFromAddress } = require('./validation');
  const chain = detectChainFromAddress(address);
  return chain === 'solana';
}

/**
 * Gets formatted address info for display
 */
export function getAddressInfo(address: string): {
  address: string;
  chain: any;
  network: any;
  isValid: boolean;
  displayName: string;
  explorerUrl: string | null;
} {
  const { validateAddress } = require('./validation');
  const { getChainInfo } = require('./detection');
  const validation = validateAddress(address);
  
  let displayName = 'Unknown';
  let explorerUrl: string | null = null;
  
  if (validation.isValid && validation.network) {
    try {
      const config = getChainInfo(validation.network);
      displayName = config.displayName;
      explorerUrl = `${config.blockExplorerUrls[0]}/address/${address}`;
    } catch {
      // Fallback handled by defaults above
    }
  }
  
  return {
    address,
    chain: validation.chain,
    network: validation.network,
    isValid: validation.isValid,
    displayName,
    explorerUrl,
  };
}

/**
 * Default configuration for validation
 */
export const DEFAULT_VALIDATION_CONFIG = {
  allowTestnets: false,
  strictValidation: true,
  supportedNetworks: [
    'ethereum',
    'arbitrum', 
    'polygon',
    'base',
    'optimism',
    'solana'
  ],
} as const;

// Demo addresses for testing (as mentioned in requirements)
export const DEMO_ADDRESSES = {
  SOLANA_WHALE: 'J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w',
  ETHEREUM_LP: '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503',
  JUPITER_TRADER: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
} as const;