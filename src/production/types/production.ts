/**
 * Production-specific types and interfaces
 * Extends base types with production features
 */

import { 
  Position, 
  ScanResults, 
  ChainType, 
  ProtocolType,
  TimeSeriesDataPoint,
  PerformanceMetrics,
  RiskMetrics,
} from '../../types';

// ============================================================================
// PRODUCTION CONFIGURATION TYPES
// ============================================================================

export interface ProductionConfig {
  environment: 'demo' | 'production';
  database: DatabaseConfig;
  cache: CacheConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  rateLimit: RateLimitConfig;
  features: ProductionFeatureFlags;
}

export interface DatabaseConfig {
  url: string;
  ssl: boolean;
  poolSize: number;
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
}

export interface CacheConfig {
  provider: 'redis' | 'memory';
  url?: string;
  ttl: {
    positions: number;
    prices: number;
    protocols: number;
    analytics: number;
  };
  keyPrefix: string;
  compression: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  sentry?: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
  };
  analytics?: {
    posthog?: string;
    mixpanel?: string;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    structured: boolean;
    enableQueries: boolean;
  };
}

export interface SecurityConfig {
  jwtSecret: string;
  encryptionKey: string;
  corsOrigins: string[];
  csrfProtection: boolean;
  rateLimiting: boolean;
  webhookSecret: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  keyGenerator?: (req: any) => string;
}

export interface ProductionFeatureFlags {
  realTimeData: boolean;
  advancedAnalytics: boolean;
  portfolioTracking: boolean;
  yieldOptimization: boolean;
  smartAlerts: boolean;
  socialFeatures: boolean;
  apiAccess: boolean;
  webhooks: boolean;
}

// ============================================================================
// DATA PIPELINE TYPES
// ============================================================================

export interface DataSource {
  id: string;
  name: string;
  type: 'rpc' | 'api' | 'subgraph' | 'websocket';
  chain: ChainType;
  protocol?: ProtocolType;
  endpoint: string;
  backupEndpoint?: string;
  apiKey?: string;
  rateLimit: {
    requestsPerSecond: number;
    burstCapacity: number;
  };
  reliability: {
    uptime: number;
    avgResponseTime: number;
    errorRate: number;
  };
  isActive: boolean;
  lastCheck: Date;
}

export interface DataPipeline {
  id: string;
  name: string;
  description: string;
  sources: DataSource[];
  processors: DataProcessor[];
  outputs: DataOutput[];
  schedule: PipelineSchedule;
  status: PipelineStatus;
  metrics: PipelineMetrics;
}

export interface DataProcessor {
  id: string;
  name: string;
  type: 'transform' | 'validate' | 'enrich' | 'aggregate';
  config: Record<string, any>;
  dependencies: string[];
  isActive: boolean;
}

export interface DataOutput {
  id: string;
  name: string;
  type: 'database' | 'cache' | 'api' | 'webhook';
  destination: string;
  format: 'json' | 'csv' | 'parquet';
  compression?: 'gzip' | 'lz4';
}

export interface PipelineSchedule {
  type: 'cron' | 'interval' | 'event';
  expression: string;
  timezone?: string;
  enabled: boolean;
}

export interface PipelineStatus {
  state: 'idle' | 'running' | 'failed' | 'paused';
  lastRun: Date;
  nextRun?: Date;
  duration?: number;
  error?: string;
}

export interface PipelineMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  avgDuration: number;
  dataProcessed: number;
  errorsToday: number;
}

// ============================================================================
// REAL-TIME DATA TYPES
// ============================================================================

export interface RealTimeConnection {
  id: string;
  protocol: ProtocolType;
  chain: ChainType;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  lastHeartbeat: Date;
  subscriptions: RealTimeSubscription[];
}

export interface RealTimeSubscription {
  id: string;
  type: 'prices' | 'positions' | 'swaps' | 'fees';
  filters: Record<string, any>;
  callback: (data: any) => void;
  isActive: boolean;
}

export interface RealTimeUpdate {
  id: string;
  type: 'position_update' | 'price_update' | 'fee_earned' | 'range_exit';
  timestamp: Date;
  protocol: ProtocolType;
  chain: ChainType;
  data: any;
  processed: boolean;
}

// ============================================================================
// ADVANCED ANALYTICS TYPES
// ============================================================================

