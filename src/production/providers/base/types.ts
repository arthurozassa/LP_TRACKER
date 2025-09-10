/**
 * Base types and interfaces for Web3 providers
 */

export enum ProviderStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  DOWN = 'down',
  UNKNOWN = 'unknown'
}

export enum ChainType {
  ETHEREUM = 'ethereum',
  SOLANA = 'solana'
}

export interface RpcEndpoint {
  id: string;
  url: string;
  priority: number;
  maxRequestsPerSecond: number;
  timeout: number;
  healthCheckInterval: number;
  retryConfig: RetryConfig;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export interface ProviderHealth {
  status: ProviderStatus;
  latency: number;
  lastChecked: Date;
  errorRate: number;
  consecutiveErrors: number;
  lastError?: Error;
}

export interface RpcMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  requestsPerSecond: number;
  lastRequestTime: Date;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  keepAlive: boolean;
}

export interface ProviderConfig {
  chainType: ChainType;
  endpoints: RpcEndpoint[];
  connectionPool: ConnectionPoolConfig;
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    failureThreshold: number;
  };
  rateLimiting: {
    enabled: boolean;
    globalLimit: number;
    perEndpointLimit: number;
    windowMs: number;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    includeMetrics: boolean;
  };
}

export interface ProviderError extends Error {
  code: string;
  endpoint?: string;
  retryable: boolean;
  originalError?: Error;
}

export interface RequestContext {
  method: string;
  params?: any[];
  endpoint?: string;
  attempt: number;
  startTime: number;
  timeout: number;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected health: Map<string, ProviderHealth>;
  protected metrics: Map<string, RpcMetrics>;
  protected rateLimiters: Map<string, RateLimiter>;
  
  constructor(config: ProviderConfig) {
    this.config = config;
    this.health = new Map();
    this.metrics = new Map();
    this.rateLimiters = new Map();
  }

  abstract initialize(): Promise<void>;
  abstract request<T>(method: string, params?: any[]): Promise<T>;
  abstract getBlockNumber(): Promise<number>;
  abstract getBalance(address: string): Promise<string>;
  abstract isHealthy(): boolean;
  abstract destroy(): Promise<void>;

  protected abstract selectHealthyEndpoint(): RpcEndpoint | null;
  protected abstract executeRequest<T>(
    endpoint: RpcEndpoint,
    context: RequestContext
  ): Promise<T>;
  protected abstract handleError(error: Error, context: RequestContext): ProviderError;
}

export interface RateLimiter {
  isAllowed(key: string): boolean;
  reset(key: string): void;
  getRemaining(key: string): number;
  getResetTime(key: string): Date;
}

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

export interface HealthChecker {
  check(endpoint: RpcEndpoint): Promise<ProviderHealth>;
  start(): void;
  stop(): void;
}