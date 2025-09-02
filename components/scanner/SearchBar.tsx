'use client';

import React, { useState } from 'react';
import { Search, Wallet, Loader2 } from 'lucide-react';
import { SearchBarProps, Chain } from '../../types/components/SearchBar';
import { validateAddress, formatAddress } from '../../utils/chains/validation';
import { DEMO_ADDRESSES } from '../../utils/chains/demoAddresses';
import ChainIndicator from '../ui/ChainIndicator';

const SearchBar: React.FC<SearchBarProps> = ({ onScan, isLoading = false }) => {
  const [address, setAddress] = useState('');
  const [detectedChain, setDetectedChain] = useState<Chain | null>(null);
  const [error, setError] = useState('');

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setAddress(value);
    
    if (value) {
      const validation = validateAddress(value);
      setDetectedChain(validation.chain);
      setError(validation.error || '');
    } else {
      setDetectedChain(null);
      setError('');
    }
  };

  const handleScan = () => {
    const validation = validateAddress(address);
    
    if (!validation.isValid) {
      setError(validation.error || 'Invalid address');
      return;
    }

    if (validation.chain) {
      onScan(address.trim(), validation.chain);
    }
  };

  const handleDemoClick = (demo: typeof DEMO_ADDRESSES[0]) => {
    setAddress(demo.address);
    setDetectedChain(demo.chain);
    setError('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && detectedChain) {
      handleScan();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Search Input */}
      <div className="relative">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Wallet className="h-5 w-5 text-white/60" />
              </div>
              <input
                type="text"
                value={address}
                onChange={handleAddressChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter wallet address (Ethereum or Solana)"
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all duration-200"
                disabled={isLoading}
                aria-label="Wallet address input"
                aria-describedby={error ? "address-error" : undefined}
              />
            </div>

            {/* Chain Detection Feedback */}
            {address && (
              <div className="flex items-center space-x-2">
                {detectedChain ? (
                  <div className="flex items-center space-x-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm font-medium capitalize">
                      {detectedChain} address detected
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-red-400">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span className="text-sm">Invalid address format</span>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div id="address-error" className="text-red-400 text-sm" role="alert">
                {error}
              </div>
            )}

            {/* Scan Button */}
            <button
              onClick={handleScan}
              disabled={isLoading || !detectedChain || !!error}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Scanning All DEXs...</span>
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  <span>Scan All DEXs</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Demo Addresses */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl">
        <h3 className="text-white font-semibold mb-4">Try Demo Addresses</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEMO_ADDRESSES.map((demo, index) => (
            <button
              key={index}
              onClick={() => handleDemoClick(demo)}
              disabled={isLoading}
              className="p-4 bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-400/50 border border-white/20 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Use demo address: ${demo.label} (${demo.chain})`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <ChainIndicator chain={demo.chain} size="md" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-medium text-sm">{demo.label}</div>
                  <div className="text-white/60 text-xs">{demo.description}</div>
                  <div className="text-white/40 text-xs font-mono mt-1 truncate">
                    {formatAddress(demo.address)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;