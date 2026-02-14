"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FaChromecast,
  FaVolumeUp,
  FaVolumeMute,
  FaTimes,
  FaSync,
  FaWifi,
  FaExclamationTriangle,
} from "react-icons/fa";

interface ZoneInfo {
  id: string;
  name: string;
  ip: string;
  connected: boolean;
  volume: number;
  muted: boolean;
  groupId: string;
  streamId: string;
}

interface SnapcastStatus {
  connected: boolean;
  serverVersion?: string;
  zones: ZoneInfo[];
  streams: { id: string; status: string }[];
  error?: string;
}

interface CastManagerProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function CastManager({ isVisible, onClose }: CastManagerProps) {
  const [status, setStatus] = useState<SnapcastStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumeChanging, setVolumeChanging] = useState<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const snapRes = await fetch("/api/stream/snapcast");
      const snapData: SnapcastStatus = await snapRes.json();
      setStatus(snapData);
      setError(snapData.error || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for status while visible
  useEffect(() => {
    if (isVisible) {
      fetchStatus();
      pollInterval.current = setInterval(fetchStatus, 5000);
    }
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    };
  }, [isVisible, fetchStatus]);

  const handleVolumeChange = useCallback(
    async (clientId: string, volume: number) => {
      setVolumeChanging(clientId);
      // Optimistic update
      setStatus((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          zones: prev.zones.map((z) =>
            z.id === clientId ? { ...z, volume } : z
          ),
        };
      });

      try {
        await fetch("/api/stream/snapcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setVolume", clientId, volume }),
        });
      } catch (err) {
        console.error("[CastManager] Volume change failed:", err);
      } finally {
        setVolumeChanging(null);
      }
    },
    []
  );

  const handleToggleMute = useCallback(
    async (zone: ZoneInfo) => {
      const newMuted = !zone.muted;
      // Optimistic update
      setStatus((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          zones: prev.zones.map((z) =>
            z.id === zone.id ? { ...z, muted: newMuted } : z
          ),
        };
      });

      try {
        await fetch("/api/stream/snapcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "setVolume",
            clientId: zone.id,
            volume: zone.volume,
            muted: newMuted,
          }),
        });
      } catch (err) {
        console.error("[CastManager] Mute toggle failed:", err);
      }
    },
    []
  );

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-spotify-dark-elevated rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <FaChromecast className="text-spotify-green w-5 h-5" />
            <h2 className="text-white text-lg font-bold">Zone Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
              title="Refresh"
            >
              <FaSync className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {/* Connection Status */}
          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
              <FaExclamationTriangle className="text-red-400 w-4 h-4 flex-shrink-0" />
              <div>
                <p className="text-red-300 text-sm font-medium">
                  Snapcast server not reachable
                </p>
                <p className="text-red-400/70 text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Server Info */}
          {status?.connected && (
            <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
              <FaWifi className="text-spotify-green w-3 h-3" />
              <span>
                Snapcast server v{status.serverVersion} &middot;{" "}
                {status.zones.length} zone{status.zones.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Zones List */}
          {status?.connected && status.zones.length > 0 ? (
            <div className="space-y-3">
              {status.zones.map((zone) => (
                <div
                  key={zone.id}
                  className={`rounded-xl p-4 transition-all ${
                    zone.connected
                      ? "bg-white/5 hover:bg-white/8 border border-white/5"
                      : "bg-white/2 border border-white/5 opacity-50"
                  }`}
                >
                  {/* Zone header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          zone.connected
                            ? "bg-spotify-green shadow-sm shadow-spotify-green/50"
                            : "bg-gray-500"
                        }`}
                      />
                      <div>
                        <p className="text-white text-sm font-semibold">
                          {zone.name}
                        </p>
                        <p className="text-gray-500 text-xs">{zone.ip}</p>
                      </div>
                    </div>

                    {/* Mute button */}
                    {zone.connected && (
                      <button
                        onClick={() => handleToggleMute(zone)}
                        className={`p-2 rounded-full transition-colors ${
                          zone.muted
                            ? "text-red-400 hover:text-red-300 bg-red-500/10"
                            : "text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {zone.muted ? (
                          <FaVolumeMute className="w-4 h-4" />
                        ) : (
                          <FaVolumeUp className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Volume slider */}
                  {zone.connected && (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs w-8 text-right">
                        {zone.volume}%
                      </span>
                      <div className="flex-grow relative group">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={zone.volume}
                          onChange={(e) =>
                            handleVolumeChange(zone.id, parseInt(e.target.value))
                          }
                          className="w-full h-1 bg-gray-600 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-3
                            [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-spotify-green
                            [&::-webkit-slider-thumb]:hover:scale-125
                            [&::-webkit-slider-thumb]:transition-transform
                            [&::-moz-range-thumb]:w-3
                            [&::-moz-range-thumb]:h-3
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-spotify-green
                            [&::-moz-range-thumb]:border-0"
                          disabled={
                            zone.muted || volumeChanging === zone.id
                          }
                          style={{
                            background: `linear-gradient(to right, #1DB954 0%, #1DB954 ${zone.volume}%, #4B5563 ${zone.volume}%, #4B5563 100%)`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Disconnected state */}
                  {!zone.connected && (
                    <p className="text-gray-500 text-xs italic">
                      Offline — check snapclient on this device
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : status?.connected && status.zones.length === 0 ? (
            <div className="text-center py-8">
              <FaChromecast className="text-gray-600 w-10 h-10 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No zones found</p>
              <p className="text-gray-500 text-xs mt-1">
                Start snapclient on your OrangePi or other devices
              </p>
            </div>
          ) : !status?.connected && !error ? (
            <div className="text-center py-8">
              <FaSync className="text-gray-600 w-8 h-8 mx-auto mb-3 animate-spin" />
              <p className="text-gray-400 text-sm">Connecting...</p>
            </div>
          ) : null}
        </div>

        {/* Footer — Setup instructions */}
        {(!status?.connected || error) && (
          <div className="px-5 py-4 border-t border-white/10 bg-white/2">
            <p className="text-gray-400 text-xs font-medium mb-2">
              Quick Setup:
            </p>
            <div className="text-gray-500 text-xs space-y-1">
              <p>
                1. Install Snapcast server on this PC:{" "}
                <code className="bg-white/5 px-1 py-0.5 rounded text-gray-400">
                  choco install snapcast
                </code>
              </p>
              <p>
                2. On OrangePi:{" "}
                <code className="bg-white/5 px-1 py-0.5 rounded text-gray-400">
                  sudo apt install snapclient
                </code>
              </p>
              <p>
                3. Configure snapclient to connect to this PC&apos;s IP
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
