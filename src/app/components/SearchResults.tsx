import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { FaPlay, FaPause, FaPlus, FaClock } from 'react-icons/fa';

interface SearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: {
      default: { url: string };
      medium?: { url: string };
    };
    channelTitle: string;
  };
  contentDetails?: {
    duration?: string;
    formattedDuration?: string;
  };
  statistics?: {
    viewCount?: string;
  };
}

interface PlaylistItem {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  selectedVideoId: string | null;
  onSelect: (videoId: string) => void;
  onAddToPlaylist: (result: SearchResult, playlistName?: string) => void;
  playlists: { [key: string]: PlaylistItem[] };
  activePlaylistName: string;
  isPlaying: boolean;
  onTogglePlayPause: (videoId: string) => void;
}

export default function SearchResults({
  results,
  selectedVideoId,
  onSelect,
  onAddToPlaylist,
  playlists,
  activePlaylistName,
  isPlaying,
  onTogglePlayPause,
}: SearchResultsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // Show 12 videos per page for better balance
  const totalPages = Math.ceil(results.length / itemsPerPage);

  const [showPlaylistOptionsFor, setShowPlaylistOptionsFor] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        const targetElement = event.target as Element;
        if (!targetElement.closest('[data-popover-trigger]')) {
          setShowPlaylistOptionsFor(null);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    window.scrollTo(0, 0); // Scroll to top when page changes
  };

  const handleAddClick = (result: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering play/select on the row
    if (Object.keys(playlists).length <= 1) {
      onAddToPlaylist(result, activePlaylistName);
      setShowPlaylistOptionsFor(null);
    } else {
      setShowPlaylistOptionsFor(showPlaylistOptionsFor === result.id.videoId ? null : result.id.videoId);
    }
  };

  const handleSelectPlaylistToAdd = (result: SearchResult, playlistName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToPlaylist(result, playlistName);
    setShowPlaylistOptionsFor(null); // Close dropdown after adding
  };

  // Get current videos for the page
  const indexOfLastVideo = currentPage * itemsPerPage;
  const indexOfFirstVideo = indexOfLastVideo - itemsPerPage;
  const currentVideos = results.slice(indexOfFirstVideo, indexOfLastVideo);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 max-w-7xl mx-auto">
        {currentVideos.map((result, index) => {
          const videoKey = result.id?.videoId ? `video-${result.id.videoId}` : `video-index-${index}`;
          const isPopoverOpen = showPlaylistOptionsFor === result.id.videoId;

          return (
            <div
              key={videoKey}
              className={`group relative bg-spotify-dark-base rounded-md p-4 hover:bg-spotify-dark-elevated transition-all cursor-pointer ${
                selectedVideoId === result.id?.videoId ? 'ring-2 ring-spotify-green' : ''
              }`}
              onClick={() => result.id?.videoId && onSelect(result.id.videoId)}
            >
              <div className="aspect-video relative mb-4 rounded-md overflow-hidden">
                <Image
                  src={result.snippet.thumbnails.medium?.url || result.snippet.thumbnails.default.url}
                  alt={result.snippet.title}
                  fill
                  className="object-cover"
                  unoptimized
                  priority={index < 2} // Add priority to first two images for better LCP
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const clickedVideoId = result.id?.videoId;
                      if (!clickedVideoId) return;

                      if (clickedVideoId === selectedVideoId) {
                        if (onTogglePlayPause) {
                          onTogglePlayPause(clickedVideoId);
                        }
                      } else {
                        onSelect(clickedVideoId);
                      }
                    }}
                    className="p-2 bg-spotify-green rounded-full hover:scale-110 transition-transform"
                    aria-label={selectedVideoId === result.id?.videoId && isPlaying ? "Pause" : "Play"}
                  >
                    {selectedVideoId === result.id?.videoId && isPlaying ? (
                      <FaPause className="w-5 h-5 text-white" />
                    ) : (
                      <FaPlay className="w-5 h-5 text-white ml-1" />
                    )}
                  </button>
                  <button
                    data-popover-trigger
                    onClick={(e) => handleAddClick(result, e)}
                    className="p-2 bg-spotify-green rounded-full hover:scale-110 transition-transform"
                    aria-label="Add to playlist"
                    title={Object.keys(playlists).length > 1 ? "Add to playlist..." : `Add to ${activePlaylistName}`}
                  >
                    <FaPlus className="w-5 h-5 text-white" />
                  </button>
                </div>
                {selectedVideoId === result.id?.videoId && isPlaying && (
                  <div className="absolute bottom-2 right-2 bg-spotify-green text-white text-xs px-2 py-1 rounded-full">
                    Playing
                  </div>
                )}
              </div>
              <h3 className="font-medium text-white truncate mb-1" title={result.snippet.title}>{result.snippet.title}</h3>
              <p className="text-xs md:text-sm text-gray-400 dark:text-gray-400 mt-1">{result.snippet.channelTitle}</p>
              {result.contentDetails?.formattedDuration && (
                <div className="flex items-center text-xs text-gray-400 mt-1">
                  <FaClock className="mr-1" />
                  <span>{result.contentDetails.formattedDuration}</span>
                </div>
              )}
              {isPopoverOpen && Object.keys(playlists).length > 1 && (
                <div
                  ref={popoverRef}
                  className="absolute top-1/2 -translate-y-1/2 left-full ml-2 w-48 bg-spotify-dark-elevated rounded-md shadow-lg z-30 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1 text-xs text-gray-400 border-b border-spotify-dark-highlight">Add to...</div>
                  {Object.keys(playlists).map((playlistName) => (
                    <button
                      key={playlistName}
                      onClick={(e) => handleSelectPlaylistToAdd(result, playlistName, e)}
                      className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-spotify-dark-highlight transition-colors truncate"
                      title={`Add to ${playlistName}`}
                    >
                      {playlistName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 py-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-md bg-spotify-dark-elevated hover:bg-spotify-dark-highlight disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
              <button
                key={`page-${pageNumber}`}
                onClick={() => handlePageChange(pageNumber)}
                className={`px-3 py-1 rounded-md ${
                  currentPage === pageNumber
                    ? 'bg-green-500 text-white'
                    : 'bg-spotify-dark-elevated hover:bg-spotify-dark-highlight'
                }`}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-md bg-spotify-dark-elevated hover:bg-spotify-dark-highlight disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}