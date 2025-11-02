import { NextRequest } from "next/server";
import { spawn } from "child_process";
import os from "os";
import fs from "fs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url!);
  const videoId = searchParams.get("videoId");
  if (!videoId) {
    return new Response("Missing videoId", { status: 400 });
  }

  // Use cross-platform temp directory
  const tempDir = os.tmpdir();
  const outputPath = `${tempDir}/${videoId}-canvas.mp4`;

  // If already cached, serve immediately
  if (fs.existsSync(outputPath)) {
    try {
      const file = fs.readFileSync(outputPath);
      return new Response(file, {
        headers: {
          "Content-Type": "video/mp4",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    } catch (err) {
      console.error("[Canvas API] Failed reading cached canvas file:", err);
      // fallthrough to regenerate
    }
  }

  const isWin = process.platform === "win32";
  const ytdlpCmd = isWin ? "yt-dlp.exe" : "yt-dlp";
  const ffmpegCmd = isWin ? "ffmpeg.exe" : "ffmpeg";

  // Primary attempt: partial download first 8s directly
  try {
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-f', 'bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best',
        '--download-sections', '*00:00-00:08',
        '--no-warnings',
        '--extractor-retries', '3',
        '--retries', '3',
        '--fragment-retries', '3',
        '-o', outputPath,
        `https://www.youtube.com/watch?v=${videoId}`
      ];

      const ytdlp = spawn(ytdlpCmd, args, {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          NO_COLOR: '1',
        },
        shell: true, // CRITICAL: Enables multi-client fallback
        windowsHide: true,
        cwd: tempDir
      });

      let stderr = '';
      ytdlp.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          console.log(`[Canvas API] ✓ Canvas generated for ${videoId}`);
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        }
      });

      ytdlp.on('error', reject);
    });
  } catch (err) {
    console.warn("[Canvas API] Partial download failed, attempting fallback...");

    // Fallback: download full video then trim with ffmpeg
    const tempInput = `${tempDir}/${videoId}-canvas-src.mp4`;
    try {
      // Download full video
      await new Promise<void>((resolve, reject) => {
        const args = [
          '-f', 'bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best',
          '--no-warnings',
          '--extractor-retries', '3',
          '--retries', '3',
          '--fragment-retries', '3',
          '-o', tempInput,
          `https://www.youtube.com/watch?v=${videoId}`
        ];

        const ytdlp = spawn(ytdlpCmd, args, {
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            NO_COLOR: '1',
          },
          shell: true,
          windowsHide: true,
          cwd: tempDir
        });

        let stderr = '';
        ytdlp.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        ytdlp.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`yt-dlp failed: ${stderr}`));
          }
        });

        ytdlp.on('error', reject);
      });

      // Trim to 8 seconds with ffmpeg
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(ffmpegCmd, [
          '-y',
          '-loglevel', 'error',
          '-i', tempInput,
          '-t', '8',
          '-c', 'copy',
          outputPath
        ], {
          shell: true,
          windowsHide: true
        });

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log("[Canvas API] ✓ Fallback trim successful");
            resolve();
          } else {
            reject(new Error(`ffmpeg failed with code ${code}`));
          }
        });

        ffmpeg.on('error', reject);
      });
    } catch (fallbackErr) {
      console.error("[Canvas API] ✗ Fallback failed:", (fallbackErr as Error).message);
      return new Response("Failed to extract canvas", { status: 500 });
    } finally {
      try {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
      } catch {}
    }
  }

  // Serve the generated file
  try {
    const file = fs.readFileSync(outputPath);
    return new Response(file, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error(
      "[Canvas API] Failed to read canvas file after generation:",
      err
    );
    return new Response("Failed to read canvas", { status: 500 });
  }
}
