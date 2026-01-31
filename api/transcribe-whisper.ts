import { fetchPlayerResponse, getAudioStreamUrl } from './lib/extract-captions';

export const config = { runtime: 'nodejs', maxDuration: 60 };

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit

export default async function handler(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const { videoId, openaiKey, lang } = await request.json();

    if (!videoId || !openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing videoId or openaiKey' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get audio stream URL from YouTube
    const playerData = await fetchPlayerResponse(videoId);
    const audioUrl = getAudioStreamUrl(playerData);

    // Download audio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();

    if (audioBuffer.byteLength > MAX_AUDIO_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Audio file too large (${Math.round(audioBuffer.byteLength / 1024 / 1024)}MB). Whisper limit is 25MB.`,
        }),
        { status: 413, headers: corsHeaders }
      );
    }

    // Send to Whisper API
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/mp4' }), 'audio.m4a');
    formData.append('model', 'whisper-1');
    if (lang) {
      formData.append('language', lang);
    }
    formData.append('response_format', 'text');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorBody = await whisperResponse.text();
      let errorMessage = `Whisper API error: ${whisperResponse.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        errorMessage = parsed?.error?.message || errorMessage;
      } catch {
        // use default message
      }
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: whisperResponse.status, headers: corsHeaders }
      );
    }

    const transcript = await whisperResponse.text();

    return new Response(
      JSON.stringify({ success: true, transcript: transcript.trim(), source: 'whisper' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: corsHeaders }
    );
  }
}
