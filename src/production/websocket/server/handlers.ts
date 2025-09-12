/**
 * WebSocket Message Handlers
 * Processes all incoming WebSocket messages
 */

import { Socket } from 'socket.io';
import {
  WebSocketMessage,
  MessageType,
  createMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  AuthenticateMessage,
  JoinRoomMessage,
  LeaveRoomMessage,
  ConnectionEstablishedMessage,
  ConnectionErrorMessage,
  SubscriptionConfirmedMessage,
  AuthenticationSuccessMessage,
  AuthenticationFailedMessage,
} from '../types/messages';
import { RoomManager } from './rooms';
import { WebSocketAuth } from './auth';
import { ConnectionManager } from '../utils/connection';
import { ClientConnection } from './websocket';
import pino from 'pino';

// ============================================================================
// MESSAGE HANDLER CLASS
// ============================================================================

export class MessageHandler {
  private roomManager: RoomManager;
  private auth: WebSocketAuth;
  private connectionManager: ConnectionManager;
  private logger: pino.Logger;

  constructor(
    roomManager: RoomManager,
    auth: WebSocketAuth,
    connectionManager: ConnectionManager,
    logger: pino.Logger
  ) {
    this.roomManager = roomManager;
    this.auth = auth;
    this.connectionManager = connectionManager;
    this.logger = logger;
  }

  // ============================================================================
  // PUBLIC METHODS - MESSAGE HANDLING
  // ============================================================================

  public async handleMessage(connection: ClientConnection, message: WebSocketMessage): Promise<void> {
    try {
      this.logger.debug({
        connectionId: connection.id,
        messageType: message.type,
        messageId: message.id,
        authenticated: connection.authenticated,
      }, 'Processing message');

      // Route message based on type
      switch (message.type) {
        case 'authenticate':
          await this.handleAuthenticate(connection, message as AuthenticateMessage);
          break;

        case 'subscribe':
          await this.handleSubscribe(connection, message as SubscribeMessage);
          break;

        case 'unsubscribe':
          await this.handleUnsubscribe(connection, message as UnsubscribeMessage);
          break;

        case 'join_room':
          await this.handleJoinRoom(connection, message as JoinRoomMessage);
          break;

        case 'leave_room':
          await this.handleLeaveRoom(connection, message as LeaveRoomMessage);
          break;

        case 'heartbeat':
          await this.handleHeartbeat(connection, message);
          break;

        default:
          this.logger.warn({
            connectionId: connection.id,
            messageType: message.type,
          }, 'Unknown message type');
          
          this.sendError(connection.socket, 'unknown_message_type', `Unknown message type: ${message.type}`);
      }

    } catch (error) {
      this.logger.error({
        connectionId: connection.id,
        messageType: message.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }, 'Message handling error');

      this.sendError(
        connection.socket,
        'message_processing_error',
        'Failed to process message'
      );
    }
  }

  // ============================================================================
  // PUBLIC METHODS - UTILITY MESSAGES
  // ============================================================================

  public sendConnectionEstablished(socket: Socket, connectionId: string): void {
    const message = createMessage<ConnectionEstablishedMessage>('connection_established', {
      connectionId,
      serverTime: new Date(),
      features: ['real-time-updates', 'subscriptions', 'rooms', 'authentication'],
    }, 'Logger message');

    socket.emit('message', message);
  }

  public sendError(socket: Socket, code: string, error: string): void {
    const message = createMessage<ConnectionErrorMessage>('connection_error', {
      error,
      code,
      retryable: this.isRetryableError(code),
    }, 'Logger message');

    socket.emit('message', message);
  }

  public sendAuthenticationSuccess(socket: Socket, userId: string, permissions: string[]): void {
    const message = createMessage<AuthenticationSuccessMessage>('authentication_success', {
      userId,
      permissions,
      rateLimit: {
        requestsPerMinute: 100,
        remaining: 100,
      },
    }, 'Logger message');

    socket.emit('message', message);
  }

