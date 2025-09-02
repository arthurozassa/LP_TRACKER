'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Zap, TrendingUp, CheckCircle, Loader2 } from 'lucide-react';

interface EnhancedLoadingStateProps {
  isLoading: boolean;
  progress: number;
  currentStep: string;
  chain: 'ethereum' | 'solana';
  address: string;
}

const EnhancedLoadingState: React.FC<EnhancedLoadingStateProps> = ({
  isLoading,
  progress,
  currentStep,
  chain,
  address
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    } else {
      setDots('');
    }
  }, [isLoading]);

  const formatAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const getPhaseIcon = () => {
    if (progress < 30) return <Search className="w-6 h-6 text-blue-500" />;
    if (progress < 80) return <Zap className="w-6 h-6 text-purple-500" />;
    if (progress < 100) return <TrendingUp className="w-6 h-6 text-green-500" />;
    return <CheckCircle className="w-6 h-6 text-green-600" />;
  };

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-2xl mx-auto"
        >
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-xl">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4"
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 360]
                }}
                transition={{
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  rotate: { duration: 8, repeat: Infinity, ease: "linear" }
                }}
              >
                {getPhaseIcon()}
              </motion.div>
              
              <h2 className="text-2xl font-bold text-white mb-2">
                Scanning LP Positions
              </h2>
              
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm">
                <div className={`w-3 h-3 rounded-full ${
                  chain === 'ethereum' ? 'bg-blue-400' : 'bg-purple-400'
                }`} />
                <span className="text-sm font-mono text-white/90">
                  {formatAddress(address)}
                </span>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-white">
                  Progress
                </span>
                <span className="text-sm text-white/70">
                  {Math.round(progress)}%
                </span>
              </div>
              
              <div className="relative w-full h-3 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                
                {/* Scanning line effect */}
                <motion.div
                  className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </div>
            </div>

            {/* Current Step */}
            <div className="text-center">
              <div className="inline-flex items-center space-x-3 px-4 py-2 bg-white/5 rounded-lg backdrop-blur-sm">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-4 h-4 text-blue-400" />
                </motion.div>
                <span className="text-sm text-white/80">
                  {currentStep}{dots}
                </span>
              </div>
            </div>

            {/* Animated dots */}
            <div className="flex justify-center space-x-2 mt-6">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-white/40 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.4, 1, 0.4]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EnhancedLoadingState;