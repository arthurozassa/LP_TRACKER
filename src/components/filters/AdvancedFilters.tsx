'use client';

import React, { useState } from 'react';
import { Filter, X, ChevronDown, DollarSign, Target, Clock, Layers, TrendingUp, Network } from 'lucide-react';

export interface FilterState {
  minValue: string;
  maxValue: string;
  protocols: string[];
  status: 'all' | 'in-range' | 'out-of-range';
  timeRange: '24h' | '7d' | '30d' | 'all';
  chains: string[];
  minApr: string;
  maxApr: string;
}

interface AdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableProtocols: string[];
  availableChains: string[];
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  availableProtocols,
  availableChains
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const toggleProtocol = (protocol: string) => {
    const newProtocols = filters.protocols.includes(protocol)
      ? filters.protocols.filter(p => p !== protocol)
      : [...filters.protocols, protocol];
    updateFilter('protocols', newProtocols);
  };

  const toggleChain = (chain: string) => {
    const newChains = filters.chains.includes(chain)
      ? filters.chains.filter(c => c !== chain)
      : [...filters.chains, chain];
    updateFilter('chains', newChains);
  };

  const resetFilters = () => {
    onFiltersChange({
      minValue: '',
      maxValue: '',
      protocols: [],
      status: 'all',
      timeRange: 'all',
      chains: [],
      minApr: '',
      maxApr: ''
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.minValue) count++;
    if (filters.maxValue) count++;
    if (filters.protocols.length > 0) count++;
    if (filters.status !== 'all') count++;
    if (filters.timeRange !== 'all') count++;
    if (filters.chains.length > 0) count++;
    if (filters.minApr) count++;
    if (filters.maxApr) count++;
    return count;
  };

  const activeCount = getActiveFiltersCount();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Filter Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Advanced Filters</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? 's' : ''} active` : 'No filters applied'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {activeCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetFilters();
              }}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Clear All
            </button>
          )}
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Position Value Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <DollarSign className="w-4 h-4" />
                <span>Min Position Value</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 1000"
                value={filters.minValue}
                onChange={(e) => updateFilter('minValue', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <DollarSign className="w-4 h-4" />
                <span>Max Position Value</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 100000"
                value={filters.maxValue}
                onChange={(e) => updateFilter('maxValue', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* APR Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span>Min APR (%)</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 5"
                value={filters.minApr}
                onChange={(e) => updateFilter('minApr', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span>Max APR (%)</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={filters.maxApr}
                onChange={(e) => updateFilter('maxApr', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status and Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Target className="w-4 h-4" />
                <span>Position Status</span>
              </label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Positions</option>
                <option value="in-range">In Range Only</option>
                <option value="out-of-range">Out of Range Only</option>
              </select>
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Clock className="w-4 h-4" />
                <span>Time Range</span>
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => updateFilter('timeRange', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Protocols */}
          {availableProtocols.length > 0 && (
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <Layers className="w-4 h-4" />
                <span>Protocols</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableProtocols.map((protocol) => (
                  <button
                    key={protocol}
                    onClick={() => toggleProtocol(protocol)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      filters.protocols.includes(protocol)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {protocol}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chains */}
          {availableChains.length > 0 && (
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <Network className="w-4 h-4" />
                <span>Chains</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableChains.map((chain) => (
                  <button
                    key={chain}
                    onClick={() => toggleChain(chain)}
                    className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                      filters.chains.includes(chain)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {chain}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;