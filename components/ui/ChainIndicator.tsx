import React from 'react';
import { Chain } from '../../types/components/SearchBar';

interface ChainIndicatorProps {
  chain: Chain;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum',
    shortName: 'ETH',
    color: 'bg-blue-500',
    textColor: 'text-blue-400'
  },
  solana: {
    name: 'Solana',
    shortName: 'SOL',
    color: 'bg-purple-500',
    textColor: 'text-purple-400'
  }
} as const;

const SIZE_CONFIG = {
  sm: { icon: 'w-6 h-6', text: 'text-xs' },
  md: { icon: 'w-8 h-8', text: 'text-sm' },
  lg: { icon: 'w-10 h-10', text: 'text-base' }
} as const;

const ChainIndicator: React.FC<ChainIndicatorProps> = ({ 
  chain, 
  size = 'md', 
  showLabel = false 
}) => {
  const chainConfig = CHAIN_CONFIG[chain];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div className="flex items-center space-x-2">
      <div className={`${chainConfig.color} rounded-full flex items-center justify-center ${sizeConfig.icon}`}>
        <span className={`text-white font-bold ${sizeConfig.text}`}>
          {chainConfig.shortName}
        </span>
      </div>
      {showLabel && (
        <span className={`${chainConfig.textColor} font-medium ${sizeConfig.text}`}>
          {chainConfig.name}
        </span>
      )}
    </div>
  );
};

export default ChainIndicator;