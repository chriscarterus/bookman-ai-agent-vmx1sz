/**
 * @fileoverview Main courses page component for the Bookman AI platform's education system.
 * Implements personalized learning paths, real-time updates, and accessibility features.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid, TextField, Select, MenuItem, Skeleton, Box, Typography } from '@mui/material'; // ^5.0.0
import { useQuery, useQueryClient } from 'react-query'; // ^3.39.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0

// Internal imports
import CourseCard from '../../components/education/CourseCard';
import { useWebSocket } from '../../hooks/useWebSocket';
import { API_ENDPOINTS } from '../../constants/api.constants';
import { apiClient } from '../../config/api.config';
import { LoadingState } from '../../types/api.types';

// Interfaces
interface Course {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  thumbnailUrl: string;
  modules: number;
  rating: number;
  completionRate: number;
  lastUpdated: Date;
  prerequisites: string[];
  tags: string[];
  isLive: boolean;
}

interface CourseFilters {
  difficulty: 'all' | 'beginner' | 'intermediate' | 'advanced';
  search: string;
  sortBy: 'title' | 'rating' | 'duration' | 'completionRate' | 'lastUpdated';
  tags: string[];
  completionStatus: 'all' | 'inProgress' | 'completed' | 'notStarted';
  page: number;
  pageSize: number;
}

// Constants
const INITIAL_FILTERS: CourseFilters = {
  difficulty: 'all',
  search: '',
  sortBy: 'rating',
  tags: [],
  completionStatus: 'all',
  page: 1,
  pageSize: 20
};

const DEBOUNCE_DELAY = 300;

/**
 * Custom hook for managing course data with real-time updates
 */
const useCourseData = (filters: CourseFilters) => {
  const queryClient = useQueryClient();
  const { isConnected, lastMessage } = useWebSocket<Course>(['courses']);

  // Query for fetching courses
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery(
    ['courses', filters],
    async () => {
      const response = await apiClient.get<Course[]>(API_ENDPOINTS.EDUCATION.COURSES, {
        params: filters
      });
      return response.data;
    },
    {
      keepPreviousData: true,
      staleTime: 30000,
      cacheTime: 300000
    }
  );

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage?.type === 'COURSE_UPDATE') {
      queryClient.invalidateQueries(['courses']);
    }
  }, [lastMessage, queryClient]);

  return {
    courses: data || [],
    loading: isLoading,
    error,
    refetch,
    isConnected
  };
};

/**
 * Custom hook for managing course filters with debouncing
 */
const useFilteredCourses = (initialFilters: CourseFilters) => {
  const [filters, setFilters] = useState<CourseFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(handler);
  }, [filters.search]);

  const updateFilters = useCallback((newFilters: Partial<CourseFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.search !== undefined ? 1 : prev.page
    }));
  }, []);

  return {
    filters: { ...filters, search: debouncedSearch },
    setFilters: updateFilters
  };
};

/**
 * Main Courses component implementing the course catalog and learning paths
 */
const Courses: React.FC = () => {
  const { filters, setFilters } = useFilteredCourses(INITIAL_FILTERS);
  const { courses, loading, error, isConnected } = useCourseData(filters);
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Virtual scrolling implementation
  const rowVirtualizer = useVirtualizer({
    count: courses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300,
    overscan: 5
  });

  // Memoized filter handlers
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ search: event.target.value });
  }, [setFilters]);

  const handleDifficultyChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    setFilters({ difficulty: event.target.value as CourseFilters['difficulty'] });
  }, [setFilters]);

  const handleSortChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    setFilters({ sortBy: event.target.value as CourseFilters['sortBy'] });
  }, [setFilters]);

  // Error state handling
  if (error) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="error" variant="h6">
          Error loading courses: {error.message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      {/* Filters Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Search Courses"
            value={filters.search}
            onChange={handleSearchChange}
            disabled={loading}
            InputProps={{
              'aria-label': 'Search courses',
            }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Select
            fullWidth
            value={filters.difficulty}
            onChange={handleDifficultyChange}
            disabled={loading}
            inputProps={{
              'aria-label': 'Select difficulty level',
            }}
          >
            <MenuItem value="all">All Levels</MenuItem>
            <MenuItem value="beginner">Beginner</MenuItem>
            <MenuItem value="intermediate">Intermediate</MenuItem>
            <MenuItem value="advanced">Advanced</MenuItem>
          </Select>
        </Grid>
        <Grid item xs={12} md={4}>
          <Select
            fullWidth
            value={filters.sortBy}
            onChange={handleSortChange}
            disabled={loading}
            inputProps={{
              'aria-label': 'Sort courses by',
            }}
          >
            <MenuItem value="rating">Rating</MenuItem>
            <MenuItem value="lastUpdated">Recently Updated</MenuItem>
            <MenuItem value="completionRate">Completion Rate</MenuItem>
            <MenuItem value="duration">Duration</MenuItem>
          </Select>
        </Grid>
      </Grid>

      {/* Real-time Connection Status */}
      {!isConnected && (
        <Box sx={{ mb: 2 }}>
          <Typography color="warning.main" variant="body2">
            ⚠️ Real-time updates temporarily unavailable
          </Typography>
        </Box>
      )}

      {/* Courses Grid with Virtual Scrolling */}
      <Box
        ref={parentRef}
        style={{
          height: '800px',
          overflow: 'auto',
        }}
      >
        <Grid container spacing={3} style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {loading ? (
            // Loading skeletons
            Array.from({ length: 8 }).map((_, index) => (
              <Grid item xs={12} sm={6} md={4} key={`skeleton-${index}`}>
                <Skeleton variant="rectangular" height={300} />
              </Grid>
            ))
          ) : (
            // Virtual course cards
            rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const course = courses[virtualRow.index];
              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  key={course.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <CourseCard
                    id={course.id}
                    title={course.title}
                    description={course.description}
                    difficulty={course.difficulty}
                    duration={course.duration}
                    progress={course.completionRate}
                    thumbnailUrl={course.thumbnailUrl}
                    isLoading={loading}
                  />
                </Grid>
              );
            })
          )}
        </Grid>
      </Box>
    </Box>
  );
};

export default Courses;