export interface AnalyticsJob {
  id: string;
  type: 'portfolio_analysis' | 'risk_assessment' | 'yield_optimization' | 'market_analysis';
  walletAddress: string;
  parameters: Record<string, any>;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface PortfolioAnalysis {
  walletAddress: string;
  analysisDate: Date;
  timeframe: '1d' | '7d' | '30d' | '90d' | '1y';
  
  // Portfolio Overview
  totalValue: number;
  totalPositions: number;
  activeProtocols: number;
  diversificationScore: number;
  
  // Performance Metrics
  performance: PerformanceMetrics;
  risk: RiskMetrics;
  
  // Detailed Analysis
  protocolBreakdown: ProtocolAnalysis[];
  correlationMatrix: number[][];
  riskContribution: RiskContribution[];
  optimalAllocation: AllocationRecommendation[];
  
  // Predictions
  projectedValue: PredictionData[];
  riskScenarios: RiskScenario[];
}

export interface ProtocolAnalysis {
  protocol: ProtocolType;
  chain: ChainType;
  positions: number;
  value: number;
  weight: number;
  performance: PerformanceMetrics;
  risk: RiskMetrics;
  contribution: {
    return: number;
    risk: number;
  };
}

export interface RiskContribution {
  protocol: ProtocolType;
  chain: ChainType;
  contribution: number;
  marginRisk: number;
  componentRisk: number;
}

export interface AllocationRecommendation {
  protocol: ProtocolType;
  chain: ChainType;
  currentWeight: number;
  recommendedWeight: number;
  expectedReturn: number;
  expectedRisk: number;
  reasoning: string;
}

export interface PredictionData {
  date: Date;
  value: number;
  confidence: number;
  scenario: 'optimistic' | 'base' | 'pessimistic';
}

export interface RiskScenario {
  name: string;
  probability: number;
  impact: number;
  potentialLoss: number;
  description: string;
  mitigation: string[];
}

// ============================================================================
// YIELD OPTIMIZATION TYPES
// ============================================================================

export interface YieldOpportunity {
  id: string;
  protocol: ProtocolType;
  chain: ChainType;
  pool: string;
  tokens: string[];
  
  // Yield Metrics
  currentAPR: number;
  projectedAPR: number;
  fees24h: number;
  volume24h: number;
  tvl: number;
  
  // Risk Assessment
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  impermanentLossRisk: number;
  liquidityRisk: number;
  smartContractRisk: number;
  
  // Requirements
  minInvestment: number;
  maxInvestment?: number;
  lockupPeriod?: number;
  
  // Action Details
  action: 'enter' | 'exit' | 'rebalance' | 'migrate';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  expectedOutcome: string;
  
  // Implementation
  steps: ActionStep[];
  estimatedGasCost: number;
  estimatedTimeToComplete: number;
  
  createdAt: Date;
  validUntil: Date;
}

export interface ActionStep {
  order: number;
  type: 'approve' | 'deposit' | 'withdraw' | 'swap' | 'claim';
  description: string;
  contract: string;
  method: string;
  parameters: Record<string, any>;
  estimatedGas: number;
  required: boolean;
}

export interface YieldOptimizationReport {
  walletAddress: string;
  generatedAt: Date;
  timeframe: string;
  
  // Current Status
  totalValue: number;
  totalAPR: number;
  totalRisk: number;
  
  // Optimization Results
  opportunities: YieldOpportunity[];
  potentialGains: {
    additionalAPR: number;
    additionalYield: number;
    riskAdjustedReturn: number;
  };
  
  // Recommendations
  topRecommendations: YieldOpportunity[];
  quickWins: YieldOpportunity[];
  longTermStrategies: YieldOpportunity[];
  
  // Implementation Plan
  executionPlan: {
    phase: number;
    actions: YieldOpportunity[];
    estimatedValue: number;
    estimatedRisk: number;
    timeframe: string;
  }[];
}

// ============================================================================
// SMART ALERTS TYPES
// ============================================================================

export interface SmartAlert {
  id: string;
  userId?: string;
  walletAddress: string;
  
  // Alert Configuration
  type: AlertType;
  conditions: AlertCondition[];
  actions: AlertAction[];
  
