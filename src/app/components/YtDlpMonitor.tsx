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
  
  const hasTriggeredUpdate = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /** Trigger a server-side auto-update and report result via toast */
  const triggerAutoUpdate = useCallback(async (currentVersion: string, latestVersion: string, daysBehind: number) => {
    const dayLabel = `${daysBehind} day${daysBehind === 1 ? '' : 's'} behind`;
    showUpdateNotification(
      'updating',
      'Auto-updating yt-dlp…',
      `${currentVersion} → ${latestVersion} (${dayLabel})`
    );

    try {
      const response = await fetch('/api/yt-dlp/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', force: false })
      });

      const result = await response.json();

      if (result.success) {
        if (result.newVersion && result.newVersion !== currentVersion) {
          showUpdateNotification(
            'success',
            'yt-dlp updated successfully',
            `${currentVersion} → ${result.newVersion}`
          );
        } else {
          // Already up to date (startup update already ran)
          showUpdateNotification(
            'success',
            'yt-dlp is up to date',
            `Version: ${result.newVersion ?? latestVersion}`
          );
        }
      } else {
        showUpdateNotification(
          'error',
          'yt-dlp auto-update failed',
          result.message || 'Check server logs for details'
        );
      }
    } catch (err) {
      console.error('[yt-dlp-monitor] Auto-update request failed:', err);
      showUpdateNotification(
        'error',
        'yt-dlp auto-update failed',
        'Network error — check server logs'
      );
    }
  }, []);

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

        // Auto-update once if we detect an update with valid version info
        if (
          data.hasUpdate &&
          !hasTriggeredUpdate.current &&
          data.latestVersion &&
          data.latestVersion !== 'unknown' &&
          data.currentVersion &&
          data.daysBehind &&
          data.daysBehind > 0 &&
          data.daysBehind < 60
        ) {
          hasTriggeredUpdate.current = true;
          await triggerAutoUpdate(data.currentVersion, data.latestVersion, data.daysBehind);
        }
      }
    } catch (error) {
      console.error('[yt-dlp-monitor] Failed to check for updates:', error);
      setStatus(prev => ({ ...prev, isChecking: false, lastCheck: new Date() }));
    }
  }, [triggerAutoUpdate]);

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
