# Phase 5: Claude Summarization - Research

**Researched:** 2026-01-30
**Domain:** Claude API integration, structured outputs, token counting, cost estimation, long document processing
**Confidence:** HIGH

## Summary

Phase 5 integrates Claude API to generate structured summaries from YouTube video transcripts with cost estimation, chunking for long transcripts, and batch processing with progress tracking. The research validates that the Anthropic TypeScript SDK provides production-ready support for structured outputs via Zod schemas, accurate token counting for cost estimation, and robust patterns for handling documents exceeding context limits.

The standard approach uses the official `@anthropic-ai/sdk` with structured outputs for guaranteed JSON schema compliance, the token counting API for pre-request cost estimation, and a map-reduce chunking strategy for transcripts exceeding 50K tokens. For batch processing with progress tracking, React's useReducer pattern with Map-based state management provides efficient O(1) lookups and coordinated multi-property updates.

**Primary recommendation:** Use @anthropic-ai/sdk v0.x with structured outputs (Zod integration), implement map-reduce chunking for transcripts >50K tokens, leverage token counting API for accurate cost estimation, and build batch processor with useReducer for coordinated state management across multiple videos.

## Standard Stack

The established libraries/tools for Claude API integration with structured output processing:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | Latest (0.x) | Official Anthropic TypeScript SDK | First-party support, full type safety, structured outputs, streaming |
| zod | ^4.3.6 | Schema validation and structured output definition | Native integration with Anthropic SDK via zodOutputFormat helper |
| p-limit | ^7.2.0 | Concurrency control for batch processing | Already in use (Phase 4), proven pattern for rate limiting |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk/helpers/zod | Latest | Zod schema to JSON Schema transformer | Required for structured outputs with Zod |
| react (useReducer) | ^19.2.0 | Complex state management for batch processing | Multi-video processing with coordinated status updates |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @anthropic-ai/sdk | Manual fetch() API calls | SDK provides token counting, streaming, type safety, and structured output helpers |
| Zod schemas | Raw JSON Schema | Zod provides type inference, better DX, and automatic validation |
| useReducer | Multiple useState | useReducer better for coordinated multi-property updates across many videos |
| Map-reduce chunking | Single large context | Map-reduce more cost-effective and reliable for 50K+ token transcripts |

**Installation:**
```bash
npm install @anthropic-ai/sdk zod
# p-limit already installed from Phase 4
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── services/
│   ├── claude.service.ts           # Claude API client, token counting, message creation
│   └── summarization.service.ts    # Chunking logic, map-reduce orchestration
├── hooks/
│   └── useSummarization.ts         # Batch processing hook with progress tracking
├── types/
│   └── summary.ts                  # Summary types, Zod schemas, result types
└── components/
    └── features/
        ├── SummaryStatus.tsx       # Per-video status display
        └── CostEstimator.tsx       # Pre-processing cost estimation UI
```

### Pattern 1: Structured Output with Zod

**What:** Use Zod schemas with zodOutputFormat helper to define and validate structured summary responses
**When to use:** All Claude API calls requiring structured JSON output
**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const SummarySchema = z.object({
  title: z.string(),
  key_points: z.array(z.string()),
  topics: z.array(z.string()),
  notable_quotes: z.array(z.object({
    text: z.string(),
    timestamp: z.string().optional(),
  })),
});

type Summary = z.infer<typeof SummarySchema>;

const client = new Anthropic({
  apiKey: userProvidedApiKey,
});

const response = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 4096,
  messages: [{
    role: "user",
    content: `Summarize this video transcript: ${transcript}`
  }],
  output_config: { format: zodOutputFormat(SummarySchema) },
});

// response.content[0].text contains valid JSON matching SummarySchema
const summary: Summary = JSON.parse(response.content[0].text);
```

### Pattern 2: Token Counting for Cost Estimation

**What:** Use messages.countTokens API to estimate costs before processing
**When to use:** Before batch processing begins, to show users expected costs
**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/token-counting
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: userProvidedApiKey });

const tokenCount = await client.messages.countTokens({
  model: 'claude-sonnet-4-5',
  messages: [{
    role: 'user',
    content: transcript
  }]
});

// Pricing for Claude Sonnet 4.5: $3/MTok input, $15/MTok output
const estimatedInputCost = (tokenCount.input_tokens / 1_000_000) * 3;
const estimatedOutputCost = (4096 / 1_000_000) * 15; // Assuming 4K output
const totalCost = estimatedInputCost + estimatedOutputCost;

console.log(`Estimated cost: $${totalCost.toFixed(4)}`);
```

