import { NextRequest } from 'next/server';
import { asyncHandler, successResponse, errorResponse } from '@/lib/middleware/errorHandler';
import { cors, setCorsHeaders } from '@/lib/middleware/cors';
import { createEndpointRateLimit, addRateLimitHeaders } from '@/lib/middleware/rateLimit';
import type { HealthCheckResponse } from '@/types/api';
import { HTTP_STATUS } from '@/types/api';

// System startup time for uptime calculation
const startupTime = Date.now();

// Mock service health checkers (in production, implement real health checks)
async function checkDatabaseHealth(): Promise<'healthy' | 'unhealthy'> {
  try {
    // Mock database ping
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    // Simulate occasional database issues
    if (Math.random() < 0.05) { // 5% chance of failure
      throw new Error('Database connection timeout');
    }
    
    return 'healthy';
  } catch (error) {
    console.error('Database health check failed:', error);
    return 'unhealthy';
  }
}

async function checkCacheHealth(): Promise<'healthy' | 'unhealthy'> {
  try {
    // Mock cache ping
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    
    // Simulate cache issues
    if (Math.random() < 0.02) { // 2% chance of failure
      throw new Error('Cache unavailable');
    }
    
    return 'healthy';
  } catch (error) {
    console.error('Cache health check failed:', error);
    return 'unhealthy';
  }
}

async function checkExternalApiHealth(): Promise<{
  defi_llama: 'healthy' | 'unhealthy';
  coingecko: 'healthy' | 'unhealthy';
}> {
  const results = {
    defi_llama: 'healthy' as const,
    coingecko: 'healthy' as const,
  };

  try {
    // Mock DeFiLlama API check
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
    if (Math.random() < 0.08) { // 8% chance of failure
      results.defi_llama = 'unhealthy';
    }
  } catch (error) {
    results.defi_llama = 'unhealthy';
  }

  try {
    // Mock CoinGecko API check
    await new Promise(resolve => setTimeout(resolve, Math.random() * 150));
    if (Math.random() < 0.06) { // 6% chance of failure
      results.coingecko = 'unhealthy';
    }
  } catch (error) {
    results.coingecko = 'unhealthy';
  }

  return results;
}

function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      used: Math.round(usage.heapUsed / 1024 / 1024), // MB
      total: Math.round(usage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((usage.heapUsed / usage.heapTotal) * 100),
    };
  }
  
  // Mock memory usage for environments without process.memoryUsage
  const mockUsed = 245 + Math.random() * 100; // 245-345 MB
  const mockTotal = 512;
  return {
    used: Math.round(mockUsed),
    total: mockTotal,
    percentage: Math.round((mockUsed / mockTotal) * 100),
  };
}

function getPerformanceMetrics() {
  // Mock performance metrics (in production, collect real metrics)
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  
  return {
    responseTimeMs: Math.round(150 + Math.random() * 100), // 150-250ms average
    requests24h: Math.round(8500 + Math.random() * 3000), // 8.5k-11.5k requests
    errors24h: Math.round(12 + Math.random() * 20), // 12-32 errors
  };
}

function determineOverallHealth(services: any): 'healthy' | 'degraded' | 'unhealthy' {
  const criticalServices = [services.database];
  const allServices = [
    services.database,
    services.cache,
    services.external_apis?.defi_llama,
    services.external_apis?.coingecko,
  ];

  const criticalUnhealthy = criticalServices.some(service => service === 'unhealthy');
  const anyUnhealthy = allServices.some(service => service === 'unhealthy');

  if (criticalUnhealthy) {
    return 'unhealthy';
  } else if (anyUnhealthy) {
    return 'degraded';
  } else {
    return 'healthy';
  }
}

