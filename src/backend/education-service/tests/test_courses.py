"""
Comprehensive test suite for education service course management.
Tests AI-driven personalization, learning paths, progress tracking, and CRUD operations.

Version: 1.0.0
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List

import pytest
import pytest_asyncio
from faker import Faker
from httpx import AsyncClient

from ..src.models.course import Course, DIFFICULTY_LEVELS
from ..src.models.progress import Progress, COMPLETION_THRESHOLD
from ..src.services.learning_path import LearningPathService

# Initialize Faker for test data generation
FAKE = Faker()

# Test data for courses with AI metadata
course_test_data = [
    {
        'title': 'Crypto Basics',
        'description': 'Introduction to cryptocurrency fundamentals',
        'difficulty': 'beginner',
        'learning_objectives': {
            'understand_blockchain': 'Basic blockchain concepts',
            'crypto_wallets': 'Digital wallet management',
            'security_basics': 'Basic security practices'
        },
        'ai_metadata': {
            'personalization_level': 0.8,
            'content_adaptation': True,
            'difficulty_adjustment': True,
            'recommended_prerequisites': []
        }
    },
    {
        'title': 'Advanced Trading',
        'description': 'Advanced cryptocurrency trading strategies',
        'difficulty': 'advanced',
        'learning_objectives': {
            'technical_analysis': 'Advanced chart analysis',
            'risk_management': 'Portfolio risk strategies',
            'market_psychology': 'Trading psychology principles'
        },
        'ai_metadata': {
            'personalization_level': 0.9,
            'content_adaptation': True,
            'difficulty_adjustment': True,
            'recommended_prerequisites': ['crypto_basics', 'market_fundamentals']
        }
    }
]

@pytest.mark.asyncio
async def test_create_course(client: AsyncClient, test_data: Dict, ai_service) -> None:
    """
    Test course creation with AI metadata and content generation.
    
    Args:
        client: AsyncClient fixture
        test_data: Course test data
        ai_service: Mocked AI service
    """
    # Mock AI service content generation
    ai_service.generate_module_content.return_value = {
        'content': 'Generated content',
        'difficulty_score': 0.7,
        'personalization_hints': {'visual_learner': True}
    }

    # Create course with AI metadata
    response = await client.post(
        '/api/v1/courses',
        json={
            **test_data,
            'modules': [
                {
                    'title': 'Introduction',
                    'content_type': 'ai_generated',
                    'duration_minutes': 30
                }
            ]
        }
    )

    assert response.status_code == 201
    data = response.json()

    # Verify course creation
    assert data['title'] == test_data['title']
    assert data['difficulty'] == test_data['difficulty']
    assert 'ai_metadata' in data
    assert data['ai_metadata']['personalization_level'] == test_data['ai_metadata']['personalization_level']

    # Verify AI-generated content
    assert len(data['modules']) == 1
    assert data['modules'][0]['content_type'] == 'ai_generated'
    assert 'personalization_hints' in data['modules'][0]['ai_metadata']

@pytest.mark.asyncio
async def test_learning_path_generation(
    client: AsyncClient,
    learning_path_service: LearningPathService
) -> None:
    """
    Test AI-driven learning path generation and optimization.
    
    Args:
        client: AsyncClient fixture
        learning_path_service: Learning path service fixture
    """
    # Create test user profile
    user_id = str(uuid.uuid4())
    user_profile = {
        'learning_style': 'visual',
        'pace': 'standard',
        'topics_of_interest': ['blockchain', 'defi', 'trading'],
        'time_availability': 10,
        'difficulty_preference': 'beginner'
    }

    # Generate learning path
    response = await client.post(
        f'/api/v1/users/{user_id}/learning-path',
        json=user_profile
    )

    assert response.status_code == 201
    path_data = response.json()

    # Verify learning path structure
    assert 'recommended_courses' in path_data
    assert 'learning_metrics' in path_data
    assert len(path_data['recommended_courses']) > 0

    # Verify AI personalization
    first_course = path_data['recommended_courses'][0]
    assert first_course['difficulty'] == user_profile['difficulty_preference']
    assert 'estimated_duration' in first_course
    assert 'learning_objectives' in first_course

    # Test path adaptation
    progress_data = {
        'course_id': first_course['course_id'],
        'progress': 0.9,
        'performance_data': {
            'quiz_scores': {'average': 0.85},
            'time_spent': 45,
            'engagement_score': 0.9
        }
    }

    # Update progress and check path adaptation
    response = await client.post(
        f'/api/v1/users/{user_id}/progress',
        json=progress_data
    )

    assert response.status_code == 200
    updated_path = response.json()

    # Verify path adaptation
    assert 'recommendations' in updated_path
    assert 'next_steps' in updated_path
    assert updated_path['learning_metrics']['skill_coverage']

@pytest.mark.asyncio
async def test_progress_tracking(client: AsyncClient) -> None:
    """
    Test enhanced progress tracking with learning metrics.
    """
    # Create test user and course
    user_id = str(uuid.uuid4())
    course_id = str(uuid.uuid4())

    # Initialize progress
    progress = Progress(user_id=user_id, course_id=course_id)
    
    # Test module completion
    module_id = str(uuid.uuid4())
    learning_metrics = {
        'time_spent': 25,
        'interaction_patterns': {
            'video_pauses': 2,
            'notes_taken': True,
            'exercise_attempts': 3,
            'style_confidence': 0.85
        },
        'quiz_performance': {
            'score': 0.9,
            'time_taken': 15,
            'retry_count': 0
        }
    }

    # Update module progress
    response = await client.post(
        f'/api/v1/progress/{progress.id}/modules/{module_id}',
        json={
            'progress': 0.85,
            'learning_metrics': learning_metrics
        }
    )

    assert response.status_code == 200
    progress_data = response.json()

    # Verify progress tracking
    assert progress_data['completion_percentage'] > 0
    assert progress_data['status'] == 'in_progress'
    assert 'ai_metadata' in progress_data
    
    # Verify learning style adaptation
    assert progress_data['ai_metadata']['learning_style']['confidence'] >= 0.85
    
    # Test assessment recording
    assessment_data = {
        'assessment_id': str(uuid.uuid4()),
        'score': 0.9,
        'assessment_type': 'quiz',
        'performance_metrics': {
            'time_taken': 15,
            'correct_answers': 9,
            'total_questions': 10,
            'topics_mastered': ['blockchain_basics', 'wallet_security']
        }
    }

    response = await client.post(
        f'/api/v1/progress/{progress.id}/assessments',
        json=assessment_data
    )

    assert response.status_code == 200
    assessment_result = response.json()

    # Verify assessment tracking
    assert assessment_result['assessment_scores']['quiz_scores']
    assert assessment_result['assessment_scores']['average_score'] >= 0.9
    assert assessment_result['ai_metadata']['difficulty_adjustments']['current_level'] > 1.0

@pytest.mark.asyncio
async def test_course_recommendations(
    client: AsyncClient,
    learning_path_service: LearningPathService
) -> None:
    """
    Test AI-driven course recommendations and personalization.
    """
    # Create test user preferences
    user_id = str(uuid.uuid4())
    preferences = {
        'learning_style': 'visual',
        'difficulty': 'beginner',
        'topics': ['defi', 'trading'],
        'time_available': 120
    }

    # Get initial recommendations
    response = await client.post(
        f'/api/v1/users/{user_id}/recommendations',
        json=preferences
    )

    assert response.status_code == 200
    recommendations = response.json()

    # Verify recommendation structure
    assert len(recommendations['courses']) > 0
    assert all('difficulty' in course for course in recommendations['courses'])
    assert all('estimated_duration' in course for course in recommendations['courses'])

    # Test recommendation adaptation
    learning_history = {
        'completed_courses': 2,
        'average_score': 0.88,
        'preferred_content_types': ['video', 'interactive'],
        'engagement_metrics': {
            'completion_rate': 0.9,
            'quiz_performance': 0.85
        }
    }

    # Update recommendations based on history
    response = await client.put(
        f'/api/v1/users/{user_id}/recommendations',
        json={'learning_history': learning_history}
    )

    assert response.status_code == 200
    adapted_recommendations = response.json()

    # Verify adaptation
    assert adapted_recommendations['difficulty_level'] > recommendations['difficulty_level']
    assert 'personalization_factors' in adapted_recommendations