'use client';

import { useEffect, useRef } from 'react';
import { FaTimes, FaCog } from 'react-icons/fa';
import YtDlpUpdateStatus from './YtDlpUpdateStatus';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onMouseDown={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-md h-full bg-[#121212] border-l border-white/10 shadow-2xl overflow-y-auto animate-slide-in-right"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#121212]/95 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-3">
            <FaCog className="text-spotify-green text-lg" />
            <h2 className="text-white font-semibold text-lg">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close settings"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6">
          {/* yt-dlp Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              yt-dlp
            </h3>
            <YtDlpUpdateStatus />
          </section>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* App info */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              About
            </h3>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">App</span>
                <span className="text-white/90">HivePlay</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Stack</span>
                <span className="text-white/90">Next.js 15 · yt-dlp · Redis</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
