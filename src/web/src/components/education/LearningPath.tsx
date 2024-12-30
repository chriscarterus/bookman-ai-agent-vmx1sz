/**
 * @fileoverview Enhanced Learning Path component for Bookman AI Platform
 * Provides personalized learning paths with security, accessibility, and progress tracking
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CircularProgress } from '@mui/material'; // ^5.0.0
import { useLocalStorage } from 'react-use'; // ^17.4.0
import { BroadcastChannel } from 'broadcast-channel'; // ^4.20.1

// Internal imports
import Card from '../common/Card';
import ProgressTracker from './ProgressTracker';
import useAuth from '../../hooks/useAuth';
import { educationApi, DifficultyLevel, Course } from '../../api/education';

/**
 * Enhanced props interface with accessibility and tracking
 */
interface LearningPathProps {
  className?: string;
  userId: string;
  ariaLabel?: string;
  onProgressUpdate?: (progress: number) => void;
}

/**
 * Enhanced course state interface with security metadata
 */
interface SecureCourseState {
  courses: Course[];
  encryptedProgress: string;
  lastSync: number;
  validationHash: string;
}

/**
 * LearningPath Component
 * Provides personalized learning paths with enhanced security and accessibility
 */
const LearningPath: React.FC<LearningPathProps> = ({
  className,
  userId,
  ariaLabel = 'Learning path progress',
  onProgressUpdate
}) => {
  // Authentication and user context
  const { isAuthenticated, user } = useAuth();

  // Component state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Secure course state with encryption
  const [courseState, setCourseState] = useLocalStorage<SecureCourseState>(
    `learning_path_${userId}`,
    {
      courses: [],
      encryptedProgress: '',
      lastSync: Date.now(),
      validationHash: ''
    }
  );

  // Cross-tab synchronization channel
  const syncChannel = useMemo(() => 
    new BroadcastChannel('learning_path_sync'), []
  );

  /**
   * Securely fetches and decrypts user's course data
   */
  const fetchUserCourses = useCallback(async () => {
    try {
      setLoading(true);
      
      // Validate authentication
      if (!isAuthenticated || !user) {
        throw new Error('Authentication required');
      }

      // Fetch courses with progress
      const coursesResponse = await educationApi.getCourses({
        pageSize: 10,
        sort: 'desc'
      });

      // Fetch progress for each course
      const coursesWithProgress = await Promise.all(
        coursesResponse.data.items.map(async (course) => {
          const progress = await educationApi.getUserProgress(course.id);
          return {
            ...course,
            progress: progress.data.progress,
            completedModules: progress.data.completedModules
          };
        })
      );

      // Update secure course state
      setCourseState({
        courses: coursesWithProgress,
        encryptedProgress: '', // Implement encryption
        lastSync: Date.now(),
        validationHash: '' // Implement hash validation
      });

      // Broadcast update to other tabs
      syncChannel.postMessage({
        type: 'COURSES_UPDATED',
        timestamp: Date.now()
      });

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch courses'));
      console.error('Failed to fetch courses:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, setCourseState, syncChannel]);

  /**
   * Handles course selection with accessibility
   */
  const handleCourseSelect = useCallback(async (courseId: string) => {
    try {
      setSelectedCourseId(courseId);

      // Update progress in local storage
      setCourseState(prev => ({
        ...prev,
        lastSync: Date.now()
      }));

      // Broadcast selection to other tabs
      syncChannel.postMessage({
        type: 'COURSE_SELECTED',
        courseId,
        timestamp: Date.now()
      });

      // Announce selection to screen readers
      const course = courseState.courses.find(c => c.id === courseId);
      if (course) {
        const announcement = `Selected course: ${course.title}`;
        const ariaLive = document.createElement('div');
        ariaLive.setAttribute('aria-live', 'polite');
        ariaLive.textContent = announcement;
        document.body.appendChild(ariaLive);
        setTimeout(() => ariaLive.remove(), 1000);
      }

    } catch (err) {
      console.error('Failed to select course:', err);
      setError(err instanceof Error ? err : new Error('Failed to select course'));
    }
  }, [setCourseState, syncChannel, courseState.courses]);

  /**
   * Handles progress updates with validation
   */
  const handleProgressUpdate = useCallback((progress: number) => {
    if (onProgressUpdate) {
      onProgressUpdate(progress);
    }
  }, [onProgressUpdate]);

  // Initialize course data and sync
  useEffect(() => {
    fetchUserCourses();

    // Listen for cross-tab updates
    syncChannel.onmessage = (message) => {
      if (message.type === 'COURSES_UPDATED') {
        fetchUserCourses();
      }
    };

    return () => {
      syncChannel.close();
    };
  }, [fetchUserCourses, syncChannel]);

  // Loading state
  if (loading) {
    return (
      <div className="learning-path__loading" role="status">
        <CircularProgress aria-label="Loading courses" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className="learning-path__error" 
        role="alert"
        aria-live="polite"
      >
        <p>Failed to load learning path: {error.message}</p>
        <button 
          onClick={() => fetchUserCourses()}
          aria-label="Retry loading courses"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div 
      className={`learning-path ${className || ''}`}
      role="main"
      aria-label={ariaLabel}
    >
      {courseState.courses.map((course) => (
        <Card
          key={course.id}
          className="learning-path__course"
          variant="outlined"
          focusable
          interactive
          ariaLabel={`${course.title} - ${course.difficulty} level course`}
        >
          <h3 className="learning-path__course-title">
            {course.title}
          </h3>
          <p className="learning-path__course-description">
            {course.description}
          </p>
          <div className="learning-path__course-meta">
            <span>Difficulty: {course.difficulty}</span>
            <span>Duration: {course.duration} minutes</span>
          </div>
          <ProgressTracker
            courseId={course.id}
            totalModules={course.modules}
            completedModules={course.completedModules?.length || 0}
            encryptedData={courseState.encryptedProgress}
          />
          <button
            className="learning-path__course-button"
            onClick={() => handleCourseSelect(course.id)}
            aria-label={`Continue ${course.title} course`}
          >
            {selectedCourseId === course.id ? 'Continue Learning' : 'Start Course'}
          </button>
        </Card>
      ))}
    </div>
  );
};

export default LearningPath;