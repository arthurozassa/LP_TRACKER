/**
 * WebSocket Provider
 * React context provider for WebSocket connection and state management
 */

'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useWebSocket, WebSocketOptions } from '../hooks/useWebSocket';
import { WebSocketMessage, NotificationMessage } from '../../types/messages';

// ============================================================================
// CONTEXT INTERFACES
// ============================================================================

interface WebSocketContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectionId?: string;
  error?: string;

  // Connection methods
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  authenticate: (auth: any) => void;

  // Message methods
  sendMessage: (message: WebSocketMessage) => void;
  subscribe: (type: string, filters: Record<string, any>, options?: Record<string, any>) => void;
  unsubscribe: (subscriptionId: string) => void;

  // Listener methods
  addMessageListener: (messageType: any, handler: (message: WebSocketMessage) => void) => () => void;
  removeMessageListener: (messageType: any, handler: (message: WebSocketMessage) => void) => void;

  // Utility
  isReady: boolean;
  metrics: any;
}

interface WebSocketProviderProps {
  children: React.ReactNode;
  options?: WebSocketOptions;
  onNotification?: (notification: NotificationMessage) => void;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

// ============================================================================
// WEBSOCKET PROVIDER COMPONENT
// ============================================================================

export function WebSocketProvider({ children, options = {}, onNotification }: WebSocketProviderProps) {
  // WebSocket hook
  const webSocket = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
    autoConnect: true,
    debug: process.env.NODE_ENV === 'development',
    ...options,
  });

  // Local state for additional features
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  // ============================================================================
  // NOTIFICATION HANDLING
  // ============================================================================

  useEffect(() => {
    if (!webSocket.isReady) return;

    const handleNotification = (message: NotificationMessage) => {
      setNotifications(prev => [message, ...prev.slice(0, 99)]); // Keep last 100 notifications
      
      if (onNotification) {
        onNotification(message);
      }
    };

    // Register notification handlers
    const cleanupHandlers = [
      webSocket.addMessageListener('notification', handleNotification),
      webSocket.addMessageListener('alert_triggered', (message) => {
        // Convert alert to notification format for unified handling
        const notificationMessage: NotificationMessage = {
          ...message,
          type: 'notification',
          data: {
            title: 'Alert Triggered',
            message: `Alert for ${(message.data as any).alert?.name || 'position'} has been triggered`,
            category: 'warning' as const,
            priority: 'high' as const,
            actionRequired: true,
            metadata: message.data,
          },
        };
        handleNotification(notificationMessage);
      }),
      webSocket.addMessageListener('opportunity_found', (message) => {
        // Convert opportunity to notification format
        const notificationMessage: NotificationMessage = {
          ...message,
          type: 'notification',
          data: {
            title: 'New Opportunity',
            message: `New yield opportunity found on ${(message.data as any).opportunity?.protocol}`,
            category: 'success' as const,
            priority: 'medium' as const,
            actionRequired: false,
            metadata: message.data,
          },
        };
        handleNotification(notificationMessage);
      }),
    ];

    return () => {
      cleanupHandlers.forEach(cleanup => cleanup());
    };
  }, [webSocket.isReady, webSocket.addMessageListener, onNotification]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue = useMemo<WebSocketContextValue>(() => ({
    // Connection state
    isConnected: webSocket.isConnected,
    isConnecting: webSocket.isConnecting,
    isReconnecting: webSocket.isReconnecting,
    connectionId: webSocket.connectionId,
    error: webSocket.error,

    // Connection methods
    connect: webSocket.connect,
    disconnect: webSocket.disconnect,
    reconnect: webSocket.reconnect,
    authenticate: webSocket.authenticate,

    // Message methods
    sendMessage: webSocket.sendMessage,
    subscribe: webSocket.subscribe,
    unsubscribe: webSocket.unsubscribe,

    // Listener methods
    addMessageListener: webSocket.addMessageListener,
    removeMessageListener: webSocket.removeMessageListener,

    // Utility
    isReady: webSocket.isReady,
    metrics: webSocket.metrics,
  }), [webSocket]);

  // ============================================================================
  // CONNECTION STATUS LOGGING
  // ============================================================================

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('WebSocket Provider - Connection Status:', {
        isConnected: webSocket.isConnected,
        isConnecting: webSocket.isConnecting,
        isReconnecting: webSocket.isReconnecting,
        connectionId: webSocket.connectionId,
        error: webSocket.error,
      });
    }
  }, [
    webSocket.isConnected,
    webSocket.isConnecting,
    webSocket.isReconnecting,
    webSocket.connectionId,
    webSocket.error,
  ]);

  // ============================================================================
  // RENDER PROVIDER
  // ============================================================================

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ============================================================================
// CONTEXT HOOK
// ============================================================================

export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  
  return context;
}

// ============================================================================
// CONNECTION STATUS HOOK
// ============================================================================

export function useConnectionStatus() {
  const { isConnected, isConnecting, isReconnecting, error } = useWebSocketContext();

  const status = useMemo(() => {
    if (isConnecting) return 'connecting';
    if (isReconnecting) return 'reconnecting';
    if (isConnected) return 'connected';
    if (error) return 'error';
    return 'disconnected';
  }, [isConnected, isConnecting, isReconnecting, error]);

  return {
    status,
    isConnected,
    isConnecting,
    isReconnecting,
    error,
    statusText: getStatusText(status, error),
  };
}

// ============================================================================
// NOTIFICATION HOOK
// ============================================================================

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const webSocket = useWebSocketContext();

  useEffect(() => {
    if (!webSocket.isReady) return;

    const handleNotification = (message: NotificationMessage) => {
      setNotifications(prev => {
        const newNotifications = [message, ...prev];
        return newNotifications.slice(0, 100); // Keep last 100
      });
      
      setUnreadCount(prev => prev + 1);
    };

    const cleanupHandlers = [
      webSocket.addMessageListener('notification', handleNotification),
      webSocket.addMessageListener('alert_triggered', handleNotification),
      webSocket.addMessageListener('opportunity_found', handleNotification),
    ];

    return () => {
      cleanupHandlers.forEach(cleanup => cleanup());
    };
  }, [webSocket.isReady, webSocket.addMessageListener]);

  const markAsRead = (notificationId?: string) => {
    if (notificationId) {
      // Mark specific notification as read (would need to track read status)
    } else {
      // Mark all as read
      setUnreadCount(0);
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearNotifications,
    removeNotification,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getStatusText(status: string, error?: string): string {
  switch (status) {
    case 'connecting':
      return 'Connecting...';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'connected':
      return 'Connected';
    case 'error':
      return `Connection Error${error ? `: ${error}` : ''}`;
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown Status';
  }
}

// ============================================================================
// HOC FOR WEBSOCKET CONNECTION
// ============================================================================

export function withWebSocket<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function WebSocketWrappedComponent(props: P) {
    return (
      <WebSocketProvider>
        <Component {...props} />
      </WebSocketProvider>
    );
  };
}