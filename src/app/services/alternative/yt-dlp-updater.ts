

import { executeYtDlp, getYtDlpPath } from './ytdlp-locator';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execPromise = util.promisify(exec);

export interface UpdateResult {
  success: boolean;
  message: string;
  oldVersion?: string;
  newVersion?: string;
}

/**
 * Get the current yt-dlp version
 */
async function getCurrentVersion(): Promise<string | null> {
  try {
    const { stdout } = await executeYtDlp(['--version']);
    return stdout.trim();
  } catch (error) {
    console.error('[yt-dlp-updater] Failed to get current version:', error);
    return null;
  }
}

/**
 * Update yt-dlp using its built-in self-update mechanism
 */
async function updateWithSelfUpdate(): Promise<UpdateResult> {
  try {
    const oldVersion = await getCurrentVersion();
    console.log('[yt-dlp-updater] Current version:', oldVersion);
    
    // Try yt-dlp's built-in update command with --update-to stable
    // This bypasses GitHub API rate limits by using direct download
    console.log('[yt-dlp-updater] Running: yt-dlp --update-to stable');
    const { stdout, stderr } = await executeYtDlp(['--update-to', 'stable']);
    
    console.log('[yt-dlp-updater] Update output:', stdout || stderr);
    
    // Wait a moment for the update to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newVersion = await getCurrentVersion();
    
    if (oldVersion === newVersion) {
      return {
        success: true,
        message: `yt-dlp is already up to date (${newVersion})`,
        oldVersion,
        newVersion
      };
    }
    
    return {
      success: true,
      message: `Successfully updated yt-dlp from ${oldVersion} to ${newVersion}`,
      oldVersion: oldVersion || undefined,
      newVersion: newVersion || undefined
    };
  } catch (error) {
    console.error('[yt-dlp-updater] Self-update failed:', error);
    
    // If --update-to failed, try simple -U as fallback
    try {
      console.log('[yt-dlp-updater] Trying fallback: yt-dlp -U');
      await executeYtDlp(['-U']);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newVersion = await getCurrentVersion();
      return {
        success: true,
        message: `Updated yt-dlp via fallback method to ${newVersion}`,
        newVersion: newVersion || undefined
      };
    } catch (fallbackError) {
      return {
        success: false,
        message: `Self-update failed: ${(error as Error).message}`
      };
    }
  }
}

/**
 * Check if running in Docker
 */
function isDocker(): boolean {
  try {
    return fs.existsSync('/.dockerenv') || fs.existsSync('/app/docker-update-ytdlp.sh');
  } catch {
    return false;
  }
}

/**
 * Update yt-dlp in Docker using pip (the only reliable method for pip-installed packages)
 */
async function updateInDocker(): Promise<UpdateResult> {
  try {
    const oldVersion = await getCurrentVersion();
    console.log('[yt-dlp-updater] Docker environment: upgrading via pip in venv...');
    await execPromise('/opt/venv/bin/pip install --no-cache-dir --upgrade yt-dlp');
    
    // Give pip a moment to finish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newVersion = await getCurrentVersion();
    
    if (oldVersion === newVersion) {
      return {
        success: true,
        message: `yt-dlp is already up to date (${newVersion})`,
        oldVersion: oldVersion || undefined,
        newVersion: newVersion || undefined
      };
    }
    
    return {
      success: true,
      message: `Updated yt-dlp from ${oldVersion} to ${newVersion}`,
      oldVersion: oldVersion || undefined,
      newVersion: newVersion || undefined
    };
  } catch (error) {
    console.error('[yt-dlp-updater] Docker pip upgrade failed:', error);
    return {
      success: false,
      message: `Docker pip upgrade failed: ${(error as Error).message}`
    };
  }
}

/**
 * Update yt-dlp using package manager (fallback method)
 */
