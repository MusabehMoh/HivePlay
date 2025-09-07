import { NextResponse } from 'next/server';
import ytSearch from 'yt-search';

// Cache for storing suggestions to avoid repeated API calls
const suggestionCache = new Map<string, { suggestions: SuggestionItem[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface SuggestionItem {
  text: string;
  thumbnail?: string;
  type: 'artist' | 'song' | 'generic';
}

// Function to fetch real suggestions using yt-search (same package as your main search)
async function fetchYtSearchSuggestions(query: string): Promise<SuggestionItem[]> {
  try {
    // Use yt-search to get actual search results and extract suggestions
    const searchResult = await ytSearch({ query, pages: 1 });
    const suggestions: SuggestionItem[] = [];

    // Extract suggestions from video titles and artist names
    if (searchResult.videos && searchResult.videos.length > 0) {
      searchResult.videos.slice(0, 10).forEach(video => {
        // Add artist/channel name if it's not already included
        if (video.author?.name && !suggestions.some(s => s.text === video.author.name)) {
          suggestions.push({
            text: video.author.name,
            thumbnail: video.thumbnail,
            type: 'artist'
          });
        }
        
        // Extract song/track names from video titles
        const title = video.title;
        const queryLower = query.toLowerCase();
        const titleLower = title.toLowerCase();
        
        // If title contains the query, try to extract meaningful suggestions
        if (titleLower.includes(queryLower)) {
          // Add the full title as a suggestion (cleaned up)
          const cleanTitle = title
            .replace(/\(.*?\)/g, '') // Remove parentheses content
            .replace(/\[.*?\]/g, '') // Remove square brackets content
            .replace(/official|video|music|mv|hd|4k/gi, '') // Remove common video terms
            .trim();
          
          if (cleanTitle && cleanTitle.length > query.length && !suggestions.some(s => s.text === cleanTitle)) {
            suggestions.push({
              text: cleanTitle,
              thumbnail: video.thumbnail,
              type: 'song'
            });
          }
          
          // Try to extract artist + song combinations
          const parts = title.split(/[-–—]/);
          if (parts.length >= 2) {
            const artistSong = `${parts[0].trim()} ${parts[1].trim()}`;
            if (artistSong.length > query.length && !suggestions.some(s => s.text === artistSong)) {
              suggestions.push({
                text: artistSong,
                thumbnail: video.thumbnail,
                type: 'song'
              });
            }
          }
        }
      });
    }

    // Add generic music-related suggestions based on the query
    const genericSuggestions: SuggestionItem[] = [
      { text: `${query} songs`, type: 'generic' },
      { text: `${query} music`, type: 'generic' },
      { text: `${query} playlist`, type: 'generic' },
      { text: `${query} hits`, type: 'generic' },
      { text: `${query} live`, type: 'generic' },
      { text: `${query} acoustic`, type: 'generic' },
      { text: `${query} remix`, type: 'generic' },
      { text: `${query} cover`, type: 'generic' }
    ];

    suggestions.push(...genericSuggestions);
    
    // Remove duplicates and limit to 8 suggestions
    return [...new Set(suggestions.map(s => JSON.stringify(s)))]
      .map(s => JSON.parse(s))
      .filter(suggestion => suggestion.text.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8);

  } catch (error) {
    console.error('Error fetching yt-search suggestions:', error);
    return [];
  }
}

// Main function to generate suggestions using the same API as your search
async function generateSuggestions(query: string): Promise<SuggestionItem[]> {
  const queryLower = query.toLowerCase().trim();
  
  if (queryLower.length < 2) {
    return [];
  }

  try {
    // Use yt-search (same package as your main search)
    const suggestions = await fetchYtSearchSuggestions(query);
    
    // If we don't get enough suggestions, add some basic ones
    if (suggestions.length < 4) {
      const basicSuggestions: SuggestionItem[] = [
        { text: `${query} songs`, type: 'generic' },
        { text: `${query} music`, type: 'generic' },
        { text: `${query} artist`, type: 'generic' },
        { text: `${query} playlist`, type: 'generic' },
        { text: `${query} hits`, type: 'generic' },
        { text: `${query} best songs`, type: 'generic' },
        { text: `${query} top tracks`, type: 'generic' },
        { text: `${query} latest`, type: 'generic' }
      ];
      
      suggestions.push(...basicSuggestions.filter(s => !suggestions.some(existing => existing.text === s.text)));
    }

    return suggestions.slice(0, 8);
  } catch (error) {
    console.error('Error generating suggestions:', error);
    
    // Fallback to basic suggestions if API fails
    return [
      { text: `${query} songs`, type: 'generic' },
      { text: `${query} music`, type: 'generic' },
      { text: `${query} playlist`, type: 'generic' },
      { text: `${query} hits`, type: 'generic' }
    ];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }
  
  const queryKey = query.toLowerCase().trim();
  
  // Check cache first
  const cached = suggestionCache.get(queryKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({ suggestions: cached.suggestions, fromCache: true });
  }
  
  try {
    // Generate suggestions
    const suggestions = await generateSuggestions(query);
    
    // Cache the results
    suggestionCache.set(queryKey, {
      suggestions,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (suggestionCache.size > 100) {
      const entries = Array.from(suggestionCache.entries());
      entries.slice(0, 20).forEach(([key]) => suggestionCache.delete(key));
    }
    
    return NextResponse.json({ suggestions, fromCache: false });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}