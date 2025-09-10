/**
 * WebSocket Message Types and Interfaces
 * Defines all message structures for real-time communication
 */

import { Position, ScanResults, ChainType, ProtocolType } from '../../../types';
import { YieldOpportunity, SmartAlert, AnalyticsJob } from '../../types/production';

// ============================================================================
// BASE MESSAGE TYPES
// ============================================================================

export interface BaseMessage {
  id: string;
  timestamp: Date;
  type: MessageType;
  userId?: string;
  walletAddress?: string;
}

export type MessageType = 
  // Connection
  | 'connection_established'
  | 'connection_error'
  | 'heartbeat'
  
  // Authentication
  | 'authenticate'
  | 'authentication_success'
  | 'authentication_failed'
  
  // Subscriptions
  | 'subscribe'
  | 'unsubscribe'
  | 'subscription_confirmed'
  | 'subscription_error'
  
  // Position Updates
  | 'position_update'
  | 'position_created'
  | 'position_removed'
  | 'positions_batch_update'
  
  // Price Updates
  | 'price_update'
  | 'price_batch_update'
  
  // Portfolio Updates
  | 'portfolio_update'
  | 'pnl_update'
  | 'analytics_update'
  
  // Job Status
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  
  // Notifications
  | 'notification'
  | 'alert_triggered'
  | 'opportunity_found'
  
  // Room Management
  | 'join_room'
  | 'leave_room'
  | 'room_joined'
  | 'room_left'
  | 'room_error';

// ============================================================================
// CONNECTION MESSAGES
// ============================================================================

export interface ConnectionEstablishedMessage extends BaseMessage {
  type: 'connection_established';
  data: {
    connectionId: string;
    serverTime: Date;
    features: string[];
  };
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
  data: {
    serverTime: Date;
    connectionId: string;
  };
}

export interface ConnectionErrorMessage extends BaseMessage {
  type: 'connection_error';
  data: {
    error: string;
    code: string;
    retryable: boolean;
  };
}

// ============================================================================
// AUTHENTICATION MESSAGES
// ============================================================================

export interface AuthenticateMessage extends BaseMessage {
  type: 'authenticate';
  data: {
    token?: string;
    apiKey?: string;
    walletAddress?: string;
    signature?: string;
  };
}

export interface AuthenticationSuccessMessage extends BaseMessage {
  type: 'authentication_success';
  data: {
    userId: string;
    permissions: string[];
    rateLimit: {
      requestsPerMinute: number;
      remaining: number;
    };
  };
}

export interface AuthenticationFailedMessage extends BaseMessage {
  type: 'authentication_failed';
  data: {
    error: string;
    code: string;
  };
}

// ============================================================================
// SUBSCRIPTION MESSAGES
// ============================================================================

export interface SubscribeMessage extends BaseMessage {
  type: 'subscribe';
  data: {
    subscriptions: SubscriptionRequest[];
  };
}

export interface UnsubscribeMessage extends BaseMessage {
  type: 'unsubscribe';
  data: {
    subscriptions: string[]; // subscription IDs
  };
}

export interface SubscriptionRequest {
  id: string;
  type: SubscriptionType;
  filters: SubscriptionFilters;
  options?: SubscriptionOptions;
}

export type SubscriptionType = 
  | 'positions'
  | 'prices' 
  | 'portfolio'
  | 'jobs'
  | 'notifications'
  | 'analytics';

export interface SubscriptionFilters {
  walletAddress?: string;
  chains?: ChainType[];
  protocols?: ProtocolType[];
  pools?: string[];
  tokens?: string[];
  positionIds?: string[];
  jobIds?: string[];
}

export interface SubscriptionOptions {
  updateFrequency?: number; // milliseconds
  includeHistorical?: boolean;
  maxUpdatesPerSecond?: number;
}

export interface SubscriptionConfirmedMessage extends BaseMessage {
  type: 'subscription_confirmed';
  data: {
    subscriptions: {
      id: string;
      status: 'active' | 'failed';
      error?: string;
    }[];
  };
}

// ============================================================================
// POSITION UPDATE MESSAGES
// ============================================================================