async function updateWithPackageManager(): Promise<UpdateResult> {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const inDocker = isDocker();
  
  try {
    const oldVersion = await getCurrentVersion();
    
    // Docker takes priority
    if (inDocker) {
      console.log('[yt-dlp-updater] Docker environment detected');
      return await updateInDocker();
    }
    
    if (isWindows) {
      // Try WinGet first, then Chocolatey
      try {
        console.log('[yt-dlp-updater] Attempting WinGet update...');
        await execPromise('winget upgrade yt-dlp.yt-dlp');
      } catch (wingetError) {
        console.log('[yt-dlp-updater] WinGet failed, trying Chocolatey...');
        try {
          await execPromise('choco upgrade yt-dlp -y');
        } catch (chocoError) {
          console.log('[yt-dlp-updater] Chocolatey failed, trying pip...');
          await execPromise('pip install --upgrade yt-dlp');
        }
      }
    } else if (isMac) {
      // Try Homebrew first, then pip
      try {
        console.log('[yt-dlp-updater] Attempting Homebrew update...');
        await execPromise('brew upgrade yt-dlp');
      } catch (brewError) {
        console.log('[yt-dlp-updater] Homebrew failed, trying pip...');
        await execPromise('pip3 install --upgrade yt-dlp');
      }
    } else {
      // Linux - try various package managers
      try {
        // Try pip first (most universal)
        await execPromise('pip3 install --upgrade yt-dlp');
      } catch (pipError) {
        try {
          // Try apt (Debian/Ubuntu)
          await execPromise('sudo apt update && sudo apt upgrade -y yt-dlp');
        } catch (aptError) {
          console.log('[yt-dlp-updater] Package manager update failed');
          throw aptError;
        }
      }
    }
    
    // Wait for update to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const newVersion = await getCurrentVersion();
    
    return {
      success: true,
      message: `Updated yt-dlp using package manager from ${oldVersion} to ${newVersion}`,
      oldVersion: oldVersion || undefined,
      newVersion: newVersion || undefined
    };
  } catch (error) {
    console.error('[yt-dlp-updater] Package manager update failed:', error);
    return {
      success: false,
      message: `Package manager update failed: ${(error as Error).message}`
    };
  }
}

/**
 * Update yt-dlp automatically when errors are detected
 */
export async function autoUpdateYtDlp(): Promise<UpdateResult> {
  console.log('[yt-dlp-updater] Starting auto-update process...');
  
  const ytdlpPath = await getYtDlpPath();
  if (!ytdlpPath) {
    return {
      success: false,
      message: 'yt-dlp not found. Please install it first.'
    };
  }
  
  // In Docker, yt-dlp is installed via pip — self-update doesn't work for pip packages.
  // Always use pip directly to upgrade.
  if (isDocker()) {
    console.log('[yt-dlp-updater] Docker environment detected, using pip upgrade...');
    return await updateInDocker();
  }
  
  // Outside Docker: try self-update first (works for standalone binaries)
  console.log('[yt-dlp-updater] Attempting self-update...');
  const selfUpdateResult = await updateWithSelfUpdate();
  
  if (selfUpdateResult.success) {
    return selfUpdateResult;
  }
  
  // If self-update failed, try package manager
  console.log('[yt-dlp-updater] Self-update failed, trying package manager...');
  return await updateWithPackageManager();
}

/**
 * Compare two version strings (supports date-based versions like 2025.09.05)
 */
function compareVersions(current: string, latest: string): number {
  // Remove 'v' prefix if present
  const currentClean = current.replace(/^v/, '');
  const latestClean = latest.replace(/^v/, '');
  
  // Handle date-based versions (YYYY.MM.DD format)
  const datePattern = /^(\d{4})\.(\d{2})\.(\d{2})$/;
  const currentMatch = currentClean.match(datePattern);
  const latestMatch = latestClean.match(datePattern);
  
  if (currentMatch && latestMatch) {
    // Convert to Date objects for comparison
    const currentDate = new Date(
      parseInt(currentMatch[1]), 
      parseInt(currentMatch[2]) - 1, 
      parseInt(currentMatch[3])
    );
    const latestDate = new Date(
      parseInt(latestMatch[1]), 
      parseInt(latestMatch[2]) - 1, 
      parseInt(latestMatch[3])
    );
    
    return currentDate.getTime() - latestDate.getTime();
  }
  
  // Fallback to simple string comparison for other version formats
  return currentClean.localeCompare(latestClean);
}

/**
 * Check if yt-dlp needs updating by comparing with latest GitHub release
 */
