import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Readable, Transform, TransformCallback } from 'stream';
import { createClient } from 'redis';
import { getYtDlpPath, getCookieArgs } from '../alternative/ytdlp-locator';

/**
 * Snapcast Audio Streamer
 * Manages the audio pipeline: yt-dlp → ffmpeg → Snapcast TCP input
 * 
 * Architecture:
 *   yt-dlp downloads audio (m4a) to stdout
 *   → ffmpeg converts to raw PCM (s16le, 44100Hz, stereo)
 *   → Real-time throttle (to prevent dumping entire buffer at once)
 *   → TCP socket writes to Snapcast server's TCP stream input
 */

/**
 * Real-time PCM throttle.
 * 
 * Problem: ffmpeg processes the entire cached audio in ~100ms and exits.
 * When ffmpeg stdout ends, the Transform stream flushes and closes, killing the TCP pipe.
 * 
 * Solution: Buffer all incoming PCM data, and drain it at real-time playback rate
 * using a setInterval. _flush() only completes when the buffer is fully drained,
 * keeping the stream alive for the entire song duration.
 */
class RealtimeThrottle extends Transform {
  private bytesPerSecond: number;
  private pcmBuffer: Buffer[] = [];
  private pcmBufferSize: number = 0;
  private startTime: number = 0;
  private totalSent: number = 0;
  private stopped: boolean = false;
  private drainTimer: ReturnType<typeof setInterval> | null = null;
  private flushCb: TransformCallback | null = null;
  private inputDone: boolean = false;

  constructor(sampleRate: number, channels: number, bytesPerSample: number = 2) {
    super();
    this.bytesPerSecond = sampleRate * channels * bytesPerSample;
    console.log(`[Throttle] Created: ${this.bytesPerSecond} bytes/sec (${sampleRate}Hz, ${channels}ch, ${bytesPerSample}B)`);
  }

  stop() {
    console.log('[Throttle] stop() called');
    this.stopped = true;
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
    if (this.flushCb) {
      this.flushCb();
      this.flushCb = null;
    }
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    if (this.stopped) { callback(); return; }
    this.pcmBuffer.push(chunk);
    this.pcmBufferSize += chunk.length;
    // Start draining on first data
    if (!this.drainTimer) {
      this.startTime = Date.now();
      this.startDraining();
      const totalDurationSec = 0; // will be calculated as data comes in
      console.log(`[Throttle] First data received, starting drain timer`);
    }
    callback(); // Accept data immediately — don't block ffmpeg
  }

  private startDraining() {
    const INTERVAL_MS = 50; // drain every 50ms for lower latency
    const bytesPerInterval = Math.floor(this.bytesPerSecond * INTERVAL_MS / 1000);
    // Allow 0.5 seconds of buffer ahead for low-latency Snapcast playback
    const aheadAllowanceBytes = Math.floor(this.bytesPerSecond * 0.5);

    this.drainTimer = setInterval(() => {
      if (this.stopped) {
        if (this.drainTimer) clearInterval(this.drainTimer);
        return;
      }

      // Nothing left to send?
      if (this.pcmBufferSize <= 0) {
        if (this.inputDone) {
          console.log(`[Throttle] Buffer fully drained. Total sent: ${this.totalSent} bytes (${(this.totalSent / this.bytesPerSecond).toFixed(1)}s of audio)`);
          if (this.drainTimer) { clearInterval(this.drainTimer); this.drainTimer = null; }
          if (this.flushCb) { this.flushCb(); this.flushCb = null; }
        }
        return;
      }

      // How far ahead of real-time are we?
      const elapsedMs = Date.now() - this.startTime;
      const targetBytes = Math.floor((this.bytesPerSecond * elapsedMs) / 1000) + aheadAllowanceBytes;
      const canSend = targetBytes - this.totalSent;

      if (canSend <= 0) return; // Too far ahead, wait

      const toSend = Math.min(canSend, bytesPerInterval * 3, this.pcmBufferSize);
      let remaining = toSend;

      while (remaining > 0 && this.pcmBuffer.length > 0) {
        const front = this.pcmBuffer[0];
        if (front.length <= remaining) {
          this.push(front);
          this.totalSent += front.length;
          this.pcmBufferSize -= front.length;
          remaining -= front.length;
          this.pcmBuffer.shift();
        } else {
          const slice = front.subarray(0, remaining);
          this.push(slice);
          this.totalSent += remaining;
          this.pcmBufferSize -= remaining;
          this.pcmBuffer[0] = front.subarray(remaining);
          remaining = 0;
        }
      }
    }, INTERVAL_MS);
  }

  _flush(callback: TransformCallback) {
    this.inputDone = true;
    const totalAudioSec = ((this.pcmBufferSize + this.totalSent) / this.bytesPerSecond).toFixed(1);
    console.log(`[Throttle] _flush called. Buffered: ${this.pcmBufferSize} bytes, Sent: ${this.totalSent} bytes, Total audio: ${totalAudioSec}s`);
    if (this.pcmBufferSize <= 0) {
      // Everything already sent
      if (this.drainTimer) { clearInterval(this.drainTimer); this.drainTimer = null; }
      callback();
    } else {
      // Wait for drain timer to finish
      console.log(`[Throttle] Waiting for drain... ${this.pcmBufferSize} bytes remaining`);
      this.flushCb = callback;
    }
  }
}

interface StreamingState {
  videoId: string;
  title?: string;
  ytDlpProcess: ChildProcess | null;
  ffmpegProcess: ChildProcess | null;
  tcpSocket: net.Socket | null;
  throttle: RealtimeThrottle | null;
  startedAt: number;
  status: 'starting' | 'streaming' | 'stopping' | 'finished' | 'paused' | 'error';
  error?: string;
}

interface CastConfig {
  snapcastHost: string;
  snapcastTcpPort: number;  // TCP stream input port (not the JSON-RPC port)
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

const DEFAULT_CAST_CONFIG: CastConfig = {
  snapcastHost: process.env.SNAPCAST_HOST || '192.168.0.223',
  snapcastTcpPort: parseInt(process.env.SNAPCAST_TCP_PORT || '4953'),
  sampleRate: 44100,   // YouTube format 140 native rate
  channels: 2,
  bitDepth: 16,
};

// Singleton state
let activeStream: StreamingState | null = null;
let castEnabled = false;

// In-memory audio cache to avoid Redis roundtrips on seek/resume
const audioCache = new Map<string, Buffer>();
const AUDIO_CACHE_MAX = 5; // Keep last 5 tracks in memory

// Cache ffmpeg path so we don't scan filesystem every call
let cachedFfmpegPath: string | null | undefined = undefined; // undefined = not yet checked

/**
 * Find ffmpeg executable - check project dir, then PATH
 */
function findFfmpeg(): string | null {
  // Check project directory first
  const projectDir = process.cwd();
  const localFFmpeg = path.join(projectDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(localFFmpeg)) {
    return localFFmpeg;
  }

  // Check common paths
  const commonPaths = process.platform === 'win32'
    ? [
        path.join(os.homedir(), 'ffmpeg.exe'),
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      ]
    : ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  // Fall back to bare name (rely on PATH)
  return 'ffmpeg';
}

/**
 * Kill a child process gracefully
 */
function killProcess(proc: ChildProcess | null): void {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { windowsHide: true });
    } else {
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 2000);
    }
  } catch {
    // Already dead
  }
}

/**
 * Get ffmpeg path (cached after first lookup)
 */
function getFfmpegPath(): string | null {
  if (cachedFfmpegPath !== undefined) return cachedFfmpegPath;
  cachedFfmpegPath = findFfmpeg();
  return cachedFfmpegPath;
}

/**
 * Get audio buffer — in-memory cache first, then Redis
 */
async function getAudioBuffer(videoId: string): Promise<Buffer | null> {
  // Check in-memory cache first (instant, no I/O)
  const memCached = audioCache.get(videoId);
  if (memCached) {
    console.log(`[SnapcastStreamer] Using in-memory cached audio for ${videoId} (${memCached.length} bytes)`);
    return memCached;
  }
  // Fall back to Redis
  const redisBuf = await getCachedAudio(videoId);
  if (redisBuf) {
    // Store in memory for future seeks
    if (audioCache.size >= AUDIO_CACHE_MAX) {
      // Evict oldest entry
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(videoId, redisBuf);
  }
  return redisBuf;
}

/**
 * Stop the current streaming pipeline
 */
export async function stopCasting(): Promise<{ success: boolean; message: string }> {
  const t0 = Date.now();
  if (!activeStream) {
    return { success: true, message: 'No active stream' };
  }

  console.log('[SnapcastStreamer] Stopping cast for:', activeStream.videoId);
  activeStream.status = 'stopping';

  killProcess(activeStream.ytDlpProcess);
  killProcess(activeStream.ffmpegProcess);

  // Unpipe and stop the throttle
  if (activeStream.throttle) {
    if (activeStream.tcpSocket) {
      try { activeStream.throttle.unpipe(activeStream.tcpSocket); } catch { /* ignore */ }
    }
    activeStream.throttle.stop();
  }

  if (activeStream.tcpSocket) {
    try {
      // Send a short silence buffer to flush Snapcast's audio pipeline
      const silenceBytes = 44100 * 2 * 2 * 0.3;
      const silence = Buffer.alloc(Math.floor(silenceBytes), 0);
      const sock = activeStream.tcpSocket;
      sock.write(silence, () => {
        try { sock.end(); sock.destroy(); } catch { /* ignore */ }
      });
      // Fallback destroy after 200ms in case write callback doesn't fire
      setTimeout(() => {
        try { sock.destroy(); } catch { /* ignore */ }
      }, 200);
    } catch {
      try {
        activeStream.tcpSocket.end();
        activeStream.tcpSocket.destroy();
      } catch { /* ignore */ }
    }
  }

  const videoId = activeStream.videoId;
  activeStream = null;
  console.log(`[Timing] stop: total ${Date.now() - t0}ms`);
  return { success: true, message: `Stopped casting ${videoId}` };
}

/**
 * Pause casting — stops audio pipeline and closes TCP. Resume will reconnect.
 */
export async function pauseCasting(): Promise<{ success: boolean; message: string }> {
  const t0 = Date.now();
  if (!activeStream) {
    return { success: true, message: 'No active stream' };
  }
  if (activeStream.status === 'paused') {
    return { success: true, message: 'Already paused' };
  }

  console.log('[SnapcastStreamer] Pausing cast for:', activeStream.videoId);

  // Kill ffmpeg
  killProcess(activeStream.ffmpegProcess);
  activeStream.ffmpegProcess = null;

  // Stop throttle
  if (activeStream.throttle && activeStream.tcpSocket) {
    try { activeStream.throttle.unpipe(activeStream.tcpSocket); } catch { /* ignore */ }
  }
  const oldThrottle = activeStream.throttle;
  activeStream.throttle = null;
  if (oldThrottle) oldThrottle.stop();

  // Close TCP (resume will reconnect for clean audio)
  if (activeStream.tcpSocket && !activeStream.tcpSocket.destroyed) {
    try { activeStream.tcpSocket.end(); activeStream.tcpSocket.destroy(); } catch { /* ignore */ }
  }
  activeStream.tcpSocket = null;

  activeStream.status = 'paused';
  console.log(`[Timing] pause: done in ${Date.now() - t0}ms`);
  return { success: true, message: `Paused casting ${activeStream.videoId}` };
}

/**
 * Resume casting from a given position — reconnects TCP for clean audio.
 */
export async function resumeCasting(
  startTime?: number
): Promise<{ success: boolean; message: string; error?: string }> {
  const t0 = Date.now();
  if (!activeStream || activeStream.status !== 'paused') {
    return { success: false, message: 'No paused stream to resume', error: 'not paused' };
  }

  console.log(`[SnapcastStreamer] Resuming cast for ${activeStream.videoId} at ${startTime}s`);
  const cfg = DEFAULT_CAST_CONFIG;
  const result = await restartPipelineForSeek(startTime || 0, cfg);
  console.log(`[Timing] resume: total ${Date.now() - t0}ms`);
  return result;
}

/**
 * Restart ffmpeg + throttle for the same track at a different position.
 * Reconnects TCP to force Snapcast to flush its buffer, eliminating white noise
 * from old pre-queued audio data.
 */
async function restartPipelineForSeek(
  startTime: number,
  cfg: CastConfig
): Promise<{ success: boolean; message: string; error?: string }> {
  const t0 = Date.now();
  const state = activeStream!;
  console.log(`[SnapcastStreamer] Seek restart at ${startTime}s for ${state.videoId}`);

  // 1. Kill old ffmpeg
  killProcess(state.ffmpegProcess);
  state.ffmpegProcess = null;
  console.log(`[Timing] seek: kill ffmpeg +${Date.now() - t0}ms`);

  // 2. Stop old throttle and close old TCP (forces Snapcast to flush old buffer)
  if (state.throttle && state.tcpSocket) {
    try { state.throttle.unpipe(state.tcpSocket); } catch { /* ignore */ }
  }
  const oldThrottle = state.throttle;
  state.throttle = null;
  if (oldThrottle) oldThrottle.stop();

  // Close + destroy old TCP — Snapcast will drop any old audio still in its buffer
  if (state.tcpSocket && !state.tcpSocket.destroyed) {
    try { state.tcpSocket.end(); state.tcpSocket.destroy(); } catch { /* ignore */ }
  }
  state.tcpSocket = null;
  console.log(`[Timing] seek: teardown old pipeline +${Date.now() - t0}ms`);

  // 3. Connect fresh TCP socket (forces Snapcast to start with clean buffer)
  const tcpSocket = new net.Socket();
  state.tcpSocket = tcpSocket;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('TCP reconnect timeout')), 3000);
    tcpSocket.connect(cfg.snapcastTcpPort, cfg.snapcastHost, () => {
      clearTimeout(timeout);
      resolve();
    });
    tcpSocket.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
  console.log(`[Timing] seek: TCP reconnected +${Date.now() - t0}ms`);

  tcpSocket.on('error', (err: Error) => {
    console.error('[SnapcastStreamer] TCP socket error:', err.message);
    if (activeStream === state) { state.status = 'error'; state.error = `TCP: ${err.message}`; }
  });
  tcpSocket.on('close', () => { console.log('[SnapcastStreamer] TCP socket closed'); });

  // 4. Find ffmpeg (cached)
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    return { success: false, message: 'ffmpeg not found', error: 'ffmpeg executable not found' };
  }

  // 5. Spawn new ffmpeg with seek
  const ffmpegArgs = ['-i', 'pipe:0'];
  if (startTime > 0) {
    ffmpegArgs.push('-ss', String(startTime));
  }
  ffmpegArgs.push(
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    '-ac', String(cfg.channels),
    '-ar', String(cfg.sampleRate),
    '-v', 'warning',
    'pipe:1'
  );

  const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  state.ffmpegProcess = ffmpegProc;
  console.log(`[Timing] seek: spawn ffmpeg +${Date.now() - t0}ms`);

  ffmpegProc.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log('[SnapcastStreamer] ffmpeg:', msg);
  });
  ffmpegProc.stdin!.on('error', (err: Error) => {
    if (!err.message.includes('EOF') && !err.message.includes('EPIPE')) {
      console.error('[SnapcastStreamer] ffmpeg stdin error:', err.message);
    }
  });
  ffmpegProc.on('close', (code: number | null) => {
    console.log(`[SnapcastStreamer] ffmpeg exited with code ${code} (throttle will continue draining)`);
  });
  ffmpegProc.on('error', (err: Error) => {
    console.error('[SnapcastStreamer] ffmpeg error:', err.message);
  });

  // 6. Create new throttle and pipe to fresh TCP socket
  const throttle = new RealtimeThrottle(cfg.sampleRate, cfg.channels);
  state.throttle = throttle;
  ffmpegProc.stdout?.pipe(throttle).pipe(tcpSocket, { end: false });

  const thisThrottle = throttle;
  throttle.on('end', () => {
    if (activeStream && activeStream.throttle === thisThrottle) {
      console.log('[SnapcastStreamer] Throttle drained completely, track finished');
      state.status = 'finished';
      activeStream = null;
      try { tcpSocket.end(); } catch { /* ignore */ }
    }
  });
  throttle.on('error', (err: Error) => {
    console.error('[SnapcastStreamer] Throttle error:', err.message);
  });

  // 7. Feed cached audio to new ffmpeg
  const cachedAudio = await getAudioBuffer(state.videoId);
  console.log(`[Timing] seek: getAudioBuffer +${Date.now() - t0}ms (${cachedAudio ? 'hit' : 'miss'})`);
  if (cachedAudio) {
    console.log(`[SnapcastStreamer] Using cached audio (${cachedAudio.length} bytes)`);
    const readable = Readable.from(cachedAudio);
    readable.on('error', (err: Error) => {
      console.error('[SnapcastStreamer] Cache stream error:', err.message);
    });
    readable.pipe(ffmpegProc.stdin!);
  } else {
    const cookieArgs = await getCookieArgs();
    const ytDlpPath = await getYtDlpPath();
    if (ytDlpPath) {
      console.log('[SnapcastStreamer] No cache for seek, falling back to yt-dlp');
      const ytDlpProc = spawn(ytDlpPath, [
        '-f', '140', '-o', '-', '--quiet', '--no-playlist',
        ...cookieArgs,
        `https://www.youtube.com/watch?v=${state.videoId}`,
      ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      state.ytDlpProcess = ytDlpProc;
      ytDlpProc.stdout?.pipe(ffmpegProc.stdin!);
      ytDlpProc.on('close', () => { try { ffmpegProc.stdin?.end(); } catch { /* */ } });
    }
  }

  state.status = 'streaming';
  console.log(`[Timing] seek: pipeline ready, total ${Date.now() - t0}ms`);
  console.log(`[SnapcastStreamer] Seek pipeline active: cache → ffmpeg (seek ${startTime}s) → PCM → Snapcast (new TCP)`);
  return { success: true, message: `Seeked to ${startTime}s` };
}

/**
 * Try to get cached audio buffer from Redis
 */
async function getCachedAudio(videoId: string): Promise<Buffer | null> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url: redisUrl });
    await client.connect();
    const buf = await client.sendCommand<Buffer | null>(['GET', `audio:${videoId}`], { returnBuffers: true });
    await client.disconnect();
    if (buf && buf.length > 0) {
      console.log(`[SnapcastStreamer] Found cached audio for ${videoId}, size: ${buf.length}`);
      return buf;
    }
    return null;
  } catch (err) {
    console.log(`[SnapcastStreamer] Redis cache check failed:`, err);
    return null;
  }
}

/**
 * Start casting a track to Snapcast
 * Pipeline: Redis cache (or yt-dlp fallback) → ffmpeg → raw PCM → TCP → Snapcast
 */
export async function startCasting(
  videoId: string,
  title?: string,
  config?: Partial<CastConfig>,
  startTime?: number
): Promise<{ success: boolean; message: string; error?: string }> {
  const cfg = { ...DEFAULT_CAST_CONFIG, ...config };

  // If same video is already streaming, restart pipeline with TCP reconnect (seek)
  if (activeStream && activeStream.videoId === videoId) {
    return restartPipelineForSeek(startTime || 0, cfg);
  }

  // Different video or no active stream — full stop + start
  if (activeStream) {
    await stopCasting();
  }

  // Validate dependencies
  const ytDlpPath = await getYtDlpPath();
  if (!ytDlpPath) {
    return { success: false, message: 'yt-dlp not found', error: 'yt-dlp executable not found' };
  }

  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    return { success: false, message: 'ffmpeg not found', error: 'ffmpeg executable not found. Place ffmpeg.exe in the project directory.' };
  }

  const cookieArgs = await getCookieArgs();

  console.log(`[SnapcastStreamer] Starting cast: ${videoId} (${title || 'unknown'}) → ${cfg.snapcastHost}:${cfg.snapcastTcpPort}`);

  // Create the state
  const state: StreamingState = {
    videoId,
    title,
    ytDlpProcess: null,
    ffmpegProcess: null,
    tcpSocket: null,
    throttle: null,
    startedAt: Date.now(),
    status: 'starting',
  };
  activeStream = state;

  try {
    // 1. Connect TCP socket to Snapcast input
    const tcpSocket = new net.Socket();
    state.tcpSocket = tcpSocket;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`TCP connection timeout to ${cfg.snapcastHost}:${cfg.snapcastTcpPort}. Is Snapcast server running with TCP stream source?`));
      }, 5000);

      tcpSocket.connect(cfg.snapcastTcpPort, cfg.snapcastHost, () => {
        clearTimeout(timeout);
        console.log(`[SnapcastStreamer] TCP connected to ${cfg.snapcastHost}:${cfg.snapcastTcpPort}`);
        resolve();
      });

      tcpSocket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // 2. Spawn ffmpeg: reads m4a from stdin, outputs raw PCM to stdout
    // Note: snapserver codec=flac means it encodes TO flac for clients; input must be raw PCM
    const ffmpegArgs = [
      '-i', 'pipe:0',           // Read from stdin
    ];
    
    // Add seek if startTime provided (place after input for pipe compatibility)
    if (startTime && startTime > 0) {
      console.log(`[SnapcastStreamer] Seeking to ${startTime}s`);
      ffmpegArgs.push('-ss', String(startTime));
    }
    
    ffmpegArgs.push(
      '-f', 's16le',            // Output format: raw signed 16-bit little-endian PCM
      '-acodec', 'pcm_s16le',   // PCM codec
      '-ac', String(cfg.channels),
      '-ar', String(cfg.sampleRate),
      '-v', 'warning',          // Only show warnings/errors
      'pipe:1'                  // Output to stdout
    );
    
    const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    state.ffmpegProcess = ffmpegProc;

    ffmpegProc.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log('[SnapcastStreamer] ffmpeg:', msg);
    });

    // Handle pipe errors to prevent uncaught exceptions
    ffmpegProc.stdin!.on('error', (err) => {
      if (err.message.includes('EOF') || err.message.includes('EPIPE')) {
        console.log('[SnapcastStreamer] ffmpeg stdin closed (expected at end of stream)');
      } else {
        console.error('[SnapcastStreamer] ffmpeg stdin error:', err.message);
      }
    });

    tcpSocket.on('error', (err) => {
      console.error('[SnapcastStreamer] TCP socket error:', err.message);
      if (activeStream === state) {
        state.status = 'error';
        state.error = `TCP: ${err.message}`;
      }
    });

    // Pipe ffmpeg output → throttle → TCP socket
    // The throttle ensures PCM data flows at real-time playback rate
    // ffmpeg will exit quickly (processes entire cached buffer in <200ms),
    // but the throttle buffers all PCM data and drains it at real-time rate.
    const throttle = new RealtimeThrottle(cfg.sampleRate, cfg.channels);
    state.throttle = throttle;
    ffmpegProc.stdout?.pipe(throttle).pipe(tcpSocket, { end: false });

    // When the throttle finishes draining all buffered audio, close TCP
    // Track this throttle instance — only close if THIS throttle is still active
    const thisThrottle = throttle;
    throttle.on('end', () => {
      if (activeStream && activeStream.throttle === thisThrottle) {
        console.log('[SnapcastStreamer] Throttle drained completely, track finished');
        state.status = 'finished';
        activeStream = null;
        try { tcpSocket.end(); } catch { /* ignore */ }
      }
    });

    throttle.on('error', (err) => {
      console.error('[SnapcastStreamer] Throttle error:', err.message);
    });

    // 3. Feed audio to ffmpeg — in-memory cache first, then Redis, then yt-dlp
    const cachedAudio = await getAudioBuffer(videoId);

    if (cachedAudio) {
      // Stream cached audio buffer into ffmpeg stdin
      console.log(`[SnapcastStreamer] Using cached audio (${cachedAudio.length} bytes)`);
      const readable = Readable.from(cachedAudio);
      readable.on('error', (err) => {
        console.error('[SnapcastStreamer] Cache stream error:', err.message);
      });
      readable.pipe(ffmpegProc.stdin!);
    } else {
      // Fall back to yt-dlp download
      console.log('[SnapcastStreamer] No cache, falling back to yt-dlp');
      const ytDlpArgs = [
        '-f', '140',
        '-o', '-',
        '--quiet',
        '--no-playlist',
        ...cookieArgs,
        `https://www.youtube.com/watch?v=${videoId}`,
      ];

      const ytDlpProc = spawn(ytDlpPath, ytDlpArgs, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      state.ytDlpProcess = ytDlpProc;

      ytDlpProc.stderr?.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.error('[SnapcastStreamer] yt-dlp:', msg);
      });

      ytDlpProc.stdout?.pipe(ffmpegProc.stdin!);

      ytDlpProc.on('close', (code) => {
        console.log(`[SnapcastStreamer] yt-dlp exited with code ${code}`);
        if (code !== 0 && activeStream === state) {
          state.status = 'error';
          state.error = `yt-dlp exited with code ${code}`;
        }
        try { ffmpegProc.stdin?.end(); } catch { /* ignore */ }
      });

      ytDlpProc.on('error', (err) => {
        console.error('[SnapcastStreamer] yt-dlp error:', err.message);
      });
    }

    state.status = 'streaming';
    console.log(`[SnapcastStreamer] Pipeline active: ${cachedAudio ? 'cache' : 'yt-dlp'} → ffmpeg → PCM → Snapcast`);

    ffmpegProc.on('close', (code) => {
      console.log(`[SnapcastStreamer] ffmpeg exited with code ${code} (throttle will continue draining)`);
      // Do NOT close the TCP socket here — the throttle still has buffered PCM
      // data to drain at real-time rate. The throttle 'end' event handles cleanup.
    });

    ffmpegProc.on('error', (err) => {
      console.error('[SnapcastStreamer] ffmpeg error:', err.message);
    });

    tcpSocket.on('close', () => {
      console.log('[SnapcastStreamer] TCP socket closed');
    });

    castEnabled = true;
    return { success: true, message: `Casting "${title || videoId}" to Snapcast` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[SnapcastStreamer] Failed to start cast:', errorMsg);

    // Cleanup on failure
    state.status = 'error';
    state.error = errorMsg;
    killProcess(state.ytDlpProcess);
    killProcess(state.ffmpegProcess);
    if (state.tcpSocket) {
      try { state.tcpSocket.end(); state.tcpSocket.destroy(); } catch { /* ignore */ }
    }
    activeStream = null;

    return { success: false, message: 'Failed to start casting', error: errorMsg };
  }
}

/**
 * Get the current casting status
 */
export function getCastingStatus(): {
  active: boolean;
  enabled: boolean;
  videoId?: string;
  title?: string;
  status?: string;
  error?: string;
  duration?: number;
} {
  if (!activeStream) {
    return { active: false, enabled: castEnabled };
  }

  return {
    active: true,
    enabled: castEnabled,
    videoId: activeStream.videoId,
    title: activeStream.title,
    status: activeStream.status,
    error: activeStream.error,
    duration: Date.now() - activeStream.startedAt,
  };
}

/**
 * Enable/disable automatic casting
 */
export function setCastEnabled(enabled: boolean): void {
  castEnabled = enabled;
  if (!enabled && activeStream) {
    stopCasting();
  }
}

/**
 * Check if casting is enabled
 */
export function isCastEnabled(): boolean {
  return castEnabled;
}
