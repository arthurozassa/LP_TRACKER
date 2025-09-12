/**
 * Base provider implementation with common functionality
 */

import {
  BaseProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderStatus,
  RpcMetrics,
  RpcEndpoint,
  RequestContext,
  ProviderError,
  RateLimiter,
  Logger,
  HealthChecker,
  RetryConfig
} from './types';

export class TokenBucketRateLimiter implements RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();
  
  constructor(
    private capacity: number,
    private refillRate: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed * this.refillRate / this.windowMs);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }
    
    return false;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  getRemaining(key: string): number {
    const bucket = this.buckets.get(key);
    return bucket ? bucket.tokens : this.capacity;
  }

  getResetTime(key: string): Date {
    const bucket = this.buckets.get(key);
    if (!bucket) return new Date();
    
    const msUntilFullRefill = (this.capacity - bucket.tokens) * this.windowMs / this.refillRate;
    return new Date(Date.now() + msUntilFullRefill);
  }
}

export class ConsoleLogger implements Logger {
  constructor(private level: 'debug' | 'info' | 'warn' | 'error' = 'info') {}

  debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, meta || '');
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, meta || '');
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, meta || '');
    }
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, meta || '');
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

export class DefaultHealthChecker implements HealthChecker {
  private intervals = new Map<string, NodeJS.Timeout>();
  
  constructor(
    private provider: BaseProvider,
    private logger: Logger
  ) {}

  async check(endpoint: RpcEndpoint): Promise<ProviderHealth> {
    const startTime = Date.now();
    let status = ProviderStatus.HEALTHY;
    let error: Error | undefined;

    try {
      // Simple health check - try to get block number
      await this.makeHealthCheckRequest(endpoint);
    } catch (err) {
      status = ProviderStatus.DOWN;
      error = err as Error;
      this.logger.warn(`Health check failed for ${endpoint.id}`, { error: err });
    }

    const latency = Date.now() - startTime;
    
    return {
      status,
      latency,
      lastChecked: new Date(),
      errorRate: 0, // Would be calculated based on historical data
      consecutiveErrors: status === ProviderStatus.DOWN ? 1 : 0,
      lastError: error
    };
  }

  start(): void {
    // Implementation would start periodic health checks
    this.logger.info('Health checker started');
  }

  stop(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.logger.info('Health checker stopped');
  }

  private async makeHealthCheckRequest(endpoint: RpcEndpoint): Promise<any> {
    // This would be implemented by specific provider types
    throw new Error('Health check not implemented for base provider');
  }
}

export abstract class AbstractBaseProvider extends BaseProvider {
  protected logger: Logger;
  protected healthChecker?: HealthChecker;
  private connectionPool = new Map<string, any>();
  private destroyed = false;