export async function checkForUpdates(): Promise<{ hasUpdate: boolean; currentVersion?: string; latestVersion?: string; daysBehind?: number }> {
  try {
    const currentVersion = await getCurrentVersion();
    if (!currentVersion) {
      return { hasUpdate: false };
    }
    
    // Fetch latest release info from GitHub with retry logic and fallback
    let response;
    try {
      response = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'HivePlay-yt-dlp-updater'
        }
      });
      
      if (!response.ok) {
        // If rate limited or other error, try alternative method
        console.warn(`[yt-dlp-updater] GitHub API returned ${response.status}, trying alternative method`);
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      console.log('[yt-dlp-updater] GitHub API unavailable, assuming update may be needed');
      // If we can't check for updates, assume update might help (better safe than sorry)
      return { 
        hasUpdate: true, 
        currentVersion,
        latestVersion: 'unknown'
      };
    }
    
    const releaseInfo = await response.json();
    const latestVersion = (releaseInfo.tag_name || releaseInfo.name).replace(/^v/, '');
    
    // Compare versions
    const comparison = compareVersions(currentVersion, latestVersion);
    const hasUpdate = comparison < 0; // current is older than latest
    
    let daysBehind: number | undefined;
    
    // Calculate days behind for date-based versions
    const datePattern = /^(\d{4})\.(\d{2})\.(\d{2})$/;
    const currentMatch = currentVersion.match(datePattern);
    const latestMatch = latestVersion.match(datePattern);
    
    if (hasUpdate && currentMatch && latestMatch) {
      const currentDate = new Date(
        parseInt(currentMatch[1]), 
        parseInt(currentMatch[2]) - 1, 
        parseInt(currentMatch[3])
      );
      const latestDate = new Date(
        parseInt(latestMatch[1]), 
        parseInt(latestMatch[2]) - 1, 
        parseInt(latestMatch[3])
      );
      
      daysBehind = Math.ceil((latestDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      daysBehind
    };
  } catch (error) {
    console.error('[yt-dlp-updater] Failed to check for updates:', error);
    // On error, get current version and assume we might need update
    const currentVersion = await getCurrentVersion().catch(() => null);
    return { 
      hasUpdate: true, // Assume update might help
      currentVersion: currentVersion || undefined 
    };
  }
}

/**
 * Detect if error is likely due to geo-blocking or content restrictions (not fixable by update)
 */
export function isGeoBlockedOrRestricted(errorMessage: string): boolean {
  const geoBlockPatterns = [
    'not available in your country',
    'this video is not available',
    'geo-restricted',
    'region restricted',
    'content is not available',
    'blocked in your country',
    'video unavailable',
    'private video',
    'deleted video'
  ];
  
  return geoBlockPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern)
  );
}

/**
 * Detect if error is due to YouTube rate limiting or IP blocking (temporary issue)
 */
export function isTemporaryYouTubeIssue(errorMessage: string): boolean {
  const tempIssuePatterns = [
    'HTTP Error 429', // Too many requests
    'rate limit',
    'please try again later',
    'temporary issue',
    'service unavailable'
  ];
  
  return tempIssuePatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern)
  );
}

/**
 * Handle common yt-dlp errors and determine if auto-update might help
 */
export function shouldAutoUpdate(errorMessage: string, exitCode?: number): boolean {
  // Don't update if it's a geo-blocking issue
  if (isGeoBlockedOrRestricted(errorMessage)) {
    console.log('[yt-dlp-updater] Error appears to be geo-blocking/content restriction, update won\'t help');
    return false;
  }
  
  // Don't update if it's a temporary YouTube rate limit
  if (isTemporaryYouTubeIssue(errorMessage)) {
    console.log('[yt-dlp-updater] Error appears to be temporary YouTube rate limit, update won\'t help');
    return false;
  }
  
  // Exit code 1 with 403 Forbidden could be:
  // 1. YouTube blocking the IP (temporary) - "unable to download video data"
  // 2. Outdated extractors - "unable to extract"
  if (exitCode === 1 && errorMessage.toLowerCase().includes('403')) {
    // If it's specifically about downloading video data, it's likely YouTube IP blocking
    if (errorMessage.toLowerCase().includes('unable to download video data')) {
      console.log('[yt-dlp-updater] 403 on video download - likely YouTube IP blocking, not yt-dlp issue');
      return false; // Don't update, it won't help
    }
    // If it's about extraction, update might help
    if (errorMessage.toLowerCase().includes('extract')) {
      console.log('[yt-dlp-updater] 403 on extraction - update likely needed');
      return true;
    }
  }
  
  const updateTriggers = [
    'unable to extract',
    'Sign in to confirm',
    'requested format not available',
    'no video formats found',
    'format not available',
    'extractors are outdated',
    'signature function',
    'unable to extract player',
    'video info extraction',
    'cipher'
  ];
  
  return updateTriggers.some(trigger => 
    errorMessage.toLowerCase().includes(trigger.toLowerCase())
  );
}

