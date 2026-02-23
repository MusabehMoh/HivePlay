/**
 * Health monitoring initialization
 * This API route is called once on server startup to begin health checks
 */

import { startHealthMonitoring } from '../../../services/alternative/yt-dlp-health';
import { startPotServer } from '../../../services/alternative/pot-server';
import { startupUpdateCheck } from '../../../services/alternative/yt-dlp-updater';

function printBanner() {
  console.log('');
  console.log('  ██╗  ██╗██╗██╗   ██╗███████╗██████╗ ██╗      █████╗ ██╗   ██╗');
  console.log('  ██║  ██║██║██║   ██║██╔════╝██╔══██╗██║     ██╔══██╗╚██╗ ██╔╝');
  console.log('  ███████║██║██║   ██║█████╗  ██████╔╝██║     ███████║ ╚████╔╝ ');
  console.log('  ██╔══██║██║╚██╗ ██╔╝██╔══╝  ██╔═══╝ ██║     ██╔══██║  ╚██╔╝  ');
  console.log('  ██║  ██║██║ ╚████╔╝ ███████╗██║     ███████╗██║  ██║   ██║   ');
  console.log('  ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝   ');
  console.log('');
  console.log('  YouTube Music Streaming  •  Multi-room Snapcast  •  yt-dlp Powered');
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log('');
}

let monitoringStarted = false;

// Start monitoring when this module is loaded (server startup)
if (!monitoringStarted && process.env.NODE_ENV !== 'test') {
  monitoringStarted = true;

  printBanner();
  console.log('[HivePlay] Initializing...');

  // Start PO token server, health monitoring, and yt-dlp update check
  setTimeout(async () => {
    await startPotServer();
    startHealthMonitoring();

    // Run startup yt-dlp update check in the background (non-blocking)
    startupUpdateCheck().catch((err) =>
      console.error('[yt-dlp] Startup update check error:', err)
    );
  }, 3000);
}

export async function GET() {
  return Response.json({
    status: 'Health monitoring active',
    started: monitoringStarted
  });
}
