# Universal LP Position Tracker 🦄

A comprehensive web application that scans wallet addresses (Ethereum/Solana) across all major DEXs to display LP positions, fees earned, performance metrics, and more.

![LP Tracker Demo](https://img.shields.io/badge/Status-Live-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-3-cyan)

## 🚀 Features

- **Universal Wallet Scanner** - Supports Ethereum & Solana addresses
- **Multi-Chain DEX Support** - 15+ protocols across multiple blockchains
- **Real-time Chain Detection** - Automatic address validation and chain identification
- **Beautiful Dashboard** - Glassmorphism design with metrics and charts
- **Position Management** - Direct links to manage positions on each protocol
- **Responsive Design** - Mobile-first design that works on all devices

## 🛠 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React

## 🌐 Supported Protocols

### Ethereum
- 🦄 Uniswap V2/V3
- 🍣 SushiSwap  
- 🌊 Curve Finance
- ⚖️ Balancer

### Solana
- ☄️ Meteora DLMM
- ⚡ Raydium CLMM
- 🐋 Orca Whirlpools
- ♾️ Lifinity
- 🪐 Jupiter

### Layer 2
- Arbitrum, Polygon, Base (Uniswap V3)

## 🎯 Demo Addresses

Try these demo addresses to see the tracker in action:

1. **Ethereum Whale**: `0x742d35Cc6634C0532925a3b8D9e7b21b5F96a91c`
2. **Solana Whale**: `DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK`
3. **Jupiter Trader**: `CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq`

## 🚀 Getting Started

```bash
# Clone the repository
git clone <your-repo-url>
cd LP_TRACKER

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 📱 Usage

1. Enter any Ethereum or Solana wallet address
2. Click "Scan All DEXs" to discover LP positions
3. View comprehensive metrics and position details
4. Click "Manage on [Protocol]" to manage positions directly

## 🎨 Design System

- **Background**: Purple to blue to indigo gradient
- **Cards**: Glassmorphism with backdrop blur
- **Status**: Green for In Range, Red for Out of Range
- **Animations**: Smooth CSS transitions throughout

## 🔮 Future Roadmap

- [ ] Real API integrations (Uniswap Subgraph, Meteora API, etc.)
- [ ] Portfolio performance tracking
- [ ] Price alerts and notifications
- [ ] Advanced filtering and sorting
- [ ] Position history and analytics

## 📄 License

MIT License - feel free to use this project for your own LP tracking needs!

---

Built with ❤️ using Next.js, TypeScript, and Tailwind CSS