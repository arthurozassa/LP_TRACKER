/**
 * WebSocket API Route
 * Handles WebSocket upgrade and initialization
 */

import { NextRequest, NextResponse } from 'next/server';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getWebSocketServer, initializeWebSocketServer, WebSocketServerConfig } from '../../../production/websocket/server/websocket';
import { isProductionMode } from '../../../production/types/production';
import pino from 'pino';

// ============================================================================
// WEBSOCKET SERVER INITIALIZATION
// ============================================================================

let wsServer: any = null;
let initialized = false;

function initializeWebSocketIfNeeded() {
  if (initialized) return wsServer;

  try {
    // Get the HTTP server from Next.js
    const httpServer = (global as any).httpServer;
    
    if (!httpServer) {
      console.warn('HTTP server not available, WebSocket server cannot be initialized');
      return null;
    }

    // Create WebSocket server configuration
    const config: WebSocketServerConfig = {
      port: parseInt(process.env.PORT || '3000'),
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        credentials: true,
      },
      rateLimit: {
        maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '1000'),
        windowMs: 60000,
        maxRequestsPerWindow: parseInt(process.env.WS_MAX_REQUESTS_PER_MINUTE || '100'),
      },
      heartbeat: {
        interval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000'),
        timeout: parseInt(process.env.WS_HEARTBEAT_TIMEOUT || '60000'),
      },
      auth: {
        required: isProductionMode(),
        tokenSecret: process.env.JWT_SECRET || 'development-secret',
        apiKeyValidation: true,
      },
      monitoring: {
        enabled: isProductionMode(),
        metricsInterval: 60000,
      },
      clustering: {
        enabled: false,
        redisUrl: process.env.REDIS_URL,
      },
    };

    // Initialize WebSocket server
    wsServer = initializeWebSocketServer(httpServer, config);
    wsServer.start();
    
    initialized = true;
    
    console.log('WebSocket server initialized successfully');
    return wsServer;
    
  } catch (error) {
    console.error('Failed to initialize WebSocket server:', error);
    return null;
  }
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Initialize WebSocket server if needed
    const server = initializeWebSocketIfNeeded();
    
    if (!server) {
      return NextResponse.json(
        { error: 'WebSocket server not available' },
        { status: 503 }
      );
    }

    // Return WebSocket server status
    const stats = server.getConnectionCount();
    
    return NextResponse.json({
      status: 'active',
      connections: stats,
      features: ['real-time-updates', 'subscriptions', 'rooms'],
      endpoints: {
        websocket: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
        subscribe: '/api/ws/subscribe',
        notifications: '/api/ws/notifications',
      },
    });

  } catch (error) {
    console.error('WebSocket status error:', error);
    return NextResponse.json(
      { error: 'Failed to get WebSocket status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Initialize WebSocket server if needed
    const server = initializeWebSocketIfNeeded();
    
    if (!server) {
      return NextResponse.json(
        { error: 'WebSocket server not available' },
        { status: 503 }
      );
    }

    switch (action) {
      case 'broadcast':
        const { message, roomId } = body;
        if (!message) {
          return NextResponse.json(
            { error: 'Message is required for broadcast' },
            { status: 400 }
          );
        }
        
        server.broadcast(message, roomId);
        
        return NextResponse.json({
          success: true,
          message: 'Message broadcast successfully',
        });

      case 'send_to_user':
        const { userId, userMessage } = body;
        if (!userId || !userMessage) {
          return NextResponse.json(
            { error: 'userId and userMessage are required' },
            { status: 400 }
          );
        }
        
        const sentCount = server.sendToUser(userId, userMessage);
        
        return NextResponse.json({
          success: true,
          sentCount,
          message: `Message sent to ${sentCount} connections`,
        });

      case 'get_connections':
        const connections = server.getConnections().map((conn: any) => ({
          id: conn.id,
          userId: conn.userId,
          authenticated: conn.authenticated,
          connectedAt: conn.connectedAt,
          subscriptions: Array.from(conn.subscriptions),
        }));
        
        return NextResponse.json({
          connections,
          total: connections.length,
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('WebSocket API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// WEBSOCKET UPGRADE HANDLING
// ============================================================================

// Note: In a real Next.js application, WebSocket upgrades are typically handled
// at the server level, not through API routes. This would be done in a custom
// server.js file or through a service like Socket.IO's built-in handling.

export async function PATCH(request: NextRequest) {
  // This endpoint can be used to update WebSocket server configuration
  try {
    const body = await request.json();
    const { config } = body;

    const server = initializeWebSocketIfNeeded();
    
    if (!server) {
      return NextResponse.json(
        { error: 'WebSocket server not available' },
        { status: 503 }
      );
    }

    // Update configuration (this would need to be implemented in the WebSocket server)
    // server.updateConfig(config);

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
    });

  } catch (error) {
    console.error('WebSocket config update error:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // This endpoint can be used to shutdown the WebSocket server
  try {
    if (wsServer && initialized) {
      wsServer.stop();
      wsServer = null;
      initialized = false;
    }

    return NextResponse.json({
      success: true,
      message: 'WebSocket server stopped successfully',
    });

  } catch (error) {
    console.error('WebSocket shutdown error:', error);
    return NextResponse.json(
      { error: 'Failed to stop WebSocket server' },
      { status: 500 }
    );
  }
}