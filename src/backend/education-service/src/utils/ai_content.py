"""
AI content generation utility module for Bookman AI education service.
Provides enterprise-grade content generation and personalization capabilities.

Version: 1.0.0
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import json
import logging

import openai  # v1.0.0
import redis  # v4.5.0
from pydantic import BaseModel, Field, validator  # v2.0.0
from tenacity import retry, stop_after_attempt, wait_exponential  # v8.0.0

from ..models.course import Course, DIFFICULTY_LEVELS
from ..config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ContentValidationError(Exception):
    """Custom exception for content validation failures."""
    pass

class AIContentSchema(BaseModel):
    """Pydantic model for validating AI-generated content."""
    title: str = Field(..., min_length=5, max_length=100)
    content: str = Field(..., min_length=50)
    examples: List[Dict[str, str]] = Field(..., min_items=1)
    exercises: List[Dict[str, Any]] = Field(..., min_items=1)
    metadata: Dict[str, Any] = Field(...)

    @validator('metadata')
    def validate_metadata(cls, v):
        required_fields = {'difficulty_score', 'target_audience', 'prerequisites'}
        if not all(field in v for field in required_fields):
            raise ValueError(f'Missing required metadata fields: {required_fields}')
        return v

class TokenBucket:
    """Rate limiter implementation using token bucket algorithm."""
    def __init__(self, tokens: int, refill_time: int):
        self.capacity = tokens
        self.tokens = tokens
        self.refill_time = refill_time
        self.last_update = datetime.utcnow()

    def consume(self, tokens: int = 1) -> bool:
        now = datetime.utcnow()
        time_passed = (now - self.last_update).total_seconds()
        self.tokens = min(
            self.capacity,
            self.tokens + int(time_passed / self.refill_time * self.capacity)
        )
        self.last_update = now

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

@dataclass
class ContentGenerator:
    """AI-powered content generation service with enhanced caching and validation."""
    
    def __init__(self, config: Config):
        """Initialize content generator with configuration."""
        # Initialize OpenAI client
        openai.api_key = config.ai_config.get('openai_api_key')
        self._client = openai.Client()
        
        # Initialize Redis connection pool
        self._cache = redis.Redis(
            host=config.cache_config['host'],
            port=config.cache_config['port'],
            db=config.cache_config['db'],
            password=config.cache_config['password'],
            ssl=config.cache_config['ssl'],
            decode_responses=True,
            socket_timeout=5,
            retry_on_timeout=True
        )
        
        # Initialize rate limiter
        self._rate_limiter = TokenBucket(
            tokens=config.ai_config.get('rate_limit_tokens', 100),
            refill_time=config.ai_config.get('rate_limit_refill_time', 60)
        )
        
        self._settings = config.ai_config
        logger.info("Content generator initialized with configuration")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_module_content(
        self,
        topic: str,
        difficulty: str,
        content_type: str,
        user_preferences: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate AI content for a course module with validation and caching.
        
        Args:
            topic: Main topic for content generation
            difficulty: Content difficulty level
            content_type: Type of content to generate
            user_preferences: User-specific preferences for personalization
            
        Returns:
            Dict containing validated and formatted content
            
        Raises:
            ContentValidationError: If generated content fails validation
            ValueError: If input parameters are invalid
        """
        if difficulty not in DIFFICULTY_LEVELS:
            raise ValueError(f"Invalid difficulty level. Must be one of: {DIFFICULTY_LEVELS}")

        # Generate cache key
        cache_key = f"content:{topic}:{difficulty}:{content_type}"
        
        # Check cache
        cached_content = self._cache.get(cache_key)
        if cached_content:
            logger.info(f"Cache hit for key: {cache_key}")
            return json.loads(cached_content)

        # Apply rate limiting
        if not self._rate_limiter.consume():
            logger.warning("Rate limit exceeded")
            raise ValueError("Rate limit exceeded. Please try again later.")

        try:
            # Prepare prompt with enhanced context
            prompt = self._prepare_content_prompt(topic, difficulty, content_type, user_preferences)
            
            # Generate content using OpenAI
            response = await self._client.chat.completions.create(
                model=self._settings['model_version'],
                messages=[
                    {"role": "system", "content": "You are an expert cryptocurrency educator."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=self._settings.get('max_tokens', 1000),
                presence_penalty=0.1,
                frequency_penalty=0.1
            )

            # Parse and validate content
            content = self._parse_ai_response(response)
            validated_content = AIContentSchema(**content)
            
            # Cache the validated content
            self._cache.setex(
                cache_key,
                timedelta(hours=24),
                json.dumps(validated_content.dict())
            )
            
            logger.info(f"Successfully generated content for topic: {topic}")
            return validated_content.dict()

        except Exception as e:
            logger.error(f"Content generation failed: {str(e)}")
            raise ContentValidationError(f"Failed to generate valid content: {str(e)}")

    async def adapt_content_difficulty(
        self,
        content: Dict[str, Any],
        user_performance: float,
        learning_history: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Adapt content difficulty based on user performance and learning history.
        
        Args:
            content: Original content to adapt
            user_performance: User's performance score (0-1)
            learning_history: User's learning history and preferences
            
        Returns:
            Adapted content with optimal difficulty
        """
        try:
            # Calculate optimal difficulty adjustment
            current_difficulty = content['metadata']['difficulty_score']
            performance_factor = (user_performance - 0.7) * 0.5
            
            # Consider learning history
            history_factor = self._analyze_learning_history(learning_history)
            
            # Calculate new difficulty
            new_difficulty = max(0.1, min(1.0, current_difficulty + performance_factor + history_factor))
            
            # Generate adapted content
            adapted_content = await self.generate_module_content(
                topic=content['title'],
                difficulty=self._map_difficulty_score(new_difficulty),
                content_type=content.get('content_type', 'text'),
                user_preferences=learning_history.get('preferences', {})
            )
            
            logger.info(f"Content adapted to difficulty: {new_difficulty}")
            return adapted_content

        except Exception as e:
            logger.error(f"Content adaptation failed: {str(e)}")
            raise ContentValidationError(f"Failed to adapt content: {str(e)}")

    async def generate_quiz_questions(
        self,
        topic: str,
        difficulty: str,
        question_count: int,
        question_types: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Generate diverse quiz questions with enhanced validation.
        
        Args:
            topic: Quiz topic
            difficulty: Question difficulty level
            question_count: Number of questions to generate
            question_types: Types of questions to include
            
        Returns:
            List of validated quiz questions with detailed feedback
        """
        if question_count < 1 or question_count > 50:
            raise ValueError("Question count must be between 1 and 50")

        cache_key = f"quiz:{topic}:{difficulty}:{question_count}"
        cached_questions = self._cache.get(cache_key)
        
        if cached_questions:
            return json.loads(cached_questions)

        try:
            questions = []
            for _ in range(question_count):
                question_type = question_types[_ % len(question_types)]
                prompt = self._prepare_quiz_prompt(topic, difficulty, question_type)
                
                response = await self._client.chat.completions.create(
                    model=self._settings['model_version'],
                    messages=[
                        {"role": "system", "content": "You are a cryptocurrency education expert."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.8
                )
                
                question = self._parse_quiz_response(response)
                questions.append(question)

            # Cache questions
            self._cache.setex(
                cache_key,
                timedelta(hours=24),
                json.dumps(questions)
            )
            
            logger.info(f"Generated {question_count} quiz questions for topic: {topic}")
            return questions

        except Exception as e:
            logger.error(f"Quiz generation failed: {str(e)}")
            raise ContentValidationError(f"Failed to generate quiz questions: {str(e)}")

    def _prepare_content_prompt(
        self,
        topic: str,
        difficulty: str,
        content_type: str,
        user_preferences: Dict[str, Any]
    ) -> str:
        """Prepare detailed prompt for content generation."""
        return f"""
        Generate {difficulty} level cryptocurrency educational content about {topic}.
        Content type: {content_type}
        User preferences: {json.dumps(user_preferences)}
        
        Include:
        1. Clear explanations with real-world examples
        2. Practical exercises and applications
        3. Key concepts and terminology
        4. Security considerations and best practices
        
        Format the response as a structured JSON with:
        - title
        - content
        - examples
        - exercises
        - metadata (difficulty_score, target_audience, prerequisites)
        """

    def _prepare_quiz_prompt(self, topic: str, difficulty: str, question_type: str) -> str:
        """Prepare prompt for quiz question generation."""
        return f"""
        Generate a {difficulty} level {question_type} question about {topic}.
        Include:
        1. Question text
        2. Multiple correct and incorrect options
        3. Detailed explanation of the correct answer
        4. Related concepts and references
        
        Format as JSON with:
        - question_text
        - options
        - correct_answer
        - explanation
        - related_concepts
        """

    def _parse_ai_response(self, response: Any) -> Dict[str, Any]:
        """Parse and structure AI response."""
        try:
            content = json.loads(response.choices[0].message.content)
            return content
        except json.JSONDecodeError as e:
            raise ContentValidationError(f"Failed to parse AI response: {str(e)}")

    def _parse_quiz_response(self, response: Any) -> Dict[str, Any]:
        """Parse and validate quiz response."""
        try:
            question = json.loads(response.choices[0].message.content)
            # Add validation logic here
            return question
        except json.JSONDecodeError as e:
            raise ContentValidationError(f"Failed to parse quiz response: {str(e)}")

    def _analyze_learning_history(self, history: Dict[str, Any]) -> float:
        """Analyze learning history to determine difficulty adjustment."""
        completion_rate = history.get('completion_rate', 0.7)
        avg_score = history.get('average_score', 0.7)
        return (completion_rate + avg_score - 1.4) * 0.3

    def _map_difficulty_score(self, score: float) -> str:
        """Map numerical difficulty score to difficulty level."""
        if score < 0.3:
            return 'beginner'
        elif score < 0.6:
            return 'intermediate'
        elif score < 0.8:
            return 'advanced'
        return 'expert'