import { SummarySchema } from '@/types/summary';
import type { Summary } from '@/types/summary';
import {
  INPUT_PRICE_PER_MTOK,
  OUTPUT_PRICE_PER_MTOK,
} from '@/types/summary';

const PROXY_BASE = '/api/summarize';

export interface SummarizeResult {
  summary: Summary;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface TokenCountResult {
  inputTokens: number;
}

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;

    // Only retry on transient errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const shouldRetry =
        message.includes('429') ||
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('408') ||
        message.includes('5');

      if (!shouldRetry) throw error;
    }

    // Exponential backoff
    const delay = BASE_DELAY_MS * Math.pow(2, MAX_RETRIES - retries);
    await new Promise((resolve) => setTimeout(resolve, delay));

    return retryWithBackoff(fn, retries - 1);
  }
}

/**
 * Summarize a video transcript using Claude API
 */
export async function summarizeTranscript(
  transcript: string,
  apiKey: string
): Promise<SummarizeResult> {
  return retryWithBackoff(async () => {
    const response = await fetch(PROXY_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        apiKey,
        action: 'summarize',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: Failed to summarize`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Summarization failed');
    }

    // Validate response with Zod schema (client-side validation)
    let summary: Summary;
    try {
      summary = SummarySchema.parse(data.summary);
    } catch (zodError) {
      throw new Error(`Invalid summary format: ${zodError}`);
    }

    // Calculate cost
    const inputTokens = data.usage.input_tokens;
    const outputTokens = data.usage.output_tokens;
    const cost =
      (inputTokens / 1_000_000) * INPUT_PRICE_PER_MTOK +
      (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MTOK;

    return {
      summary,
      inputTokens,
      outputTokens,
      cost,
    };
  });
}

/**
 * Count tokens in a transcript for cost estimation
 */
export async function countTranscriptTokens(
  transcript: string,
  apiKey: string
): Promise<TokenCountResult> {
  return retryWithBackoff(async () => {
    const response = await fetch(PROXY_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        apiKey,
        action: 'count-tokens',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: Failed to count tokens`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Token counting failed');
    }

    return {
      inputTokens: data.inputTokens,
    };
  });
}
