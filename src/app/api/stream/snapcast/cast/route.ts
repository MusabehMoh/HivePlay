import { NextRequest, NextResponse } from 'next/server';
import { startCasting, stopCasting, pauseCasting, resumeCasting, getCastingStatus, setCastEnabled, isCastEnabled } from '../../../../services/snapcast/snapcast-streamer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stream/snapcast/cast
 * Returns current casting status
 */
export async function GET() {
  const status = getCastingStatus();
  return NextResponse.json(status);
}

/**
 * POST /api/stream/snapcast/cast
 * Control casting: start, stop, enable, disable
 * 
 * Body:
 *   { action: "start", videoId: string, title?: string, startTime?: number }
 *   { action: "stop" }
 *   { action: "enable" }
 *   { action: "disable" }
 *   { action: "status" }
 */
export async function POST(req: NextRequest) {
  try {
    const t0 = Date.now();
    const body = await req.json();
    const { action } = body;
    console.log(`[CastAPI] ${action} request received`);

    let result;
    switch (action) {
      case 'start': {
        const { videoId, title, startTime } = body;
        if (!videoId) {
          return NextResponse.json({ success: false, error: 'Missing videoId' }, { status: 400 });
        }
        result = await startCasting(videoId, title, undefined, startTime);
        break;
      }

      case 'stop': {
        result = await stopCasting();
        break;
      }

      case 'pause': {
        result = await pauseCasting();
        break;
      }

      case 'resume': {
        const { startTime: resumeTime } = body;
        result = await resumeCasting(resumeTime);
        break;
      }

      case 'enable': {
        setCastEnabled(true);
        result = { success: true, enabled: true };
        break;
      }

      case 'disable': {
        setCastEnabled(false);
        result = { success: true, enabled: false };
        break;
      }

      case 'status': {
        result = getCastingStatus();
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    console.log(`[CastAPI] ${action} completed in ${Date.now() - t0}ms`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[CastAPI] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
