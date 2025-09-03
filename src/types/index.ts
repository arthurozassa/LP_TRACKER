// Chain Types
export type ChainType = 'ethereum' | 'solana' | 'arbitrum' | 'polygon' | 'base';
export type NetworkType = 'mainnet' | 'testnet';

// Protocol Types
export type EthereumProtocol = 'uniswap-v2' | 'uniswap-v3' | 'sushiswap' | 'curve' | 'balancer';
export type SolanaProtocol = 'meteora-dlmm' | 'raydium-clmm' | 'orca-whirlpools' | 'lifinity' | 'jupiter';
export type L2Protocol = 'uniswap-v3-arbitrum' | 'uniswap-v3-polygon' | 'uniswap-v3-base';
export type ProtocolType = EthereumProtocol | SolanaProtocol | L2Protocol;

// Token Types
export interface Token {
  symbol: string;
  address?: string;
  amount: number;
  decimals?: number;
  logoUri?: string;
}

export interface TokenPair {
  token0: Token;
  token1: Token;
}

// Position Types
export interface Position {
  id: string;
  protocol: string;
  chain?: ChainType;
  pool: string;
  poolAddress?: string;
  liquidity: number;
  value: number;
  feesEarned: number;
  apr: number;
  apy?: number;
  inRange: boolean;
  tokens: TokenPair;
  createdAt?: string;
  updatedAt?: string;
  tickLower?: number;
  tickUpper?: number;
  currentTick?: number;
  priceRange?: {
    lower: number;
    upper: number;
    current: number;
  };
  manageUrl?: string;
  yield24h?: number;
  yield7d?: number;
  yield30d?: number;
  impermanentLoss?: number;
}

// Protocol Info Types
export interface ProtocolInfo {
  id: string;
  name: string;
  chain: ChainType;
  logoUri: string;
  website: string;
  tvl?: number;
  supported: boolean;
}

export interface ProtocolData {
  protocol: ProtocolInfo;
  positions: Position[];
  totalValue: number;
  totalPositions: number;
  totalFeesEarned: number;
  avgApr: number;
  isLoading: boolean;
  error?: string;
}

// Scan Results Types
export interface ScanResults {
  chain: ChainType;
  walletAddress: string;
  totalValue: number;
  totalPositions: number;
  totalFeesEarned: number;
  avgApr: number;
  protocols: Record<string, ProtocolData>;
  lastUpdated: string;
  scanDuration?: number;
}

// Loading States
export interface LoadingState {
  isScanning: boolean;
  currentProtocol?: string;
  completedProtocols: string[];
  failedProtocols: string[];
  progress: number;
}

export interface ProtocolLoadingState {
  protocol: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
  positionsFound?: number;
}

// Dashboard Metrics
export interface DashboardMetrics {
  totalValue: number;
  totalFeesEarned: number;
  avgApr: number;
  activeProtocols: number;
  inRangePositions: number;
  outOfRangePositions: number;
  totalYield24h: number;
  totalYield7d: number;
  totalYield30d: number;
  totalImpermanentLoss: number;
  
  // Advanced Performance Metrics
  totalROI: number;                    // Total Return on Investment
  hodlROI: number;                     // HODL strategy ROI for comparison
  outperformance: number;              // LP vs HODL performance difference
  sharpeRatio: number;                 // Risk-adjusted return
  maxDrawdown: number;                 // Maximum peak-to-valley decline
  winRate: number;                     // Percentage of profitable positions
  volatility: number;                  // Portfolio volatility (annualized)
  
  // Time-based metrics
  valueChange1h: number;
  valueChange24h: number;
  valueChange7d: number;
  valueChange30d: number;
  
  // Risk metrics
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  correlationETH: number;              // Correlation with ETH price
  correlationBTC: number;              // Correlation with BTC price
  beta: number;                        // Portfolio beta vs market
}

// Chart Data Types
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  fees?: number;
  apr?: number;
  impermanentLoss?: number;
  hodlValue?: number;
  volume?: number;
  price?: number;
}

// Advanced Analytics Types
export interface HistoricalData {
  portfolio: TimeSeriesDataPoint[];
  hodlComparison: TimeSeriesDataPoint[];
  marketBenchmarks: {
    eth: TimeSeriesDataPoint[];
    btc: TimeSeriesDataPoint[];
    sol?: TimeSeriesDataPoint[];
  };
  protocols: Record<string, TimeSeriesDataPoint[]>;
}

export interface PerformanceMetrics {
  roi: number;
  apr: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  beta: number;
  alpha: number;
  winRate: number;
  profitFactor: number;
  calmarRatio: number;
}

