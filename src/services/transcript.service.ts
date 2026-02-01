import type { TranscriptResult } from '@/types/transcript';

const DELAY_BETWEEN_MS = 1500;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 10000;
const PROXY_BASE = '/api/transcripts';
const WHISPER_BASE = '/api/transcribe-whisper';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTranscripts(
  videoIds: string[],
  lang: string = 'en',
  onProgress?: (result: TranscriptResult) => void
): Promise<TranscriptResult[]> {
  const results: TranscriptResult[] = [];
  for (const videoId of videoIds) {
    if (results.length > 0) {
      await delay(DELAY_BETWEEN_MS);
    }
    const result = await fetchSingleTranscript(videoId, lang);
    results.push(result);
    onProgress?.(result);
  }
  return results;
}

export async function fetchSingleTranscript(
  videoId: string,
  lang: string = 'en',
  retries: number = MAX_RETRIES
): Promise<TranscriptResult> {
  try {
    const response = await fetch(
      `${PROXY_BASE}?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`
    );
    const data = await response.json();

    if (response.ok && data.success) {
      return { videoId, status: 'success', transcript: data.transcript, source: 'captions' as const };
    }

    const errorMsg = data.error || 'Failed to extract captions';

    // Retry on rate limit (429) with exponential backoff
    if (response.status === 429 && retries > 0) {
      const backoff = BASE_BACKOFF_MS * Math.pow(2, MAX_RETRIES - retries);
      await delay(backoff);
      return fetchSingleTranscript(videoId, lang, retries - 1);
    }

    const noCaptions = errorMsg.toLowerCase().includes('no captions') || errorMsg.toLowerCase().includes('not available');
    return { videoId, status: 'error', error: errorMsg, noCaptions };
  } catch {
    return { videoId, status: 'error', error: 'Network error' };
  }
}

export async function whisperTranscribe(
  videoId: string,
  openaiKey: string,
  lang: string = 'en'
): Promise<TranscriptResult> {
  try {
    const response = await fetch(WHISPER_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, openaiKey, lang }),
    });
    const data = await response.json();

    if (response.ok && data.success) {
      return { videoId, status: 'success', transcript: data.transcript, source: 'whisper' };
    }
    return { videoId, status: 'error', error: data.error || 'Whisper transcription failed' };
  } catch {
    return { videoId, status: 'error', error: 'Network error' };
  }
}
