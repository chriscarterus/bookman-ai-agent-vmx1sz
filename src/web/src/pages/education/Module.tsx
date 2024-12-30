/**
 * @fileoverview Enhanced educational module page component with offline support,
 * progress tracking, and accessibility features for the Bookman AI platform.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Container, 
  Box, 
  Typography, 
  Button, 
  CircularProgress,
  Breadcrumbs,
  Alert
} from '@mui/material';

// Internal imports
import { ModuleContent } from '../../components/education/ModuleContent';
import { educationApi } from '../../api/education';
import { useAuth } from '../../hooks/useAuth';

// Types for module state management
interface ModuleState {
  loading: boolean;
  error: string | null;
  courseData: any | null;
  moduleData: any | null;
  progress: number;
  isOffline: boolean;
  pendingSyncs: Array<{
    moduleId: string;
    progress: number;
    timestamp: number;
  }>;
  lastSyncTimestamp: number;
}

/**
 * Enhanced educational module page component
 */
const Module: React.FC = () => {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  // Component state
  const [state, setState] = useState<ModuleState>({
    loading: true,
    error: null,
    courseData: null,
    moduleData: null,
    progress: 0,
    isOffline: !navigator.onLine,
    pendingSyncs: [],
    lastSyncTimestamp: Date.now()
  });

  /**
   * Fetches module and course data with offline support
   */
  const fetchModuleData = useCallback(async () => {
    if (!courseId || !moduleId) {
      setState(prev => ({ ...prev, error: 'Invalid course or module ID' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));

      // Fetch course data
      const courseResponse = await educationApi.getCourseById(courseId);
      
      if (!courseResponse.data) {
        throw new Error('Course not found');
      }

      // Find the specific module
      const module = courseResponse.data.modules.find(m => m.id === moduleId);
      if (!module) {
        throw new Error('Module not found');
      }

      // Fetch user progress if authenticated
      let progress = 0;
      if (isAuthenticated) {
        const progressResponse = await educationApi.getUserProgress(courseId);
        progress = progressResponse.data.completedModules.includes(moduleId) ? 100 : 0;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        courseData: courseResponse.data,
        moduleData: module,
        progress,
        error: null
      }));

    } catch (error) {
      console.error('Error fetching module data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load module'
      }));
    }
  }, [courseId, moduleId, isAuthenticated]);

  /**
   * Handles module completion and progress updates
   */
  const handleModuleComplete = useCallback(async (completedModuleId: string, analytics: any) => {
    try {
      // Update local state immediately
      setState(prev => ({ ...prev, progress: 100 }));

      // Sync with backend if online
      if (navigator.onLine) {
        await educationApi.updateProgress(courseId!, completedModuleId, 100);
      } else {
        // Queue for later sync
        setState(prev => ({
          ...prev,
          pendingSyncs: [
            ...prev.pendingSyncs,
            {
              moduleId: completedModuleId,
              progress: 100,
              timestamp: Date.now()
            }
          ]
        }));
      }

      // Navigate to next module or completion screen
      const currentIndex = state.courseData.modules.findIndex(m => m.id === moduleId);
      const nextModule = state.courseData.modules[currentIndex + 1];

      if (nextModule) {
        navigate(`/education/courses/${courseId}/modules/${nextModule.id}`);
      } else {
        navigate(`/education/courses/${courseId}/complete`);
      }

    } catch (error) {
      console.error('Error updating progress:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to update progress. Please try again.'
      }));
    }
  }, [courseId, moduleId, navigate, state.courseData]);

  /**
   * Handles progress updates with offline support
   */
  const handleProgressUpdate = useCallback(async (progress: number) => {
    try {
      setState(prev => ({ ...prev, progress }));

      if (navigator.onLine) {
        await educationApi.updateProgress(courseId!, moduleId!, progress);
      } else {
        setState(prev => ({
          ...prev,
          pendingSyncs: [
            ...prev.pendingSyncs,
            { moduleId: moduleId!, progress, timestamp: Date.now() }
          ]
        }));
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }, [courseId, moduleId]);

  // Effect for initial data fetch
  useEffect(() => {
    fetchModuleData();
  }, [fetchModuleData]);

  // Effect for online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOffline: false }));
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOffline: true }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Effect for syncing pending updates when back online
  useEffect(() => {
    const syncPendingUpdates = async () => {
      if (navigator.onLine && state.pendingSyncs.length > 0) {
        try {
          for (const sync of state.pendingSyncs) {
            await educationApi.updateProgress(courseId!, sync.moduleId, sync.progress);
          }
          setState(prev => ({ ...prev, pendingSyncs: [], lastSyncTimestamp: Date.now() }));
        } catch (error) {
          console.error('Error syncing pending updates:', error);
        }
      }
    };

    syncPendingUpdates();
  }, [courseId, state.pendingSyncs, state.isOffline]);

  // Memoized breadcrumb path
  const breadcrumbPath = useMemo(() => {
    if (!state.courseData) return null;

    return (
      <Breadcrumbs aria-label="navigation breadcrumbs">
        <Button onClick={() => navigate('/education')}>
          Education
        </Button>
        <Button onClick={() => navigate(`/education/courses/${courseId}`)}>
          {state.courseData.title}
        </Button>
        <Typography color="textPrimary">
          {state.moduleData?.title || 'Loading...'}
        </Typography>
      </Breadcrumbs>
    );
  }, [state.courseData, state.moduleData, courseId, navigate]);

  if (state.loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (state.error) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 2 }}>
          {state.error}
        </Alert>
        <Button onClick={fetchModuleData} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box py={3}>
        {breadcrumbPath}

        {state.isOffline && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            You are currently offline. Progress will be synced when you reconnect.
          </Alert>
        )}

        {state.moduleData && (
          <ModuleContent
            courseId={courseId!}
            moduleId={moduleId!}
            content={state.moduleData.content}
            onModuleComplete={handleModuleComplete}
            onProgressUpdate={handleProgressUpdate}
            className="module-content"
            ariaLabel={`Module: ${state.moduleData.title}`}
          />
        )}
      </Box>
    </Container>
  );
};

export default Module;