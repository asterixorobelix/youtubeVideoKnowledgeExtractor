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

export async function extractCaptions(
  videoId: string,
  lang: string = 'en'
): Promise<string> {
  // Step 1: Get caption tracks via Innertube ANDROID player API
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

  const tracks =
    playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!tracks || tracks.length === 0) {
    throw new Error('No captions available for this video');
  }

  // Step 2: Find the best matching track
  const track =
    tracks.find((t: { languageCode: string }) => t.languageCode === lang) ||
    tracks.find((t: { kind: string }) => t.kind === 'asr') ||
    tracks[0];

  // Step 3: Fetch caption XML
  const captionResponse = await fetch(track.baseUrl);

  if (!captionResponse.ok) {
    throw new Error(`Caption fetch returned ${captionResponse.status}`);
  }

  const xml = await captionResponse.text();

  if (!xml) {
    throw new Error('Empty caption response');
  }

  // Step 4: Parse XML to plain text
  const transcript = parseCaptionXml(xml);

  if (!transcript) {
    throw new Error('No captions available for this video');
  }

  return transcript;
}
