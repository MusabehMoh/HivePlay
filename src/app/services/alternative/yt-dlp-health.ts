/**
 * yt-dlp Health Check & Auto-Maintenance System
 * Ensures yt-dlp stays functional by testing and auto-updating
 */

import { checkYtDlp } from './ytdlp-locator';
import { autoUpdateYtDlp, checkForUpdates } from './yt-dlp-updater';
import { updateToNightly } from './yt-dlp-nightly';

const HEALTH_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const TEST_VIDEO_ID = 'jNQXAC9IVRw'; // Short public domain test video (Me at the zoo)

let healthCheckRunning = false;
let lastHealthCheck: Date | null = null;
let consecutiveFailures = 0;

interface HealthStatus {
  isHealthy: boolean;
  lastCheck: Date | null;
  version: string | null;
  lastError: string | null;
  consecutiveFailures: number;
}

/**
 * Test if yt-dlp can extract video info (lightweight test)
 */
async function testYtDlpExtraction(): Promise<boolean> {
  try {
    const { spawn } = await import('child_process');
    const { getYtDlpPath } = await import('./ytdlp-locator');
    
    const ytDlpPath = await getYtDlpPath();
    if (!ytDlpPath) return false;

    return new Promise((resolve) => {
      const ytdlp = spawn(ytDlpPath, [
        '--get-title',
        '--no-warnings',
        `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`
      ], {
        shell: true,
        timeout: 15000 // 15 second timeout
      });

      let output = '';
      ytdlp.stdout?.on('data', (data) => {
        output += data.toString();
      });

      ytdlp.on('close', (code) => {
        resolve(code === 0 && output.trim().length > 0);
      });

      ytdlp.on('error', () => {
        resolve(false);
      });

      // Timeout fallback
      setTimeout(() => {
        ytdlp.kill();
        resolve(false);
      }, 15000);
    });
  } catch (error) {
    console.error('[Health Check] Test failed:', error);
    return false;
  }
}

/**
 * Attempt to fix yt-dlp issues
 */
async function attemptFix(): Promise<boolean> {
  console.log('[Health Check] Attempting to fix yt-dlp...');
  
  // Step 1: Try normal update
  try {
    const updateResult = await autoUpdateYtDlp();
    if (updateResult.success) {
      console.log('[Health Check] ✓ Fixed via normal update');
      
      // Test again
      const testResult = await testYtDlpExtraction();
      if (testResult) return true;
    }
  } catch (error) {
    console.error('[Health Check] Normal update failed:', error);
  }

  // Step 2: Try nightly build (more aggressive)
  if (consecutiveFailures >= 2) {
    console.log('[Health Check] Trying nightly build...');
    try {
      const nightlyResult = await updateToNightly();
      if (nightlyResult.success) {
        console.log('[Health Check] ✓ Fixed via nightly build');
        
        // Test again
        const testResult = await testYtDlpExtraction();
        if (testResult) return true;
      }
    } catch (error) {
      console.error('[Health Check] Nightly update failed:', error);
    }
  }

  return false;
}

/**
 * Run health check
 */
async function runHealthCheck(): Promise<HealthStatus> {
  if (healthCheckRunning) {
    return {
      isHealthy: false,
      lastCheck: lastHealthCheck,
      version: null,
      lastError: 'Health check already running',
      consecutiveFailures
    };
  }

  healthCheckRunning = true;
  lastHealthCheck = new Date();

  try {
    // Check if yt-dlp is installed
    const ytdlpStatus = await checkYtDlp();
    if (!ytdlpStatus.available) {
      console.error('[Health Check] yt-dlp not found');
      consecutiveFailures++;
      return {
        isHealthy: false,
        lastCheck: lastHealthCheck,
        version: null,
        lastError: 'yt-dlp not installed',
        consecutiveFailures
      };
    }

    // Test extraction
    const canExtract = await testYtDlpExtraction();
    
    if (canExtract) {
      console.log('[Health Check] ✓ yt-dlp is healthy');
      consecutiveFailures = 0; // Reset on success
      return {
        isHealthy: true,
        lastCheck: lastHealthCheck,
        version: ytdlpStatus.version || null,
        lastError: null,
        consecutiveFailures: 0
      };
    }

    // Failed - attempt fix
    console.warn('[Health Check] ✗ yt-dlp extraction failed, attempting fix...');
    consecutiveFailures++;
    
    const fixed = await attemptFix();
    
    return {
      isHealthy: fixed,
      lastCheck: lastHealthCheck,
      version: ytdlpStatus.version || null,
      lastError: fixed ? null : 'Extraction failed, fix unsuccessful',
      consecutiveFailures: fixed ? 0 : consecutiveFailures
    };

  } catch (error) {
    console.error('[Health Check] Error:', error);
    consecutiveFailures++;
    return {
      isHealthy: false,
      lastCheck: lastHealthCheck,
      version: null,
      lastError: (error as Error).message,
      consecutiveFailures
    };
  } finally {
    healthCheckRunning = false;
  }
}

/**
 * Start periodic health checks
 */
export function startHealthMonitoring() {
  console.log('[Health Check] Starting health monitoring...');
  
  // Run initial check after 30 seconds
  setTimeout(() => {
    runHealthCheck();
  }, 30000);

  // Run periodic checks
  setInterval(() => {
    runHealthCheck();
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Get current health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  if (lastHealthCheck === null) {
    // No check yet, run one now
    return await runHealthCheck();
  }

  // Return cached status if recent (< 5 minutes old)
  const age = Date.now() - lastHealthCheck.getTime();
  if (age < 5 * 60 * 1000) {
    return {
      isHealthy: consecutiveFailures === 0,
      lastCheck: lastHealthCheck,
      version: null,
      lastError: consecutiveFailures > 0 ? 'Recent failures detected' : null,
      consecutiveFailures
    };
  }

  // Run fresh check
  return await runHealthCheck();
}

/**
 * Force a health check now
 */
export async function forceHealthCheck(): Promise<HealthStatus> {
  return await runHealthCheck();
}
