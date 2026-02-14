import { NextRequest, NextResponse } from 'next/server';
import {
  getSnapcastStatus,
  setZoneVolume,
  setZoneName,
  setGroupStream,
  setGroupMute,
} from '../../../services/snapcast/snapcast-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stream/snapcast — Get Snapcast server status and zones
 */
export async function GET() {
  try {
    const status = await getSnapcastStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { connected: false, zones: [], streams: [], error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stream/snapcast — Control Snapcast zones
 * 
 * Actions:
 * - { action: "setVolume", clientId, volume, muted? }
 * - { action: "setName", clientId, name }
 * - { action: "setStream", groupId, streamId }
 * - { action: "setMute", groupId, muted }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'setVolume': {
        const { clientId, volume, muted } = body;
        if (!clientId || volume === undefined) {
          return NextResponse.json({ error: 'clientId and volume required' }, { status: 400 });
        }
        const success = await setZoneVolume(clientId, volume, muted);
        return NextResponse.json({ success });
      }

      case 'setName': {
        const { clientId, name } = body;
        if (!clientId || !name) {
          return NextResponse.json({ error: 'clientId and name required' }, { status: 400 });
        }
        const success = await setZoneName(clientId, name);
        return NextResponse.json({ success });
      }

      case 'setStream': {
        const { groupId, streamId } = body;
        if (!groupId || !streamId) {
          return NextResponse.json({ error: 'groupId and streamId required' }, { status: 400 });
        }
        const success = await setGroupStream(groupId, streamId);
        return NextResponse.json({ success });
      }

      case 'setMute': {
        const { groupId, muted } = body;
        if (!groupId || muted === undefined) {
          return NextResponse.json({ error: 'groupId and muted required' }, { status: 400 });
        }
        const success = await setGroupMute(groupId, muted);
        return NextResponse.json({ success });
      }

      case 'status': {
        const status = await getSnapcastStatus();
        return NextResponse.json(status);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Snapcast API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
