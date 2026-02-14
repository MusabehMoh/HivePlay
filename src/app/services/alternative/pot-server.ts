/**
 * PO Token Server Auto-Start
 * Ensures the bgutil PO token server is running for yt-dlp anti-bot bypass.
 * This module is imported during server initialization.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const POT_SERVER_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  'bgutil-ytdlp-pot-provider', 'server', 'build', 'main.js'
);
const POT_PORT = 4416;
const POT_HOST = '127.0.0.1';

let startAttempted = false;

async function isPotServerRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://${POT_HOST}:${POT_PORT}/ping`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function startPotServer(): Promise<void> {
  if (startAttempted) return;
  startAttempted = true;

  // Check if already running
  if (await isPotServerRunning()) {
    console.log('[PO Token] Server already running at port', POT_PORT);
    return;
  }

  // Check if the server script exists
  if (!fs.existsSync(POT_SERVER_PATH)) {
    console.warn('[PO Token] Server not found at:', POT_SERVER_PATH);
    console.warn('[PO Token] yt-dlp may fail with bot detection. Install bgutil-ytdlp-pot-provider.');
    return;
  }

  console.log('[PO Token] Starting server from:', POT_SERVER_PATH);

  try {
    const child = spawn('node', [POT_SERVER_PATH], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    // Unref so it doesn't prevent Next.js from exiting
    child.unref();

    // Wait for it to be ready (up to 15 seconds)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await isPotServerRunning()) {
        console.log('[PO Token] Server started successfully (PID:', child.pid, ')');
        return;
      }
    }

    console.warn('[PO Token] Server started but not responding on port', POT_PORT);
  } catch (error) {
    console.error('[PO Token] Failed to start server:', error);
  }
}

export { startPotServer, isPotServerRunning };
