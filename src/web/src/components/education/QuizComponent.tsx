/**
 * @fileoverview An accessible and interactive quiz component for the Bookman AI education platform
 * that supports multiple question types, real-time feedback, and detailed progress tracking.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps } from '../../types/common.types';
import Button, { ButtonVariant } from '../common/Button';
import Card from '../common/Card';

// Constants for quiz configuration
const ANSWER_DEBOUNCE_DELAY = 500;
const FEEDBACK_DISPLAY_DURATION = 3000;
const MIN_PASS_SCORE = 80;

/**
 * Question type enumeration
 */
export enum QuestionType {
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer'
}

/**
 * Quiz question interface
 */
export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  weight?: number;
}

/**
 * Submission state type for tracking answer status
 */
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Quiz component props interface
 */
interface QuizComponentProps extends BaseComponentProps {
  questions: QuizQuestion[];
  onComplete: (score: number, answers: Record<string, any>) => Promise<void>;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Enhanced quiz component with accessibility and performance optimizations
 */
export const QuizComponent: React.FC<QuizComponentProps> = React.memo(({
  questions,
  onComplete,
  onProgress,
  onError,
  className,
  style,
  ariaLabel = 'Quiz questions',
}) => {
  // Component state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[]>('');
  const [score, setScore] = useState(0);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [showFeedback, setShowFeedback] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Current question reference
  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [questions, currentQuestionIndex]);

  // Progress calculation
  const progress = useMemo(() => ((currentQuestionIndex + 1) / questions.length) * 100, [currentQuestionIndex, questions]);

  /**
   * Validates answer based on question type
   */
  const validateAnswer = useCallback((answer: string | string[], question: QuizQuestion): boolean => {
    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
        return Array.isArray(answer) && 
               Array.isArray(question.correctAnswer) &&
               answer.length === question.correctAnswer.length &&
               answer.every(a => question.correctAnswer.includes(a));
      case QuestionType.TRUE_FALSE:
      case QuestionType.SINGLE_CHOICE:
        return answer === question.correctAnswer;
      case QuestionType.SHORT_ANSWER:
        return answer.toLowerCase().trim() === (question.correctAnswer as string).toLowerCase().trim();
      default:
        return false;
    }
  }, []);

  /**
   * Handles answer submission with debouncing and validation
   */
  const handleAnswerSubmit = useCallback(async () => {
    try {
      setSubmissionState('submitting');

      // Validate answer
      const isCorrect = validateAnswer(selectedAnswer, currentQuestion);
      const questionWeight = currentQuestion.weight || 1;
      const questionScore = isCorrect ? questionWeight : 0;

      // Update score and answers
      setScore(prev => prev + questionScore);
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          answer: selectedAnswer,
          correct: isCorrect,
          score: questionScore
        }
      }));

      // Show feedback
      setShowFeedback(true);
      
      // Update progress
      onProgress?.(progress);

      // Announce result to screen readers
      const feedbackMessage = isCorrect ? 'Correct answer!' : 'Incorrect answer.';
      const announcement = `${feedbackMessage} ${currentQuestion.explanation}`;
      announceToScreenReader(announcement);

      // Handle feedback timing
      await new Promise(resolve => setTimeout(resolve, FEEDBACK_DISPLAY_DURATION));
      setShowFeedback(false);

      // Move to next question or complete quiz
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer('');
      } else {
        await handleQuizComplete();
      }

      setSubmissionState('success');
    } catch (error) {
      setSubmissionState('error');
      onError?.(error as Error);
    }
  }, [currentQuestion, selectedAnswer, progress, currentQuestionIndex, questions.length]);

  /**
   * Handles quiz completion with analytics
   */
  const handleQuizComplete = useCallback(async () => {
    const finalScore = (score / questions.length) * 100;
    await onComplete(finalScore, answers);
  }, [score, questions.length, answers, onComplete]);

  /**
   * Announces messages to screen readers
   */
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('role', 'status');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  /**
   * Renders question options based on type
   */
  const renderOptions = useMemo(() => {
    switch (currentQuestion.type) {
      case QuestionType.MULTIPLE_CHOICE:
        return currentQuestion.options?.map((option, index) => (
          <label
            key={index}
            className="quiz-option"
            htmlFor={`option-${index}`}
          >
            <input
              type="checkbox"
              id={`option-${index}`}
              checked={Array.isArray(selectedAnswer) && selectedAnswer.includes(option)}
              onChange={(e) => {
                const newAnswer = Array.isArray(selectedAnswer) ? [...selectedAnswer] : [];
                if (e.target.checked) {
                  newAnswer.push(option);
                } else {
                  const index = newAnswer.indexOf(option);
                  if (index > -1) newAnswer.splice(index, 1);
                }
                setSelectedAnswer(newAnswer);
              }}
              disabled={submissionState === 'submitting'}
            />
            {option}
          </label>
        ));

      case QuestionType.SINGLE_CHOICE:
      case QuestionType.TRUE_FALSE:
        return currentQuestion.options?.map((option, index) => (
          <label
            key={index}
            className="quiz-option"
            htmlFor={`option-${index}`}
          >
            <input
              type="radio"
              id={`option-${index}`}
              name="quiz-option"
              value={option}
              checked={selectedAnswer === option}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              disabled={submissionState === 'submitting'}
            />
            {option}
          </label>
        ));

      case QuestionType.SHORT_ANSWER:
        return (
          <input
            type="text"
            className="quiz-input"
            value={selectedAnswer as string}
            onChange={(e) => setSelectedAnswer(e.target.value)}
            disabled={submissionState === 'submitting'}
            placeholder="Type your answer here..."
          />
        );
    }
  }, [currentQuestion, selectedAnswer, submissionState]);

  /**
   * Renders feedback when shown
   */
  const renderFeedback = useMemo(() => {
    if (!showFeedback) return null;

    const isCorrect = validateAnswer(selectedAnswer, currentQuestion);
    return (
      <div
        className={classNames('quiz-feedback', {
          'quiz-feedback--correct': isCorrect,
          'quiz-feedback--incorrect': !isCorrect
        })}
        role="alert"
      >
        <p className="quiz-feedback__status">
          {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
        </p>
        <p className="quiz-feedback__explanation">{currentQuestion.explanation}</p>
      </div>
    );
  }, [showFeedback, selectedAnswer, currentQuestion]);

  return (
    <div
      className={classNames('quiz-component', className)}
      style={style}
      role="form"
      aria-label={ariaLabel}
    >
      <Card
        className="quiz-card"
        variant="elevated"
        padding="large"
        elevation={2}
      >
        <div className="quiz-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="quiz-progress__bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="quiz-content">
          <h2 className="quiz-question" id="current-question">
            Question {currentQuestionIndex + 1} of {questions.length}
          </h2>
          <p className="quiz-question__text">{currentQuestion.question}</p>

          <div
            className="quiz-options"
            role="group"
            aria-labelledby="current-question"
          >
            {renderOptions}
          </div>

          {renderFeedback}

          <Button
            variant={ButtonVariant.PRIMARY}
            onClick={handleAnswerSubmit}
            disabled={!selectedAnswer || submissionState === 'submitting'}
            loading={submissionState === 'submitting'}
            ariaLabel="Submit answer"
            fullWidth
          >
            Submit Answer
          </Button>
        </div>
      </Card>
    </div>
  );
});

QuizComponent.displayName = 'QuizComponent';

export default QuizComponent;