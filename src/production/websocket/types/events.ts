/**
 * WebSocket Event Types and Interfaces
 * Defines system events and their handling
 */

import { ChainType, ProtocolType } from '../../../types';
import { RealTimePosition, WebSocketMessage } from './messages';

// ============================================================================
// CONNECTION EVENTS
// ============================================================================

export interface ConnectionEvent {
  connectionId: string;
  userId?: string;
  walletAddress?: string;
  timestamp: Date;
}

export interface ClientConnectedEvent extends ConnectionEvent {
  type: 'client_connected';
  userAgent?: string;
  ipAddress?: string;
  authenticatedUser?: boolean;
}

export interface ClientDisconnectedEvent extends ConnectionEvent {
  type: 'client_disconnected';
  reason: 'client_disconnect' | 'timeout' | 'error' | 'server_shutdown';
  duration: number; // connection duration in ms
}

export interface ClientAuthenticatedEvent extends ConnectionEvent {
  type: 'client_authenticated';
  userId: string;
  permissions: string[];
  authMethod: 'token' | 'api_key' | 'wallet_signature';
}

export interface ClientAuthenticationFailedEvent extends ConnectionEvent {
  type: 'client_authentication_failed';
  reason: string;
  attemptCount: number;
}

// ============================================================================
// SUBSCRIPTION EVENTS
// ============================================================================

export interface SubscriptionEvent {
  connectionId: string;
  subscriptionId: string;
  userId?: string;
  timestamp: Date;
}

export interface SubscriptionCreatedEvent extends SubscriptionEvent {
  type: 'subscription_created';
  subscriptionType: string;
  filters: Record<string, any>;
  roomId?: string;
}

export interface SubscriptionRemovedEvent extends SubscriptionEvent {
  type: 'subscription_removed';
  reason: 'unsubscribed' | 'client_disconnected' | 'expired' | 'error';
}

export interface SubscriptionErrorEvent extends SubscriptionEvent {
  type: 'subscription_error';
  error: string;
  code: string;
  retryable: boolean;
}

// ============================================================================
// DATA EVENTS
// ============================================================================

export interface DataUpdateEvent {
  id: string;
  source: string;
  timestamp: Date;
}

export interface PositionDataUpdateEvent extends DataUpdateEvent {
  type: 'position_data_update';
  walletAddress: string;
  positions: RealTimePosition[];
  changes: {
    created: string[];
    updated: string[];
    removed: string[];
  };
}

export interface PriceDataUpdateEvent extends DataUpdateEvent {
  type: 'price_data_update';
  tokens: {
    address: string;
    price: number;
    change24h: number;
    volume24h: number;
  }[];
}

export interface PoolDataUpdateEvent extends DataUpdateEvent {
  type: 'pool_data_update';
  protocol: ProtocolType;
  chain: ChainType;
  pools: {
    id: string;
    tvl: number;
    volume24h: number;
    fees24h: number;
    apr: number;
  }[];
}

// ============================================================================
// SYSTEM EVENTS
// ============================================================================

export interface SystemEvent {
  id: string;
  type: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface ServerStartedEvent extends SystemEvent {
  type: 'server_started';
  port: number;
  environment: string;
  features: string[];
}

export interface ServerStoppedEvent extends SystemEvent {
  type: 'server_stopped';
  reason: 'shutdown' | 'error' | 'restart';
  uptime: number;
  activeConnections: number;
}

export interface HealthCheckEvent extends SystemEvent {
  type: 'health_check';
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    status: 'pass' | 'fail';
    responseTime?: number;
    error?: string;
  }[];
}

export interface RateLimitExceededEvent extends SystemEvent {
  type: 'rate_limit_exceeded';
  connectionId: string;
  userId?: string;
  limit: number;
  current: number;
  window: number;
}

export interface ErrorEvent extends SystemEvent {
  type: 'error';
  error: string;
  stack?: string;
  context?: Record<string, any>;
  connectionId?: string;
  userId?: string;
}

// ============================================================================
// BUSINESS EVENTS
// ============================================================================

export interface BusinessEvent {
  id: string;
  type: string;
  timestamp: Date;
  userId?: string;
  walletAddress?: string;
}

