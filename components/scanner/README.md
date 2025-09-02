# SearchBar Component

The SearchBar component is a React component designed for the Universal LP Position Tracker that allows users to input wallet addresses and automatically detect the blockchain chain (Ethereum or Solana).

## Features

### ✅ Address Validation & Chain Detection
- **Automatic chain detection** using regex patterns
- **Real-time validation** with visual feedback
- **Error handling** with accessible error messages

### ✅ Demo Addresses
- **3 pre-configured demo addresses** representing different user types:
  - Solana Whale (large position holder)
  - Ethereum LP (active LP provider) 
  - Jupiter Trader (multi-DEX trader)

### ✅ Glassmorphism Design
- **Glass effect styling** with backdrop blur and transparency
- **Gradient buttons** with hover and focus states
- **Responsive design** that works on mobile and desktop

### ✅ Accessibility
- **ARIA labels** for screen readers
- **Keyboard navigation** support
- **Focus management** with visible focus indicators
- **Error announcements** with role="alert"

## Usage

```tsx
import { SearchBar } from '@/components/scanner';

function MyComponent() {
  const handleScan = (address: string, chain: 'ethereum' | 'solana') => {
    console.log('Scanning address:', address, 'on chain:', chain);
    // Implement your scanning logic here
  };

  return (
    <SearchBar 
      onScan={handleScan}
      isLoading={false} // Set to true when scanning
    />
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onScan` | `(address: string, chain: 'ethereum' | 'solana') => void` | ✅ | - | Callback function called when user initiates scan |
| `isLoading` | `boolean` | ❌ | `false` | Controls loading state and disables interactions |

## Chain Detection

The component uses regex patterns to automatically detect blockchain chains:

- **Ethereum**: `/^0x[a-fA-F0-9]{40}$/`
- **Solana**: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`

## Demo Addresses

The component includes 3 demo addresses for testing:

1. **Solana Whale**: `9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM`
2. **Ethereum LP**: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
3. **Jupiter Trader**: `DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6zDQz3s9sMbg8L6XJ`

## Dependencies

- `react` - Core React library
- `lucide-react` - Icons (Search, Wallet, Loader2)
- `tailwindcss` - Styling

## Related Components

- `ChainIndicator` - Displays blockchain chain indicators
- Demo addresses configuration in `utils/chains/demoAddresses.ts`
- Validation utilities in `utils/chains/validation.ts`

## File Structure

```
components/scanner/
├── SearchBar.tsx          # Main SearchBar component
├── index.ts              # Export file
└── README.md            # This documentation

utils/chains/
├── validation.ts         # Address validation utilities
└── demoAddresses.ts     # Demo address constants

types/components/
└── SearchBar.ts         # TypeScript type definitions
```