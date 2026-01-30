import { z } from 'zod';

// Zod schema for Claude's structured output
export const SummarySchema = z.object({
  title: z.string(),
  key_points: z.array(z.string()).min(3).max(10),
  topics: z.array(z.string()).min(1).max(5),
  notable_quotes: z.array(z.object({
    text: z.string(),
    context: z.string().optional(),
  })).max(5),
});

// Inferred TypeScript type from Zod schema
export type Summary = z.infer<typeof SummarySchema>;

// Summary status (mirrors TranscriptStatus pattern)
export type SummaryStatus = 'queued' | 'estimating' | 'processing' | 'completed' | 'failed';

// Summary result interface (mirrors TranscriptResult pattern)
export interface SummaryResult {
  videoId: string;
  status: SummaryStatus;
  summary?: Summary;
  error?: string;
  cost?: number;           // Actual API cost in USD
  inputTokens?: number;    // Tokens consumed
  outputTokens?: number;
}

// Cost estimation interfaces
export interface CostEstimate {
  videoId: string;
  inputTokens: number;
  estimatedCost: number;   // USD
  needsChunking: boolean;  // True if > CHUNK_THRESHOLD tokens
}

export interface BatchCostEstimate {
  estimates: CostEstimate[];
  totalInputTokens: number;
  totalEstimatedCost: number;  // Includes 10% buffer
  videosNeedingChunking: number;
}

// Claude API constants
export const CLAUDE_MODEL = 'claude-sonnet-4-5-20250514';
export const MAX_OUTPUT_TOKENS = 4096;
export const INPUT_PRICE_PER_MTOK = 3;    // $3/MTok
export const OUTPUT_PRICE_PER_MTOK = 15;   // $15/MTok
export const COST_BUFFER_PERCENT = 0.10;   // 10% buffer
export const CHUNK_TOKEN_THRESHOLD = 50000; // Chunk transcripts above this
