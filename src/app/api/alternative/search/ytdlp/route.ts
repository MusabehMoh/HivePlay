import { NextResponse } from 'next/server';
import { searchWithYtDlp, checkYtDlpAvailable, getYtDlpInstallInstructions } from '@/app/services/alternative/yt-dlp-service';

export async function GET(request: Request) {
  // Get search parameters
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const maxResults = searchParams.get('maxResults') || '10';
  const maxResultsNum = parseInt(maxResults);
  const limit = Math.min(maxResultsNum, 24); // Cap at 24 to reduce processing time
  const forceRefresh = searchParams.get('forceRefresh') === 'true'; // Parameter to force refresh
  
  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    console.log(`[API] Searching with yt-dlp for: "${query}", limit: ${limit}, forceRefresh: ${forceRefresh}`);
    
    // Check if yt-dlp is installed and available
    const isYtDlpAvailable = await checkYtDlpAvailable();
    
    if (!isYtDlpAvailable) {
      const instructions = await getYtDlpInstallInstructions();
      // Detect client OS for more specific instructions (based on user agent)
      const userAgent = request.headers.get('user-agent') || '';
      let osSpecificInstructions = instructions.general;
      
      if (userAgent.includes('Windows')) {
        osSpecificInstructions = instructions.windows;
      } else if (userAgent.includes('Mac OS')) {
        osSpecificInstructions = instructions.macos;
      } else if (userAgent.includes('Linux')) {
        osSpecificInstructions = instructions.linux;
      }
      
      return NextResponse.json({ 
        error: 'yt-dlp is not installed or not in PATH',
        details: 'yt-dlp is required for this search method',
        installationInstructions: osSpecificInstructions,
        generalInstructions: instructions.general,
        recommendedAlternative: 'invidious' // Suggest using Invidious instead
      }, { status: 503 }); // 503 Service Unavailable
    }
    
    // If yt-dlp is available, proceed with the search
    const { results, fromCache } = await searchWithYtDlp(query, limit, forceRefresh);
    
    return NextResponse.json({ results, fromCache });
  } catch (error) {
    console.error('[API] yt-dlp search error:', error);
    
    // Special handling for common errors
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('not recognized')) {
        const instructions = await getYtDlpInstallInstructions();
        return NextResponse.json({ 
          error: 'yt-dlp is not installed or not in PATH',
          installationInstructions: instructions.general,
          recommendedAlternative: 'invidious' // Suggest using Invidious instead
        }, { status: 503 });
      } else if (error.message.includes('timed out')) {
        return NextResponse.json({ 
          error: 'The yt-dlp search took too long to complete',
          details: 'Try a different search query or use an alternative search method',
          recommendedAlternative: 'invidious'
        }, { status: 504 }); // 504 Gateway Timeout
      }
    }
    
    return NextResponse.json({ 
      error: 'Failed to search with yt-dlp',
      message: error instanceof Error ? error.message : 'Unknown error',
      recommendedAlternative: 'invidious'
    }, { status: 500 });
  }
}