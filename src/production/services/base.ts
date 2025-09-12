/**
 * Base Services Foundation
 * Provides core service infrastructure for production features
 */

import { ChainType, ProtocolType } from '../../types';
import { getEnvironmentConfig, isProductionMode, isDemoMode } from '../config/environment';
import { getChainConfig } from '../config/chains';
import { getProtocolConfig } from '../config/protocols';
import { getModeConfig } from '../utils/mode-detection';

// ============================================================================
// BASE SERVICE INTERFACES
// ============================================================================

export interface ServiceConfig {
  name: string;
  version: string;
  timeout: number;
  retries: number;
  rateLimitEnabled: boolean;
  cacheEnabled: boolean;
  loggingEnabled: boolean;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  timestamp: Date;
  executionTime: number;
  requestId: string;
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  lastRequestTime?: Date;
  lastErrorTime?: Date;
  errorRate: number;
}

export interface RateLimitState {
  requests: number;
  windowStart: number;
  nextReset: number;
  isLimited: boolean;
}

// ============================================================================
// BASE SERVICE CLASS
// ============================================================================

export abstract class BaseService {
  protected readonly config: ServiceConfig;
  protected readonly metrics: ServiceMetrics;
  protected readonly rateLimitState: RateLimitState;
  protected readonly cache: Map<string, { data: any; timestamp: number; ttl: number }>;

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = {
      name: this.constructor.name,
      version: '1.0.0',
      timeout: 30000,
      retries: 3,
      rateLimitEnabled: isProductionMode(),
      cacheEnabled: true,
      loggingEnabled: true,
      ...config,
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
    };

    this.rateLimitState = {
      requests: 0,
      windowStart: Date.now(),
      nextReset: Date.now() + 60000, // 1 minute window
      isLimited: false,
    };

    this.cache = new Map();
  }

  /**
   * Execute a service request with built-in error handling, retries, and metrics
   */
  protected async executeRequest<T>(
    operation: string,
    fn: () => Promise<T>,
    options: {
      cacheKey?: string;
      cacheTtl?: number;
      skipRateLimit?: boolean;
      skipCache?: boolean;
    } = {}
  ): Promise<ServiceResponse<T>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      // Update metrics
      this.metrics.totalRequests++;
      
      // Rate limiting
      if (!options.skipRateLimit && this.config.rateLimitEnabled) {
        await this.checkRateLimit();
      }

      // Cache check
      if (!options.skipCache && this.config.cacheEnabled && options.cacheKey) {
        const cached = this.getCachedResult(options.cacheKey);
        if (cached) {
          this.updateMetrics(true, Date.now() - startTime, true);
          return {
            success: true,
            data: cached,
            cached: true,
            timestamp: new Date(),
            executionTime: Date.now() - startTime,
            requestId,
          };
        }
      }

      // Execute request with retries
      const result = await this.executeWithRetries(fn, requestId);

      // Cache result
      if (this.config.cacheEnabled && options.cacheKey && options.cacheTtl) {
        this.setCachedResult(options.cacheKey, result, options.cacheTtl);
      }

      // Update metrics
      this.updateMetrics(true, Date.now() - startTime, false);

      return {
        success: true,
        data: result,
        cached: false,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        requestId,
      };
    } catch (error) {
      // Update metrics
      this.updateMetrics(false, Date.now() - startTime, false);
      
      // Log error
      if (this.config.loggingEnabled) {
        this.logError(operation, error, requestId);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        requestId,
      };
    }
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetries<T>(
    fn: () => Promise<T>,
    requestId: string,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await this.withTimeout(fn());
    } catch (error) {
      if (attempt >= this.config.retries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await this.sleep(delay);

      if (this.config.loggingEnabled) {
        console.warn(`${this.config.name}: Retry ${attempt}/${this.config.retries} for ${requestId} after ${delay}ms delay`);
      }

      return this.executeWithRetries(fn, requestId, attempt + 1);
    }
  }

  /**
   * Add timeout to promise
   */
  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), this.config.timeout)
    );

    return Promise.race([promise, timeout]);
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const config = getEnvironmentConfig();
    
    // Reset window if needed
    if (now >= this.rateLimitState.nextReset) {
      this.rateLimitState.requests = 0;
      this.rateLimitState.windowStart = now;
      this.rateLimitState.nextReset = now + 60000; // 1 minute window
      this.rateLimitState.isLimited = false;
    }

    // Check limits
    if (this.rateLimitState.requests >= config.rateLimit.requestsPerMinute) {
      this.rateLimitState.isLimited = true;
      const waitTime = this.rateLimitState.nextReset - now;
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds`);
    }

    this.rateLimitState.requests++;
  }

  /**
   * Cache operations
   */
  private getCachedResult(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.timestamp + cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCachedResult(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    }, 'Logger message');
  }

  /**
   * Metrics updates
   */
  private updateMetrics(success: boolean, responseTime: number, cached: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
      this.metrics.lastRequestTime = new Date();
    } else {
      this.metrics.failedRequests++;
      this.metrics.lastErrorTime = new Date();
    }

    // Update average response time
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    // Update cache hit rate
    if (cached) {
      const cacheHits = this.metrics.successfulRequests * this.metrics.cacheHitRate + 1;
      this.metrics.cacheHitRate = cacheHits / this.metrics.successfulRequests;
    } else {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.successfulRequests - 1)) / this.metrics.successfulRequests;
    }

    // Update error rate
    this.metrics.errorRate = this.metrics.failedRequests / totalRequests;
  }

  /**
   * Logging
   */
  private logError(operation: string, error: any, requestId: string): void {
    console.error(`${this.config.name}:${operation} [${requestId}]:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      service: this.config.name,
      version: this.config.version,
    }, 'Logger message');
  }

  /**
   * Utilities
   */
  private generateRequestId(): string {
    return `${this.config.name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public methods for service management
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getConfig(): ServiceConfig {
    return { ...this.config };
  }

  public getRateLimitState(): RateLimitState {
    return { ...this.rateLimitState };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const now = Date.now();
    const recentRequests = this.metrics.totalRequests > 0;
    const recentErrors = this.metrics.lastErrorTime && 
      (now - this.metrics.lastErrorTime.getTime()) < 300000; // 5 minutes

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (this.metrics.errorRate > 0.5) {
      status = 'unhealthy';
    } else if (this.metrics.errorRate > 0.1 || recentErrors) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        serviceName: this.config.name,
        version: this.config.version,
        uptime: now - (this.rateLimitState.windowStart || now),
        metrics: this.metrics,
        rateLimitState: this.rateLimitState,
        cacheSize: this.cache.size,
        lastHealthCheck: new Date().toISOString(),
      },
    };
  }
}

// ============================================================================
// BLOCKCHAIN SERVICE BASE
// ============================================================================

export abstract class BaseBlockchainService extends BaseService {
  protected readonly chain: ChainType;
  protected readonly chainConfig: any;

  constructor(chain: ChainType, config: Partial<ServiceConfig> = {}) {
    super({
      name: `${chain}Service`,
      ...config,
    }, 'Logger message');
    
    this.chain = chain;
    this.chainConfig = getChainConfig(chain);
  }

  /**
   * Get RPC endpoint with fallback
   */
  protected getRpcEndpoint(usePrimary: boolean = true): string {
    return usePrimary 
      ? this.chainConfig.rpcEndpoints.primary
      : this.chainConfig.rpcEndpoints.backup;
  }

  /**
   * Execute RPC request with automatic fallback
   */
  protected async executeRpcRequest<T>(
    request: any,
    options: { skipFallback?: boolean } = {}
  ): Promise<T> {
    try {
      return await this.makeRpcCall(request, this.getRpcEndpoint(true));
    } catch (error) {
      if (options.skipFallback) {
        throw error;
      }

      // Try backup endpoint
      if (this.config.loggingEnabled) {
        console.warn(`${this.config.name}: Primary RPC failed, trying backup endpoint`);
      }
      
      return await this.makeRpcCall(request, this.getRpcEndpoint(false));
    }
  }

  /**
   * Abstract method for making RPC calls (implemented by chain-specific services)
   */
  protected abstract makeRpcCall<T>(request: any, endpoint: string): Promise<T>;

  /**
   * Validate address for this chain
   */
  protected isValidAddress(address: string): boolean {
    if (this.chain === 'solana') {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    } else {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
  }
}

// ============================================================================
// PROTOCOL SERVICE BASE
// ============================================================================

export abstract class BaseProtocolService extends BaseService {
  protected readonly protocol: ProtocolType;
  protected readonly protocolConfig: any;

  constructor(protocol: ProtocolType, config: Partial<ServiceConfig> = {}) {
    super({
      name: `${protocol}Service`,
      ...config,
    }, 'Logger message');
    
    this.protocol = protocol;
    this.protocolConfig = getProtocolConfig(protocol);
  }

  /**
   * Get API endpoint
   */
  protected getApiEndpoint(): string {
    return this.protocolConfig.endpoints.api || this.protocolConfig.endpoints.subgraph;
  }

  /**
   * Execute API request with protocol-specific rate limiting
   */
  protected async executeApiRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const endpoint = this.getApiEndpoint();
    const url = `${endpoint}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LP-Tracker/1.0',
        ...options.headers,
      },
    }, 'Logger message');

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if protocol supports feature
   */
  protected supportsFeature(feature: string): boolean {
    return this.protocolConfig.supportedFeatures.includes(feature);
  }
}

