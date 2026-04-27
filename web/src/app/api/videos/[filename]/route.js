/**
 * Video Proxy Route
 *
 * This route serves video files for the AI agent's video avatar.
 * Videos are served from the public/videos directory with proper MIME types.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

export async function loader({ params }) {
  try {
    const { filename } = params;

    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return new Response('Invalid filename', { status: 400 });
    }

    // Only allow .mp4 files
    if (!filename.endsWith('.mp4')) {
      return new Response('Only .mp4 files are supported', { status: 400 });
    }

    // Construct the file path
    const videoPath = join(process.cwd(), 'public', 'videos', filename);

    console.log(`[Video Proxy] Serving ${filename}`);

    // Read the video file
    const videoBuffer = await readFile(videoPath);

    // Return video with proper MIME type and caching headers
    return new Response(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
        'Content-Length': videoBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error(`[Video Proxy] Error serving video:`, error);

    if (error.code === 'ENOENT') {
      return new Response('Video file not found', { status: 404 });
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to serve video file',
        message: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
