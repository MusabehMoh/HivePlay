import { NextResponse } from 'next/server';

const suggestionCache = new Map<string, { suggestions: string[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch autocomplete suggestions straight from YouTube's public suggestion endpoint.
 * Returns plain strings exactly as YouTube would show them.
 */
async function fetchYouTubeSuggestions(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  // Response shape: ["query", ["suggestion1", "suggestion2", ...], ...]
  const data = await response.json();
  const raw: string[] = Array.isArray(data[1]) ? data[1] : [];
  return [...new Set(raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0))].slice(0, 8);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const queryKey = query.toLowerCase().trim();

  const cached = suggestionCache.get(queryKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({ suggestions: cached.suggestions, fromCache: true });
  }

  try {
    const suggestions = await fetchYouTubeSuggestions(query);

    suggestionCache.set(queryKey, { suggestions, timestamp: Date.now() });

    if (suggestionCache.size > 200) {
      Array.from(suggestionCache.keys()).slice(0, 50).forEach(k => suggestionCache.delete(k));
    }

    return NextResponse.json({ suggestions, fromCache: false });
  } catch (error) {
    console.error('[suggestions] YouTube autocomplete failed:', error);
    return NextResponse.json({ suggestions: [] });
  }
}

