import React from 'react';
import { X, Filter } from 'lucide-react';
import { ProtocolType, ChainType } from '../../types';

interface FilterPillsProps {
  availableProtocols: ProtocolType[];
  selectedProtocols: ProtocolType[];
  onProtocolToggle: (protocol: ProtocolType) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
  loading?: boolean;
  showChainFilter?: boolean;
  availableChains?: ChainType[];
  selectedChains?: ChainType[];
  onChainToggle?: (chain: ChainType) => void;
}

// Protocol display names and metadata
const PROTOCOL_CONFIG: Record<ProtocolType, { name: string; chain: ChainType; color: string }> = {
  'uniswap-v2': { name: 'Uniswap V2', chain: 'ethereum', color: 'from-pink-500 to-pink-600' },
  'uniswap-v3': { name: 'Uniswap V3', chain: 'ethereum', color: 'from-pink-500 to-pink-600' },
  'sushiswap': { name: 'SushiSwap', chain: 'ethereum', color: 'from-blue-500 to-blue-600' },
  'curve': { name: 'Curve', chain: 'ethereum', color: 'from-teal-500 to-teal-600' },
  'balancer': { name: 'Balancer', chain: 'ethereum', color: 'from-gray-600 to-gray-700' },
  'meteora-dlmm': { name: 'Meteora DLMM', chain: 'solana', color: 'from-purple-500 to-purple-600' },
  'raydium-clmm': { name: 'Raydium CLMM', chain: 'solana', color: 'from-indigo-500 to-indigo-600' },
  'orca-whirlpools': { name: 'Orca Whirlpools', chain: 'solana', color: 'from-yellow-500 to-yellow-600' },
  'lifinity': { name: 'Lifinity', chain: 'solana', color: 'from-cyan-500 to-cyan-600' },
  'jupiter': { name: 'Jupiter', chain: 'solana', color: 'from-orange-500 to-orange-600' },
  'uniswap-v3-arbitrum': { name: 'Uniswap V3 (Arbitrum)', chain: 'arbitrum', color: 'from-pink-500 to-blue-600' },
  'uniswap-v3-polygon': { name: 'Uniswap V3 (Polygon)', chain: 'polygon', color: 'from-pink-500 to-purple-600' },
  'uniswap-v3-base': { name: 'Uniswap V3 (Base)', chain: 'base', color: 'from-pink-500 to-blue-500' }
};

const CHAIN_CONFIG: Record<ChainType, { name: string; color: string; shortName: string }> = {
  ethereum: { name: 'Ethereum', color: 'from-blue-500 to-blue-600', shortName: 'ETH' },
  solana: { name: 'Solana', color: 'from-purple-500 to-purple-600', shortName: 'SOL' },
  arbitrum: { name: 'Arbitrum', color: 'from-blue-400 to-blue-500', shortName: 'ARB' },
  polygon: { name: 'Polygon', color: 'from-purple-400 to-purple-500', shortName: 'MATIC' },
  base: { name: 'Base', color: 'from-blue-500 to-blue-400', shortName: 'BASE' }
};

interface PillProps {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  onRemove?: () => void;
  gradient: string;
  disabled?: boolean;
}

