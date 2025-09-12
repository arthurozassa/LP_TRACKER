/**
 * WebSocket Server Implementation
 * Main WebSocket server setup with Socket.IO integration
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketMessage, MessageType } from '../types/messages';
import { WebSocketEvent, EventEmitter, createSystemEvent } from '../types/events';
import { RoomManager } from './rooms';
import { MessageHandler } from './handlers';
import { WebSocketAuth } from './auth';
import { ConnectionManager } from '../utils/connection';
import { isProductionMode } from '../../types/production';
import pino from 'pino';

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

export interface WebSocketServerConfig {
  port?: number;
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit?: {
    maxConnections: number;
    windowMs: number;
    maxRequestsPerWindow: number;
  };
  heartbeat?: {
    interval: number;
    timeout: number;
  };
  auth?: {
    required: boolean;
    tokenSecret: string;
    apiKeyValidation: boolean;
  };
  monitoring?: {
    enabled: boolean;
    metricsInterval: number;
  };
  clustering?: {
    enabled: boolean;
    redisUrl?: string;
  };
}

// ============================================================================
// CONNECTION STATE INTERFACE
// ============================================================================

export interface ClientConnection {
  id: string;
  socket: Socket;
  userId?: string;
  walletAddress?: string;
  authenticated: boolean;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  rateLimitCount: number;
  rateLimitResetTime: Date;
  metadata: Record<string, any>;
}

// ============================================================================
// WEBSOCKET SERVER CLASS
// ============================================================================

export class WebSocketServer implements EventEmitter {
  private io: SocketIOServer;
  private httpServer: HTTPServer;
  private config: WebSocketServerConfig;
  private connections: Map<string, ClientConnection>;
  private roomManager: RoomManager;
  private messageHandler: MessageHandler;
  private auth: WebSocketAuth;
  private connectionManager: ConnectionManager;
  private logger: pino.Logger;
  private eventListeners: Map<string, Set<any>>;
  private heartbeatInterval: NodeJS.Timeout | null;
  private metricsInterval: NodeJS.Timeout | null;
  private isRunning: boolean;

  constructor(httpServer: HTTPServer, config: WebSocketServerConfig) {
    this.httpServer = httpServer;
    this.config = this.validateConfig(config);
    this.connections = new Map();
    this.eventListeners = new Map();
    this.heartbeatInterval = null;
    this.metricsInterval = null;
    this.isRunning = false;
    
    // Initialize logger
    this.logger = pino({
      name: 'websocket-server',
      level: isProductionMode() ? 'info' : 'debug',
    }, 'Logger message');

    // Initialize Socket.IO server
    this.io = new SocketIOServer(httpServer, {
      cors: this.config.cors,
      pingTimeout: this.config.heartbeat?.timeout || 60000,
      pingInterval: this.config.heartbeat?.interval || 25000,
      maxHttpBufferSize: 1e6, // 1MB
      transports: ['websocket', 'polling'],
    }, 'Logger message');

    // Initialize managers
    this.roomManager = new RoomManager(this.io, this.logger);
    this.auth = new WebSocketAuth(this.config.auth, this.logger);
    this.connectionManager = new ConnectionManager(this.config, this.logger);
    this.messageHandler = new MessageHandler(
      this.roomManager,
      this.auth,
      this.connectionManager,
      this.logger
    );

    this.setupSocketHandlers();
    this.setupIntervals();
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  public start(): void {
    if (this.isRunning) {
      this.logger.warn('WebSocket server is already running');
      return;
    }

    this.isRunning = true;
    this.startHeartbeat();
    this.startMetricsCollection();

    this.emit(createSystemEvent('server_started', 'info', {
      port: this.config.port || 3000,
      environment: process.env.NODE_ENV || 'development',
      features: this.getEnabledFeatures(),
    }));

    this.logger.info({
      port: this.config.port,
      cors: this.config.cors,
    }, 'WebSocket server started');
  }

  public stop(): void {
    if (!this.isRunning) {
      this.logger.warn('WebSocket server is not running');
      return;
    }

    const activeConnections = this.connections.size;
    this.isRunning = false;

    // Stop intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Disconnect all clients
    this.io.disconnectSockets(true);
    
    // Clear connections
    this.connections.clear();
    
    // Close room manager
    this.roomManager.cleanup();

    const uptime = Date.now() - (this.getStartTime()?.getTime() || Date.now());

    this.emit(createSystemEvent('server_stopped', 'info', {
      reason: 'shutdown',
      uptime,
      activeConnections,
    }));

    this.logger.info({
      activeConnections,
      uptime,
    }, 'WebSocket server stopped');
  }

  public getConnections(): ClientConnection[] {
    return Array.from(this.connections.values());
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getConnection(connectionId: string): ClientConnection | undefined {
    return this.connections.get(connectionId);
  }

  public broadcast(message: WebSocketMessage, roomId?: string): void {
    if (roomId) {
      this.roomManager.broadcastToRoom(roomId, message);
    } else {
      this.io.emit('message', message);
    }
  }

  public sendToConnection(connectionId: string, message: WebSocketMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      connection.socket.emit('message', message);
      connection.lastActivity = new Date();
      return true;
    } catch (error) {
      this.logger.error({
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to send message to connection');
      return false;
    }
  }

  public sendToUser(userId: string, message: WebSocketMessage): number {
    let sentCount = 0;
    
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        if (this.sendToConnection(connection.id, message)) {
          sentCount++;
        }
      }
    }
    
    return sentCount;
  }

  public sendToWallet(walletAddress: string, message: WebSocketMessage): number {
    let sentCount = 0;
    
    for (const connection of this.connections.values()) {
      if (connection.walletAddress === walletAddress) {
        if (this.sendToConnection(connection.id, message)) {
          sentCount++;
        }
      }
    }
    
    return sentCount;
  }

  // ============================================================================
  // EVENT EMITTER IMPLEMENTATION
  // ============================================================================

  public async emit<T extends WebSocketEvent>(event: T): Promise<void> {
    const listeners = this.eventListeners.get(event.type);
    if (!listeners) return;

    const promises = Array.from(listeners).map(handler => {
      try {
        return handler.handle(event);
      } catch (error) {
        this.logger.error({
          eventType: event.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Event handler error');
        return null;
      }
    }, 'Logger message');

    await Promise.allSettled(promises);
  }

  public on<T extends WebSocketEvent>(eventType: string, handler: any): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(handler);
  }

  public off<T extends WebSocketEvent>(eventType: string, handler: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(handler);
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  public once<T extends WebSocketEvent>(eventType: string, handler: any): void {
    const onceHandler = {
      handle: async (event: T) => {
        this.off(eventType, onceHandler);
        return handler.handle(event);
      }
    };
    this.on(eventType, onceHandler);
  }

  public removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.eventListeners.delete(eventType);
    } else {
      this.eventListeners.clear();
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    }, 'Logger message');
  }

  private handleConnection(socket: Socket): void {
    const connectionId = this.generateConnectionId();
    const connection: ClientConnection = {
      id: connectionId,
      socket,
      authenticated: false,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
      rateLimitCount: 0,
      rateLimitResetTime: new Date(Date.now() + (this.config.rateLimit?.windowMs || 60000)),
      metadata: {},
    };

    // Store connection
    this.connections.set(connectionId, connection);

    // Set up socket event handlers
    this.setupSocketEventHandlers(socket, connection);

    // Send connection established message
    this.messageHandler.sendConnectionEstablished(socket, connectionId);

    // Log connection
    this.logger.info({
      connectionId,
      userAgent: socket.handshake.headers['user-agent'],
      address: socket.handshake.address,
    }, 'Client connected');

    // Update connection count
    this.updateConnectionMetrics();
  }

  private setupSocketEventHandlers(socket: Socket, connection: ClientConnection): void {
    // Message handling
    socket.on('message', async (data: any) => {
      try {
        await this.handleMessage(connection, data);
      } catch (error) {
        this.logger.error({
          connectionId: connection.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Message handling error');
        
        this.messageHandler.sendError(socket, 'message_handling_error', 'Failed to process message');
      }
    }, 'Logger message');

    // Heartbeat/ping handling
    socket.on('ping', () => {
      connection.lastActivity = new Date();
      socket.emit('pong', { timestamp: new Date() });
    }, 'Logger message');

    // Disconnection handling
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(connection, reason);
    }, 'Logger message');

    // Error handling
    socket.on('error', (error: Error) => {
      this.logger.error({
        connectionId: connection.id,
        error: error.message,
        stack: error.stack,
      }, 'Socket error');
    }, 'Logger message');
  }

  private async handleMessage(connection: ClientConnection, data: any): Promise<void> {
    // Rate limiting check
    if (!this.checkRateLimit(connection)) {
      this.messageHandler.sendError(
        connection.socket,
        'rate_limit_exceeded',
        'Too many requests'
      );
      return;
    }

    // Update activity
    connection.lastActivity = new Date();

    // Validate message format
    if (!this.isValidMessage(data)) {
      this.messageHandler.sendError(
        connection.socket,
        'invalid_message_format',
        'Invalid message format'
      );
      return;
    }

    // Handle the message
    await this.messageHandler.handleMessage(connection, data);
  }

  private handleDisconnection(connection: ClientConnection, reason: string): void {
    const duration = Date.now() - connection.connectedAt.getTime();

    // Clean up subscriptions
    for (const subscriptionId of connection.subscriptions) {
      this.roomManager.removeSubscription(connection.id, subscriptionId);
    }

    // Remove connection
    this.connections.delete(connection.id);

    // Log disconnection
    this.logger.info({
      connectionId: connection.id,
      userId: connection.userId,
      reason,
      duration,
      subscriptions: connection.subscriptions.size,
    }, 'Client disconnected');

    // Update metrics
    this.updateConnectionMetrics();
  }

  private checkRateLimit(connection: ClientConnection): boolean {
    const now = new Date();
    
    // Reset rate limit window if expired
    if (now > connection.rateLimitResetTime) {
      connection.rateLimitCount = 0;
      connection.rateLimitResetTime = new Date(
        now.getTime() + (this.config.rateLimit?.windowMs || 60000)
      );
    }

    // Check if limit exceeded
    const maxRequests = this.config.rateLimit?.maxRequestsPerWindow || 100;
    if (connection.rateLimitCount >= maxRequests) {
      return false;
    }

    // Increment count
    connection.rateLimitCount++;
    return true;
  }

  private isValidMessage(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.type === 'string' &&
      data.data !== undefined
    );
  }

  private setupIntervals(): void {
    // Set up heartbeat interval
    const heartbeatInterval = this.config.heartbeat?.interval || 30000;
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, heartbeatInterval);

    // Set up metrics collection interval
    if (this.config.monitoring?.enabled) {
      const metricsInterval = this.config.monitoring.metricsInterval || 60000;
      this.metricsInterval = setInterval(() => {
        this.collectMetrics();
      }, metricsInterval);
    }
  }

  private startHeartbeat(): void {
    // Heartbeat is started in setupIntervals
  }

  private startMetricsCollection(): void {
    // Metrics collection is started in setupIntervals
  }

  private sendHeartbeat(): void {
    const heartbeatMessage = {
      id: this.generateMessageId(),
      type: 'heartbeat' as MessageType,
      timestamp: new Date(),
      data: {
        serverTime: new Date(),
        connectionId: 'server',
      },
    };

    // Send to all connected clients
    for (const connection of this.connections.values()) {
      try {
        connection.socket.emit('message', heartbeatMessage);
      } catch (error) {
        // Log error but continue with other connections
        this.logger.warn({
          connectionId: connection.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to send heartbeat');
      }
    }
  }

  private collectMetrics(): void {
    const metrics = {
      activeConnections: this.connections.size,
      authenticatedConnections: Array.from(this.connections.values())
        .filter(c => c.authenticated).length,
      totalRooms: this.roomManager.getRoomCount(),
      totalSubscriptions: Array.from(this.connections.values())
        .reduce((sum, c) => sum + c.subscriptions.size, 0),
      uptime: this.getUptime(),
    };

    this.logger.info(metrics, 'WebSocket server metrics');
  }

  private updateConnectionMetrics(): void {
    // Could emit metrics update event here if needed
  }

  private validateConfig(config: WebSocketServerConfig): WebSocketServerConfig {
    return {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true,
        ...config.cors,
      },
      rateLimit: {
        maxConnections: 1000,
        windowMs: 60000,
        maxRequestsPerWindow: 100,
        ...config.rateLimit,
      },
      heartbeat: {
        interval: 30000,
        timeout: 60000,
        ...config.heartbeat,
      },
      auth: {
        required: isProductionMode(),
        tokenSecret: process.env.JWT_SECRET || 'development-secret',
        apiKeyValidation: true,
        ...config.auth,
      },
      monitoring: {
        enabled: isProductionMode(),
        metricsInterval: 60000,
        ...config.monitoring,
      },
      clustering: {
        enabled: false,
        ...config.clustering,
      },
      ...config,
    };
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEnabledFeatures(): string[] {
    const features = ['websocket', 'real-time-updates'];
    
    if (this.config.auth?.required) features.push('authentication');
    if (this.config.monitoring?.enabled) features.push('monitoring');
    if (this.config.clustering?.enabled) features.push('clustering');
    
    return features;
  }

  private getStartTime(): Date | undefined {
    // This would typically be stored when the server starts
    return new Date(); // Placeholder
  }

  private getUptime(): number {
    const startTime = this.getStartTime();
    return startTime ? Date.now() - startTime.getTime() : 0;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let webSocketServerInstance: WebSocketServer | null = null;

export function getWebSocketServer(httpServer?: HTTPServer, config?: WebSocketServerConfig): WebSocketServer {
  if (!webSocketServerInstance && httpServer && config) {
    webSocketServerInstance = new WebSocketServer(httpServer, config);
  }
  
  if (!webSocketServerInstance) {
    throw new Error('WebSocket server not initialized. Call with httpServer and config first.');
  }
  
  return webSocketServerInstance;
}

export function initializeWebSocketServer(httpServer: HTTPServer, config: WebSocketServerConfig): WebSocketServer {
  if (webSocketServerInstance) {
    webSocketServerInstance.stop();
  }
  
  webSocketServerInstance = new WebSocketServer(httpServer, config);
  return webSocketServerInstance;
}