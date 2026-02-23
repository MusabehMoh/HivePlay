import { useState, useEffect, useRef } from 'react';
import { FaSearch, FaClock } from 'react-icons/fa';

interface SearchSuggestionsProps {
  query: string;
  recentSearches: string[];
  onSelect: (suggestion: string) => void;
  isVisible: boolean;
  onClose: () => void;
}

export default function SearchSuggestions({
  query,
  recentSearches,
  onSelect,
  isVisible,
  onClose,
}: SearchSuggestionsProps) {
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch from the YouTube autocomplete proxy
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!query.trim() || query.trim().length < 2) {
        setApiSuggestions([]);
        return;
      }

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      try {
        setIsLoading(true);
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, {
          signal: abortControllerRef.current.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setApiSuggestions(data.suggestions || []);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') setApiSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      abortControllerRef.current?.abort();
    };
  }, [query]);

  // Reset keyboard selection whenever the list changes
  useEffect(() => { setSelectedIndex(-1); }, [apiSuggestions, query]);

  // Build the final list shown in the dropdown
  const items: { text: string; isRecent: boolean }[] = (() => {
    if (!query.trim()) {
      // No query -> show recent searches only
      return recentSearches.slice(0, 8).map(t => ({ text: t, isRecent: true }));
    }

    const queryLow = query.toLowerCase();
    const matchingRecent = recentSearches
      .filter(r => r.toLowerCase().includes(queryLow) && r.toLowerCase() !== queryLow)
      .slice(0, 2)
      .map(t => ({ text: t, isRecent: true }));

    const seen = new Set(matchingRecent.map(i => i.text.toLowerCase()));
    const fromApi = apiSuggestions
      .filter(t => !seen.has(t.toLowerCase()))
      .map(t => ({ text: t, isRecent: false }));

    return [...matchingRecent, ...fromApi].slice(0, 8);
  })();

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isVisible) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(p => Math.min(p + 1, items.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(p => Math.max(p - 1, -1));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault();
          onSelect(items[selectedIndex].text);
        } else if (selectedIndex === items.length && query.trim()) {
          e.preventDefault();
          onSelect(query);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isVisible, items, selectedIndex, onSelect, onClose, query]);

  if (!isVisible || (items.length === 0 && !isLoading && !query.trim())) return null;

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 right-0 mt-1 bg-[#212121] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden py-2"
    >
      {/* Loading indicator */}
      {isLoading && items.length === 0 && (
        <div className="flex items-center gap-3 px-4 py-3 text-gray-500 text-sm">
          <div className="w-3.5 h-3.5 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
          Searching...
        </div>
      )}

      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const trimmedQuery = query.trim();

        // YouTube style: typed portion is dimmed, completion suffix is white+bold
        let display: React.ReactNode = item.text;
        if (trimmedQuery && !item.isRecent) {
          const lower = item.text.toLowerCase();
          const qLow = trimmedQuery.toLowerCase();
          if (lower.startsWith(qLow)) {
            display = (
              <>
                <span className="text-white/60">{item.text.slice(0, trimmedQuery.length)}</span>
                <span className="text-white font-medium">{item.text.slice(trimmedQuery.length)}</span>
              </>
            );
          } else {
            display = <span className="text-white">{item.text}</span>;
          }
        }

        return (
          <button
            key={`${item.text}-${index}`}
            onClick={() => onSelect(item.text)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              isSelected ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            <span className="flex-shrink-0 text-gray-500">
              {item.isRecent
                ? <FaClock className="w-3.5 h-3.5" />
                : <FaSearch className="w-3.5 h-3.5" />}
            </span>
            <span className="flex-grow text-sm truncate">{display}</span>
          </button>
        );
      })}

      {/* "Search for ..." footer row */}
      {query.trim() && (
        <button
          onClick={() => onSelect(query)}
          onMouseEnter={() => setSelectedIndex(items.length)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-t border-white/5 mt-1 ${
            selectedIndex === items.length ? 'bg-white/10' : 'hover:bg-white/5'
          }`}
        >
          <span className="flex-shrink-0 text-spotify-green">
            <FaSearch className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm text-gray-300">
            Search for <span className="text-white font-medium">"{query}"</span>
          </span>
        </button>
      )}
    </div>
  );
}