  // Status
  isActive: boolean;
  isTriggered: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  
  // Metadata
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

export type AlertType = 
  | 'position_out_of_range'
  | 'yield_below_threshold'
  | 'impermanent_loss_high'
  | 'pool_tvl_change'
  | 'price_movement'
  | 'gas_price_optimal'
  | 'new_opportunity'
  | 'risk_level_change'
  | 'portfolio_rebalance';

export interface AlertCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte' | 'between' | 'not_between';
  value: number | string | [number, number];
  timeframe?: string;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'push' | 'sms';
  destination: string;
  template?: string;
  cooldown?: number; // minutes between alerts
}

export interface AlertExecution {
  id: string;
  alertId: string;
  triggeredAt: Date;
  conditions: AlertCondition[];
  data: Record<string, any>;
  actions: {
    type: string;
    destination: string;
    status: 'pending' | 'sent' | 'failed';
    sentAt?: Date;
    error?: string;
  }[];
}

// ============================================================================
// API AND INTEGRATION TYPES
// ============================================================================

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  permissions: ApiPermission[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ApiPermission {
  resource: 'positions' | 'analytics' | 'alerts' | 'webhooks' | 'optimization';
  actions: ('read' | 'write' | 'delete')[];
  restrictions?: Record<string, any>;
}

export interface ApiUsage {
  keyId: string;
  date: string;
  requests: number;
  bandwidth: number;
  errors: number;
  avgResponseTime: number;
}

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
  };
  createdAt: Date;
  lastTriggered?: Date;
}

export type WebhookEvent = 
  | 'position.created'
  | 'position.updated'
  | 'position.closed'
  | 'alert.triggered'
  | 'analysis.completed'
  | 'opportunity.found';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: any;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttempt?: Date;
  nextAttempt?: Date;
  response?: {
    status: number;
    body: string;
    headers: Record<string, string>;
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface ProductionMetrics {
  // System Health
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  
  // Data Quality
  dataFreshness: number;
  dataCompleteness: number;
  dataAccuracy: number;
  
  // Business Metrics
  activeUsers: number;
  positionsTracked: number;
  alertsSent: number;
  apiCalls: number;
  
  // Performance
  cacheHitRate: number;
  databaseConnections: number;
  queueLength: number;
  backgroundJobs: number;
}

export interface ProductionStatus {
  environment: string;
  version: string;
  buildDate: Date;
  deployDate: Date;
  health: 'healthy' | 'degraded' | 'down';
  services: ServiceStatus[];
  metrics: ProductionMetrics;
  lastUpdate: Date;
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  dependencies: string[];
}

// ============================================================================
// TYPE GUARDS AND UTILITIES
// ============================================================================

export function isProductionMode(): boolean {
  return process.env.NODE_ENV === 'production' && 
         process.env.NEXT_PUBLIC_APP_MODE === 'production';
}

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_APP_MODE === 'demo';
}

export function isRealTimeEnabled(): boolean {
  return isProductionMode() && process.env.ENABLE_REAL_TIME_UPDATES === 'true';
}

export function isAnalyticsEnabled(): boolean {
  return process.env.ENABLE_ADVANCED_ANALYTICS === 'true';
}

export function isFeatureEnabled(feature: keyof ProductionFeatureFlags): boolean {
  const envKey = `ENABLE_${feature.toUpperCase().replace(/([A-Z])/g, '_$1')}`;
  return process.env[envKey] === 'true';
}

// ============================================================================
// PRODUCTION RESULT TYPES (Extensions of base types)
// ============================================================================

export interface ProductionScanResults extends ScanResults {
  // Enhanced data
  realTimeUpdates: boolean;
  dataFreshness: Date;
  confidence: number;
  
  // Analytics
  analysis?: PortfolioAnalysis;
  optimization?: YieldOptimizationReport;
  alerts?: SmartAlert[];
  
  // Metadata
  scanId: string;
  userId?: string;
  cached: boolean;
  cacheExpiry?: Date;
  apiVersion: string;
}

export interface ProductionPosition extends Position {
  // Enhanced data
  realTimeData: boolean;
  lastUpdate: Date;
  confidence: number;
  
  // Risk data
  riskMetrics: RiskMetrics;
  scenarios: RiskScenario[];
  
  // Optimization
  opportunities: YieldOpportunity[];
  recommendations: string[];
  
  // Alerts
  activeAlerts: SmartAlert[];
  
  // Metadata
  dataSource: string;
  processingTime: number;
  apiVersion: string;
}

export default {
  isProductionMode,
  isDemoMode,
  isRealTimeEnabled,
  isAnalyticsEnabled,
  isFeatureEnabled,
};