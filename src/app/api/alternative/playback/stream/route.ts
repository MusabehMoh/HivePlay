import { NextRequest } from 'next/server';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');
  if (!videoId) {
    return new Response('Missing videoId', { status: 400 });
  }

  const ytDlp = spawn('yt-dlp', [
    '-f', '140',           // m4a audio
    '-o', '-',             // output to stdout
    '--quiet',             // suppress logs
    '--no-playlist',       // single video only
    `https://www.youtube.com/watch?v=${videoId}`
  ]);
  console.log('[yt-dlp] Spawned yt-dlp process for videoId:', videoId);

  const stream = new ReadableStream({
    start(controller) {
      ytDlp.stdout.on('data', (chunk) => {
        console.log('[yt-dlp] Streaming chunk of size:', chunk.length);
        controller.enqueue(chunk);
      });
      ytDlp.stdout.on('end', () => controller.close());
      ytDlp.stderr.on('data', (data) => console.error('yt-dlp error:', data.toString()));
      ytDlp.on('close', (code) => {
        console.log('[yt-dlp] Process exited with code:', code);
        if (code !== 0) {
          controller.error(new Error(`yt-dlp exited with code ${code}`));
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'audio/mp4',
      'Transfer-Encoding': 'chunked'
    }
  });
}