// ============================================================================
// SERVICE REGISTRY
// ============================================================================

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, BaseService> = new Map();

  private constructor() {}

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  public register<T extends BaseService>(name: string, service: T): void {
    this.services.set(name, service);
  }

  public get<T extends BaseService>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  public getAll(): BaseService[] {
    return Array.from(this.services.values());
  }

  public async healthCheck(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    for (const [name, service] of this.services) {
      try {
        results[name] = await service.healthCheck();
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return results;
  }

  public getMetrics(): Record<string, ServiceMetrics> {
    const metrics: Record<string, ServiceMetrics> = {};
    
    for (const [name, service] of this.services) {
      metrics[name] = service.getMetrics();
    }

    return metrics;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create service configuration based on current mode
 */
export function createServiceConfig(overrides: Partial<ServiceConfig> = {}): ServiceConfig {
  const modeConfig = getModeConfig();
  const baseConfig: ServiceConfig = {
    name: 'BaseService',
    version: '1.0.0',
    timeout: modeConfig.mode === 'demo' ? 10000 : 30000,
    retries: modeConfig.mode === 'demo' ? 1 : 3,
    rateLimitEnabled: modeConfig.rateLimits.enabled,
    cacheEnabled: true,
    loggingEnabled: modeConfig.monitoring.enabled,
  };

  return { ...baseConfig, ...overrides };
}

/**
 * Initialize service registry with default services
 */
export function initializeServiceRegistry(): ServiceRegistry {
  const registry = ServiceRegistry.getInstance();
  
  // Register core services here as they're implemented
  // registry.register('ethereum', new EthereumService());
  // registry.register('solana', new SolanaService());
  
  return registry;
}

export default {
  BaseService,
  BaseBlockchainService,
  BaseProtocolService,
  ServiceRegistry,
  createServiceConfig,
  initializeServiceRegistry,
};