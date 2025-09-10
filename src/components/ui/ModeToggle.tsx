'use client';

/**
 * Mode Toggle Component
 * Professional toggle between Demo and Production modes with Token Terminal aesthetic
 */

import React, { useState } from 'react';
import { 
  Activity, 
  Loader2, 
  Settings, 
  TestTube, 
  Zap, 
  Info, 
  AlertTriangle,
  CheckCircle,
  X
} from 'lucide-react';
import { useMode } from '../../contexts/ModeContext';

interface ModeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  showTooltip?: boolean;
}

interface TooltipProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'demo' | 'production';
}

const ModeTooltip: React.FC<TooltipProps> = ({ isOpen, onClose, mode }) => {
  if (!isOpen) return null;

  const tooltipContent = {
    demo: {
      title: 'Demo Mode',
      description: 'Explore LP Tracker with sample data',
      features: [
        'Pre-loaded sample positions',
        'Simulated analytics data', 
        'All UI features available',
        'No real wallet connections',
        'Perfect for testing and demos'
      ],
      icon: TestTube,
      color: 'blue'
    },
    production: {
      title: 'Production Mode',  
      description: 'Live data from real protocols',
      features: [
        'Real-time position data',
        'Live price feeds',
        'Actual protocol integrations',
        'Real wallet scanning',
        'Production-grade features'
      ],
      icon: Zap,
      color: 'green'
    }
  };

  const config = tooltipContent[mode];
  const IconComponent = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-gray-900 border border-white/[0.08] rounded-lg p-6 max-w-sm mx-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-white/[0.05] rounded-md transition-colors"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className={`p-2 rounded-md ${
            config.color === 'blue' 
              ? 'bg-blue-500/10 border border-blue-500/20' 
              : 'bg-green-500/10 border border-green-500/20'
          }`}>
            <IconComponent className={`h-5 w-5 ${
              config.color === 'blue' ? 'text-blue-400' : 'text-green-400'
            }`} />
          </div>
          <div>
            <h3 className="tt-text-primary font-semibold text-lg">{config.title}</h3>
            <p className="tt-text-secondary text-sm">{config.description}</p>
          </div>
        </div>

        <div className="space-y-2">
          {config.features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-2">
              <CheckCircle className={`h-3 w-3 ${
                config.color === 'blue' ? 'text-blue-400' : 'text-green-400'
              } flex-shrink-0`} />
              <span className="tt-text-secondary text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ModeToggle: React.FC<ModeToggleProps> = ({
  className = '',
  size = 'md',
  showLabels = true,
  showTooltip = true
}) => {
  const { 
    mode, 
    isDemo, 
    toggleMode, 
    isTransitioning, 
    transitionError,
    hasPersistedMode 
  } = useMode();
  
  const [showTooltipModal, setShowTooltipModal] = useState(false);

  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base', 
    lg: 'h-12 text-lg'
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const handleToggle = () => {
    if (!isTransitioning) {
      toggleMode();
    }
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showTooltip) {
      setShowTooltipModal(true);
    }
  };

  return (
    <>
      <div className={`flex items-center space-x-3 ${className}`}>
        {/* Mode Status Indicator */}
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-md border ${
            isDemo 
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              : 'bg-green-500/10 border-green-500/20 text-green-400'
          }`}>
            {isDemo ? (
              <TestTube className={iconSizes[size]} />
            ) : (
              <Zap className={iconSizes[size]} />
            )}
            {showLabels && (
              <span className="font-medium capitalize">{isDemo ? 'demo' : 'production'}</span>
            )}
          </div>
          
          {showTooltip && (
            <button
              onClick={handleInfoClick}
              className="p-1 hover:bg-white/[0.05] rounded-md transition-colors"
              title={`Learn about ${mode} mode`}
            >
              <Info className="h-4 w-4 text-gray-400 hover:text-gray-300" />
            </button>
          )}
        </div>

        {/* Toggle Switch */}
        <button
          onClick={handleToggle}
          disabled={isTransitioning}
          className={`relative inline-flex ${sizeClasses[size]} rounded-full border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${
            isDemo 
              ? 'bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30' 
              : 'bg-green-500/20 border-green-500/30 hover:bg-green-500/30'
          }`}
          style={{ width: showLabels ? '120px' : '60px' }}
        >
          {/* Switch Track */}
          <span className="sr-only">Toggle between demo and production modes</span>
          
          {/* Switch Handle */}
          <span
            className={`${isTransitioning ? 'animate-pulse' : ''} pointer-events-none inline-block h-full aspect-square rounded-full shadow-lg ring-0 transition-transform duration-200 ${
              isDemo ? 'translate-x-0 bg-blue-400' : `${showLabels ? 'translate-x-[60px]' : 'translate-x-[20px]'} bg-green-400`
            }`}
          >
            {/* Handle Icon */}
            <div className="flex items-center justify-center h-full">
              {isTransitioning ? (
                <Loader2 className={`${iconSizes[size]} text-gray-900 animate-spin`} />
              ) : isDemo ? (
                <TestTube className={`${iconSizes[size]} text-gray-900`} />
              ) : (
                <Zap className={`${iconSizes[size]} text-gray-900`} />
              )}
            </div>
          </span>

          {/* Labels */}
          {showLabels && (
            <>
              <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium transition-opacity ${
                isDemo ? 'opacity-0' : 'opacity-70'
              }`}>
                Demo
              </span>
              <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium transition-opacity ${
                isDemo ? 'opacity-70' : 'opacity-0'
              }`}>
                Prod
              </span>
            </>
          )}
        </button>

        {/* Persistent Mode Indicator */}
        {hasPersistedMode && (
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Settings className="h-3 w-3" />
            <span>Saved</span>
          </div>
        )}
      </div>

      {/* Error State */}
      {transitionError && (
        <div className="flex items-center space-x-2 px-3 py-2 mt-2 bg-red-500/10 border border-red-500/20 rounded-md">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">{transitionError}</span>
        </div>
      )}

      {/* Transition Loading Overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-gray-900 border border-white/[0.08] rounded-lg p-6 flex flex-col items-center space-y-3">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            <div className="text-center">
              <div className="tt-text-primary font-medium">Switching Modes</div>
              <div className="tt-text-secondary text-sm">
                {isDemo ? 'Activating production features...' : 'Loading demo data...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip Modal */}
      {showTooltip && (
        <ModeTooltip 
          isOpen={showTooltipModal}
          onClose={() => setShowTooltipModal(false)}
          mode={isDemo ? 'demo' : 'production'}
        />
      )}
    </>
  );
};

// Compact version for header/nav use
export const CompactModeToggle: React.FC<{ className?: string }> = ({ className }) => (
  <ModeToggle 
    className={className}
    size="sm" 
    showLabels={false}
    showTooltip={true}
  />
);

// Full-featured version for settings/dashboard
export const FullModeToggle: React.FC<{ className?: string }> = ({ className }) => (
  <ModeToggle 
    className={className}
    size="lg"
    showLabels={true} 
    showTooltip={true}
  />
);

export default ModeToggle;