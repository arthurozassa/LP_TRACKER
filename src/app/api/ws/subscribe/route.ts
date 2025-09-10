/**
 * WebSocket Subscription Management API
 * Handles subscription creation, management, and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWebSocketServer } from '../../../../production/websocket/server/websocket';
import { validateWalletAddress } from '../../../../production/websocket/server/auth';
import { ChainType, ProtocolType } from '../../../../types';

// ============================================================================
// SUBSCRIPTION VALIDATION
// ============================================================================

interface SubscriptionRequest {
  type: 'positions' | 'prices' | 'portfolio' | 'analytics' | 'notifications';
  filters: {
    walletAddress?: string;
    chains?: ChainType[];
    protocols?: ProtocolType[];
    tokens?: string[];
    pools?: string[];
  };
  options?: {
    updateFrequency?: number;
    includeHistorical?: boolean;
  };
}

function validateSubscription(subscription: SubscriptionRequest): { valid: boolean; error?: string } {
  // Basic validation
  if (!subscription.type) {
    return { valid: false, error: 'Subscription type is required' };
  }

  const validTypes = ['positions', 'prices', 'portfolio', 'analytics', 'notifications'];
  if (!validTypes.includes(subscription.type)) {
    return { valid: false, error: `Invalid subscription type: ${subscription.type}` };
  }

  // Type-specific validation
  switch (subscription.type) {
    case 'positions':
    case 'portfolio':
      if (!subscription.filters.walletAddress) {
        return { valid: false, error: `${subscription.type} subscription requires walletAddress` };
      }
      
      const walletValidation = validateWalletAddress(subscription.filters.walletAddress);
      if (!walletValidation.valid) {
        return { valid: false, error: walletValidation.error };
      }
      break;

    case 'prices':
      if (!subscription.filters.tokens && !subscription.filters.chains) {
        return { valid: false, error: 'Price subscription requires either tokens or chains filter' };
      }
      break;

    case 'analytics':
      // Analytics subscriptions might not need specific filters
      break;

    case 'notifications':
      if (!subscription.filters.walletAddress) {
        return { valid: false, error: 'Notification subscription requires walletAddress' };
      }
      break;
  }

  // Validate update frequency
  if (subscription.options?.updateFrequency) {
    if (subscription.options.updateFrequency < 1000) {
      return { valid: false, error: 'Update frequency must be at least 1000ms' };
    }
    if (subscription.options.updateFrequency > 60000) {
      return { valid: false, error: 'Update frequency cannot exceed 60000ms' };
    }
  }

  return { valid: true };
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const connectionId = searchParams.get('connectionId');

    const server = getWebSocketServer();
    
    if (!server) {
      return NextResponse.json(
        { error: 'WebSocket server not available' },
        { status: 503 }
      );
    }

    // Get subscriptions for a specific connection
    if (connectionId) {
      const connection = server.getConnection(connectionId);
      if (!connection) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        connectionId,
        subscriptions: Array.from(connection.subscriptions),
        count: connection.subscriptions.size,
      });
    }

    // Get all active subscriptions (summary)
    const connections = server.getConnections();
    const subscriptionSummary = {
      totalConnections: connections.length,
      totalSubscriptions: connections.reduce((sum, conn) => sum + conn.subscriptions.size, 0),
      subscriptionsByType: {} as Record<string, number>,
      connectionsByWallet: {} as Record<string, number>,
    };

    // Count subscriptions by type (this is simplified - would need more detailed tracking)
    connections.forEach(conn => {
      if (conn.walletAddress) {
        subscriptionSummary.connectionsByWallet[conn.walletAddress] = 
          (subscriptionSummary.connectionsByWallet[conn.walletAddress] || 0) + 1;
      }
    });

    return NextResponse.json(subscriptionSummary);

  } catch (error) {
    console.error('Get subscriptions error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptions, connectionId } = body;

    if (!Array.isArray(subscriptions)) {
      return NextResponse.json(
        { error: 'Subscriptions must be an array' },
        { status: 400 }
      );
    }

    // Validate all subscriptions
    const validationResults = subscriptions.map(sub => ({
      subscription: sub,
      ...validateSubscription(sub),
    }));

    const invalidSubscriptions = validationResults.filter(r => !r.valid);
    if (invalidSubscriptions.length > 0) {
      return NextResponse.json({
        error: 'Invalid subscriptions',
        details: invalidSubscriptions.map(r => ({
          subscription: r.subscription,
          error: r.error,
        })),
      }, { status: 400 });
    }

    const server = getWebSocketServer();
    
    if (!server) {
      return NextResponse.json(
        { error: 'WebSocket server not available' },
        { status: 503 }
      );
    }

    // If connectionId is provided, add subscriptions to that specific connection
    if (connectionId) {
      const connection = server.getConnection(connectionId);
      if (!connection) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        );
      }

      // Create subscription requests with generated IDs
      const subscriptionRequests = subscriptions.map(sub => ({
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: sub.type,
        filters: sub.filters,
        options: sub.options,
      }));

      // Process subscriptions through the message handler
      // This would typically be done through WebSocket messages, but we're providing a REST interface
      const results = subscriptionRequests.map(subReq => {
        try {
          // Add to connection subscriptions
          connection.subscriptions.add(subReq.id);
          return {
            id: subReq.id,
            type: subReq.type,
            status: 'active',
          };
        } catch (error) {
          return {
            id: subReq.id,
            type: subReq.type,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      return NextResponse.json({
        success: true,
        subscriptions: results,
        connectionId,
      });
    }

    // If no connectionId, return information about how to subscribe
    return NextResponse.json({
      message: 'To create subscriptions, provide a connectionId or use WebSocket connection',
      validSubscriptionTypes: ['positions', 'prices', 'portfolio', 'analytics', 'notifications'],
      exampleSubscription: {
        type: 'positions',
        filters: {
          walletAddress: '0x742d35Cc6567C6532465552A61947e3D47b1F4E0',
          chains: ['ethereum'],
        },
        options: {
          updateFrequency: 5000,
          includeHistorical: false,
        },
      },
    });

  } catch (error) {
    console.error('Create subscriptions error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscriptions' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');
    const connectionId = searchParams.get('connectionId');

    const server = getWebSocketServer();
    
    if (!server) {
      return NextResponse.json(
        { error: 'WebSocket server not available' },
        { status: 503 }
      );
    }

    if (!subscriptionId && !connectionId) {
      return NextResponse.json(
        { error: 'Either subscriptionId or connectionId is required' },
        { status: 400 }
      );
    }

    // Remove specific subscription
    if (subscriptionId) {
      let removed = false;
      
      // Find the connection with this subscription and remove it
      const connections = server.getConnections();
      for (const connection of connections) {
        if (connection.subscriptions.has(subscriptionId)) {
          connection.subscriptions.delete(subscriptionId);
          removed = true;
          break;
        }
      }

      if (removed) {
        return NextResponse.json({
          success: true,
          message: `Subscription ${subscriptionId} removed`,
        });
      } else {
        return NextResponse.json(
          { error: 'Subscription not found' },
          { status: 404 }
        );
      }
    }

    // Remove all subscriptions for a connection
    if (connectionId) {
      const connection = server.getConnection(connectionId);
      if (!connection) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        );
      }

      const subscriptionCount = connection.subscriptions.size;
      connection.subscriptions.clear();

      return NextResponse.json({
        success: true,
        message: `Removed ${subscriptionCount} subscriptions from connection ${connectionId}`,
        removedCount: subscriptionCount,
      });
    }

  } catch (error) {
    console.error('Delete subscriptions error:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscriptions' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionId, updates } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId is required' },
        { status: 400 }
      );
    }

    if (!updates) {
      return NextResponse.json(
        { error: 'updates object is required' },
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

    // Find connection with this subscription
    const connections = server.getConnections();
    let foundConnection = null;

    for (const connection of connections) {
      if (connection.subscriptions.has(subscriptionId)) {
        foundConnection = connection;
        break;
      }
    }

    if (!foundConnection) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // In a real implementation, you would update the subscription details
    // For now, we'll just acknowledge the update request
    return NextResponse.json({
      success: true,
      subscriptionId,
      updates: updates,
      message: 'Subscription update acknowledged (implementation needed)',
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}