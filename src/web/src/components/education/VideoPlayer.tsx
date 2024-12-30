/**
 * @fileoverview Advanced video player component for educational content
 * Supports adaptive streaming, progress tracking, and accessibility features
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player'; // ^2.12.0
import { useMediaQuery } from '@mui/material'; // ^5.14.0
import { BaseComponentProps } from '../../types/common.types';
import useLocalStorage from '../../hooks/useLocalStorage';

// Video quality settings
export enum VideoQuality {
  AUTO = 'auto',
  LOW = '360p',
  MEDIUM = '720p',
  HIGH = '1080p'
}

// Video progress interface
interface VideoProgress {
  played: number;
  playedSeconds: number;
  loaded: number;
  loadedSeconds: number;
}

// Player error interface
interface PlayerError {
  type: string;
  message: string;
  code?: number;
  data?: any;
}

// Component props interface
interface VideoPlayerProps extends BaseComponentProps {
  url: string;
  moduleId: string;
  onProgress?: (progress: VideoProgress) => void;
  onComplete?: () => void;
  quality?: VideoQuality;
  autoplay?: boolean;
  startTime?: number;
  endTime?: number;
  thumbnailUrl?: string;
  captions?: Array<{
    language: string;
    url: string;
  }>;
}

/**
 * VideoPlayer component for educational content delivery
 * Implements adaptive streaming, progress tracking, and accessibility features
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  moduleId,
  onProgress,
  onComplete,
  quality = VideoQuality.AUTO,
  autoplay = false,
  startTime = 0,
  endTime,
  thumbnailUrl,
  captions = [],
  className,
  style,
  ariaLabel,
  dataTestId,
}) => {
  // Refs
  const playerRef = useRef<ReactPlayer>(null);
  const progressCheckInterval = useRef<NodeJS.Timeout>();

  // State
  const [playing, setPlaying] = useState(autoplay);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentQuality, setCurrentQuality] = useState(quality);
  const [error, setError] = useState<PlayerError | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [selectedCaptions, setSelectedCaptions] = useState<string>('');

  // Local storage for progress tracking
  const [savedProgress, setSavedProgress] = useLocalStorage<number>(
    `video_progress_${moduleId}`,
    0
  );

  // Responsive design hooks
  const isMobile = useMediaQuery('(max-width:768px)');
  const isTablet = useMediaQuery('(min-width:769px) and (max-width:1024px)');

  /**
   * Handles video progress updates and analytics tracking
   */
  const handleProgress = useCallback((state: VideoProgress) => {
    // Update progress in storage
    setSavedProgress(state.playedSeconds);

    // Track analytics
    const progressPercentage = Math.floor(state.played * 100);
    if (progressPercentage % 25 === 0) { // Track at 25% intervals
      // Analytics tracking would go here
    }

    // Check for completion
    if (state.played >= 0.95) { // 95% considered complete
      onComplete?.();
    }

    // Adaptive quality adjustment based on buffering
    if (buffering && currentQuality !== VideoQuality.LOW) {
      setCurrentQuality(VideoQuality.LOW);
    }

    // Callback for parent components
    onProgress?.(state);
  }, [buffering, currentQuality, moduleId, onComplete, onProgress, setSavedProgress]);

  /**
   * Handles player errors with recovery attempts
   */
  const handleError = useCallback((error: PlayerError) => {
    setError(error);
    setBuffering(false);

    // Log error for monitoring
    console.error('Video player error:', {
      moduleId,
      url,
      error,
      timestamp: new Date().toISOString(),
    });

    // Attempt recovery based on error type
    switch (error.type) {
      case 'network':
        // Retry with lower quality
        if (currentQuality !== VideoQuality.LOW) {
          setCurrentQuality(VideoQuality.LOW);
        }
        break;
      case 'decode':
        // Reload player
        playerRef.current?.seekTo(savedProgress);
        break;
      default:
        // Reset player state
        setPlaying(false);
        break;
    }
  }, [currentQuality, moduleId, savedProgress, url]);

  /**
   * Keyboard controls handler
   */
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case ' ':
        setPlaying(prev => !prev);
        event.preventDefault();
        break;
      case 'ArrowLeft':
        playerRef.current?.seekTo(playerRef.current.getCurrentTime() - 10);
        event.preventDefault();
        break;
      case 'ArrowRight':
        playerRef.current?.seekTo(playerRef.current.getCurrentTime() + 10);
        event.preventDefault();
        break;
      case 'm':
        setMuted(prev => !prev);
        event.preventDefault();
        break;
    }
  }, []);

  // Setup keyboard listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (progressCheckInterval.current) {
        clearInterval(progressCheckInterval.current);
      }
    };
  }, [handleKeyPress]);

  // Responsive player configuration
  const playerConfig = {
    file: {
      attributes: {
        crossOrigin: 'anonymous',
        controlsList: 'nodownload',
      },
      tracks: captions.map(caption => ({
        kind: 'subtitles',
        src: caption.url,
        srcLang: caption.language,
        default: caption.language === selectedCaptions,
      })),
    },
    youtube: {
      playerVars: {
        modestbranding: 1,
        rel: 0,
      },
    },
  };

  return (
    <div
      className={`video-player-container ${className || ''}`}
      style={{
        position: 'relative',
        paddingTop: isMobile ? '56.25%' : '0',
        ...style,
      }}
      data-testid={dataTestId}
      role="region"
      aria-label={ariaLabel || 'Video player'}
    >
      <ReactPlayer
        ref={playerRef}
        url={url}
        playing={playing}
        volume={volume}
        muted={muted}
        playbackRate={playbackRate}
        width={isMobile ? '100%' : isTablet ? '90%' : '80%'}
        height={isMobile ? '100%' : 'auto'}
        style={{
          position: isMobile ? 'absolute' : 'relative',
          top: 0,
          left: 0,
        }}
        progressInterval={1000}
        config={playerConfig}
        onProgress={handleProgress}
        onError={handleError}
        onBuffer={() => setBuffering(true)}
        onBufferEnd={() => setBuffering(false)}
        onReady={() => {
          if (savedProgress > 0) {
            playerRef.current?.seekTo(savedProgress);
          }
        }}
        controls={true}
        pip={true}
        stopOnUnmount={false}
        light={thumbnailUrl}
      />

      {error && (
        <div
          role="alert"
          className="video-player-error"
          aria-live="polite"
        >
          An error occurred while playing the video. Please try again.
        </div>
      )}

      {/* Accessibility features */}
      <div className="sr-only">
        <button onClick={() => setPlaying(!playing)}>
          {playing ? 'Pause' : 'Play'} video
        </button>
        <button onClick={() => setMuted(!muted)}>
          {muted ? 'Unmute' : 'Mute'} video
        </button>
      </div>
    </div>
  );
};

export default VideoPlayer;