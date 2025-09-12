/**
 * Room Management System
 * Handles WebSocket room subscriptions and broadcasting
 */

import { Server as SocketIOServer } from 'socket.io';
import { WebSocketMessage, SubscriptionRequest, RoomType } from '../types/messages';
import { 
  RoomEvent, 
  createRoomEvent, 
  MemberJoinedRoomEvent,
  MemberLeftRoomEvent,
  RoomBroadcastEvent
} from '../types/events';
import { ChainType, ProtocolType } from '../../../types';
import pino from 'pino';

// ============================================================================
// ROOM INTERFACES
// ============================================================================

export interface Room {
  id: string;
  type: RoomType;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy?: string;
  maxMembers?: number;
  members: Set<string>; // connection IDs
  subscriptions: Map<string, RoomSubscription>; // subscription ID -> subscription
  config: RoomConfig;
  metadata: Record<string, any>;
  lastActivity: Date;
  messageCount: number;
  isActive: boolean;
}

export interface RoomSubscription {
  id: string;
  connectionId: string;
  type: string;
  filters: Record<string, any>;
  createdAt: Date;
  lastActivity: Date;
  messagesSent: number;
}

export interface RoomConfig {
  autoCleanup: boolean;
  maxIdleTime: number; // milliseconds
  rateLimitPerMember: number;
  persistMessages: boolean;
  allowAnonymous: boolean;
  requireAuth: boolean;
}

export interface RoomStats {
  totalRooms: number;
  activeRooms: number;
  totalMembers: number;
  averageMembersPerRoom: number;
  messagesSent: number;
  roomsByType: Record<RoomType, number>;
}

// ============================================================================
// ROOM MANAGER CLASS
// ============================================================================

export class RoomManager {
  private io: SocketIOServer;
  private logger: pino.Logger;
  private rooms: Map<string, Room>;
  private memberRooms: Map<string, Set<string>>; // connection ID -> room IDs
  private cleanupInterval: NodeJS.Timeout | null;
  private statsInterval: NodeJS.Timeout | null;

  constructor(io: SocketIOServer, logger: pino.Logger) {
    this.io = io;
    this.logger = logger;
    this.rooms = new Map();
    this.memberRooms = new Map();
    this.cleanupInterval = null;
    this.statsInterval = null;

    this.startCleanupProcess();
    this.startStatsCollection();
  }

  // ============================================================================
  // PUBLIC METHODS - ROOM MANAGEMENT
  // ============================================================================