### Pattern 3: Map-Reduce Chunking Strategy

**What:** Split long transcripts into chunks, summarize each chunk, then synthesize a final summary
**When to use:** Transcripts exceeding 50,000 tokens (approx. 1 hour+ videos)
**Example:**
```typescript
// Source: https://cloud.google.com/blog/products/ai-machine-learning/long-document-summarization-with-workflows-and-gemini-models
async function summarizeLongTranscript(
  transcript: string,
  chunkSize: number = 10000
): Promise<Summary> {
  const chunks = splitIntoChunks(transcript, chunkSize, 0.1); // 10% overlap

  // MAP: Summarize each chunk in parallel
  const chunkSummaries = await Promise.all(
    chunks.map(chunk => summarizeChunk(chunk))
  );

  // REDUCE: Synthesize chunk summaries into final summary
  const finalSummary = await synthesizeSummaries(chunkSummaries);

  return finalSummary;
}

function splitIntoChunks(
  text: string,
  chunkSize: number,
  overlapPercent: number
): string[] {
  const tokens = text.split(/\s+/); // Simple word-based tokenization
  const chunks: string[] = [];
  const overlapSize = Math.floor(chunkSize * overlapPercent);

  for (let i = 0; i < tokens.length; i += chunkSize - overlapSize) {
    const chunk = tokens.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
  }

  return chunks;
}
```

### Pattern 4: Batch Processing with useReducer

**What:** Use useReducer to manage complex state transitions for multiple videos
**When to use:** Processing multiple videos with per-video status tracking
**Example:**
```typescript
// Source: https://react.dev/reference/react/useReducer
import { useReducer } from 'react';

type SummaryStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface SummaryState {
  results: Map<string, {
    videoId: string;
    status: SummaryStatus;
    summary?: Summary;
    error?: string;
    cost?: number;
  }>;
  totalCost: number;
  isProcessing: boolean;
}

type SummaryAction =
  | { type: 'START_BATCH'; videoIds: string[] }
  | { type: 'SET_STATUS'; videoId: string; status: SummaryStatus }
  | { type: 'SET_RESULT'; videoId: string; summary: Summary; cost: number }
  | { type: 'SET_ERROR'; videoId: string; error: string }
  | { type: 'COMPLETE_BATCH' };

function summaryReducer(state: SummaryState, action: SummaryAction): SummaryState {
  switch (action.type) {
    case 'START_BATCH': {
      const results = new Map();
      action.videoIds.forEach(id => {
        results.set(id, { videoId: id, status: 'queued' as SummaryStatus });
      });
      return { ...state, results, isProcessing: true, totalCost: 0 };
    }

    case 'SET_STATUS': {
      const results = new Map(state.results);
      const existing = results.get(action.videoId);
      if (existing) {
        results.set(action.videoId, { ...existing, status: action.status });
      }
      return { ...state, results };
    }

    case 'SET_RESULT': {
      const results = new Map(state.results);
      results.set(action.videoId, {
        videoId: action.videoId,
        status: 'completed',
        summary: action.summary,
        cost: action.cost,
      });
      return {
        ...state,
        results,
        totalCost: state.totalCost + action.cost,
      };
    }

    case 'SET_ERROR': {
      const results = new Map(state.results);
      const existing = results.get(action.videoId);
      if (existing) {
        results.set(action.videoId, {
          ...existing,
          status: 'failed',
          error: action.error,
        });
      }
      return { ...state, results };
    }

    case 'COMPLETE_BATCH':
      return { ...state, isProcessing: false };

    default:
      return state;
  }
}

export function useSummarization() {
  const [state, dispatch] = useReducer(summaryReducer, {
    results: new Map(),
    totalCost: 0,
    isProcessing: false,
  });

  // ... implementation

  return { state, dispatch };
}
```

