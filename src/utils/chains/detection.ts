/**
 * Network detection utilities for determining specific networks
 */

import { 
  SupportedChain, 
  AllNetworks, 
  EthereumNetwork,
  SolanaNetwork,
  NetworkDetectionResult,
  ChainInfo,
  ValidationConfig,
  ChainDetectionError,
  UnsupportedChainError 
} from './types';
import { CHAIN_CONFIGS, CHAIN_IDS, SUPPORTED_PROTOCOLS } from './constants';
import { validateAddress, detectChainFromAddress } from './validation';

/**
 * Detects network from chain ID (for Ethereum-based chains)
 */
export function detectEthereumNetworkFromChainId(chainId: number): EthereumNetwork | null {
  switch (chainId) {
    case CHAIN_IDS.ETHEREUM:
      return 'ethereum';
    case CHAIN_IDS.ARBITRUM:
      return 'arbitrum';
    case CHAIN_IDS.POLYGON:
      return 'polygon';
    case CHAIN_IDS.BASE:
      return 'base';
    case CHAIN_IDS.OPTIMISM:
      return 'optimism';
    default:
      return null;
  }
}

/**
 * Gets chain info for a specific network
 */
export function getChainInfo(network: AllNetworks): ChainInfo {
  const config = CHAIN_CONFIGS[network];
  
  if (!config) {
    throw new UnsupportedChainError(network);
  }
  
  return config;
}

/**
 * Gets all supported networks for a chain type
 */
export function getSupportedNetworks(chain: SupportedChain): AllNetworks[] {
  switch (chain) {
    case 'ethereum':
      return ['ethereum', 'arbitrum', 'polygon', 'base', 'optimism'];
    case 'solana':
      return ['solana'];
    default:
      throw new UnsupportedChainError(chain);
  }
}

/**
 * Checks if a network is a testnet
 */
export function isTestnet(network: AllNetworks): boolean {
  // For now, all our configured networks are mainnet
  // This can be extended when testnet support is added
  const testnetIdentifiers = ['goerli', 'sepolia', 'mumbai', 'devnet', 'testnet'];
  return testnetIdentifiers.some(identifier => network.includes(identifier));
}

/**
 * Gets supported protocols for a network
 */
export function getSupportedProtocols(network: AllNetworks): string[] {
  const protocols = SUPPORTED_PROTOCOLS[network as keyof typeof SUPPORTED_PROTOCOLS];
  
  if (!protocols) {
    throw new UnsupportedChainError(network);
  }
  
  return [...protocols]; // Return a copy
}

/**
 * Detects network and chain from an address with full context
 */
export function detectNetworkFromAddress(
  address: string,
  config: ValidationConfig = {}
): NetworkDetectionResult {
  // First validate the address
  const validation = validateAddress(address, config);
  
  if (!validation.isValid || !validation.chain || !validation.network) {
    throw new ChainDetectionError(
      validation.error || 'Address validation failed',
      'VALIDATION_FAILED',
      address
    );
  }
  
  const chainInfo = getChainInfo(validation.network);
  
  return {
    chain: validation.chain,
    network: validation.network,
    chainInfo,
    isTestnet: isTestnet(validation.network)
  };
}

/**
 * Auto-detects the best network for scanning based on address
 */
export function autoDetectScanningNetwork(address: string): {
  networks: AllNetworks[];
  primaryNetwork: AllNetworks;
  chain: SupportedChain;
} {
  const chain = detectChainFromAddress(address);
  
  if (!chain) {
    throw new ChainDetectionError(
      'Unable to detect chain from address format',
      'CHAIN_DETECTION_FAILED',
      address
    );
  }
  
  const supportedNetworks = getSupportedNetworks(chain);
  
  // For Ethereum, prioritize mainnet but include L2s
  // For Solana, only mainnet is supported
  let primaryNetwork: AllNetworks;
  let networks: AllNetworks[];
  
  if (chain === 'ethereum') {
    primaryNetwork = 'ethereum';
    networks = ['ethereum', 'arbitrum', 'polygon', 'base', 'optimism'];
  } else {
    primaryNetwork = 'solana';
    networks = ['solana'];
  }
  
  return {
    networks,
    primaryNetwork,
    chain
  };
}

/**
 * Gets all possible networks to scan for an address
 */
export function getAllScanningNetworks(address: string): AllNetworks[] {
  const detection = autoDetectScanningNetwork(address);
  return detection.networks;
}

/**
 * Checks if a protocol is supported on a network
 */
export function isProtocolSupported(protocol: string, network: AllNetworks): boolean {
  try {
    const supportedProtocols = getSupportedProtocols(network);
    return supportedProtocols.includes(protocol);
  } catch {
    return false;
  }
}

/**
 * Gets chain configuration with validation
 */
export function getValidatedChainConfig(network: AllNetworks): ChainInfo {
  const config = getChainInfo(network);
  
  // Validate required fields
  if (!config.id || !config.name || !config.type) {
    throw new ChainDetectionError(
      `Invalid chain configuration for ${network}`,
      'INVALID_CONFIG'
    );
  }
  
  return config;
}

/**
 * Batch detection for multiple addresses
 */
export function batchDetectNetworks(
  addresses: string[],
  config: ValidationConfig = {}
): Record<string, NetworkDetectionResult | { error: string }> {
  const results: Record<string, NetworkDetectionResult | { error: string }> = {};
  
  for (const address of addresses) {
    try {
      results[address] = detectNetworkFromAddress(address, config);
    } catch (error) {
      results[address] = {
        error: error instanceof Error ? error.message : 'Unknown detection error'
      };
    }
  }
  
  return results;
}

/**
 * Gets RPC URL for a network (with fallback)
 */
export function getRpcUrl(network: AllNetworks, index: number = 0): string {
  const config = getChainInfo(network);
  
  if (!config.rpcUrls || config.rpcUrls.length === 0) {
    throw new ChainDetectionError(
      `No RPC URLs configured for ${network}`,
      'NO_RPC_URLS'
    );
  }
  
  // Return the requested index or fallback to first
  const rpcIndex = index < config.rpcUrls.length ? index : 0;
  return config.rpcUrls[rpcIndex];
}

/**
 * Gets block explorer URL for a network
 */
export function getBlockExplorerUrl(network: AllNetworks, index: number = 0): string {
  const config = getChainInfo(network);
  
  if (!config.blockExplorerUrls || config.blockExplorerUrls.length === 0) {
    throw new ChainDetectionError(
      `No block explorer URLs configured for ${network}`,
      'NO_EXPLORER_URLS'
    );
  }
  
  // Return the requested index or fallback to first
  const explorerIndex = index < config.blockExplorerUrls.length ? index : 0;
  return config.blockExplorerUrls[explorerIndex];
}