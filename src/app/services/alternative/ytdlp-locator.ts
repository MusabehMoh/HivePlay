'use server';

import { exec, spawn } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execPromise = util.promisify(exec);

// Common installation paths for yt-dlp on different platforms
const commonPaths = {
  windows: [
    // Specific WinGet installation path (most common)
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe'),
    // General Winget installation path
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages'),
    // Chocolatey installation path
    'C:\\ProgramData\\chocolatey\\bin',
    // Common user PATH locations
    'C:\\Program Files\\yt-dlp',
    'C:\\yt-dlp',
  ],
  unix: [
    '/usr/local/bin',
    '/usr/bin',
    '/opt/homebrew/bin', // macOS Homebrew
  ]
};

// Cache for the executable path
let ytDlpExecutablePath: string | null = null;

/**
 * Find the yt-dlp executable in common installation paths
 */
async function findYtDlpInCommonPaths(): Promise<string | null> {
  const isWindows = process.platform === 'win32';
  const exeName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
  const searchPaths = isWindows ? commonPaths.windows : commonPaths.unix;

  // First check if it's directly in these paths
  for (const basePath of searchPaths) {
    try {
      if (isWindows && basePath.includes('WinGet')) {
        if (basePath.includes('yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe')) {
          // Direct path to specific WinGet package
          const fullPath = path.join(basePath, exeName);
          if (fs.existsSync(fullPath)) {
            console.log(`[ytdlp-locator] Found yt-dlp at: ${fullPath}`);
            return fullPath;
          }
        } else if (fs.existsSync(basePath)) {
          // For general WinGet path, search subdirectories
          const dirs = fs.readdirSync(basePath);
          for (const dir of dirs) {
            if (dir.toLowerCase().includes('yt-dlp')) {
              const fullPath = path.join(basePath, dir, exeName);
              if (fs.existsSync(fullPath)) {
                console.log(`[ytdlp-locator] Found yt-dlp at: ${fullPath}`);
                return fullPath;
              }
            }
          }
        }
      } else {
        const fullPath = path.join(basePath, exeName);
        if (fs.existsSync(fullPath)) {
          console.log(`[ytdlp-locator] Found yt-dlp at: ${fullPath}`);
          return fullPath;
        }
      }
    } catch (error) {
      console.error(`[ytdlp-locator] Error checking path ${basePath}:`, error);
    }
  }

  return null;
}

/**
 * Get the path to the yt-dlp executable
 */
export async function getYtDlpPath(): Promise<string | null> {
  // Return cached path if already found
  if (ytDlpExecutablePath) {
    return ytDlpExecutablePath;
  }

  // Try using the command directly (if it's in PATH)
  try {
    const { stdout } = await execPromise('yt-dlp --version');
    if (stdout) {
      console.log('[ytdlp-locator] yt-dlp found in PATH');
      ytDlpExecutablePath = 'yt-dlp'; // Use command name directly
      return ytDlpExecutablePath;
    }
  } catch (error) {
    console.log('[ytdlp-locator] yt-dlp not found in PATH, searching common locations');
  }

  // Search in common installation paths
  const foundPath = await findYtDlpInCommonPaths();
  if (foundPath) {
    ytDlpExecutablePath = foundPath;
    return foundPath;
  }

  console.error('[ytdlp-locator] Could not find yt-dlp executable');
  return null;
}

/**
 * Execute yt-dlp with the given arguments
 * @param args Arguments to pass to yt-dlp
 */
export async function executeYtDlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const ytdlpPath = await getYtDlpPath();
  
  if (!ytdlpPath) {
    throw new Error('Could not find yt-dlp executable. Please make sure it is installed correctly.');
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const isWindows = process.platform === 'win32';
    
    let childProcess;
    
    if (isWindows && ytdlpPath !== 'yt-dlp') {
      // On Windows, when using a direct path, we need special handling
      // Use the path without extra quotes and escape spaces in the path
      const safeArgs = args.map(arg => arg.includes(' ') ? `"${arg}"` : arg);
      childProcess = spawn(ytdlpPath, safeArgs);
    } else {
      // For UNIX or when yt-dlp is in PATH
      childProcess = spawn(ytdlpPath, args);
    }
    
    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      if (code === 0 || stdout) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });

    childProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Check if yt-dlp is available and get its version
 */
export async function checkYtDlp(): Promise<{ available: boolean; version?: string }> {
  try {
    const ytdlpPath = await getYtDlpPath();
    if (!ytdlpPath) {
      return { available: false };
    }
    
    const { stdout, stderr } = await executeYtDlp(['--version']);
    if (stdout) {
      return { available: true, version: stdout.trim() };
    } else {
      return { available: false };
    }
  } catch (error) {
    console.error('[ytdlp-locator] Error checking yt-dlp:', error);
    return { available: false };
  }
}

/**
 * Check if FFmpeg is available
 */
export async function checkFfmpeg(): Promise<boolean> {
  try {
    await execPromise('ffmpeg -version');
    return true;
  } catch (error) {
    return false;
  }
}