export interface PositionOutOfRangeEvent extends BusinessEvent {
  type: 'position_out_of_range';
  positionId: string;
  protocol: ProtocolType;
  chain: ChainType;
  currentPrice: number;
  rangeMin: number;
  rangeMax: number;
  timeOutOfRange: number;
}

export interface LargePositionChangeEvent extends BusinessEvent {
  type: 'large_position_change';
  positionId: string;
  changeType: 'increase' | 'decrease';
  oldValue: number;
  newValue: number;
  changePercent: number;
}

export interface HighYieldOpportunityEvent extends BusinessEvent {
  type: 'high_yield_opportunity';
  protocol: ProtocolType;
  chain: ChainType;
  poolId: string;
  currentApr: number;
  potentialApr: number;
  riskLevel: string;
}

export interface ImpermanentLossWarningEvent extends BusinessEvent {
  type: 'impermanent_loss_warning';
  positionId: string;
  currentLoss: number;
  thresholdExceeded: number;
  priceRatio: number;
}

export interface GasOptimizationEvent extends BusinessEvent {
  type: 'gas_optimization';
  currentGasPrice: number;
  recommendedGasPrice: number;
  savings: number;
  urgency: 'low' | 'medium' | 'high';
}

// ============================================================================
// MONITORING EVENTS
// ============================================================================

export interface MonitoringEvent {
  id: string;
  type: string;
  timestamp: Date;
  metric: string;
  value: number;
  threshold?: number;
}

export interface HighLatencyEvent extends MonitoringEvent {
  type: 'high_latency';
  metric: 'response_time';
  endpoint?: string;
  connectionId?: string;
}

export interface HighErrorRateEvent extends MonitoringEvent {
  type: 'high_error_rate';
  metric: 'error_rate';
  timeWindow: string;
  errorTypes: string[];
}

export interface ConnectionSpike extends MonitoringEvent {
  type: 'connection_spike';
  metric: 'active_connections';
  previousValue: number;
  increasePercent: number;
}

export interface MemoryUsageWarningEvent extends MonitoringEvent {
  type: 'memory_usage_warning';
  metric: 'memory_usage';
  usagePercent: number;
  availableMemory: number;
}

// ============================================================================
// ROOM EVENTS
// ============================================================================

export interface RoomEvent {
  roomId: string;
  roomType: string;
  timestamp: Date;
}

export interface RoomCreatedEvent extends RoomEvent {
  type: 'room_created';
  createdBy?: string;
  maxMembers?: number;
  config: Record<string, any>;
}

export interface RoomDestroyedEvent extends RoomEvent {
  type: 'room_destroyed';
  reason: 'no_members' | 'expired' | 'admin_action';
  memberCount: number;
  duration: number;
}

export interface MemberJoinedRoomEvent extends RoomEvent {
  type: 'member_joined_room';
  connectionId: string;
  userId?: string;
  memberCount: number;
}

export interface MemberLeftRoomEvent extends RoomEvent {
  type: 'member_left_room';
  connectionId: string;
  userId?: string;
  reason: 'disconnect' | 'unsubscribe' | 'kicked';
  memberCount: number;
}

export interface RoomBroadcastEvent extends RoomEvent {
  type: 'room_broadcast';
  message: WebSocketMessage;
  memberCount: number;
  deliveredCount: number;
  failedCount: number;
}

// ============================================================================
// EVENT UNION TYPES
// ============================================================================

export type ConnectionEventType = 
  | ClientConnectedEvent
  | ClientDisconnectedEvent
  | ClientAuthenticatedEvent
  | ClientAuthenticationFailedEvent;

export type SubscriptionEventType =
  | SubscriptionCreatedEvent
  | SubscriptionRemovedEvent
  | SubscriptionErrorEvent;

export type DataEventType =
  | PositionDataUpdateEvent
  | PriceDataUpdateEvent
  | PoolDataUpdateEvent;

export type SystemEventType =
  | ServerStartedEvent
  | ServerStoppedEvent
  | HealthCheckEvent
  | RateLimitExceededEvent
  | ErrorEvent;

