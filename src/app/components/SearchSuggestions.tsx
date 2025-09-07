import { useState, useEffect, useRef } from 'react';
import { FaSearch, FaClock, FaFire, FaMusic, FaUser, FaList } from 'react-icons/fa';

interface SuggestionItem {
  text: string;
  thumbnail?: string;
  type: 'artist' | 'song' | 'generic';
}

interface SearchSuggestionsProps {
  query: string;
  recentSearches: string[];
  onSelect: (suggestion: string) => void;
  isVisible: boolean;
  onClose: () => void;
}

const POPULAR_FALLBACK_SUGGESTIONS: SuggestionItem[] = [
  { text: 'pop music', type: 'generic' },
  { text: 'rock music', type: 'generic' },
  { text: 'jazz music', type: 'generic' },
  { text: 'classical music', type: 'generic' },
  { text: 'hip hop music', type: 'generic' },
  { text: 'electronic music', type: 'generic' },
  { text: 'acoustic guitar', type: 'generic' },
  { text: 'piano music', type: 'generic' },
  { text: 'chill music', type: 'generic' },
  { text: 'workout music', type: 'generic' }
];

export default function SearchSuggestions({
  query,
  recentSearches,
  onSelect,
  isVisible,
  onClose,
}: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch dynamic suggestions from API
  const fetchSuggestions = async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setDynamicSuggestions([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (response.ok) {
        const data = await response.json();
        setDynamicSuggestions(data.suggestions || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching suggestions:', error);
        setDynamicSuggestions([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced suggestion fetching
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        fetchSuggestions(query);
      } else {
        setDynamicSuggestions([]);
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      // Show recent searches and popular suggestions when no query
      const recentItems: SuggestionItem[] = recentSearches.slice(0, 3).map(search => ({ text: search, type: 'generic' as const }));
      const popularItems = POPULAR_FALLBACK_SUGGESTIONS.slice(0, 6)
        .filter(popular => !recentItems.some(recent => recent.text.toLowerCase() === popular.text.toLowerCase()));
      
      const combined = [...recentItems, ...popularItems];
      setSuggestions(combined.slice(0, 8));
      setSelectedIndex(-1);
      return;
    }

    // Combine recent searches and dynamic suggestions
    const queryLower = query.toLowerCase();
    const filteredRecent: SuggestionItem[] = recentSearches
      .filter(search => search.toLowerCase().includes(queryLower) && search.toLowerCase() !== queryLower)
      .slice(0, 2)
      .map(search => ({ text: search, type: 'generic' as const }));

    // Combine recent searches and dynamic suggestions
    const combined = [
      ...filteredRecent,
      ...dynamicSuggestions.filter(suggestion => 
        !filteredRecent.some(recent => 
          recent.text.toLowerCase() === suggestion.text.toLowerCase()
        )
      )
    ];
    
    // Remove duplicates more thoroughly by text content
    const uniqueSuggestions = combined.filter((item, index, self) => 
      index === self.findIndex(t => t.text.toLowerCase() === item.text.toLowerCase())
    );
    
    setSuggestions(uniqueSuggestions.slice(0, 8));
    setSelectedIndex(-1);
  }, [query, recentSearches, dynamicSuggestions]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible || suggestions.length === 0) return;

      const maxIndex = suggestions.length + (query.trim() ? 0 : -1);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < maxIndex ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            e.preventDefault();
            onSelect(suggestions[selectedIndex].text);
          } else if (selectedIndex === suggestions.length && query.trim()) {
            e.preventDefault();
            onSelect(query);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, suggestions, selectedIndex, onSelect, onClose, query]);

  if (!isVisible || (suggestions.length === 0 && !isLoading)) {
    return null;
  }

  const hasRecentSearches = recentSearches.length > 0 && !query.trim();
  const hasDynamicSuggestions = dynamicSuggestions.length > 0 && query.trim();

  return (
    <div 
      ref={containerRef}
      className="absolute top-full left-0 right-0 mt-1 bg-spotify-dark-base border border-spotify-dark-highlight rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
    >
      {hasRecentSearches && (
        <div className="px-3 py-2 text-xs text-gray-400 border-b border-spotify-dark-highlight flex items-center gap-2">
          <FaClock className="w-3 h-3" />
          Recent searches
        </div>
      )}
      
      {!hasRecentSearches && !query.trim() && (
        <div className="px-3 py-2 text-xs text-gray-400 border-b border-spotify-dark-highlight flex items-center gap-2">
          <FaFire className="w-3 h-3" />
          Popular searches
        </div>
      )}

      {hasDynamicSuggestions && (
        <div className="px-3 py-2 text-xs text-gray-400 border-b border-spotify-dark-highlight flex items-center gap-2">
          <FaSearch className="w-3 h-3" />
          Suggestions for "{query}"
        </div>
      )}

      {isLoading && (
        <div className="px-4 py-3 text-gray-400 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Finding suggestions...</span>
        </div>
      )}
      
      {suggestions.map((suggestion, index) => {
        const isRecent = recentSearches.includes(suggestion.text);
        const isSelected = index === selectedIndex;
        
        // Get icon based on suggestion type
        const getIcon = () => {
          if (isRecent) return <FaClock className="w-4 h-4 text-gray-400" />;
          switch (suggestion.type) {
            case 'artist': return <FaUser className="w-4 h-4 text-blue-400" />;
            case 'song': return <FaMusic className="w-4 h-4 text-green-400" />;
            case 'generic': return <FaSearch className="w-4 h-4 text-gray-400" />;
            default: return <FaSearch className="w-4 h-4 text-gray-400" />;
          }
        };
        
        return (
          <button
            key={`${suggestion.text}-${index}`}
            onClick={() => onSelect(suggestion.text)}
            className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 ${
              isSelected 
                ? 'bg-spotify-dark-highlight text-white' 
                : 'text-gray-300 hover:bg-spotify-dark-elevated hover:text-white'
            }`}
          >
            {/* Thumbnail or Icon */}
            <div className="flex-shrink-0">
              {suggestion.thumbnail ? (
                <img 
                  src={suggestion.thumbnail} 
                  alt={suggestion.text}
                  className="w-8 h-8 rounded object-cover"
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    (e.target as HTMLImageElement).style.display = 'none';
                    const iconContainer = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (iconContainer) iconContainer.style.display = 'block';
                  }}
                />
              ) : null}
              <div className={suggestion.thumbnail ? "hidden" : "block"}>
                {getIcon()}
              </div>
            </div>
            
            {/* Text Content */}
            <div className="flex-grow">
              {query.trim() ? (
                <span>
                  {suggestion.text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) => (
                    <span
                      key={i}
                      className={
                        part.toLowerCase() === query.toLowerCase()
                          ? 'text-spotify-green font-medium'
                          : ''
                      }
                    >
                      {part}
                    </span>
                  ))}
                </span>
              ) : (
                <span>{suggestion.text}</span>
              )}
              
              {/* Type indicator */}
              {suggestion.type !== 'generic' && (
                <div className="text-xs text-gray-500 mt-1">
                  {suggestion.type === 'artist' ? 'Artist' : 'Song'}
                </div>
              )}
            </div>
          </button>
        );
      })}
      
      {query.trim() && (
        <button
          onClick={() => onSelect(query)}
          className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 border-t border-spotify-dark-highlight ${
            selectedIndex === suggestions.length
              ? 'bg-spotify-dark-highlight text-white'
              : 'text-gray-300 hover:bg-spotify-dark-elevated hover:text-white'
          }`}
        >
          <FaSearch className="w-4 h-4 text-spotify-green" />
          <span>
            Search for "<span className="text-spotify-green font-medium">{query}</span>"
          </span>
        </button>
      )}
    </div>
  );
}
