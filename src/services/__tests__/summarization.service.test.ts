import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  splitIntoChunks,
  estimateCost,
  estimateBatchCost,
  summarizeVideo,
} from '../summarization.service';
import * as claudeService from '../claude.service';
import type { CostBreakdown, SummarizeVideoResult } from '../summarization.service';

describe('SummarizationService', () => {
  describe('splitIntoChunks', () => {
    it('returns single chunk for short text (100 words)', () => {
      const shortText = 'word '.repeat(100).trim();
      const chunks = splitIntoChunks(shortText, 9000, 0.10);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(shortText);
    });

    it('returns 2 chunks with overlap for medium text (15K words)', () => {
      const mediumText = 'word '.repeat(15000).trim();
      const chunks = splitIntoChunks(mediumText, 9000, 0.10);

      expect(chunks).toHaveLength(2);
      expect(chunks.length).toBeGreaterThan(1);

      // Verify overlap: last 10% of chunk 1 should appear at start of chunk 2
      const words1 = chunks[0].split(/\s+/);
      const words2 = chunks[1].split(/\s+/);
      const overlapSize = Math.floor(words1.length * 0.10);
      const chunk1End = words1.slice(-overlapSize).join(' ');
      const chunk2Start = words2.slice(0, overlapSize).join(' ');

      expect(chunk2Start).toBe(chunk1End);
    });

    it('returns 5 chunks for long text (40K words)', () => {
      const longText = 'word '.repeat(40000).trim();
      const chunks = splitIntoChunks(longText, 9000, 0.10);

      expect(chunks).toHaveLength(5);
    });

    it('returns single empty chunk for empty text', () => {
      const chunks = splitIntoChunks('', 9000, 0.10);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('');
    });

    it('never splits mid-word (splits on whitespace boundaries)', () => {
      const text = 'The quick brown fox jumps over the lazy dog. ' + 'word '.repeat(9000);
      const chunks = splitIntoChunks(text, 9000, 0.10);

      // Check that no chunk starts or ends with a partial word
      chunks.forEach((chunk) => {
        if (chunk.length > 0) {
          // Should not start with whitespace (trimmed)
          expect(chunk[0]).not.toBe(' ');
          // Should not end with whitespace (trimmed)
          expect(chunk[chunk.length - 1]).not.toBe(' ');
          // Should be complete words
          expect(chunk.split(/\s+/).every((word) => word.length > 0)).toBe(true);
        }
      });
    });

    it('handles single word input', () => {
      const chunks = splitIntoChunks('hello', 9000, 0.10);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('hello');
    });
  });

  describe('estimateCost', () => {
    it('calculates correct cost for 1000 tokens', () => {
      const result = estimateCost(1000);

      expect(result.inputCost).toBeCloseTo(0.003, 6); // (1000 / 1M) * $3
      expect(result.outputCost).toBeCloseTo(0.06144, 5); // (4096 / 1M) * $15
      expect(result.totalCost).toBeCloseTo(0.06444, 5); // 0.003 + 0.06144
      expect(result.totalWithBuffer).toBeCloseTo(0.070884, 6); // 0.06444 * 1.10
    });

    it('calculates correct cost for 100000 tokens', () => {
      const result = estimateCost(100000);

      expect(result.inputCost).toBeCloseTo(0.3, 6); // (100000 / 1M) * $3
      expect(result.outputCost).toBeCloseTo(0.06144, 5); // (4096 / 1M) * $15
      expect(result.totalCost).toBeCloseTo(0.36144, 5); // 0.3 + 0.06144
      expect(result.totalWithBuffer).toBeCloseTo(0.397584, 6); // 0.36144 * 1.10
    });

    it('multiplies output cost by (chunkCount + 1) for chunked transcripts', () => {
      const chunkCount = 5;
      const result = estimateCost(100000, chunkCount);

      // Output cost should be multiplied by (5 + 1) = 6
      // Each chunk gets summarized (5 outputs) + 1 final reduce
      const expectedOutputCost = (4096 / 1_000_000) * 15 * (chunkCount + 1);
      expect(result.outputCost).toBeCloseTo(expectedOutputCost, 5);

      // Total includes input + multiplied output, with buffer
      const expectedTotal = result.inputCost + result.outputCost;
      expect(result.totalCost).toBeCloseTo(expectedTotal, 5);
      expect(result.totalWithBuffer).toBeCloseTo(expectedTotal * 1.10, 6);
    });

    it('includes buffer in totalWithBuffer', () => {
      const result = estimateCost(50000);

      expect(result.totalWithBuffer).toBeCloseTo(result.totalCost * 1.10, 6);
    });
  });

  describe('estimateBatchCost', () => {
    it('aggregates costs for multiple videos correctly', () => {
      const transcriptTokenCounts = new Map([
        ['video1', 10000],
        ['video2', 20000],
        ['video3', 30000],
      ]);

      const result = estimateBatchCost(transcriptTokenCounts);

      expect(result.estimates).toHaveLength(3);
      expect(result.totalInputTokens).toBe(60000);
      expect(result.totalEstimatedCost).toBeGreaterThan(0);
      expect(result.videosNeedingChunking).toBe(0); // All under 50K threshold
    });

    it('identifies videos needing chunking', () => {
      const transcriptTokenCounts = new Map([
        ['video1', 10000],   // Under threshold
        ['video2', 60000],   // Over threshold
        ['video3', 100000],  // Over threshold
      ]);

      const result = estimateBatchCost(transcriptTokenCounts);

      expect(result.videosNeedingChunking).toBe(2);
      expect(result.estimates[0].needsChunking).toBe(false);
      expect(result.estimates[1].needsChunking).toBe(true);
      expect(result.estimates[2].needsChunking).toBe(true);
    });

    it('calculates per-video estimates with correct fields', () => {
      const transcriptTokenCounts = new Map([
        ['video1', 25000],
      ]);

      const result = estimateBatchCost(transcriptTokenCounts);

      expect(result.estimates).toHaveLength(1);
      const estimate = result.estimates[0];

      expect(estimate.videoId).toBe('video1');
      expect(estimate.inputTokens).toBe(25000);
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.needsChunking).toBe(false);
    });

    it('sums total estimated cost with buffer', () => {
      const transcriptTokenCounts = new Map([
        ['video1', 10000],
        ['video2', 20000],
      ]);

      const result = estimateBatchCost(transcriptTokenCounts);

      // Verify total is sum of individual estimates
      const sumOfEstimates = result.estimates.reduce(
        (sum, est) => sum + est.estimatedCost,
        0
      );
      expect(result.totalEstimatedCost).toBeCloseTo(sumOfEstimates, 6);
    });

    it('handles empty map gracefully', () => {
      const transcriptTokenCounts = new Map<string, number>();

      const result = estimateBatchCost(transcriptTokenCounts);

      expect(result.estimates).toHaveLength(0);
      expect(result.totalInputTokens).toBe(0);
      expect(result.totalEstimatedCost).toBe(0);
      expect(result.videosNeedingChunking).toBe(0);
    });
  });

  describe('summarizeVideo', () => {
    let mockCountTranscriptTokens: ReturnType<typeof vi.fn>;
    let mockSummarizeTranscript: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockCountTranscriptTokens = vi.fn();
      mockSummarizeTranscript = vi.fn();

      vi.spyOn(claudeService, 'countTranscriptTokens').mockImplementation(
        mockCountTranscriptTokens
      );
      vi.spyOn(claudeService, 'summarizeTranscript').mockImplementation(
        mockSummarizeTranscript
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls summarizeTranscript directly for transcripts under threshold', async () => {
      const transcript = 'Short transcript text';
      const apiKey = 'test-api-key';

      mockCountTranscriptTokens.mockResolvedValue({ inputTokens: 10000 });
      mockSummarizeTranscript.mockResolvedValue({
        summary: { title: 'Test', key_points: ['a', 'b', 'c'], topics: ['topic'], notable_quotes: [] },
        inputTokens: 10000,
        outputTokens: 500,
        cost: 0.05,
      });

      const result = await summarizeVideo(transcript, apiKey);

      expect(mockCountTranscriptTokens).toHaveBeenCalledWith(transcript, apiKey);
      expect(mockSummarizeTranscript).toHaveBeenCalledTimes(1);
      expect(mockSummarizeTranscript).toHaveBeenCalledWith(transcript, apiKey);
      expect(result.wasChunked).toBe(false);
      expect(result.summary).toBeDefined();
      expect(result.cost).toBe(0.05);
    });

    it('uses chunking path for transcripts over threshold', async () => {
      const longTranscript = 'word '.repeat(50000); // Long transcript (creates 7 chunks)
      const apiKey = 'test-api-key';

      mockCountTranscriptTokens.mockResolvedValue({ inputTokens: 60000 });

      // Mock 7 chunk summaries (map phase) + 1 final reduce
      for (let i = 0; i < 7; i++) {
        mockSummarizeTranscript.mockResolvedValueOnce({
          summary: { title: `Chunk ${i + 1}`, key_points: ['a'], topics: ['t1'], notable_quotes: [] },
          inputTokens: 12000,
          outputTokens: 200,
          cost: 0.04,
        });
      }

      // Mock final reduce summary
      mockSummarizeTranscript.mockResolvedValueOnce({
        summary: { title: 'Final', key_points: ['a', 'b', 'c'], topics: ['t1', 't2'], notable_quotes: [] },
        inputTokens: 400,
        outputTokens: 500,
        cost: 0.01,
      });

      const result = await summarizeVideo(longTranscript, apiKey);

      expect(mockCountTranscriptTokens).toHaveBeenCalledWith(longTranscript, apiKey);
      expect(mockSummarizeTranscript).toHaveBeenCalledTimes(8); // 7 chunks + 1 reduce
      expect(result.wasChunked).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.title).toBe('Final');
    });

    it('aggregates costs correctly for chunked transcripts', async () => {
      const longTranscript = 'word '.repeat(50000); // Creates 7 chunks
      const apiKey = 'test-api-key';

      mockCountTranscriptTokens.mockResolvedValue({ inputTokens: 60000 });

      // Mock 7 chunk summaries
      for (let i = 0; i < 7; i++) {
        mockSummarizeTranscript.mockResolvedValueOnce({
          summary: { title: `C${i + 1}`, key_points: ['a'], topics: ['t'], notable_quotes: [] },
          inputTokens: 12000,
          outputTokens: 200,
          cost: 0.04,
        });
      }

      // Mock final reduce
      mockSummarizeTranscript.mockResolvedValueOnce({
        summary: { title: 'Final', key_points: ['a', 'b'], topics: ['t'], notable_quotes: [] },
        inputTokens: 400,
        outputTokens: 500,
        cost: 0.01,
      });

      const result = await summarizeVideo(longTranscript, apiKey);

      // Total cost should be sum of all API calls (7 chunks * 0.04 + 1 reduce * 0.01)
      expect(result.cost).toBeCloseTo(0.29, 2); // 7 * 0.04 + 0.01 = 0.29
      // Input tokens should be sum of all inputs
      expect(result.inputTokens).toBe(7 * 12000 + 400);
      // Output tokens should be sum of all outputs
      expect(result.outputTokens).toBe(7 * 200 + 500);
    });

    it('returns result with all required fields', async () => {
      const transcript = 'Test transcript';
      const apiKey = 'test-api-key';

      mockCountTranscriptTokens.mockResolvedValue({ inputTokens: 5000 });
      mockSummarizeTranscript.mockResolvedValue({
        summary: { title: 'Test', key_points: ['a', 'b', 'c'], topics: ['topic'], notable_quotes: [] },
        inputTokens: 5000,
        outputTokens: 300,
        cost: 0.02,
      });

      const result = await summarizeVideo(transcript, apiKey);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('inputTokens');
      expect(result).toHaveProperty('outputTokens');
      expect(result).toHaveProperty('wasChunked');
    });
  });
});
