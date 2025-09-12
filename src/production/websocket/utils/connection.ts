/**
 * WebSocket Connection Management
 * Handles connection lifecycle, monitoring, and health checks
 */

import { WebSocketServerConfig } from '../server/websocket';
import pino from 'pino';

// ============================================================================
// CONNECTION INTERFACES
// ============================================================================

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  authenticatedConnections: number;
  connectionsByType: Record<string, number>;
  averageConnectionDuration: number;
  peakConnections: number;
  connectionsPerSecond: number;
  disconnectionsPerSecond: number;
}

export interface ConnectionMetrics {
  timestamp: Date;
  connections: {
    total: number;
    active: number;
    authenticated: number;
  };
  throughput: {
    messagesPerSecond: number;
    bytesPerSecond: number;
    errorsPerSecond: number;
  };
  latency: {
    averageMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  resources: {
    memoryUsageMB: number;
    cpuUsagePercent: number;
  };
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    responseTime?: number;
    message?: string;
  }[];
  overallScore: number; // 0-100
}

// ============================================================================
// CONNECTION MANAGER CLASS
// ============================================================================

export class ConnectionManager {
  private config: WebSocketServerConfig;
  private logger: pino.Logger;
  private stats: ConnectionStats;
  private metricsHistory: ConnectionMetrics[];
  private connectionEvents: Array<{ timestamp: Date; type: 'connect' | 'disconnect' }>;
  private latencyMeasurements: number[];
  private messageCount: number;
  private errorCount: number;
  private startTime: Date;
  private metricsInterval: NodeJS.Timeout | null;

  constructor(config: WebSocketServerConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger;
    this.startTime = new Date();
    this.metricsInterval = null;

    // Initialize stats
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      authenticatedConnections: 0,
      connectionsByType: {},
      averageConnectionDuration: 0,
      peakConnections: 0,
      connectionsPerSecond: 0,
      disconnectionsPerSecond: 0,
    };

    this.metricsHistory = [];
    this.connectionEvents = [];
    this.latencyMeasurements = [];
    this.messageCount = 0;
    this.errorCount = 0;

