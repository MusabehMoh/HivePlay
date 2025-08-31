'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaForward, FaBackward, FaRedo, FaTimes } from 'react-icons/fa';
import Image from 'next/image';

interface AudioPlayerProps {
  videoId: string;
  onEnded?: () => void;
  onPrevious?: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

interface VideoDetails {
  title: string;
  channelTitle: string;
  thumbnail: string;
}

export default function AudioPlayer({ videoId, onEnded, onPrevious, isPlaying, onTogglePlay }: AudioPlayerProps) {
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('ytplayer-volume');
      return savedVolume ? parseInt(savedVolume) : 50;
    }
    return 50;
  });

  const [lastUsedVolume, setLastUsedVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('ytplayer-volume');
      return savedVolume ? parseInt(savedVolume) : 50;
    }
    return 50;
  });

  const volumeRef = useRef<number>(lastUsedVolume);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoDetails | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Add a ref to track if fadeout is in progress
  const fadeOutInProgress = useRef(false);
  const fadeOutTimer = useRef<NodeJS.Timeout | null>(null);

  // Function to handle fading out audio
  const fadeOutAudio = useCallback(() => {
    if (!audioRef.current || fadeOutInProgress.current) return;

    fadeOutInProgress.current = true;

    // Starting volume for fade (current volume)
    const startVolume = audioRef.current.volume;
    // Duration of fade in milliseconds (2 seconds)
    const fadeDuration = 2000;
    // How often to step the fade (50ms = smoother fade)
    const fadeStepTime = 50;
    // Calculate volume decrement per step
    const fadeSteps = fadeDuration / fadeStepTime;
    const volumeStep = startVolume / fadeSteps;

    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;

      if (audioRef.current) {
        const newVolume = Math.max(0, startVolume - (volumeStep * currentStep));
        audioRef.current.volume = newVolume;

        // When fade is complete
        if (newVolume <= 0 || currentStep >= fadeSteps) {
          clearInterval(fadeInterval);

          // Trigger onEnded if provided
          if (onEnded) {
            onEnded();
          }

          // Reset volume for next song
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.volume = volumeRef.current / 100;
              fadeOutInProgress.current = false;
            }
          }, 100);
        }
      } else {
        clearInterval(fadeInterval);
        fadeOutInProgress.current = false;
      }
    }, fadeStepTime);

    return () => clearInterval(fadeInterval);
  }, [onEnded]);

  const toggleFullScreenPlayer = useCallback(() => {
    setIsFullScreenMode(prev => !prev);
  }, []);

  const handleInternalPlayPause = useCallback(() => {
    onTogglePlay();
  }, [onTogglePlay]);

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    setLastUsedVolume(newVolume);
    volumeRef.current = newVolume;

    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  }, []);

  const getFormattedDuration = useCallback((seconds: number): string => {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  useEffect(() => {
    const checkIOSDevice = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    };

    checkIOSDevice();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!videoId) return;
    setStreamUrl(null);
    setIsReady(false);
    setIsStreaming(true);
    setError(null);

    // Clear any existing fade timers when changing tracks
    if (fadeOutTimer.current) {
      clearTimeout(fadeOutTimer.current);
      fadeOutTimer.current = null;
    }

    fadeOutInProgress.current = false;
    setStreamUrl(`/api/alternative/playback/hybridStream?videoId=${videoId}`);
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;
    fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
      .then(res => res.json())
      .then(data => {
        setVideoInfo({
          title: data.title || '',
          channelTitle: data.author_name || '',
          thumbnail: data.thumbnail_url || '',
        });
      })
      .catch(() => setVideoInfo(null));
  }, [videoId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && isReady) {
      audio.play().catch(error => {
        console.error("[AudioPlayer] audio.play() failed:", error);
      });
    } else if (!isPlaying) {
      audio.pause();
    }
  }, [isPlaying, isReady]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      localStorage.setItem('ytplayer-volume', volume.toString());
    }
  }, [volume]);

  const toggleMute = useCallback(() => {
    if (isIOS) {
      if (audioRef.current) {
        const newVolume = audioRef.current.volume > 0 ? 0 : 0.5;
        audioRef.current.volume = newVolume;
        setVolume(newVolume * 100);
      }
    } else {
      setVolume(prevVolume => (prevVolume > 0 ? 0 : 50));
    }
  }, [isIOS]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator && videoInfo) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: videoInfo.title || '',
        artist: videoInfo.channelTitle || '',
        artwork: [
          { src: videoInfo.thumbnail || '', sizes: '512x512', type: 'image/png' }
        ]
      });
    }
  }, [videoInfo]);

  const audioElement = streamUrl && (
    <audio
      key={streamUrl}
      ref={audioRef}
      src={streamUrl}
      preload="auto"
      className="hidden"
      onLoadedMetadata={() => {
        const audioDuration = audioRef.current?.duration || 0;
        setDuration(audioDuration);
        setIsReady(true);
        
        // Apply saved volume when audio element is loaded and unmute
        if (audioRef.current) {
          audioRef.current.volume = volumeRef.current / 100;
        }
      }}
      onLoadedData={() => {
        setIsStreaming(false);
        // Double-check volume is set correctly after data is loaded
        if (audioRef.current) {
          audioRef.current.volume = volumeRef.current / 100;
        }
      }}
      onCanPlay={() => {
        setIsReady(true);
        setIsStreaming(false);
      }}
      onTimeUpdate={() => {
        if (audioRef.current) {
          const currentTimeValue = audioRef.current.currentTime;
          setCurrentTime(currentTimeValue);
          
          // Check if we're near the end of the track to start fade-out
          // Only if not in repeat mode and fade is not already in progress
          if (!isRepeatEnabled && 
              !fadeOutInProgress.current && 
              audioRef.current.duration > 0 && 
              currentTimeValue > 0) {
            
            // If track is within 3 seconds of ending, start the fade-out
            const timeRemaining = audioRef.current.duration - currentTimeValue;
            if (timeRemaining <= 3 && timeRemaining > 0) {
              fadeOutAudio();
            }
          }
        }
      }}
      onEnded={() => {
        if (isRepeatEnabled && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        } else {
          fadeOutAudio();
        }
      }}
    />
  );

  if (isFullScreenMode) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-spotify-dark-elevated to-spotify-dark z-50 overflow-auto">
        {audioElement}
        <div className="max-w-3xl mx-auto px-4 flex flex-col h-full">
          {/* Top bar with close button */}
          <div className="flex justify-between items-center py-4 md:py-6">
            <button 
              onClick={toggleFullScreenPlayer}
              className="text-gray-400 hover:text-white transition-colors p-2"
            >
              <FaTimes className="w-5 h-5" />
            </button>
            <h1 className="text-white text-base font-bold">Now Playing</h1>
            <div className="w-5 h-5"></div>
          </div>
          
          {/* Centered content area with album art and controls */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Album art - centered */}
            <div className="mb-8">
              {videoInfo?.thumbnail && (
                <div className="relative w-64 h-64 md:w-72 md:h-72 overflow-hidden rounded-lg shadow-2xl mx-auto">
                  <Image
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    fill
                    className="object-cover"
                    unoptimized
                    priority
                  />
                </div>
              )}
            </div>
            
            {/* Track info - better spacing */}
            <div className="mb-8 text-center w-full px-4">
              <h2 className="text-white text-xl font-bold mb-1">
                {videoInfo?.title || 'Loading...'}
              </h2>
              <p className="text-gray-400 text-base">
                {videoInfo?.channelTitle || 'Loading...'}
              </p>
            </div>
            
            {/* Progress bar */}
            <div className="w-full max-w-lg px-4 mb-6">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="w-10 text-right flex-shrink-0">
                  {getFormattedDuration(currentTime)}
                </span>
                <div className="flex-grow relative flex items-center h-2 group">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleProgressChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isStreaming}
                  />
                  <div className="absolute inset-0 bg-gray-600 rounded-full h-2 flex items-center">
                    <div
                      className="h-full bg-spotify-green rounded-full relative group-hover:bg-spotify-green"
                      style={{ width: `${(currentTime / (Math.max(duration, 1))) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 flex-shrink-0">
                  {getFormattedDuration(duration)}
                </span>
              </div>
            </div>
            
            {/* Controls section - horizontally center on mobile, shift on desktop */}
            <div className="flex items-center justify-center pb-8 pl-0 md:pl-16">
              <div className="flex items-center">
                <button
                  onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
                  className={`p-2 mx-3 text-xl rounded-full transition-colors ${
                    isRepeatEnabled ? 'text-spotify-green' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <FaRedo className="w-5 h-5" />
                </button>
                <button
                  onClick={onPrevious}
                  className="p-2 mx-3 text-2xl text-gray-400 hover:text-white transition-colors"
                >
                  <FaBackward className="w-5 h-5" />
                </button>
                <button
                  onClick={handleInternalPlayPause}
                  className="p-5 mx-3 text-3xl rounded-full bg-spotify-green hover:scale-105 flex items-center justify-center"
                >
                  {isPlaying ? (
                    <FaPause className="w-7 h-7" />
                  ) : (
                    <FaPlay className="w-7 h-7 ml-1" />
                  )}
                </button>
                <button
                  onClick={onEnded}
                  className="p-2 mx-3 text-2xl text-gray-400 hover:text-white transition-colors"
                >
                  <FaForward className="w-5 h-5" />
                </button>
                <div className="flex items-center ml-3">
                  <button
                    onClick={toggleMute}
                    className="text-lg text-gray-400 hover:text-white transition-colors p-2 mr-2"
                  >
                    {volume === 0 ? <FaVolumeMute className="w-5 h-5" /> : <FaVolumeUp className="w-5 h-5" />}
                  </button>
                  <div className="w-24 relative h-1 group hidden md:block">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="absolute inset-0 bg-gray-600 rounded-full">
                      <div
                        className="h-full bg-spotify-green rounded-full relative group-hover:bg-spotify-green"
                        style={{ width: `${volume}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-spotify-dark-elevated border-t border-spotify-dark-highlight px-2 py-2 z-50">
        {audioElement}
        {error ? (
          <div className="text-red-500 text-sm">{error}</div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-2 px-1">
                <span className="w-9 text-right shrink-0">
                  {getFormattedDuration(currentTime)}
                </span>
                <div className="flex-grow relative flex items-center h-2">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleProgressChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isStreaming}
                  />
                  <div className="absolute inset-0 bg-gray-600 rounded-full h-1 flex items-center">
                    <div
                      className="h-full bg-spotify-green rounded-full relative"
                      style={{ width: `${(currentTime / (Math.max(duration, 1))) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-9 shrink-0">
                  {getFormattedDuration(duration)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {videoInfo?.thumbnail && (
                  <div 
                    className="relative h-12 w-12 overflow-hidden rounded flex-shrink-0 cursor-pointer" 
                    onClick={toggleFullScreenPlayer}
                  >
                    <Image
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      fill
                      className="object-cover rounded"
                      unoptimized
                      priority
                    />
                  </div>
                )}
                <div 
                  className="min-w-0 flex-grow mr-1 cursor-pointer" 
                  onClick={toggleFullScreenPlayer}
                >
                  <h3 className="text-sm font-medium text-white truncate">
                    {videoInfo?.title || 'Loading...'}
                  </h3>
                  <p className="text-xs text-gray-400 truncate">
                    {videoInfo?.channelTitle || 'Loading...'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onPrevious}
                    className="p-2 text-gray-400 hover:text-white"
                    disabled={!isReady}
                  >
                    <FaBackward className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleInternalPlayPause}
                    className={`p-2 rounded-full ${
                      isReady
                        ? 'bg-spotify-green hover:scale-105'
                        : 'bg-gray-600 cursor-not-allowed'
                    } flex items-center justify-center`}
                    disabled={isStreaming}
                  >
                    {isStreaming ? (
                      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="#22c55e" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : isPlaying ? (
                      <FaPause className="w-5 h-5" />
                    ) : (
                      <FaPlay className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={onEnded}
                    className="p-2 text-gray-400 hover:text-white"
                    disabled={!isReady}
                  >
                    <FaForward className="w-4 h-4" />
                  </button>
                  <button
                    onClick={toggleMute}
                    className="p-2 text-gray-400 hover:text-white"
                    disabled={!isReady}
                  >
                    {volume === 0 ? <FaVolumeMute className="w-4 h-4" /> : <FaVolumeUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-spotify-dark-elevated border-t border-spotify-dark-highlight px-4 py-3 z-50">
      {audioElement}
      {error ? (
        <div className="text-red-500 text-sm">{error}</div>
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-4">
              {videoInfo?.thumbnail && (
                <div 
                  className="relative h-16 w-24 md:w-28 md:h-20 lg:w-32 lg:h-24 overflow-hidden rounded cursor-pointer"
                  onClick={toggleFullScreenPlayer}
                >
                  <Image
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    fill
                    className="object-cover rounded"
                    unoptimized
                    priority
                  />
                </div>
              )}
              <div 
                className="min-w-0 cursor-pointer"
                onClick={toggleFullScreenPlayer}
              >
                <h3 className="text-sm md:text-base font-medium text-white truncate">
                  {videoInfo?.title || 'Loading...'}
                </h3>
                <p className="text-xs md:text-sm text-gray-400 truncate">
                  {videoInfo?.channelTitle || 'Loading...'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-4">
                <button
                  title="Previous Song"
                  onClick={onPrevious}
                  className="p-3 text-gray-400 hover:text-white transition-colors"
                  disabled={!isReady}
                >
                  <FaBackward className="w-5 h-5" />
                </button>
                <button
                  title="Play/Pause (Space)"
                  onClick={handleInternalPlayPause}
                  className={`p-4 rounded-full transition-all ${
                    isReady
                      ? 'bg-spotify-green hover:scale-110'
                      : 'bg-gray-600 cursor-not-allowed'
                  } flex items-center justify-center`}
                  disabled={isStreaming}
                >
                  {isStreaming ? (
                    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="#22c55e" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : isPlaying ? (
                    <FaPause className="w-6 h-6" />
                  ) : (
                    <FaPlay className="w-6 h-6" />
                  )}
                </button>
                <button
                  title="Next Song"
                  onClick={onEnded}
                  className="p-3 text-gray-400 hover:text-white transition-colors"
                  disabled={!isReady}
                >
                  <FaForward className="w-5 h-5" />
                </button>
              </div>
              <div className="w-full flex items-center gap-2 text-xs text-gray-400 h-6">
                <span className="w-10 text-right flex-shrink-0">{getFormattedDuration(currentTime)}</span>
                <div className="flex-grow relative flex items-center h-2 group">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleProgressChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isStreaming}
                  />
                  <div className="absolute inset-0 bg-gray-600 rounded-full h-2 flex items-center">
                    <div
                      className="h-full bg-spotify-green rounded-full relative group-hover:bg-spotify-green"
                      style={{ width: `${(currentTime / (Math.max(duration, 1))) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 flex-shrink-0">{getFormattedDuration(duration)}</span>
              </div>
            </div>
            <div className="flex justify-end items-center gap-2">
              <button
                title="Repeat"
                onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
                className={`p-2 rounded-full transition-colors ${
                  isRepeatEnabled ? 'text-spotify-green bg-spotify-green/20' : 'text-gray-400 hover:text-white'
                }`}
                disabled={!isReady}
              >
                <FaRedo className="w-4 h-4" />
              </button>
              <button
                title="Volume (Up/Down Arrows)"
                onClick={toggleMute}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={!isReady}
              >
                {volume === 0 ? <FaVolumeMute className="w-4 h-4" /> : <FaVolumeUp className="w-4 h-4" />}
              </button>
              <div className="w-24 relative h-1 group">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={!isReady}
                />
                <div className="absolute inset-0 bg-gray-600 rounded-full">
                  <div
                    className="h-full bg-spotify-green rounded-full relative group-hover:bg-spotify-green"
                    style={{ width: `${volume}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}