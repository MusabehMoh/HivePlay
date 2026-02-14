import { NextResponse } from 'next/server';
import { createClient } from 'redis';

/**
 * API route to clear the Redis cache
 * This is used by developer tools to clear cached data
 * ONLY AVAILABLE IN DEVELOPMENT MODE
 */

export async function POST(request: Request) {
  // Only allow in development mode for safety
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({
      error: 'This endpoint is only available in development mode'
    }, { status: 403 });
  }
  
  try {
    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const clearType = searchParams.get('clearType');
    
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    const client = createClient({
      url: redisUrl
    });
    
    await client.connect();
    
    if (clearType === 'searchOnly') {
      // Only clear search-related caches
      const searchKeys = await client.keys('yt:search:*');
      
      if (searchKeys.length > 0) {
        await client.del(searchKeys);
        console.log(`Cleared ${searchKeys.length} search cache entries`);
      }
      
      await client.disconnect();
      return NextResponse.json({ 
        success: true, 
        message: `Cleared ${searchKeys.length} search cache entries` 
      });
    } else {
      // Clear all API caches
      const cacheKeys = await client.keys('yt:*');
      
      if (cacheKeys.length > 0) {
        await client.del(cacheKeys);
        console.log(`Cleared ${cacheKeys.length} cache entries`);
      }
      
      await client.disconnect();
      return NextResponse.json({ 
        success: true, 
        message: `Cleared ${cacheKeys.length} cache entries` 
      });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to clear cache' 
    }, { status: 500 });
  }
}