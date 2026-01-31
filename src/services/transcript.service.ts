import pLimit from 'p-limit';
import type { TranscriptResult } from '@/types/transcript';

const CONCURRENT_LIMIT = 5;
const PROXY_BASE = '/api/transcripts';
const WHISPER_BASE = '/api/transcribe-whisper';

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
      return { videoId, status: 'success', transcript: data.transcript, source: 'captions' as const };
    }
    const errorMsg = data.error || 'Failed to extract captions';
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
