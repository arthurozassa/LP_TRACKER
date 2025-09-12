/**
 * Mode Detection System
 * Handles switching between demo and production modes with feature detection
 */

import { AppMode } from '../config/environment';
import { ProductionFeatureFlags } from '../types/production';

export interface ModeConfig {
  mode: AppMode;
  features: ProductionFeatureFlags;
  dataSource: 'mock' | 'cache' | 'live';
  rateLimits: {
    enabled: boolean;
    requestsPerMinute: number;
    burstCapacity: number;
  };
  monitoring: {
    enabled: boolean;
    level: 'basic' | 'detailed' | 'comprehensive';
  };
  ui: {
    showBetaFeatures: boolean;
    showPerformanceMetrics: boolean;
    enableRealTimeUpdates: boolean;
  };
}

export interface EnvironmentDetection {
  isServer: boolean;
  isClient: boolean;
  isBrowser: boolean;
  isNode: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  hasWebGL: boolean;
  hasWebSockets: boolean;
  hasLocalStorage: boolean;
  hasServiceWorkers: boolean;
  supportsNotifications: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
}

/**
 * Detect current environment and capabilities
 */
export function detectEnvironment(): EnvironmentDetection {
  const isServer = typeof window === 'undefined';
  const isClient = !isServer;
  const isBrowser = isClient && typeof document !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions?.node;

  let hasWebGL = false;
  let hasWebSockets = false;
  let hasLocalStorage = false;
  let hasServiceWorkers = false;
  let supportsNotifications = false;
  let isMobile = false;
  let isTablet = false;
  let isDesktop = false;
  let browserName: string | undefined;
  let browserVersion: string | undefined;
  let osName: string | undefined;
  let osVersion: string | undefined;

  if (isBrowser) {
    // WebGL detection
    try {
      const canvas = document.createElement('canvas');
      hasWebGL = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      hasWebGL = false;
    }

    // WebSocket detection
    hasWebSockets = 'WebSocket' in window || 'MozWebSocket' in window;

    // LocalStorage detection
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      hasLocalStorage = true;
    } catch (e) {
      hasLocalStorage = false;
    }

    // Service Workers detection
    hasServiceWorkers = 'serviceWorker' in navigator;

    // Notifications detection
    supportsNotifications = 'Notification' in window;

    // Device type detection
    const userAgent = navigator.userAgent.toLowerCase();
    isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    isTablet = /ipad|android|tablet/i.test(userAgent) && !isMobile;
    isDesktop = !isMobile && !isTablet;

    // Browser detection
    if (userAgent.includes('chrome')) {
      browserName = 'Chrome';
      browserVersion = userAgent.match(/chrome\/([\d.]+)/)?.[1];
    } else if (userAgent.includes('firefox')) {
      browserName = 'Firefox';
      browserVersion = userAgent.match(/firefox\/([\d.]+)/)?.[1];
    } else if (userAgent.includes('safari')) {
      browserName = 'Safari';
      browserVersion = userAgent.match(/version\/([\d.]+)/)?.[1];
    } else if (userAgent.includes('edge')) {
      browserName = 'Edge';
      browserVersion = userAgent.match(/edge\/([\d.]+)/)?.[1];
    }

    // OS detection
    if (userAgent.includes('mac')) {
      osName = 'macOS';
    } else if (userAgent.includes('win')) {
      osName = 'Windows';
    } else if (userAgent.includes('linux')) {
      osName = 'Linux';
    } else if (userAgent.includes('android')) {
      osName = 'Android';
    } else if (userAgent.includes('ios')) {
      osName = 'iOS';
    }
  }

  return {
    isServer,
    isClient,
    isBrowser,
    isNode: !!isNode,
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    hasWebGL,
    hasWebSockets,
    hasLocalStorage,
    hasServiceWorkers,
    supportsNotifications,
    isMobile,
    isTablet,
    isDesktop,
    browserName,
    browserVersion,
    osName,
    osVersion,
  };
}

/**
 * Get current app mode from environment
 */
export function getCurrentMode(): AppMode {
  const mode = process.env.NEXT_PUBLIC_APP_MODE as AppMode;
  return mode === 'production' ? 'production' : 'demo';
}

/**
 * Check if running in demo mode
 */
export function isDemoMode(): boolean {
  return getCurrentMode() === 'demo';
}

/**
 * Check if running in production mode
 */
export function isProductionMode(): boolean {
  return getCurrentMode() === 'production';
}

/**
 * Get production feature flags based on mode and environment
 */
export function getProductionFeatures(): ProductionFeatureFlags {
  const mode = getCurrentMode();
  const env = detectEnvironment();
  
  if (mode === 'demo') {
    return {
      realTimeData: false,
      advancedAnalytics: false,
      portfolioTracking: true,
      yieldOptimization: false,
      smartAlerts: false,
      socialFeatures: false,
      apiAccess: false,
      webhooks: false,
    };
  }

  // Production mode - check individual feature flags
  return {
    realTimeData: process.env.ENABLE_REAL_TIME_UPDATES === 'true' && env.hasWebSockets,
    advancedAnalytics: process.env.ENABLE_ADVANCED_ANALYTICS === 'true',
    portfolioTracking: process.env.ENABLE_PORTFOLIO_TRACKING === 'true',
    yieldOptimization: process.env.ENABLE_YIELD_OPTIMIZATION === 'true',
    smartAlerts: process.env.ENABLE_SMART_ALERTS === 'true' && env.supportsNotifications,
    socialFeatures: process.env.ENABLE_SOCIAL_FEATURES === 'true',
    apiAccess: process.env.ENABLE_API_ACCESS === 'true',
    webhooks: process.env.ENABLE_WEBHOOKS === 'true',
  };
}

