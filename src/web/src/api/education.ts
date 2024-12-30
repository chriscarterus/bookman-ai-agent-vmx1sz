/**
 * Education API Module for Bookman AI Platform
 * @version 1.0.0
 * @description Handles all education-related API requests with comprehensive error handling and type safety
 */

// External imports
import axios from 'axios'; // ^1.5.0

// Internal imports
import { apiService } from '../services/api.service';
import { ApiResponse } from '../types/api.types';
import { API_ENDPOINTS, PAGINATION_DEFAULTS } from '../constants/api.constants';

/**
 * Course difficulty levels
 */
export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

/**
 * Course interface with comprehensive details
 */
export interface Course {
  id: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  duration: number; // in minutes
  modules: number;
  rating: number;
  enrollments: number;
  thumbnail: string;
  updatedAt: string;
  tags: string[];
}

/**
 * Paginated courses response
 */
export interface PaginatedCourses {
  items: Course[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Detailed course information
 */
export interface CourseDetail extends Course {
  modules: CourseModule[];
  prerequisites: string[];
  objectives: string[];
  instructor: {
    id: string;
    name: string;
    bio: string;
    avatar: string;
  };
  certification: {
    available: boolean;
    type: string;
    validityPeriod?: number;
  };
}

/**
 * Course module structure
 */
export interface CourseModule {
  id: string;
  title: string;
  description: string;
  duration: number;
  order: number;
  type: 'video' | 'reading' | 'quiz' | 'interactive';
  content: {
    url?: string;
    markdown?: string;
    questions?: QuizQuestion[];
  };
}

/**
 * Quiz question structure
 */
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
}

/**
 * Course progress tracking
 */
export interface CourseProgress {
  courseId: string;
  userId: string;
  progress: number;
  completedModules: string[];
  quizScores: Record<string, number>;
  lastAccessed: string;
  certificateEarned: boolean;
  timeSpent: number; // in minutes
}

/**
 * Quiz submission interface
 */
export interface QuizAnswer {
  questionId: string;
  selectedOption: number;
}

/**
 * Quiz result interface
 */
export interface QuizResult {
  moduleId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  feedback: Array<{
    questionId: string;
    correct: boolean;
    explanation: string;
  }>;
  passed: boolean;
  certificateEarned?: boolean;
}

/**
 * Education API service with comprehensive functionality
 */
const educationApi = {
  /**
   * Retrieves paginated list of available courses
   */
  async getCourses(params: {
    page?: number;
    pageSize?: number;
    difficulty?: DifficultyLevel;
    sort?: 'asc' | 'desc';
  }): Promise<ApiResponse<PaginatedCourses>> {
    const queryParams = {
      page: params.page || PAGINATION_DEFAULTS.DEFAULT_PAGE,
      pageSize: Math.min(
        params.pageSize || PAGINATION_DEFAULTS.PAGE_SIZE,
        PAGINATION_DEFAULTS.MAX_PAGE_SIZE
      ),
      difficulty: params.difficulty,
      sort: params.sort || PAGINATION_DEFAULTS.SORT_ORDER.DESC
    };

    return apiService.get<PaginatedCourses>(
      `${API_ENDPOINTS.EDUCATION.COURSES}`,
      { params: queryParams }
    );
  },

  /**
   * Retrieves detailed information about a specific course
   */
  async getCourseById(courseId: string): Promise<ApiResponse<CourseDetail>> {
    if (!courseId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new Error('Invalid course ID format');
    }

    return apiService.get<CourseDetail>(
      `${API_ENDPOINTS.EDUCATION.COURSES}/${courseId}`
    );
  },

  /**
   * Retrieves user's progress for a specific course
   */
  async getUserProgress(courseId: string): Promise<ApiResponse<CourseProgress>> {
    if (!courseId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new Error('Invalid course ID format');
    }

    return apiService.get<CourseProgress>(
      `${API_ENDPOINTS.EDUCATION.PROGRESS}/${courseId}`
    );
  },

  /**
   * Updates user's progress in a course module
   */
  async updateProgress(
    courseId: string,
    moduleId: string,
    progress: number
  ): Promise<ApiResponse<CourseProgress>> {
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }

    return apiService.post<CourseProgress>(
      `${API_ENDPOINTS.EDUCATION.PROGRESS}`,
      {
        courseId,
        moduleId,
        progress,
        timestamp: new Date().toISOString()
      }
    );
  },

  /**
   * Submits quiz answers and retrieves results
   */
  async submitQuiz(
    courseId: string,
    moduleId: string,
    answers: Record<string, QuizAnswer>
  ): Promise<ApiResponse<QuizResult>> {
    if (!Object.keys(answers).length) {
      throw new Error('No quiz answers provided');
    }

    return apiService.post<QuizResult>(
      `${API_ENDPOINTS.EDUCATION.QUIZZES}/${moduleId}/submit`,
      {
        courseId,
        answers,
        submittedAt: new Date().toISOString()
      }
    );
  }
};

export { educationApi };