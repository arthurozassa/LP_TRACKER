// Middleware exports
export { cors, setCorsHeaders } from './cors';
export { 
  rateLimit, 
  addRateLimitHeaders, 
  createEndpointRateLimit, 
  cleanupRateLimitStore, 
  getRateLimitStatus,
  rateLimitConfigs 
} from './rateLimit';
export { 
  errorHandler, 
  asyncHandler, 
  successResponse, 
  errorResponse, 
  compose,
  ApiError,
  ValidationError,
  RateLimitError,
  ScanError 
} from './errorHandler';

// Re-export types for convenience
export type { RateLimitConfig, CorsConfig, ErrorHandlerConfig } from '@/types/api';