'use client';

import { useState, useEffect } from 'react';

interface YtDlpInfo {
  available: boolean;
  version?: string;
  ffmpegAvailable?: boolean;
  error?: string;
}

export default function YtDlpStatus() {
  const [ytdlpInfo, setYtdlpInfo] = useState<YtDlpInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    async function checkYtDlpStatus() {
      try {
        const response = await fetch('/api/alternative/search/ytdlp/status');
        if (response.ok) {
          const data = await response.json();
          setYtdlpInfo(data);
        } else {
          setYtdlpInfo({
            available: false,
            error: 'Failed to check yt-dlp status'
          });
        }
      } catch (error) {
        setYtdlpInfo({
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        setIsLoading(false);
      }
    }

    checkYtDlpStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  if (!ytdlpInfo) {
    return null;
  }

  if (!ytdlpInfo.available) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mb-4 rounded-lg">
        <div className="flex items-center">
          <svg className="h-6 w-6 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">yt-dlp is not available</p>
            <p className="text-sm text-red-700 dark:text-red-300">
              Some features may be limited. Using Invidious as a fallback.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 mb-4 rounded-lg">
      <div className="flex">
        <svg className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">
            yt-dlp {ytdlpInfo.version} is installed
          </p>
          <div className="text-sm text-green-700 dark:text-green-300">
            <span>Enhanced YouTube search is available</span>
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="ml-2 text-blue-500 hover:text-blue-600 underline text-xs"
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          </div>
          
          {showDetails && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
              <p>FFmpeg: {ytdlpInfo.ffmpegAvailable ? 'Available ✓' : 'Not detected ⚠️'}</p>
              <p className="mt-1">
                yt-dlp provides enhanced video search capabilities and better privacy compared to the YouTube API.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}