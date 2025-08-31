import Image from 'next/image';
import { useState, useEffect } from 'react';
import { FaPlay, FaTrash, FaArrowUp, FaArrowDown, FaPause } from 'react-icons/fa';

interface PlaylistItem {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

interface PlaylistProps {
  items: PlaylistItem[];
  playlistName: string; // Add playlist name prop
  currentVideoId: string | null;
  isPlaying: boolean;
  onPlay: (videoId: string) => void;
  onRemove: (videoId: string) => void;
  onMoveUp: (videoId: string) => void;
  onMoveDown: (videoId: string) => void;
}

// Create a scrolling text component for long titles
function ScrollingText({ text, isActive }: { text: string; isActive: boolean }) {
  const [shouldScroll, setShouldScroll] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Check if text needs scrolling (only on hover or when active)
  useEffect(() => {
    if (text.length > 25 && (isHovered || isActive)) {
      setShouldScroll(true);
    } else {
      setShouldScroll(false);
    }
  }, [text, isHovered, isActive]);
  
  return (
    <div 
      className="relative overflow-hidden w-full" 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={`text-sm font-medium whitespace-nowrap ${shouldScroll ? 'animate-marquee' : 'truncate'}`}
      >
        {text}
      </div>
    </div>
  );
}

export default function Playlist({
  items,
  playlistName, // Destructure the new prop
  currentVideoId,
  isPlaying,
  onPlay,
  onRemove,
  onMoveUp,
  onMoveDown,
}: PlaylistProps) {
  const handlePlayPauseClick = async (videoId: string) => {
    console.log('PLAYLIST: handlePlayPauseClick called with videoId:', videoId);
    console.log('PLAYLIST: currentVideoId is:', currentVideoId);
    console.log('PLAYLIST: isPlaying state is:', isPlaying);

    // If this is currently playing and we want to pause
    if (videoId === currentVideoId && isPlaying) {
      console.log('PLAYLIST: This is currently playing video - pausing via onPlay');
      // Call onPlay to update the UI state (which should toggle pause)
      onPlay(videoId);
    }
    // If this is already the current video but paused, we want to play it
    else if (videoId === currentVideoId && !isPlaying) {
      console.log('PLAYLIST: This is current but paused video - playing via onPlay');
      // Call onPlay to update the UI state (which should toggle play)
      onPlay(videoId);
    }
    // Otherwise, it's a different video, use normal flow
    else {
      console.log('PLAYLIST: This is a different video - sending play command');
      // Regular flow for changing videos
      onPlay(videoId);
    }
  };

  if (items.length === 0) {
    return (
      <div className="p-6 text-center bg-spotify-dark-base rounded-lg">
        {/* Fix HTML entity escaping */}
        <p className="text-gray-400">Playlist &apos;{playlistName}&apos; is empty</p>
        <p className="text-sm text-gray-500 mt-2">
          Add songs by clicking the + button on search results
        </p>
      </div>
    );
  }

  return (
    <div className="bg-spotify-dark-base rounded-lg p-4">
      <h2 className="text-xl font-bold text-white mb-4">{playlistName}</h2> {/* Display playlist name */}
      <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1"> {/* Add max height and scroll */}
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`group flex items-center gap-3 p-2 rounded-md transition-all ${
              currentVideoId === item.id
                ? 'bg-spotify-dark-highlight text-spotify-green'
                : 'hover:bg-spotify-dark-elevated text-gray-300'
            }`}
          >
            <div className="relative flex-shrink-0">
              <Image
                src={item.thumbnail}
                alt={item.title}
                width={48}
                height={36} /* Changed from 48 to maintain YouTube thumbnail's 4:3 aspect ratio */
                className="rounded object-cover w-[48px] h-[36px]"
                unoptimized
              />
              <button
                onClick={() => handlePlayPauseClick(item.id)}
                className={`absolute inset-0 flex items-center justify-center bg-black/60 rounded
                  ${currentVideoId === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} 
                  transition-opacity`}
                aria-label={currentVideoId === item.id && isPlaying ? "Pause" : "Play"}
              >
                {currentVideoId === item.id && isPlaying ? (
                  <FaPause className="w-4 h-4" />
                ) : (
                  <FaPlay className="w-4 h-4" />
                )}
              </button>
            </div>
            
            <div className="flex-grow min-w-0">
              <ScrollingText text={item.title} isActive={currentVideoId === item.id} />
              <p className="text-xs text-gray-400 truncate">{item.channelTitle}</p>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onMoveUp(item.id)}
                disabled={index === 0}
                className={`p-1.5 rounded-full hover:bg-spotify-dark-highlight transition-colors
                  ${index === 0 ? 'text-gray-600' : 'text-gray-400 hover:text-white'}`}
              >
                <FaArrowUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onMoveDown(item.id)}
                disabled={index === items.length - 1}
                className={`p-1.5 rounded-full hover:bg-spotify-dark-highlight transition-colors
                  ${index === items.length - 1 ? 'text-gray-600' : 'text-gray-400 hover:text-white'}`}
              >
                <FaArrowDown className="w-3 h-3" />
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-spotify-dark-highlight transition-colors"
              >
                <FaTrash className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}