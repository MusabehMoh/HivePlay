'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '../components/LoadingSpinner';
import YtDlpStatus from '../components/YtDlpStatus';

interface SearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: { default: { url: string }; medium: { url: string } };
    channelTitle: string;
    publishedAt: string;
    description: string;
  };
  contentDetails: {
    duration: string;
    formattedDuration: string;
  };
  statistics?: {
    viewCount: string;
  };
}

interface SearchResponse {
  results: SearchResult[];
  fromCache: boolean;
  instanceUsed?: string; // For Invidious
  error?: string; // Added for error handling
  installationInstructions?: string; // For yt-dlp installation
  recommendedAlternative?: string; // Recommended alternative
  details?: string; // Detailed error message
}

export default function AlternativeSearchTest() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ytdlpResults, setYtdlpResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [isYtDlpAvailable, setIsYtDlpAvailable] = useState<boolean | null>(null);
  const [installInstructions, setInstallInstructions] = useState<string | null>(null);
  const router = useRouter();

  // Use effect to check yt-dlp availability on component mount
  useEffect(() => {
    const checkYtDlpAvailability = async () => {
      try {
        const response = await fetch('/api/alternative/search/ytdlp?query=test&maxResults=1');
        setIsYtDlpAvailable(response.ok);
        if (!response.ok) {
          const data = await response.json();
          if (data.installationInstructions) {
            setInstallInstructions(data.installationInstructions);
          }
        }
      } catch (error) {
        console.error('Error checking yt-dlp availability:', error);
        setIsYtDlpAvailable(false);
      }
    };
    checkYtDlpAvailability();
  }, []);

  // Function to search using yt-dlp
  const searchWithYtdlp = async (query: string) => {
    try {
      const url = new URL('/api/alternative/search/ytdlp', window.location.origin);
      url.searchParams.append('query', query);
      url.searchParams.append('maxResults', '12'); // Limit for comparison
      if (forceRefresh) {
        url.searchParams.append('forceRefresh', 'true');
      }
      const response = await fetch(url.toString());
      const data = await response.json();
      if (response.ok) {
        setIsYtDlpAvailable(true);
        return data;
      } else {
        // Store installation instructions if provided
        if (data.installationInstructions) {
          setInstallInstructions(data.installationInstructions);
        }
        setIsYtDlpAvailable(false);
        throw new Error(data.error || 'Failed to search with yt-dlp');
      }
    } catch (error) {
      console.error('Error searching with yt-dlp:', error);
      throw error;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    setYtdlpResults(null);
    try {
      const ytdlpData = await searchWithYtdlp(searchQuery).catch(error => ({
        results: [],
        fromCache: false,
        error: error instanceof Error ? error.message : 'Failed to search with yt-dlp'
      }));
      setYtdlpResults(ytdlpData);
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const renderResults = (results: SearchResponse | null) => {
    if (!results) return <div className="text-center p-4">No results to display.</div>;
    if (results.error) {
      return (
        <div>
          <div className="text-red-500 p-4 mb-4">Error: {results.error}</div>
          {results.details && <div className="text-gray-600 p-4 mb-4">{results.details}</div>}
          {results.installationInstructions && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
              <h4 className="text-blue-700 font-medium mb-2">Installation Instructions:</h4>
              <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-3 rounded">
                {results.installationInstructions}
              </pre>
            </div>
          )}
        </div>
      );
    }
    return (
      <div>
        <div className="mb-2 text-sm text-gray-500">
          {results.fromCache ? 'Results from cache' : 'Fresh results'}
        </div>
        {results.results.length === 0 ? (
          <div className="text-center p-4">No results found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {results.results.map((item) => (
              <div key={item.id.videoId} className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <img 
                  src={item.snippet.thumbnails.medium.url} 
                  alt={item.snippet.title}
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`;
                  }}
                />
                <div className="p-3">
                  <h3 className="font-semibold text-sm line-clamp-2" title={item.snippet.title}>
                    {item.snippet.title}
                  </h3>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.snippet.channelTitle}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{item.contentDetails.formattedDuration}</span>
                    <span>
                      {item.statistics?.viewCount && 
                        `${Number(item.statistics.viewCount).toLocaleString()} views`}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        router.push(`/?videoId=${item.id.videoId}`);
                      }}
                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded flex-grow"
                    >
                      Play
                    </button>
                    <button
                      onClick={() => {
                        window.open(`https://youtube.com/watch?v=${item.id.videoId}`, '_blank');
                      }}
                      title="Open in YouTube"
                      className="text-xs bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded"
                    >
                      <span className="sr-only">YouTube</span>
                      YT
                    </button>
                    <button
                      onClick={() => {
                        // Copy video ID to clipboard
                        navigator.clipboard.writeText(item.id.videoId);
                        // You could add a toast notification here
                        alert(`Video ID ${item.id.videoId} copied to clipboard`);
                      }}
                      title="Copy video ID"
                      className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded"
                    >
                      <span className="sr-only">Copy ID</span>
                      ID
                    </button>
                  </div>
                  {item.snippet.publishedAt && (
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(item.snippet.publishedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">yt-dlp Search</h1>
      <div className="mb-4">
        <YtDlpStatus />
      </div>
      {isYtDlpAvailable === false && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
          <h4 className="text-yellow-700 font-medium mb-2">yt-dlp is not available</h4>
          <p className="text-sm mb-2">
            yt-dlp is not installed or not in your PATH. Some features will be limited.
          </p>
          {installInstructions && (
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-600 mb-2">
                Show installation instructions
              </summary>
              <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-3 rounded">
                {installInstructions}
              </pre>
            </details>
          )}
        </div>
      )}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter search query..."
            className="flex-1 p-2 border rounded"
          />
          <div className="flex items-center">
            <input
              type="checkbox"
              id="forceRefresh"
              checked={forceRefresh}
              onChange={() => setForceRefresh(!forceRefresh)}
              className="mr-2"
            />
            <label htmlFor="forceRefresh" className="text-sm">Force refresh</label>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
          >
            {isLoading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'Search'}
          </button>
        </div>
      </form>
      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          renderResults(ytdlpResults)
        )}
      </div>
    </div>
  );
}