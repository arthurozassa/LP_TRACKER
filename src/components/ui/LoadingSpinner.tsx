'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse' | 'ring' | 'bars' | 'protocol';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  color = 'primary',
  text,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'text-blue-500',
    secondary: 'text-purple-500',
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500'
  };

  // Animation styles
  const animationStyles = {
    spin: 'animate-spin',
    pulse: 'animate-pulse',
    bounce: 'animate-bounce'
  };

  const renderSpinner = () => {
    switch (variant) {
      case 'default':
        return (
          <div className={`${sizeClasses[size]} ${colorClasses[color]} animate-spin`}>
            <Loader2 className="w-full h-full" />
          </div>
        );

      case 'dots':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ animationDelay: `${i * 0.2}s` }}
                className={`w-2 h-2 bg-current rounded-full ${colorClasses[color]} animate-bounce`}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full bg-current animate-pulse`} />
        );

      case 'ring':
        return (
          <div className={`${sizeClasses[size]} ${colorClasses[color]} border-2 border-current border-t-transparent rounded-full animate-spin`} />
        );

      case 'bars':
        return (
          <div className="flex items-end space-x-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{ animationDelay: `${i * 0.1}s` }}
                className={`w-1 h-4 bg-current rounded-full ${colorClasses[color]} animate-bounce`}
              />
            ))}
          </div>
        );

      case 'protocol':
        return (
          <div className={`${sizeClasses[size]} ${colorClasses[color]} text-2xl animate-spin`}>
            🔄
          </div>
        );

      default:
        return (
          <div className={`${sizeClasses[size]} ${colorClasses[color]} animate-spin`}>
            <Loader2 className="w-full h-full" />
          </div>
        );
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`}>
      {renderSpinner()}
      {text && (
        <p className={`text-sm font-medium ${colorClasses[color]} animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;