  constructor(config: ProviderConfig) {
    super(config);
    this.logger = new ConsoleLogger(config.logging.level);
    this.initializeRateLimiters();
    this.initializeMetrics();
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing ${this.config.chainType} provider`);
    
    if (this.config.healthCheck.enabled) {
      this.healthChecker = new DefaultHealthChecker(this, this.logger);
      this.healthChecker.start();
    }

    // Initialize health status for all endpoints
    for (const endpoint of this.config.endpoints) {
      this.health.set(endpoint.id, {
        status: ProviderStatus.UNKNOWN,
        latency: 0,
        lastChecked: new Date(),
        errorRate: 0,
        consecutiveErrors: 0
      }, 'Logger message');
    }

    this.logger.info(`Provider initialized with ${this.config.endpoints.length} endpoints`);
  }

  async request<T>(method: string, params?: any[]): Promise<T> {
    if (this.destroyed) {
      throw new Error('Provider has been destroyed');
    }

    const context: RequestContext = {
      method,
      params,
      attempt: 0,
      startTime: Date.now(),
      timeout: this.config.endpoints[0]?.timeout || 30000
    };

    return this.executeWithRetry<T>(context);
  }

  isHealthy(): boolean {
    const healthyEndpoints = Array.from(this.health.values())
      .filter(h => h.status === ProviderStatus.HEALTHY);
    
    return healthyEndpoints.length > 0;
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    
    if (this.healthChecker) {
      this.healthChecker.stop();
    }

    // Close all connections
    this.connectionPool.clear();
    
    this.logger.info('Provider destroyed');
  }

  protected selectHealthyEndpoint(): RpcEndpoint | null {
    // Sort endpoints by priority and health
    const sortedEndpoints = this.config.endpoints
      .map(endpoint => ({
        endpoint,
        health: this.health.get(endpoint.id)
      }))
      .filter(({ health }) => 
        health?.status === ProviderStatus.HEALTHY || 
        health?.status === ProviderStatus.UNKNOWN
      )
      .sort((a, b) => {
        // Primary sort: priority (lower = higher priority)
        if (a.endpoint.priority !== b.endpoint.priority) {
          return a.endpoint.priority - b.endpoint.priority;
        }
        
        // Secondary sort: latency (lower = better)
        return (a.health?.latency || Infinity) - (b.health?.latency || Infinity);
      }, 'Logger message');

    return sortedEndpoints[0]?.endpoint || null;
  }

  private async executeWithRetry<T>(context: RequestContext): Promise<T> {
    const retryConfig = this.getRetryConfig();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      const endpoint = this.selectHealthyEndpoint();
      if (!endpoint) {
        throw new Error('No healthy endpoints available');
      }

      // Check rate limit
      const rateLimiter = this.rateLimiters.get(endpoint.id);
      if (rateLimiter && !rateLimiter.isAllowed(endpoint.id)) {
        this.logger.warn(`Rate limit exceeded for ${endpoint.id}`);
        await this.delay(1000); // Wait before trying next endpoint
        continue;
      }

      context.endpoint = endpoint.id;
      context.attempt = attempt;

      try {
        const result = await this.executeRequest<T>(endpoint, context);
        this.updateMetrics(endpoint.id, true, Date.now() - context.startTime);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.updateMetrics(endpoint.id, false, Date.now() - context.startTime);
        this.updateHealth(endpoint.id, false);

        const providerError = this.handleError(lastError, context);
        
        if (!providerError.retryable || attempt === retryConfig.maxRetries) {
          throw providerError;
        }

        const delay = this.calculateDelay(attempt, retryConfig);
        this.logger.warn(`Request failed, retrying in ${delay}ms`, {
          endpoint: endpoint.id,
          attempt,
          error: providerError.message
        }, 'Logger message');
        
        await this.delay(delay);
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  private initializeRateLimiters(): void {
    if (!this.config.rateLimiting.enabled) return;

    for (const endpoint of this.config.endpoints) {
      const rateLimiter = new TokenBucketRateLimiter(
        endpoint.maxRequestsPerSecond,
        endpoint.maxRequestsPerSecond,
        1000
      );
      this.rateLimiters.set(endpoint.id, rateLimiter);
    }
  }

  private initializeMetrics(): void {
    for (const endpoint of this.config.endpoints) {
      this.metrics.set(endpoint.id, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        requestsPerSecond: 0,
        lastRequestTime: new Date()
      }, 'Logger message');
    }
  }

  private updateMetrics(endpointId: string, success: boolean, latency: number): void {
    const metrics = this.metrics.get(endpointId);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.lastRequestTime = new Date();
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update average latency using moving average
    metrics.averageLatency = (metrics.averageLatency * (metrics.totalRequests - 1) + latency) / metrics.totalRequests;
  }

  private updateHealth(endpointId: string, success: boolean): void {
    const health = this.health.get(endpointId);
    if (!health) return;

    if (success) {
      health.consecutiveErrors = 0;
      health.status = ProviderStatus.HEALTHY;
    } else {
      health.consecutiveErrors++;
      if (health.consecutiveErrors >= this.config.healthCheck.failureThreshold) {
        health.status = ProviderStatus.DOWN;
      } else {
        health.status = ProviderStatus.DEGRADED;
      }
    }
    
    health.lastChecked = new Date();
  }

  private getRetryConfig(): RetryConfig {
    return this.config.endpoints[0]?.retryConfig || {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      jitter: true
    };
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffFactor, attempt),
      config.maxDelay
    );

    if (config.jitter) {
      return delay * (0.5 + Math.random() * 0.5);
    }

    return delay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Abstract methods to be implemented by specific providers
  protected abstract executeRequest<T>(
    endpoint: RpcEndpoint,
    context: RequestContext
  ): Promise<T>;

  protected abstract handleError(error: Error, context: RequestContext): ProviderError;

  // These methods should be implemented by specific chain providers
  abstract getBlockNumber(): Promise<number>;
  abstract getBalance(address: string): Promise<string>;
}