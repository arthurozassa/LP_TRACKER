/**
 * WebSocket Reconnection Logic
 * Handles automatic reconnection with exponential backoff
 */

import pino from 'pino';

// ============================================================================
// RECONNECTION INTERFACES
// ============================================================================

export interface ReconnectionConfig {
  enabled: boolean;
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  jitterMaxMs: number;
}

export interface ReconnectionState {
  isReconnecting: boolean;
  attempts: number;
  nextAttemptAt?: Date;
  lastConnectedAt?: Date;
  totalDowntime: number;
  strategy: ReconnectionStrategy;
}

export interface ReconnectionAttempt {
  attempt: number;
  timestamp: Date;
  delay: number;
  reason: string;
  success: boolean;
  error?: string;
  duration?: number;
}

export interface ReconnectionStats {
  totalAttempts: number;
  successfulReconnects: number;
  failedAttempts: number;
  averageReconnectTime: number;
  longestDowntime: number;
  currentDowntime: number;
  isConnected: boolean;
}

export type ReconnectionStrategy = 'exponential' | 'linear' | 'immediate' | 'fixed';

// ============================================================================
// RECONNECTION MANAGER CLASS
// ============================================================================

export class ReconnectionManager {
  private config: ReconnectionConfig;
  private logger: pino.Logger;
  private state: ReconnectionState;
  private attempts: ReconnectionAttempt[];
  private reconnectTimeout: NodeJS.Timeout | null;
  private onReconnect?: () => Promise<boolean>;
  private onConnectionLost?: (reason: string) => void;
  private onReconnectFailed?: (attempt: ReconnectionAttempt) => void;
  private onReconnectSuccess?: (attempt: ReconnectionAttempt) => void;

  constructor(config?: Partial<ReconnectionConfig>, logger?: pino.Logger) {
    this.config = {
      enabled: true,
      maxAttempts: 10,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      jitterMaxMs: 1000,
      ...config,
    };

    this.logger = logger || pino({ name: 'reconnection-manager' });
    
    this.state = {
      isReconnecting: false,
      attempts: 0,
      totalDowntime: 0,
      strategy: 'exponential',
    };

    this.attempts = [];
    this.reconnectTimeout = null;
  }

  // ============================================================================
  // PUBLIC METHODS - EVENT HANDLERS
  // ============================================================================

  public onReconnectCallback(callback: () => Promise<boolean>): void {
    this.onReconnect = callback;
  }

  public onConnectionLostCallback(callback: (reason: string) => void): void {
    this.onConnectionLost = callback;
  }

  public onReconnectFailedCallback(callback: (attempt: ReconnectionAttempt) => void): void {
    this.onReconnectFailed = callback;
  }

  public onReconnectSuccessCallback(callback: (attempt: ReconnectionAttempt) => void): void {
    this.onReconnectSuccess = callback;
  }

  // ============================================================================
  // PUBLIC METHODS - CONNECTION MANAGEMENT
  // ============================================================================

  public handleConnectionLost(reason: string = 'unknown'): void {
    if (this.state.isReconnecting) {
      this.logger.warn({ reason }, 'Connection lost while already reconnecting');
      return;
    }

    this.state.isReconnecting = true;
    this.state.attempts = 0;
    this.state.lastConnectedAt = new Date();

    this.logger.warn({ reason }, 'Connection lost, starting reconnection process');

    // Notify about connection loss
    if (this.onConnectionLost) {
      this.onConnectionLost(reason);
    }

    // Start reconnection attempts if enabled
    if (this.config.enabled) {
      this.scheduleReconnectAttempt(reason);
    } else {
      this.logger.info('Reconnection disabled, not attempting to reconnect');
    }
  }

