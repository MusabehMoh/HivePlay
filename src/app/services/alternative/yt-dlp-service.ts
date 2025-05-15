'use server';

import { getFromCache, setInCache } from '../redis/server-cache-service';
import { executeYtDlp, checkYtDlp } from './ytdlp-locator';

// Cache settings
const CACHE_PREFIX = 'ytdlp:search';
const CACHE_TTL = 3600; // 1 hour

interface YtDlpSearchResult {
  id: string;
  title: string;
  channel: string;
  thumbnails: string[];
  duration: number;
  view_count: number;
  upload_date: string;
  description?: string;
}

/**
 * Checks if yt-dlp is installed and available
 * @returns Promise that resolves to true if yt-dlp is available
 */
export async function checkYtDlpAvailable(): Promise<boolean> {
  const { available } = await checkYtDlp();
  return available;
}

/**
 * Get yt-dlp installation instructions based on OS
 */
export async function getYtDlpInstallInstructions(): Promise<{ 
  windows: string; 
  macos: string; 
  linux: string; 
  general: string;
}> {
  return {
    windows: `
1. Using Winget: winget install yt-dlp
2. Using Chocolatey: choco install yt-dlp
3. Or download from: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
   and place in a directory that's in your PATH (e.g., C:\\Windows or make a new folder)
`,
    macos: `
1. Using Homebrew: brew install yt-dlp
2. Using MacPorts: sudo port install yt-dlp
`,
    linux: `
1. Using apt (Debian/Ubuntu): sudo apt install yt-dlp
2. Using pip: pip install yt-dlp
`,
    general: 'Visit https://github.com/yt-dlp/yt-dlp#installation for detailed instructions.'
  };
}

/**
 * Formats seconds into a human-readable duration (MM:SS)
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Search for videos using yt-dlp as an alternative to the YouTube API
 * @param query Search query
 * @param limit Maximum number of results
 * @param forceRefresh Whether to bypass cache
 * @returns Search results formatted like YouTube API results
 */
export async function searchWithYtDlp(
  query: string,
  limit: number = 24,
  forceRefresh: boolean = false
) {
  // Check if yt-dlp is available before proceeding
  const isYtDlpAvailable = await checkYtDlpAvailable();
  
  if (!isYtDlpAvailable) {
    const instructions = await getYtDlpInstallInstructions();
    throw new Error(`yt-dlp is not installed or not in PATH. Please install yt-dlp first.\n${instructions.general}`);
  }

  // Generate cache key
  const cacheKey = `${query}-${limit}`;
  
  // Check cache first if not forcing refresh
  if (!forceRefresh) {
    const cachedResults = await getFromCache(cacheKey, CACHE_PREFIX);
    if (cachedResults) {
      console.log('[yt-dlp Service] Returning cached results for:', query);
      return { results: cachedResults, fromCache: true };
    }
  }
  
  console.log('[yt-dlp Service] Searching with yt-dlp for:', query);
  
  try {
    // Construct yt-dlp command arguments
    // --no-warnings: Suppress warning messages
    // --dump-json: Output JSON data
    const sanitizedQuery = query.replace(/"/g, '\\"'); // Escape double quotes
    const ytdlpArgs = [
      `ytsearch${limit}:${sanitizedQuery}`,
      '--no-warnings',
      '--dump-json'
    ];
    
    console.log('[yt-dlp Service] Executing command:', 'yt-dlp', ytdlpArgs.join(' '));
    
    // Execute yt-dlp command with timeout
    const { stdout, stderr } = await Promise.race([
      executeYtDlp(ytdlpArgs),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('yt-dlp command timed out')), 30000); // 30 second timeout
      })
    ]) as { stdout: string, stderr: string };
    
    if (stderr && !stdout) {
      console.error('[yt-dlp Service] Command error:', stderr);
      throw new Error(stderr);
    }

    // Parse JSON output (each line is a separate JSON object)
    const resultsData = stdout
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.warn('[yt-dlp Service] Failed to parse JSON line:', line);
          return null;
        }
      })
      .filter(Boolean); // Remove null entries
    
    if (resultsData.length === 0) {
      console.warn('[yt-dlp Service] No valid results found');
      return { results: [], fromCache: false };
    }
    
    // Transform yt-dlp results to format similar to YouTube API
    const transformedResults = resultsData.map(item => {
      // Get thumbnails - yt-dlp sometimes provides them in different formats
      let thumbnails = [];
      if (item.thumbnails && Array.isArray(item.thumbnails)) {
        thumbnails = item.thumbnails.map((t: any) => t.url || t);
      } else if (item.thumbnail) {
        thumbnails = [item.thumbnail];
      } else {
        // Fallback to YouTube's thumbnail URL pattern
        thumbnails = [
          `https://i.ytimg.com/vi/${item.id}/default.jpg`,
          `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
          `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`
        ];
      }
      
      // Format duration
      const durationInSeconds = item.duration || 0;
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = durationInSeconds % 60;
      const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // Format date
      let formattedDate = '';
      if (item.upload_date) {
        try {
          // yt-dlp usually returns dates in YYYYMMDD format
          const year = item.upload_date.substring(0, 4);
          const month = item.upload_date.substring(4, 6);
          const day = item.upload_date.substring(6, 8);
          formattedDate = `${year}-${month}-${day}T00:00:00Z`;
        } catch (e) {
          console.warn('[yt-dlp Service] Failed to parse date:', item.upload_date);
          formattedDate = '';
        }
      }
      
      return {
        id: { videoId: item.id },
        snippet: {
          title: item.title || 'No title',
          thumbnails: {
            default: { url: thumbnails[0] || '' },
            medium: { url: thumbnails[1] || thumbnails[0] || '' },
            high: { url: thumbnails[2] || thumbnails[1] || thumbnails[0] || '' }
          },
          channelTitle: item.channel || item.uploader || 'Unknown channel',
          publishedAt: formattedDate,
          description: item.description || ''
        },
        contentDetails: {
          duration: `PT${minutes}M${seconds}S`,
          formattedDuration: formattedDuration
        },
        statistics: {
          viewCount: item.view_count?.toString() || '0'
        }
      };
    });
    
    // Cache the results
    await setInCache(cacheKey, transformedResults, {
      prefix: CACHE_PREFIX,
      ttl: CACHE_TTL
    });
    
    return { 
      results: transformedResults, 
      fromCache: false 
    };
  } catch (error) {
    console.error('[yt-dlp Service] Error:', error);
    throw new Error(`yt-dlp search failed: ${(error as Error).message}`);
  }
}