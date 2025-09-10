import { NextRequest, NextResponse } from 'next/server';
import type { CorsConfig } from '@/types/api';

const defaultConfig: CorsConfig = {
  origins: [
    'http://localhost:3000',
    'https://localhost:3000',
    'https://lp-tracker.vercel.app',
    // Add your production domains here
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Client-Version',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

export function cors(config: Partial<CorsConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  return function corsMiddleware(request: NextRequest) {
    const origin = request.headers.get('origin');
    const method = request.method;

    // Handle preflight OPTIONS request
    if (method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin && isOriginAllowed(origin, finalConfig.origins) ? origin : '',
          'Access-Control-Allow-Methods': finalConfig.methods.join(', '),
          'Access-Control-Allow-Headers': finalConfig.allowedHeaders.join(', '),
          'Access-Control-Max-Age': finalConfig.maxAge?.toString() || '86400',
          'Access-Control-Allow-Credentials': finalConfig.credentials ? 'true' : 'false',
        },
      });
    }

    // Check if origin is allowed for actual requests
    if (origin && !isOriginAllowed(origin, finalConfig.origins)) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'CORS_ORIGIN_NOT_ALLOWED',
          message: 'Origin not allowed',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return null; // Continue to next middleware/handler
  };
}

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes('*')) {
    return true;
  }

  // Exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Pattern matching for wildcards (e.g., *.example.com)
  for (const allowedOrigin of allowedOrigins) {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(origin)) {
        return true;
      }
    }
  }

  return false;
}

export function setCorsHeaders(response: NextResponse, request: NextRequest, config: Partial<CorsConfig> = {}): NextResponse {
  const finalConfig = { ...defaultConfig, ...config };
  const origin = request.headers.get('origin');

  if (origin && isOriginAllowed(origin, finalConfig.origins)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('Access-Control-Allow-Methods', finalConfig.methods.join(', '));
  response.headers.set('Access-Control-Allow-Headers', finalConfig.allowedHeaders.join(', '));
  
  if (finalConfig.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}