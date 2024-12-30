"""
Learning path service for Bookman AI education platform.
Provides AI-driven personalized learning paths with enhanced validation and recommendation algorithms.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID
import logging

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel, Field, validator
import numpy as np
import redis

from ..models.course import Course, DIFFICULTY_LEVELS
from ..models.progress import Progress
from ..utils.ai_content import ContentGenerator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants for learning path management
DIFFICULTY_PROGRESSION = ['beginner', 'intermediate', 'advanced', 'expert']
MIN_COMPLETION_RATE = 0.8
MAX_CONCURRENT_COURSES = 3
RECOMMENDATION_LIMIT = 5
CACHE_TTL = 3600
PERFORMANCE_METRICS = ['completion_rate', 'engagement_score', 'quiz_performance', 'time_spent']

class LearningPathValidationError(Exception):
    """Custom exception for learning path validation failures."""
    pass

class LearningPreferences(BaseModel):
    """Pydantic model for validating learning preferences."""
    learning_style: str = Field(..., regex='^(visual|auditory|reading|kinesthetic)$')
    pace: str = Field(..., regex='^(accelerated|standard|thorough)$')
    topics_of_interest: List[str] = Field(..., min_items=1)
    time_availability: int = Field(..., ge=1, le=24)  # Hours per week
    difficulty_preference: str = Field(..., regex='^(beginner|intermediate|advanced|expert)$')

class LearningPathService:
    """
    Enhanced service for managing personalized learning paths with sophisticated 
    recommendation algorithms and performance tracking.
    """

    def __init__(self, db_session: Session, content_generator: ContentGenerator, cache_client: redis.Redis):
        """
        Initialize learning path service with enhanced dependency injection.
        
        Args:
            db_session: SQLAlchemy database session
            content_generator: AI content generation service
            cache_client: Redis cache client
        """
        self.db = db_session
        self.content_generator = content_generator
        self.cache = cache_client
        self.performance_metrics = {}
        logger.info("Learning path service initialized")

    async def create_learning_path(
        self,
        user_id: UUID,
        initial_difficulty: str,
        topics_of_interest: List[str],
        learning_style_preferences: Dict
    ) -> Dict:
        """
        Create a personalized learning path with enhanced validation and recommendation algorithm.
        
        Args:
            user_id: UUID of the user
            initial_difficulty: Initial difficulty level
            topics_of_interest: List of topics the user is interested in
            learning_style_preferences: Dictionary containing learning style preferences
            
        Returns:
            Dict containing personalized learning path with detailed recommendations
            
        Raises:
            LearningPathValidationError: If validation fails
            SQLAlchemyError: If database operation fails
        """
        try:
            # Validate inputs
            if initial_difficulty not in DIFFICULTY_LEVELS:
                raise LearningPathValidationError(f"Invalid difficulty level: {initial_difficulty}")
            
            # Validate learning preferences
            preferences = LearningPreferences(
                learning_style=learning_style_preferences.get('style', 'visual'),
                pace=learning_style_preferences.get('pace', 'standard'),
                topics_of_interest=topics_of_interest,
                time_availability=learning_style_preferences.get('time_availability', 10),
                difficulty_preference=initial_difficulty
            )

            # Check cache for existing recommendations
            cache_key = f"learning_path:{user_id}:{initial_difficulty}"
            cached_path = self.cache.get(cache_key)
            if cached_path:
                return eval(cached_path)

            # Get suitable courses based on difficulty and topics
            courses = self.db.query(Course).filter(
                Course.difficulty == initial_difficulty,
                Course.is_published == True
            ).all()

            # Apply AI-driven course selection
            recommended_courses = self._generate_course_recommendations(
                courses,
                topics_of_interest,
                preferences.dict(),
                RECOMMENDATION_LIMIT
            )

            # Create progress entries for recommended courses
            learning_path = {
                'user_id': str(user_id),
                'created_at': datetime.utcnow().isoformat(),
                'difficulty_level': initial_difficulty,
                'recommended_courses': [],
                'learning_metrics': {
                    'estimated_completion_time': 0,
                    'skill_coverage': {},
                    'difficulty_progression': []
                }
            }

            total_duration = 0
            for course in recommended_courses:
                # Create progress entry
                progress = Progress(
                    user_id=user_id,
                    course_id=course.id,
                    initial_ai_metadata={
                        'learning_style': preferences.learning_style,
                        'pace': preferences.pace,
                        'difficulty_level': initial_difficulty
                    }
                )
                self.db.add(progress)
                
                # Add course to learning path
                learning_path['recommended_courses'].append({
                    'course_id': course.id,
                    'title': course.title,
                    'difficulty': course.difficulty,
                    'estimated_duration': course.duration_minutes,
                    'prerequisites': course.prerequisites,
                    'learning_objectives': course.learning_objectives
                })
                total_duration += course.duration_minutes

            # Update learning metrics
            learning_path['learning_metrics'].update({
                'estimated_completion_time': total_duration,
                'skill_coverage': self._calculate_skill_coverage(recommended_courses),
                'difficulty_progression': self._generate_difficulty_progression(initial_difficulty)
            })

            # Cache the learning path
            self.cache.setex(
                cache_key,
                CACHE_TTL,
                str(learning_path)
            )

            self.db.commit()
            logger.info(f"Created learning path for user {user_id}")
            return learning_path

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create learning path: {str(e)}")
            raise

    async def update_path_progress(
        self,
        user_id: UUID,
        course_id: UUID,
        new_progress: float,
        performance_data: Dict
    ) -> Dict:
        """
        Update user's progress with enhanced metrics and adaptive difficulty.
        
        Args:
            user_id: UUID of the user
            course_id: UUID of the course
            new_progress: New progress value (0-1)
            performance_data: Dictionary containing performance metrics
            
        Returns:
            Dict containing updated progress status with performance metrics
            
        Raises:
            LearningPathValidationError: If validation fails
            SQLAlchemyError: If database operation fails
        """
        try:
            # Validate progress value
            if not 0 <= new_progress <= 1:
                raise LearningPathValidationError("Progress must be between 0 and 1")

            # Get progress record
            progress = self.db.query(Progress).filter(
                Progress.user_id == str(user_id),
                Progress.course_id == str(course_id)
            ).first()

            if not progress:
                raise LearningPathValidationError("Progress record not found")

            # Update progress with performance data
            progress.update_module_progress(
                module_id=performance_data.get('module_id'),
                progress=new_progress,
                learning_metrics=performance_data.get('learning_metrics', {})
            )

            # Analyze performance for difficulty adjustment
            if new_progress >= MIN_COMPLETION_RATE:
                await self._adjust_path_difficulty(user_id, performance_data)

            # Update performance metrics
            metrics = self._calculate_performance_metrics(progress, performance_data)
            self.performance_metrics[str(user_id)] = metrics

            # Generate new recommendations if needed
            if new_progress >= MIN_COMPLETION_RATE:
                await self._update_course_recommendations(user_id, metrics)

            self.db.commit()
            logger.info(f"Updated progress for user {user_id} in course {course_id}")

            return {
                'status': 'success',
                'progress': new_progress,
                'performance_metrics': metrics,
                'recommendations': await self._get_next_recommendations(user_id)
            }

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update progress: {str(e)}")
            raise

    def _generate_course_recommendations(
        self,
        courses: List[Course],
        topics: List[str],
        preferences: Dict,
        limit: int
    ) -> List[Course]:
        """Generate personalized course recommendations using AI algorithms."""
        if not courses:
            return []

        # Calculate relevance scores
        scores = []
        for course in courses:
            topic_match = sum(topic in course.content_metadata.get('skill_categories', [])
                            for topic in topics)
            difficulty_match = 1 if course.difficulty == preferences['difficulty_preference'] else 0
            time_fit = 1 if course.duration_minutes <= preferences['time_availability'] * 60 else 0
            
            score = (topic_match * 0.5) + (difficulty_match * 0.3) + (time_fit * 0.2)
            scores.append((course, score))

        # Sort by score and return top recommendations
        return [course for course, _ in sorted(scores, key=lambda x: x[1], reverse=True)[:limit]]

    def _calculate_skill_coverage(self, courses: List[Course]) -> Dict:
        """Calculate skill coverage across recommended courses."""
        coverage = {}
        for course in courses:
            for skill in course.content_metadata.get('skill_categories', []):
                coverage[skill] = coverage.get(skill, 0) + 1
        return coverage

    def _generate_difficulty_progression(self, initial_difficulty: str) -> List[str]:
        """Generate recommended difficulty progression path."""
        start_idx = DIFFICULTY_PROGRESSION.index(initial_difficulty)
        return DIFFICULTY_PROGRESSION[start_idx:]

    async def _adjust_path_difficulty(self, user_id: UUID, performance_data: Dict) -> None:
        """Adjust learning path difficulty based on performance."""
        avg_performance = np.mean([
            performance_data.get(metric, 0) for metric in PERFORMANCE_METRICS
        ])

        current_difficulty = performance_data.get('current_difficulty', 'beginner')
        current_idx = DIFFICULTY_PROGRESSION.index(current_difficulty)

        if avg_performance > 0.85 and current_idx < len(DIFFICULTY_PROGRESSION) - 1:
            new_difficulty = DIFFICULTY_PROGRESSION[current_idx + 1]
        elif avg_performance < 0.6 and current_idx > 0:
            new_difficulty = DIFFICULTY_PROGRESSION[current_idx - 1]
        else:
            return

        # Update user's courses with new difficulty
        await self._update_course_recommendations(user_id, {'difficulty': new_difficulty})

    def _calculate_performance_metrics(self, progress: Progress, performance_data: Dict) -> Dict:
        """Calculate detailed performance metrics."""
        return {
            'completion_rate': progress.completion_percentage,
            'engagement_score': performance_data.get('engagement_score', 0),
            'quiz_performance': progress.assessment_scores.get('average_score', 0),
            'time_spent': performance_data.get('time_spent', 0),
            'learning_pace': progress.ai_metadata.get('learning_pace', {}).get('current', 'standard'),
            'mastery_level': self._calculate_mastery_level(progress, performance_data)
        }

    def _calculate_mastery_level(self, progress: Progress, performance_data: Dict) -> float:
        """Calculate user's mastery level based on multiple factors."""
        weights = {
            'quiz_performance': 0.4,
            'engagement': 0.3,
            'completion': 0.3
        }

        quiz_score = progress.assessment_scores.get('average_score', 0)
        engagement = performance_data.get('engagement_score', 0)
        completion = progress.completion_percentage

        return (
            (quiz_score * weights['quiz_performance']) +
            (engagement * weights['engagement']) +
            (completion * weights['completion'])
        )

    async def _update_course_recommendations(self, user_id: UUID, metrics: Dict) -> None:
        """Update course recommendations based on performance metrics."""
        try:
            # Get current progress for all courses
            current_courses = self.db.query(Progress).filter(
                Progress.user_id == str(user_id)
            ).all()

            # Generate new recommendations
            new_recommendations = await self._get_next_recommendations(user_id)

            # Update cache
            cache_key = f"recommendations:{user_id}"
            self.cache.setex(
                cache_key,
                CACHE_TTL,
                str(new_recommendations)
            )

        except Exception as e:
            logger.error(f"Failed to update recommendations: {str(e)}")
            raise

    async def _get_next_recommendations(self, user_id: UUID) -> List[Dict]:
        """Get next course recommendations based on current progress."""
        cache_key = f"recommendations:{user_id}"
        cached = self.cache.get(cache_key)
        if cached:
            return eval(cached)

        # Implementation continues with recommendation logic...
        return []