### Pattern 5: Retry Logic with Exponential Backoff

**What:** Retry failed API requests with exponential backoff for transient errors
**When to use:** Claude API calls that may fail due to rate limits or network issues
**Example:**
```typescript
// Source: https://typescript.tv/best-practices/resilient-api-calls-with-ts-retry-promise/
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Retry only on transient errors (rate limit, network, server errors)
      if (error instanceof Anthropic.APIError) {
        const status = error.status;
        if (status === 429 || status === 408 || status >= 500) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      throw error; // Don't retry on client errors
    }
  }

  throw new Error('Max retries exceeded');
}
```

### Anti-Patterns to Avoid

- **Don't hand-roll JSON parsing without schema validation:** Use structured outputs with Zod to guarantee schema compliance
- **Don't estimate costs without token counting API:** Manual token estimation is inaccurate; use official API
- **Don't send entire long transcripts to Claude without chunking:** 50K+ token transcripts risk timeout, high cost, and inconsistent results
- **Don't use multiple useState for batch processing:** useReducer provides better coordination for multi-video state
- **Don't retry all errors:** Only retry transient errors (429, 408, 5xx); client errors (4xx) won't succeed on retry

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Manual JSON.parse + type assertions | Zod + zodOutputFormat | Automatic validation, type inference, transformation of unsupported constraints |
| Token counting | Regex-based character estimation | client.messages.countTokens() | Official API is accurate, handles tools/images/system prompts |
| Retry logic | Manual setTimeout loops | ts-retry-promise or custom exponential backoff | Handles edge cases, configurable, type-safe |
| Long text chunking | Random split at character limit | Semantic chunking with overlap | Preserves context across boundaries, map-reduce pattern proven |
| Cost calculation | Hardcoded per-token rates | Dynamic pricing lookup + token count | Pricing changes over time, handles cache multipliers |

**Key insight:** Claude API provides structured outputs, token counting, and error types specifically designed for production use. Custom solutions miss edge cases (tools token overhead, cache pricing, extended context premium, grammar compilation caching) and lack forward compatibility.

## Common Pitfalls

### Pitfall 1: Ignoring Extended Context Premium Pricing

**What goes wrong:** Transcripts exceeding 200K tokens are automatically charged at 2x input rate ($6/MTok instead of $3/MTok for Sonnet 4.5)
**Why it happens:** Token counting API doesn't warn about extended context pricing threshold
**How to avoid:** Check if input_tokens > 200,000 and apply 2x multiplier to cost estimation
**Warning signs:** Unexpectedly high costs for long videos; actual charges differ significantly from estimates

### Pitfall 2: Structured Output Grammar Compilation Latency

**What goes wrong:** First request with a new schema has significant additional latency (grammar compilation)
**Why it happens:** Structured outputs compile JSON schema into grammar artifacts on first use
**How to avoid:** Cache schemas client-side and reuse exact schema structure; avoid modifying schemas between requests
**Warning signs:** First video in batch takes much longer than subsequent videos

### Pitfall 3: Token Count Estimate Variance

**What goes wrong:** Token counting API returns estimates that may differ from actual usage by small amounts
**Why it happens:** Actual message creation may add system optimization tokens
**How to avoid:** Add 5-10% buffer to cost estimates; use actual usage from response for final billing
**Warning signs:** Users report costs slightly higher than estimates

### Pitfall 4: Inefficient Map-Reduce Chunk Size

**What goes wrong:** Too-small chunks create excessive API calls and synthesis overhead; too-large chunks approach context limits
**Why it happens:** No single optimal chunk size for all transcript types
**How to avoid:** Use 10K-15K token chunks with 10% overlap; validate chunk count < 10 before processing
**Warning signs:** High costs for moderate-length videos; synthesis step produces low-quality summaries

### Pitfall 5: Not Handling stop_reason: "max_tokens"

**What goes wrong:** Summary is cut off mid-sentence when max_tokens reached, violating schema
**Why it happens:** max_tokens set too low for summary complexity
**How to avoid:** Check response.stop_reason === "max_tokens" and retry with higher limit or simplify prompt
**Warning signs:** Invalid JSON in response.content[0].text; parsing errors despite structured outputs

### Pitfall 6: Race Conditions in Batch State Updates

