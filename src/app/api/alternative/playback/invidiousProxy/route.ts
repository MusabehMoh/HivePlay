import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Choose a public Invidious instance
const INVIDIOUS_INSTANCE = 'https://invidious.lunar.icu'; // Changed from vid.puffyan.us

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return new Response('Missing videoId', { status: 400 });
  }

  try {
    // 1. Fetch video info from Invidious API
    const invidiousUrl = `${INVIDIOUS_INSTANCE}/api/v1/videos/${videoId}`;
    const invidiousRes = await fetch(invidiousUrl);

    if (!invidiousRes.ok) {
      throw new Error(`Invidious API error: ${invidiousRes.statusText}`);
    }

    const videoInfo = await invidiousRes.json();

    // 2. Find the best audio stream URL (prefer opus or aac)
    let audioUrl: string | null = null;
    let audioMimeType = 'audio/mp4'; // Default

    // Look in adaptiveFormats first (usually higher quality)
    if (videoInfo.adaptiveFormats) {
      const audioFormat = videoInfo.adaptiveFormats
        .filter((f: any) => f.type?.startsWith('audio/'))
        .sort((a: any, b: any) => (b.audioSampleRate || 0) - (a.audioSampleRate || 0)) // Sort by sample rate desc
        .find((f: any) => f.encoding === 'opus' || f.encoding === 'aac'); // Prefer opus or aac
      
      if (audioFormat) {
        audioUrl = audioFormat.url;
        audioMimeType = audioFormat.type || audioMimeType;
      }
    }

    // Fallback to formatStreams if no adaptive audio found
    if (!audioUrl && videoInfo.formatStreams) {
       const audioFormat = videoInfo.formatStreams
        .filter((f: any) => f.type?.startsWith('audio/'))
        .sort((a: any, b: any) => (b.audioSampleRate || 0) - (a.audioSampleRate || 0))
        .find((f: any) => f.encoding === 'opus' || f.encoding === 'aac');

      if (audioFormat) {
        audioUrl = audioFormat.url;
        audioMimeType = audioFormat.type || audioMimeType;
      }
    }
    
    // Fallback: Try any audio format if specific ones not found
    if (!audioUrl) {
        const anyAudioFormat = [...(videoInfo.adaptiveFormats || []), ...(videoInfo.formatStreams || [])]
            .filter((f: any) => f.url && f.type?.startsWith('audio/'))
            .sort((a: any, b: any) => (b.audioSampleRate || 0) - (a.audioSampleRate || 0))[0];
        if (anyAudioFormat) {
            audioUrl = anyAudioFormat.url;
            audioMimeType = anyAudioFormat.type || audioMimeType;
        }
    }

    if (!audioUrl) {
      throw new Error('No suitable audio stream found from Invidious');
    }

    // 3. Proxy the audio stream
    console.log(`[InvidiousProxy] Streaming from: ${audioUrl.substring(0, 100)}...`);
    const audioRes = await fetch(audioUrl);

    if (!audioRes.ok || !audioRes.body) {
      throw new Error(`Failed to fetch audio stream: ${audioRes.statusText}`);
    }

    // Return the stream directly
    return new Response(audioRes.body, {
      headers: {
        'Content-Type': audioMimeType,
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache', // Prevent caching of the stream itself
      },
    });

  } catch (err: any) {
    console.error('[InvidiousProxy] Error:', err);
    return new Response(`Proxy error: ${err.message || 'Unknown error'}`, { status: 500 });
  }
}
