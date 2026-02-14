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
    // Project root directory (where yt-dlp.exe may be bundled)
    process.cwd(),
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

  const isWindows = process.platform === 'win32';
  const exeName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';

  // First, check the project/cwd directory explicitly and return full path
  // (Windows searches cwd for executables, but that breaks when spawn uses a different cwd)
  const cwdPath = path.join(process.cwd(), exeName);
  if (fs.existsSync(cwdPath)) {
    console.log(`[ytdlp-locator] yt-dlp found in project directory: ${cwdPath}`);
    ytDlpExecutablePath = cwdPath;
    return ytDlpExecutablePath;
  }

  // Try using the command directly (if it's in system PATH)
  try {
    const { stdout } = await execPromise(isWindows ? 'where yt-dlp' : 'which yt-dlp');
    if (stdout && stdout.trim()) {
      const resolvedPath = stdout.trim().split('\n')[0].trim();
      console.log(`[ytdlp-locator] yt-dlp found in PATH: ${resolvedPath}`);
      ytDlpExecutablePath = resolvedPath; // Use full resolved path
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

// Cache for cookie args (only caches browser-based results, not file-based)
let cachedBrowserCookieArgs: string[] | null = null;

/**
 * Get the best available cookie arguments for yt-dlp.
 * Priority: 1) cookies.txt file in project dir  2) Firefox  3) no cookies
 * Chrome/Edge DPAPI is broken on Windows (see https://github.com/yt-dlp/yt-dlp/issues/10927)
 */
export async function getCookieArgs(): Promise<string[]> {
  // Always check for cookies.txt first (cheap fs check, allows hot-adding the file)
  const cookieFile = path.join(process.cwd(), 'cookies.txt');
  if (fs.existsSync(cookieFile)) {
    console.log(`[ytdlp-locator] Using cookies file: ${cookieFile}`);
    return ['--cookies', cookieFile];
  }

  // Return cached browser result if already determined
  if (cachedBrowserCookieArgs !== null) {
    return cachedBrowserCookieArgs;
  }

  // 2. On Windows, Chrome/Edge DPAPI is broken — try Firefox first
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    // Check if Firefox profile exists
    const firefoxProfileDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
    if (fs.existsSync(firefoxProfileDir)) {
      try {
        const profiles = fs.readdirSync(firefoxProfileDir);
        if (profiles.length > 0) {
          console.log('[ytdlp-locator] Firefox detected, using --cookies-from-browser firefox');
          cachedBrowserCookieArgs = ['--cookies-from-browser', 'firefox'];
          return cachedBrowserCookieArgs;
        }
      } catch { /* ignore */ }
    }

    // Chrome/Edge DPAPI is broken on Windows, skip them
    console.log('[ytdlp-locator] No cookie source available on Windows (Chrome DPAPI broken). Running without cookies.');
    console.log('[ytdlp-locator] To fix: export cookies.txt from Chrome using "Get cookies.txt LOCALLY" extension and place it in the project root.');
    cachedBrowserCookieArgs = [];
    return cachedBrowserCookieArgs;
  }

  // 3. On non-Windows, try browsers in order
  const browsers = ['firefox', 'chrome', 'chromium', 'edge'];
  for (const browser of browsers) {
    try {
      const ytdlpPath = await getYtDlpPath();
      if (ytdlpPath) {
        const { stdout } = await execPromise(`"${ytdlpPath}" --cookies-from-browser ${browser} --version`, { timeout: 10000 });
        if (stdout) {
          console.log(`[ytdlp-locator] Using cookies from browser: ${browser}`);
          cachedBrowserCookieArgs = ['--cookies-from-browser', browser];
          return cachedBrowserCookieArgs;
        }
      }
    } catch { /* try next */ }
  }

  console.log('[ytdlp-locator] No cookie source found. Running without cookies.');
  cachedBrowserCookieArgs = [];
  return cachedBrowserCookieArgs;
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