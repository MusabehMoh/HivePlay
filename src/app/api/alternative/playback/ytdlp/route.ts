import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  if (!videoId) {
    return NextResponse.json({ error: 'videoId parameter is required' }, { status: 400 });
  }

  try {
    // Use yt-dlp to get the best audio URL (or best video+audio)
    const ytdlpArgs = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '-f', 'bestaudio/best',
      '-g' // Get the direct media URL only
    ];
    const { stdout, stderr } = await execFileAsync('yt-dlp', ytdlpArgs, { timeout: 30000 });
    const url = stdout.trim().split('\n')[0];
    if (!url) {
      return NextResponse.json({ error: 'No stream URL found from yt-dlp', stderr }, { status: 500 });
    }
    return NextResponse.json({ url });
  } catch (error: any) {
    // Provide more detailed error info
    let message = error instanceof Error ? error.message : 'yt-dlp error';
    if (error.code === 'ENOENT') {
      message = 'yt-dlp is not installed or not in PATH';
    }
    return NextResponse.json({ error: message, stderr: error.stderr || '' }, { status: 500 });
  }
}
