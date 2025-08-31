import { NextResponse } from 'next/server';
import { checkYtDlp, checkFfmpeg, getYtDlpPath } from '@/app/services/alternative/ytdlp-locator';

export async function GET() {
  try {
    // Check yt-dlp availability and version
    const ytdlpStatus = await checkYtDlp();
    
    // Check FFmpeg availability
    const ffmpegAvailable = await checkFfmpeg();
    
    // Get the actual path where yt-dlp was found
    const ytdlpPath = await getYtDlpPath();

    return NextResponse.json({
      available: ytdlpStatus.available,
      version: ytdlpStatus.version,
      path: ytdlpPath,
      ffmpegAvailable,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking tools status:', error);
    return NextResponse.json(
      { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}