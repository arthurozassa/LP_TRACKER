// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  field?: string;
}

export interface ValidationError extends ApiError {
  field: string;
  value?: any;
}

// Rate Limiting Types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  windowSize: number;
}

// API Status Types
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database?: 'healthy' | 'unhealthy';
    cache?: 'healthy' | 'unhealthy';
    external_apis?: {
      defi_llama: 'healthy' | 'unhealthy';
      coingecko: 'healthy' | 'unhealthy';
    };
  };
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  performance?: {
    responseTimeMs: number;
    requests24h: number;
    errors24h: number;
  };
}

// Scan API Types
export interface ScanRequest {
  wallet: string;
  chains?: string[];
  protocols?: string[];
  includeHistorical?: boolean;
  refresh?: boolean;
}

export interface ScanProgress {
  scanId: string;
  status: 'queued' | 'scanning' | 'completed' | 'failed';
  progress: number;
  currentProtocol?: string;
  completedProtocols: string[];
  failedProtocols: string[];
  estimatedTimeRemaining?: number;
  startedAt: string;
  completedAt?: string;
}

export interface ScanJobResponse {
  scanId: string;
  status: 'queued' | 'scanning';
  estimatedTime: number;
  websocketUrl?: string;
}

// Protocol API Types
export interface ProtocolListRequest {
  chain?: string;
  supported?: boolean;
  includeMetrics?: boolean;
}

export interface ProtocolMetrics {
  tvl: number;
  volume24h: number;
  users24h: number;
  avgApr: number;
  positions: number;
  lastUpdated: string;
}

