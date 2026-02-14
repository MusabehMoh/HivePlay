'use client';

import { useEffect, useState } from 'react';

interface UpdateNotification {
  id: string;
  type: 'info' | 'success' | 'error' | 'updating';
  message: string;
  details?: string;
  timestamp: number;
}

let notificationCallbacks: ((notification: UpdateNotification) => void)[] = [];

// Global function to show notifications from server-side events
export function showUpdateNotification(type: 'info' | 'success' | 'error' | 'updating', message: string, details?: string) {
  const notification: UpdateNotification = {
    id: Math.random().toString(36).substr(2, 9),
    type,
    message,
    details,
    timestamp: Date.now()
  };
  
  notificationCallbacks.forEach(callback => callback(notification));
}

export default function AutoUpdateNotification() {
  const [notifications, setNotifications] = useState<UpdateNotification[]>([]);

  useEffect(() => {
    // Subscribe to notifications
    const handleNotification = (notification: UpdateNotification) => {
      setNotifications(prev => {
        // Limit to 3 notifications max
        const updated = [notification, ...prev].slice(0, 3);
        return updated;
      });

      // Auto-remove after 10 seconds (except for updating status)
      if (notification.type !== 'updating') {
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 10000);
      }
    };

    notificationCallbacks.push(handleNotification);

    // Cleanup
    return () => {
      notificationCallbacks = notificationCallbacks.filter(cb => cb !== handleNotification);
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => {
        const colors = {
          info: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
          success: 'bg-green-500/20 border-green-500/50 text-green-300',
          error: 'bg-red-500/20 border-red-500/50 text-red-300',
          updating: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
        };

        const icons = {
          info: 'ℹ️',
          success: '✅',
          error: '❌',
          updating: '🔄'
        };

        return (
          <div
            key={notification.id}
            className={`${colors[notification.type]} backdrop-blur-sm rounded-lg p-4 border shadow-lg animate-slide-in-right`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1">
                <span className="text-xl">{icons[notification.type]}</span>
                <div className="flex-1">
                  <p className="font-semibold mb-1">{notification.message}</p>
                  {notification.details && (
                    <p className="text-xs opacity-80">{notification.details}</p>
                  )}
                </div>
              </div>
              {notification.type !== 'updating' && (
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="text-white/60 hover:text-white/90 transition-colors"
                  aria-label="Close notification"
                >
                  ✕
                </button>
              )}
            </div>
            {notification.type === 'updating' && (
              <div className="mt-2 w-full bg-white/10 rounded-full h-1 overflow-hidden">
                <div className="bg-yellow-400 h-full animate-pulse-slow" style={{ width: '100%' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
