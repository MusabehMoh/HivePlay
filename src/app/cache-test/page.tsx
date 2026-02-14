'use client';

import { useState, useEffect } from 'react';

// Define the result interface for type safety
interface SearchResult {
  id: {
    kind: string;
    videoId?: string;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string, width: number, height: number };
      medium: { url: string, width: number, height: number };
      high: { url: string, width: number, height: number };
    };
    channelTitle: string;
    publishedAt: string;
  };
}

export default function CacheTestPage() {
  const [query, setQuery] = useState('music');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string>('');
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [requestCount, setRequestCount] = useState<number>(0);

  const searchVideos = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setCacheStatus('Searching...');
    const startTime = performance.now();
    setRequestCount(prev => prev + 1);

    try {
      // Call our API route instead of directly using the YouTube service
      const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(query)}&maxResults=10`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch search results');
      }
      
      const endTime = performance.now();
      setTimeElapsed(endTime - startTime);
      setResults(data.results);
      
      // Set cache status based on response from API
      if (data.fromCache) {
        setCacheStatus('Results from Redis cache ✅');
      } else {
        setCacheStatus('Results from YouTube API ⚡');
      }
    } catch (error) {
      console.error('Error:', error);
      setCacheStatus('Error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // On initial load, perform a search
    searchVideos();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Redis Cache Test</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">How to Test the Cache:</h2>
        <ol className="list-decimal ml-5">
          <li>Enter a search query and click "Search"</li>
          <li>The first search for a query will show "Results from YouTube API"</li>
          <li>Search with the same query again and it should show "Results from Redis cache"</li>
          <li>Notice how the cached request is much faster</li>
        </ol>
      </div>
      
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="px-4 py-2 border rounded flex-grow"
          placeholder="Enter search query"
        />
        <button
          onClick={searchVideos}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      <div className="mb-6 p-4 border rounded bg-gray-50">
        <div className="flex items-center gap-4 mb-2">
          <div className="font-semibold">Status:</div>
          <div className={`${cacheStatus.includes('cache') ? 'text-green-600' : cacheStatus.includes('API') ? 'text-blue-600' : ''} font-medium`}>
            {cacheStatus}
          </div>
        </div>
        <div className="flex items-center gap-4 mb-2">
          <div className="font-semibold">Time:</div>
          <div>{timeElapsed.toFixed(2)} ms</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-semibold">Request #:</div>
          <div>{requestCount}</div>
        </div>
      </div>
      
      <h2 className="text-xl font-semibold mb-4">Search Results</h2>
      
      {loading ? (
        <div className="text-center py-10">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((result, index) => (
            <div key={index} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {result.snippet?.thumbnails?.medium?.url && (
                <img
                  src={result.snippet.thumbnails.medium.url}
                  alt={result.snippet.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-3">
                <h3 className="font-semibold line-clamp-2">{result.snippet?.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{result.snippet?.channelTitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}