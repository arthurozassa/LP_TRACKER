'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  Target, 
  Zap, 
  X,
  CheckCircle,
  Clock,
  Filter,
  Settings,
  Volume2,
  VolumeX
} from 'lucide-react';
import { SmartAlert, Position, TimeSeriesDataPoint } from '../../types';

interface SmartAlertsProps {
  positions: Position[];
  portfolioHistory: TimeSeriesDataPoint[];
  className?: string;
  onAlertAction?: (alertId: string, action: 'dismiss' | 'snooze' | 'act') => void;
}

type AlertFilter = 'all' | 'critical' | 'warning' | 'info' | 'active' | 'dismissed';
type AlertSort = 'newest' | 'severity' | 'type';

interface AlertSettings {
  enabled: boolean;
  rangeExitThreshold: number; // Hours before alerting
  yieldDropThreshold: number; // Percentage drop
  highILThreshold: number; // Percentage IL
  soundEnabled: boolean;
  emailEnabled: boolean;
}

const SmartAlerts: React.FC<SmartAlertsProps> = ({
  positions,
  portfolioHistory,
  className = '',
  onAlertAction
}) => {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [filter, setFilter] = useState<AlertFilter>('active');
  const [sort, setSort] = useState<AlertSort>('severity');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AlertSettings>({
    enabled: true,
    rangeExitThreshold: 2, // 2 hours
    yieldDropThreshold: 10, // 10%
    highILThreshold: 5, // 5%
    soundEnabled: true,
    emailEnabled: false
  });

  // Generate alerts based on current positions and history
  const generateAlerts = useMemo(() => {
    if (!settings.enabled || !positions.length) return [];
    
    const newAlerts: SmartAlert[] = [];
    const now = new Date().toISOString();

    // 1. Range Exit Alerts
    positions.forEach(position => {
      if (!position.inRange) {
        newAlerts.push({
          id: `range_exit_${position.id}`,
          type: 'range_exit',
          severity: 'warning',
          title: 'Position Out of Range',
          message: `${position.pool} position is out of range. Consider rebalancing to resume fee collection.`,
          positionId: position.id,
          protocol: position.protocol,
          actionRequired: true,
          createdAt: now,
          dismissed: false
        });
      }
    });

    // 2. High Impermanent Loss Alerts
    positions.forEach(position => {
      const il = position.impermanentLoss || 0;
      if (Math.abs(il) > settings.highILThreshold) {
        newAlerts.push({
          id: `high_il_${position.id}`,
          type: 'high_il',
          severity: Math.abs(il) > 10 ? 'critical' : 'warning',
          title: 'High Impermanent Loss Detected',
          message: `${position.pool} has ${Math.abs(il).toFixed(2)}% impermanent loss. Monitor token price ratio.`,
          positionId: position.id,
          protocol: position.protocol,
          actionRequired: Math.abs(il) > 10,
          createdAt: now,
          dismissed: false
        });
      }
    });

    // 3. Yield Drop Alerts
    positions.forEach(position => {
      // Mock: Check if APR dropped significantly (would need historical data)
      const avgMarketAPR = 15; // Mock average market APR
      if (position.apr < avgMarketAPR * (1 - settings.yieldDropThreshold / 100)) {
        newAlerts.push({
          id: `yield_drop_${position.id}`,
          type: 'yield_drop',
          severity: 'info',
          title: 'Yield Below Market Average',
          message: `${position.pool} APR (${position.apr.toFixed(2)}%) is below market average. Consider rebalancing.`,
          positionId: position.id,
          protocol: position.protocol,
          actionRequired: false,
          createdAt: now,
          dismissed: false
        });
      }
    });

    // 4. Rebalancing Opportunities
    const outOfRangePositions = positions.filter(p => !p.inRange);
    if (outOfRangePositions.length >= 2) {
      newAlerts.push({
        id: 'rebalance_opportunity',
        type: 'rebalance',
        severity: 'info',
        title: 'Rebalancing Opportunity',
        message: `${outOfRangePositions.length} positions are out of range. Consider a portfolio rebalance.`,
        actionRequired: false,
        createdAt: now,
        dismissed: false
      });
    }

    // 5. Portfolio Performance Alerts
    if (portfolioHistory.length >= 7) {
      const recent = portfolioHistory.slice(-7);
      const weekStart = recent[0].value;
      const weekEnd = recent[recent.length - 1].value;
      const weeklyChange = ((weekEnd - weekStart) / weekStart) * 100;
      
      if (weeklyChange < -10) {
        newAlerts.push({
          id: 'performance_warning',
          type: 'risk_warning',
          severity: 'warning',
          title: 'Portfolio Performance Alert',
          message: `Portfolio down ${Math.abs(weeklyChange).toFixed(2)}% this week. Review risk exposure.`,
          actionRequired: true,
          createdAt: now,
          dismissed: false
        });
      }
    }

    // 6. New Opportunities (Mock)
    if (Math.random() > 0.7) { // 30% chance of showing opportunity
      newAlerts.push({
        id: 'new_opportunity',
        type: 'opportunity',
        severity: 'info',
        title: 'New High-Yield Opportunity',
        message: 'New stETH-ETH pool on Curve offering 24.5% APR with low IL risk.',
        actionRequired: false,
        createdAt: now,
        dismissed: false
      });
    }

    return newAlerts;
  }, [positions, portfolioHistory, settings]);

  // Update alerts when positions change
  useEffect(() => {
    const newAlerts = generateAlerts;
    
    // Merge with existing alerts, keeping dismissal status
    const existingAlertIds = new Set(alerts.map(a => a.id));
    const mergedAlerts = [
      ...alerts.filter(alert => !newAlerts.some(newAlert => newAlert.id === alert.id)),
      ...newAlerts.map(newAlert => {
        const existing = alerts.find(a => a.id === newAlert.id);
        return existing ? { ...newAlert, dismissed: existing.dismissed } : newAlert;
      })
    ];
    
    setAlerts(mergedAlerts);
  }, [generateAlerts]);

  // Filter and sort alerts
  const filteredAndSortedAlerts = useMemo(() => {
    let filtered = [...alerts];
    
    // Apply filter
    switch (filter) {
      case 'critical':
        filtered = filtered.filter(alert => alert.severity === 'critical');
        break;
      case 'warning':
        filtered = filtered.filter(alert => alert.severity === 'warning');
        break;
      case 'info':
        filtered = filtered.filter(alert => alert.severity === 'info');
        break;
      case 'active':
        filtered = filtered.filter(alert => !alert.dismissed);
        break;
      case 'dismissed':
        filtered = filtered.filter(alert => alert.dismissed);
        break;
    }
    
    // Apply sort
    switch (sort) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'severity':
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        filtered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
        break;
      case 'type':
        filtered.sort((a, b) => a.type.localeCompare(b.type));
        break;
    }
    
    return filtered;
  }, [alerts, filter, sort]);

  // Alert statistics
  const alertStats = useMemo(() => {
    const active = alerts.filter(a => !a.dismissed);
    return {
      total: alerts.length,
      active: active.length,
      critical: active.filter(a => a.severity === 'critical').length,
      warning: active.filter(a => a.severity === 'warning').length,
      actionRequired: active.filter(a => a.actionRequired).length
    };
  }, [alerts]);

  // Handle alert actions
  const handleAlertAction = (alertId: string, action: 'dismiss' | 'snooze' | 'act') => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, dismissed: action === 'dismiss' }
        : alert
    ));
    
    onAlertAction?.(alertId, action);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'warning': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'info': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'range_exit': return <Target className="w-4 h-4" />;
      case 'high_il': return <TrendingDown className="w-4 h-4" />;
      case 'yield_drop': return <TrendingDown className="w-4 h-4" />;
      case 'rebalance': return <Zap className="w-4 h-4" />;
      case 'opportunity': return <TrendingUp className="w-4 h-4" />;
      case 'risk_warning': return <AlertTriangle className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className={`crypto-card border border-orange-500/30 p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 crypto-card rounded-lg border border-orange-500/20 relative">
            <Bell className="w-5 h-5 text-orange-400" />
            {alertStats.critical > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Smart Alerts</h3>
            <p className="text-gray-400 text-sm">Automated monitoring & notifications</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 crypto-card border border-gray-500/20 rounded-lg hover:border-orange-500/40 transition-all duration-200"
            title="Alert settings"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
          
          {settings.soundEnabled ? (
            <button
              onClick={() => setSettings(prev => ({ ...prev, soundEnabled: false }))}
              className="p-2 crypto-card border border-green-500/20 rounded-lg"
              title="Sound enabled"
            >
              <Volume2 className="w-4 h-4 text-green-400" />
            </button>
          ) : (
            <button
              onClick={() => setSettings(prev => ({ ...prev, soundEnabled: true }))}
              className="p-2 crypto-card border border-gray-500/20 rounded-lg"
              title="Sound disabled"
            >
              <VolumeX className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="crypto-card border border-blue-500/20 p-3 text-center">
          <div className="text-lg font-bold text-blue-400">{alertStats.total}</div>
          <div className="text-xs text-gray-400">Total</div>
        </div>
        
        <div className="crypto-card border border-green-500/20 p-3 text-center">
          <div className="text-lg font-bold text-green-400">{alertStats.active}</div>
          <div className="text-xs text-gray-400">Active</div>
        </div>
        
        <div className="crypto-card border border-red-500/20 p-3 text-center">
          <div className="text-lg font-bold text-red-400">{alertStats.critical}</div>
          <div className="text-xs text-gray-400">Critical</div>
        </div>
        
        <div className="crypto-card border border-yellow-500/20 p-3 text-center">
          <div className="text-lg font-bold text-yellow-400">{alertStats.warning}</div>
          <div className="text-xs text-gray-400">Warning</div>
        </div>
        
        <div className="crypto-card border border-purple-500/20 p-3 text-center">
          <div className="text-lg font-bold text-purple-400">{alertStats.actionRequired}</div>
          <div className="text-xs text-gray-400">Action Req.</div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as AlertFilter)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm text-white"
          >
            <option value="all">All Alerts</option>
            <option value="active">Active</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Sort by:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as AlertSort)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm text-white"
          >
            <option value="severity">Severity</option>
            <option value="newest">Newest</option>
            <option value="type">Type</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAndSortedAlerts.length > 0 ? (
          filteredAndSortedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`crypto-card border p-4 ${
                alert.dismissed ? 'opacity-60' : ''
              } ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                    {getTypeIcon(alert.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h5 className="font-medium text-white">{alert.title}</h5>
                      {alert.actionRequired && (
                        <div className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30">
                          ACTION REQUIRED
                        </div>
                      )}
                    </div>
                    
                    <p className="text-gray-300 text-sm mb-2">{alert.message}</p>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(alert.createdAt).toLocaleString()}</span>
                      </span>
                      
                      {alert.protocol && (
                        <span>Protocol: {alert.protocol}</span>
                      )}
                      
                      <span className="capitalize">{alert.type.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                {/* Alert Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  {!alert.dismissed && (
                    <>
                      {alert.actionRequired && (
                        <button
                          onClick={() => handleAlertAction(alert.id, 'act')}
                          className="px-3 py-1 crypto-button text-xs rounded-lg hover:scale-105 transition-transform"
                        >
                          Take Action
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleAlertAction(alert.id, 'dismiss')}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="Dismiss alert"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </>
                  )}
                  
                  {alert.dismissed && (
                    <div className="flex items-center space-x-1 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs">Dismissed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            {filter === 'active' ? (
              <>
                <p>No active alerts</p>
                <p className="text-sm">Your portfolio is performing well!</p>
              </>
            ) : (
              <>
                <p>No alerts match your filter</p>
                <p className="text-sm">Try changing the filter or sort options</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="crypto-card border border-blue-500/20 p-5">
          <h4 className="font-medium text-white mb-4">Alert Settings</h4>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-gray-300">Enable alerts</span>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
              />
            </label>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">
                Range exit threshold (hours)
              </label>
              <input
                type="number"
                value={settings.rangeExitThreshold}
                onChange={(e) => setSettings(prev => ({ ...prev, rangeExitThreshold: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                min="1"
                max="48"
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">
                Yield drop threshold (%)
              </label>
              <input
                type="number"
                value={settings.yieldDropThreshold}
                onChange={(e) => setSettings(prev => ({ ...prev, yieldDropThreshold: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                min="1"
                max="50"
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-1">
                High IL threshold (%)
              </label>
              <input
                type="number"
                value={settings.highILThreshold}
                onChange={(e) => setSettings(prev => ({ ...prev, highILThreshold: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                min="1"
                max="20"
              />
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-gray-300">Email notifications</span>
              <input
                type="checkbox"
                checked={settings.emailEnabled}
                onChange={(e) => setSettings(prev => ({ ...prev, emailEnabled: e.target.checked }))}
                className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartAlerts;