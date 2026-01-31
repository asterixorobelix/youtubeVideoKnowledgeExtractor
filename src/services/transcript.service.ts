import pLimit from 'p-limit';
import type { TranscriptResult } from '@/types/transcript';

const CONCURRENT_LIMIT = 5;
const PROXY_BASE = '/api/transcripts';

export async function fetchTranscripts(
  videoIds: string[],
  lang: string = 'en'
): Promise<TranscriptResult[]> {
  const limit = pLimit(CONCURRENT_LIMIT);

  const tasks = videoIds.map((videoId) =>
    limit(() => fetchSingleTranscript(videoId, lang))
  );

  return Promise.all(tasks);
}

export async function fetchSingleTranscript(
  videoId: string,
  lang: string = 'en'
): Promise<TranscriptResult> {
  try {
    const response = await fetch(
      `${PROXY_BASE}?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`
    );
    const data = await response.json();

    if (response.ok && data.success) {
      return { videoId, status: 'success', transcript: data.transcript };
    }
    return { videoId, status: 'error', error: data.error || 'Failed to extract captions' };
  } catch {
    return { videoId, status: 'error', error: 'Network error' };
  }
}