export interface PositionUpdateMessage extends BaseMessage {
  type: 'position_update';
  data: {
    position: RealTimePosition;
    changes: PositionChange[];
  };
}

export interface PositionCreatedMessage extends BaseMessage {
  type: 'position_created';
  data: {
    position: RealTimePosition;
  };
}

export interface PositionRemovedMessage extends BaseMessage {
  type: 'position_removed';
  data: {
    positionId: string;
    reason: 'closed' | 'liquidated' | 'expired';
  };
}

export interface PositionsBatchUpdateMessage extends BaseMessage {
  type: 'positions_batch_update';
  data: {
    positions: RealTimePosition[];
    totalPositions: number;
    updatedAt: Date;
  };
}

export interface RealTimePosition extends Position {
  lastUpdate: Date;
  changes: PositionChange[];
  realTimeData: {
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
  };
  rangeStatus: {
    inRange: boolean;
    distanceToRange: number;
    timeOutOfRange?: number;
  };
  pnl: {
    unrealized: number;
    realized: number;
    total: number;
    percentage: number;
  };
}

export interface PositionChange {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  source: string;
}

// ============================================================================
// PRICE UPDATE MESSAGES
// ============================================================================

export interface PriceUpdateMessage extends BaseMessage {
  type: 'price_update';
  data: {
    token: string;
    price: number;
    change24h: number;
    volume24h: number;
    marketCap?: number;
    timestamp: Date;
  };
}

export interface PriceBatchUpdateMessage extends BaseMessage {
  type: 'price_batch_update';
  data: {
    prices: {
      token: string;
      price: number;
      change24h: number;
      volume24h: number;
      timestamp: Date;
    }[];
    updatedAt: Date;
  };
}

// ============================================================================
// PORTFOLIO UPDATE MESSAGES
// ============================================================================

export interface PortfolioUpdateMessage extends BaseMessage {
  type: 'portfolio_update';
  data: {
    totalValue: number;
    totalPnL: number;
    totalPnLPercentage: number;
    positionCount: number;
    protocolDistribution: {
      protocol: ProtocolType;
      value: number;
      percentage: number;
    }[];
    chainDistribution: {
      chain: ChainType;
      value: number;
      percentage: number;
    }[];
    lastUpdate: Date;
  };
}

export interface PnLUpdateMessage extends BaseMessage {
  type: 'pnl_update';
  data: {
    positionId?: string;
    unrealizedPnL: number;
    realizedPnL: number;
    totalPnL: number;
    pnlPercentage: number;
    dailyPnL: number;
    timestamp: Date;
  };
}

export interface AnalyticsUpdateMessage extends BaseMessage {
  type: 'analytics_update';
  data: {
    metrics: {
      sharpeRatio: number;
      maxDrawdown: number;
      volatility: number;
      winRate: number;
      avgHoldTime: number;
    };
    trends: {
      performance7d: number;
      performance30d: number;
      volumeChange: number;
      positionCount: number;
    };
    timestamp: Date;
  };
}

// ============================================================================
// JOB STATUS MESSAGES
// ============================================================================

export interface JobStartedMessage extends BaseMessage {
  type: 'job_started';
  data: {
    jobId: string;
    type: string;
    estimatedDuration?: number;
    steps?: string[];
  };
}

export interface JobProgressMessage extends BaseMessage {
  type: 'job_progress';
  data: {
    jobId: string;
    progress: number; // 0-100
    currentStep: string;
    completedSteps: string[];
    remainingSteps: string[];
    estimatedTimeRemaining?: number;
  };
}

export interface JobCompletedMessage extends BaseMessage {
  type: 'job_completed';
  data: {
    jobId: string;
    result: any;
    duration: number;
    completedAt: Date;
  };
}

export interface JobFailedMessage extends BaseMessage {
  type: 'job_failed';
  data: {
    jobId: string;
    error: string;
    code: string;
    retryable: boolean;
    failedAt: Date;
  };
}

// ============================================================================
// NOTIFICATION MESSAGES
// ============================================================================

export interface NotificationMessage extends BaseMessage {
  type: 'notification';
  data: {
    title: string;
    message: string;
    category: 'info' | 'warning' | 'error' | 'success';
    priority: 'low' | 'medium' | 'high' | 'critical';
    actionRequired: boolean;
    actions?: NotificationAction[];
    metadata?: Record<string, any>;
  };
}

