import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";

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

  // Determine yt-dlp command for Windows/Unix
  const isWin = process.platform === "win32";
  const ytdlpCmd = isWin ? "yt-dlp.exe" : "yt-dlp";

  // If not already cached, extract the first 8 seconds as mp4
  if (!fs.existsSync(outputPath)) {
    try {
      // Download first 8 seconds as mp4 (lowest res for speed)
      await execAsync(
        `${ytdlpCmd} -f mp4 --download-sections "*00:00-00:08" -o "${outputPath}" https://www.youtube.com/watch?v=${videoId}`
      );
    } catch (err) {
      console.error("[Canvas API] yt-dlp extraction failed:", err);
      return new Response("Failed to extract canvas", { status: 500 });
    }
  }

  // Serve the file
  try {
    const file = fs.readFileSync(outputPath);
    return new Response(file, {
      headers: { "Content-Type": "video/mp4" },
    });
  } catch (err) {
    console.error("[Canvas API] Failed to read canvas file:", err);
    return new Response("Failed to read canvas", { status: 500 });
  }
}
