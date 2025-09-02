import { Chain, AddressValidation } from '../../types/components/SearchBar';

// Chain detection regexes
export const CHAIN_REGEXES = {
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
} as const;

/**
 * Detects the blockchain from a wallet address
 * @param address - The wallet address to validate
 * @returns The detected chain or null if invalid
 */
export const detectChain = (address: string): Chain | null => {
  const trimmedAddress = address.trim();
  
  if (CHAIN_REGEXES.ethereum.test(trimmedAddress)) {
    return 'ethereum';
  } else if (CHAIN_REGEXES.solana.test(trimmedAddress)) {
    return 'solana';
  }
  
  return null;
};

/**
 * Validates a wallet address and returns detailed validation info
 * @param address - The wallet address to validate
 * @returns Validation result with chain detection and error info
 */
export const validateAddress = (address: string): AddressValidation => {
  if (!address || !address.trim()) {
    return {
      isValid: false,
      chain: null,
      error: 'Address is required'
    };
  }

  const trimmedAddress = address.trim();
  const detectedChain = detectChain(trimmedAddress);

  if (!detectedChain) {
    return {
      isValid: false,
      chain: null,
      error: 'Invalid address format. Please enter a valid Ethereum or Solana address.'
    };
  }

  return {
    isValid: true,
    chain: detectedChain
  };
};

/**
 * Formats an address for display (shortens long addresses)
 * @param address - The address to format
 * @param startLength - Number of characters to show at start (default: 8)
 * @param endLength - Number of characters to show at end (default: 6)
 * @returns Formatted address string
 */
export const formatAddress = (
  address: string,
  startLength: number = 8,
  endLength: number = 6
): string => {
  if (!address || address.length <= startLength + endLength) {
    return address;
  }
  
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};