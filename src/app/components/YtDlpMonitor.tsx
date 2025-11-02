'use client';

import { useEffect, useRef, useState } from 'react';
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

  const checkForUpdates = async () => {
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

        // Only show notification if we have confirmed update info (not just GitHub API failure)
        // Don't show if latestVersion is "unknown" or if daysBehind is very high (likely wrong data)
        if (data.hasUpdate && 
            !hasShownUpdateNotification.current && 
            data.latestVersion && 
            data.latestVersion !== 'unknown' &&
            data.daysBehind && 
            data.daysBehind < 60) { // Only show if less than 2 months behind
          
          const message = `yt-dlp update available (${data.daysBehind} days behind)`;
          showUpdateNotification('info', message, `Current: ${data.currentVersion}, Latest: ${data.latestVersion}`);
          hasShownUpdateNotification.current = true;
        }
      }
    } catch (error) {
      console.error('[yt-dlp-monitor] Failed to check for updates:', error);
      setStatus(prev => ({ ...prev, isChecking: false }));
    }
  };

  useEffect(() => {
    // Check on mount
    checkForUpdates();

    // Check every 5 minutes
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { status, checkForUpdates };
}

export default function YtDlpMonitor() {
  useYtDlpMonitor();
  return null;
}