  public handleConnectionRestored(): void {
    if (!this.state.isReconnecting) {
      return;
    }

    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Calculate downtime
    const downtime = this.state.lastConnectedAt ? 
      Date.now() - this.state.lastConnectedAt.getTime() : 0;
    
    this.state.totalDowntime += downtime;
    this.state.isReconnecting = false;
    this.state.attempts = 0;
    this.state.nextAttemptAt = undefined;

    this.logger.info({
      downtime,
      totalDowntime: this.state.totalDowntime,
      attempts: this.attempts.length,
    }, 'Connection restored');
  }

  public forceReconnect(reason: string = 'manual'): void {
    this.logger.info({ reason }, 'Forcing reconnection');
    this.handleConnectionLost(reason);
  }

  public stopReconnection(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.state.isReconnecting = false;
    this.state.attempts = 0;
    this.state.nextAttemptAt = undefined;

    this.logger.info('Reconnection stopped');
  }

  // ============================================================================
  // PUBLIC METHODS - CONFIGURATION
  // ============================================================================

  public updateConfig(config: Partial<ReconnectionConfig>): void {
    this.config = { ...this.config, ...config };
    
    this.logger.info({
      maxAttempts: this.config.maxAttempts,
      initialDelay: this.config.initialDelay,
      maxDelay: this.config.maxDelay,
      enabled: this.config.enabled,
    }, 'Reconnection config updated');
  }

  public setStrategy(strategy: ReconnectionStrategy): void {
    this.state.strategy = strategy;
    this.logger.info({ strategy }, 'Reconnection strategy changed');
  }

  // ============================================================================
  // PUBLIC METHODS - STATUS
  // ============================================================================

  public getState(): ReconnectionState {
    return { ...this.state };
  }

  public getStats(): ReconnectionStats {
    const successfulReconnects = this.attempts.filter(a => a.success).length;
    const failedAttempts = this.attempts.filter(a => !a.success).length;
    const reconnectTimes = this.attempts
      .filter(a => a.success && a.duration)
      .map(a => a.duration!);
    
    const averageReconnectTime = reconnectTimes.length > 0 ?
      reconnectTimes.reduce((sum, time) => sum + time, 0) / reconnectTimes.length : 0;

    return {
      totalAttempts: this.attempts.length,
      successfulReconnects,
      failedAttempts,
      averageReconnectTime,
      longestDowntime: 0, // Would need to track this over time
      currentDowntime: this.getCurrentDowntime(),
      isConnected: !this.state.isReconnecting,
    };
  }

  public getRecentAttempts(count: number = 10): ReconnectionAttempt[] {
    return this.attempts.slice(-count);
  }

  public isReconnecting(): boolean {
    return this.state.isReconnecting;
  }

  // ============================================================================
  // PUBLIC METHODS - CLEANUP
  // ============================================================================

  public cleanup(): void {
    this.stopReconnection();
    this.attempts = [];
    this.state = {
      isReconnecting: false,
      attempts: 0,
      totalDowntime: 0,
      strategy: 'exponential',
    };

    this.logger.info('Reconnection manager cleaned up');
  }

  // ============================================================================
  // PRIVATE METHODS - RECONNECTION LOGIC
  // ============================================================================

  private scheduleReconnectAttempt(reason: string): void {
    if (this.state.attempts >= this.config.maxAttempts) {
      this.logger.error({
        maxAttempts: this.config.maxAttempts,
        reason,
      }, 'Maximum reconnection attempts reached, giving up');
      
      this.state.isReconnecting = false;
      return;
    }

    this.state.attempts++;
    
    const delay = this.calculateDelay();
    const nextAttemptAt = new Date(Date.now() + delay);
    this.state.nextAttemptAt = nextAttemptAt;

    this.logger.info({
      attempt: this.state.attempts,
      maxAttempts: this.config.maxAttempts,
      delay,
      nextAttemptAt,
      strategy: this.state.strategy,
    }, 'Scheduling reconnection attempt');

    this.reconnectTimeout = setTimeout(() => {
      this.performReconnectAttempt(reason);
    }, delay);
  }

