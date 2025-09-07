'use client';

import { useState, useEffect } from 'react';
import { FaDownload, FaCheck, FaExclamationTriangle, FaSpinner, FaCog } from 'react-icons/fa';

interface YtDlpInfo {
  available: boolean;
  version?: string;
  ffmpegAvailable?: boolean;
  error?: string;
}

interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion?: string;
  latestVersion?: string;
}

interface UpdateResult {
  success: boolean;
  message: string;
  oldVersion?: string;
  newVersion?: string;
}

export default function YtDlpStatus() {
  const [ytdlpInfo, setYtdlpInfo] = useState<YtDlpInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showUpdatePanel, setShowUpdatePanel] = useState(false);

  useEffect(() => {
    async function checkYtDlpStatus() {
      try {
        const response = await fetch('/api/alternative/search/ytdlp/status');
        if (response.ok) {
          const data = await response.json();
          setYtdlpInfo(data);
          
          // Auto-check for updates if yt-dlp is available
          if (data.available) {
            checkForUpdates();
          }
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

  const checkForUpdates = async () => {
    if (isCheckingUpdate) return;
    
    setIsCheckingUpdate(true);
    try {
      const response = await fetch('/api/yt-dlp/update');
      const data = await response.json();
      
      if (response.ok) {
        setUpdateInfo(data);
      }
    } catch (err) {
      console.error('Update check error:', err);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const performUpdate = async () => {
    setIsUpdating(true);
    setUpdateResult(null);

    try {
      const response = await fetch('/api/yt-dlp/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'update' }),
      });

      const data = await response.json();
      setUpdateResult(data);
      
      // Refresh update info after update
      if (data.success) {
        setTimeout(() => {
          checkForUpdates();
        }, 2000);
      }
    } catch (err) {
      setUpdateResult({
        success: false,
        message: 'Network error during update'
      });
    } finally {
      setIsUpdating(false);
    }
  };

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
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-medium text-green-800 dark:text-green-200">
              yt-dlp {ytdlpInfo.version} is installed
            </p>
            <div className="flex items-center gap-2">
              {updateInfo?.hasUpdate && (
                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 text-xs rounded-full">
                  Update Available
                </span>
              )}
              <button
                onClick={() => setShowUpdatePanel(!showUpdatePanel)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Update settings"
              >
                <FaCog className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-sm text-green-700 dark:text-green-300 mt-1">
            <span>Enhanced YouTube search is available</span>
            {updateInfo && (
              <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                {isCheckingUpdate && <FaSpinner className="inline w-3 h-3 animate-spin mr-1" />}
                {updateInfo.latestVersion && `Latest: ${updateInfo.latestVersion}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-500 hover:text-blue-600 underline text-xs"
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

          {showUpdatePanel && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                yt-dlp Update Manager
              </h4>
              
              {updateResult && (
                <div className={`mb-3 p-2 border rounded text-sm ${
                  updateResult.success
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {updateResult.success ? (
                      <FaCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <FaExclamationTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{updateResult.message}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {updateInfo?.hasUpdate && (
                  <button
                    onClick={performUpdate}
                    disabled={isUpdating}
                    className="w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isUpdating ? (
                      <>
                        <FaSpinner className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <FaDownload className="w-4 h-4" />
                        Update Now
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={performUpdate}
                  disabled={isUpdating}
                  className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <FaSpinner className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <FaDownload className="w-4 h-4" />
                      Force Update
                    </>
                  )}
                </button>

                <button
                  onClick={checkForUpdates}
                  disabled={isCheckingUpdate}
                  className="w-full px-3 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                >
                  {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}