/**
 * Get complete mode configuration
 */
export function getModeConfig(): ModeConfig {
  const mode = getCurrentMode();
  const features = getProductionFeatures();
  const env = detectEnvironment();

  const baseConfig: ModeConfig = {
    mode,
    features,
    dataSource: mode === 'demo' ? 'mock' : 'live',
    rateLimits: {
      enabled: mode === 'production',
      requestsPerMinute: mode === 'demo' ? 1000 : 60,
      burstCapacity: mode === 'demo' ? 50 : 10,
    },
    monitoring: {
      enabled: mode === 'production' || env.isDevelopment,
      level: mode === 'demo' ? 'basic' : 'comprehensive',
    },
    ui: {
      showBetaFeatures: process.env.NEXT_PUBLIC_SHOW_BETA_FEATURES === 'true',
      showPerformanceMetrics: env.isDevelopment || mode === 'production',
      enableRealTimeUpdates: features.realTimeData,
    },
  };

  // Adjust config based on environment capabilities
  if (!env.hasWebSockets) {
    baseConfig.features.realTimeData = false;
    baseConfig.ui.enableRealTimeUpdates = false;
  }

  if (!env.hasLocalStorage) {
    // Disable features that require local storage
    baseConfig.features.portfolioTracking = false;
  }

  if (env.isMobile) {
    // Adjust for mobile limitations
    baseConfig.rateLimits.requestsPerMinute = Math.floor(baseConfig.rateLimits.requestsPerMinute * 0.5);
    baseConfig.monitoring.level = 'basic';
  }

  return baseConfig;
}

/**
 * Check if a specific feature is available
 */
export function isFeatureAvailable(feature: keyof ProductionFeatureFlags): boolean {
  const config = getModeConfig();
  return config.features[feature];
}

/**
 * Get data source strategy based on mode
 */
export function getDataSourceStrategy(): {
  source: 'mock' | 'cache' | 'live';
  cacheDuration: number;
  fallbackToCache: boolean;
  enablePrefetch: boolean;
} {
  const mode = getCurrentMode();
  const env = detectEnvironment();

  if (mode === 'demo') {
    return {
      source: 'mock',
      cacheDuration: 0,
      fallbackToCache: false,
      enablePrefetch: false,
    };
  }

  return {
    source: 'live',
    cacheDuration: env.isMobile ? 300 : 60, // 5 minutes on mobile, 1 minute on desktop
    fallbackToCache: true,
    enablePrefetch: !env.isMobile,
  };
}

/**
 * Get API configuration based on mode and environment
 */
export function getApiConfig(): {
  baseUrl: string;
  timeout: number;
  retries: number;
  rateLimitEnabled: boolean;
  headers: Record<string, string>;
} {
  const mode = getCurrentMode();
  const env = detectEnvironment();

  return {
    baseUrl: env.isProduction ? 'https://api.lptracker.com' : '/api',
    timeout: env.isMobile ? 15000 : 30000,
    retries: mode === 'demo' ? 0 : 3,
    rateLimitEnabled: mode === 'production',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0',
      'X-Client-Mode': mode,
      'X-Client-Platform': env.isMobile ? 'mobile' : 'desktop',
    },
  };
}

/**
 * Initialize mode-specific settings
 */
export function initializeModeSettings(): {
  config: ModeConfig;
  environment: EnvironmentDetection;
  warnings: string[];
} {
  const config = getModeConfig();
  const environment = detectEnvironment();
  const warnings: string[] = [];

  // Check for potential issues
  if (config.mode === 'production' && environment.isDevelopment) {
    warnings.push('Running in production mode on development environment');
  }

  if (config.features.realTimeData && !environment.hasWebSockets) {
    warnings.push('Real-time data enabled but WebSockets not available');
  }

  if (config.features.smartAlerts && !environment.supportsNotifications) {
    warnings.push('Smart alerts enabled but notifications not supported');
  }

  if (!environment.hasLocalStorage) {
    warnings.push('Local storage not available - some features may not work');
  }

  if (environment.isMobile && config.monitoring.level === 'comprehensive') {
    warnings.push('Comprehensive monitoring on mobile may impact performance');
  }

  // Log mode initialization
  if (environment.isDevelopment) {
    console.log('LP Tracker Mode Configuration:', {
      mode: config.mode,
      features: Object.entries(config.features)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name),
      dataSource: config.dataSource,
      environment: {
        platform: environment.isMobile ? 'mobile' : 'desktop',
        browser: environment.browserName,
        hasWebSockets: environment.hasWebSockets,
        hasLocalStorage: environment.hasLocalStorage,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    }, 'Logger message');
  }

  return {
    config,
    environment,
    warnings,
  };
}

/**
 * Switch between modes (development utility)
 */
export function switchMode(newMode: AppMode): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('LP_TRACKER_MODE_OVERRIDE', newMode);
    window.location.reload();
  }
}

/**
 * Clear mode override (development utility)
 */
export function clearModeOverride(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('LP_TRACKER_MODE_OVERRIDE');
    window.location.reload();
  }
}

export default {
  detectEnvironment,
  getCurrentMode,
  isDemoMode,
  isProductionMode,
  getProductionFeatures,
  getModeConfig,
  isFeatureAvailable,
  getDataSourceStrategy,
  getApiConfig,
  initializeModeSettings,
  switchMode,
  clearModeOverride,
};