  public sendAuthenticationFailed(socket: Socket, error: string, code: string): void {
    const message = createMessage<AuthenticationFailedMessage>('authentication_failed', {
      error,
      code,
    }, 'Logger message');

    socket.emit('message', message);
  }

  public sendSubscriptionConfirmed(socket: Socket, subscriptions: { id: string; status: 'active' | 'failed'; error?: string }[]): void {
    const message = createMessage<SubscriptionConfirmedMessage>('subscription_confirmed', {
      subscriptions,
    }, 'Logger message');

    socket.emit('message', message);
  }

  // ============================================================================
  // PRIVATE METHODS - MESSAGE HANDLERS
  // ============================================================================

  private async handleAuthenticate(connection: ClientConnection, message: AuthenticateMessage): Promise<void> {
    try {
      const authResult = await this.auth.authenticate(message.data);

      if (authResult.success) {
        // Update connection with authentication info
        connection.authenticated = true;
        connection.userId = authResult.userId;
        connection.walletAddress = authResult.walletAddress;
        connection.metadata = {
          ...connection.metadata,
          permissions: authResult.permissions,
          authMethod: authResult.authMethod,
        };

        // Send success response
        this.sendAuthenticationSuccess(
          connection.socket,
          authResult.userId!,
          authResult.permissions || []
        );

        this.logger.info({
          connectionId: connection.id,
          userId: authResult.userId,
          walletAddress: authResult.walletAddress,
          authMethod: authResult.authMethod,
        }, 'Client authenticated');

      } else {
        // Send failure response
        this.sendAuthenticationFailed(
          connection.socket,
          authResult.error || 'Authentication failed',
          authResult.code || 'auth_failed'
        );

        this.logger.warn({
          connectionId: connection.id,
          error: authResult.error,
          code: authResult.code,
        }, 'Authentication failed');
      }

    } catch (error) {
      this.sendAuthenticationFailed(
        connection.socket,
        'Authentication service error',
        'auth_service_error'
      );

      this.logger.error({
        connectionId: connection.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Authentication service error');
    }
  }

  private async handleSubscribe(connection: ClientConnection, message: SubscribeMessage): Promise<void> {
    // Check if authentication is required for subscriptions
    if (this.requiresAuthentication('subscribe') && !connection.authenticated) {
      this.sendError(connection.socket, 'authentication_required', 'Authentication required for subscriptions');
      return;
    }

    const subscriptionResults: { id: string; status: 'active' | 'failed'; error?: string }[] = [];

    for (const subscription of message.data.subscriptions) {
      try {
        // Validate subscription
        const validationResult = await this.validateSubscription(connection, subscription);
        if (!validationResult.valid) {
          subscriptionResults.push({
            id: subscription.id,
            status: 'failed',
            error: validationResult.error,
          }, 'Logger message');
          continue;
        }

        // Determine appropriate room for subscription
        const roomId = this.getRoomIdForSubscription(subscription);
        const roomType = this.getRoomTypeForSubscription(subscription.type);

        // Join or create room
        const joinResult = this.roomManager.joinRoom(roomId, connection.id, roomType);
        if (!joinResult) {
          subscriptionResults.push({
            id: subscription.id,
            status: 'failed',
            error: 'Failed to join room',
          }, 'Logger message');
          continue;
        }

        // Add subscription to room
        const addResult = this.roomManager.addSubscription(roomId, connection.id, subscription);
        if (!addResult) {
          subscriptionResults.push({
            id: subscription.id,
            status: 'failed',
            error: 'Failed to add subscription',
          }, 'Logger message');
          continue;
        }

        // Track subscription in connection
        connection.subscriptions.add(subscription.id);

        subscriptionResults.push({
          id: subscription.id,
          status: 'active',
        }, 'Logger message');

        this.logger.debug({
          connectionId: connection.id,
          subscriptionId: subscription.id,
          subscriptionType: subscription.type,
          roomId,
        }, 'Subscription created');

      } catch (error) {
        subscriptionResults.push({
          id: subscription.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Logger message');

        this.logger.error({
          connectionId: connection.id,
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Subscription creation error');
      }
    }

    // Send confirmation
    this.sendSubscriptionConfirmed(connection.socket, subscriptionResults);
  }

  private async handleUnsubscribe(connection: ClientConnection, message: UnsubscribeMessage): Promise<void> {
    const unsubscribeResults: { id: string; status: 'removed' | 'not_found' }[] = [];

    for (const subscriptionId of message.data.subscriptions) {
      const removed = this.roomManager.removeSubscription(connection.id, subscriptionId);
      
      if (removed) {
        connection.subscriptions.delete(subscriptionId);
        unsubscribeResults.push({
          id: subscriptionId,
          status: 'removed',
        }, 'Logger message');

        this.logger.debug({
          connectionId: connection.id,
          subscriptionId,
        }, 'Subscription removed');
      } else {
        unsubscribeResults.push({
          id: subscriptionId,
          status: 'not_found',
        }, 'Logger message');
      }
    }

    // Send confirmation (could create a specific unsubscribe confirmation message type)
    const confirmationMessage = createMessage('subscription_confirmed', {
      subscriptions: unsubscribeResults.map(r => ({
        id: r.id,
        status: r.status === 'removed' ? 'active' : 'failed' as 'active' | 'failed',
        error: r.status === 'not_found' ? 'Subscription not found' : undefined,
      }))
    }, 'Logger message');

    connection.socket.emit('message', confirmationMessage);
  }

  private async handleJoinRoom(connection: ClientConnection, message: JoinRoomMessage): Promise<void> {
    try {
      // Validate room access
      const accessResult = await this.validateRoomAccess(connection, message.data.roomId, message.data.roomType);
      if (!accessResult.allowed) {
        this.sendError(connection.socket, 'room_access_denied', accessResult.reason || 'Access denied');
        return;
      }

      // Join room
      const joinResult = this.roomManager.joinRoom(
        message.data.roomId,
        connection.id,
        message.data.roomType,
        message.data.metadata
      );

      if (joinResult) {
        // Send success response
        const roomJoinedMessage = createMessage('room_joined', {
          roomId: message.data.roomId,
          members: this.roomManager.getRoomMembers(message.data.roomId).length,
          permissions: [], // TODO: Implement room-specific permissions
        }, 'Logger message');

        connection.socket.emit('message', roomJoinedMessage);

        this.logger.info({
          connectionId: connection.id,
          roomId: message.data.roomId,
          roomType: message.data.roomType,
        }, 'Client joined room');
      } else {
        this.sendError(connection.socket, 'room_join_failed', 'Failed to join room');
      }

    } catch (error) {
      this.sendError(connection.socket, 'room_join_error', 'Room join error');
      
      this.logger.error({
        connectionId: connection.id,
        roomId: message.data.roomId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Room join error');
    }
  }

  private async handleLeaveRoom(connection: ClientConnection, message: LeaveRoomMessage): Promise<void> {
    const leaveResult = this.roomManager.leaveRoom(message.data.roomId, connection.id);

    if (leaveResult) {
      // Send success response
      const roomLeftMessage = createMessage('room_left', {
        roomId: message.data.roomId,
      }, 'Logger message');

      connection.socket.emit('message', roomLeftMessage);

      this.logger.info({
        connectionId: connection.id,
        roomId: message.data.roomId,
      }, 'Client left room');
    } else {
      this.sendError(connection.socket, 'room_leave_failed', 'Failed to leave room');
    }
  }

  private async handleHeartbeat(connection: ClientConnection, message: WebSocketMessage): Promise<void> {
    // Update connection activity
    connection.lastActivity = new Date();

    // Send heartbeat response
    const heartbeatResponse = createMessage('heartbeat', {
      serverTime: new Date(),
      connectionId: connection.id,
    }, 'Logger message');

    connection.socket.emit('message', heartbeatResponse);
  }

  // ============================================================================
  // PRIVATE METHODS - VALIDATION
  // ============================================================================

  private async validateSubscription(
    connection: ClientConnection,
    subscription: any
  ): Promise<{ valid: boolean; error?: string }> {
    // Basic validation
    if (!subscription.id || !subscription.type) {
      return { valid: false, error: 'Subscription must have id and type' };
    }

    // Check if subscription type is supported
    const supportedTypes = ['positions', 'prices', 'portfolio', 'jobs', 'notifications', 'analytics'];
    if (!supportedTypes.includes(subscription.type)) {
      return { valid: false, error: `Unsupported subscription type: ${subscription.type}` };
    }

    // Check permissions for certain subscription types
    if (subscription.type === 'analytics' && !this.hasPermission(connection, 'analytics:read')) {
      return { valid: false, error: 'Insufficient permissions for analytics subscription' };
    }

    // Validate filters
    if (subscription.filters) {
      const filterValidation = this.validateSubscriptionFilters(subscription.type, subscription.filters);
      if (!filterValidation.valid) {
        return filterValidation;
      }
    }

    return { valid: true };
  }

  private validateSubscriptionFilters(
    subscriptionType: string,
    filters: any
  ): { valid: boolean; error?: string } {
    // Type-specific filter validation
    switch (subscriptionType) {
      case 'positions':
        if (filters.walletAddress && typeof filters.walletAddress !== 'string') {
          return { valid: false, error: 'walletAddress must be a string' };
        }
        break;

      case 'prices':
        if (filters.tokens && !Array.isArray(filters.tokens)) {
          return { valid: false, error: 'tokens must be an array' };
        }
        break;

      case 'portfolio':
        if (!filters.walletAddress) {
          return { valid: false, error: 'walletAddress is required for portfolio subscriptions' };
        }
        break;
    }

    return { valid: true };
  }

  private async validateRoomAccess(
    connection: ClientConnection,
    roomId: string,
    roomType?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check authentication requirements
    if (this.requiresAuthentication('room_access') && !connection.authenticated) {
      return { allowed: false, reason: 'Authentication required' };
    }

    // Check room-specific access rules
    if (roomType === 'analytics' && !this.hasPermission(connection, 'analytics:read')) {
      return { allowed: false, reason: 'Insufficient permissions for analytics room' };
    }

    // Check wallet room access
    if (roomId.startsWith('wallet:')) {
      const walletAddress = roomId.split(':')[1];
      if (connection.walletAddress && connection.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return { allowed: false, reason: 'Can only access your own wallet room' };
      }
    }

    return { allowed: true };
  }

  // ============================================================================
  // PRIVATE METHODS - UTILITIES
  // ============================================================================

  private requiresAuthentication(operation: string): boolean {
    // Define which operations require authentication
    const authRequiredOps = ['analytics', 'room_access'];
    return authRequiredOps.some(op => operation.includes(op));
  }

  private hasPermission(connection: ClientConnection, permission: string): boolean {
    const permissions = connection.metadata.permissions as string[] || [];
    return permissions.includes(permission) || permissions.includes('admin');
  }

  private isRetryableError(code: string): boolean {
    const retryableCodes = [
      'rate_limit_exceeded',
      'server_busy',
      'temporary_error',
      'service_unavailable'
    ];
    return retryableCodes.includes(code);
  }

  private getRoomIdForSubscription(subscription: any): string {
    switch (subscription.type) {
      case 'positions':
      case 'portfolio':
        if (subscription.filters.walletAddress) {
          return `wallet:${subscription.filters.walletAddress.toLowerCase()}`;
        }
        break;

      case 'prices':
        if (subscription.filters.chains && subscription.filters.chains.length === 1) {
          return `chain:${subscription.filters.chains[0]}`;
        }
        break;

      case 'analytics':
        return 'analytics:global';

      case 'notifications':
        if (subscription.filters.walletAddress) {
          return `alerts:${subscription.filters.walletAddress.toLowerCase()}`;
        }
        return 'alerts:global';
    }

    // Default to global room
    return 'global:general';
  }

  private getRoomTypeForSubscription(subscriptionType: string): any {
    switch (subscriptionType) {
      case 'positions':
      case 'portfolio':
        return 'wallet';
      case 'prices':
        return 'chain';
      case 'analytics':
        return 'analytics';
      case 'notifications':
        return 'alerts';
      default:
        return 'global';
    }
  }
}