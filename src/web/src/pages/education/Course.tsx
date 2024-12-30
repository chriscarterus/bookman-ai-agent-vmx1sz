/**
 * @fileoverview Enhanced course page component with comprehensive features including
 * progress tracking, accessibility, security, and analytics integration.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  CircularProgress, 
  Skeleton,
  Alert,
  Box,
  Breadcrumbs,
  Link
} from '@mui/material';
import { useInView } from 'react-intersection-observer';

// Internal imports
import { ModuleContent } from '../../components/education/ModuleContent';
import { educationApi } from '../../api/education';
import useLocalStorage from '../../hooks/useLocalStorage';

// Constants
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;
const AUTO_SAVE_INTERVAL = 30000;

/**
 * Enhanced course data interface
 */
interface CourseData {
  id: string;
  title: string;
  description: string;
  modules: Module[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  prerequisites: string[];
  learningObjectives: string[];
  accessibilityFeatures: string[];
}

/**
 * Module interface with enhanced accessibility features
 */
interface Module {
  id: string;
  title: string;
  content: {
    videoUrl?: string;
    quiz?: any[];
    description: string;
    transcripts?: string;
    resources?: Resource[];
  };
  order: number;
  estimatedTime: number;
  accessibilityNotes?: string;
}

/**
 * Resource interface for module materials
 */
interface Resource {
  id: string;
  title: string;
  type: string;
  url: string;
  accessibilityInfo?: string;
}

/**
 * Enhanced course page component with comprehensive features
 */
const Course: React.FC = () => {
  // Router hooks
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  // State management
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Progress tracking with secure storage
  const [progress, setProgress] = useLocalStorage<Record<string, number>>(
    `course_progress_${courseId}`,
    {},
    true // Enable encryption
  );

  // Refs for auto-save and cleanup
  const autoSaveInterval = useRef<NodeJS.Timeout>();
  const isMounted = useRef(true);

  // Intersection observer for lazy loading
  const { ref: moduleRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  /**
   * Fetches course data with retry mechanism
   */
  const fetchCourseData = useCallback(async () => {
    try {
      if (!courseId) {
        throw new Error('Course ID is required');
      }

      const response = await educationApi.getCourseById(courseId);
      
      if (!isMounted.current) return;

      setCourseData(response.data);
      setCurrentModule(response.data.modules[0]);
      setLoading(false);

    } catch (error) {
      if (!isMounted.current) return;

      if (retryCount < RETRY_ATTEMPTS) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchCourseData();
        }, RETRY_DELAY * (retryCount + 1));
      } else {
        setError(error as Error);
        setLoading(false);
      }
    }
  }, [courseId, retryCount]);

  /**
   * Handles module completion with analytics
   */
  const handleModuleComplete = useCallback(async (moduleId: string) => {
    try {
      // Update progress locally
      setProgress(prev => ({
        ...prev,
        [moduleId]: 100
      }));

      // Sync with backend
      await educationApi.updateProgress(courseId!, moduleId, 100);

      // Find next module
      if (courseData) {
        const currentIndex = courseData.modules.findIndex(m => m.id === moduleId);
        const nextModule = courseData.modules[currentIndex + 1];

        if (nextModule) {
          setCurrentModule(nextModule);
          // Announce to screen readers
          announceToScreenReader(`Module completed. Moving to ${nextModule.title}`);
        } else {
          // Course completion
          announceToScreenReader('Congratulations! You have completed the course.');
          navigate(`/education/courses/${courseId}/complete`);
        }
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
      setError(error as Error);
    }
  }, [courseId, courseData, setProgress, navigate]);

  /**
   * Announces messages to screen readers
   */
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('role', 'status');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Initialize course data
  useEffect(() => {
    fetchCourseData();

    return () => {
      isMounted.current = false;
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
    };
  }, [fetchCourseData]);

  // Auto-save progress
  useEffect(() => {
    if (courseData && currentModule) {
      autoSaveInterval.current = setInterval(() => {
        const currentProgress = progress[currentModule.id] || 0;
        if (currentProgress > 0 && currentProgress < 100) {
          educationApi.updateProgress(courseId!, currentModule.id, currentProgress)
            .catch(console.error);
        }
      }, AUTO_SAVE_INTERVAL);
    }

    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
    };
  }, [courseData, currentModule, progress, courseId]);

  // Loading state
  if (loading) {
    return (
      <Container>
        <Box sx={{ py: 4 }}>
          <Skeleton variant="text" width="60%" height={40} />
          <Skeleton variant="rectangular" height={400} sx={{ my: 2 }} />
          <Skeleton variant="text" width="40%" height={24} />
        </Box>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container>
        <Alert 
          severity="error"
          action={
            <button onClick={fetchCourseData}>
              Retry
            </button>
          }
        >
          Failed to load course: {error.message}
        </Alert>
      </Container>
    );
  }

  // Render course content
  return (
    <Container>
      <Box sx={{ py: 4 }}>
        {/* Breadcrumb navigation */}
        <Breadcrumbs aria-label="course navigation">
          <Link href="/education/courses">Courses</Link>
          <Typography color="text.primary">{courseData?.title}</Typography>
        </Breadcrumbs>

        {/* Course header */}
        <Typography variant="h1" component="h1" gutterBottom>
          {courseData?.title}
        </Typography>

        {/* Course metadata */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Difficulty: {courseData?.difficulty}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Duration: {courseData?.duration} minutes
          </Typography>
        </Box>

        {/* Current module content */}
        {currentModule && (
          <div ref={moduleRef}>
            <ModuleContent
              courseId={courseId!}
              moduleId={currentModule.id}
              content={currentModule.content}
              onModuleComplete={handleModuleComplete}
              className={inView ? 'module-visible' : ''}
              ariaLabel={`Module: ${currentModule.title}`}
            />
          </div>
        )}

        {/* Learning objectives */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h2" component="h2" gutterBottom>
            Learning Objectives
          </Typography>
          <ul>
            {courseData?.learningObjectives.map((objective, index) => (
              <li key={index}>
                <Typography variant="body1">{objective}</Typography>
              </li>
            ))}
          </ul>
        </Box>

        {/* Accessibility features */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h2" component="h2" gutterBottom>
            Accessibility Features
          </Typography>
          <ul>
            {courseData?.accessibilityFeatures.map((feature, index) => (
              <li key={index}>
                <Typography variant="body1">{feature}</Typography>
              </li>
            ))}
          </ul>
        </Box>
      </Box>
    </Container>
  );
};

export default Course;