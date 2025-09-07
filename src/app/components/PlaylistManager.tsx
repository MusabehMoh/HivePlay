'use client';

import { useState, useRef, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaSave, FaTimes, FaEllipsisV, FaCheck } from 'react-icons/fa';

interface PlaylistItem {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

interface Playlists {
  [playlistName: string]: PlaylistItem[];
}

interface PlaylistManagerProps {
  playlists: Playlists;
  activePlaylistName: string;
  setActivePlaylist: (name: string) => void;
  createPlaylist: (name: string) => boolean; // Returns true on success
  deletePlaylist: (name: string) => void;
  renamePlaylist: (oldName: string, newName: string) => boolean; // Returns true on success
}

export default function PlaylistManager({
  playlists,
  activePlaylistName,
  setActivePlaylist,
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
}: PlaylistManagerProps) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const playlistNames = Object.keys(playlists);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Focus input when renaming
  useEffect(() => {
    if (editingName && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select(); // Select existing text
    }
  }, [editingName]);

  const handleCreate = () => {
    if (createPlaylist(newPlaylistName)) {
      setNewPlaylistName('');
      setIsCreating(false);
      setShowDropdown(false); // Close dropdown after creation
    }
  };

  const handleCancelCreate = () => {
    setNewPlaylistName('');
    setIsCreating(false);
  };

  const handleSelectPlaylist = (name: string) => {
    setActivePlaylist(name);
    setShowDropdown(false);
  };

  const handleStartRename = (name: string) => {
    setEditingName(name);
    setRenameValue(name);
    setShowDropdown(false); // Close main dropdown when opening rename input
  };

  const handleConfirmRename = () => {
    if (editingName && renamePlaylist(editingName, renameValue)) {
      setEditingName(null);
      setRenameValue('');
    }
  };

  const handleCancelRename = () => {
    setEditingName(null);
    setRenameValue('');
  };

  const handleDelete = (name: string) => {
    // Optional: Add a confirmation dialog here
    if (window.confirm(`Are you sure you want to delete the playlist "${name}"?`)) {
        deletePlaylist(name);
        setShowDropdown(false); // Close dropdown after deletion
    }
  };

  return (
    <div className="bg-spotify-dark-base rounded-lg p-4 relative">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-white">Playlists</h2>
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-spotify-dark-highlight transition-colors"
            aria-label="Playlist options"
          >
            <FaEllipsisV />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-spotify-dark-elevated rounded-md shadow-lg z-20 py-1">
              {playlistNames.map((name) => (
                <button
                  key={name}
                  onClick={() => handleSelectPlaylist(name)}
                  className={`w-full text-left px-4 py-2 text-sm flex justify-between items-center transition-colors ${ 
                    name === activePlaylistName 
                    ? 'bg-spotify-green/20 text-spotify-green' 
                    : 'text-gray-300 hover:bg-spotify-dark-highlight'
                  }`}
                >
                  <span className="truncate flex-grow mr-2">{name}</span>
                  {name === activePlaylistName && <FaCheck className="w-3 h-3 flex-shrink-0"/>}
                </button>
              ))}
              <div className="border-t border-spotify-dark-highlight my-1"></div>
              {!isCreating ? (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-spotify-dark-highlight transition-colors flex items-center gap-2"
                >
                  <FaPlus className="w-3 h-3" /> Create New
                </button>
              ) : (
                <div className="px-2 py-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="New playlist name..."
                    className="w-full px-2 py-1 text-sm bg-spotify-dark-highlight text-white rounded border border-transparent focus:outline-none focus:border-spotify-green"
                  />
                  <div className="flex justify-end gap-1 mt-1">
                     <button onClick={handleCancelCreate} className="p-1 text-gray-400 hover:text-white"><FaTimes size={12}/></button>
                     <button onClick={handleCreate} className="p-1 text-spotify-green hover:text-white"><FaCheck size={12}/></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Display Active Playlist Name and Edit/Delete Buttons */}
      <div className="flex items-center justify-between gap-2 bg-spotify-dark-highlight p-2 rounded">
        {editingName === activePlaylistName ? (
          <div className="flex-grow flex items-center gap-1">
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
              className="flex-grow px-2 py-1 text-sm bg-spotify-dark-base text-white rounded border border-transparent focus:outline-none focus:border-spotify-green"
            />
            <button onClick={handleCancelRename} className="p-1 text-gray-400 hover:text-white"><FaTimes size={12}/></button>
            <button onClick={handleConfirmRename} className="p-1 text-spotify-green hover:text-white"><FaSave size={12}/></button>
          </div>
        ) : (
          <span className="text-base font-semibold text-white truncate flex-grow" title={activePlaylistName}>
            {activePlaylistName}
          </span>
        )}

        {editingName !== activePlaylistName && (
          <div className="flex items-center flex-shrink-0">
            <button
              onClick={() => handleStartRename(activePlaylistName)}
              className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-spotify-dark-base transition-colors"
              aria-label="Rename playlist"
              title="Rename playlist"
            >
              <FaEdit className="w-3.5 h-3.5" />
            </button>
            {playlistNames.length > 1 && ( // Only show delete if more than one playlist exists
              <button
                onClick={() => handleDelete(activePlaylistName)}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-spotify-dark-base transition-colors"
                aria-label="Delete playlist"
                title="Delete playlist"
              >
                <FaTrash className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