    this.startMetricsCollection();
  }

  // ============================================================================
  // PUBLIC METHODS - CONNECTION TRACKING
  // ============================================================================

  public recordConnection(connectionId: string, connectionType?: string): void {
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    if (connectionType) {
      this.stats.connectionsByType[connectionType] = 
        (this.stats.connectionsByType[connectionType] || 0) + 1;
    }

    // Update peak connections
    if (this.stats.activeConnections > this.stats.peakConnections) {
      this.stats.peakConnections = this.stats.activeConnections;
    }

    // Record connection event
    this.connectionEvents.push({
      timestamp: new Date(),
      type: 'connect',
    }, 'Logger message');

    // Clean up old events (keep only last hour)
    this.cleanupOldEvents();

    this.logger.debug({
      connectionId,
      connectionType,
      activeConnections: this.stats.activeConnections,
      totalConnections: this.stats.totalConnections,
    }, 'Connection recorded');
  }

  public recordDisconnection(connectionId: string, duration: number, connectionType?: string): void {
    this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);

    if (connectionType) {
      this.stats.connectionsByType[connectionType] = 
        Math.max(0, (this.stats.connectionsByType[connectionType] || 0) - 1);
    }

    // Update average connection duration
    this.updateAverageConnectionDuration(duration);

    // Record disconnection event
    this.connectionEvents.push({
      timestamp: new Date(),
      type: 'disconnect',
    }, 'Logger message');

    this.logger.debug({
      connectionId,
      connectionType,
      duration,
      activeConnections: this.stats.activeConnections,
    }, 'Disconnection recorded');
  }

  public recordAuthentication(connectionId: string, success: boolean): void {
    if (success) {
      this.stats.authenticatedConnections++;
    }

    this.logger.debug({
      connectionId,
      success,
      authenticatedConnections: this.stats.authenticatedConnections,
    }, 'Authentication recorded');
  }

  public recordMessage(latencyMs?: number): void {
    this.messageCount++;

    if (latencyMs !== undefined) {
      this.latencyMeasurements.push(latencyMs);
      
      // Keep only recent measurements (last 1000)
      if (this.latencyMeasurements.length > 1000) {
        this.latencyMeasurements = this.latencyMeasurements.slice(-1000);
      }
    }
  }

  public recordError(): void {
    this.errorCount++;
  }

  // ============================================================================
  // PUBLIC METHODS - METRICS
  // ============================================================================

  public getStats(): ConnectionStats {
    // Calculate connections per second
    const now = new Date();
    const oneSecondAgo = new Date(now.getTime() - 1000);
    const recentConnections = this.connectionEvents.filter(
      event => event.timestamp > oneSecondAgo && event.type === 'connect'
    ).length;
    const recentDisconnections = this.connectionEvents.filter(
      event => event.timestamp > oneSecondAgo && event.type === 'disconnect'
    ).length;

    return {
      ...this.stats,
      connectionsPerSecond: recentConnections,
      disconnectionsPerSecond: recentDisconnections,
    };
  }

  public getCurrentMetrics(): ConnectionMetrics {
    const now = new Date();
    const oneSecondAgo = new Date(now.getTime() - 1000);

    // Calculate throughput
    const recentMessages = this.messageCount; // Simplified - would track per second in real impl
    const recentErrors = this.errorCount; // Simplified - would track per second in real impl

    // Calculate latency percentiles
    const sortedLatencies = [...this.latencyMeasurements].sort((a, b) => a - b);
    const latencyStats = {
      averageMs: sortedLatencies.length > 0 ? 
        sortedLatencies.reduce((sum, val) => sum + val, 0) / sortedLatencies.length : 0,
      p50Ms: this.getPercentile(sortedLatencies, 50),
      p95Ms: this.getPercentile(sortedLatencies, 95),
      p99Ms: this.getPercentile(sortedLatencies, 99),
    };

    // Get resource usage
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: ConnectionMetrics = {
      timestamp: now,
      connections: {
        total: this.stats.totalConnections,
        active: this.stats.activeConnections,
        authenticated: this.stats.authenticatedConnections,
      },
      throughput: {
        messagesPerSecond: recentMessages,
        bytesPerSecond: 0, // Would need to track actual bytes
        errorsPerSecond: recentErrors,
      },
      latency: latencyStats,
      resources: {
        memoryUsageMB: memoryUsage.heapUsed / 1024 / 1024,
        cpuUsagePercent: (cpuUsage.user + cpuUsage.system) / 1000000 / 1000 * 100, // Simplified
      },
    };

    return metrics;
  }

  public getMetricsHistory(minutes: number = 60): ConnectionMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  // ============================================================================
  // PUBLIC METHODS - HEALTH CHECKS
  // ============================================================================

  public async performHealthCheck(): Promise<HealthCheck> {
    const checks = [];
    let overallScore = 100;

    // Check connection count
    const connectionCheck = this.checkConnectionHealth();
    checks.push(connectionCheck);
    if (connectionCheck.status !== 'pass') {
      overallScore -= connectionCheck.status === 'fail' ? 25 : 10;
    }

    // Check latency
    const latencyCheck = this.checkLatencyHealth();
    checks.push(latencyCheck);
    if (latencyCheck.status !== 'pass') {
      overallScore -= latencyCheck.status === 'fail' ? 20 : 10;
    }

    // Check error rate
    const errorRateCheck = this.checkErrorRateHealth();
    checks.push(errorRateCheck);
    if (errorRateCheck.status !== 'pass') {
      overallScore -= errorRateCheck.status === 'fail' ? 20 : 10;
    }

    // Check memory usage
    const memoryCheck = this.checkMemoryHealth();
    checks.push(memoryCheck);
    if (memoryCheck.status !== 'pass') {
      overallScore -= memoryCheck.status === 'fail' ? 15 : 5;
    }

    // Check uptime
    const uptimeCheck = this.checkUptimeHealth();
    checks.push(uptimeCheck);
    if (uptimeCheck.status !== 'pass') {
      overallScore -= uptimeCheck.status === 'fail' ? 10 : 5;
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (overallScore >= 80) {
      status = 'healthy';
    } else if (overallScore >= 60) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const healthCheck: HealthCheck = {
      status,
      timestamp: new Date(),
      checks,
      overallScore: Math.max(0, overallScore),
    };

    this.logger.info({
      status,
      overallScore,
      checkCount: checks.length,
      failedChecks: checks.filter(c => c.status === 'fail').length,
    }, 'Health check completed');

    return healthCheck;
  }

  // ============================================================================
  // PUBLIC METHODS - CLEANUP
  // ============================================================================

  public cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.logger.info('Connection manager cleaned up');
  }

  // ============================================================================
  // PRIVATE METHODS - CALCULATIONS
  // ============================================================================

  private updateAverageConnectionDuration(newDuration: number): void {
    // Simple moving average calculation
    const count = this.stats.totalConnections;
    this.stats.averageConnectionDuration = 
      ((this.stats.averageConnectionDuration * (count - 1)) + newDuration) / count;
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
  }

  // ============================================================================
  // PRIVATE METHODS - HEALTH CHECKS
  // ============================================================================

  private checkConnectionHealth(): { name: string; status: 'pass' | 'fail' | 'warn'; message?: string } {
    const maxConnections = this.config.rateLimit?.maxConnections || 1000;
    const connectionRatio = this.stats.activeConnections / maxConnections;

    if (connectionRatio > 0.9) {
      return {
        name: 'connection_capacity',
        status: 'fail',
        message: `Connection usage at ${(connectionRatio * 100).toFixed(1)}% of capacity`,
      };
    } else if (connectionRatio > 0.7) {
      return {
        name: 'connection_capacity',
        status: 'warn',
        message: `Connection usage at ${(connectionRatio * 100).toFixed(1)}% of capacity`,
      };
    }

    return {
      name: 'connection_capacity',
      status: 'pass',
      message: `${this.stats.activeConnections} active connections`,
    };
  }

  private checkLatencyHealth(): { name: string; status: 'pass' | 'fail' | 'warn'; responseTime?: number; message?: string } {
    if (this.latencyMeasurements.length === 0) {
      return {
        name: 'latency',
        status: 'pass',
        message: 'No latency measurements available',
      };
    }

    const sortedLatencies = [...this.latencyMeasurements].sort((a, b) => a - b);
    const p95Latency = this.getPercentile(sortedLatencies, 95);

    if (p95Latency > 1000) {
      return {
        name: 'latency',
        status: 'fail',
        responseTime: p95Latency,
        message: `P95 latency ${p95Latency.toFixed(1)}ms exceeds threshold`,
      };
    } else if (p95Latency > 500) {
      return {
        name: 'latency',
        status: 'warn',
        responseTime: p95Latency,
        message: `P95 latency ${p95Latency.toFixed(1)}ms is elevated`,
      };
    }

    return {
      name: 'latency',
      status: 'pass',
      responseTime: p95Latency,
      message: `P95 latency ${p95Latency.toFixed(1)}ms is healthy`,
    };
  }

  private checkErrorRateHealth(): { name: string; status: 'pass' | 'fail' | 'warn'; message?: string } {
    const totalMessages = Math.max(1, this.messageCount); // Avoid division by zero
    const errorRate = this.errorCount / totalMessages;

    if (errorRate > 0.05) {
      return {
        name: 'error_rate',
        status: 'fail',
        message: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds 5% threshold`,
      };
    } else if (errorRate > 0.02) {
      return {
        name: 'error_rate',
        status: 'warn',
        message: `Error rate ${(errorRate * 100).toFixed(2)}% is elevated`,
      };
    }

    return {
      name: 'error_rate',
      status: 'pass',
      message: `Error rate ${(errorRate * 100).toFixed(2)}% is healthy`,
    };
  }

  private checkMemoryHealth(): { name: string; status: 'pass' | 'fail' | 'warn'; message?: string } {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const memoryRatio = heapUsedMB / heapTotalMB;

    if (memoryRatio > 0.9) {
      return {
        name: 'memory_usage',
        status: 'fail',
        message: `Memory usage ${heapUsedMB.toFixed(1)}MB (${(memoryRatio * 100).toFixed(1)}%) is critical`,
      };
    } else if (memoryRatio > 0.7) {
      return {
        name: 'memory_usage',
        status: 'warn',
        message: `Memory usage ${heapUsedMB.toFixed(1)}MB (${(memoryRatio * 100).toFixed(1)}%) is elevated`,
      };
    }

    return {
      name: 'memory_usage',
      status: 'pass',
      message: `Memory usage ${heapUsedMB.toFixed(1)}MB (${(memoryRatio * 100).toFixed(1)}%) is healthy`,
    };
  }

  private checkUptimeHealth(): { name: string; status: 'pass' | 'fail' | 'warn'; message?: string } {
    const uptimeMs = Date.now() - this.startTime.getTime();
    const uptimeMinutes = uptimeMs / 1000 / 60;

    // Check if uptime is suspiciously low (might indicate recent crashes)
    if (uptimeMinutes < 5) {
      return {
        name: 'uptime',
        status: 'warn',
        message: `Low uptime: ${uptimeMinutes.toFixed(1)} minutes`,
      };
    }

    return {
      name: 'uptime',
      status: 'pass',
      message: `Uptime: ${this.formatUptime(uptimeMs)}`,
    };
  }

  // ============================================================================
  // PRIVATE METHODS - UTILITIES
  // ============================================================================

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getCurrentMetrics();
      this.metricsHistory.push(metrics);

      // Keep only last 24 hours of metrics (assuming 1 minute intervals)
      if (this.metricsHistory.length > 1440) {
        this.metricsHistory = this.metricsHistory.slice(-1440);
      }

      this.logger.debug({
        activeConnections: metrics.connections.active,
        messagesPerSecond: metrics.throughput.messagesPerSecond,
        avgLatencyMs: metrics.latency.averageMs,
        memoryUsageMB: metrics.resources.memoryUsageMB,
      }, 'Metrics collected');
    }, 60000); // Collect metrics every minute
  }

  private cleanupOldEvents(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.connectionEvents = this.connectionEvents.filter(
      event => event.timestamp > oneHourAgo
    );
  }

  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}