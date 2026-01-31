const INNERTUBE_PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';

const ANDROID_CONTEXT = {
  client: {
    clientName: 'ANDROID',
    clientVersion: '19.29.37',
    androidSdkVersion: 34,
    hl: 'en',
    gl: 'US',
  },
};

const ANDROID_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip',
  'X-Youtube-Client-Name': '3',
  'X-Youtube-Client-Version': '19.29.37',
};

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function parseCaptionXml(xml: string): string {
  // Format 3 uses <p> tags with <s> segment children
  const paragraphs = [...xml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)];

  const texts = paragraphs.map((p) => {
    const content = p[1];
    // Extract text from <s> segments
    const segments = [...content.matchAll(/<s[^>]*>([\s\S]*?)<\/s>/g)];
    if (segments.length > 0) {
      return segments.map((s) => s[1]).join('');
    }
    // Or direct text content (strip remaining tags)
    return content.replace(/<[^>]*>/g, '');
  }).filter((t) => t.trim());

  return decodeXmlEntities(
    texts.join(' ').replace(/\s+/g, ' ').trim()
  );
}

export async function fetchPlayerResponse(videoId: string): Promise<Record<string, unknown>> {
  const playerResponse = await fetch(INNERTUBE_PLAYER_URL, {
    method: 'POST',
    headers: ANDROID_HEADERS,
    body: JSON.stringify({
      context: ANDROID_CONTEXT,
      videoId,
    }),
  });

  if (!playerResponse.ok) {
    throw new Error(`Player API returned ${playerResponse.status}`);
  }

  const playerData = await playerResponse.json();

  if (playerData?.playabilityStatus?.status !== 'OK') {
    throw new Error(
      playerData?.playabilityStatus?.reason || 'Video is not available'
    );
  }

  return playerData;
}

export function getAudioStreamUrl(playerData: Record<string, unknown>): string {
  const streamingData = playerData?.streamingData as Record<string, unknown> | undefined;
  const adaptiveFormats = streamingData?.adaptiveFormats as Array<Record<string, unknown>> | undefined;

  if (!adaptiveFormats) {
    throw new Error('No streaming data available');
  }

  // Find audio-only streams, prefer lowest bitrate to stay under 25MB
  const audioStreams = adaptiveFormats
    .filter((f) => {
      const mimeType = f.mimeType as string | undefined;
      return mimeType?.startsWith('audio/');
    })
    .sort((a, b) => ((a.bitrate as number) || 0) - ((b.bitrate as number) || 0));

  if (audioStreams.length === 0) {
    throw new Error('No audio streams available');
  }

  const url = audioStreams[0].url as string | undefined;
  if (!url) {
    throw new Error('Audio stream URL not available (may require deciphering)');
  }

  return url;
}

export async function extractCaptions(
  videoId: string,
  lang: string = 'en'
): Promise<string> {
  const playerData = await fetchPlayerResponse(videoId);

  const tracks =
    (playerData?.captions as Record<string, unknown>)?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined;
  const captionTracks = tracks?.captionTracks as Array<Record<string, unknown>> | undefined;

  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('No captions available for this video');
  }

  // Find the best matching track
  const track =
    captionTracks.find((t) => t.languageCode === lang) ||
    captionTracks.find((t) => t.kind === 'asr') ||
    captionTracks[0];

  // Fetch caption XML
  const captionResponse = await fetch(track.baseUrl as string);

  if (!captionResponse.ok) {
    throw new Error(`Caption fetch returned ${captionResponse.status}`);
  }

  const xml = await captionResponse.text();

  if (!xml) {
    throw new Error('Empty caption response');
  }

  // Parse XML to plain text
  const transcript = parseCaptionXml(xml);

  if (!transcript) {
    throw new Error('No captions available for this video');
  }

  return transcript;
}
