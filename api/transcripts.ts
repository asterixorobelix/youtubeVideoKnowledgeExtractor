import { getSubtitles } from 'youtube-caption-extractor';

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  // CORS headers for local dev
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const lang = searchParams.get('lang') || 'en';

    // Validate videoId
    if (!videoId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing videoId parameter',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 15000);
    });

    // Fetch subtitles with timeout
    const subtitles = await Promise.race([
      getSubtitles({ videoID: videoId, lang }),
      timeoutPromise,
    ]);

    // Join subtitle text segments
    const transcript = subtitles
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return new Response(
      JSON.stringify({
        videoId,
        success: true,
        transcript,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Differentiate timeout from no captions
    if (errorMessage === 'Request timeout') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Request timed out after 15 seconds',
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // No captions available or other caption extraction error
    return new Response(
      JSON.stringify({
        success: false,
        error: 'No captions available',
      }),
      { status: 404, headers: corsHeaders }
    );
  }
}