// GET: System health check
export const GET = asyncHandler(async (request: NextRequest) => {
  const startTime = Date.now();

  // Apply CORS (no rate limiting for health checks - they need to be fast)
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  // Optional light rate limiting for health checks
  const rateLimitResult = createEndpointRateLimit('health')(request);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Run health checks in parallel
    const [databaseHealth, cacheHealth, externalApisHealth] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkCacheHealth(),
      checkExternalApiHealth(),
    ]);

    // Process results
    const services = {
      database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : 'unhealthy',
      cache: cacheHealth.status === 'fulfilled' ? cacheHealth.value : 'unhealthy',
      external_apis: externalApisHealth.status === 'fulfilled' ? externalApisHealth.value : {
        defi_llama: 'unhealthy' as const,
        coingecko: 'unhealthy' as const,
      },
    };

    // Calculate uptime
    const uptime = Math.round((Date.now() - startupTime) / 1000); // seconds

    // Get system metrics
    const memory = getMemoryUsage();
    const performance = getPerformanceMetrics();

    // Determine overall health
    const overallHealth = determineOverallHealth(services);
    const responseTime = Date.now() - startTime;

    // Build response
    const healthResponse: HealthCheckResponse = {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      uptime,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      services,
      memory,
      performance: {
        ...performance,
        responseTimeMs: responseTime, // Actual response time for this request
      },
    };

    // Return appropriate HTTP status based on health
    const httpStatus = overallHealth === 'healthy' ? HTTP_STATUS.OK :
                      overallHealth === 'degraded' ? HTTP_STATUS.OK : // Still return 200 for degraded
                      HTTP_STATUS.SERVICE_UNAVAILABLE;

    const response = successResponse<HealthCheckResponse>(
      healthResponse,
      `System is ${overallHealth}`,
      httpStatus
    );

    return addRateLimitHeaders(setCorsHeaders(response, request), request, {});

  } catch (error) {
    console.error('Health check failed:', error);

    const healthResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - startupTime) / 1000),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      services: {
        database: 'unhealthy',
        cache: 'unhealthy',
        external_apis: {
          defi_llama: 'unhealthy',
          coingecko: 'unhealthy',
        },
      },
      performance: {
        responseTimeMs: Date.now() - startTime,
        requests24h: 0,
        errors24h: 1,
      },
    };

    const response = successResponse<HealthCheckResponse>(
      healthResponse,
      'Health check failed',
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );

    return addRateLimitHeaders(setCorsHeaders(response, request), request, {});
  }
});

// POST: Detailed health check with specific service tests
export const POST = asyncHandler(async (request: NextRequest) => {
  const startTime = Date.now();

  // Apply CORS
  const corsResult = cors()(request);
  if (corsResult) return corsResult;

  // Light rate limiting
  const rateLimitResult = createEndpointRateLimit('health')(request);
  if (rateLimitResult) return rateLimitResult;

  // Parse request body for specific health check options
  let requestBody: any = {};
  try {
    requestBody = await request.json();
  } catch (error) {
    // Empty body is okay
  }

  const {
    checkDatabase = true,
    checkCache = true,
    checkExternalApis = true,
    includeMetrics = true,
  } = requestBody;

  try {
    const healthChecks: Promise<any>[] = [];
    
    if (checkDatabase) {
      healthChecks.push(checkDatabaseHealth());
    }
    
    if (checkCache) {
      healthChecks.push(checkCacheHealth());
    }
    
    if (checkExternalApis) {
      healthChecks.push(checkExternalApiHealth());
    }

    // Run requested health checks
    const results = await Promise.allSettled(healthChecks);
    
    let services: any = {};
    let resultIndex = 0;
    
    if (checkDatabase) {
      services.database = results[resultIndex].status === 'fulfilled' ? results[resultIndex].value : 'unhealthy';
      resultIndex++;
    }
    
    if (checkCache) {
      services.cache = results[resultIndex].status === 'fulfilled' ? results[resultIndex].value : 'unhealthy';
      resultIndex++;
    }
    
    if (checkExternalApis) {
      services.external_apis = results[resultIndex].status === 'fulfilled' ? results[resultIndex].value : {
        defi_llama: 'unhealthy',
        coingecko: 'unhealthy',
      };
    }

    // Build response
    const healthResponse: HealthCheckResponse = {
      status: determineOverallHealth(services),
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - startupTime) / 1000),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      services,
    };

    // Add metrics if requested
    if (includeMetrics) {
      healthResponse.memory = getMemoryUsage();
      healthResponse.performance = {
        ...getPerformanceMetrics(),
        responseTimeMs: Date.now() - startTime,
      };
    }

    const httpStatus = healthResponse.status === 'healthy' ? HTTP_STATUS.OK :
                      healthResponse.status === 'degraded' ? HTTP_STATUS.OK :
                      HTTP_STATUS.SERVICE_UNAVAILABLE;

    const response = successResponse<HealthCheckResponse>(
      healthResponse,
      `Detailed health check completed - ${healthResponse.status}`,
      httpStatus
    );

    return addRateLimitHeaders(setCorsHeaders(response, request), request, {});

  } catch (error) {
    console.error('Detailed health check failed:', error);
    
    return errorResponse(
      'HEALTH_CHECK_FAILED',
      'Failed to perform health check',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return cors()(request) || new Response(null, { status: 200 });
}