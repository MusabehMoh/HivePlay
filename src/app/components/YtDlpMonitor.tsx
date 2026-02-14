'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { showUpdateNotification } from './AutoUpdateNotification';

interface YtDlpMonitorStatus {
  isChecking: boolean;
  lastCheck: Date | null;
  hasUpdate: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  daysBehind: number | null;
}

export function useYtDlpMonitor() {
  const [status, setStatus] = useState<YtDlpMonitorStatus>({
    isChecking: false,
    lastCheck: null,
    hasUpdate: false,
    currentVersion: null,
    latestVersion: null,
    daysBehind: null
  });
  
  const hasShownUpdateNotification = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkForUpdates = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, isChecking: true }));
      
      const response = await fetch('/api/yt-dlp/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' })
      });

      if (response.ok) {
        const data = await response.json();
        setStatus({
          isChecking: false,
          lastCheck: new Date(),
          hasUpdate: data.hasUpdate || false,
          currentVersion: data.currentVersion || null,
          latestVersion: data.latestVersion || null,
          daysBehind: data.daysBehind || null
        });

        // Only show notification if:
        // 1. We have confirmed update info (not GitHub API failure)
        // 2. Haven't shown it before
        // 3. Latest version is known and valid
        // 4. Days behind is reasonable (< 60 days)
        if (data.hasUpdate && 
            !hasShownUpdateNotification.current && 
            data.latestVersion && 
            data.latestVersion !== 'unknown' &&
            data.daysBehind && 
            data.daysBehind > 0 &&
            data.daysBehind < 60) {
          
          const message = `yt-dlp update available (${data.daysBehind} days behind)`;
          showUpdateNotification('info', message, `Current: ${data.currentVersion}, Latest: ${data.latestVersion}`);
          hasShownUpdateNotification.current = true;
        }
      }
    } catch (error) {
      console.error('[yt-dlp-monitor] Failed to check for updates:', error);
      setStatus(prev => ({ ...prev, isChecking: false, lastCheck: new Date() }));
    }
  }, []);

  useEffect(() => {
    // Check on mount
    checkForUpdates();

    // Check every 5 minutes
    checkIntervalRef.current = setInterval(checkForUpdates, 5 * 60 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkForUpdates]);

  return { status, checkForUpdates };
}

export default function YtDlpMonitor() {
  useYtDlpMonitor();
  return null;
}
