'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import AudioPlayer from "./components/AudioPlayer";
import SearchResults from "./components/SearchResults";
import LoadingSpinner from "./components/LoadingSpinner";
import RecentSearches from "./components/RecentSearches";
import Playlist from "./components/Playlist";
import PlaylistManager from "./components/PlaylistManager";
import Scheduler from "./components/Scheduler";
import Toast from './components/Toast';
import CacheStats from './components/CacheStats';
import SearchSuggestions from './components/SearchSuggestions';
import { FaSearch, FaTimes, FaChartBar, FaCog } from "react-icons/fa";
import Image from "next/image";
import SettingsPanel from "./components/SettingsPanel";

const MAX_RECENT_SEARCHES = 5;

let toastIdCounter = 0;
const generateUniqueId = () => {
  toastIdCounter += 1;
  return `toast-${Date.now()}-${toastIdCounter}`;
};

interface SearchError {
  message: string;
  code?: string;
}

interface SearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: {
      default: {
        url: string;
      };
      medium?: {
        url: string;
      };
    };
    channelTitle: string;
  };
}

interface PlaylistItem {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface Playlists {
  [playlistName: string]: PlaylistItem[];
}

const DEFAULT_PLAYLIST_NAME = "Default Playlist";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Playlists>({ [DEFAULT_PLAYLIST_NAME]: [] });
  const [activePlaylistName, setActivePlaylistName] = useState<string>(DEFAULT_PLAYLIST_NAME);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showCacheStats, setShowCacheStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSuggestionRequestRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const SUGGESTION_COOLDOWN = 2000;

  const getActivePlaylistItems = useCallback(() => {
    return playlists[activePlaylistName] || [];
  }, [playlists, activePlaylistName]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = generateUniqueId();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  useEffect(() => {
    if (error) {
      showToast(error.message, 'error');
    }
  }, [error, showToast]);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const savedPlaylists = localStorage.getItem('playlists');
    const savedActivePlaylist = localStorage.getItem('activePlaylistName');

    if (savedPlaylists) {
      try {
        const parsedPlaylists = JSON.parse(savedPlaylists);
        if (Object.keys(parsedPlaylists).length === 0) {
          setPlaylists({ [DEFAULT_PLAYLIST_NAME]: [] });
          setActivePlaylistName(DEFAULT_PLAYLIST_NAME);
        } else {
          setPlaylists(parsedPlaylists);
          setActivePlaylistName(savedActivePlaylist && parsedPlaylists[savedActivePlaylist] ? savedActivePlaylist : Object.keys(parsedPlaylists)[0]);
        }
      } catch (e) {
        console.error("Failed to parse playlists from localStorage", e);
        setPlaylists({ [DEFAULT_PLAYLIST_NAME]: [] });
        setActivePlaylistName(DEFAULT_PLAYLIST_NAME);
      }
    } else {
      setPlaylists({ [DEFAULT_PLAYLIST_NAME]: [] });
      setActivePlaylistName(DEFAULT_PLAYLIST_NAME);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('playlists', JSON.stringify(playlists));
    localStorage.setItem('activePlaylistName', activePlaylistName);
  }, [playlists, activePlaylistName]);

  const dispatchCacheEvent = (type: string, fromCache: boolean, time: number, query?: string) => {
    const event = new CustomEvent('redis-cache-hit', {
      detail: { type, fromCache, time, query }
    });
    window.dispatchEvent(event);
  };

  const handleSearch = async (e: React.FormEvent | null, overrideQuery?: string, forceRefresh = false) => {
    if (e) e.preventDefault();
    const queryToUse = overrideQuery || searchQuery;
    if (!queryToUse.trim()) return;

    setIsLoading(true);
    setError(null);

    const startTime = performance.now();

    try {
      const url = new URL(`/api/alternative/search/ytsearch`, window.location.origin);
      url.searchParams.append('query', queryToUse);
      url.searchParams.append('maxResults', '50');
      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch results');
      }

      const data = await response.json();

      if (data.results) {
        setSearchResults(data.results);
      } else if (Array.isArray(data)) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
        throw new Error('Unexpected API response format');
      }

