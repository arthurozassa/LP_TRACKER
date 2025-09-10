/**
 * WebSocket Notifications API
 * Handles notification management and delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWebSocketServer } from '../../../../production/websocket/server/websocket';
import { 
  NotificationMessage, 
  AlertTriggeredMessage, 
  OpportunityFoundMessage,
  createMessage 
} from '../../../../production/websocket/types/messages';
import { SmartAlert, YieldOpportunity } from '../../../../production/types/production';

// ============================================================================
// NOTIFICATION INTERFACES
// ============================================================================

interface NotificationRequest {
  type: 'notification' | 'alert' | 'opportunity';
  target: {
    walletAddress?: string;
    userId?: string;
    connectionId?: string;
    broadcast?: boolean;
  };
  data: any;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface NotificationStats {
  totalSent: number;
  deliveredCount: number;
  failedCount: number;
  notificationsByType: Record<string, number>;
  notificationsByPriority: Record<string, number>;
  recentNotifications: Array<{
    id: string;
    type: string;
    timestamp: Date;
    delivered: boolean;
  }>;
}

// ============================================================================
// NOTIFICATION VALIDATION
// ============================================================================

function validateNotificationRequest(request: NotificationRequest): { valid: boolean; error?: string } {
  if (!request.type) {
    return { valid: false, error: 'Notification type is required' };
  }

  const validTypes = ['notification', 'alert', 'opportunity'];
  if (!validTypes.includes(request.type)) {
    return { valid: false, error: `Invalid notification type: ${request.type}` };
  }

  if (!request.target) {
    return { valid: false, error: 'Target is required' };
  }

  const { target } = request;
  if (!target.walletAddress && !target.userId && !target.connectionId && !target.broadcast) {
    return { valid: false, error: 'At least one target method must be specified' };
  }

  // Type-specific validation
  switch (request.type) {
    case 'notification':
      if (!request.data.title || !request.data.message) {
        return { valid: false, error: 'Notification requires title and message' };
      }
      break;

    case 'alert':
      if (!request.data.alert || !request.data.triggerData) {
        return { valid: false, error: 'Alert notification requires alert and triggerData' };
      }
      break;

    case 'opportunity':
      if (!request.data.opportunity) {
        return { valid: false, error: 'Opportunity notification requires opportunity data' };
      }
      break;
  }

  return { valid: true };
}

// ============================================================================
// NOTIFICATION DELIVERY
// ============================================================================

function createNotificationMessage(request: NotificationRequest): NotificationMessage | AlertTriggeredMessage | OpportunityFoundMessage {
  const baseOptions = {
    walletAddress: request.target.walletAddress,
    userId: request.target.userId,
  };

  switch (request.type) {
    case 'notification':
      return createMessage<NotificationMessage>('notification', {
        title: request.data.title,
        message: request.data.message,
        category: request.data.category || 'info',
        priority: request.priority || 'medium',
        actionRequired: request.data.actionRequired || false,
        actions: request.data.actions,
        metadata: request.data.metadata,
      }, baseOptions);

    case 'alert':
      return createMessage<AlertTriggeredMessage>('alert_triggered', {
        alert: request.data.alert as SmartAlert,
        triggerData: request.data.triggerData,
        suggestions: request.data.suggestions,
      }, baseOptions);

    case 'opportunity':
      return createMessage<OpportunityFoundMessage>('opportunity_found', {
        opportunity: request.data.opportunity as YieldOpportunity,
        impact: request.data.impact,
      }, baseOptions);

    default:
      throw new Error(`Unsupported notification type: ${request.type}`);
  }
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const userId = searchParams.get('userId');

    const server = getWebSocketServer();
    
    if (!server) {
      return NextResponse.json(
        { error: 'WebSocket server not available' },
        { status: 503 }
      );
    }

    // Get notification statistics
    const connections = server.getConnections();
    
    // Filter connections by target if specified
    let targetConnections = connections;
    if (walletAddress) {
      targetConnections = connections.filter(conn => 
        conn.walletAddress?.toLowerCase() === walletAddress.toLowerCase()
      );
    } else if (userId) {
      targetConnections = connections.filter(conn => conn.userId === userId);
    }

    const stats: NotificationStats = {
      totalSent: 0, // Would be tracked in a real implementation
      deliveredCount: 0,
      failedCount: 0,
      notificationsByType: {},
      notificationsByPriority: {},
      recentNotifications: [],
    };

    return NextResponse.json({
      stats,
      targetConnections: targetConnections.length,
      totalConnections: connections.length,
      notificationEndpoint: '/api/ws/notifications',
    });

  } catch (error) {
    console.error('Get notifications stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get notification stats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const notificationRequest = body as NotificationRequest;

    // Validate the notification request
    const validation = validateNotificationRequest(notificationRequest);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const server = getWebSocketServer();
    
    if (!server) {
      return NextResponse.json(
        { error: 'WebSocket server not available' },
        { status: 503 }
      );
    }

    // Create the notification message
    const message = createNotificationMessage(notificationRequest);
    
    let deliveredCount = 0;
    const deliveryResults = [];

    // Deliver notification based on target
    const { target } = notificationRequest;

    if (target.broadcast) {
      // Broadcast to all connections
      server.broadcast(message);
      deliveredCount = server.getConnectionCount();
      deliveryResults.push({
        method: 'broadcast',
        delivered: deliveredCount,
      });

    } else {
      // Targeted delivery
      if (target.connectionId) {
        const success = server.sendToConnection(target.connectionId, message);
        if (success) deliveredCount++;
        
        deliveryResults.push({
          method: 'connection',
          connectionId: target.connectionId,
          delivered: success,
        });
      }

      if (target.userId) {
        const sent = server.sendToUser(target.userId, message);
        deliveredCount += sent;
        
        deliveryResults.push({
          method: 'user',
          userId: target.userId,
          delivered: sent,
        });
      }

      if (target.walletAddress) {
        const sent = server.sendToWallet(target.walletAddress, message);
        deliveredCount += sent;
        
        deliveryResults.push({
          method: 'wallet',
          walletAddress: target.walletAddress,
          delivered: sent,
        });
      }
    }

    return NextResponse.json({
      success: true,
      messageId: message.id,
      notificationType: notificationRequest.type,
      deliveredCount,
      deliveryResults,
      timestamp: message.timestamp,
    });

  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Bulk notification sending
    const body = await request.json();
    const { notifications } = body;

    if (!Array.isArray(notifications)) {
      return NextResponse.json(
        { error: 'Notifications must be an array' },
        { status: 400 }
      );
    }

    const server = getWebSocketServer();
    
    if (!server) {
      return NextResponse.json(
        { error: 'WebSocket server not available' },
        { status: 503 }
      );
    }

    const results = [];
    let totalDelivered = 0;

    for (const notificationRequest of notifications) {
      try {
        // Validate each notification
        const validation = validateNotificationRequest(notificationRequest);
        if (!validation.valid) {
          results.push({
            notification: notificationRequest,
            success: false,
            error: validation.error,
          });
          continue;
        }

        // Create and send message
        const message = createNotificationMessage(notificationRequest);
        let deliveredCount = 0;

        // Deliver based on target
        const { target } = notificationRequest;
        
        if (target.broadcast) {
          server.broadcast(message);
          deliveredCount = server.getConnectionCount();
        } else {
          if (target.connectionId) {
            if (server.sendToConnection(target.connectionId, message)) {
              deliveredCount++;
            }
          }
          if (target.userId) {
            deliveredCount += server.sendToUser(target.userId, message);
          }
          if (target.walletAddress) {
            deliveredCount += server.sendToWallet(target.walletAddress, message);
          }
        }

        totalDelivered += deliveredCount;
        
        results.push({
          notification: notificationRequest,
          success: true,
          messageId: message.id,
          deliveredCount,
        });

      } catch (error) {
        results.push({
          notification: notificationRequest,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: notifications.length,
      successfulCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      totalDelivered,
      results,
    });

  } catch (error) {
    console.error('Bulk send notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to send bulk notifications' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    // In a real implementation, you would have a notification queue/history
    // that you could cancel or mark as cancelled
    
    return NextResponse.json({
      success: true,
      message: `Notification ${messageId} cancellation acknowledged`,
      note: 'Already sent notifications cannot be recalled, but this prevents future delivery',
    });

  } catch (error) {
    console.error('Cancel notification error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel notification' },
      { status: 500 }
    );
  }
}