import { NextRequest, NextResponse } from 'next/server';
import { 
  initializeProductionInfrastructure, 
  getProductionInfrastructure, 
  DefaultProductionConfig,
  ProductionConfig,
  SystemHealth
} from '../../../../production';

// Initialize the infrastructure on startup (in a real app, this would be done in middleware or startup)
let infrastructureInitialized = false;

async function ensureInfrastructureInitialized() {
  if (!infrastructureInitialized) {
    try {
      // Use environment-specific configuration
      const config: ProductionConfig = {
        ...DefaultProductionConfig,
        redis: {
          url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || 'redis://localhost:6379',
          keyPrefix: 'lp-tracker:',
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100
        },
        monitoring: {
          ...DefaultProductionConfig.monitoring,
          alertsEnabled: process.env.NODE_ENV === 'production'
        }
      };

      await initializeProductionInfrastructure(config);
      infrastructureInitialized = true;
    } catch (error) {
      console.error('Failed to initialize infrastructure:', error);
      throw error;
    }
  }
}

// GET /api/admin/infrastructure - Get system health and status
export async function GET(request: NextRequest) {
  try {
    await ensureInfrastructureInitialized();
    
    const infrastructure = getProductionInfrastructure();
    const health = await infrastructure.getSystemHealth();
    const monitoring = infrastructure.getMonitoring();
    
    // Get additional monitoring data
    const dashboardData = monitoring ? await monitoring.getDashboardData() : null;
    const queueManager = infrastructure.getQueueManager();
    const scheduler = infrastructure.getScheduler();

    const response = {
      health,
      uptime: infrastructure.getUptime(),
      monitoring: dashboardData ? {
        metrics: dashboardData.metrics,
        alerts: dashboardData.alerts,
        trends: dashboardData.trends
      } : null,
      queues: queueManager ? await queueManager.getAllQueueStats() : null,
      scheduler: scheduler ? {
        stats: scheduler.getJobStats(),
        jobs: scheduler.getAllJobs().map((job: any) => ({
          name: job.name,
          enabled: job.enabled,
          schedule: job.schedule,
          runCount: job.runCount,
          failCount: job.failCount,
          lastRun: job.lastRun,
          nextRun: job.nextRun
        }))
      } : null
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Infrastructure status error:', error);
    return NextResponse.json(
      { error: 'Failed to get infrastructure status' },
      { status: 500 }
    );
  }
}

// POST /api/admin/infrastructure - Control infrastructure operations
export async function POST(request: NextRequest) {
  try {
    const { action, target, data } = await request.json();

    await ensureInfrastructureInitialized();
    const infrastructure = getProductionInfrastructure();

    switch (action) {
      case 'add_job': {
        const queueManager = infrastructure.getQueueManager();
        if (!queueManager) {
          return NextResponse.json(
            { error: 'Queue manager not available' },
            { status: 503 }
          );
        }

        const { queue, jobName, jobData, options } = data;
        const job = await queueManager.addJob(queue, jobName, jobData, options);
        
        return NextResponse.json({
          success: true,
          jobId: job.id,
          queue,
          jobName
        });
      }

      case 'pause_queue': {
        const queueManager = infrastructure.getQueueManager();
        if (!queueManager) {
          return NextResponse.json(
            { error: 'Queue manager not available' },
            { status: 503 }
          );
        }

        await queueManager.pauseQueue(target);
        return NextResponse.json({ success: true, action: 'paused', target });
      }

      case 'resume_queue': {
        const queueManager = infrastructure.getQueueManager();
        if (!queueManager) {
          return NextResponse.json(
            { error: 'Queue manager not available' },
            { status: 503 }
          );
        }

        await queueManager.resumeQueue(target);
        return NextResponse.json({ success: true, action: 'resumed', target });
      }

      case 'enable_job': {
        const scheduler = infrastructure.getScheduler();
        if (!scheduler) {
          return NextResponse.json(
            { error: 'Scheduler not available' },
            { status: 503 }
          );
        }

        const success = await scheduler.enableJob(target);
        return NextResponse.json({ success, action: 'enabled', target });
      }

      case 'disable_job': {
        const scheduler = infrastructure.getScheduler();
        if (!scheduler) {
          return NextResponse.json(
            { error: 'Scheduler not available' },
            { status: 503 }
          );
        }

        const success = await scheduler.disableJob(target);
        return NextResponse.json({ success, action: 'disabled', target });
      }

      case 'clear_cache': {
        const cache = infrastructure.getCache();
        const { pattern, namespace } = data || {};
        
        await cache.multiLevel.clear(pattern, { 
          strategy: { 
            memory: { namespace }, 
            redis: { namespace: namespace || 'lp-tracker' } 
          } 
        });
        
        return NextResponse.json({ 
          success: true, 
          action: 'cache_cleared', 
          pattern,
          namespace 
        });
      }

      case 'invalidate_cache': {
        const invalidationManager = infrastructure.getCache().invalidation;
        const { type, scope } = data;
        
        await invalidationManager.invalidate({
          type,
          scope,
          data,
          timestamp: Date.now(),
          source: 'admin-api'
        });

        return NextResponse.json({ 
          success: true, 
          action: 'cache_invalidated', 
          type, 
          scope 
        });
      }

      case 'resolve_alert': {
        const monitoring = infrastructure.getMonitoring();
        if (!monitoring) {
          return NextResponse.json(
            { error: 'Monitoring not available' },
            { status: 503 }
          );
        }

        const success = monitoring.resolveAlert(target);
        return NextResponse.json({ success, action: 'alert_resolved', alertId: target });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Infrastructure control error:', error);
    return NextResponse.json(
      { error: 'Failed to execute infrastructure action' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/infrastructure - Cleanup (for development/testing)
export async function DELETE(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Cleanup not allowed in production' },
        { status: 403 }
      );
    }

    const infrastructure = getProductionInfrastructure();
    await infrastructure.cleanup();
    infrastructureInitialized = false;

    return NextResponse.json({ 
      success: true, 
      message: 'Infrastructure cleaned up successfully' 
    });

  } catch (error) {
    console.error('Infrastructure cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup infrastructure' },
      { status: 500 }
    );
  }
}