'use client';

import React from 'react';
import { 
  TrendingUp, 
  Target, 
  Clock, 
  DollarSign, 
  Zap,
  RotateCcw
} from 'lucide-react';

interface QuickFiltersProps {
  onHighValue: () => void;
  onInRangeOnly: () => void;
  onHighYield: () => void;
  onRecent: () => void;
  onWhalePositions: () => void;
  onReset: () => void;
  activeFiltersCount: number;
}

const QuickFilters: React.FC<QuickFiltersProps> = ({
  onHighValue,
  onInRangeOnly,
  onHighYield,
  onRecent,
  onWhalePositions,
  onReset,
  activeFiltersCount
}) => {
  const quickFilters = [
    {
      label: 'High Value',
      description: '≥$10k positions',
      icon: DollarSign,
      onClick: onHighValue,
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    },
    {
      label: 'In Range',
      description: 'Active positions only',
      icon: Target,
      onClick: onInRangeOnly,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    },
    {
      label: 'High Yield',
      description: '≥20% APR',
      icon: TrendingUp,
      onClick: onHighYield,
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    },
    {
      label: 'Recent',
      description: 'Last 7 days',
      icon: Clock,
      onClick: onRecent,
      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    },
    {
      label: 'Whale Positions',
      description: '≥$100k positions',
      icon: Zap,
      onClick: onWhalePositions,
      color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Quick Filters</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              One-click position filtering
            </p>
          </div>
        </div>
        
        {activeFiltersCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {quickFilters.map((filter, index) => {
          const Icon = filter.icon;
          return (
            <button
              key={index}
              onClick={filter.onClick}
              className={`${filter.color} p-3 rounded-xl hover:scale-105 transition-all duration-200 group cursor-pointer border border-transparent hover:border-gray-300 dark:hover:border-gray-600`}
            >
              <div className="flex flex-col items-center space-y-2">
                <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <div className="text-center">
                  <div className="font-semibold text-xs">{filter.label}</div>
                  <div className="text-xs opacity-75 leading-tight">{filter.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickFilters;