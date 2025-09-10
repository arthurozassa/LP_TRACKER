/**
 * Notification Center Component
 * Displays and manages real-time notifications
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, CheckCircle, Info, TrendingUp, Clock, Filter } from 'lucide-react';
import { useNotifications, useWebSocketContext } from '../providers/WebSocketProvider';
import { NotificationMessage } from '../../types/messages';

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

interface NotificationCenterProps {
  maxVisible?: number;
  autoHide?: boolean;
  autoHideDelay?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

interface NotificationItemProps {
  notification: NotificationMessage;
  onClose: (id: string) => void;
  onAction?: (action: any) => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}

interface NotificationFilters {
  category?: 'all' | 'info' | 'warning' | 'error' | 'success';
  priority?: 'all' | 'low' | 'medium' | 'high' | 'critical';
  timeRange?: '1h' | '24h' | '7d' | 'all';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NotificationCenter({ 
  maxVisible = 5,
  autoHide = true,
  autoHideDelay = 5000,
  position = 'top-right',
  className = ''
}: NotificationCenterProps) {
  const { notifications, unreadCount, markAsRead, removeNotification } = useNotifications();
  const webSocket = useWebSocketContext();
  
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<NotificationFilters>({
    category: 'all',
    priority: 'all',
    timeRange: 'all',
  });

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    // Category filter
    if (filters.category !== 'all' && notification.data.category !== filters.category) {
      return false;
    }

    // Priority filter
    if (filters.priority !== 'all' && notification.data.priority !== filters.priority) {
      return false;
    }

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const notificationTime = new Date(notification.timestamp);
      const timeDiff = now.getTime() - notificationTime.getTime();

      switch (filters.timeRange) {
        case '1h':
          if (timeDiff > 60 * 60 * 1000) return false;
          break;
        case '24h':
          if (timeDiff > 24 * 60 * 60 * 1000) return false;
          break;
        case '7d':
          if (timeDiff > 7 * 24 * 60 * 60 * 1000) return false;
          break;
      }
    }

    return true;
  });

  const visibleNotifications = isExpanded 
    ? filteredNotifications 
    : filteredNotifications.slice(0, maxVisible);

  // Handle notification actions
  const handleNotificationAction = (action: any) => {
    if (action.type === 'link' && action.url) {
      window.open(action.url, '_blank');
    } else if (action.action) {
      // Handle custom actions
      console.log('Custom action:', action);
    }
  };

  // Auto-mark as read when notifications are viewed
  useEffect(() => {
    if (isExpanded && unreadCount > 0) {
      const timer = setTimeout(() => {
        markAsRead();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isExpanded, unreadCount, markAsRead]);

  if (!webSocket.isConnected && notifications.length === 0) {
    return null;
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 ${className}`}>
      {/* Notification Bell */}
      <div className="mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative p-2 bg-white border rounded-full shadow-lg hover:shadow-xl transition-shadow"
        >
          <Bell className="w-5 h-5 text-gray-700" />
          
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Panel */}
      {(isExpanded || visibleNotifications.length > 0) && (
        <div className={`
          bg-white border rounded-lg shadow-xl max-w-sm w-80
          ${isExpanded ? 'max-h-96' : ''}
          transition-all duration-200
        `}>
          {/* Header */}
          {isExpanded && (
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-2 text-xs">
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value as any }))}
                  className="px-2 py-1 border rounded text-xs"
                >
                  <option value="all">All Categories</option>
                  <option value="info">Info</option>
                  <option value="warning">Warnings</option>
                  <option value="error">Errors</option>
                  <option value="success">Success</option>
                </select>

                <select
                  value={filters.timeRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                  className="px-2 py-1 border rounded text-xs"
                >
                  <option value="all">All Time</option>
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24h</option>
                  <option value="7d">Last 7 days</option>
                </select>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className={`${isExpanded ? 'max-h-64 overflow-y-auto' : ''}`}>
            {visibleNotifications.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {visibleNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClose={removeNotification}
                    onAction={handleNotificationAction}
                    autoHide={autoHide && !isExpanded}
                    autoHideDelay={autoHideDelay}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No notifications</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {isExpanded && notifications.length > maxVisible && (
            <div className="p-3 border-t text-center text-xs text-gray-500">
              Showing {Math.min(maxVisible, filteredNotifications.length)} of {filteredNotifications.length} notifications
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NOTIFICATION ITEM COMPONENT
// ============================================================================

function NotificationItem({ 
  notification, 
  onClose, 
  onAction, 
  autoHide, 
  autoHideDelay = 5000 
}: NotificationItemProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide functionality
  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(notification.id), 300); // Wait for animation
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, notification.id, onClose]);

  const getIcon = () => {
    switch (notification.data.category) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getPriorityColor = () => {
    switch (notification.data.priority) {
      case 'critical':
        return 'border-l-red-500 bg-red-50';
      case 'high':
        return 'border-l-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-blue-500 bg-blue-50';
      case 'low':
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (!isVisible) return null;

  return (
    <div className={`
      relative p-3 border-l-4 transition-all duration-300
      ${getPriorityColor()}
      ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
    `}>
      {/* Close button */}
      <button
        onClick={() => onClose(notification.id)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Content */}
      <div className="pr-6">
        <div className="flex items-start gap-2">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {notification.data.title}
            </h4>
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
              {notification.data.message}
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{formatTime(new Date(notification.timestamp))}</span>
        </div>

        {/* Actions */}
        {notification.data.actions && notification.data.actions.length > 0 && (
          <div className="flex gap-2 mt-2">
            {notification.data.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => onAction?.(action)}
                className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-50 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// NOTIFICATION TOAST COMPONENT
// ============================================================================

export function NotificationToast({ 
  notification,
  onClose,
  position = 'top-right'
}: {
  notification: NotificationMessage;
  onClose: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const getIcon = () => {
    switch (notification.data.category) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <X className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className={`
      fixed ${positionClasses[position]} z-50 max-w-sm
      transform transition-all duration-300
      ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
    `}>
      <div className="bg-white border rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900">
              {notification.data.title}
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              {notification.data.message}
            </p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}