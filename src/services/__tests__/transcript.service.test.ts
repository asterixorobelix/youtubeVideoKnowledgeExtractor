import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { fetchTranscripts } from '../transcript.service';

describe('TranscriptService', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchTranscripts returns success result with transcript text for valid video', async () => {
    const videoId = 'test123';
    const transcriptText = 'hello world';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        videoId,
        success: true,
        transcript: transcriptText
      })
    });

    const results = await fetchTranscripts([videoId]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      videoId,
      status: 'success',
      transcript: transcriptText,
      source: 'captions',
    });
  });

  it('fetchTranscripts returns error result for video without captions', async () => {
    const videoId = 'nocaptions';
    const errorMessage = 'No captions available';

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        videoId,
        success: false,
        error: errorMessage
      })
    });

    const results = await fetchTranscripts([videoId]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      videoId,
      status: 'error',
      error: errorMessage,
      noCaptions: true,
    });
  });

  it('fetchTranscripts handles network errors gracefully', async () => {
    const videoId = 'networkerror';

    mockFetch.mockRejectedValueOnce(new Error('Network failed'));

    const results = await fetchTranscripts([videoId]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      videoId,
      status: 'error',
      error: 'Network error'
    });
  });

  it('fetchTranscripts processes multiple videos and returns results for each', async () => {
    const videoIds = ['video1', 'video2', 'video3'];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ videoId: 'video1', success: true, transcript: 'text1' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ videoId: 'video2', success: true, transcript: 'text2' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ videoId: 'video3', success: true, transcript: 'text3' })
      });

    const results = await fetchTranscripts(videoIds);

    expect(results).toHaveLength(3);
    expect(results[0].videoId).toBe('video1');
    expect(results[1].videoId).toBe('video2');
    expect(results[2].videoId).toBe('video3');
    expect(results.every(r => r.status === 'success')).toBe(true);
    expect(results.every(r => r.source === 'captions')).toBe(true);
  });

  it('fetchTranscripts limits concurrency to 5', async () => {
    const videoIds = Array.from({ length: 10 }, (_, i) => `video${i}`);
    let currentConcurrent = 0;
    let maxConcurrent = 0;

    mockFetch.mockImplementation(async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

      // Simulate async delay
      await new Promise(resolve => setTimeout(resolve, 10));

      currentConcurrent--;

      return {
        ok: true,
        json: async () => ({ success: true, transcript: 'test' })
      };
    });

    await fetchTranscripts(videoIds);

    expect(maxConcurrent).toBeLessThanOrEqual(5);
    expect(maxConcurrent).toBeGreaterThan(1); // Verify it actually ran concurrently
  });

  it('fetchTranscripts calls correct proxy URL with videoId', async () => {
    const videoId = 'testVideoId123';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ videoId, success: true, transcript: 'test' })
    });

    await fetchTranscripts([videoId]);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/transcripts')
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`videoId=${videoId}`)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('lang=en')
    );
  });
});
