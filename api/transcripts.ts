import { extractCaptions } from './lib/extract-captions';

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

    // Extract captions with timeout
    const transcript = await Promise.race([
      extractCaptions(videoId, lang),
      timeoutPromise,
    ]);

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

    if (errorMessage === 'Request timeout') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Request timed out after 15 seconds',
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 404, headers: corsHeaders }
    );
  }
}