  private async performReconnectAttempt(reason: string): Promise<void> {
    const startTime = Date.now();
    const attempt: ReconnectionAttempt = {
      attempt: this.state.attempts,
      timestamp: new Date(),
      delay: this.state.nextAttemptAt ? 
        this.state.nextAttemptAt.getTime() - startTime : 0,
      reason,
      success: false,
    };

    this.logger.info({
      attempt: attempt.attempt,
      maxAttempts: this.config.maxAttempts,
    }, 'Attempting to reconnect');

    try {
      if (this.onReconnect) {
        const success = await this.onReconnect();
        attempt.success = success;
        attempt.duration = Date.now() - startTime;

        if (success) {
          this.logger.info({
            attempt: attempt.attempt,
            duration: attempt.duration,
          }, 'Reconnection successful');

          if (this.onReconnectSuccess) {
            this.onReconnectSuccess(attempt);
          }

          this.handleConnectionRestored();
        } else {
          throw new Error('Reconnection callback returned false');
        }
      } else {
        throw new Error('No reconnection callback provided');
      }
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : 'Unknown error';
      attempt.duration = Date.now() - startTime;

      this.logger.warn({
        attempt: attempt.attempt,
        error: attempt.error,
        duration: attempt.duration,
      }, 'Reconnection attempt failed');

      if (this.onReconnectFailed) {
        this.onReconnectFailed(attempt);
      }

      // Schedule next attempt
      this.scheduleReconnectAttempt(reason);
    } finally {
      this.attempts.push(attempt);
      
      // Keep only recent attempts to avoid memory leaks
      if (this.attempts.length > 100) {
        this.attempts = this.attempts.slice(-100);
      }
    }
  }

  private calculateDelay(): number {
    let delay: number;

    switch (this.state.strategy) {
      case 'immediate':
        delay = 0;
        break;

      case 'fixed':
        delay = this.config.initialDelay;
        break;

      case 'linear':
        delay = this.config.initialDelay * this.state.attempts;
        break;

      case 'exponential':
      default:
        delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, this.state.attempts - 1);
        break;
    }

    // Cap the delay at maxDelay
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter if enabled
    if (this.config.jitterEnabled) {
      const jitter = Math.random() * this.config.jitterMaxMs;
      delay += jitter;
    }

    return Math.floor(delay);
  }

  private getCurrentDowntime(): number {
    if (!this.state.isReconnecting || !this.state.lastConnectedAt) {
      return 0;
    }

    return Date.now() - this.state.lastConnectedAt.getTime();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createDefaultReconnectionConfig(): ReconnectionConfig {
  return {
    enabled: true,
    maxAttempts: 10,
    initialDelay: 1000, // 1 second
    maxDelay: 30000,    // 30 seconds
    backoffMultiplier: 2,
    jitterEnabled: true,
    jitterMaxMs: 1000,
  };
}

export function createAggressiveReconnectionConfig(): ReconnectionConfig {
  return {
    enabled: true,
    maxAttempts: 20,
    initialDelay: 100,  // 100ms
    maxDelay: 5000,     // 5 seconds
    backoffMultiplier: 1.5,
    jitterEnabled: true,
    jitterMaxMs: 500,
  };
}

export function createConservativeReconnectionConfig(): ReconnectionConfig {
  return {
    enabled: true,
    maxAttempts: 5,
    initialDelay: 5000,  // 5 seconds
    maxDelay: 60000,     // 1 minute
    backoffMultiplier: 3,
    jitterEnabled: true,
    jitterMaxMs: 2000,
  };
}

export function getRecommendedConfigForEnvironment(environment: 'development' | 'staging' | 'production'): ReconnectionConfig {
  switch (environment) {
    case 'development':
      return createAggressiveReconnectionConfig();
    
    case 'staging':
      return createDefaultReconnectionConfig();
    
    case 'production':
      return createConservativeReconnectionConfig();
    
    default:
      return createDefaultReconnectionConfig();
  }
}