export interface AlertTriggeredMessage extends BaseMessage {
  type: 'alert_triggered';
  data: {
    alert: SmartAlert;
    triggerData: {
      currentValue: number;
      threshold: number;
      condition: string;
    };
    suggestions?: string[];
  };
}

export interface OpportunityFoundMessage extends BaseMessage {
  type: 'opportunity_found';
  data: {
    opportunity: YieldOpportunity;
    impact: {
      potentialIncrease: number;
      riskLevel: string;
      timeframe: string;
    };
  };
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'button' | 'link';
  url?: string;
  action?: string;
}

// ============================================================================
// ROOM MANAGEMENT MESSAGES
// ============================================================================

export interface JoinRoomMessage extends BaseMessage {
  type: 'join_room';
  data: {
    roomId: string;
    roomType: RoomType;
    metadata?: Record<string, any>;
  };
}

export interface LeaveRoomMessage extends BaseMessage {
  type: 'leave_room';
  data: {
    roomId: string;
  };
}

export interface RoomJoinedMessage extends BaseMessage {
  type: 'room_joined';
  data: {
    roomId: string;
    members: number;
    permissions: string[];
  };
}

export interface RoomLeftMessage extends BaseMessage {
  type: 'room_left';
  data: {
    roomId: string;
  };
}

export interface RoomErrorMessage extends BaseMessage {
  type: 'room_error';
  data: {
    roomId: string;
    error: string;
    code: string;
  };
}

export type RoomType = 
  | 'wallet'        // Wallet-specific updates
  | 'protocol'      // Protocol-specific updates  
  | 'chain'         // Chain-specific updates
  | 'global'        // Global market updates
  | 'analytics'     // Analytics and insights
  | 'alerts';       // Alert and notification updates

// ============================================================================
// MESSAGE UNION TYPE
// ============================================================================

export type WebSocketMessage = 
  | ConnectionEstablishedMessage
  | HeartbeatMessage
  | ConnectionErrorMessage
  | AuthenticateMessage
  | AuthenticationSuccessMessage
  | AuthenticationFailedMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | SubscriptionConfirmedMessage
  | PositionUpdateMessage
  | PositionCreatedMessage
  | PositionRemovedMessage
  | PositionsBatchUpdateMessage
  | PriceUpdateMessage
  | PriceBatchUpdateMessage
  | PortfolioUpdateMessage
  | PnLUpdateMessage
  | AnalyticsUpdateMessage
  | JobStartedMessage
  | JobProgressMessage
  | JobCompletedMessage
  | JobFailedMessage
  | NotificationMessage
  | AlertTriggeredMessage
  | OpportunityFoundMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | RoomJoinedMessage
  | RoomLeftMessage
  | RoomErrorMessage;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createMessage<T extends WebSocketMessage>(
  type: T['type'],
  data: T['data'],
  options?: {
    userId?: string;
    walletAddress?: string;
  }
): T {
  return {
    id: generateMessageId(),
    timestamp: new Date(),
    type,
    data,
    ...options,
  } as T;
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isValidMessage(message: any): message is WebSocketMessage {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.id === 'string' &&
    message.timestamp &&
    typeof message.type === 'string' &&
    message.data !== undefined
  );
}

export function getMessageCategory(type: MessageType): string {
  if (['connection_established', 'connection_error', 'heartbeat'].includes(type)) {
    return 'connection';
  }
  if (['authenticate', 'authentication_success', 'authentication_failed'].includes(type)) {
    return 'authentication';
  }
  if (['subscribe', 'unsubscribe', 'subscription_confirmed', 'subscription_error'].includes(type)) {
    return 'subscription';
  }
  if (type.includes('position')) return 'positions';
  if (type.includes('price')) return 'prices';
  if (type.includes('portfolio') || type.includes('pnl') || type.includes('analytics')) return 'portfolio';
  if (type.includes('job')) return 'jobs';
  if (type.includes('notification') || type.includes('alert') || type.includes('opportunity')) return 'notifications';
  if (type.includes('room')) return 'rooms';
  
  return 'unknown';
}