      const endTime = performance.now();
      dispatchCacheEvent('Search', data.fromCache, endTime - startTime, queryToUse);

      addToRecentSearches(queryToUse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError({ message: errorMessage });
      showToast(errorMessage, 'error');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToPlaylist = (result: SearchResult, targetPlaylistName: string = activePlaylistName) => {
    const newItem: PlaylistItem = {
      id: result.id.videoId,
      title: result.snippet.title,
      thumbnail: result.snippet.thumbnails.medium?.url || '',
      channelTitle: result.snippet.channelTitle,
    };

    // Check if item exists in the target playlist *before* calling setPlaylists
    const currentPlaylist = playlists[targetPlaylistName] || [];
    const itemExists = currentPlaylist.some(item => item.id === newItem.id);

    if (itemExists) {
      showToast(`'${newItem.title}' is already in the '${targetPlaylistName}' playlist`, 'error');
      return; // Exit early if item already exists
    }

    // Show success toast *before* updating state
    showToast(`Added '${newItem.title}' to '${targetPlaylistName}'`, 'success');

    // Update the playlists state
    setPlaylists(prev => {
      // We already confirmed the item doesn't exist, so just add it
      const updatedPlaylist = [...(prev[targetPlaylistName] || []), newItem];
      return {
        ...prev,
        [targetPlaylistName]: updatedPlaylist
      };
    });
  };

  const handleRemoveFromPlaylist = (videoId: string) => {
    setPlaylists(prev => {
      const currentPlaylist = prev[activePlaylistName] || [];
      const updatedPlaylist = currentPlaylist.filter(item => item.id !== videoId);

      if (videoId === currentVideoId && updatedPlaylist.length < currentPlaylist.length) {
        setCurrentVideoId(null);
        setIsPlaying(false);
      }

      return {
        ...prev,
        [activePlaylistName]: updatedPlaylist
      };
    });
  };

  const handleMoveUp = (videoId: string) => {
    setPlaylists(prev => {
      const currentPlaylist = prev[activePlaylistName] || [];
      const index = currentPlaylist.findIndex(item => item.id === videoId);
      if (index === -1 || index === 0) return prev;

      const newPlaylist = [...currentPlaylist];
      [newPlaylist[index - 1], newPlaylist[index]] = [newPlaylist[index], newPlaylist[index - 1]];

      return { ...prev, [activePlaylistName]: newPlaylist };
    });
  };

  const handleMoveDown = (videoId: string) => {
    setPlaylists(prev => {
      const currentPlaylist = prev[activePlaylistName] || [];
      const index = currentPlaylist.findIndex(item => item.id === videoId);
      if (index === -1 || index === currentPlaylist.length - 1) return prev;

      const newPlaylist = [...currentPlaylist];
      [newPlaylist[index + 1], newPlaylist[index]] = [newPlaylist[index], newPlaylist[index + 1]];

      return { ...prev, [activePlaylistName]: newPlaylist };
    });
  };

  const createPlaylist = (name: string) => {
    if (!name.trim()) {
      showToast("Playlist name cannot be empty", "error");
      return false;
    }
    if (playlists[name]) {
      showToast(`Playlist "${name}" already exists`, "error");
      return false;
    }
    setPlaylists(prev => ({ ...prev, [name]: [] }));
    setActivePlaylistName(name);
    showToast(`Playlist "${name}" created`, "success");
    return true;
  };

  const deletePlaylist = (name: string) => {
    if (Object.keys(playlists).length <= 1) {
      showToast("Cannot delete the last playlist", "error");
      return;
    }
    if (!playlists[name]) return;

    setPlaylists(prev => {
      const updatedPlaylists = { ...prev };
      delete updatedPlaylists[name];
      return updatedPlaylists;
    });

    if (activePlaylistName === name) {
      setActivePlaylistName(Object.keys(playlists)[0] || DEFAULT_PLAYLIST_NAME);
    }
    showToast(`Playlist "${name}" deleted`, "success");
  };

  const renamePlaylist = (oldName: string, newName: string) => {
    if (!newName.trim()) {
      showToast("Playlist name cannot be empty", "error");
      return false;
    }
    if (oldName === newName) return true;
    if (playlists[newName]) {
      showToast(`Playlist "${newName}" already exists`, "error");
      return false;
    }
    if (!playlists[oldName]) return false;

    setPlaylists(prev => {
      const updatedPlaylists = { ...prev };
      updatedPlaylists[newName] = updatedPlaylists[oldName];
      delete updatedPlaylists[oldName];
      return updatedPlaylists;
    });

    if (activePlaylistName === oldName) {
      setActivePlaylistName(newName);
    }
    showToast(`Playlist "${oldName}" renamed to "${newName}"`, "success");
    return true;
  };

  const handleVideoSelect = (videoId: string) => {
    console.log(`[Page] handleVideoSelect called with videoId: ${videoId}`);
    if (videoId === currentVideoId) {
      console.log(`[Page] Same video selected. Ensuring isPlaying is true.`);
      if (!isPlaying) {
        setIsPlaying(true);
      }
      return;
    }
    console.log(`[Page] New video selected. Setting videoId and isPlaying=true.`);
    setCurrentVideoId(videoId);
    setIsPlaying(true);
  };

  const handleTogglePlayPause = (videoId: string | null) => {
    if (!videoId) return;
    console.log(`[Page] handleTogglePlayPause called for videoId: ${videoId}`);
    if (videoId === currentVideoId) {
      setIsPlaying(prev => {
        console.log(`[Page] Toggling isPlaying for current video. New state: ${!prev}`);
        return !prev;
      });
    } else {
      console.log(`[Page] Toggling play/pause for a different video. Selecting it and setting isPlaying=true.`);
      setCurrentVideoId(videoId);
      setIsPlaying(true);
    }
  };

  const handleVideoEnd = () => {
    const activePlaylist = getActivePlaylistItems();
    if (activePlaylist.length === 0) {
      setIsPlaying(false);
      return;
    }

    const currentIndex = activePlaylist.findIndex(item => item.id === currentVideoId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % activePlaylist.length;
    setCurrentVideoId(activePlaylist[nextIndex].id);
    setIsPlaying(true);
  };

  const handleSchedulePlay = (itemId: string, type: 'song' | 'playlist') => {
    if (type === 'playlist') {
      // Switch to the scheduled playlist and play the first song
      const playlist = playlists[itemId];
      if (playlist && playlist.length > 0) {
        setActivePlaylistName(itemId);
        setCurrentVideoId(playlist[0].id);
        setIsPlaying(true);
        showToast(`Started scheduled playlist: ${itemId}`, 'success');
      }
    } else {
      // Play the scheduled song directly
      setCurrentVideoId(itemId);
      setIsPlaying(true);
      showToast(`Started scheduled song`, 'success');
    }
  };

  const handlePrevious = () => {
    const activePlaylist = getActivePlaylistItems();
    if (activePlaylist.length === 0) return;

    const currentIndex = activePlaylist.findIndex(item => item.id === currentVideoId);
    if (currentIndex === -1) {
      setCurrentVideoId(activePlaylist[0].id);
      setIsPlaying(true);
      return;
    }

    const previousIndex = (currentIndex - 1 + activePlaylist.length) % activePlaylist.length;
    setCurrentVideoId(activePlaylist[previousIndex].id);
    setIsPlaying(true);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setShowSuggestions(false);
  };

  const handleRecentSearchSelect = (query: string) => {
    setSearchQuery(query);
    handleSearch(null, query);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  const addToRecentSearches = (query: string) => {
    const updated = [query, ...recentSearches.filter(s => s !== query)]
      .slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Search suggestions handlers
  const handleSearchInputFocus = () => {
    setShowSuggestions(true);
  };

  const handleSearchInputBlur = () => {
    // Delay hiding suggestions to allow for suggestion clicks
    setTimeout(() => setShowSuggestions(false), 150);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    handleSearch(null, suggestion);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Show suggestions when user starts typing
    if (value.trim() || recentSearches.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      handleSearch(null);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      searchInputRef.current?.blur();
    }
  };

  return (
    <div className="min-h-screen pb-28">
      <div className="sticky top-0 z-10 bg-spotify-dark/95 backdrop-blur-md px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex gap-4 items-center">
          <div className="flex items-center gap-4">
            <Image
              src="/hiveplay.png"
              alt="HivePlay"
              width={40}
              height={40}
              className="rounded-lg"
              priority
            />
          </div>
          <div className="relative flex-grow max-w-2xl">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={handleSearchInputKeyDown}
              onFocus={handleSearchInputFocus}
              onBlur={handleSearchInputBlur}
              placeholder="Search for songs..."
              className="w-full px-4 py-3 bg-spotify-dark-base text-white rounded-full 
                focus:outline-none focus:ring-2 focus:ring-spotify-green 
                placeholder:text-gray-500 pr-20"
            />
            <SearchSuggestions
              query={searchQuery}
              recentSearches={recentSearches}
              onSelect={handleSuggestionSelect}
              isVisible={showSuggestions}
              onClose={() => setShowSuggestions(false)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <FaTimes />
                </button>
              )}
              <button
                onClick={() => handleSearch(null)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Search"
              >
                <FaSearch />
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowCacheStats(!showCacheStats)}
            className={`p-2 rounded-full ${showCacheStats ? 'bg-spotify-green text-black' : 'text-gray-400 hover:text-white'}`}
            aria-label="Toggle cache statistics"
            title="Toggle Redis cache statistics"
          >
            <FaChartBar />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2 rounded-full ${showSettings ? 'bg-spotify-green text-black' : 'text-gray-400 hover:text-white'}`}
            aria-label="Open settings"
            title="Settings"
          >
            <FaCog />
          </button>
        </div>
      </div>

      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div className="lg:col-span-2 xl:col-span-3 space-y-6">
            {recentSearches.length > 0 && (
              <RecentSearches
                searches={recentSearches}
                onSelect={handleRecentSearchSelect}
                onClear={clearRecentSearches}
              />
            )}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : searchResults.length > 0 ? (
              <SearchResults
                results={searchResults}
                selectedVideoId={currentVideoId}
                onSelect={handleVideoSelect}
                onAddToPlaylist={handleAddToPlaylist}
                playlists={playlists}
                activePlaylistName={activePlaylistName}
                isPlaying={isPlaying}
                onTogglePlayPause={handleTogglePlayPause}
              />
            ) : (
              <div className="text-center py-12">
                <div className="flex justify-center">
                  <Image
                    src="/hiveplay.png"
                    alt="HivePlay"
                    width={120}
                    height={120}
                    className="rounded-xl shadow-lg"
                    priority
                  />
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-1 space-y-4">
            <PlaylistManager
              playlists={playlists}
              activePlaylistName={activePlaylistName}
              setActivePlaylist={setActivePlaylistName}
              createPlaylist={createPlaylist}
              deletePlaylist={deletePlaylist}
              renamePlaylist={renamePlaylist}
            />
            <Playlist
              items={getActivePlaylistItems()}
              playlistName={activePlaylistName}
              currentVideoId={currentVideoId}
              isPlaying={isPlaying}
              onPlay={handleTogglePlayPause}
              onRemove={handleRemoveFromPlaylist}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
            <Scheduler
              playlists={playlists}
              onSchedulePlay={handleSchedulePlay}
              searchResults={searchResults}
            />
          </div>
        </div>
      </div>

      {currentVideoId && (
        <AudioPlayer
          videoId={currentVideoId}
          onEnded={handleVideoEnd}
          onPrevious={handlePrevious}
          isPlaying={isPlaying}
          onTogglePlay={() => handleTogglePlayPause(currentVideoId)}
        />
      )}

      <CacheStats isVisible={showCacheStats} />

      <div className="fixed bottom-28 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}