**What goes wrong:** Multiple videos complete simultaneously, causing state update collisions
**Why it happens:** React batching doesn't prevent race conditions in async operations
**How to avoid:** Use useReducer with Map-based results for atomic updates per video
**Warning signs:** Status displays incorrectly; some completed videos not showing results

### Pitfall 7: No User Consent for Estimated Costs

**What goes wrong:** Users surprised by API charges; no way to abort before processing
**Why it happens:** Cost estimation happens after user initiates processing
**How to avoid:** Show estimated cost modal with explicit "Proceed" confirmation before any API calls
**Warning signs:** User complaints about unexpected charges; support tickets about costs

## Code Examples

Verified patterns from official sources:

### Cost Estimation Before Batch Processing

```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/token-counting
import Anthropic from '@anthropic-ai/sdk';

interface CostEstimate {
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  perVideoCost: number;
}

async function estimateBatchCost(
  transcripts: Map<string, string>,
  apiKey: string
): Promise<CostEstimate> {
  const client = new Anthropic({ apiKey });

  // Count tokens for all transcripts in parallel
  const tokenCounts = await Promise.all(
    Array.from(transcripts.entries()).map(async ([videoId, transcript]) => {
      const count = await client.messages.countTokens({
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'user', content: transcript }],
      });
      return count.input_tokens;
    })
  );

  const totalInputTokens = tokenCounts.reduce((sum, count) => sum + count, 0);
  const totalOutputTokens = transcripts.size * 4096; // Assume 4K output per video

  // Pricing: $3/MTok input, $15/MTok output
  const inputCost = (totalInputTokens / 1_000_000) * 3;
  const outputCost = (totalOutputTokens / 1_000_000) * 15;
  const estimatedCost = inputCost + outputCost;

  return {
    totalInputTokens,
    totalOutputTokens,
    estimatedCost,
    perVideoCost: estimatedCost / transcripts.size,
  };
}
```

### Structured Summary with Error Handling

```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const SummarySchema = z.object({
  title: z.string(),
  key_points: z.array(z.string()).min(3).max(10),
  topics: z.array(z.string()).min(1).max(5),
  notable_quotes: z.array(z.object({
    text: z.string(),
    timestamp: z.string().optional(),
  })).max(5),
});

type Summary = z.infer<typeof SummarySchema>;

async function summarizeTranscript(
  transcript: string,
  apiKey: string
): Promise<{ summary: Summary; cost: number }> {
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this YouTube video transcript and provide a structured summary.

Transcript:
${transcript}

Provide:
- A concise, descriptive title
- 3-10 key points (most important takeaways)
- 1-5 main topics covered
- Up to 5 notable quotes with timestamps if available`
      }],
      output_config: { format: zodOutputFormat(SummarySchema) },
    });

    // Check for incomplete output
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Summary incomplete: max_tokens reached');
    }

    // Parse and validate
    const summaryJson = JSON.parse(response.content[0].text);
    const summary = SummarySchema.parse(summaryJson);

    // Calculate cost from usage
    const inputCost = (response.usage.input_tokens / 1_000_000) * 3;
    const outputCost = (response.usage.output_tokens / 1_000_000) * 15;
    const cost = inputCost + outputCost;

    return { summary, cost };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new Error(`Claude API error: ${error.message}`);
    }
    throw error;
  }
}
```

### Map-Reduce for Long Transcripts

```typescript
// Source: https://cloud.google.com/blog/products/ai-machine-learning/long-document-summarization-with-workflows-and-gemini-models
import Anthropic from '@anthropic-ai/sdk';

