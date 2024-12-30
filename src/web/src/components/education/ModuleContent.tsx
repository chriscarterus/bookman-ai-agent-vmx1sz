/**
 * @fileoverview Enhanced educational module content component with video lessons,
 * quizzes, progress tracking, and accessibility features.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CircularProgress, Skeleton } from '@mui/material'; // ^5.0.0
import { VideoPlayer } from './VideoPlayer';
import { QuizComponent, QuizQuestion } from './QuizComponent';
import { ProgressTracker } from './ProgressTracker';
import { educationApi } from '../../api/education';
import useLocalStorage from '../../hooks/useLocalStorage';
import { BaseComponentProps } from '../../types/common.types';

/**
 * Analytics data interface for tracking module progress
 */
interface AnalyticsData {
  moduleId: string;
  timeSpent: number;
  completionStatus: boolean;
  quizScore?: number;
  lastAccessed: string;
}

/**
 * Module content props interface
 */
interface ModuleContentProps extends BaseComponentProps {
  courseId: string;
  moduleId: string;
  content: {
    videoUrl?: string;
    quiz?: QuizQuestion[];
    description: string;
    offlineSupport: boolean;
    accessibilityFeatures: string[];
  };
  onModuleComplete: (moduleId: string, analytics: AnalyticsData) => void;
  onError?: (error: Error) => void;
}

/**
 * Enhanced module content component with comprehensive features
 */
export const ModuleContent: React.FC<ModuleContentProps> = ({
  courseId,
  moduleId,
  content,
  onModuleComplete,
  onError,
  className,
  style,
  ariaLabel,
}) => {
  // State management
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // Local storage for offline support and progress persistence
  const [savedProgress, setSavedProgress] = useLocalStorage<{
    progress: number;
    completed: boolean;
    lastAccessed: string;
  }>(`module_${moduleId}_progress`, {
    progress: 0,
    completed: false,
    lastAccessed: new Date().toISOString(),
  });

  // Timer for tracking time spent
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /**
   * Handles video progress updates with analytics tracking
   */
  const handleVideoProgress = useCallback(async (videoProgress: number) => {
    try {
      setProgress(videoProgress);
      
      // Update local storage
      setSavedProgress(prev => ({
        ...prev,
        progress: videoProgress,
        lastAccessed: new Date().toISOString(),
      }));

      // Sync progress across tabs
      await educationApi.updateProgress(courseId, moduleId, videoProgress);

      // Track analytics
      await educationApi.trackAnalytics({
        moduleId,
        timeSpent,
        progress: videoProgress,
        type: 'video_progress',
      });

    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    }
  }, [courseId, moduleId, timeSpent, setSavedProgress, onError]);

  /**
   * Handles quiz completion with analytics
   */
  const handleQuizComplete = useCallback(async (score: number, analytics: any) => {
    try {
      const analyticsData: AnalyticsData = {
        moduleId,
        timeSpent,
        completionStatus: true,
        quizScore: score,
        lastAccessed: new Date().toISOString(),
      };

      // Update local storage
      setSavedProgress(prev => ({
        ...prev,
        completed: true,
        lastAccessed: new Date().toISOString(),
      }));

      // Sync completion status
      await educationApi.syncProgressAcrossTabs(courseId, moduleId, true);

      // Notify parent component
      onModuleComplete(moduleId, analyticsData);

      // Announce completion to screen readers
      const announcement = `Module completed with score ${score}%`;
      const ariaLive = document.createElement('div');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.textContent = announcement;
      document.body.appendChild(ariaLive);
      setTimeout(() => document.body.removeChild(ariaLive), 1000);

    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    }
  }, [courseId, moduleId, timeSpent, setSavedProgress, onModuleComplete, onError]);

  // Memoized content rendering
  const renderContent = useMemo(() => {
    if (loading) {
      return (
        <div className="module-content__loading" role="status">
          <Skeleton variant="rectangular" height={400} />
          <CircularProgress size={24} />
          <span className="sr-only">Loading module content...</span>
        </div>
      );
    }

    return (
      <>
        {content.videoUrl && (
          <VideoPlayer
            url={content.videoUrl}
            moduleId={moduleId}
            onProgress={handleVideoProgress}
            className="module-content__video"
            ariaLabel="Module video content"
          />
        )}

        <div className="module-content__description">
          {content.description}
        </div>

        {content.quiz && progress >= 90 && !quizStarted && (
          <button
            className="module-content__quiz-start"
            onClick={() => setQuizStarted(true)}
            aria-label="Start module quiz"
          >
            Start Quiz
          </button>
        )}

        {content.quiz && quizStarted && (
          <QuizComponent
            questions={content.quiz}
            onComplete={handleQuizComplete}
            className="module-content__quiz"
            ariaLabel="Module quiz"
          />
        )}

        <ProgressTracker
          courseId={courseId}
          totalModules={1}
          completedModules={savedProgress.completed ? 1 : 0}
          className="module-content__progress"
          ariaLabel="Module progress"
        />
      </>
    );
  }, [
    loading,
    content,
    progress,
    quizStarted,
    moduleId,
    courseId,
    savedProgress.completed,
    handleVideoProgress,
    handleQuizComplete,
  ]);

  // Initialize component
  useEffect(() => {
    const initializeModule = async () => {
      try {
        setLoading(true);
        // Load saved progress if available
        if (savedProgress.progress > 0) {
          setProgress(savedProgress.progress);
        }
        setLoading(false);
      } catch (err) {
        const error = err as Error;
        setError(error);
        onError?.(error);
        setLoading(false);
      }
    };

    initializeModule();
  }, [savedProgress.progress, onError]);

  return (
    <Card
      className={`module-content ${className || ''}`}
      style={style}
      aria-label={ariaLabel || 'Educational module content'}
      role="article"
    >
      {error && (
        <div className="module-content__error" role="alert">
          <p>Error loading module content: {error.message}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {renderContent}
    </Card>
  );
};

export default ModuleContent;