export type BusinessEventType =
  | PositionOutOfRangeEvent
  | LargePositionChangeEvent
  | HighYieldOpportunityEvent
  | ImpermanentLossWarningEvent
  | GasOptimizationEvent;

export type MonitoringEventType =
  | HighLatencyEvent
  | HighErrorRateEvent
  | ConnectionSpike
  | MemoryUsageWarningEvent;

export type RoomEventType =
  | RoomCreatedEvent
  | RoomDestroyedEvent
  | MemberJoinedRoomEvent
  | MemberLeftRoomEvent
  | RoomBroadcastEvent;

export type WebSocketEvent = 
  | ConnectionEventType
  | SubscriptionEventType
  | DataEventType
  | SystemEventType
  | BusinessEventType
  | MonitoringEventType
  | RoomEventType;

// ============================================================================
// EVENT HANDLER INTERFACES
// ============================================================================

export interface EventHandler<T extends WebSocketEvent = WebSocketEvent> {
  handle(event: T): Promise<void> | void;
}

export interface EventListener {
  eventType: string;
  handler: EventHandler;
  priority?: number;
}

export interface EventEmitter {
  emit<T extends WebSocketEvent>(event: T): Promise<void>;
  on<T extends WebSocketEvent>(eventType: string, handler: EventHandler<T>): void;
  off<T extends WebSocketEvent>(eventType: string, handler: EventHandler<T>): void;
  once<T extends WebSocketEvent>(eventType: string, handler: EventHandler<T>): void;
  removeAllListeners(eventType?: string): void;
}

// ============================================================================
// EVENT FACTORY FUNCTIONS
// ============================================================================

export function createConnectionEvent<T extends ConnectionEventType>(
  type: T['type'],
  connectionId: string,
  data: Omit<T, 'type' | 'connectionId' | 'timestamp'>
): T {
  return {
    type,
    connectionId,
    timestamp: new Date(),
    ...data,
  } as T;
}

export function createSystemEvent<T extends SystemEventType>(
  type: T['type'],
  severity: T['severity'],
  data: Omit<T, 'type' | 'id' | 'timestamp' | 'severity'>
): T {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: new Date(),
    severity,
    ...data,
  } as T;
}

export function createBusinessEvent<T extends BusinessEventType>(
  type: T['type'],
  walletAddress: string,
  data: Omit<T, 'type' | 'id' | 'timestamp' | 'walletAddress'>
): T {
  return {
    id: `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: new Date(),
    walletAddress,
    ...data,
  } as T;
}

export function createRoomEvent<T extends RoomEventType>(
  type: T['type'],
  roomId: string,
  roomType: string,
  data: Omit<T, 'type' | 'roomId' | 'roomType' | 'timestamp'>
): T {
  return {
    type,
    roomId,
    roomType,
    timestamp: new Date(),
    ...data,
  } as T;
}

// ============================================================================
// EVENT UTILITIES
// ============================================================================

export function isConnectionEvent(event: WebSocketEvent): event is ConnectionEventType {
  return ['client_connected', 'client_disconnected', 'client_authenticated', 'client_authentication_failed']
    .includes(event.type);
}

export function isBusinessEvent(event: WebSocketEvent): event is BusinessEventType {
  return ['position_out_of_range', 'large_position_change', 'high_yield_opportunity', 
          'impermanent_loss_warning', 'gas_optimization'].includes(event.type);
}

export function isSystemEvent(event: WebSocketEvent): event is SystemEventType {
  return ['server_started', 'server_stopped', 'health_check', 'rate_limit_exceeded', 'error']
    .includes(event.type);
}

export function getEventPriority(event: WebSocketEvent): number {
  if (isSystemEvent(event)) {
    switch (event.severity) {
      case 'critical': return 1;
      case 'error': return 2;
      case 'warning': return 3;
      default: return 4;
    }
  }
  
  if (isBusinessEvent(event)) {
    return 2; // Business events are generally high priority
  }
  
  return 5; // Default priority for other events
}

export function shouldPersistEvent(event: WebSocketEvent): boolean {
  return isSystemEvent(event) || isBusinessEvent(event);
}