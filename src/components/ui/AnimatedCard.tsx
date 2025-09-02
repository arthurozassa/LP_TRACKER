'use client';

import React from 'react';

interface AnimatedCardProps {
  children: React.ReactNode;
  variant?: 'fadeIn' | 'slideUp' | 'slideInLeft' | 'slideInRight' | 'scale' | 'flip';
  delay?: number;
  duration?: number;
  className?: string;
  hover?: boolean;
  tap?: boolean;
  loading?: boolean;
  error?: boolean;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  variant = 'fadeIn',
  delay = 0,
  duration = 0.5,
  className = '',
  hover = true,
  tap = true,
  loading = false,
  error = false
}) => {
  const getAnimationClasses = () => {
    let baseClasses = 'transition-all duration-500 ease-out';
    
    switch (variant) {
      case 'fadeIn':
        baseClasses += ' animate-fadeIn';
        break;
      case 'slideUp':
        baseClasses += ' animate-slideUp';
        break;
      case 'slideInLeft':
        baseClasses += ' animate-slideInLeft';
        break;
      case 'slideInRight':
        baseClasses += ' animate-slideInRight';
        break;
      case 'scale':
        baseClasses += ' animate-scale';
        break;
      case 'flip':
        baseClasses += ' animate-flip';
        break;
    }

    if (hover) {
      baseClasses += ' hover:scale-105 hover:-translate-y-1 hover:shadow-lg';
    }

    if (tap) {
      baseClasses += ' active:scale-95';
    }

    if (loading) {
      baseClasses += ' animate-pulse pointer-events-none opacity-70';
    }

    if (error) {
      baseClasses += ' animate-shake border-red-500/50';
    }

    return baseClasses;
  };

  return (
    <div
      className={`${getAnimationClasses()} ${className}`}
      style={{ 
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`
      }}
    >
      {children}
    </div>
  );
};

export default AnimatedCard;