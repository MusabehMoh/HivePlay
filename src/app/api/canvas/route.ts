import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import fs from "fs";

const execAsync = promisify(exec);

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

  // Primary attempt: partial download first 8s directly (requires ffmpeg and is fastest)
  try {
    // Prefer mp4 container as suggested by yt-dlp warning using -t mp4
    const cmd = `${ytdlpCmd} -t mp4 --download-sections "*00:00-00:08" -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`;
    const { stderr } = await execAsync(cmd);
    if (stderr) console.warn("[Canvas API] yt-dlp (partial) warnings:", stderr);
  } catch (err) {
    console.warn(
      "[Canvas API] Partial download failed, attempting fallback trim...",
      err
    );

    // Fallback: download small mp4, then trim to 8s with ffmpeg
    const tempInput = `${tempDir}/${videoId}-canvas-src.mp4`;
    try {
      const dlCmd = `${ytdlpCmd} -f "b[ext=mp4]/best" -o "${tempInput}" https://www.youtube.com/watch?v=${videoId}`;
      const { stderr: dlStderr } = await execAsync(dlCmd);
      if (dlStderr)
        console.warn("[Canvas API] yt-dlp (full) warnings:", dlStderr);

      const trimCmd = `${ffmpegCmd} -y -loglevel error -i "${tempInput}" -t 8 -c copy "${outputPath}"`;
      await execAsync(trimCmd);
    } catch (fallbackErr) {
      console.error("[Canvas API] Fallback trim failed:", fallbackErr);
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
