/**
 * @fileoverview A secure and accessible progress tracking component for educational courses
 * Features encrypted local storage, cross-tab synchronization, and ARIA compliance
 * @version 1.0.0
 */

import React, { useMemo, useCallback, useEffect } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps } from '../../types/common.types';
import Card from '../common/Card';
import useLocalStorage from '../../hooks/useLocalStorage';

/**
 * Props interface extending BaseComponentProps with progress tracking requirements
 */
interface ProgressTrackerProps extends BaseComponentProps {
  courseId: string;
  totalModules: number;
  completedModules: number;
  currentModule: number;
  onProgressUpdate?: (progress: number) => void;
  encryptionKey?: string;
}

/**
 * Interface for secure module progress data storage
 */
interface ModuleProgress {
  moduleId: string;
  completed: boolean;
  timestamp: number;
  encryptedData: string;
  validationHash: string;
}

/**
 * Securely calculates and validates the percentage of course completion
 */
const calculateProgress = (completedModules: number, totalModules: number): number => {
  // Input validation
  if (completedModules < 0 || totalModules <= 0 || completedModules > totalModules) {
    console.error('Invalid progress calculation inputs');
    return 0;
  }

  // Calculate and validate percentage
  const progress = Math.round((completedModules / totalModules) * 100);
  return Math.min(Math.max(progress, 0), 100);
};

/**
 * A secure and accessible progress tracking component for educational courses
 */
const ProgressTracker: React.FC<ProgressTrackerProps> = React.memo(({
  courseId,
  totalModules,
  completedModules,
  currentModule,
  onProgressUpdate,
  className,
  style,
  ariaLabel,
  encryptionKey,
}) => {
  // Secure local storage for progress data
  const [moduleProgress, setModuleProgress] = useLocalStorage<ModuleProgress[]>(
    `course_progress_${courseId}`,
    [],
    encryptionKey
  );

  // Memoized progress calculation
  const progress = useMemo(() => 
    calculateProgress(completedModules, totalModules),
    [completedModules, totalModules]
  );

  // Memoized class names
  const progressClasses = useMemo(() => 
    classNames(
      'progress-tracker',
      {
        'progress-tracker--complete': progress === 100,
        'progress-tracker--in-progress': progress > 0 && progress < 100,
      },
      className
    ),
    [progress, className]
  );

  // Handle progress updates with validation
  const handleProgressUpdate = useCallback(() => {
    if (onProgressUpdate && progress !== undefined) {
      onProgressUpdate(progress);
    }
  }, [progress, onProgressUpdate]);

  // Sync progress data and trigger updates
  useEffect(() => {
    const newProgress: ModuleProgress = {
      moduleId: `module_${currentModule}`,
      completed: currentModule <= completedModules,
      timestamp: Date.now(),
      encryptedData: '', // Placeholder for encrypted module-specific data
      validationHash: '', // Placeholder for data validation hash
    };

    setModuleProgress(prev => {
      const updated = [...prev];
      const existingIndex = updated.findIndex(p => p.moduleId === newProgress.moduleId);
      
      if (existingIndex >= 0) {
        updated[existingIndex] = newProgress;
      } else {
        updated.push(newProgress);
      }
      
      return updated;
    });

    handleProgressUpdate();
  }, [currentModule, completedModules, setModuleProgress, handleProgressUpdate]);

  return (
    <Card
      className={progressClasses}
      style={style}
      variant="outlined"
      elevation={1}
      aria-label={ariaLabel || 'Course progress tracker'}
      dataTestId="progress-tracker"
    >
      <div 
        className="progress-tracker__bar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progress}% complete`}
      >
        <div 
          className="progress-tracker__fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="progress-tracker__info">
        <span className="progress-tracker__label">
          {completedModules} of {totalModules} modules completed
        </span>
        <span 
          className="progress-tracker__percentage"
          aria-hidden="true"
        >
          {progress}%
        </span>
      </div>

      <div 
        className="progress-tracker__modules"
        role="list"
        aria-label="Module completion status"
      >
        {moduleProgress.map((module, index) => (
          <div
            key={module.moduleId}
            className={classNames(
              'progress-tracker__module',
              { 'progress-tracker__module--completed': module.completed }
            )}
            role="listitem"
            aria-label={`Module ${index + 1} ${module.completed ? 'completed' : 'incomplete'}`}
          />
        ))}
      </div>
    </Card>
  );
});

// Display name for debugging
ProgressTracker.displayName = 'ProgressTracker';

export default ProgressTracker;

// CSS Module styles (progress-tracker.module.css):
/**
.progress-tracker {
  width: 100%;
  padding: 1rem;
}

.progress-tracker__bar {
  height: 8px;
  background-color: var(--color-grey-100);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-tracker__fill {
  height: 100%;
  background-color: var(--color-primary-main);
  transition: width 300ms ease-in-out;
}

.progress-tracker__info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.progress-tracker__label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.progress-tracker__percentage {
  font-weight: 600;
  color: var(--color-text-primary);
}

.progress-tracker__modules {
  display: flex;
  gap: 4px;
  margin-top: 1rem;
}

.progress-tracker__module {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-grey-200);
}

.progress-tracker__module--completed {
  background-color: var(--color-success-main);
}

@media (max-width: 767px) {
  .progress-tracker {
    padding: 0.75rem;
  }
  
  .progress-tracker__bar {
    height: 6px;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .progress-tracker {
    padding: 1.25rem;
  }
}

@media (min-width: 1024px) {
  .progress-tracker {
    padding: 1.5rem;
  }
  
  .progress-tracker__bar {
    height: 10px;
  }
}
*/