const Pill: React.FC<PillProps> = ({ 
  children, 
  isActive, 
  onClick, 
  onRemove, 
  gradient, 
  disabled = false 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative group flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 
        rounded-full text-xs sm:text-sm font-medium
        transition-all duration-200 transform hover:scale-105 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        touch-manipulation
        ${isActive 
          ? `bg-gradient-to-r ${gradient} text-white shadow-lg` 
          : 'bg-white/10 backdrop-blur-md border border-white/20 text-gray-300 hover:bg-white/20 hover:text-white'
        }
      `}
    >
      <span className="truncate max-w-[120px] sm:max-w-none">{children}</span>
      
      {isActive && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 sm:ml-1 p-0.5 rounded-full hover:bg-white/20 transition-colors duration-200 flex-shrink-0"
        >
          <X size={10} className="sm:w-3 sm:h-3" />
        </button>
      )}
      
      {/* Hover glow effect */}
      {!disabled && (
        <div className={`
          absolute inset-0 rounded-full opacity-0 group-hover:opacity-50 
          transition-opacity duration-200 bg-gradient-to-r ${gradient}
          ${isActive ? '' : 'blur-sm'}
        `} />
      )}
    </button>
  );
};

const FilterPills: React.FC<FilterPillsProps> = ({
  availableProtocols,
  selectedProtocols,
  onProtocolToggle,
  onClearAll,
  onSelectAll,
  loading = false,
  showChainFilter = false,
  availableChains = [],
  selectedChains = [],
  onChainToggle
}) => {
  const hasActiveFilters = selectedProtocols.length > 0 || selectedChains.length > 0;
  const allProtocolsSelected = selectedProtocols.length === availableProtocols.length;
  
  return (
    <div className="relative group">
      <div className="relative bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl border border-white/20 p-4 sm:p-5 lg:p-6 shadow-lg">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg sm:rounded-xl pointer-events-none" />
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <Filter size={16} className="sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
              <h3 className="text-base sm:text-lg font-semibold text-white">Filters</h3>
            </div>
            
            {/* Control buttons */}
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              {hasActiveFilters && (
                <button
                  onClick={onClearAll}
                  disabled={loading}
                  className="px-2 sm:px-3 py-1 text-xs font-medium text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50 whitespace-nowrap"
                >
                  Clear All
                </button>
              )}
              
              <button
                onClick={allProtocolsSelected ? onClearAll : onSelectAll}
                disabled={loading}
                className="px-2 sm:px-3 py-1 text-xs font-medium text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50 whitespace-nowrap"
              >
                {allProtocolsSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>
          
          {/* Chain filters */}
          {showChainFilter && availableChains.length > 0 && (
            <div className="mb-3 sm:mb-4">
              <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2">Chains</h4>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {availableChains.map((chain) => {
                  const config = CHAIN_CONFIG[chain];
                  const isSelected = selectedChains.includes(chain);
                  
                  return (
                    <Pill
                      key={chain}
                      isActive={isSelected}
                      onClick={() => onChainToggle?.(chain)}
                      onRemove={isSelected ? () => onChainToggle?.(chain) : undefined}
                      gradient={config.color}
                      disabled={loading}
                    >
                      <span className="hidden xs:inline">{config.name}</span>
                      <span className="xs:hidden">{config.shortName}</span>
                    </Pill>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Protocol filters */}
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2">Protocols</h4>
            
            {loading ? (
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className="h-6 w-16 sm:h-8 sm:w-24 bg-white/10 rounded-full animate-pulse"
                  />
                ))}
              </div>
            ) : availableProtocols.length === 0 ? (
              <div className="text-gray-400 text-xs sm:text-sm py-2">
                No protocols available
              </div>
            ) : (
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {availableProtocols.map((protocol) => {
                  const config = PROTOCOL_CONFIG[protocol];
                  const isSelected = selectedProtocols.includes(protocol);
                  
                  return (
                    <Pill
                      key={protocol}
                      isActive={isSelected}
                      onClick={() => onProtocolToggle(protocol)}
                      onRemove={isSelected ? () => onProtocolToggle(protocol) : undefined}
                      gradient={config.color}
                      disabled={loading}
                    >
                      {config.name}
                    </Pill>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Active filters summary */}
          {hasActiveFilters && (
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
              <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between text-xs sm:text-sm space-y-1 xs:space-y-0">
                <span className="text-gray-400">
                  {selectedProtocols.length} protocol{selectedProtocols.length !== 1 ? 's' : ''} selected
                  {showChainFilter && selectedChains.length > 0 && (
                    <span>, {selectedChains.length} chain{selectedChains.length !== 1 ? 's' : ''}</span>
                  )}
                </span>
                
                <span className="text-green-400 font-medium text-xs sm:text-sm">
                  Active
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterPills;