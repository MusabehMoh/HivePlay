"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeMute,
  FaVolumeDown,
  FaForward,
  FaBackward,
  FaRedo,
  FaChevronDown,
  FaExpand,
} from "react-icons/fa";
import {
  HiOutlineSpeakerWave,
  HiOutlineComputerDesktop,
} from "react-icons/hi2";
import { MdCastConnected, MdCast } from "react-icons/md";
import Image from "next/image";

// ─── Types ─────────────────────────────────────────────────
interface AudioPlayerProps {
  videoId: string;
  onEnded?: () => void;
  onPrevious?: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

interface VideoDetails {
  title: string;
  channelTitle: string;
  thumbnail: string;
}

interface ZoneInfo {
  id: string;
  name: string;
  ip: string;
  connected: boolean;
  volume: number;
  muted: boolean;
}

// ─── Component ─────────────────────────────────────────────
export default function AudioPlayer({
  videoId,
  onEnded,
  onPrevious,
  isPlaying,
  onTogglePlay,
}: AudioPlayerProps) {
  // ── Playback state ──
  const [volume, setVolume] = useState(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("ytplayer-volume");
      return s ? parseInt(s) : 70;
    }
    return 70;
  });
  const volumeRef = useRef(volume);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoDetails | null>(null);
  const videoInfoIdRef = useRef<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canPlayFiredRef = useRef(false);
  const fadeOutInProgress = useRef(false);
  const fadeOutTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Cast / device picker state ──
  const [isCasting, setIsCasting] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const castTrackRef = useRef<string | null>(null);
  const prevCastStateRef = useRef({ isCasting: false, isPlaying: false, videoId: '', isReady: false });
  const devicePickerRef = useRef<HTMLDivElement>(null);

  // ── Volume icon ──
  const VolumeIcon =
    volume === 0 ? FaVolumeMute : volume < 50 ? FaVolumeDown : FaVolumeUp;

  // ═══════════════════════════════════════════════════════════
  //  CORE LOGIC
  // ═══════════════════════════════════════════════════════════

  const fadeOutAudio = useCallback(() => {
    if (!audioRef.current || fadeOutInProgress.current) return;
    fadeOutInProgress.current = true;
    const startVol = audioRef.current.volume;
    const steps = 40;
    const step = startVol / steps;
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (audioRef.current) {
        const v = Math.max(0, startVol - step * i);
        audioRef.current.volume = v;
        if (v <= 0 || i >= steps) {
          clearInterval(id);
          onEnded?.();
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.volume = volumeRef.current / 100;
              fadeOutInProgress.current = false;
            }
          }, 100);
        }
      } else {
        clearInterval(id);
        fadeOutInProgress.current = false;
      }
    }, 50);
  }, [onEnded]);

  // ── Cast helpers ──
  const castStart = useCallback(
    async (vid: string, title: string, seekTime?: number) => {
      const t0 = performance.now();
      console.log('[Cast] castStart called:', { vid, title, seekTime });
      try {
        const resp = await fetch("/api/stream/snapcast/cast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            videoId: vid,
            title,
            startTime: seekTime || 0,
          }),
        });
        const data = await resp.json();
        console.log(`[Cast] castStart response (${(performance.now() - t0).toFixed(0)}ms):`, data);
      } catch (e) {
        console.error(`[Cast] start failed (${(performance.now() - t0).toFixed(0)}ms):`, e);
      }
    },
    []
  );

  const castStop = useCallback(async () => {
    const t0 = performance.now();
    console.log('[Cast] castStop called');
    try {
      const resp = await fetch("/api/stream/snapcast/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await resp.json();
      console.log(`[Cast] castStop response (${(performance.now() - t0).toFixed(0)}ms):`, data);
    } catch (e) {
      console.error(`[Cast] stop failed (${(performance.now() - t0).toFixed(0)}ms):`, e);
    }
  }, []);

  const castPause = useCallback(async () => {
    const t0 = performance.now();
    console.log('[Cast] castPause called');
    try {
      const resp = await fetch("/api/stream/snapcast/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      const data = await resp.json();
      console.log(`[Cast] castPause response (${(performance.now() - t0).toFixed(0)}ms):`, data);
    } catch (e) {
      console.error(`[Cast] pause failed (${(performance.now() - t0).toFixed(0)}ms):`, e);
    }
  }, []);

  const castResume = useCallback(async (seekTime?: number) => {
    const t0 = performance.now();
    console.log('[Cast] castResume called:', { seekTime });
    try {
      const resp = await fetch("/api/stream/snapcast/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", startTime: seekTime || 0 }),
      });
      const data = await resp.json();
      console.log(`[Cast] castResume response (${(performance.now() - t0).toFixed(0)}ms):`, data);
    } catch (e) {
      console.error(`[Cast] resume failed (${(performance.now() - t0).toFixed(0)}ms):`, e);
    }
  }, []);

  // ── Handlers ──
  const handlePlayPause = useCallback(() => {
    console.log('[AudioPlayer] handlePlayPause called, current isPlaying:', isPlaying);
    onTogglePlay();
  }, [onTogglePlay, isPlaying]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!audioRef.current) return;
      const t = parseFloat(e.target.value);
      audioRef.current.currentTime = t;
      setCurrentTime(t);
      // When casting, restart cast from the new seek position (last-wins debounce)
      if (isCasting && videoId && videoInfo) {
        if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
        seekTimerRef.current = setTimeout(() => {
          seekTimerRef.current = null;
          if (isCasting && videoId && videoInfo) {
            castTrackRef.current = null;
            castStart(
              videoId,
              videoInfo.title,
              audioRef.current?.currentTime || t
            );
          }
        }, 150);
      }
    },
    [isCasting, videoId, videoInfo, castStart]
  );

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseInt(e.target.value);
      setVolume(v);
      volumeRef.current = v;
      // Don't set local volume if casting — the effect handles it
    },
    []
  );

  const toggleMute = useCallback(() => {
    setVolume((prev) => {
      if (prev > 0) {
        volumeRef.current = prev;
        return 0;
      }
      return volumeRef.current || 70;
    });
  }, []);

  const fmt = useCallback((s: number) => {
    if (isNaN(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  }, []);

  // ── Zone fetching ──
  const fetchZones = useCallback(async () => {
    setZonesLoading(true);
    try {
      const res = await fetch("/api/stream/snapcast");
      const data = await res.json();
      setZones(data.zones || []);
      setZonesError(data.error || null);
    } catch {
      setZonesError("Cannot reach Snapcast server");
    } finally {
      setZonesLoading(false);
    }
  }, []);

  const handleZoneVolume = useCallback(
    async (clientId: string, vol: number) => {
      setZones((prev) =>
        prev.map((z) => (z.id === clientId ? { ...z, volume: vol } : z))
      );
      try {
        await fetch("/api/stream/snapcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setVolume", clientId, volume: vol }),
        });
      } catch {
        /* swallow */
      }
    },
    []
  );

  const handleZoneMute = useCallback(async (zone: ZoneInfo) => {
    const muted = !zone.muted;
    setZones((prev) =>
      prev.map((z) => (z.id === zone.id ? { ...z, muted } : z))
    );
    try {
      await fetch("/api/stream/snapcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setVolume",
          clientId: zone.id,
          volume: zone.volume,
          muted,
        }),
      });
    } catch {
      /* swallow */
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  EFFECTS
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!videoId) return;
    setStreamUrl(null);
    setIsReady(false);
    setIsStreaming(true);
    setError(null);
    if (fadeOutTimer.current) {
      clearTimeout(fadeOutTimer.current);
      fadeOutTimer.current = null;
    }
    fadeOutInProgress.current = false;
    canPlayFiredRef.current = false;
    setStreamUrl(`/api/alternative/playback/hybridStream?videoId=${videoId}`);
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;
    // Mark videoInfo as stale until fetch completes
    videoInfoIdRef.current = null;
    fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
    )
      .then((r) => r.json())
      .then((d) => {
        setVideoInfo({
          title: d.title || "",
          channelTitle: d.author_name || "",
          thumbnail: d.thumbnail_url || "",
        });
        videoInfoIdRef.current = videoId;
      })
      .catch(() => setVideoInfo(null));
  }, [videoId]);

  useEffect(() => {
    const a = audioRef.current;
    console.log('[AudioPlayer] play/pause effect:', { isPlaying, isReady, paused: a?.paused });
    if (!a) return;
    if (isPlaying && isReady) {
      console.log('[AudioPlayer] -> calling a.play()');
      a.play().catch(() => {});
    } else if (!isPlaying) {
      console.log('[AudioPlayer] -> calling a.pause()');
      a.pause();
    }
  }, [isPlaying, isReady]);

  // Mute local audio when casting (keep playing for progress tracking)
  useEffect(() => {
    if (!audioRef.current) return;
    const vol = isCasting ? 0 : volume / 100;
    console.log('[AudioPlayer] volume effect:', { isCasting, volume, appliedVol: vol });
    audioRef.current.volume = vol;
  }, [isCasting, volume]);

  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem("ytplayer-volume", volume.toString());
  }, [volume]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "mediaSession" in navigator &&
      videoInfo
    ) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: videoInfo.title,
        artist: videoInfo.channelTitle,
        artwork: [
          { src: videoInfo.thumbnail, sizes: "512x512", type: "image/png" },
        ],
      });
    }
  }, [videoInfo]);

  // ══════════════════════════════════════════════════════
  //  SINGLE CONSOLIDATED CAST SYNC EFFECT
  //  Tracks previous values to know exactly what changed
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const prev = prevCastStateRef.current;
    const castingJustOn  = isCasting && !prev.isCasting;
    const castingJustOff = !isCasting && prev.isCasting;
    const videoChanged   = videoId !== prev.videoId;
    const playChanged    = isPlaying !== prev.isPlaying;
    const readyChanged   = isReady !== prev.isReady;

    // Update prev for next render
    prevCastStateRef.current = { isCasting, isPlaying, videoId, isReady };

    // Not casting → nothing to do (unless casting just turned off)
    if (!isCasting) {
      if (castingJustOff) {
        console.log('[CastSync] casting turned off → castStop');
        castTrackRef.current = null;
        castStop();
      }
      return;
    }

    // We are casting — need videoInfo (for correct videoId) and isReady
    if (!videoId || !videoInfo || !isReady || videoInfoIdRef.current !== videoId) {
      console.log('[CastSync] waiting for ready/info', { videoId, hasInfo: !!videoInfo, isReady, infoMatchesVideo: videoInfoIdRef.current === videoId });
      return;
    }

    // Paused while casting
    if (!isPlaying) {
      if (playChanged) {
        console.log('[CastSync] paused → castPause (keep TCP alive)');
        castPause();
      }
      return;
    }

    // ── We are casting + playing + ready ──

    if (castingJustOn) {
      // Just switched to casting — start with current seek position
      console.log('[CastSync] casting just enabled → castStart with currentTime:', audioRef.current?.currentTime);
      castTrackRef.current = videoId;
      castStart(videoId, videoInfo.title, audioRef.current?.currentTime || 0);
      return;
    }

    if (videoChanged) {
      // Track changed while casting — BUT isReady might toggle multiple times.
      // Only start if we haven't already started this track.
      if (castTrackRef.current === videoId) {
        console.log('[CastSync] track change but already started, skip');
        return;
      }
      console.log('[CastSync] new track → castStart from 0');
      castTrackRef.current = videoId;
      castStart(videoId, videoInfo.title, 0);
      return;
    }

    if (readyChanged && isReady && castTrackRef.current !== videoId) {
      // isReady flipped to true for a track we haven't started yet
      console.log('[CastSync] ready for new track → castStart from 0');
      castTrackRef.current = videoId;
      castStart(videoId, videoInfo.title, 0);
      return;
    }

    if (playChanged && isPlaying) {
      // Resumed from pause — use fast resume path
      console.log('[CastSync] resumed → castResume with currentTime:', audioRef.current?.currentTime);
      castResume(audioRef.current?.currentTime || 0);
      return;
    }

    console.log('[CastSync] no action needed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCasting, isPlaying, videoId, isReady, videoInfo]);

  // Close device picker on outside click
  useEffect(() => {
    if (!showDevicePicker) return;
    fetchZones();
    const handler = (e: MouseEvent) => {
      if (
        devicePickerRef.current &&
        !devicePickerRef.current.contains(e.target as Node)
      )
        setShowDevicePicker(false);
    };
    // small delay so the button click doesn't immediately close
    const t = setTimeout(
      () => document.addEventListener("mousedown", handler),
      50
    );
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [showDevicePicker, fetchZones]);

  // ═══════════════════════════════════════════════════════════
  //  AUDIO ELEMENT
  // ═══════════════════════════════════════════════════════════
  const audioElement = streamUrl && (
    <audio
      key={streamUrl}
      ref={audioRef}
      src={streamUrl}
      preload="auto"
      className="hidden"
      onLoadedMetadata={() => {
        setDuration(audioRef.current?.duration || 0);
        setIsReady(true);
        if (audioRef.current)
          audioRef.current.volume = isCasting ? 0 : volumeRef.current / 100;
      }}
      onLoadedData={() => {
        setIsStreaming(false);
        if (audioRef.current)
          audioRef.current.volume = isCasting ? 0 : volumeRef.current / 100;
      }}
      onCanPlay={() => {
        // Only fire once per stream to avoid repeated state updates
        if (canPlayFiredRef.current) return;
        canPlayFiredRef.current = true;
        console.log('[AudioPlayer] onCanPlay fired (first time), isPlaying:', isPlaying);
        setIsReady(true);
        setIsStreaming(false);
      }}
      onTimeUpdate={() => {
        if (!audioRef.current) return;
        const t = audioRef.current.currentTime;
        setCurrentTime(t);
        if (
          !isRepeatEnabled &&
          !fadeOutInProgress.current &&
          audioRef.current.duration > 0 &&
          t > 0
        ) {
          const rem = audioRef.current.duration - t;
          if (rem <= 3 && rem > 0) fadeOutAudio();
        }
      }}
      onEnded={() => {
        if (isRepeatEnabled && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        } else {
          fadeOutAudio();
        }
      }}
    />
  );

  const canvasUrl = `/api/canvas?videoId=${videoId}`;
  const progressPct = (currentTime / Math.max(duration, 1)) * 100;

  // ─── Shared sub-components ───────────────────────────────

  const renderSpinner = (size = 20) => (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );

  /* Spotify-style progress bar */
  const renderProgressBar = () => (
    <div className="w-full flex items-center gap-2">
      <span className="text-[11px] tabular-nums text-gray-400 w-10 text-right select-none">
        {fmt(currentTime)}
      </span>
      <div
        className="flex-1 group relative flex items-center"
        style={{ height: 12 }}
      >
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          disabled={isStreaming}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-white/20 rounded-full" />
          <div
            className="absolute inset-y-0 left-0 bg-white group-hover:bg-spotify-green rounded-full transition-colors"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div
          className="absolute w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow"
          style={{
            left: `calc(${progressPct}% - 6px)`,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-gray-400 w-10 select-none">
        {fmt(duration)}
      </span>
    </div>
  );

  /* Spotify-style volume bar */
  const renderVolumeBar = (width = 93) => (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        className="text-gray-400 hover:text-white transition-colors p-1"
      >
        <VolumeIcon className="w-4 h-4" />
      </button>
      <div
        className="group relative flex items-center"
        style={{ width, height: 12 }}
      >
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={handleVolume}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-white/20 rounded-full" />
          <div
            className="absolute inset-y-0 left-0 bg-white group-hover:bg-spotify-green rounded-full transition-colors"
            style={{ width: `${volume}%` }}
          />
        </div>
        <div
          className="absolute w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow"
          style={{
            left: `calc(${volume}% - 6px)`,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
      </div>
    </div>
  );

  /* Equalizer animation bars */
  const renderEqBars = () => (
    <div className="ml-auto flex items-end gap-[2px] h-3">
      <span className="w-[3px] bg-spotify-green rounded-sm animate-pulse" style={{ height: "60%", animationDelay: "0s" }} />
      <span className="w-[3px] bg-spotify-green rounded-sm animate-pulse" style={{ height: "100%", animationDelay: "0.15s" }} />
      <span className="w-[3px] bg-spotify-green rounded-sm animate-pulse" style={{ height: "40%", animationDelay: "0.3s" }} />
    </div>
  );

  /* Device picker (Spotify Connect popover) */
  const renderDevicePicker = (position: "above" | "bottom-sheet") => {
    if (!showDevicePicker) return null;

    const content = (
      <div ref={devicePickerRef} className={
        position === "above"
          ? "absolute bottom-full right-0 mb-3 w-[340px] bg-[#282828] rounded-lg shadow-2xl border border-white/[0.06] overflow-hidden z-50 animate-slide-up"
          : "w-full max-w-md bg-[#282828] rounded-t-2xl shadow-2xl border-t border-white/[0.06] animate-slide-up"
      }>
        {/* Pill handle for bottom sheet */}
        {position === "bottom-sheet" && (
          <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mt-3" />
        )}

        {/* Current device indicator */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5 mb-1">
            {isCasting ? (
              <MdCastConnected className="w-[22px] h-[22px] text-spotify-green" />
            ) : (
              <HiOutlineSpeakerWave className="w-[22px] h-[22px] text-spotify-green" />
            )}
            <h3 className="text-white font-bold text-[15px]">Current device</h3>
          </div>
          <p className="text-spotify-green text-[13px] font-medium flex items-center gap-1.5 ml-8">
            <span className="w-2 h-2 rounded-full bg-spotify-green inline-block flex-shrink-0" />
            {isCasting ? "Snapcast Speakers" : "This computer"}
          </p>
        </div>

        <div className="border-t border-white/[0.06] mx-5" />

        {/* Device list */}
        <div className="px-5 py-3">
          <p className="text-gray-400 text-[11px] font-bold uppercase tracking-[0.08em] mb-2.5">
            Select a device
          </p>

          {/* This computer */}
          <button
            onClick={() => {
              if (isCasting) {
                setIsCasting(false);
                // Restore local volume immediately
                if (audioRef.current) audioRef.current.volume = volumeRef.current / 100;
                // Effect handles castStop
              }
              setShowDevicePicker(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
              !isCasting ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
            }`}
          >
            <HiOutlineComputerDesktop
              className={`w-5 h-5 flex-shrink-0 ${!isCasting ? "text-spotify-green" : "text-gray-400"}`}
            />
            <span
              className={`text-sm font-medium ${!isCasting ? "text-spotify-green" : "text-white"}`}
            >
              This computer
            </span>
            {!isCasting && renderEqBars()}
          </button>

          {/* Snapcast */}
          <button
            onClick={() => {
              if (!isCasting) {
                setIsCasting(true);
                // Mute local audio immediately
                if (audioRef.current) audioRef.current.volume = 0;
                // Don't call castStart here — the unified effect handles it
              }
              setShowDevicePicker(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md mt-1 transition-colors ${
              isCasting ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
            }`}
          >
            <MdCast
              className={`w-5 h-5 flex-shrink-0 ${isCasting ? "text-spotify-green" : "text-gray-400"}`}
            />
            <div className="text-left min-w-0">
              <p className={`text-sm font-medium ${isCasting ? "text-spotify-green" : "text-white"}`}>
                All speakers
              </p>
              <p className="text-gray-500 text-[11px]">Multi-room audio</p>
            </div>
            {isCasting && renderEqBars()}
          </button>
        </div>

        {/* Zone volumes (visible when casting) */}
        {isCasting && zones.filter((z) => z.connected).length > 0 && (
          <>
            <div className="border-t border-white/[0.06] mx-5" />
            <div className="px-5 py-3">
              <p className="text-gray-400 text-[11px] font-bold uppercase tracking-[0.08em] mb-2.5">
                Speaker volumes
              </p>
              <div className="space-y-3">
                {zones
                  .filter((z) => z.connected)
                  .map((zone) => (
                    <div key={zone.id} className="flex items-center gap-2.5">
                      <button onClick={() => handleZoneMute(zone)} className="p-0.5">
                        {zone.muted ? (
                          <FaVolumeMute className="w-3 h-3 text-red-400" />
                        ) : (
                          <FaVolumeDown className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                      <span className="text-gray-300 text-xs w-24 truncate">
                        {zone.name}
                      </span>
                      <div
                        className="flex-1 group relative flex items-center"
                        style={{ height: 12 }}
                      >
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={zone.volume}
                          onChange={(e) =>
                            handleZoneVolume(zone.id, parseInt(e.target.value))
                          }
                          disabled={zone.muted}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full overflow-hidden">
                          <div className="absolute inset-0 bg-white/15 rounded-full" />
                          <div
                            className="absolute inset-y-0 left-0 bg-white group-hover:bg-spotify-green rounded-full transition-colors"
                            style={{ width: `${zone.volume}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-gray-500 text-[10px] w-7 text-right tabular-nums">
                        {zone.volume}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}

        {zonesLoading && (
          <div className="px-5 pb-4 flex justify-center">
            {renderSpinner(16)}
          </div>
        )}
        {zonesError && !zonesLoading && (
          <div className="px-5 pb-3">
            <p className="text-red-400/80 text-[11px]">{zonesError}</p>
          </div>
        )}

        {position === "bottom-sheet" && <div className="pb-6" />}
      </div>
    );

    if (position === "bottom-sheet") {
      return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60">
          {content}
        </div>
      );
    }
    return content;
  };

  // ═══════════════════════════════════════════════════════════
  //  FULLSCREEN MODE (Spotify "Now Playing" view)
  // ═══════════════════════════════════════════════════════════
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-spotify-dark z-50 flex flex-col">
        <video
          autoPlay loop muted playsInline src={canvasUrl}
          className="absolute inset-0 w-full h-full object-cover opacity-30 blur-xl pointer-events-none"
        />
        {audioElement}

        <div className="relative z-10 flex flex-col h-full max-w-lg mx-auto w-full px-6">
          {/* Top bar */}
          <div className="flex items-center justify-between py-4 safe-top">
            <button
              onClick={() => setIsFullScreen(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <FaChevronDown className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-[11px] text-gray-400 uppercase tracking-widest font-medium">
                {isCasting ? "Casting to speakers" : "Playing from HivePlay"}
              </p>
            </div>
            <div className="w-9" />
          </div>

          {/* Album art */}
          <div className="flex-1 flex items-center justify-center py-4">
            {videoInfo?.thumbnail && (
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-lg overflow-hidden shadow-2xl shadow-black/60">
                <Image
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  fill
                  className="object-cover"
                  unoptimized
                  priority
                />
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="mb-6">
            <h2 className="text-white text-xl font-bold truncate">
              {videoInfo?.title || "Loading…"}
            </h2>
            <p className="text-gray-400 text-sm truncate">
              {videoInfo?.channelTitle || ""}
            </p>
          </div>

          {/* Progress */}
          <div className="mb-6">
            {renderProgressBar()}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mb-4 px-2">
            <button
              onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
              className={`p-2 transition-colors relative ${
                isRepeatEnabled
                  ? "text-spotify-green"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FaRedo className="w-5 h-5" />
              {isRepeatEnabled && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-spotify-green rounded-full" />
              )}
            </button>
            <button
              onClick={onPrevious}
              className="p-3 text-gray-400 hover:text-white transition-colors"
            >
              <FaBackward className="w-6 h-6" />
            </button>
            <button
              onClick={handlePlayPause}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
              disabled={isStreaming}
            >
              {isStreaming ? (
                renderSpinner(24)
              ) : isPlaying ? (
                <FaPause className="w-6 h-6 text-black" />
              ) : (
                <FaPlay className="w-6 h-6 text-black ml-1" />
              )}
            </button>
            <button
              onClick={onEnded}
              className="p-3 text-gray-400 hover:text-white transition-colors"
            >
              <FaForward className="w-6 h-6" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDevicePicker(!showDevicePicker)}
                className={`p-2 transition-colors ${
                  isCasting
                    ? "text-spotify-green"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {isCasting ? (
                  <MdCastConnected className="w-5 h-5" />
                ) : (
                  <MdCast className="w-5 h-5" />
                )}
              </button>
              {renderDevicePicker("above")}
            </div>
          </div>

          {/* Volume */}
          <div className="flex justify-center mb-8">
            {renderVolumeBar(200)}
          </div>

          {/* Cast indicator pill */}
          {isCasting && (
            <div className="text-center pb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-spotify-green/15 border border-spotify-green/30 rounded-full">
                <MdCastConnected className="w-3.5 h-3.5 text-spotify-green" />
                <span className="text-spotify-green text-xs font-medium">
                  Casting to speakers
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  MOBILE BAR
  // ═══════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {audioElement}

        {/* Casting indicator */}
        {isCasting && (
          <div className="bg-spotify-green flex items-center justify-center gap-2 py-1 px-3">
            <MdCastConnected className="w-3.5 h-3.5 text-black" />
            <span className="text-black text-[11px] font-bold">
              Casting to speakers
            </span>
          </div>
        )}

        <div className="bg-[#181818] border-t border-white/5">
          {/* Thin progress line at top */}
          <div className="h-[2px] bg-white/10 relative">
            <div
              className="absolute inset-y-0 left-0 bg-white"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {error ? (
            <div className="text-red-500 text-sm px-3 py-2">{error}</div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2">
              {videoInfo?.thumbnail && (
                <div
                  className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                  onClick={() => setIsFullScreen(true)}
                >
                  <Image
                    src={videoInfo.thumbnail}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => setIsFullScreen(true)}
              >
                <p className="text-white text-[13px] font-medium truncate">
                  {videoInfo?.title || "Loading…"}
                </p>
                <p className="text-gray-400 text-[11px] truncate">
                  {videoInfo?.channelTitle || ""}
                </p>
              </div>
              <button
                onClick={() => setShowDevicePicker(!showDevicePicker)}
                className={`p-2 transition-colors ${
                  isCasting ? "text-spotify-green" : "text-gray-400"
                }`}
              >
                {isCasting ? (
                  <MdCastConnected className="w-4 h-4" />
                ) : (
                  <MdCast className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handlePlayPause}
                className="p-2 text-white"
                disabled={isStreaming}
              >
                {isStreaming ? (
                  renderSpinner(20)
                ) : isPlaying ? (
                  <FaPause className="w-5 h-5" />
                ) : (
                  <FaPlay className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Mobile device picker (bottom sheet) */}
        {renderDevicePicker("bottom-sheet")}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  DESKTOP BAR (Spotify 3-column bottom bar)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#181818] border-t border-white/5 z-50">
      {audioElement}

      {/* Casting indicator strip */}
      {isCasting && (
        <div className="bg-spotify-green h-6 flex items-center justify-center gap-2">
          <MdCastConnected className="w-3.5 h-3.5 text-black" />
          <span className="text-black text-[11px] font-bold tracking-wide">
            Casting to speakers
          </span>
          <span className="text-black/60 text-[11px]">·</span>
          <button
            onClick={() => {
              setIsCasting(false);
              if (audioRef.current) audioRef.current.volume = volumeRef.current / 100;
              // Effect handles castStop
            }}
            className="text-black/70 text-[11px] font-bold hover:text-black underline"
          >
            Disconnect
          </button>
        </div>
      )}

      {error ? (
        <div className="text-red-500 text-sm px-4 py-3">{error}</div>
      ) : (
        <div className="h-[72px] px-4 flex items-center">
          {/* ─── LEFT: Track info ─── */}
          <div className="flex items-center gap-3 w-[30%] min-w-0">
            {videoInfo?.thumbnail && (
              <div
                className="relative w-14 h-14 rounded overflow-hidden flex-shrink-0 cursor-pointer group"
                onClick={() => setIsFullScreen(true)}
              >
                <Image
                  src={videoInfo.thumbnail}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                  priority
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <FaExpand className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
            <div className="min-w-0">
              <p
                className="text-white text-sm font-medium truncate hover:underline cursor-pointer"
                onClick={() => setIsFullScreen(true)}
              >
                {videoInfo?.title || "Loading…"}
              </p>
              <p className="text-gray-400 text-[11px] truncate">
                {videoInfo?.channelTitle || ""}
              </p>
            </div>
          </div>

          {/* ─── CENTER: Controls + Progress ─── */}
          <div className="flex-1 flex flex-col items-center gap-1 max-w-[722px] mx-auto">
            <div className="flex items-center gap-5">
              <button
                onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
                className={`p-1 transition-colors relative ${
                  isRepeatEnabled
                    ? "text-spotify-green"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Repeat"
              >
                <FaRedo className="w-[14px] h-[14px]" />
                {isRepeatEnabled && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-spotify-green rounded-full" />
                )}
              </button>
              <button
                onClick={onPrevious}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                disabled={!isReady}
                title="Previous"
              >
                <FaBackward className="w-4 h-4" />
              </button>
              <button
                onClick={handlePlayPause}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
                disabled={isStreaming}
                title="Play / Pause"
              >
                {isStreaming ? (
                  renderSpinner(16)
                ) : isPlaying ? (
                  <FaPause className="w-3.5 h-3.5 text-black" />
                ) : (
                  <FaPlay className="w-3.5 h-3.5 text-black ml-0.5" />
                )}
              </button>
              <button
                onClick={onEnded}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                disabled={!isReady}
                title="Next"
              >
                <FaForward className="w-4 h-4" />
              </button>
              <div className="w-[14px]" />
            </div>
            <div className="w-full">
              {renderProgressBar()}
            </div>
          </div>

          {/* ─── RIGHT: Devices + Volume + Fullscreen ─── */}
          <div className="flex items-center justify-end gap-3 w-[30%]">
            <div className="relative">
              <button
                onClick={() => setShowDevicePicker(!showDevicePicker)}
                className={`p-1.5 transition-colors ${
                  isCasting
                    ? "text-spotify-green"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Connect to a device"
              >
                {isCasting ? (
                  <MdCastConnected className="w-4 h-4" />
                ) : (
                  <MdCast className="w-4 h-4" />
                )}
              </button>
              {renderDevicePicker("above")}
            </div>
            {renderVolumeBar()}
            <button
              onClick={() => setIsFullScreen(true)}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Now Playing view"
            >
              <FaExpand className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
