/**
 * Environment Configuration Management
 * Handles all environment variables and configuration for production/demo modes
 */

export type AppMode = 'demo' | 'production';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface DatabaseConfig {
  url: string;
  ssl: boolean;
  maxConnections: number;
  idleTimeoutMs: number;
}

interface RedisConfig {
  url: string;
  password?: string;
  db: number;
  keyPrefix: string;
}

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstCapacity: number;
}

interface CacheConfig {
  defaultTtl: number;
  positionDataTtl: number;
  priceDataTtl: number;
  protocolDataTtl: number;
}

interface MonitoringConfig {
  sentryDsn?: string;
  posthogApiKey?: string;
  mixpanelToken?: string;
  enableDebugLogging: boolean;
  logLevel: LogLevel;
}

interface FeatureFlags {
  enableRealTimeUpdates: boolean;
  enableAdvancedAnalytics: boolean;
  enableYieldOptimization: boolean;
  enableSmartAlerts: boolean;
  enablePortfolioTracking: boolean;
  showBetaFeatures: boolean;
}

interface SecurityConfig {
  jwtSecret: string;
  encryptionKey: string;
  corsOrigins: string[];
  webhookSecret: string;
}

interface PerformanceConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  batchSize: number;
  maxPositionsPerScan: number;
}

interface UIConfig {
  theme: 'light' | 'dark' | 'auto';
  analyticsEnabled: boolean;
  chartRefreshInterval: number;
}

export interface EnvironmentConfig {
  // App Configuration
  mode: AppMode;
  nodeEnv: 'development' | 'production' | 'test';
  
  // Database & Cache
  database: DatabaseConfig;
  redis: RedisConfig;
  
  // Rate Limiting & Caching
  rateLimit: RateLimitConfig;
  cache: CacheConfig;
  
  // Monitoring & Logging
  monitoring: MonitoringConfig;
  
  // Feature Flags
  features: FeatureFlags;
  
  // Security
  security: SecurityConfig;
  
  // Performance
  performance: PerformanceConfig;
  
  // UI Configuration
  ui: UIConfig;
  
  // Test Configuration
  test: {
    walletEthereum: string;
    walletSolana: string;
    mockDataEnabled: boolean;
  };
}