async function summarizeLongTranscript(
  transcript: string,
  apiKey: string,
  chunkTokenLimit: number = 12000
): Promise<{ summary: Summary; cost: number; wasChunked: boolean }> {
  const client = new Anthropic({ apiKey });

  // Count tokens to determine if chunking is needed
  const tokenCount = await client.messages.countTokens({
    model: 'claude-sonnet-4-5',
    messages: [{ role: 'user', content: transcript }],
  });

  // If under threshold, process directly
  if (tokenCount.input_tokens < chunkTokenLimit) {
    const result = await summarizeTranscript(transcript, apiKey);
    return { ...result, wasChunked: false };
  }

  // Chunking required
  console.log(`Chunking transcript: ${tokenCount.input_tokens} tokens`);

  // Split into chunks (simplified word-based splitting)
  const words = transcript.split(/\s+/);
  const wordsPerChunk = Math.floor((chunkTokenLimit * 0.75) / 1); // Rough 1 word ≈ 1.33 tokens
  const overlapWords = Math.floor(wordsPerChunk * 0.1); // 10% overlap

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ');
    chunks.push(chunk);
  }

  console.log(`Created ${chunks.length} chunks`);

  // MAP: Summarize each chunk
  const chunkSummaries = await Promise.all(
    chunks.map(async (chunk, index) => {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Summarize this section of a video transcript (part ${index + 1}/${chunks.length}):

${chunk}

Provide key points and notable information from this section.`
        }],
      });

      return response.content[0].text;
    })
  );

  // REDUCE: Synthesize into final summary
  const synthesisPrompt = `I have ${chunks.length} partial summaries from a video transcript. Synthesize them into a final structured summary.

Partial summaries:
${chunkSummaries.map((s, i) => `Part ${i + 1}: ${s}`).join('\n\n')}

Provide the final summary.`;

  const finalResult = await summarizeTranscript(synthesisPrompt, apiKey);

  return {
    ...finalResult,
    wasChunked: true,
  };
}
```

### Batch Processing Hook with Progress Tracking

```typescript
// Source: https://react.dev/reference/react/useReducer
import { useReducer, useCallback } from 'react';
import pLimit from 'p-limit';

const CONCURRENCY_LIMIT = 3; // Process 3 videos at a time

export function useSummarization(apiKey: string) {
  const [state, dispatch] = useReducer(summaryReducer, {
    results: new Map(),
    totalCost: 0,
    isProcessing: false,
  });

  const processBatch = useCallback(async (
    transcripts: Map<string, string>
  ) => {
    dispatch({ type: 'START_BATCH', videoIds: Array.from(transcripts.keys()) });

    const limit = pLimit(CONCURRENCY_LIMIT);

    const tasks = Array.from(transcripts.entries()).map(([videoId, transcript]) =>
      limit(async () => {
        dispatch({ type: 'SET_STATUS', videoId, status: 'processing' });

        try {
          const result = await retryWithBackoff(() =>
            summarizeTranscript(transcript, apiKey)
          );

          dispatch({
            type: 'SET_RESULT',
            videoId,
            summary: result.summary,
            cost: result.cost,
          });
        } catch (error) {
          dispatch({
            type: 'SET_ERROR',
            videoId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    await Promise.all(tasks);
    dispatch({ type: 'COMPLETE_BATCH' });
  }, [apiKey]);

  const retry = useCallback(async (videoId: string, transcript: string) => {
    dispatch({ type: 'SET_STATUS', videoId, status: 'processing' });

    try {
      const result = await retryWithBackoff(() =>
        summarizeTranscript(transcript, apiKey)
      );

      dispatch({
        type: 'SET_RESULT',
        videoId,
        summary: result.summary,
        cost: result.cost,
      });
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [apiKey]);

  return {
    results: state.results,
    totalCost: state.totalCost,
    isProcessing: state.isProcessing,
    processBatch,
    retry,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prompt engineering for JSON | Structured outputs with JSON Schema | Oct 2024 | Guaranteed valid JSON, no retries for schema violations |
| Manual token counting | messages.countTokens() API | Available since Claude 3 | Accurate cost estimation including tools/images |
| Raw JSON Schema | Zod + zodOutputFormat | SDK v0.x | Type inference, validation, automatic constraint transformation |
| Single context window | 1M token context window (beta) | Q4 2024 | Can process very long videos, but premium pricing (2x) |
| Naive chunking | Map-reduce with overlap | Industry pattern | Better coherence, parallel processing |

**Deprecated/outdated:**
- **@anthropic-ai/tokenizer package:** No longer accurate for Claude 3+ models; use messages.countTokens() API instead
- **output_format parameter:** Moved to output_config.format in recent API version
- **Beta headers for structured outputs:** No longer required; feature is generally available

## Revenue Considerations

**Phase revenue impact:** Critical path to MVP — summarization is the core value proposition

**Speed to revenue tradeoffs:**

| Decision | Fast Option | "Right" Option | Recommendation | Rationale |
|----------|-------------|----------------|----------------|-----------|
| Chunking strategy | Skip chunking for MVP | Map-reduce for all long transcripts | Implement chunking | Blocker identified in STATE.md; long videos common use case |
| Cost estimation UI | Show after processing | Show before with confirmation | Show before | Builds user trust, prevents surprise charges |
| Retry failed videos | Manual retry button only | Automatic retry with exponential backoff | Manual retry + auto for transient | Balance reliability and user control |
| Model selection | Sonnet 4.5 hardcoded | User chooses (Haiku/Sonnet/Opus) | Sonnet 4.5 only for v1 | Simplifies UX, balances cost and quality |
| Batch processing | Sequential processing | Full map-reduce parallelization | Parallel with p-limit (3 concurrent) | Fast enough, respects rate limits |

**Monetization architecture notes:**
- User-provided API keys means no server-side Claude costs (zero marginal cost for us)
- Could add "premium" tier with our API key for users who don't want to set up their own
- Usage tracking already built in via response.usage object (can display to users)
- Cost estimation builds trust, reduces friction for freemium conversion

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal chunk size for map-reduce**
   - What we know: 10K-15K tokens per chunk with 10% overlap is common pattern
   - What's unclear: Whether this is optimal for YouTube transcripts (often have time-based structure)
   - Recommendation: Start with 12K token chunks, iterate based on quality metrics

2. **Handling grammar compilation latency in UI**
   - What we know: First request with new schema has extra latency (grammar compilation); cached for 24h
   - What's unclear: Whether to pre-warm cache or show loading state
   - Recommendation: Show "Initializing..." state for first video only, document in UI

3. **Extended context window beta access**
   - What we know: 1M context window in beta for tier 4 users only
   - What's unclear: When general availability, whether we should design for it now
   - Recommendation: Design assuming 200K limit, add 1M support later if needed

4. **Summary quality evaluation**
   - What we know: Structured outputs guarantee schema compliance
   - What's unclear: How to measure summary quality (completeness, accuracy, usefulness)
   - Recommendation: Manual review during MVP, consider eval framework post-launch

## Sources

### Primary (HIGH confidence)

- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Official SDK, installation, API reference
- [Structured outputs documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) - JSON outputs, Zod integration, examples
- [Token counting documentation](https://platform.claude.com/docs/en/build-with-claude/token-counting) - API usage, TypeScript examples, accuracy notes
- [Pricing documentation](https://platform.claude.com/docs/en/about-claude/pricing) - Current pricing, extended context premium, batch discounts
- [Context windows documentation](https://platform.claude.com/docs/en/build-with-claude/context-windows) - 200K standard, 1M beta, premium pricing

### Secondary (MEDIUM confidence)

- [Google Cloud: Long document summarization with workflows](https://cloud.google.com/blog/products/ai-machine-learning/long-document-summarization-with-workflows-and-gemini-models) - Map-reduce pattern, chunk sizes
- [Zod official documentation](https://zod.dev/) - Schema validation best practices
- [React useReducer documentation](https://react.dev/reference/react/useReducer) - Complex state management patterns
- [TypeScript retry patterns](https://typescript.tv/best-practices/resilient-api-calls-with-ts-retry-promise/) - Exponential backoff, error handling

### Tertiary (LOW confidence)

- [Claude API Pricing Guide 2026](https://www.aifreeapi.com/en/posts/claude-api-pricing-per-million-tokens) - WebSearch, third-party pricing breakdown
- [LLM Summarization Strategies](https://galileo.ai/blog/llm-summarization-strategies) - WebSearch, general summarization patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK, documented API, proven libraries (Zod, p-limit)
- Architecture: HIGH - Official docs provide TypeScript examples, patterns validated in official SDK
- Pitfalls: MEDIUM - Some inferred from API docs, others from general LLM best practices
- Revenue impact: HIGH - Clear critical path, monetization opportunities identified

**Research date:** 2026-01-30
**Valid until:** 30 days (2026-03-01) — API stable, but pricing may change
