"""
SQLAlchemy model for tracking user progress in cryptocurrency education courses with AI-driven personalization.
Manages completion status, assessments, and adaptive learning paths.

Version: 1.0.0
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID, uuid4
import json

from sqlalchemy import Column, String, Float, JSON, DateTime
from sqlalchemy.ext.declarative import as_declarative
from sqlalchemy.orm import validates, relationship

# Constants for progress tracking and validation
COMPLETION_THRESHOLD = 0.8
PROGRESS_STATUSES = ['not_started', 'in_progress', 'completed']
ASSESSMENT_TYPES = ['quiz', 'final_exam']
LEARNING_STYLES = ['visual', 'auditory', 'reading', 'kinesthetic']
LEARNING_PACES = ['accelerated', 'standard', 'thorough']

@dataclass
@as_declarative()
class Progress:
    """
    SQLAlchemy model for tracking user learning progress with AI-driven personalization.
    Implements comprehensive progress tracking with adaptive learning features.
    """

    __tablename__ = 'progress'

    # SQLAlchemy columns
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False)
    course_id = Column(String(36), nullable=False)
    module_progress = Column(JSON, nullable=False, default=dict)
    completion_percentage = Column(Float, nullable=False, default=0.0)
    status = Column(String(20), nullable=False)
    assessment_scores = Column(JSON, nullable=False, default=dict)
    ai_metadata = Column(JSON, nullable=False)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    last_activity_at = Column(DateTime, nullable=False)
    last_ai_update_at = Column(DateTime, nullable=False)

    def __init__(self, user_id: UUID, course_id: UUID, initial_ai_metadata: Optional[Dict] = None):
        """
        Initialize a new Progress instance with AI personalization support.

        Args:
            user_id: UUID of the user
            course_id: UUID of the course
            initial_ai_metadata: Optional initial AI personalization metadata
        """
        self.id = str(uuid4())
        self.user_id = str(user_id)
        self.course_id = str(course_id)
        self.module_progress = {}
        self.completion_percentage = 0.0
        self.status = 'not_started'
        self.assessment_scores = {
            'quiz_scores': {},
            'final_exam_scores': {},
            'average_score': 0.0,
            'attempts_by_type': {'quiz': 0, 'final_exam': 0}
        }
        
        # Initialize AI metadata with default values if not provided
        current_time = datetime.utcnow()
        self.ai_metadata = initial_ai_metadata or {
            'learning_style': {
                'primary': 'visual',
                'confidence': 0.7,
                'last_updated': current_time.isoformat()
            },
            'learning_pace': {
                'current': 'standard',
                'history': [],
                'last_adjusted': current_time.isoformat()
            },
            'difficulty_adjustments': {
                'current_level': 1.0,
                'history': [],
                'last_modified': current_time.isoformat()
            },
            'focus_areas': [],
            'recommendations': {
                'next_modules': [],
                'review_topics': [],
                'generated_at': current_time.isoformat()
            }
        }
        
        self.started_at = current_time
        self.last_activity_at = current_time
        self.last_ai_update_at = current_time

    @validates('status')
    def validate_status(self, key: str, status: str) -> str:
        """Validate progress status."""
        if status not in PROGRESS_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(PROGRESS_STATUSES)}")
        return status

    def update_module_progress(self, module_id: UUID, progress: float, learning_metrics: Dict) -> bool:
        """
        Update progress for a specific module with AI adaptation.

        Args:
            module_id: UUID of the module
            progress: Progress value between 0 and 1
            learning_metrics: Dictionary containing learning behavior metrics

        Returns:
            bool indicating success of update

        Raises:
            ValueError: If progress value is invalid or module doesn't exist
        """
        if not 0 <= progress <= 1:
            raise ValueError("Progress must be between 0 and 1")

        module_id_str = str(module_id)
        current_time = datetime.utcnow()

        # Update module progress
        self.module_progress[module_id_str] = {
            'progress': progress,
            'last_updated': current_time.isoformat(),
            'learning_metrics': learning_metrics
        }

        # Process learning metrics for AI adaptation
        self._process_learning_metrics(learning_metrics)
        
        # Recalculate overall completion
        total_modules = len(self.module_progress)
        if total_modules > 0:
            self.completion_percentage = sum(
                m['progress'] for m in self.module_progress.values()
            ) / total_modules

        # Update status based on completion
        if self.completion_percentage >= COMPLETION_THRESHOLD:
            self.status = 'completed'
            if not self.completed_at:
                self.completed_at = current_time
        elif self.completion_percentage > 0:
            self.status = 'in_progress'

        self.last_activity_at = current_time
        return True

    def update_ai_metadata(self, metadata: Dict) -> bool:
        """
        Update AI personalization metadata.

        Args:
            metadata: Dictionary containing updated AI metadata

        Returns:
            bool indicating success of update

        Raises:
            ValueError: If metadata structure is invalid
        """
        required_keys = {'learning_style', 'learning_pace', 'difficulty_adjustments', 'focus_areas'}
        if not all(key in metadata for key in required_keys):
            raise ValueError(f"Missing required metadata keys: {required_keys}")

        current_time = datetime.utcnow()

        # Update learning style if changed
        if 'learning_style' in metadata:
            style = metadata['learning_style']
            if style['primary'] not in LEARNING_STYLES:
                raise ValueError(f"Invalid learning style. Must be one of: {LEARNING_STYLES}")
            self.ai_metadata['learning_style'].update(style)
            self.ai_metadata['learning_style']['last_updated'] = current_time.isoformat()

        # Update learning pace
        if 'learning_pace' in metadata:
            pace = metadata['learning_pace']
            if pace['current'] not in LEARNING_PACES:
                raise ValueError(f"Invalid learning pace. Must be one of: {LEARNING_PACES}")
            self.ai_metadata['learning_pace'].update(pace)
            self.ai_metadata['learning_pace']['last_adjusted'] = current_time.isoformat()

        # Update other metadata components
        self.ai_metadata.update({
            'difficulty_adjustments': metadata.get('difficulty_adjustments', self.ai_metadata['difficulty_adjustments']),
            'focus_areas': metadata.get('focus_areas', self.ai_metadata['focus_areas']),
            'recommendations': metadata.get('recommendations', self.ai_metadata['recommendations'])
        })

        self.last_ai_update_at = current_time
        return True

    def record_assessment(self, assessment_id: UUID, score: float, 
                         assessment_type: str, performance_metrics: Dict) -> bool:
        """
        Record assessment score with AI-driven feedback.

        Args:
            assessment_id: UUID of the assessment
            score: Assessment score between 0 and 1
            assessment_type: Type of assessment
            performance_metrics: Dictionary containing performance data

        Returns:
            bool indicating success of recording

        Raises:
            ValueError: If assessment data is invalid
        """
        if not 0 <= score <= 1:
            raise ValueError("Score must be between 0 and 1")
        
        if assessment_type not in ASSESSMENT_TYPES:
            raise ValueError(f"Invalid assessment type. Must be one of: {ASSESSMENT_TYPES}")

        assessment_id_str = str(assessment_id)
        current_time = datetime.utcnow()

        # Record the score
        score_key = f"{assessment_type}_scores"
        self.assessment_scores[score_key][assessment_id_str] = {
            'score': score,
            'timestamp': current_time.isoformat(),
            'metrics': performance_metrics
        }

        # Update attempt counts
        self.assessment_scores['attempts_by_type'][assessment_type] += 1

        # Recalculate average score
        all_scores = []
        for scores in self.assessment_scores.values():
            if isinstance(scores, dict) and 'score' in scores:
                all_scores.append(scores['score'])
        
        if all_scores:
            self.assessment_scores['average_score'] = sum(all_scores) / len(all_scores)

        # Process performance metrics for AI adaptation
        self._process_performance_metrics(performance_metrics)
        
        self.last_activity_at = current_time
        return True

    def check_completion(self) -> bool:
        """
        Check if course completion criteria are met.

        Returns:
            bool indicating if course is completed
        """
        if not self.module_progress:
            return False

        # Check overall progress
        if self.completion_percentage < COMPLETION_THRESHOLD:
            return False

        # Verify required assessments
        required_quiz_count = 1  # Minimum required quizzes
        final_exam_completed = any(
            score for score in self.assessment_scores.get('final_exam_scores', {}).values()
            if score.get('score', 0) >= COMPLETION_THRESHOLD
        )

        quiz_count = len(self.assessment_scores.get('quiz_scores', {}))
        
        if not (quiz_count >= required_quiz_count and final_exam_completed):
            return False

        # Mark as completed if not already
        if self.status != 'completed':
            self.status = 'completed'
            self.completed_at = datetime.utcnow()

        return True

    def to_dict(self) -> Dict:
        """
        Convert progress to dictionary with AI metadata.

        Returns:
            Dictionary containing all progress data
        """
        return {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'module_progress': self.module_progress,
            'completion_percentage': self.completion_percentage,
            'status': self.status,
            'assessment_scores': self.assessment_scores,
            'ai_metadata': self.ai_metadata,
            'started_at': self.started_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'last_activity_at': self.last_activity_at.isoformat(),
            'last_ai_update_at': self.last_ai_update_at.isoformat()
        }

    def _process_learning_metrics(self, metrics: Dict) -> None:
        """Process learning metrics to update AI adaptation parameters."""
        if not metrics:
            return

        current_time = datetime.utcnow()
        
        # Update learning style confidence based on interaction patterns
        if 'interaction_patterns' in metrics:
            current_style = self.ai_metadata['learning_style']
            pattern_confidence = metrics['interaction_patterns'].get('style_confidence', 0)
            
            if pattern_confidence > current_style['confidence']:
                current_style.update({
                    'confidence': pattern_confidence,
                    'last_updated': current_time.isoformat()
                })

        # Update learning pace based on progress rate
        if 'progress_rate' in metrics:
            current_pace = self.ai_metadata['learning_pace']
            progress_rate = metrics['progress_rate']
            
            # Store pace history
            current_pace['history'].append({
                'pace': current_pace['current'],
                'rate': progress_rate,
                'timestamp': current_time.isoformat()
            })

            # Adjust pace if needed
            if len(current_pace['history']) >= 3:
                self._adjust_learning_pace()

    def _process_performance_metrics(self, metrics: Dict) -> None:
        """Process assessment performance metrics for AI adaptation."""
        if not metrics:
            return

        current_time = datetime.utcnow()
        
        # Update difficulty adjustments based on performance
        difficulty = self.ai_metadata['difficulty_adjustments']
        performance_level = metrics.get('performance_level', 1.0)
        
        difficulty['history'].append({
            'level': difficulty['current_level'],
            'performance': performance_level,
            'timestamp': current_time.isoformat()
        })
        
        # Adjust difficulty based on performance trend
        if len(difficulty['history']) >= 3:
            recent_performance = [h['performance'] for h in difficulty['history'][-3:]]
            avg_performance = sum(recent_performance) / len(recent_performance)
            
            if avg_performance > 0.8:
                difficulty['current_level'] = min(difficulty['current_level'] * 1.2, 2.0)
            elif avg_performance < 0.6:
                difficulty['current_level'] = max(difficulty['current_level'] * 0.8, 0.5)

        difficulty['last_modified'] = current_time.isoformat()

    def _adjust_learning_pace(self) -> None:
        """Adjust learning pace based on historical progress data."""
        pace_history = self.ai_metadata['learning_pace']['history']
        recent_rates = [h['rate'] for h in pace_history[-3:]]
        avg_rate = sum(recent_rates) / len(recent_rates)
        
        current_pace = self.ai_metadata['learning_pace']['current']
        new_pace = current_pace
        
        if avg_rate > 1.2 and current_pace != 'accelerated':
            new_pace = 'accelerated'
        elif avg_rate < 0.8 and current_pace != 'thorough':
            new_pace = 'thorough'
        elif 0.8 <= avg_rate <= 1.2 and current_pace != 'standard':
            new_pace = 'standard'
            
        if new_pace != current_pace:
            self.ai_metadata['learning_pace']['current'] = new_pace
            self.ai_metadata['learning_pace']['last_adjusted'] = datetime.utcnow().isoformat()