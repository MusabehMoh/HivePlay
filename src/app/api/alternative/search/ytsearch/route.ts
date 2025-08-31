import { NextResponse } from 'next/server';
import ytSearch from 'yt-search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const maxResults = parseInt(searchParams.get('maxResults') || '50', 10);

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const searchResult = await ytSearch({ query, pages: 3 });
    const videos = (searchResult.videos || []).slice(0, maxResults).map(video => ({
      id: { videoId: video.videoId },
      snippet: {
        title: video.title,
        thumbnails: {
          default: { url: video.thumbnail },
          medium: { url: video.thumbnail },
        },
        channelTitle: video.author.name,
        publishedAt: video.ago,
        description: video.description || '',
      },
      contentDetails: {
        duration: video.timestamp,
        formattedDuration: video.timestamp,
      },
      statistics: {
        viewCount: video.views?.toString() || '0',
      },
    }));
    return NextResponse.json({ results: videos, fromCache: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'yt-search error' }, { status: 500 });
  }
}
