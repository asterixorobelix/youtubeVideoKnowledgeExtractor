import {
  summarizeTranscript,
  countTranscriptTokens,
} from './claude.service';
import type { Summary } from '@/types/summary';
import {
  CHUNK_TOKEN_THRESHOLD,
  INPUT_PRICE_PER_MTOK,
  OUTPUT_PRICE_PER_MTOK,
  MAX_OUTPUT_TOKENS,
  COST_BUFFER_PERCENT,
} from '@/types/summary';
import type { CostEstimate, BatchCostEstimate } from '@/types/summary';

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  totalWithBuffer: number;
}

export interface SummarizeVideoResult {
  summary: Summary;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  wasChunked: boolean;
}

/**
 * Split text into chunks with overlap for map-reduce summarization
 * @param text - Text to split
 * @param chunkSize - Target size in words (default 9000 ≈ 12K tokens)
 * @param overlapPercent - Overlap between chunks (default 0.10 = 10%)
 * @returns Array of chunk strings
 */
export function splitIntoChunks(
  text: string,
  chunkSize: number = 9000,
  overlapPercent: number = 0.10
): string[] {
  if (text === '') {
    return [''];
  }

  const words = text.split(/\s+/);

  if (words.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const overlapWords = Math.floor(chunkSize * overlapPercent);
  let startIdx = 0;

  while (startIdx < words.length) {
    const endIdx = Math.min(startIdx + chunkSize, words.length);
    const chunk = words.slice(startIdx, endIdx).join(' ').trim();
    chunks.push(chunk);

    // Move forward by chunkSize minus overlap
    startIdx += chunkSize - overlapWords;

    // Break if we've covered all words
    if (endIdx >= words.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Estimate cost for summarizing a transcript
 * @param inputTokens - Number of input tokens
 * @param chunkCount - Number of chunks (for chunked transcripts)
 * @returns Cost breakdown
 */
export function estimateCost(
  inputTokens: number,
  chunkCount: number = 1
): CostBreakdown {
  // Input cost: tokens consumed
  const inputCost = (inputTokens / 1_000_000) * INPUT_PRICE_PER_MTOK;

  // Output cost: max output tokens per request
  // For chunked: (chunkCount map requests + 1 reduce request)
  const outputRequests = chunkCount > 1 ? chunkCount + 1 : 1;
  const outputCost = (MAX_OUTPUT_TOKENS / 1_000_000) * OUTPUT_PRICE_PER_MTOK * outputRequests;

  const totalCost = inputCost + outputCost;
  const totalWithBuffer = totalCost * (1 + COST_BUFFER_PERCENT);

  return {
    inputCost,
    outputCost,
    totalCost,
    totalWithBuffer,
  };
}

/**
 * Estimate batch cost for multiple videos
 * @param transcriptTokenCounts - Map of videoId to token count
 * @returns Batch cost estimate with per-video breakdown
 */
export function estimateBatchCost(
  transcriptTokenCounts: Map<string, number>
): BatchCostEstimate {
  const estimates: CostEstimate[] = [];
  let totalInputTokens = 0;
  let videosNeedingChunking = 0;

  for (const [videoId, inputTokens] of transcriptTokenCounts) {
    const needsChunking = inputTokens > CHUNK_TOKEN_THRESHOLD;

    // Calculate chunk count if needed
    const chunkCount = needsChunking
      ? Math.ceil(inputTokens / (9000 * 1.33)) // 9000 words ≈ 12K tokens
      : 1;

    const costBreakdown = estimateCost(inputTokens, chunkCount);

    estimates.push({
      videoId,
      inputTokens,
      estimatedCost: costBreakdown.totalWithBuffer,
      needsChunking,
    });

    totalInputTokens += inputTokens;
    if (needsChunking) {
      videosNeedingChunking++;
    }
  }

  const totalEstimatedCost = estimates.reduce(
    (sum, est) => sum + est.estimatedCost,
    0
  );

  return {
    estimates,
    totalInputTokens,
    totalEstimatedCost,
    videosNeedingChunking,
  };
}

/**
 * Summarize a video transcript with automatic chunking for long transcripts
 * @param transcript - Full transcript text
 * @param apiKey - Claude API key
 * @returns Summary result with cost and token usage
 */
export async function summarizeVideo(
  transcript: string,
  apiKey: string
): Promise<SummarizeVideoResult> {
  // Count tokens to determine if chunking is needed
  const { inputTokens } = await countTranscriptTokens(transcript, apiKey);

  // Direct summarization for short transcripts
  if (inputTokens < CHUNK_TOKEN_THRESHOLD) {
    const result = await summarizeTranscript(transcript, apiKey);
    return {
      summary: result.summary,
      cost: result.cost,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      wasChunked: false,
    };
  }

  // Chunked summarization for long transcripts (map-reduce)
  const chunks = splitIntoChunks(transcript);

  // MAP: Summarize each chunk
  const chunkSummaries = await Promise.all(
    chunks.map(async (chunk) => {
      const result = await summarizeTranscript(chunk, apiKey);
      return result;
    })
  );

  // Aggregate chunk summaries into a single text for REDUCE
  const combinedChunkSummaries = chunkSummaries
    .map((result, idx) => {
      const summary = result.summary;
      return `## Chunk ${idx + 1}\n\nTitle: ${summary.title}\n\nKey Points:\n${summary.key_points.map(p => `- ${p}`).join('\n')}\n\nTopics: ${summary.topics.join(', ')}\n\nQuotes:\n${summary.notable_quotes.map(q => `- "${q.text}"${q.context ? ` (${q.context})` : ''}`).join('\n')}`;
    })
    .join('\n\n');

  // REDUCE: Synthesize chunk summaries into final structured summary
  const finalResult = await summarizeTranscript(combinedChunkSummaries, apiKey);

  // Aggregate costs and token usage
  const totalCost = chunkSummaries.reduce((sum, r) => sum + r.cost, 0) + finalResult.cost;
  const totalInputTokens = chunkSummaries.reduce((sum, r) => sum + r.inputTokens, 0) + finalResult.inputTokens;
  const totalOutputTokens = chunkSummaries.reduce((sum, r) => sum + r.outputTokens, 0) + finalResult.outputTokens;

  return {
    summary: finalResult.summary,
    cost: totalCost,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    wasChunked: true,
  };
}
