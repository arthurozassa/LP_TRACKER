export interface SearchBarProps {
  onScan: (address: string, chain: 'ethereum' | 'solana') => void;
  isLoading?: boolean;
}

export interface DemoAddress {
  label: string;
  address: string;
  chain: 'ethereum' | 'solana';
  description: string;
}

export type Chain = 'ethereum' | 'solana';

export interface AddressValidation {
  isValid: boolean;
  chain: Chain | null;
  error?: string;
}