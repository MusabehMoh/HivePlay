'use client';

import { useState, useEffect } from 'react';
import { FaDatabase, FaBolt, FaHourglassHalf } from 'react-icons/fa';

interface CacheStatsProps {
  isVisible: boolean;
}

interface RequestStat {
  type: string;
  fromCache: boolean;
  time: number;
  query?: string;
}

export default function CacheStats({ isVisible }: CacheStatsProps) {
  const [stats, setStats] = useState<{
    totalRequests: number;
    cachedRequests: number;
    apiRequests: number;
    avgCachedTime: number;
    avgApiTime: number;
    recentRequests: RequestStat[];
  }>({
    totalRequests: 0,
    cachedRequests: 0,
    apiRequests: 0,
    avgCachedTime: 0,
    avgApiTime: 0,
    recentRequests: []
  });

  useEffect(() => {
    // Try to load stats from localStorage
    const savedStats = localStorage.getItem('cacheStats');
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (error) {
        console.error('Failed to parse cache stats:', error);
      }
    }

    // Set up event listener for recording cache activity
    window.addEventListener('redis-cache-hit', ((event: CustomEvent) => {
      const { type, fromCache, time, query } = event.detail;
      
      setStats(prev => {
        // Update stats
        const newTotalRequests = prev.totalRequests + 1;
        const newCachedRequests = fromCache ? prev.cachedRequests + 1 : prev.cachedRequests;
        const newApiRequests = !fromCache ? prev.apiRequests + 1 : prev.apiRequests;
        
        // Update average times
        const newAvgCachedTime = fromCache 
          ? ((prev.avgCachedTime * prev.cachedRequests) + time) / (prev.cachedRequests + 1)
          : prev.avgCachedTime;
          
        const newAvgApiTime = !fromCache 
          ? ((prev.avgApiTime * prev.apiRequests) + time) / (prev.apiRequests + 1)
          : prev.avgApiTime;
        
        // Add to recent requests, keeping only the latest 10
        const newRecentRequests = [
          { type, fromCache, time, query },
          ...prev.recentRequests
        ].slice(0, 10);
        
        // Create updated stats
        const updatedStats = {
          totalRequests: newTotalRequests,
          cachedRequests: newCachedRequests,
          apiRequests: newApiRequests,
          avgCachedTime: newAvgCachedTime,
          avgApiTime: newAvgApiTime,
          recentRequests: newRecentRequests
        };
        
        // Save to localStorage
        localStorage.setItem('cacheStats', JSON.stringify(updatedStats));
        
        return updatedStats;
      });
    }) as EventListener);
    
    return () => {
      window.removeEventListener('redis-cache-hit', (() => {}) as EventListener);
    };
  }, []);

  if (!isVisible) return null;

  const cacheHitRate = stats.totalRequests > 0 
    ? Math.round((stats.cachedRequests / stats.totalRequests) * 100) 
    : 0;
  
  const timeSaved = Math.round((stats.apiRequests * (stats.avgApiTime - stats.avgCachedTime)) / 1000);

  return (
    <div className="fixed bottom-28 left-4 z-50 bg-spotify-dark-elevated p-4 rounded-lg shadow-lg text-white max-w-md">
      <div className="font-bold text-lg mb-2 flex items-center gap-2">
        <FaDatabase className="text-spotify-green" />
        <span>Redis Cache Performance</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-gray-400 text-xs">Cache Hit Rate</div>
          <div className="text-xl font-semibold">{cacheHitRate}%</div>
        </div>
        
        <div>
          <div className="text-gray-400 text-xs">Time Saved</div>
          <div className="text-xl font-semibold">{timeSaved}s</div>
        </div>
        
        <div>
          <div className="text-gray-400 text-xs">Cached Requests</div>
          <div className="flex items-center gap-1">
            <FaBolt className="text-yellow-400" />
            <span>{stats.cachedRequests}</span>
          </div>
        </div>
        
        <div>
          <div className="text-gray-400 text-xs">API Requests</div>
          <div className="flex items-center gap-1">
            <FaHourglassHalf className="text-blue-400" />
            <span>{stats.apiRequests}</span>
          </div>
        </div>
      </div>
      
      {stats.recentRequests.length > 0 && (
        <>
          <div className="text-sm font-medium mb-1">Recent Requests</div>
          <div className="text-xs max-h-32 overflow-y-auto space-y-1">
            {stats.recentRequests.map((req, i) => (
              <div key={i} className="flex items-center border-l-2 pl-2 py-1" 
                style={{borderColor: req.fromCache ? '#1DB954' : '#1e90ff'}}>
                <div className="flex-1 truncate">
                  <span className="text-gray-400">{req.type}: </span>
                  <span>{req.query || 'N/A'}</span>
                </div>
                <div className={`${req.fromCache ? 'text-spotify-green' : 'text-blue-400'} ml-2`}>
                  {req.time.toFixed(0)}ms
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      
      <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between items-center">
        <button 
          onClick={() => {
            setStats({
              totalRequests: 0,
              cachedRequests: 0,
              apiRequests: 0,
              avgCachedTime: 0,
              avgApiTime: 0,
              recentRequests: []
            });
            localStorage.removeItem('cacheStats');
          }}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Reset Stats
        </button>
        
        <div className="text-xs text-gray-400">
          Powered by Redis
        </div>
      </div>
    </div>
  );
}