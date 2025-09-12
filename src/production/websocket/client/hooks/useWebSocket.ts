/**
 * WebSocket Client Hook
 * Main hook for WebSocket connection and message handling
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, MessageType, createMessage } from '../../types/messages';
import { ReconnectionManager, createDefaultReconnectionConfig } from '../../utils/reconnect';

// ============================================================================
// WEBSOCKET HOOK INTERFACES
// ============================================================================

export interface WebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  auth?: {
    token?: string;
    apiKey?: string;
    walletAddress?: string;
    signature?: string;
  };
  reconnection?: {
    enabled?: boolean;
    maxAttempts?: number;
    initialDelay?: number;
  };
  debug?: boolean;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectionId?: string;
  error?: string;
  lastConnectedAt?: Date;
  reconnectAttempts: number;
}

export interface WebSocketMetrics {
  messagesReceived: number;
  messagesSent: number;
  connectionCount: number;
  averageLatency: number;
  lastMessageAt?: Date;
}

// ============================================================================
// WEBSOCKET HOOK
// ============================================================================

export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
    autoConnect = true,
    auth,
    reconnection,
    debug = false,
  } = options;

  // State
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempts: 0,
  });

  const [metrics, setMetrics] = useState<WebSocketMetrics>({
    messagesReceived: 0,
    messagesSent: 0,
    connectionCount: 0,
    averageLatency: 0,
  });

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const reconnectionManagerRef = useRef<ReconnectionManager | null>(null);
  const messageHandlersRef = useRef<Map<MessageType, Set<(message: WebSocketMessage) => void>>>(new Map());
  const latencyMeasurementsRef = useRef<number[]>([]);

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) {
      if (debug) console.log('WebSocket already connected');
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: undefined }));

    try {
      // Create Socket.IO client
      const socket = io(url, {
        autoConnect: false,
        reconnection: false, // We handle reconnection ourselves
        transports: ['websocket', 'polling'],
        timeout: 20000,
      });

      socketRef.current = socket;

      // Set up event handlers
      setupSocketEventHandlers(socket);

      // Connect
      socket.connect();

      if (debug) console.log('WebSocket connecting to:', url);

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      }));
      
      if (debug) console.error('WebSocket connection error:', error);
    }
  }, [url, debug]);

  const disconnect = useCallback(() => {
    if (reconnectionManagerRef.current) {
      reconnectionManagerRef.current.stopReconnection();
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      connectionId: undefined,
    }));

    if (debug) console.log('WebSocket disconnected');
  }, [debug]);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 1000);
  }, [connect, disconnect]);

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!socketRef.current?.connected) {
      throw new Error('WebSocket not connected');
    }

    const startTime = Date.now();
    
    socketRef.current.emit('message', message, () => {
      // Acknowledgment callback
      const latency = Date.now() - startTime;
      latencyMeasurementsRef.current.push(latency);
      
      // Keep only recent measurements
      if (latencyMeasurementsRef.current.length > 100) {
        latencyMeasurementsRef.current = latencyMeasurementsRef.current.slice(-100);
      }

      // Update metrics
      setMetrics(prev => ({
        ...prev,
        messagesSent: prev.messagesSent + 1,
        averageLatency: latencyMeasurementsRef.current.reduce((sum, lat) => sum + lat, 0) / 
                       latencyMeasurementsRef.current.length,
      }));
    });

    if (debug) console.log('WebSocket message sent:', message);
  }, [debug]);

  const subscribe = useCallback((
    type: string,
    filters: Record<string, any>,
    options?: Record<string, any>
  ) => {
    const subscriptionMessage = createMessage('subscribe', {
      subscriptions: [{
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type as any,
        filters: filters as any,
        options: options as any,
      }],
    });

    sendMessage(subscriptionMessage);
  }, [sendMessage]);

  const unsubscribe = useCallback((subscriptionId: string) => {
    const unsubscribeMessage = createMessage('unsubscribe', {
      subscriptions: [subscriptionId],
    });

    sendMessage(unsubscribeMessage);
  }, [sendMessage]);

  // ============================================================================
  // MESSAGE LISTENERS
  // ============================================================================

  const addMessageListener = useCallback((
    messageType: MessageType,
    handler: (message: WebSocketMessage) => void
  ) => {
    if (!messageHandlersRef.current.has(messageType)) {
      messageHandlersRef.current.set(messageType, new Set());
    }
    
    messageHandlersRef.current.get(messageType)!.add(handler);

    // Return cleanup function
    return () => {
      const handlers = messageHandlersRef.current.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageHandlersRef.current.delete(messageType);
        }
      }
    };
  }, []);

  const removeMessageListener = useCallback((
    messageType: MessageType,
    handler: (message: WebSocketMessage) => void
  ) => {
    const handlers = messageHandlersRef.current.get(messageType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        messageHandlersRef.current.delete(messageType);
      }
    }
  }, []);

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  const authenticate = useCallback((authData: NonNullable<WebSocketOptions['auth']>) => {
    const authMessage = createMessage('authenticate', authData);
    sendMessage(authMessage);
  }, [sendMessage]);

  // ============================================================================
  // SOCKET EVENT HANDLERS
  // ============================================================================

  const setupSocketEventHandlers = useCallback((socket: Socket) => {
    socket.on('connect', () => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        isReconnecting: false,
        lastConnectedAt: new Date(),
        error: undefined,
      }));

      if (reconnectionManagerRef.current) {
        reconnectionManagerRef.current.handleConnectionRestored();
      }

      // Auto-authenticate if credentials provided
      if (auth) {
        authenticate(auth);
      }

      if (debug) console.log('WebSocket connected');
    });

    socket.on('disconnect', (reason) => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionId: undefined,
      }));

      // Handle reconnection
      if (reconnectionManagerRef.current && reason !== 'io client disconnect') {
        reconnectionManagerRef.current.handleConnectionLost(reason);
      }

      if (debug) console.log('WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message,
      }));

      if (debug) console.error('WebSocket connection error:', error);
    });

    socket.on('message', (message: WebSocketMessage) => {
      // Update metrics
      setMetrics(prev => ({
        ...prev,
        messagesReceived: prev.messagesReceived + 1,
        lastMessageAt: new Date(),
      }));

      // Handle connection established message
      if (message.type === 'connection_established') {
        setState(prev => ({
          ...prev,
          connectionId: (message.data as any).connectionId,
        }));
      }

      // Route to specific handlers
      const handlers = messageHandlersRef.current.get(message.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            if (debug) console.error('Message handler error:', error);
          }
        });
      }

      if (debug) console.log('WebSocket message received:', message);
    });

    socket.on('error', (error) => {
      if (debug) console.error('WebSocket error:', error);
    });
  }, [auth, authenticate, debug]);

  // ============================================================================
  // RECONNECTION SETUP
  // ============================================================================

  useEffect(() => {
    if (reconnection?.enabled !== false) {
      const reconnectionManager = new ReconnectionManager({
        ...createDefaultReconnectionConfig(),
        ...reconnection,
      });

      reconnectionManager.onReconnectCallback(async () => {
        try {
          await connect();
          return true;
        } catch {
          return false;
        }
      });

      reconnectionManager.onConnectionLostCallback((reason) => {
        setState(prev => ({ ...prev, isReconnecting: true }));
      });

      reconnectionManager.onReconnectFailedCallback((attempt) => {
        setState(prev => ({ ...prev, reconnectAttempts: attempt.attempt }));
      });

      reconnectionManagerRef.current = reconnectionManager;
    }

    return () => {
      if (reconnectionManagerRef.current) {
        reconnectionManagerRef.current.cleanup();
      }
    };
  }, [connect, reconnection]);

  // ============================================================================
  // AUTO CONNECT
  // ============================================================================

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    ...state,
    metrics,

    // Connection methods
    connect,
    disconnect,
    reconnect,

    // Message methods
    sendMessage,
    subscribe,
    unsubscribe,
    authenticate,

    // Listener methods
    addMessageListener,
    removeMessageListener,

    // Utility methods
    isReady: state.isConnected && !state.isConnecting,
    getSocket: () => socketRef.current,
    getConnectionId: () => state.connectionId,
  };
}