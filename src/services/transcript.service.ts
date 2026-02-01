import pLimit from 'p-limit';
import type { TranscriptResult } from '@/types/transcript';

const CONCURRENT_LIMIT = 2;
const STAGGER_DELAY_MS = 500;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;
const PROXY_BASE = '/api/transcripts';
const WHISPER_BASE = '/api/transcribe-whisper';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTranscripts(
  videoIds: string[],
  lang: string = 'en'
): Promise<TranscriptResult[]> {
  const limit = pLimit(CONCURRENT_LIMIT);

  const tasks = videoIds.map((videoId, index) =>
    limit(async () => {
      // Stagger requests to avoid bursting
      if (index > 0) {
        await delay(STAGGER_DELAY_MS * (index % CONCURRENT_LIMIT));
      }
      return fetchSingleTranscript(videoId, lang);
    })
  );

  return Promise.all(tasks);
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
    const isRateLimited = response.status === 429 || errorMsg.includes('429');
    if (isRateLimited && retries > 0) {
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
