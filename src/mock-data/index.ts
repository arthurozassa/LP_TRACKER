export { ethereumWhaleData } from './ethereum-whale';
export { solanaWhaleData } from './solana-whale';
export { jupiterTraderData } from './jupiter-trader';

// Demo addresses mapping
export const DEMO_ADDRESSES = {
  ethereum: '0x742d35Cc6634C0532925a3b8D9e7b21b5F96a91c',
  solanaWhale: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  jupiterTrader: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq'
};

// Function to get mock data by address
export function getMockDataByAddress(address: string) {
  switch (address) {
    case DEMO_ADDRESSES.ethereum:
      return require('./ethereum-whale').ethereumWhaleData;
    case DEMO_ADDRESSES.solanaWhale:
      return require('./solana-whale').solanaWhaleData;
    case DEMO_ADDRESSES.jupiterTrader:
      return require('./jupiter-trader').jupiterTraderData;
    default:
      return null;
  }
}