import { FaSearch, FaClock } from 'react-icons/fa';

interface RecentSearchesProps {
  searches: string[];
  onSelect: (search: string) => void;
  onClear: () => void;
}

export default function RecentSearches({
  searches,
  onSelect,
  onClear,
}: RecentSearchesProps) {
  if (searches.length === 0) return null;

  return (
    <div className="bg-spotify-dark-base rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <FaClock className="text-spotify-green" />
          Recent Searches
        </h2>
        <button
          onClick={onClear}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Clear All
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {searches.map((search, index) => (
          <button
            key={index}
            onClick={() => onSelect(search)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-spotify-dark-elevated hover:bg-spotify-dark-highlight transition-colors text-sm text-gray-300 hover:text-white"
          >
            <FaSearch className="w-3 h-3" />
            {search}
          </button>
        ))}
      </div>
    </div>
  );
}