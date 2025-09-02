'use client';

import React, { useEffect, useState } from 'react';
import { Search, Zap, TrendingUp, Target, CheckCircle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import ProtocolLoadingIndicator from './ProtocolLoadingIndicator';

interface ScanningAnimationProps {
  walletAddress: string;
  chain: 'ethereum' | 'solana';
  protocols: Array<{
    name: string;
    status: 'pending' | 'loading' | 'success' | 'error';
    positionsFound?: number;
    error?: string;
    emoji?: string;
    color?: string;
  }>;
  progress: number;
  currentStep: string;
  onComplete?: () => void;
}

const ScanningAnimation: React.FC<ScanningAnimationProps> = ({
  walletAddress,
  chain,
  protocols,
  progress,
  currentStep,
  onComplete
}) => {
  const [currentProtocolIndex, setCurrentProtocolIndex] = useState(0);
  const [scanPhase, setScanPhase] = useState<'detecting' | 'scanning' | 'analyzing' | 'complete'>('detecting');

  useEffect(() => {
    if (progress < 20) {
      setScanPhase('detecting');
    } else if (progress < 80) {
      setScanPhase('scanning');
    } else if (progress < 100) {
      setScanPhase('analyzing');
    } else {
      setScanPhase('complete');
      onComplete?.();
    }
  }, [progress, onComplete]);

  // Simplified animations with CSS classes

  const getPhaseIcon = () => {
    switch (scanPhase) {
      case 'detecting':
        return <Search className="w-8 h-8 text-blue-500" />;
      case 'scanning':
        return <Zap className="w-8 h-8 text-purple-500" />;
      case 'analyzing':
        return <TrendingUp className="w-8 h-8 text-green-500" />;
      case 'complete':
        return <CheckCircle className="w-8 h-8 text-green-600" />;
      default:
        return <Search className="w-8 h-8 text-blue-500" />;
    }
  };

  const getPhaseMessage = () => {
    switch (scanPhase) {
      case 'detecting':
        return `Detecting ${chain} wallet format...`;
      case 'scanning':
        return `Scanning protocols on ${chain}...`;
      case 'analyzing':
        return 'Analyzing positions and calculating metrics...';
      case 'complete':
        return 'Scan complete!';
      default:
        return 'Initializing scan...';
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 animate-fadeIn">
      {/* Header Section */}
      <div className="text-center mb-8 animate-slideUp">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4 animate-pulse">
          {getPhaseIcon()}
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">
          Scanning LP Positions
        </h2>
        
        <p className="text-white/70 mb-4">
          {getPhaseMessage()}
        </p>

        {/* Wallet Address */}
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm">
          <div className={`w-3 h-3 rounded-full ${
            chain === 'ethereum' ? 'bg-blue-400' : 'bg-purple-400'
          }`} />
          <span className="text-sm font-mono text-white/90">
            {formatAddress(walletAddress)}
          </span>
        </div>
      </div>

      {/* Progress Section */}
      <div className="mb-8 animate-slideUp">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-white">
            Overall Progress
          </span>
          <span className="text-sm text-white/70">
            {Math.round(progress)}%
          </span>
        </div>
        
        <div className="relative w-full h-3 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
          
          {/* Scanning line effect */}
          {scanPhase === 'scanning' && (
            <div className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />
          )}
        </div>
      </div>

      {/* Current Step */}
      <div className="text-center mb-8 animate-slideUp">
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/5 rounded-lg backdrop-blur-sm">
          <LoadingSpinner size="sm" variant="dots" color="primary" />
          <span className="text-sm text-white/80">
            {currentStep}
          </span>
        </div>
      </div>

      {/* Protocols Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 animate-slideUp">
        {protocols.map((protocol, index) => (
          <div
            key={protocol.name}
            className="animate-fadeIn"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <ProtocolLoadingIndicator
              protocolName={protocol.name}
              status={protocol.status}
              positionsFound={protocol.positionsFound}
              error={protocol.error}
              emoji={protocol.emoji}
              color={protocol.color}
              progress={protocol.status === 'loading' ? 
                Math.min(((progress - 20) / 60) * 100, 100) : 
                protocol.status === 'success' ? 100 : 0
              }
            />
          </div>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 animate-slideUp">
        {[
          {
            label: 'Protocols Scanned',
            value: protocols.filter(p => p.status !== 'pending').length,
            total: protocols.length
          },
          {
            label: 'Positions Found',
            value: protocols.reduce((sum, p) => sum + (p.positionsFound || 0), 0),
            total: null
          },
          {
            label: 'Success Rate',
            value: protocols.filter(p => p.status === 'success').length,
            total: protocols.filter(p => p.status !== 'pending').length
          }
        ].map((stat, index) => (
          <div
            key={index}
            className="text-center p-4 bg-white/10 rounded-lg backdrop-blur-sm"
          >
            <div className="text-2xl font-bold text-white mb-1">
              {stat.total !== null ? `${stat.value}/${stat.total}` : stat.value}
            </div>
            <div className="text-sm text-white/70">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Completion Animation */}
      {scanPhase === 'complete' && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none animate-bounce">
          <div className="text-6xl">
            ✨
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanningAnimation;