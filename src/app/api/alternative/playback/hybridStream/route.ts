import { NextRequest } from 'next/server';
import ytdl from 'ytdl-core';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { createClient } from 'redis';
import { getYtDlpPath, getCookieArgs } from '../../../../services/alternative/ytdlp-locator';
import { autoUpdateWithCooldown, shouldAutoUpdate } from '../../../../services/alternative/yt-dlp-updater';

const unlinkAsync = promisify(fs.unlink);

export const dynamic = 'force-dynamic';

// One week in seconds - increased from 1 hour  
const DEFAULT_AUDIO_CACHE_TTL = 604800; 

async function getAudioBufferFromRedis(videoId: string): Promise<Buffer | null> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = createClient({ url: redisUrl });
  await client.connect();
  const isConnected = client.isOpen;
  console.log('[HybridStream] Redis connected:', isConnected);
  // Use sendCommand for GET to ensure binary retrieval
  const buf = await client.sendCommand<Buffer | null>(['GET', `audio:${videoId}`], { returnBuffers: true });
  await client.disconnect();
  return buf;
}

async function setAudioBufferInRedis(videoId: string, buffer: Buffer, ttl = DEFAULT_AUDIO_CACHE_TTL) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = createClient({ url: redisUrl });
  await client.connect();
  const isConnected = client.isOpen;
  console.log('[HybridStream] Redis connected:', isConnected);
  console.log('[HybridStream] Buffer type BEFORE set:', buffer && buffer.constructor && buffer.constructor.name);
  console.log(`[HybridStream] Caching audio for ${videoId} with TTL of ${ttl} seconds`);
  // Use sendCommand for SET to ensure binary storage
  await client.sendCommand(['SET', `audio:${videoId}`, buffer, 'EX', ttl.toString()]);
  await client.disconnect();
}

async function streamWithYtdlCore(videoId: string): Promise<Response> {
  console.log('[HybridStream] Attempting stream with ytdl-core...');
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  if (!(await ytdl.validateID(videoId))) {
    throw new Error('Invalid videoId for ytdl-core');
  }
  const info = await ytdl.getInfo(url);
  const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
  if (!format) {
    throw new Error('No audio format found by ytdl-core');
  }
  const audioStream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
  console.log('[HybridStream] ytdl-core succeeded. Streaming...');
  return new Response(audioStream as any, {
    headers: {
      'Content-Type': 'audio/m4a',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function streamWithYtDlp(videoId: string): Promise<Response> {
  console.log('[HybridStream] Falling back to yt-dlp...');
  
  // Get the yt-dlp executable path
  const ytDlpPath = await getYtDlpPath();
  if (!ytDlpPath) {
    console.error('[HybridStream] yt-dlp executable not found');
    return new Response('yt-dlp not found', { status: 500 });
  }
  
  console.log('[HybridStream] Using yt-dlp at:', ytDlpPath);
  
  const cookieArgs = await getCookieArgs();
  
  let closed = false;
  const ytDlp = spawn(ytDlpPath, [
    '-f', '140', // m4a audio
    '-o', '-', // output to stdout
    '--quiet',
    '--no-playlist',
    ...cookieArgs,
    `https://www.youtube.com/watch?v=${videoId}`
  ]);
  console.log('[yt-dlp] Spawned yt-dlp process for videoId:', videoId);

  const stream = new ReadableStream({
    start(controller) {
      ytDlp.stdout.on('data', (chunk) => {
        if (!closed) controller.enqueue(chunk);
      });
      ytDlp.stderr.on('data', (data) => console.error('[yt-dlp] stderr:', data.toString()));
      ytDlp.on('close', (code) => {
        if (closed) return;
        closed = true;
        console.log('[yt-dlp] Process exited with code:', code);
        if (code !== 0) {
          controller.error(new Error(`yt-dlp exited with code ${code}`));
        } else {
          controller.close();
        }
      });
    },
    cancel() {
      if (!closed) {
        closed = true;
        ytDlp.kill();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'audio/m4a',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function streamWithYtDlpRange(videoId: string, range: string | null): Promise<Response> {
  // Try Redis cache first
  let audioBuffer = await getAudioBufferFromRedis(videoId);
  console.log('[HybridStream] Redis buffer type:', audioBuffer && audioBuffer.constructor && audioBuffer.constructor.name, 'length:', audioBuffer && audioBuffer.length);
  // Accept Buffer, Uint8Array, or anything with .length
  const isBufferLike = audioBuffer && typeof audioBuffer === 'object' && typeof audioBuffer.length === 'number' && audioBuffer.length >= 1024;
  if (isBufferLike) {
    if (!(audioBuffer instanceof Buffer) && audioBuffer !== null) {
      audioBuffer = Buffer.from(audioBuffer as Uint8Array);
    }
    console.log(`[HybridStream] Serving audio for ${videoId} from Redis cache, size: ${audioBuffer && audioBuffer.length}`);
  } else {
    console.log(`[HybridStream] Cache miss or invalid for ${videoId}, downloading...`);
    // Clear possibly corrupted cache
    await setAudioBufferInRedis(videoId, Buffer.alloc(0), 1); // expire immediately
    // Download audio to buffer
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `yt-hybrid-${videoId}-${Date.now()}.m4a`);
    
    // Get the yt-dlp executable path
    const ytDlpPath = await getYtDlpPath();
    if (!ytDlpPath) {
      console.error('[HybridStream] yt-dlp executable not found');
      return new Response('yt-dlp not found', { status: 500 });
    }
    
    const cookieArgs = await getCookieArgs();
    
    await new Promise<void>((resolve, reject) => {
      // Optimized yt-dlp arguments for reliability
      const args = [
        '-f', '140',                    // Format 140 (m4a audio)
        '-o', tempFile,                 // Output file
        '--no-playlist',                // Don't download playlists
        '--no-warnings',                // Suppress warnings
        ...cookieArgs,                  // Browser cookies if available
        '--extractor-retries', '3',     // Retry extraction failures
        '--retries', '3',               // Retry failed downloads
        '--fragment-retries', '3',      // Retry failed fragments
        `https://www.youtube.com/watch?v=${videoId}`
      ];
      
      const ytDlp = spawn(ytDlpPath, args, {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',        // Unbuffered output for real-time logs
          NO_COLOR: '1',                // Disable ANSI colors
        },
        shell: true,                    // Use shell for proper env and multiple client fallback
        windowsHide: true,              // Hide console window on Windows
        cwd: os.tmpdir()                // Run in temp directory
      });

      let stderr = '';
      
      ytDlp.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      ytDlp.on('close', async (code) => {
        if (code === 0) {
          console.log(`[HybridStream] ✓ Download successful for ${videoId}`);
          resolve();
        } else {
          const errorMessage = `yt-dlp exited with code ${code}${stderr ? ': ' + stderr : ''}`;
          console.error(`[HybridStream] ✗ Download failed for ${videoId}: ${errorMessage}`);
          
          // Check if we should attempt auto-update (only for extraction errors, not IP blocks)
          if (shouldAutoUpdate(stderr || errorMessage, code)) {
            console.log('[HybridStream] ⚠ Extraction error detected, attempting auto-update...');
            
            try {
              const updateResult = await autoUpdateWithCooldown(videoId);
              
              if (updateResult.success) {
                console.log(`[HybridStream] ✓ Auto-update completed: ${updateResult.message}`);
                
                // Wait for update to fully apply
                await new Promise(r => setTimeout(r, 1500));
                
                // Retry with same configuration
                console.log('[HybridStream] Retrying download...');
                const retryYtDlp = spawn(ytDlpPath, args, {
                  env: {
                    ...process.env,
                    PYTHONUNBUFFERED: '1',
                    NO_COLOR: '1',
                  },
                  shell: true,
                  windowsHide: true,
                  cwd: os.tmpdir()
                });

                let retryStderr = '';
                retryYtDlp.stderr?.on('data', (data) => {
                  retryStderr += data.toString();
                });

                retryYtDlp.on('close', (retryCode) => {
                  if (retryCode === 0) {
                    console.log('[HybridStream] ✓ Retry successful after update');
                    resolve();
                  } else {
                    console.error(`[HybridStream] ✗ Retry still failed (code ${retryCode})`);
                    reject(new Error(`yt-dlp failed after update: ${retryStderr || stderr}`));
                  }
                });

                retryYtDlp.on('error', reject);
                return; // Exit to avoid double rejection
              }
            } catch (updateError) {
              console.error('[HybridStream] Auto-update failed:', updateError);
            }
          }
          
          reject(new Error(errorMessage));
        }
      });
      ytDlp.on('error', reject);
    });
    audioBuffer = await fs.promises.readFile(tempFile);
    // Use the DEFAULT_AUDIO_CACHE_TTL constant here instead of hardcoded 3600
    await setAudioBufferInRedis(videoId, audioBuffer, DEFAULT_AUDIO_CACHE_TTL);
    await unlinkAsync(tempFile).catch(() => {});
    console.log(`[HybridStream] Downloaded and cached audio for ${videoId}, size: ${audioBuffer.length}, TTL: ${DEFAULT_AUDIO_CACHE_TTL} seconds`);
  }
  const total = audioBuffer.length;
  let start = 0, end = total - 1;
  let status = 200;
  let headers: Record<string, string | number> = {
    'Content-Type': 'audio/m4a',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      start = parseInt(match[1], 10);
      if (match[2]) end = parseInt(match[2], 10);
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
      headers['Content-Length'] = end - start + 1;
    }
  } else {
    headers['Content-Length'] = total;
  }
  const sliced = audioBuffer.subarray(start, end + 1);
  return new Response(sliced, {
    status,
    headers,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');
  if (!videoId) {
    return new Response('Missing videoId', { status: 400 });
  }

  // Always use the range-capable path (has Redis caching + retry logic)
  const range = req.headers.get('range');
  try {
    return await streamWithYtDlpRange(videoId, range);
  } catch (rangeError: any) {
    console.error('[HybridStream] streamWithYtDlpRange failed:', rangeError.message);
    // Last resort: try ytdl-core 
    try {
      return await streamWithYtdlCore(videoId);
    } catch (ytdlError: any) {
      console.error('[HybridStream] All methods failed:', ytdlError.message);
      return new Response(`Streaming failed: ${rangeError.message || 'Unknown error'}`, { status: 500 });
    }
  }
}