export interface ProtocolDetailsResponse {
  id: string;
  name: string;
  chain: string;
  description: string;
  logoUri: string;
  website: string;
  documentation: string;
  supported: boolean;
  version?: string;
  fees: {
    trading: number;
    withdrawal: number;
    management?: number;
  };
  metrics?: ProtocolMetrics;
  supportedFeatures: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

// Position API Types
export interface PositionDetailsRequest {
  includeHistorical?: boolean;
  includePredictions?: boolean;
  timeframe?: '1h' | '24h' | '7d' | '30d' | '90d' | '1y';
}

export interface PositionHistoricalData {
  timestamp: string;
  value: number;
  fees: number;
  apr: number;
  impermanentLoss: number;
  inRange: boolean;
}

export interface PositionPrediction {
  timeframe: '1h' | '24h' | '7d';
  predictedValue: number;
  predictedFees: number;
  predictedIL: number;
  confidence: number;
  scenarios: {
    optimistic: { value: number; fees: number; il: number };
    realistic: { value: number; fees: number; il: number };
    pessimistic: { value: number; fees: number; il: number };
  };
}

export interface PositionDetailsResponse {
  position: import('./index').Position;
  historical?: PositionHistoricalData[];
  predictions?: PositionPrediction[];
  recommendations?: {
    action: 'hold' | 'rebalance' | 'exit' | 'increase';
    reasoning: string;
    urgency: 'low' | 'medium' | 'high';
    expectedImpact: {
      aprChange?: number;
      valueChange?: number;
      riskChange?: 'decrease' | 'maintain' | 'increase';
    };
  };
}

// Analytics API Types
export interface AnalyticsRequest {
  wallets?: string[];
  timeframe?: '24h' | '7d' | '30d' | '90d' | '1y';
  includeComparisons?: boolean;
  includeForecasting?: boolean;
}

export interface AnalyticsAggregates {
  totalValueLocked: number;
  totalFeesEarned: number;
  totalPositions: number;
  activeProtocols: number;
  averageApr: number;
  totalImpermanentLoss: number;
  portfolioROI: number;
  bestPerformingProtocol: string;
  worstPerformingProtocol: string;
}

export interface AnalyticsComparison {
  vsHodl: {
    outperformance: number;
    timeToBreakeven: number;
    riskAdjustedReturn: number;
  };
  vsMarket: {
    beta: number;
    alpha: number;
    sharpeRatio: number;
    correlationETH: number;
    correlationBTC: number;
  };
  vsPeers: {
    percentile: number;
    averageApr: number;
    riskScore: number;
  };
}

export interface AnalyticsForecasting {
  nextWeek: {
    expectedFees: number;
    expectedValue: number;
    confidence: number;
  };
  nextMonth: {
    expectedFees: number;
    expectedValue: number;
    confidence: number;
  };
  riskFactors: {
    factor: string;
    impact: 'low' | 'medium' | 'high';
    probability: number;
    description: string;
  }[];
}

export interface AnalyticsResponse {
  aggregates: AnalyticsAggregates;
  timeframe: string;
  comparison?: AnalyticsComparison;
  forecasting?: AnalyticsForecasting;
  topOpportunities: {
    protocol: string;
    pool: string;
    apr: number;
    tvl: number;
    riskLevel: 'low' | 'medium' | 'high';
    reasoning: string;
  }[];
}

// WebSocket Types for Real-time Updates
export interface WebSocketMessage {
  type: 'scan_progress' | 'position_update' | 'price_update' | 'alert' | 'system_status';
  payload: any;
  timestamp: string;
}

export interface ScanProgressMessage extends WebSocketMessage {
  type: 'scan_progress';
  payload: ScanProgress;
}

export interface PositionUpdateMessage extends WebSocketMessage {
  type: 'position_update';
  payload: {
    positionId: string;
    changes: Partial<import('./index').Position>;
  };
}

export interface PriceUpdateMessage extends WebSocketMessage {
  type: 'price_update';
  payload: {
    symbol: string;
    price: number;
    change24h: number;
  };
}

export interface AlertMessage extends WebSocketMessage {
  type: 'alert';
  payload: import('./index').SmartAlert;
}

export interface SystemStatusMessage extends WebSocketMessage {
  type: 'system_status';
  payload: {
    status: 'operational' | 'degraded' | 'major_outage';
    message?: string;
    affectedServices?: string[];
  };
}

// Request Validation Schemas
export interface RequestValidationSchema {
  wallet?: {
    required: boolean;
    type: 'ethereum' | 'solana' | 'any';
    minLength?: number;
    maxLength?: number;
  };
  chains?: {
    allowed: string[];
    maxItems?: number;
  };
  protocols?: {
    allowed: string[];
    maxItems?: number;
  };
  pagination?: {
    maxLimit: number;
    defaultLimit: number;
  };
  timeframe?: {
    allowed: string[];
    default?: string;
  };
}

// Middleware Types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export interface CorsConfig {
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface ErrorHandlerConfig {
  logErrors: boolean;
  includeStack: boolean;
  customErrorMessages: Record<string, string>;
}

// Cache Types
export interface CacheConfig {
  ttl: number;
  checkPeriod?: number;
  maxSize?: number;
  compression?: boolean;
}

export interface CachedResponse<T = any> {
  data: T;
  cachedAt: string;
  expiresAt: string;
  fresh: boolean;
}

// API Metrics and Monitoring
export interface ApiMetrics {
  endpoint: string;
  method: string;
  requestsCount: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate?: number;
  lastAccessed: string;
  peakResponseTime: number;
  peakRequestTime: string;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage?: number;
  activeConnections: number;
  totalRequests24h: number;
  totalErrors24h: number;
  averageResponseTime: number;
}

// Export commonly used status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Common error codes
export const ERROR_CODES = {
  // Validation Errors
  INVALID_WALLET_ADDRESS: 'INVALID_WALLET_ADDRESS',
  UNSUPPORTED_CHAIN: 'UNSUPPORTED_CHAIN',
  INVALID_PROTOCOL: 'INVALID_PROTOCOL',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_TIMEFRAME: 'INVALID_TIMEFRAME',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Scanning Errors
  SCAN_IN_PROGRESS: 'SCAN_IN_PROGRESS',
  SCAN_FAILED: 'SCAN_FAILED',
  SCAN_TIMEOUT: 'SCAN_TIMEOUT',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  
  // Protocol Errors
  PROTOCOL_UNAVAILABLE: 'PROTOCOL_UNAVAILABLE',
  PROTOCOL_ERROR: 'PROTOCOL_ERROR',
  INSUFFICIENT_LIQUIDITY: 'INSUFFICIENT_LIQUIDITY',
  
  // System Errors
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  
  // Position Errors
  POSITION_NOT_FOUND: 'POSITION_NOT_FOUND',
  POSITION_EXPIRED: 'POSITION_EXPIRED',
  
  // Analytics Errors
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  CALCULATION_ERROR: 'CALCULATION_ERROR',
} as const;