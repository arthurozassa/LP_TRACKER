/**
 * Job Status Hook
 * Tracks real-time job status and progress through WebSocket
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { 
  JobStartedMessage,
  JobProgressMessage,
  JobCompletedMessage,
  JobFailedMessage
} from '../../types/messages';

// ============================================================================
// JOB STATUS INTERFACES
// ============================================================================

export interface JobStatus {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  completedSteps: string[];
  remainingSteps: string[];
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  estimatedTimeRemaining?: number;
  duration?: number;
}

export interface JobsState {
  jobs: Record<string, JobStatus>;
  activeJobs: JobStatus[];
  completedJobs: JobStatus[];
  failedJobs: JobStatus[];
  loading: boolean;
  error?: string;
}

export interface JobOptions {
  autoSubscribe?: boolean;
  trackHistory?: boolean;
  maxHistoryItems?: number;
}

// ============================================================================
// JOB STATUS HOOK
// ============================================================================

export function useJobStatus(options: JobOptions = {}) {
  const { 
    autoSubscribe = true, 
    trackHistory = true, 
    maxHistoryItems = 50 
  } = options;

  // WebSocket connection
  const webSocket = useWebSocket({
    autoConnect: true,
    debug: process.env.NODE_ENV === 'development',
  });

  // State
  const [state, setState] = useState<JobsState>({
    jobs: {},
    activeJobs: [],
    completedJobs: [],
    failedJobs: [],
    loading: false,
  });

  // Refs
  const subscriptionIdRef = useRef<string | null>(null);
  const jobHistoryRef = useRef<JobStatus[]>([]);

  // ============================================================================
  // JOB STATE MANAGEMENT
  // ============================================================================

  const updateJobStatus = useCallback((job: JobStatus) => {
    setState(prev => {
      const updatedJobs = {
        ...prev.jobs,
        [job.id]: job,
      };

      // Categorize jobs
      const allJobs = Object.values(updatedJobs);
      const activeJobs = allJobs.filter(j => j.status === 'running' || j.status === 'queued');
      const completedJobs = allJobs.filter(j => j.status === 'completed');
      const failedJobs = allJobs.filter(j => j.status === 'failed');

      return {
        ...prev,
        jobs: updatedJobs,
        activeJobs,
        completedJobs,
        failedJobs,
      };
    }, 'Logger message');

    // Add to history if tracking enabled
    if (trackHistory && (job.status === 'completed' || job.status === 'failed')) {
      jobHistoryRef.current = [job, ...jobHistoryRef.current];
      
      // Limit history size
      if (jobHistoryRef.current.length > maxHistoryItems) {
        jobHistoryRef.current = jobHistoryRef.current.slice(0, maxHistoryItems);
      }
    }
  }, [trackHistory, maxHistoryItems]);

  const removeJob = useCallback((jobId: string) => {
    setState(prev => {
      const { [jobId]: removed, ...remainingJobs } = prev.jobs;
      
      if (!removed) return prev;

      const allJobs = Object.values(remainingJobs);
      const activeJobs = allJobs.filter(j => j.status === 'running' || j.status === 'queued');
      const completedJobs = allJobs.filter(j => j.status === 'completed');
      const failedJobs = allJobs.filter(j => j.status === 'failed');

      return {
        ...prev,
        jobs: remainingJobs,
        activeJobs,
        completedJobs,
        failedJobs,
      };
    }, 'Logger message');
  }, []);

  // ============================================================================
  // WEBSOCKET MESSAGE HANDLERS
  // ============================================================================

  useEffect(() => {
    if (!webSocket.isReady) return;

    // Job started handler
    const handleJobStarted = (message: JobStartedMessage) => {
      const { jobId, type, estimatedDuration, steps } = message.data;
      
      const job: JobStatus = {
        id: jobId,
        type,
        status: 'running',
        progress: 0,
        completedSteps: [],
        remainingSteps: steps || [],
        startedAt: new Date(),
        estimatedDuration,
      };

      updateJobStatus(job);
    };

    // Job progress handler
    const handleJobProgress = (message: JobProgressMessage) => {
      const { 
        jobId, 
        progress, 
        currentStep, 
        completedSteps, 
        remainingSteps,
        estimatedTimeRemaining 
      } = message.data;

      setState(prev => {
        const existingJob = prev.jobs[jobId];
        if (!existingJob) return prev;

        const updatedJob: JobStatus = {
          ...existingJob,
          progress,
          currentStep,
          completedSteps,
          remainingSteps,
          estimatedTimeRemaining,
        };

        updateJobStatus(updatedJob);
        return prev;
      }, 'Logger message');
    };

    // Job completed handler
    const handleJobCompleted = (message: JobCompletedMessage) => {
      const { jobId, result, duration, completedAt } = message.data;

      setState(prev => {
        const existingJob = prev.jobs[jobId];
        if (!existingJob) return prev;

        const updatedJob: JobStatus = {
          ...existingJob,
          status: 'completed',
          progress: 100,
          result,
          duration,
          completedAt,
          currentStep: undefined,
          remainingSteps: [],
        };

        updateJobStatus(updatedJob);
        return prev;
      }, 'Logger message');
    };

    // Job failed handler
    const handleJobFailed = (message: JobFailedMessage) => {
      const { jobId, error, failedAt } = message.data;

      setState(prev => {
        const existingJob = prev.jobs[jobId];
        if (!existingJob) return prev;

        const duration = existingJob.startedAt ? 
          failedAt.getTime() - existingJob.startedAt.getTime() : undefined;

        const updatedJob: JobStatus = {
          ...existingJob,
          status: 'failed',
          error,
          completedAt: failedAt,
          duration,
          currentStep: undefined,
        };

        updateJobStatus(updatedJob);
        return prev;
      }, 'Logger message');
    };

    // Register message handlers
    const cleanupHandlers = [
      webSocket.addMessageListener('job_started', handleJobStarted),
      webSocket.addMessageListener('job_progress', handleJobProgress),
      webSocket.addMessageListener('job_completed', handleJobCompleted),
      webSocket.addMessageListener('job_failed', handleJobFailed),
    ];

    return () => {
      cleanupHandlers.forEach(cleanup => cleanup());
    };
  }, [webSocket.isReady, webSocket.addMessageListener, updateJobStatus]);

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  const subscribeToJobs = useCallback((jobIds?: string[]) => {
    if (!webSocket.isReady) return;

    try {
      webSocket.subscribe('jobs', {
        jobIds, // If provided, only subscribe to specific jobs
      }, {
        updateFrequency: 1000, // Update every second for job progress
      }, 'Logger message');

      console.log('Subscribed to job status updates');

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Subscription failed',
      }));
    }
  }, [webSocket.isReady, webSocket.subscribe]);

  const unsubscribeFromJobs = useCallback(() => {
    if (subscriptionIdRef.current) {
      webSocket.unsubscribe(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
    }
  }, [webSocket.unsubscribe]);

  // ============================================================================
  // AUTO-SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    if (autoSubscribe && webSocket.isReady) {
      subscribeToJobs();
    }

    return () => {
      unsubscribeFromJobs();
    };
  }, [autoSubscribe, webSocket.isReady, subscribeToJobs, unsubscribeFromJobs]);

  // ============================================================================
  // JOB MANAGEMENT METHODS
  // ============================================================================

  const getJob = useCallback((jobId: string): JobStatus | undefined => {
    return state.jobs[jobId];
  }, [state.jobs]);

  const getJobsByType = useCallback((type: string): JobStatus[] => {
    return Object.values(state.jobs).filter(job => job.type === type);
  }, [state.jobs]);

  const getActiveJobs = useCallback((): JobStatus[] => {
    return state.activeJobs;
  }, [state.activeJobs]);

  const getCompletedJobs = useCallback((): JobStatus[] => {
    return state.completedJobs;
  }, [state.completedJobs]);

  const getFailedJobs = useCallback((): JobStatus[] => {
    return state.failedJobs;
  }, [state.failedJobs]);

  const getJobHistory = useCallback((): JobStatus[] => {
    return jobHistoryRef.current;
  }, []);

  const clearCompletedJobs = useCallback(() => {
    setState(prev => ({
      ...prev,
      jobs: Object.fromEntries(
        Object.entries(prev.jobs).filter(([_, job]) => job.status !== 'completed')
      ),
      completedJobs: [],
    }));
  }, []);

  const clearFailedJobs = useCallback(() => {
    setState(prev => ({
      ...prev,
      jobs: Object.fromEntries(
        Object.entries(prev.jobs).filter(([_, job]) => job.status !== 'failed')
      ),
      failedJobs: [],
    }));
  }, []);

  const clearAllJobs = useCallback(() => {
    setState({
      jobs: {},
      activeJobs: [],
      completedJobs: [],
      failedJobs: [],
      loading: false,
    }, 'Logger message');
    
    jobHistoryRef.current = [];
  }, []);

  // ============================================================================
  // JOB STATISTICS
  // ============================================================================

  const getJobStatistics = useCallback(() => {
    const allJobs = Object.values(state.jobs);
    const totalJobs = allJobs.length;
    const runningJobs = allJobs.filter(j => j.status === 'running').length;
    const completedJobs = allJobs.filter(j => j.status === 'completed').length;
    const failedJobs = allJobs.filter(j => j.status === 'failed').length;
    const queuedJobs = allJobs.filter(j => j.status === 'queued').length;

    // Calculate success rate
    const finishedJobs = completedJobs + failedJobs;
    const successRate = finishedJobs > 0 ? (completedJobs / finishedJobs) * 100 : 0;

    // Calculate average duration for completed jobs
    const completedJobsWithDuration = allJobs.filter(j => 
      j.status === 'completed' && j.duration !== undefined
    );
    const averageDuration = completedJobsWithDuration.length > 0 ?
      completedJobsWithDuration.reduce((sum, job) => sum + (job.duration || 0), 0) / 
      completedJobsWithDuration.length : 0;

    return {
      totalJobs,
      runningJobs,
      completedJobs,
      failedJobs,
      queuedJobs,
      successRate,
      averageDuration,
    };
  }, [state.jobs]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    ...state,
    isConnected: webSocket.isConnected,
    statistics: getJobStatistics(),

    // Job queries
    getJob,
    getJobsByType,
    getActiveJobs,
    getCompletedJobs,
    getFailedJobs,
    getJobHistory,

    // Job management
    subscribeToJobs,
    unsubscribeFromJobs,
    removeJob,
    clearCompletedJobs,
    clearFailedJobs,
    clearAllJobs,

    // Statistics
    getJobStatistics,

    // WebSocket methods
    webSocket,
  };
}