  public createRoom(
    roomId: string, 
    roomType: RoomType, 
    config?: Partial<RoomConfig>,
    createdBy?: string
  ): Room {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} already exists`);
    }

    const room: Room = {
      id: roomId,
      type: roomType,
      name: this.generateRoomName(roomType, roomId),
      createdAt: new Date(),
      createdBy,
      members: new Set(),
      subscriptions: new Map(),
      config: this.getDefaultConfig(roomType, config),
      metadata: {},
      lastActivity: new Date(),
      messageCount: 0,
      isActive: true,
    };

    this.rooms.set(roomId, room);

    this.logger.info({
      roomId,
      roomType,
      createdBy,
    }, 'Room created');

    return room;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  public deleteRoom(roomId: string, reason: string = 'manual_deletion'): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // Remove all members from the room
    for (const connectionId of Array.from(room.members)) {
      this.removeMemberFromRoom(roomId, connectionId, reason);
    }

    // Remove room
    this.rooms.delete(roomId);

    this.logger.info({
      roomId,
      memberCount: room.members.size,
      duration: Date.now() - room.createdAt.getTime(),
      reason,
    }, 'Room deleted');

    return true;
  }

  // ============================================================================
  // PUBLIC METHODS - MEMBER MANAGEMENT
  // ============================================================================

  public joinRoom(
    roomId: string, 
    connectionId: string, 
    roomType?: RoomType,
    metadata?: Record<string, any>
  ): boolean {
    let room = this.rooms.get(roomId);
    
    // Auto-create room if it doesn't exist
    if (!room && roomType) {
      room = this.createRoom(roomId, roomType);
    }

    if (!room) {
      this.logger.warn({ roomId, connectionId }, 'Attempted to join non-existent room');
      return false;
    }

    // Check room capacity
    if (room.maxMembers && room.members.size >= room.maxMembers) {
      this.logger.warn({
        roomId,
        connectionId,
        currentMembers: room.members.size,
        maxMembers: room.maxMembers,
      }, 'Room at capacity');
      return false;
    }

    // Add member to room
    room.members.add(connectionId);
    room.lastActivity = new Date();

    // Track member's rooms
    if (!this.memberRooms.has(connectionId)) {
      this.memberRooms.set(connectionId, new Set());
    }
    this.memberRooms.get(connectionId)!.add(roomId);

    // Join Socket.IO room
    const socket = this.findSocketByConnectionId(connectionId);
    if (socket) {
      socket.join(roomId);
    }

    this.logger.info({
      roomId,
      connectionId,
      memberCount: room.members.size,
      roomType: room.type,
    }, 'Member joined room');

    return true;
  }

  public leaveRoom(roomId: string, connectionId: string, reason: string = 'manual_leave'): boolean {
    return this.removeMemberFromRoom(roomId, connectionId, reason);
  }

  public leaveAllRooms(connectionId: string, reason: string = 'disconnect'): void {
    const memberRooms = this.memberRooms.get(connectionId);
    if (!memberRooms) return;

    // Leave each room
    for (const roomId of Array.from(memberRooms)) {
      this.removeMemberFromRoom(roomId, connectionId, reason);
    }

    // Clear member's room tracking
    this.memberRooms.delete(connectionId);
  }

  public getRoomMembers(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.members) : [];
  }

  public getMemberRooms(connectionId: string): string[] {
    const memberRooms = this.memberRooms.get(connectionId);
    return memberRooms ? Array.from(memberRooms) : [];
  }

  // ============================================================================
  // PUBLIC METHODS - SUBSCRIPTION MANAGEMENT
  // ============================================================================

  public addSubscription(
    roomId: string,
    connectionId: string,
    subscription: SubscriptionRequest
  ): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.logger.warn({ roomId, connectionId }, 'Cannot add subscription to non-existent room');
      return false;
    }

    if (!room.members.has(connectionId)) {
      this.logger.warn({ roomId, connectionId }, 'Cannot add subscription for non-member');
      return false;
    }

    const roomSubscription: RoomSubscription = {
      id: subscription.id,
      connectionId,
      type: subscription.type,
      filters: subscription.filters,
      createdAt: new Date(),
      lastActivity: new Date(),
      messagesSent: 0,
    };

    room.subscriptions.set(subscription.id, roomSubscription);
    room.lastActivity = new Date();

    this.logger.debug({
      roomId,
      connectionId,
      subscriptionId: subscription.id,
      subscriptionType: subscription.type,
    }, 'Subscription added to room');

    return true;
  }

  public removeSubscription(connectionId: string, subscriptionId: string): boolean {
    let removed = false;

    // Find and remove subscription from all rooms
    for (const room of Array.from(this.rooms.values())) {
      const subscription = room.subscriptions.get(subscriptionId);
      if (subscription && subscription.connectionId === connectionId) {
        room.subscriptions.delete(subscriptionId);
        room.lastActivity = new Date();
        removed = true;

        this.logger.debug({
          roomId: room.id,
          connectionId,
          subscriptionId,
        }, 'Subscription removed from room');
      }
    }

    return removed;
  }

  public getSubscriptions(roomId: string): RoomSubscription[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.subscriptions.values()) : [];
  }

  // ============================================================================
  // PUBLIC METHODS - BROADCASTING
  // ============================================================================

  public broadcastToRoom(roomId: string, message: WebSocketMessage): number {
    const room = this.rooms.get(roomId);
    if (!room || !room.isActive) {
      return 0;
    }

    // Emit to Socket.IO room
    this.io.to(roomId).emit('message', message);

    // Update room stats
    room.messageCount++;
    room.lastActivity = new Date();

    // Update subscription stats
    for (const subscription of Array.from(room.subscriptions.values())) {
      subscription.messagesSent++;
      subscription.lastActivity = new Date();
    }

    const memberCount = room.members.size;
    
    this.logger.debug({
      roomId,
      messageType: message.type,
      memberCount,
      messageId: message.id,
    }, 'Message broadcast to room');

    return memberCount;
  }

  public broadcastToRoomType(roomType: RoomType, message: WebSocketMessage): number {
    let totalSent = 0;
    
    for (const room of Array.from(this.rooms.values())) {
      if (room.type === roomType && room.isActive) {
        totalSent += this.broadcastToRoom(room.id, message);
      }
    }

    return totalSent;
  }

  public broadcastToMember(connectionId: string, message: WebSocketMessage): number {
    const memberRooms = this.memberRooms.get(connectionId);
    if (!memberRooms) return 0;

    let sentCount = 0;
    const socket = this.findSocketByConnectionId(connectionId);
    
    if (socket) {
      socket.emit('message', message);
      sentCount = 1;
    }

    return sentCount;
  }

  // ============================================================================
  // PUBLIC METHODS - ROOM DISCOVERY
  // ============================================================================

  public getWalletRoom(walletAddress: string): Room | undefined {
    const roomId = `wallet:${walletAddress.toLowerCase()}`;
    return this.rooms.get(roomId);
  }

  public getProtocolRoom(protocol: ProtocolType, chain: ChainType): Room | undefined {
    const roomId = `protocol:${chain}:${protocol}`;
    return this.rooms.get(roomId);
  }

  public getChainRoom(chain: ChainType): Room | undefined {
    const roomId = `chain:${chain}`;
    return this.rooms.get(roomId);
  }

  public getOrCreateWalletRoom(walletAddress: string): Room {
    const roomId = `wallet:${walletAddress.toLowerCase()}`;
    let room = this.rooms.get(roomId);
    
    if (!room) {
      room = this.createRoom(roomId, 'wallet');
      room.metadata = { walletAddress };
    }
    
    return room;
  }

  public getOrCreateProtocolRoom(protocol: ProtocolType, chain: ChainType): Room {
    const roomId = `protocol:${chain}:${protocol}`;
    let room = this.rooms.get(roomId);
    
    if (!room) {
      room = this.createRoom(roomId, 'protocol');
      room.metadata = { protocol, chain };
    }
    
    return room;
  }

  // ============================================================================
  // PUBLIC METHODS - STATISTICS
  // ============================================================================

  public getStats(): RoomStats {
    const stats: RoomStats = {
      totalRooms: this.rooms.size,
      activeRooms: Array.from(this.rooms.values()).filter(r => r.isActive).length,
      totalMembers: Array.from(this.rooms.values()).reduce((sum, r) => sum + r.members.size, 0),
      averageMembersPerRoom: 0,
      messagesSent: Array.from(this.rooms.values()).reduce((sum, r) => sum + r.messageCount, 0),
      roomsByType: {
        wallet: 0,
        protocol: 0,
        chain: 0,
        global: 0,
        analytics: 0,
        alerts: 0,
      },
    };

    // Calculate average members per room
    if (stats.activeRooms > 0) {
      stats.averageMembersPerRoom = stats.totalMembers / stats.activeRooms;
    }

    // Count rooms by type
    for (const room of Array.from(this.rooms.values())) {
      if (room.isActive) {
        stats.roomsByType[room.type]++;
      }
    }

    return stats;
  }

  // ============================================================================
  // PUBLIC METHODS - CLEANUP
  // ============================================================================

  public cleanup(): void {
    // Stop intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Clean up all rooms
    for (const roomId of Array.from(this.rooms.keys())) {
      this.deleteRoom(roomId, 'server_shutdown');
    }

    this.rooms.clear();
    this.memberRooms.clear();

    this.logger.info('Room manager cleaned up');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private removeMemberFromRoom(roomId: string, connectionId: string, reason: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || !room.members.has(connectionId)) {
      return false;
    }

    // Remove member from room
    room.members.delete(connectionId);
    room.lastActivity = new Date();

    // Remove member's subscriptions from this room
    const subscriptionsToRemove = Array.from(room.subscriptions.entries())
      .filter(([_, sub]) => sub.connectionId === connectionId)
      .map(([id]) => id);

    for (const subscriptionId of subscriptionsToRemove) {
      room.subscriptions.delete(subscriptionId);
    }

    // Update member room tracking
    const memberRooms = this.memberRooms.get(connectionId);
    if (memberRooms) {
      memberRooms.delete(roomId);
      if (memberRooms.size === 0) {
        this.memberRooms.delete(connectionId);
      }
    }

    // Leave Socket.IO room
    const socket = this.findSocketByConnectionId(connectionId);
    if (socket) {
      socket.leave(roomId);
    }

    this.logger.info({
      roomId,
      connectionId,
      memberCount: room.members.size,
      reason,
      subscriptionsRemoved: subscriptionsToRemove.length,
    }, 'Member left room');

    // Auto-cleanup empty rooms if configured
    if (room.config.autoCleanup && room.members.size === 0) {
      this.scheduleRoomCleanup(roomId);
    }

    return true;
  }

  private findSocketByConnectionId(connectionId: string): any {
    // This is a simplified version - in a real implementation,
    // you'd maintain a mapping of connection IDs to sockets
    for (const [_, socket] of Array.from(this.io.sockets.sockets)) {
      if ((socket as any).connectionId === connectionId) {
        return socket;
      }
    }
    return null;
  }

  private getDefaultConfig(roomType: RoomType, config?: Partial<RoomConfig>): RoomConfig {
    const defaults: RoomConfig = {
      autoCleanup: true,
      maxIdleTime: 300000, // 5 minutes
      rateLimitPerMember: 100,
      persistMessages: false,
      allowAnonymous: roomType !== 'analytics',
      requireAuth: roomType === 'analytics' || roomType === 'alerts',
    };

    return { ...defaults, ...config };
  }

  private generateRoomName(roomType: RoomType, roomId: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    
    switch (roomType) {
      case 'wallet':
        return `Wallet Room (${roomId.split(':')[1]?.slice(0, 8)}...)`;
      case 'protocol':
        const parts = roomId.split(':');
        return `${parts[2]} on ${parts[1]} Room`;
      case 'chain':
        return `${roomId.split(':')[1]} Chain Room`;
      case 'global':
        return `Global Market Room`;
      case 'analytics':
        return `Analytics Room`;
      case 'alerts':
        return `Alerts Room`;
      default:
        return `Room ${roomId}`;
    }
  }

  private startCleanupProcess(): void {
    // Clean up idle rooms every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleRooms();
    }, 300000);
  }

  private startStatsCollection(): void {
    // Collect stats every minute
    this.statsInterval = setInterval(() => {
      const stats = this.getStats();
      this.logger.info(stats, 'Room manager stats');
    }, 60000);
  }

  private cleanupIdleRooms(): void {
    const now = Date.now();
    const roomsToCleanup: string[] = [];

    for (const [roomId, room] of Array.from(this.rooms.entries())) {
      if (
        room.config.autoCleanup &&
        room.members.size === 0 &&
        (now - room.lastActivity.getTime()) > room.config.maxIdleTime
      ) {
        roomsToCleanup.push(roomId);
      }
    }

    for (const roomId of roomsToCleanup) {
      this.deleteRoom(roomId, 'idle_timeout');
    }

    if (roomsToCleanup.length > 0) {
      this.logger.info({
        cleanedUpRooms: roomsToCleanup.length,
      }, 'Cleaned up idle rooms');
    }
  }

  private scheduleRoomCleanup(roomId: string): void {
    // Schedule room cleanup after a delay
    setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (room && room.members.size === 0) {
        this.deleteRoom(roomId, 'auto_cleanup');
      }
    }, 30000); // 30 second delay
  }
}