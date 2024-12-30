"""
FastAPI route handlers for cryptocurrency education course management.
Implements AI-driven personalization, progress tracking, and recommendations.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from fastapi_cache import Cache
from fastapi_cache.decorator import cache
from fastapi_limiter import RateLimiter
from fastapi_limiter.depends import RateLimiter as RateLimiterDep

from ..models.course import Course, DIFFICULTY_LEVELS
from ..models.progress import Progress
from ..services.learning_path import LearningPathService
from ..middleware.auth import validate_admin, validate_auth

# Initialize router with prefix and tags
router = APIRouter(prefix='/courses', tags=['courses'])

# Constants for pagination, caching and rate limiting
ITEMS_PER_PAGE = 20
CACHE_TTL = 300  # 5 minutes
RATE_LIMIT_CALLS = 100
RATE_LIMIT_PERIOD = 60  # 1 minute

@router.get('/')
@cache(expire=CACHE_TTL)
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def get_courses(
    page: int = Query(1, ge=1),
    per_page: int = Query(ITEMS_PER_PAGE, le=50),
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    current_user: Dict = Depends(validate_auth)
) -> Dict:
    """
    Retrieve paginated list of courses with filtering and search capabilities.
    
    Args:
        page: Page number for pagination
        per_page: Items per page
        difficulty: Optional difficulty level filter
        search: Optional search term
        tags: Optional list of tags to filter by
        current_user: Current authenticated user
        
    Returns:
        Dict containing paginated courses and metadata
        
    Raises:
        HTTPException: If invalid parameters are provided
    """
    try:
        # Validate difficulty if provided
        if difficulty and difficulty not in DIFFICULTY_LEVELS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid difficulty level. Must be one of: {', '.join(DIFFICULTY_LEVELS)}"
            )

        # Calculate pagination offsets
        skip = (page - 1) * per_page
        limit = per_page

        # Build base query
        query = Course.query

        # Apply filters
        if difficulty:
            query = query.filter(Course.difficulty == difficulty)
        
        if tags:
            query = query.filter(Course.content_metadata['skill_categories'].contains(tags))

        # Apply search if provided
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Course.title.ilike(search_term)) |
                (Course.description.ilike(search_term))
            )

        # Get total count for pagination
        total_items = await query.count()
        total_pages = (total_items + per_page - 1) // per_page

        # Get paginated results
        courses = await query.offset(skip).limit(limit).all()

        # Transform courses to dict representation
        course_data = [course.to_dict() for course in courses]

        # Add user-specific progress data if available
        if current_user:
            progress_data = await Progress.query.filter(
                Progress.user_id == current_user['id'],
                Progress.course_id.in_([c['id'] for c in course_data])
            ).all()
            
            progress_map = {str(p.course_id): p.to_dict() for p in progress_data}
            
            for course in course_data:
                course['user_progress'] = progress_map.get(course['id'])

        return {
            'items': course_data,
            'metadata': {
                'page': page,
                'per_page': per_page,
                'total_items': total_items,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1
            },
            'filters_applied': {
                'difficulty': difficulty,
                'search': search,
                'tags': tags
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve courses: {str(e)}"
        )

@router.get('/{course_id}')
@cache(expire=CACHE_TTL)
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def get_course(
    course_id: UUID,
    current_user: Dict = Depends(validate_auth)
) -> Dict:
    """
    Retrieve detailed course information with user progress if available.
    
    Args:
        course_id: UUID of the course
        current_user: Current authenticated user
        
    Returns:
        Dict containing course details and user progress
        
    Raises:
        HTTPException: If course not found or access denied
    """
    try:
        course = await Course.query.filter(Course.id == str(course_id)).first()
        
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found"
            )

        # Get course data with detailed metadata
        course_data = course.to_dict()

        # Add user progress if available
        if current_user:
            progress = await Progress.query.filter(
                Progress.user_id == current_user['id'],
                Progress.course_id == str(course_id)
            ).first()
            
            if progress:
                course_data['user_progress'] = progress.to_dict()
                
                # Get personalized recommendations
                learning_path_service = LearningPathService()
                recommendations = await learning_path_service.get_next_recommendations(
                    user_id=current_user['id']
                )
                course_data['recommendations'] = recommendations

        return course_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve course: {str(e)}"
        )

@router.post('/')
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def create_course(
    course_data: Dict,
    current_user: Dict = Security(validate_admin)
) -> Dict:
    """
    Create a new course with enhanced validation and AI metadata.
    
    Args:
        course_data: Course creation data
        current_user: Current authenticated admin user
        
    Returns:
        Dict containing created course data
        
    Raises:
        HTTPException: If validation fails or creation error occurs
    """
    try:
        # Create new course instance
        course = Course(
            title=course_data['title'],
            description=course_data['description'],
            difficulty=course_data['difficulty'],
            learning_objectives=course_data.get('learning_objectives', {}),
            ai_personalization_rules=course_data.get('ai_personalization_rules', {})
        )

        # Add modules if provided
        if 'modules' in course_data:
            for module_data in course_data['modules']:
                course.add_module(module_data)

        # Save course
        await course.save()

        return course.to_dict()

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create course: {str(e)}"
        )

@router.put('/{course_id}')
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def update_course(
    course_id: UUID,
    course_data: Dict,
    current_user: Dict = Security(validate_admin)
) -> Dict:
    """
    Update existing course with validation and AI metadata refresh.
    
    Args:
        course_id: UUID of the course to update
        course_data: Updated course data
        current_user: Current authenticated admin user
        
    Returns:
        Dict containing updated course data
        
    Raises:
        HTTPException: If course not found or update fails
    """
    try:
        course = await Course.query.filter(Course.id == str(course_id)).first()
        
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found"
            )

        # Update basic fields
        for field in ['title', 'description', 'difficulty']:
            if field in course_data:
                setattr(course, field, course_data[field])

        # Update modules if provided
        if 'modules' in course_data:
            # Clear existing modules
            course.modules = []
            
            # Add new modules
            for module_data in course_data['modules']:
                course.add_module(module_data)

        # Update metadata
        if 'learning_objectives' in course_data:
            course.learning_objectives = course_data['learning_objectives']
            
        if 'ai_personalization_rules' in course_data:
            course.ai_personalization_rules = course_data['ai_personalization_rules']

        # Save updates
        course.updated_at = datetime.utcnow()
        await course.save()

        return course.to_dict()

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update course: {str(e)}"
        )

@router.delete('/{course_id}')
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def delete_course(
    course_id: UUID,
    current_user: Dict = Security(validate_admin)
) -> Dict:
    """
    Delete a course and associated data.
    
    Args:
        course_id: UUID of the course to delete
        current_user: Current authenticated admin user
        
    Returns:
        Dict containing deletion confirmation
        
    Raises:
        HTTPException: If course not found or deletion fails
    """
    try:
        course = await Course.query.filter(Course.id == str(course_id)).first()
        
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found"
            )

        # Delete associated progress records
        await Progress.query.filter(Progress.course_id == str(course_id)).delete()
        
        # Delete course
        await course.delete()

        return {
            'message': 'Course deleted successfully',
            'course_id': str(course_id)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete course: {str(e)}"
        )