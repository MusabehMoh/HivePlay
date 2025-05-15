'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockData } from '../lib/MockDataContext';

/**
 * Developer Controls Component
 * 
 * This component provides developer-only controls for testing the application,
 * including the ability to toggle mock data usage and clear cache.
 */
export default function DevControls() {
  const { useMockData: isMockDataEnabled, toggleMockData } = useMockData();
  const [expanded, setExpanded] = useState<boolean>(false);
  const [showPanel, setShowPanel] = useState<boolean>(false);
  const [quota, setQuota] = useState<string>('unknown');
  const router = useRouter();

  useEffect(() => {
    // Only show in development environment
    if (process.env.NODE_ENV === 'development') {
      setShowPanel(true);
      
      // Try to get quota usage if available
      const storedQuota = localStorage.getItem('ytplayer-quota-usage');
      if (storedQuota) {
        try {
          setQuota(storedQuota);
        } catch (e) {
          console.error('Error parsing quota:', e);
        }
      }
    }
  }, []);

  const handleToggleMockData = () => {
    // First toggle the state
    toggleMockData();
    
    // Then, dispatch a custom event that will trigger immediate refresh if needed
    window.dispatchEvent(new CustomEvent('mock-data-toggle', { 
      detail: { shouldRefresh: true } 
    }));
    
    // Log the change to help with debugging
    console.log(`Mock data toggled to: ${!isMockDataEnabled}`);
    
    // Clear any stale cache entries via a POST request to the clear cache endpoint
    // This ensures we don't get mixed results
    fetch('/api/cache/clear?clearType=searchOnly', {
      method: 'POST',
    }).then(() => {
      console.log('Search cache cleared after mock data toggle');
    }).catch(err => {
      console.error('Failed to clear search cache:', err);
    });
  };

  const clearAllCache = async () => {
    try {
      const response = await fetch('/api/cache/clear', {
        method: 'POST',
      });
      
      if (response.ok) {
        alert('Cache cleared successfully. Reloading app...');
        router.refresh();
        window.location.reload();
      } else {
        alert('Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Error clearing cache');
    }
  };

  const recordQuotaUsage = async () => {
    const currentUsage = prompt('Enter current YouTube API quota usage (units used):', quota);
    if (currentUsage) {
      localStorage.setItem('ytplayer-quota-usage', currentUsage);
      setQuota(currentUsage);
    }
  };

  if (!showPanel) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {expanded ? (
        <div className="bg-gray-800 bg-opacity-90 shadow-lg rounded-lg p-4 w-80">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white text-lg font-medium">Developer Controls</h3>
            <button 
              onClick={() => setExpanded(false)}
              className="text-gray-300 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="mock-data-toggle" className="text-white cursor-pointer">
                Use Mock Data
              </label>
              <div 
                className="relative inline-block w-14 h-8 cursor-pointer" 
                onClick={handleToggleMockData}
              >
                <input 
                  type="checkbox" 
                  id="mock-data-toggle" 
                  className="sr-only"
                  checked={isMockDataEnabled} 
                  onChange={handleToggleMockData}
                />
                <div className={`block h-8 rounded-full w-14 ${
                  isMockDataEnabled ? 'bg-green-400' : 'bg-gray-600'
                }`}></div>
                <div 
                  className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${
                    isMockDataEnabled ? 'transform translate-x-6' : ''
                  }`}
                ></div>
              </div>
            </div>
            
            <div className="pt-1">
              <button
                onClick={clearAllCache}
                className="w-full px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
              >
                Clear All Cache
              </button>
            </div>
            
            <div className="pt-1">
              <button
                onClick={recordQuotaUsage}
                className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Record Quota Usage
              </button>
            </div>
            
            <div className="text-xs text-gray-300 mt-2">
              <p>Current Quota: {quota} units</p>
              <p className="mt-1">Using mock data will prevent API calls and preserve your quota.</p>
              <p className="mt-1 font-bold">{isMockDataEnabled ? 'USING MOCK DATA' : 'USING REAL API DATA'}</p>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700"
          title="Developer Controls"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}