export interface RiskMetrics {
  var95: number;                       // Value at Risk (95%)
  var99: number;                       // Value at Risk (99%)
  expectedShortfall: number;           // Conditional VaR
  downsideDeviation: number;           // Downside risk
  sortinoRatio: number;                // Downside-adjusted return
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

export interface HodlComparison {
  lpStrategy: {
    value: number;
    roi: number;
    fees: number;
    impermanentLoss: number;
  };
  hodlStrategy: {
    value: number;
    roi: number;
    allocation: Record<string, number>; // Token allocations
  };
  outperformance: {
    absolute: number;
    percentage: number;
    timeToBreakeven?: number;           // Days to outperform HODL
  };
}

export interface MarketBenchmark {
  asset: 'ETH' | 'BTC' | 'SOL' | 'SPY' | 'DXY';
  symbol: string;
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  correlation: number;                 // Correlation with portfolio
  beta: number;                        // Beta vs this benchmark
}

export interface YieldOptimization {
  currentAPR: number;
  suggestedActions: {
    action: 'rebalance' | 'exit' | 'enter' | 'compound';
    protocol: string;
    pool: string;
    expectedAPR: number;
    risk: 'low' | 'medium' | 'high';
    reasoning: string;
    urgency: 'low' | 'medium' | 'high';
  }[];
  bestOpportunities: {
    protocol: string;
    pool: string;
    apr: number;
    tvl: number;
    volume24h: number;
    risk: 'low' | 'medium' | 'high';
  }[];
}

export interface SmartAlert {
  id: string;
  type: 'range_exit' | 'rebalance' | 'yield_drop' | 'high_il' | 'opportunity' | 'risk_warning';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  positionId?: string;
  protocol?: string;
  actionRequired: boolean;
  createdAt: string;
  dismissed: boolean;
}

export interface ProtocolDistribution extends ChartDataPoint {
  protocol: string;
  positions: number;
}

// Wallet Types
export interface WalletInfo {
  address: string;
  chain: ChainType;
  isValid: boolean;
  balance?: number;
  lastActivity?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ScanApiResponse extends ApiResponse<ScanResults> {
  scanId?: string;
}

export interface ProtocolApiResponse extends ApiResponse<ProtocolData> {
  cached?: boolean;
  cacheExpiry?: string;
}

// Filter and Sort Types
export type SortField = 'value' | 'feesEarned' | 'apr' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface FilterOptions {
  protocols: string[];
  chains: ChainType[];
  inRangeOnly: boolean;
  minValue: number;
  minApr: number;
}

export interface SortOptions {
  field: SortField;
  direction: SortDirection;
}

// Component Props Types
export interface ScannerProps {
  onScanComplete: (results: ScanResults) => void;
  onScanStart: () => void;
  onScanError: (error: string) => void;
  initialAddress?: string;
}

export interface DashboardProps {
  scanResults: ScanResults | null;
  isLoading: boolean;
  onRescan?: () => void;
  onProtocolFilter?: (protocols: string[]) => void;
}

export interface PositionCardProps {
  position: Position;
  onClick?: (position: Position) => void;
  showManageButton?: boolean;
  compact?: boolean;
}

export interface ProtocolCardProps {
  protocolData: ProtocolData;
  onClick?: (protocol: string) => void;
  isExpanded?: boolean;
}

export interface MetricsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  loading?: boolean;
}

export interface ChartProps {
  data: ChartDataPoint[] | TimeSeriesDataPoint[];
  title?: string;
  height?: number;
  loading?: boolean;
}

// Error Types
export interface ScanError {
  protocol: string;
  message: string;
  code?: string;
  retryable: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Demo Data Types
export interface DemoWallet {
  name: string;
  address: string;
  chain: ChainType;
  description: string;
  tags: string[];
}

// Settings Types
export interface UserSettings {
  defaultChain: ChainType;
  autoRefresh: boolean;
  refreshInterval: number;
  showOutOfRange: boolean;
  preferredCurrency: 'USD' | 'ETH' | 'SOL';
  notifications: {
    priceAlerts: boolean;
    rangeAlerts: boolean;
    feeThreshold: number;
  };
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Export constants
export const SUPPORTED_CHAINS: ChainType[] = ['ethereum', 'solana', 'arbitrum', 'polygon', 'base'];

export const ETHEREUM_PROTOCOLS: EthereumProtocol[] = [
  'uniswap-v2',
  'uniswap-v3',
  'sushiswap',
  'curve',
  'balancer'
];

export const SOLANA_PROTOCOLS: SolanaProtocol[] = [
  'meteora-dlmm',
  'raydium-clmm',
  'orca-whirlpools',
  'lifinity',
  'jupiter'
];

export const L2_PROTOCOLS: L2Protocol[] = [
  'uniswap-v3-arbitrum',
  'uniswap-v3-polygon',
  'uniswap-v3-base'
];

export const CHAIN_REGEX = {
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
} as const;

// Type Guards
export const isEthereumAddress = (address: string): boolean => CHAIN_REGEX.ethereum.test(address);
export const isSolanaAddress = (address: string): boolean => CHAIN_REGEX.solana.test(address);

export const detectChainType = (address: string): ChainType | null => {
  if (isEthereumAddress(address)) return 'ethereum';
  if (isSolanaAddress(address)) return 'solana';
  return null;
};