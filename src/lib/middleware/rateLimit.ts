import { NextRequest, NextResponse } from 'next/server';
import type { RateLimitConfig, RateLimitInfo, ApiResponse } from '@/types/api';
import { HTTP_STATUS, ERROR_CODES } from '@/types/api';

// In-memory store for rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number; windowStart: number }>();

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per window
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req: NextRequest) => {
    // Use IP address as default key
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
    return `rate-limit:${ip}`;
  },
};

// Different rate limits for different endpoints
export const rateLimitConfigs = {
  scan: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10, // 10 scans per 5 minutes
  },
  protocols: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  positions: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  analytics: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 20, // 20 requests per 5 minutes
  },
  health: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
} as const;

export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  return function rateLimitMiddleware(request: NextRequest): NextResponse | null {
    const key = finalConfig.keyGenerator!(request);
    const now = Date.now();
    const windowStart = Math.floor(now / finalConfig.windowMs) * finalConfig.windowMs;
    
    // Get or create rate limit entry
    let rateLimitEntry = rateLimitStore.get(key);
    
    if (!rateLimitEntry || rateLimitEntry.windowStart !== windowStart) {
      // New window or first request
      rateLimitEntry = {
        count: 0,
        resetTime: windowStart + finalConfig.windowMs,
        windowStart,
      };
      rateLimitStore.set(key, rateLimitEntry);
    }

    // Check if limit exceeded
    if (rateLimitEntry.count >= finalConfig.maxRequests) {
      const rateLimitInfo: RateLimitInfo = {
        limit: finalConfig.maxRequests,
        remaining: 0,
        resetTime: rateLimitEntry.resetTime,
        windowSize: finalConfig.windowMs,
      };

      const response: ApiResponse = {
        success: false,
        error: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitEntry.resetTime - now) / 1000)} seconds.`,
        timestamp: new Date().toISOString(),
      };

      return new NextResponse(JSON.stringify(response), {
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitEntry.resetTime.toString(),
          'X-RateLimit-Window': finalConfig.windowMs.toString(),
          'Retry-After': Math.ceil((rateLimitEntry.resetTime - now) / 1000).toString(),
        },
      });
    }

    // Increment counter
    rateLimitEntry.count++;
    rateLimitStore.set(key, rateLimitEntry);

    return null; // Continue to next middleware/handler
  };
}

export function addRateLimitHeaders(response: NextResponse, request: NextRequest, config: Partial<RateLimitConfig> = {}): NextResponse {
  const finalConfig = { ...defaultConfig, ...config };
  const key = finalConfig.keyGenerator!(request);
  const rateLimitEntry = rateLimitStore.get(key);

  if (rateLimitEntry) {
    const remaining = Math.max(0, finalConfig.maxRequests - rateLimitEntry.count);
    
    response.headers.set('X-RateLimit-Limit', finalConfig.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitEntry.resetTime.toString());
    response.headers.set('X-RateLimit-Window', finalConfig.windowMs.toString());
  }

  return response;
}

// Cleanup function to remove expired entries (call periodically)
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}

// Get current rate limit status for a request
export function getRateLimitStatus(request: NextRequest, config: Partial<RateLimitConfig> = {}): RateLimitInfo {
  const finalConfig = { ...defaultConfig, ...config };
  const key = finalConfig.keyGenerator!(request);
  const rateLimitEntry = rateLimitStore.get(key);

  if (!rateLimitEntry) {
    return {
      limit: finalConfig.maxRequests,
      remaining: finalConfig.maxRequests,
      resetTime: Date.now() + finalConfig.windowMs,
      windowSize: finalConfig.windowMs,
    };
  }

  return {
    limit: finalConfig.maxRequests,
    remaining: Math.max(0, finalConfig.maxRequests - rateLimitEntry.count),
    resetTime: rateLimitEntry.resetTime,
    windowSize: finalConfig.windowMs,
  };
}

// Utility to create endpoint-specific rate limiters
export function createEndpointRateLimit(endpoint: keyof typeof rateLimitConfigs) {
  const config = rateLimitConfigs[endpoint];
  return rateLimit({
    ...config,
    keyGenerator: (req: NextRequest) => {
      const forwarded = req.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
      return `rate-limit:${endpoint}:${ip}`;
    },
  });
}