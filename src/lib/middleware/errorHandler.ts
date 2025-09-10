import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, ApiError, ValidationError } from '@/types/api';
import { HTTP_STATUS, ERROR_CODES } from '@/types/api';

// Custom error classes
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public field: string,
    public value?: any
  ) {
    super(ERROR_CODES.MISSING_REQUIRED_FIELD, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, { field, value });
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(ERROR_CODES.RATE_LIMIT_EXCEEDED, message, HTTP_STATUS.TOO_MANY_REQUESTS);
    this.name = 'RateLimitError';
  }
}

export class ScanError extends ApiError {
  constructor(code: string, message: string, public protocol?: string) {
    super(code, message, HTTP_STATUS.BAD_REQUEST, { protocol });
    this.name = 'ScanError';
  }
}

// Error handler middleware
export function errorHandler(
  error: Error,
  request: NextRequest,
  context?: { endpoint: string; method: string }
): NextResponse {
  console.error(`API Error [${context?.method} ${context?.endpoint}]:`, {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: request.url,
    timestamp: new Date().toISOString(),
  });

  // Handle known error types
  if (error instanceof ApiError) {
    const response: ApiResponse = {
      success: false,
      error: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Handle validation errors (from Zod or similar)
  if (error.name === 'ZodError') {
    const zodError = error as any;
    const validationErrors: ValidationError[] = zodError.errors?.map((err: any) => ({
      code: ERROR_CODES.INVALID_WALLET_ADDRESS,
      message: err.message,
      field: err.path?.join('.') || 'unknown',
      details: err,
    })) || [];

    const response: ApiResponse<ValidationError[]> = {
      success: false,
      error: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: 'Validation failed',
      data: validationErrors,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Handle network/fetch errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    const response: ApiResponse = {
      success: false,
      error: ERROR_CODES.EXTERNAL_API_ERROR,
      message: 'External service unavailable',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: HTTP_STATUS.BAD_GATEWAY,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Handle timeout errors
  if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
    const response: ApiResponse = {
      success: false,
      error: ERROR_CODES.SCAN_TIMEOUT,
      message: 'Request timeout',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: HTTP_STATUS.GATEWAY_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Generic error handler
  const response: ApiResponse = {
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };

  // In development, include stack trace
  if (process.env.NODE_ENV === 'development') {
    (response as any).stack = error.stack;
    (response as any).details = error.message;
  }

  return NextResponse.json(response, {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Async error wrapper for route handlers
export function asyncHandler(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorHandler(error as Error, request, {
        endpoint: request.url,
        method: request.method,
      });
    }
  };
}

// Success response helper
export function successResponse<T = any>(
  data?: T,
  message?: string,
  status: number = HTTP_STATUS.OK
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Error response helper
export function errorResponse(
  code: string,
  message: string,
  status: number = HTTP_STATUS.BAD_REQUEST,
  details?: any
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error: code,
    message,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    (response as any).details = details;
  }

  return NextResponse.json(response, {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Middleware compose function
export function compose(...middlewares: Array<(req: NextRequest) => NextResponse | null>) {
  return function composedMiddleware(request: NextRequest): NextResponse | null {
    for (const middleware of middlewares) {
      const result = middleware(request);
      if (result) {
        return result; // Stop execution if middleware returns a response
      }
    }
    return null; // Continue to handler
  };
}