'use server';

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
    
    // Try yt-dlp's built-in update command
    const { stdout, stderr } = await executeYtDlp(['-U']);
    
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
    return {
      success: false,
      message: `Self-update failed: ${(error as Error).message}`
    };
  }
}

/**
 * Update yt-dlp using package manager (fallback method)
 */
async function updateWithPackageManager(): Promise<UpdateResult> {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  
  try {
    const oldVersion = await getCurrentVersion();
    
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
  
  // Try self-update first (most reliable)
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
 * Check if yt-dlp needs updating by comparing with latest GitHub release
 */
export async function checkForUpdates(): Promise<{ hasUpdate: boolean; currentVersion?: string; latestVersion?: string }> {
  try {
    const currentVersion = await getCurrentVersion();
    if (!currentVersion) {
      return { hasUpdate: false };
    }
    
    // Fetch latest release info from GitHub
    const response = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
    if (!response.ok) {
      throw new Error('Failed to fetch latest version info');
    }
    
    const releaseInfo = await response.json();
    const latestVersion = releaseInfo.tag_name || releaseInfo.name;
    
    // Simple version comparison (assumes semantic versioning)
    const hasUpdate = currentVersion !== latestVersion.replace('v', '');
    
    return {
      hasUpdate,
      currentVersion,
      latestVersion: latestVersion.replace('v', '')
    };
  } catch (error) {
    console.error('[yt-dlp-updater] Failed to check for updates:', error);
    return { hasUpdate: false };
  }
}

/**
 * Handle common yt-dlp errors and attempt auto-update if needed
 */
export function shouldAutoUpdate(errorMessage: string): boolean {
  const updateTriggers = [
    'ERROR: Unable to extract',
    'HTTP Error 403',
    'HTTP Error 429', 
    'Sign in to confirm',
    'This video is not available',
    'Video unavailable',
    'unable to download video data',
    'requested format not available',
    'no video formats found'
  ];
  
  return updateTriggers.some(trigger => 
    errorMessage.toLowerCase().includes(trigger.toLowerCase())
  );
}