/**
 * Smart auto-update that checks if update is needed before updating
 */
export async function smartAutoUpdate(): Promise<UpdateResult> {
  console.log('[yt-dlp-updater] Starting smart auto-update process...');
  
  // First check if we even need an update
  const updateCheck = await checkForUpdates();
  
  if (!updateCheck.hasUpdate) {
    console.log('[yt-dlp-updater] yt-dlp is already up to date');
    return {
      success: true,
      message: `yt-dlp is already up to date (${updateCheck.currentVersion})`,
      oldVersion: updateCheck.currentVersion,
      newVersion: updateCheck.currentVersion
    };
  }
  
  console.log(`[yt-dlp-updater] Update available: ${updateCheck.currentVersion} -> ${updateCheck.latestVersion} (${updateCheck.daysBehind} days behind)`);
  
  // Perform the update
  return await autoUpdateYtDlp();
}

/**
 * Run a startup update check — called once when the server boots.
 * Logs every step so the Docker console clearly shows what happened.
 */
export async function startupUpdateCheck(): Promise<void> {
  console.log('[yt-dlp] Startup update check — querying GitHub releases...');

  try {
    const updateInfo = await checkForUpdates();

    if (!updateInfo.hasUpdate) {
      console.log(`[yt-dlp] ✓ Up to date (${updateInfo.currentVersion})`);
      return;
    }

    const daysBehind = updateInfo.daysBehind
      ? `${updateInfo.daysBehind} day${updateInfo.daysBehind === 1 ? '' : 's'} behind`
      : 'update available';

    console.log(
      `[yt-dlp] Update detected: ${updateInfo.currentVersion} → ${updateInfo.latestVersion} (${daysBehind})`
    );
    console.log('[yt-dlp] Starting auto-update...');

    const result = await autoUpdateYtDlp();

    if (result.success) {
      if (result.oldVersion && result.newVersion && result.oldVersion !== result.newVersion) {
        console.log(`[yt-dlp] ✓ Successfully updated: ${result.oldVersion} → ${result.newVersion}`);
      } else {
        console.log(`[yt-dlp] ✓ Already up to date after update attempt (${result.newVersion})`);
      }
    } else {
      console.error(`[yt-dlp] ✗ Auto-update failed: ${result.message}`);
      console.error('[yt-dlp]   The app will continue with the current version.');
    }
  } catch (error) {
    console.error('[yt-dlp] ✗ Startup update check threw an error:', (error as Error).message);
  }
}

// Cache for tracking recent update attempts to avoid spam
const updateAttempts = new Map<string, number>();
const UPDATE_COOLDOWN = 5 * 60 * 1000; // 5 minutes

/**
 * Auto-update with cooldown to prevent excessive update attempts
 */
export async function autoUpdateWithCooldown(videoId?: string): Promise<UpdateResult> {
  const key = videoId || 'global';
  const lastAttempt = updateAttempts.get(key) || 0;
  const now = Date.now();
  
  if (now - lastAttempt < UPDATE_COOLDOWN) {
    const remainingCooldown = Math.ceil((UPDATE_COOLDOWN - (now - lastAttempt)) / 1000);
    return {
      success: false,
      message: `Update cooldown active. Please wait ${remainingCooldown} seconds before trying again.`
    };
  }
  
  updateAttempts.set(key, now);
  
  try {
    const result = await smartAutoUpdate();
    
    // Clear cooldown on successful update
    if (result.success) {
      updateAttempts.delete(key);
    }
    
    return result;
  } catch (error) {
    console.error('[yt-dlp-updater] Auto-update failed:', error);
    return {
      success: false,
      message: `Auto-update failed: ${(error as Error).message}`
    };
  }
}
