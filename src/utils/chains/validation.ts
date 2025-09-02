/**
 * Address validation utilities for chain detection
 */

import { 
  SupportedChain, 
  AllNetworks, 
  AddressValidationResult,
  ValidationConfig,
  InvalidAddressError,
  UnsupportedChainError 
} from './types';
import { ADDRESS_PATTERNS, CHAIN_CONFIGS, SOLANA_PROGRAM_IDS } from './constants';

/**
 * Validates if a string matches Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  return ADDRESS_PATTERNS.ETHEREUM.test(address);
}

/**
 * Validates if a string matches Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Basic format check
  if (!ADDRESS_PATTERNS.SOLANA.test(address)) {
    return false;
  }
  
  // Additional validation: check if it's not a zero address
  const isAllZeros = address.split('').every(char => char === '1');
  if (isAllZeros) {
    return false;
  }
  
  return true;
}

/**
 * Enhanced Solana address validation with program ID checks
 */
export function isValidSolanaAddressStrict(address: string): boolean {
  if (!isValidSolanaAddress(address)) {
    return false;
  }
  
  // Check if it's a known program ID (might be valid but not a wallet)
  const knownProgramIds = Object.values(SOLANA_PROGRAM_IDS);
  const isProgramId = knownProgramIds.includes(address as any);
  
  // For wallet scanning, we typically want user addresses, not program IDs
  // But this is configurable based on use case
  return !isProgramId;
}

/**
 * Detects the chain type from an address
 */
export function detectChainFromAddress(address: string): SupportedChain | null {
  if (!address || typeof address !== 'string') {
    return null;
  }
  
  // Remove whitespace
  const cleanAddress = address.trim();
  
  if (isValidEthereumAddress(cleanAddress)) {
    return 'ethereum';
  }
  
  if (isValidSolanaAddress(cleanAddress)) {
    return 'solana';
  }
  
  return null;
}

/**
 * Comprehensive address validation with detailed results
 */
export function validateAddress(
  address: string, 
  config: ValidationConfig = {}
): AddressValidationResult {
  const { strictValidation = false, supportedNetworks } = config;
  
  try {
    if (!address || typeof address !== 'string') {
      return {
        isValid: false,
        chain: null,
        network: null,
        error: 'Address must be a non-empty string'
      };
    }
    
    const cleanAddress = address.trim();
    
    if (cleanAddress.length === 0) {
      return {
        isValid: false,
        chain: null,
        network: null,
        error: 'Address cannot be empty'
      };
    }
    
    // Detect chain
    const detectedChain = detectChainFromAddress(cleanAddress);
    
    if (!detectedChain) {
      return {
        isValid: false,
        chain: null,
        network: null,
        error: 'Address format does not match any supported chain'
      };
    }
    
    // For Ethereum addresses, we default to ethereum mainnet
    // For Solana addresses, we default to solana mainnet
    const defaultNetwork: AllNetworks = detectedChain === 'ethereum' ? 'ethereum' : 'solana';
    
    // Check if network is supported if config provided
    if (supportedNetworks && !supportedNetworks.includes(defaultNetwork)) {
      return {
        isValid: false,
        chain: detectedChain,
        network: defaultNetwork,
        error: `Network ${defaultNetwork} is not in supported networks list`
      };
    }
    
    // Strict validation for Solana
    if (strictValidation && detectedChain === 'solana') {
      if (!isValidSolanaAddressStrict(cleanAddress)) {
        return {
          isValid: false,
          chain: detectedChain,
          network: defaultNetwork,
          error: 'Address appears to be a program ID, not a wallet address'
        };
      }
    }
    
    return {
      isValid: true,
      chain: detectedChain,
      network: defaultNetwork
    };
    
  } catch (error) {
    return {
      isValid: false,
      chain: null,
      network: null,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

/**
 * Validates multiple addresses and returns results
 */
export function validateAddresses(
  addresses: string[], 
  config: ValidationConfig = {}
): Record<string, AddressValidationResult> {
  const results: Record<string, AddressValidationResult> = {};
  
  for (const address of addresses) {
    results[address] = validateAddress(address, config);
  }
  
  return results;
}

/**
 * Checks if an address is a valid format for a specific chain
 */
export function isValidAddressForChain(
  address: string, 
  chain: SupportedChain
): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  const cleanAddress = address.trim();
  
  switch (chain) {
    case 'ethereum':
      return isValidEthereumAddress(cleanAddress);
    case 'solana':
      return isValidSolanaAddress(cleanAddress);
    default:
      return false;
  }
}

/**
 * Normalizes an address (e.g., checksums for Ethereum)
 */
export function normalizeAddress(address: string, chain: SupportedChain): string {
  if (!address || typeof address !== 'string') {
    throw new InvalidAddressError(address, 'Address must be a string');
  }
  
  const cleanAddress = address.trim();
  
  if (!isValidAddressForChain(cleanAddress, chain)) {
    throw new InvalidAddressError(cleanAddress, `Invalid format for ${chain}`);
  }
  
  switch (chain) {
    case 'ethereum':
      // For Ethereum, return lowercase (could implement checksum here)
      return cleanAddress.toLowerCase();
    case 'solana':
      // Solana addresses are case-sensitive, return as-is
      return cleanAddress;
    default:
      throw new UnsupportedChainError(chain);
  }
}

/**
 * Batch normalizes addresses
 */
export function normalizeAddresses(
  addresses: string[], 
  chain: SupportedChain
): string[] {
  return addresses.map(addr => normalizeAddress(addr, chain));
}