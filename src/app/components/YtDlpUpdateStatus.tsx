'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface YtDlpStatus {
  status: string;
  ytdlp: {
    available: boolean;
    version: string;
    executable: boolean;
  };
  update: {
    hasUpdate: boolean;
    currentVersion?: string;
    latestVersion?: string;
    daysBehind?: number;
  };
  environment: 'docker' | 'native';
  timestamp: string;
}

interface UpdateResult {
  success: boolean;
  message: string;
  oldVersion?: string;
  newVersion?: string;
  environment?: string;
}

export default function YtDlpUpdateStatus() {
  const [status, setStatus] = useState<YtDlpStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<UpdateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await fetch('/api/yt-dlp/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError((err as Error).message);
      console.error('Failed to fetch yt-dlp status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const performUpdate = async (force = false) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/yt-dlp/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', force })
      });
      
      if (!response.ok) {
        throw new Error(`Update failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      setLastUpdate(result);
      
      // Refresh status after update
      setTimeout(fetchStatus, 2000);
      
    } catch (err) {
      setError((err as Error).message);
      console.error('Update failed:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
        <div className="flex items-center gap-2">
          <LoadingSpinner />
          <span className="text-white/70">Loading yt-dlp status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 backdrop-blur-sm rounded-lg p-4 border border-red-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-red-400 font-semibold mb-1">yt-dlp Status Error</h3>
            <p className="text-red-300/80 text-sm">{error}</p>
          </div>
          <button
            onClick={fetchStatus}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const getStatusColor = () => {
    if (!status.ytdlp.available) return 'text-red-400';
    if (status.update.hasUpdate && status.update.daysBehind && status.update.daysBehind > 7) return 'text-yellow-400';
    if (status.update.hasUpdate) return 'text-blue-400';
    return 'text-green-400';
  };

  const getStatusText = () => {
    if (!status.ytdlp.available) return 'Not Available';
    if (status.update.hasUpdate) {
      const behind = status.update.daysBehind;
      return behind ? `Update Available (${behind} days behind)` : 'Update Available';
    }
    return 'Up to Date';
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">yt-dlp Status</h3>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Current Version:</span>
              <span className="text-white/90">{status.ytdlp.version}</span>
            </div>
            {status.update.latestVersion && (
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Latest Version:</span>
                <span className="text-white/90">{status.update.latestVersion}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Environment:</span>
              <span className="text-white/90 capitalize">{status.environment}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Executable:</span>
              <span className={status.ytdlp.executable ? 'text-green-400' : 'text-red-400'}>
                {status.ytdlp.executable ? 'Found' : 'Missing'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Last Checked:</span>
              <span className="text-white/90">
                {new Date(status.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => performUpdate(false)}
            disabled={isUpdating || !status.update.hasUpdate}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              status.update.hasUpdate && !isUpdating
                ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30 cursor-not-allowed'
            }`}
          >
            {isUpdating ? 'Updating...' : 'Smart Update'}
          </button>
          
          <button
            onClick={() => performUpdate(true)}
            disabled={isUpdating}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              !isUpdating
                ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30'
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30 cursor-not-allowed'
            }`}
          >
            {isUpdating ? 'Updating...' : 'Force Update'}
          </button>
          
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-white/90 text-sm transition-colors border border-white/20"
          >
            Refresh
          </button>
        </div>
      </div>

      {lastUpdate && (
        <div className={`backdrop-blur-sm rounded-lg p-4 border ${
          lastUpdate.success 
            ? 'bg-green-500/10 border-green-500/20' 
            : 'bg-red-500/10 border-red-500/20'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <h4 className={`font-semibold mb-1 ${
                lastUpdate.success ? 'text-green-400' : 'text-red-400'
              }`}>
                {lastUpdate.success ? 'Update Successful' : 'Update Failed'}
              </h4>
              <p className={`text-sm ${
                lastUpdate.success ? 'text-green-300/80' : 'text-red-300/80'
              }`}>
                {lastUpdate.message}
              </p>
              {lastUpdate.oldVersion && lastUpdate.newVersion && (
                <p className="text-xs text-white/60 mt-1">
                  {lastUpdate.oldVersion} → {lastUpdate.newVersion}
                </p>
              )}
            </div>
            <button
              onClick={() => setLastUpdate(null)}
              className="text-white/40 hover:text-white/60 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}