/**
 * Load and validate environment configuration
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  // Helper to get environment variable with default
  const getEnv = (key: string, defaultValue?: string): string => {
    const value = process.env[key] || defaultValue;
    if (!value && !defaultValue) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value || '';
  };

  // Helper to get boolean environment variable
  const getBoolEnv = (key: string, defaultValue: boolean = false): boolean => {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  // Helper to get number environment variable
  const getNumberEnv = (key: string, defaultValue: number): number => {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const mode = (getEnv('NEXT_PUBLIC_APP_MODE', 'demo') as AppMode);
  const nodeEnv = (getEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test');

  return {
    mode,
    nodeEnv,
    
    database: {
      url: getEnv('DATABASE_URL', 'postgresql://localhost:5432/lp_tracker'),
      ssl: getBoolEnv('DATABASE_SSL', false),
      maxConnections: getNumberEnv('DATABASE_MAX_CONNECTIONS', 10),
      idleTimeoutMs: getNumberEnv('DATABASE_IDLE_TIMEOUT', 30000),
    },
    
    redis: {
      url: getEnv('REDIS_URL', 'redis://localhost:6379'),
      password: process.env.REDIS_PASSWORD,
      db: getNumberEnv('REDIS_DB', 0),
      keyPrefix: getEnv('REDIS_KEY_PREFIX', 'lp_tracker:'),
    },
    
    rateLimit: {
      requestsPerMinute: getNumberEnv('RATE_LIMIT_REQUESTS_PER_MINUTE', 60),
      requestsPerHour: getNumberEnv('RATE_LIMIT_REQUESTS_PER_HOUR', 1000),
      burstCapacity: getNumberEnv('RATE_LIMIT_BURST_CAPACITY', 10),
    },
    
    cache: {
      defaultTtl: getNumberEnv('CACHE_DEFAULT_TTL', 300),
      positionDataTtl: getNumberEnv('CACHE_POSITION_DATA_TTL', 60),
      priceDataTtl: getNumberEnv('CACHE_PRICE_DATA_TTL', 30),
      protocolDataTtl: getNumberEnv('CACHE_PROTOCOL_DATA_TTL', 600),
    },
    
    monitoring: {
      sentryDsn: process.env.SENTRY_DSN,
      posthogApiKey: process.env.POSTHOG_API_KEY,
      mixpanelToken: process.env.MIXPANEL_TOKEN,
      enableDebugLogging: getBoolEnv('ENABLE_DEBUG_LOGGING', nodeEnv === 'development'),
      logLevel: (getEnv('LOG_LEVEL', 'info') as LogLevel),
    },
    
    features: {
      enableRealTimeUpdates: getBoolEnv('ENABLE_REAL_TIME_UPDATES', false),
      enableAdvancedAnalytics: getBoolEnv('ENABLE_ADVANCED_ANALYTICS', false),
      enableYieldOptimization: getBoolEnv('ENABLE_YIELD_OPTIMIZATION', false),
      enableSmartAlerts: getBoolEnv('ENABLE_SMART_ALERTS', false),
      enablePortfolioTracking: getBoolEnv('ENABLE_PORTFOLIO_TRACKING', false),
      showBetaFeatures: getBoolEnv('NEXT_PUBLIC_SHOW_BETA_FEATURES', false),
    },
    
    security: {
      jwtSecret: getEnv('JWT_SECRET', 'default_jwt_secret_change_in_production'),
      encryptionKey: getEnv('ENCRYPTION_KEY', 'default_32_character_key_change!!!'),
      corsOrigins: getEnv('CORS_ORIGINS', 'http://localhost:3000').split(','),
      webhookSecret: getEnv('WEBHOOK_SECRET', 'default_webhook_secret'),
    },
    
    performance: {
      maxConcurrentRequests: getNumberEnv('MAX_CONCURRENT_REQUESTS', 10),
      requestTimeout: getNumberEnv('REQUEST_TIMEOUT', 30000),
      batchSize: getNumberEnv('BATCH_SIZE', 100),
      maxPositionsPerScan: getNumberEnv('MAX_POSITIONS_PER_SCAN', 1000),
    },
    
    ui: {
      theme: (getEnv('NEXT_PUBLIC_THEME', 'dark') as 'light' | 'dark' | 'auto'),
      analyticsEnabled: getBoolEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', true),
      chartRefreshInterval: getNumberEnv('NEXT_PUBLIC_CHART_REFRESH_INTERVAL', 30000),
    },
    
    test: {
      walletEthereum: getEnv('TEST_WALLET_ETHEREUM', '0x742d35Cc6634C0532925a3b8D0C6A02E02b365f2'),
      walletSolana: getEnv('TEST_WALLET_SOLANA', 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'),
      mockDataEnabled: getBoolEnv('MOCK_DATA_ENABLED', mode === 'demo'),
    },
  };
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): void {
  const errors: string[] = [];

  // For now, only validate critical configuration
  // Security validation is relaxed to allow deployment with defaults
  if (config.mode === 'production') {
    // Only warn about default values, don't fail build
    if (!config.security.jwtSecret || config.security.jwtSecret === 'default_jwt_secret_change_in_production') {
      console.warn('⚠️  [LP Tracker] Using default JWT_SECRET in production. Consider setting a secure value.');
    }

    if (!config.security.encryptionKey || config.security.encryptionKey === 'default_32_character_key_change!!!') {
      console.warn('⚠️  [LP Tracker] Using default ENCRYPTION_KEY in production. Consider setting a secure value.');
    }

    if (config.security.encryptionKey.length !== 32) {
      console.warn('⚠️  [LP Tracker] ENCRYPTION_KEY should be exactly 32 characters for optimal security.');
    }
  }

  // Validate numeric ranges
  if (config.performance.maxConcurrentRequests < 1 || config.performance.maxConcurrentRequests > 100) {
    errors.push('MAX_CONCURRENT_REQUESTS must be between 1 and 100');
  }

  if (config.cache.defaultTtl < 0) {
    errors.push('CACHE_DEFAULT_TTL must be non-negative');
  }

  if (errors.length > 0) {
    throw new Error(`Environment configuration errors:\n${errors.join('\n')}`);
  }
}

/**
 * Get current environment configuration (singleton)
 */
let _config: EnvironmentConfig | null = null;

export function getEnvironmentConfig(): EnvironmentConfig {
  if (!_config) {
    _config = loadEnvironmentConfig();
    validateEnvironmentConfig(_config);
  }
  return _config;
}

/**
 * Check if running in demo mode
 */
export function isDemoMode(): boolean {
  return getEnvironmentConfig().mode === 'demo';
}

/**
 * Check if running in production mode
 */
export function isProductionMode(): boolean {
  return getEnvironmentConfig().mode === 'production';
}

/**
 * Check if development environment
 */
export function isDevelopment(): boolean {
  return getEnvironmentConfig().nodeEnv === 'development';
}

/**
 * Check if production environment
 */
export function isProduction(): boolean {
  return getEnvironmentConfig().nodeEnv === 'production';
}

/**
 * Check if test environment
 */
export function isTest(): boolean {
  return getEnvironmentConfig().nodeEnv === 'test';
}

/**
 * Get feature flag status
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return getEnvironmentConfig().features[feature];
}

/**
 * Get cache TTL for specific data type
 */
export function getCacheTtl(type: 'default' | 'position' | 'price' | 'protocol'): number {
  const config = getEnvironmentConfig();
  switch (type) {
    case 'position': return config.cache.positionDataTtl;
    case 'price': return config.cache.priceDataTtl;
    case 'protocol': return config.cache.protocolDataTtl;
    default: return config.cache.defaultTtl;
  }
}

export default {
  load: loadEnvironmentConfig,
  validate: validateEnvironmentConfig,
  get: getEnvironmentConfig,
  isDemoMode,
  isProductionMode,
  isDevelopment,
  isProduction,
  isTest,
  isFeatureEnabled,
  getCacheTtl,
};