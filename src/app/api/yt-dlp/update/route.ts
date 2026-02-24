import { NextRequest, NextResponse } from 'next/server';
import { autoUpdateYtDlp, checkForUpdates, smartAutoUpdate } from '../../../services/alternative/yt-dlp-updater';
import { checkYtDlp } from '../../../services/alternative/ytdlp-locator';

export async function POST(request: NextRequest) {
  try {
    const { action, force } = await request.json();
    
    if (action === 'update') {
      console.log('[yt-dlp Update API] Manual update requested', force ? '(forced)' : '');
      
      // autoUpdateYtDlp / smartAutoUpdate both detect Docker internally and use pip
      let result;
      if (force) {
        result = await autoUpdateYtDlp();
      } else {
        result = await smartAutoUpdate();
      }
      (result as any).environment = process.env.DOCKER === '1' ? 'docker' : 'native';
      
      return NextResponse.json(result);
      
    } else if (action === 'check') {
      console.log('[yt-dlp Update API] Update check requested');
      const updateInfo = await checkForUpdates();
      const ytdlpStatus = await checkYtDlp();
      
      return NextResponse.json({
        ...updateInfo,
        available: ytdlpStatus.available,
        executable: ytdlpStatus.version ? true : false,
        environment: process.env.NODE_ENV === 'production' && process.env.REDIS_URL?.includes('redis:') ? 'docker' : 'native'
      });
      
    } else if (action === 'status') {
      console.log('[yt-dlp Update API] Status check requested');
      const ytdlpStatus = await checkYtDlp();
      const updateInfo = await checkForUpdates();
      
      return NextResponse.json({
        status: 'ok',
        ytdlp: {
          available: ytdlpStatus.available,
          version: ytdlpStatus.version || 'unknown',
          executable: ytdlpStatus.version ? true : false
        },
        update: {
          hasUpdate: updateInfo.hasUpdate,
          currentVersion: updateInfo.currentVersion,
          latestVersion: updateInfo.latestVersion,
          daysBehind: updateInfo.daysBehind
        },
        environment: process.env.NODE_ENV === 'production' && process.env.REDIS_URL?.includes('redis:') ? 'docker' : 'native',
        timestamp: new Date().toISOString()
      });
      
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "update", "check", or "status".' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[yt-dlp Update API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
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
