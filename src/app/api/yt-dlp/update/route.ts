import { NextRequest, NextResponse } from 'next/server';
import { autoUpdateYtDlp, checkForUpdates } from '../../../services/alternative/yt-dlp-updater';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'update') {
      console.log('[yt-dlp Update API] Manual update requested');
      
      // Check if running in Docker
      const isDocker = process.env.NODE_ENV === 'production' && process.env.REDIS_URL?.includes('redis:');
      
      let result;
      
      if (isDocker) {
        // In Docker, use the update script
        console.log('[yt-dlp Update API] Detected Docker environment, using update script');
        try {
          const { stdout, stderr } = await execPromise('./docker-update-ytdlp.sh');
          result = {
            success: true,
            message: `Docker update completed: ${stdout}`,
            stderr: stderr || undefined
          };
        } catch (error: any) {
          result = {
            success: false,
            message: `Docker update failed: ${error.message}`,
            stderr: error.stderr || undefined
          };
        }
      } else {
        // Regular environment, use the updater service
        console.log('[yt-dlp Update API] Using regular update service');
        result = await autoUpdateYtDlp();
      }
      
      return NextResponse.json(result);
    } else if (action === 'check') {
      console.log('[yt-dlp Update API] Update check requested');
      const updateInfo = await checkForUpdates();
      return NextResponse.json(updateInfo);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "update" or "check".' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[yt-dlp Update API] Error:', error);
    return NextResponse.json(
      { error: `Update failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Simple health check and version info
    const updateInfo = await checkForUpdates();
    return NextResponse.json({
      message: 'yt-dlp update service is running',
      ...updateInfo
    });
  } catch (error) {
    console.error('[yt-dlp Update API] Health check error:', error);
    return NextResponse.json(
      { error: `Health check failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
