'use client';

/**
 * Mode Management Context
 * Handles switching between demo and production modes with persistent state
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AppMode, { 
  isDemoMode as checkIsDemoMode,
  isProductionMode as checkIsProductionMode,
  getModeConfig,
  ModeConfig,
  detectEnvironment,
  EnvironmentDetection
} from '../production/utils/mode-detection';

interface ModeContextType {
  // Current mode state
  mode: 'demo' | 'production';
  isDemo: boolean;
  isProduction: boolean;
  
  // Configuration
  config: ModeConfig | null;
  environment: EnvironmentDetection | null;
  
  // Mode switching
  toggleMode: () => void;
  setMode: (mode: 'demo' | 'production') => void;
  
  // Transition states
  isTransitioning: boolean;
  transitionError: string | null;
  
  // Data source info
  dataSource: 'mock' | 'cache' | 'live';
  
  // Mode persistence
  hasPersistedMode: boolean;
  clearPersistedMode: () => void;
  
  // Hydration state
  isHydrated: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

const MODE_STORAGE_KEY = 'LP_TRACKER_MODE_PREFERENCE';
const MODE_OVERRIDE_KEY = 'LP_TRACKER_MODE_OVERRIDE';

interface ModeProviderProps {
  children: ReactNode;
  defaultMode?: 'demo' | 'production';
}

export function ModeProvider({ children, defaultMode }: ModeProviderProps) {
  // Initialize with server-safe default to prevent hydration mismatch
  const [mode, setModeState] = useState<'demo' | 'production'>(() => {
    // Only use environment/default on server, never localStorage
    return (defaultMode as 'demo' | 'production') || (checkIsDemoMode() ? 'demo' : 'production');
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [config, setConfig] = useState<ModeConfig | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentDetection | null>(null);
  const [hasPersistedMode, setHasPersistedMode] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load persisted mode after hydration to prevent server/client mismatch
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Check for override first (development utility)
      const override = localStorage.getItem(MODE_OVERRIDE_KEY);
      if (override === 'demo' || override === 'production') {
        setModeState(override as 'demo' | 'production');
        setIsHydrated(true);
        return;
      }
      
      // Check for user preference
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'demo' || stored === 'production') {
        setModeState(stored as 'demo' | 'production');
        setIsHydrated(true);
        return;
      }
    }
    
    setIsHydrated(true);
  }, []);

  // Derived state
  const isDemo = mode === 'demo';
  const isProduction = mode === 'production';
  const dataSource = isDemo ? 'mock' : 'live';

  // Initialize configuration
  useEffect(() => {
    try {
      const modeConfig = getModeConfig();
      const envDetection = detectEnvironment();
      setConfig(modeConfig);
      setEnvironment(envDetection);
      
      // Check if mode is persisted
      const hasStored = typeof window !== 'undefined' && 
        window.localStorage &&
        (localStorage.getItem(MODE_STORAGE_KEY) || localStorage.getItem(MODE_OVERRIDE_KEY));
      setHasPersistedMode(!!hasStored);
      
    } catch (error) {
      console.error('Failed to initialize mode configuration:', error);
      setTransitionError('Failed to initialize mode configuration');
    }
  }, [mode]);

  // Persist mode changes to localStorage (only after hydration)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined' && window.localStorage) {
      try {
        // Don't persist if there's an override (development utility)
        const hasOverride = localStorage.getItem(MODE_OVERRIDE_KEY);
        if (!hasOverride) {
          localStorage.setItem(MODE_STORAGE_KEY, mode);
        }
        setHasPersistedMode(true);
      } catch (error) {
        console.warn('Failed to persist mode to localStorage:', error);
      }
    }
  }, [mode, isHydrated]);

  const setMode = async (newMode: 'demo' | 'production') => {
    if (newMode === mode) return;

    setIsTransitioning(true);
    setTransitionError(null);

    try {
      // Simulate transition delay for smooth UX
      await new Promise(resolve => setTimeout(resolve, 300));

      // Validate mode change is possible
      if (newMode === 'production') {
        // Check if production mode is properly configured
        const testConfig = getModeConfig();
        if (!testConfig) {
          throw new Error('Production mode configuration not available');
        }
      }

      setModeState(newMode);
      
      // Log mode change for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`LP Tracker mode changed: ${mode} -> ${newMode}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during mode transition';
      setTransitionError(errorMessage);
      console.error('Mode transition failed:', error);
    } finally {
      setIsTransitioning(false);
    }
  };

  const toggleMode = () => {
    const newMode = isDemo ? 'production' : 'demo';
    setMode(newMode);
  };

  const clearPersistedMode = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(MODE_STORAGE_KEY);
        localStorage.removeItem(MODE_OVERRIDE_KEY);
        setHasPersistedMode(false);
        
        // Reset to environment default
        const envDefault = checkIsDemoMode() ? 'demo' : 'production';
        setMode(envDefault);
      } catch (error) {
        console.warn('Failed to clear persisted mode:', error);
      }
    }
  };

  const contextValue: ModeContextType = {
    mode,
    isDemo,
    isProduction,
    config,
    environment,
    toggleMode,
    setMode,
    isTransitioning,
    transitionError,
    dataSource,
    hasPersistedMode,
    clearPersistedMode,
    isHydrated,
  };

  return (
    <ModeContext.Provider value={contextValue}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextType {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}

// Custom hooks for specific mode checks
export function useIsDemo(): boolean {
  const { isDemo } = useMode();
  return isDemo;
}

export function useIsProduction(): boolean {
  const { isProduction } = useMode();
  return isProduction;
}

export function useModeConfig(): ModeConfig | null {
  const { config } = useMode();
  return config;
}

export function useDataSource(): 'mock' | 'cache' | 'live' {
  const { dataSource } = useMode();
  return dataSource;
}

// HOC for mode-aware components
export function withMode<P extends object>(
  Component: React.ComponentType<P & { mode: 'demo' | 'production'; isDemo: boolean; isProduction: boolean }>
) {
  return function ModeAwareComponent(props: P) {
    const { mode, isDemo, isProduction } = useMode();
    return <Component {...props} mode={mode} isDemo={isDemo} isProduction={isProduction} />;
  };
}

export default ModeContext;