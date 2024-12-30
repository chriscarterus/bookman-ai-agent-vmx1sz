"""
SQLAlchemy model for cryptocurrency education courses with AI-driven personalization support.
Implements comprehensive course management functionality with enhanced tracking and metadata.

Version: 1.0.0
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID, uuid4
import json

from sqlalchemy import Column, String, Boolean, Integer, Float, JSON, DateTime
from sqlalchemy.ext.declarative import as_declarative
from sqlalchemy.orm import validates

# Constants for course validation and configuration
DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert']
CONTENT_TYPES = ['video', 'text', 'quiz', 'interactive', 'assessment', 'ai_generated']
MAX_MODULES = 30
MAX_TITLE_LENGTH = 150
MIN_MODULES_FOR_PUBLISH = 3

@dataclass
@as_declarative()
class Course:
    """
    SQLAlchemy model representing a comprehensive cryptocurrency education course
    with support for AI-driven personalization and enhanced content tracking.
    """
    
    # SQLAlchemy columns
    __tablename__ = 'courses'

    id = Column(String(36), primary_key=True)
    title = Column(String(MAX_TITLE_LENGTH), nullable=False)
    description = Column(String(1000), nullable=False)
    difficulty = Column(String(20), nullable=False)
    modules = Column(JSON, nullable=False, default=list)
    prerequisites = Column(JSON, nullable=False, default=list)
    duration_minutes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    is_published = Column(Boolean, nullable=False, default=False)
    learning_objectives = Column(JSON, nullable=False)
    ai_personalization_rules = Column(JSON, nullable=False)
    content_metadata = Column(JSON, nullable=False)
    completion_rate = Column(Float, nullable=False, default=0.0)
    student_count = Column(Integer, nullable=False, default=0)

    def __init__(
        self,
        title: str,
        description: str,
        difficulty: str,
        learning_objectives: Optional[Dict] = None,
        ai_personalization_rules: Optional[Dict] = None
    ):
        """
        Initialize a new Course instance with enhanced validation and metadata.
        
        Args:
            title: Course title
            description: Course description
            difficulty: Course difficulty level
            learning_objectives: Dictionary of learning objectives
            ai_personalization_rules: Dictionary of AI personalization rules
        """
        self.id = str(uuid4())
        self.title = title
        self.description = description
        self.difficulty = difficulty
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.modules = []
        self.prerequisites = []
        self.duration_minutes = 0
        self.is_published = False
        self.learning_objectives = learning_objectives or {}
        self.ai_personalization_rules = ai_personalization_rules or {
            "difficulty_adjustment": True,
            "content_personalization": True,
            "pace_adaptation": True,
            "recommendation_enabled": True
        }
        self.content_metadata = {
            "total_modules": 0,
            "content_types": {},
            "skill_categories": [],
            "last_updated": self.created_at.isoformat()
        }
        self.completion_rate = 0.0
        self.student_count = 0

    @validates('title')
    def validate_title(self, key: str, title: str) -> str:
        """Validate course title length."""
        if not title or len(title) > MAX_TITLE_LENGTH:
            raise ValueError(f"Title must be between 1 and {MAX_TITLE_LENGTH} characters")
        return title

    @validates('difficulty')
    def validate_difficulty(self, key: str, difficulty: str) -> str:
        """Validate course difficulty level."""
        if difficulty not in DIFFICULTY_LEVELS:
            raise ValueError(f"Difficulty must be one of: {', '.join(DIFFICULTY_LEVELS)}")
        return difficulty

    def add_module(self, module_data: Dict, position: Optional[int] = None) -> UUID:
        """
        Add a new module to the course with enhanced validation and metadata.
        
        Args:
            module_data: Dictionary containing module information
            position: Optional position to insert the module
            
        Returns:
            UUID of the newly added module
            
        Raises:
            ValueError: If module data is invalid or course is full
        """
        if len(self.modules) >= MAX_MODULES:
            raise ValueError(f"Maximum number of modules ({MAX_MODULES}) reached")

        # Validate module content type
        if 'content_type' not in module_data or module_data['content_type'] not in CONTENT_TYPES:
            raise ValueError(f"Invalid content type. Must be one of: {', '.join(CONTENT_TYPES)}")

        module_id = str(uuid4())
        module = {
            'id': module_id,
            'title': module_data['title'],
            'content_type': module_data['content_type'],
            'content': module_data['content'],
            'duration_minutes': module_data.get('duration_minutes', 0),
            'order': len(self.modules) if position is None else position,
            'created_at': datetime.utcnow().isoformat(),
            'ai_metadata': {
                'difficulty_score': 0.0,
                'prerequisite_concepts': [],
                'skill_categories': module_data.get('skill_categories', []),
                'personalization_hints': module_data.get('personalization_hints', {})
            }
        }

        if position is not None:
            self.modules.insert(position, module)
            self._reorder_modules()
        else:
            self.modules.append(module)

        self._update_content_metadata()
        self.updated_at = datetime.utcnow()
        
        return module_id

    def update_module(self, module_id: UUID, module_data: Dict) -> bool:
        """
        Update an existing module with validation and metadata refresh.
        
        Args:
            module_id: UUID of the module to update
            module_data: Dictionary containing updated module information
            
        Returns:
            bool indicating success of update
            
        Raises:
            ValueError: If module not found or data is invalid
        """
        module_index = next(
            (i for i, m in enumerate(self.modules) if m['id'] == str(module_id)),
            None
        )
        
        if module_index is None:
            raise ValueError(f"Module with id {module_id} not found")

        if 'content_type' in module_data:
            if module_data['content_type'] not in CONTENT_TYPES:
                raise ValueError(f"Invalid content type. Must be one of: {', '.join(CONTENT_TYPES)}")

        current_module = self.modules[module_index]
        current_module.update({
            k: v for k, v in module_data.items()
            if k in ['title', 'content_type', 'content', 'duration_minutes']
        })
        
        if 'ai_metadata' in module_data:
            current_module['ai_metadata'].update(module_data['ai_metadata'])

        self._update_content_metadata()
        self.updated_at = datetime.utcnow()
        
        return True

    def publish(self) -> bool:
        """
        Publish the course with comprehensive validation.
        
        Returns:
            bool indicating success of publishing
            
        Raises:
            ValueError: If course does not meet publishing requirements
        """
        if len(self.modules) < MIN_MODULES_FOR_PUBLISH:
            raise ValueError(f"Course must have at least {MIN_MODULES_FOR_PUBLISH} modules to publish")

        # Validate all modules have required content
        for module in self.modules:
            if not all(k in module for k in ['title', 'content_type', 'content']):
                raise ValueError(f"Module {module.get('id')} is missing required content")

        # Validate learning objectives
        if not self.learning_objectives:
            raise ValueError("Learning objectives must be set before publishing")

        # Validate AI personalization rules
        if not all(k in self.ai_personalization_rules for k in [
            'difficulty_adjustment',
            'content_personalization',
            'pace_adaptation',
            'recommendation_enabled'
        ]):
            raise ValueError("Incomplete AI personalization rules")

        self.is_published = True
        self.updated_at = datetime.utcnow()
        return True

    def to_dict(self) -> Dict:
        """
        Convert course to detailed dictionary representation.
        
        Returns:
            Dictionary containing all course data
        """
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'difficulty': self.difficulty,
            'modules': self.modules,
            'prerequisites': self.prerequisites,
            'duration_minutes': self.duration_minutes,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_published': self.is_published,
            'learning_objectives': self.learning_objectives,
            'ai_personalization_rules': self.ai_personalization_rules,
            'content_metadata': self.content_metadata,
            'completion_rate': self.completion_rate,
            'student_count': self.student_count
        }

    def _update_content_metadata(self) -> None:
        """Update course content metadata based on current modules."""
        content_types = {}
        skill_categories = set()
        total_duration = 0

        for module in self.modules:
            content_type = module['content_type']
            content_types[content_type] = content_types.get(content_type, 0) + 1
            total_duration += module.get('duration_minutes', 0)
            skill_categories.update(module['ai_metadata'].get('skill_categories', []))

        self.content_metadata.update({
            'total_modules': len(self.modules),
            'content_types': content_types,
            'skill_categories': list(skill_categories),
            'total_duration_minutes': total_duration,
            'last_updated': datetime.utcnow().isoformat()
        })
        self.duration_minutes = total_duration

    def _reorder_modules(self) -> None:
        """Reorder modules after insertion or deletion."""
        for i, module in enumerate(self.modules):
            module['order'] = i