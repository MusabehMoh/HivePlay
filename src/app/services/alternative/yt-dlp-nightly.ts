/**
 * Nightly Build Updater for yt-dlp
 * Downloads and installs the latest nightly build when stable version fails
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execPromise = promisify(exec);

const NIGHTLY_RELEASES_URL = 'https://api.github.com/repos/yt-dlp/yt-dlp-nightly-builds/releases/latest';
const UPDATE_CHECK_FILE = path.join(os.tmpdir(), 'ytdlp-nightly-check.json');
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface NightlyCheckInfo {
  lastCheck: number;
  lastVersion: string;
  lastSuccess: boolean;
}

/**
 * Check if we should check for nightly updates
 */
async function shouldCheckNightly(): Promise<boolean> {
  try {
    const data = await fs.readFile(UPDATE_CHECK_FILE, 'utf-8');
    const info: NightlyCheckInfo = JSON.parse(data);
    return Date.now() - info.lastCheck > CHECK_INTERVAL;
  } catch {
    return true; // File doesn't exist, should check
  }
}

/**
 * Save nightly check info
 */
async function saveNightlyCheckInfo(version: string, success: boolean): Promise<void> {
  const info: NightlyCheckInfo = {
    lastCheck: Date.now(),
    lastVersion: version,
    lastSuccess: success
  };
  
  try {
    await fs.writeFile(UPDATE_CHECK_FILE, JSON.stringify(info, null, 2));
  } catch (error) {
    console.error('[Nightly Updater] Failed to save check info:', error);
  }
}

/**
 * Get latest nightly build info
 */
async function getLatestNightlyInfo(): Promise<{ version: string; downloadUrl: string } | null> {
  try {
    const response = await fetch(NIGHTLY_RELEASES_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'HivePlay-yt-dlp-updater'
      }
    });

    if (!response.ok) {
      console.warn('[Nightly Updater] GitHub API returned', response.status);
      return null;
    }

    const release = await response.json();
    const version = release.tag_name || release.name;
    
    // Find the appropriate asset for the platform
    const isWindows = process.platform === 'win32';
    const asset = release.assets?.find((a: any) => 
      isWindows ? a.name.endsWith('.exe') : a.name === 'yt-dlp'
    );

    if (!asset) {
      console.warn('[Nightly Updater] No suitable asset found');
      return null;
    }

    return {
      version,
      downloadUrl: asset.browser_download_url
    };
  } catch (error) {
    console.error('[Nightly Updater] Failed to fetch nightly info:', error);
    return null;
  }
}

/**
 * Download and install nightly build
 */
async function installNightlyBuild(downloadUrl: string): Promise<boolean> {
  try {
    console.log('[Nightly Updater] Downloading nightly build...');
    
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const tempFile = path.join(os.tmpdir(), 'yt-dlp-nightly.exe');
    
    await fs.writeFile(tempFile, Buffer.from(buffer));
    console.log('[Nightly Updater] Download complete, installing...');

    // On Windows, replace the existing yt-dlp.exe
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      
      // Try WinGet install location first
      const possiblePaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe', 'yt-dlp.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'yt-dlp', 'yt-dlp.exe'),
        'C:\\Program Files\\yt-dlp\\yt-dlp.exe'
      ];

      for (const targetPath of possiblePaths) {
        try {
          await fs.access(targetPath);
          await fs.copyFile(tempFile, targetPath);
          console.log(`[Nightly Updater] Installed to ${targetPath}`);
          return true;
        } catch {
          continue;
        }
      }
      
      console.warn('[Nightly Updater] Could not find yt-dlp installation path');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Nightly Updater] Installation failed:', error);
    return false;
  }
}

/**
 * Update to nightly build if needed
 */
export async function updateToNightly(): Promise<{ success: boolean; message: string }> {
  try {
    if (!await shouldCheckNightly()) {
      return { success: false, message: 'Recently checked, skipping' };
    }

    console.log('[Nightly Updater] Checking for nightly updates...');
    
    const nightlyInfo = await getLatestNightlyInfo();
    if (!nightlyInfo) {
      return { success: false, message: 'Could not fetch nightly build info' };
    }

    console.log(`[Nightly Updater] Latest nightly: ${nightlyInfo.version}`);
    
    const success = await installNightlyBuild(nightlyInfo.downloadUrl);
    await saveNightlyCheckInfo(nightlyInfo.version, success);

    if (success) {
      return { 
        success: true, 
        message: `Updated to nightly build ${nightlyInfo.version}` 
      };
    } else {
      return { 
        success: false, 
        message: 'Failed to install nightly build' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Nightly update error: ${(error as Error).message}` 
    };
  }
}

/**
 * Check if nightly update is available without installing
 */
export async function checkNightlyAvailable(): Promise<boolean> {
  const info = await getLatestNightlyInfo();
  return info !== null;
}
