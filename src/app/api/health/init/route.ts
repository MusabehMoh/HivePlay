/**
 * Health monitoring initialization
 * This API route is called once on server startup to begin health checks
 */

import { startHealthMonitoring } from '../../../services/alternative/yt-dlp-health';

let monitoringStarted = false;

// Start monitoring when this module is loaded (server startup)
if (!monitoringStarted && process.env.NODE_ENV !== 'test') {
  monitoringStarted = true;
  console.log('[yt-dlp Health] Initializing health monitoring system...');
  
  // Start after a short delay to let the server fully initialize
  setTimeout(() => {
    startHealthMonitoring();
  }, 5000);
}

export async function GET() {
  return Response.json({
    status: 'Health monitoring active',
    started: monitoringStarted
  });
}
