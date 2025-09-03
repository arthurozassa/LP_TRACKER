import React from 'react';
import { DollarSign, TrendingUp, Percent, Activity } from 'lucide-react';
import { DashboardMetrics } from '../../types';

interface MetricsCardsProps {
  metrics: DashboardMetrics;
  loading?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  loading?: boolean;
  formatValue?: (value: number) => string;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  loading = false,
  formatValue
}) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'tt-status-positive';
      case 'negative':
        return 'tt-status-negative';
      default:
        return 'tt-status-neutral';
    }
  };

  const getChangePrefix = () => {
    if (change === undefined || change === 0) return '';
    return change > 0 ? '+' : '';
  };

  const displayValue = loading 
    ? '...' 
    : formatValue 
      ? formatValue(typeof value === 'number' ? value : 0)
      : value;

  return (
    <div className="tt-card tt-card-hover animate-fadeIn">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="tt-text-secondary text-sm font-medium mb-2">
              {title}
            </p>
            
            <div className="flex items-baseline space-x-2">
              <h3 className="text-2xl font-bold tt-text-primary">
                {loading ? (
                  <div className="h-8 w-24 tt-skeleton" />
                ) : (
                  displayValue
                )}
              </h3>
              
              {change !== undefined && !loading && (
                <span className={`text-sm font-medium ${getChangeColor()}`}>
                  {getChangePrefix()}{change.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          
          <div className="ml-4">
            <div className="p-3 bg-white/[0.05] border border-white/[0.08] rounded-lg">
              <div className="tt-text-secondary">
                {icon}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricsCards: React.FC<MetricsCardsProps> = ({ metrics, loading = false }) => {
  const cards = [
    {
      title: 'Total Value',
      value: metrics.totalValue,
      icon: <DollarSign size={24} />,
      formatValue: formatCurrency,
      change: metrics.totalYield24h,
      changeType: metrics.totalYield24h > 0 ? 'positive' : metrics.totalYield24h < 0 ? 'negative' : 'neutral'
    },
    {
      title: 'Fees Earned',
      value: metrics.totalFeesEarned,
      icon: <TrendingUp size={24} />,
      formatValue: formatCurrency,
      change: metrics.totalYield7d,
      changeType: metrics.totalYield7d > 0 ? 'positive' : metrics.totalYield7d < 0 ? 'negative' : 'neutral'
    },
    {
      title: 'Avg APR',
      value: metrics.avgApr,
      icon: <Percent size={24} />,
      formatValue: formatPercentage,
      change: metrics.totalYield30d,
      changeType: metrics.totalYield30d > 0 ? 'positive' : metrics.totalYield30d < 0 ? 'negative' : 'neutral'
    },
    {
      title: 'Active Protocols',
      value: metrics.activeProtocols,
      icon: <Activity size={24} />,
      changeType: 'neutral',
      formatValue: undefined,
      change: undefined
    }
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <MetricCard
          key={card.title}
          title={card.title}
          value={card.value}
          icon={card.icon}
          loading={loading}
          formatValue={card.formatValue}
          change={card.change}
          changeType={card.changeType as 'positive' | 'negative' | 'neutral'}
        />
      ))}
    </div>
  );
};

export default MetricsCards;