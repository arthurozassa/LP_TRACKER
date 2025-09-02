import { DemoAddress } from '../../types/components/SearchBar';

/**
 * Demo wallet addresses for testing the LP tracker
 * These addresses represent different types of users across Ethereum and Solana
 */
export const DEMO_ADDRESSES: DemoAddress[] = [
  {
    label: 'Solana Whale',
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    chain: 'solana',
    description: 'Large position holder'
  },
  {
    label: 'Ethereum LP',
    address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    chain: 'ethereum',
    description: 'Active LP provider'
  },
  {
    label: 'Jupiter Trader',
    address: 'DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6zDQz3s9sMbg8L6XJ',
    chain: 'solana',
    description: 'Multi-DEX trader'
  }
] as const;