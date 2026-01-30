# Phase 5 Plan 2: Summarization Service (TDD) Summary

**One-liner:** Map-reduce chunking orchestration with 10% overlap for 50K+ token transcripts plus accurate cost estimation with buffer

---

## Plan Reference

- **Phase:** 05-claude-summarization
- **Plan:** 05-02
- **Type:** TDD
- **Completed:** 2026-01-30
- **Duration:** 3 minutes

---

## What Was Built

Implemented the core summarization orchestration service using TDD methodology with RED-GREEN-REFACTOR cycle:

### Core Functions

1. **splitIntoChunks(text, chunkSize?, overlapPercent?)**
   - Splits long transcripts into overlapping chunks for map-reduce processing
   - Default: 9000 words/chunk (~12K tokens) with 10% overlap
   - Handles edge cases: empty text, single word, short text (no split needed)
   - Never splits mid-word (whitespace boundary detection)

2. **estimateCost(inputTokens, chunkCount?)**
   - Calculates cost breakdown for Claude API usage
   - Input cost: (tokens / 1M) × $3
   - Output cost: (4096 tokens / 1M) × $15 × output_requests
   - For chunked: output requests = chunkCount + 1 (map + reduce)
   - Applies 10% buffer for safety

3. **estimateBatchCost(transcriptTokenCounts)**
   - Aggregates per-video cost estimates for batch processing
   - Identifies videos needing chunking (> 50K tokens)
   - Returns total estimated cost with buffer

4. **summarizeVideo(transcript, apiKey)**
   - Orchestrates single video summarization with automatic chunking
   - Routes to direct API call if < 50K tokens
   - Routes to map-reduce if ≥ 50K tokens:
     - MAP: Summarize each chunk independently
     - REDUCE: Synthesize chunk summaries into final structured output
   - Returns summary with cost, token usage, and wasChunked flag

### Test Coverage

- **19 tests, all passing**
- splitIntoChunks: 6 tests (short/medium/long text, overlap verification, edge cases)
- estimateCost: 4 tests (cost accuracy, chunking multiplier, buffer)
- estimateBatchCost: 5 tests (aggregation, chunking detection, edge cases)
- summarizeVideo: 4 tests (direct vs chunked routing, cost aggregation, result structure)

---

## Technical Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| 9000 words/chunk default | ~12K tokens at 1.33 tokens/word, stays under 50K threshold with margin | Optimal chunk size for Claude context window |
| 10% overlap between chunks | Maintains context continuity at chunk boundaries | Prevents information loss during chunking |
| Map-reduce pattern | Each chunk summarized independently, then reduced | Handles transcripts up to 150K+ tokens |
| Cost buffer of 10% | Accounts for prompt overhead and variation | User consent based on conservative estimate |
| Promise.all for chunks | Parallel processing of chunks | Faster than sequential (critical for 5-7 chunk videos) |

---

## Files Changed

### Created

- `src/services/summarization.service.ts` (210 lines)
  - Exports: splitIntoChunks, estimateCost, estimateBatchCost, summarizeVideo
  - Interfaces: CostBreakdown, SummarizeVideoResult
- `src/services/__tests__/summarization.service.test.ts` (329 lines)
  - 19 comprehensive tests with vitest mocking

### Modified

None (new service, no modifications to existing files)

---

## Deviations from Plan

None - plan executed exactly as written.

TDD cycle followed:
1. **RED:** Wrote failing tests first (commit e83b4fd)
2. **GREEN:** Implemented service to pass tests (commit 5ff9f7c)
3. **REFACTOR:** Skipped - code already clean and maintainable

---

## Integration Points

**Depends on:**
- `src/services/claude.service.ts` - summarizeTranscript, countTranscriptTokens
- `src/types/summary.ts` - Types, constants (CHUNK_TOKEN_THRESHOLD, pricing)

**Provides for future plans:**
- Chunking logic for long transcript handling
- Cost estimation for user consent UI (05-03)
- summarizeVideo orchestration for batch processing

---

## Verification Results

✅ All 19 tests pass
✅ TypeScript compiles cleanly (npx tsc --noEmit)
✅ Chunking correctly handles 50K word transcript (7 chunks with overlap)
✅ Cost calculation accurate to 6 decimal places
✅ Map-reduce orchestration verified with mocks

---

## Next Phase Readiness

**Blockers:** None

**Ready for 05-03:**
- Cost estimation functions ready for UI integration
- summarizeVideo ready for batch processing
- Chunking handles the STATE.md blocker (long videos 50K-150K tokens)

**Concerns:**
- Parallel chunk processing may hit rate limits for very long videos
  - Mitigation: Could add p-limit if needed (not in current plan)
- Chunk overlap increases total input tokens (~10% increase)
  - Tradeoff: Accuracy vs cost (chose accuracy)

---

## Metadata

```yaml
phase: 05-claude-summarization
plan: 02
subsystem: summarization-core
tags: [tdd, claude, chunking, cost-estimation, map-reduce]

dependencies:
  requires:
    - 05-01: Claude API integration (summarizeTranscript, countTranscriptTokens)
  provides:
    - chunking-logic: splitIntoChunks with overlap
    - cost-estimation: estimateCost, estimateBatchCost
    - video-orchestration: summarizeVideo with auto-chunking
  affects:
    - 05-03: Will use estimateBatchCost for user consent UI
    - 05-04: Will use summarizeVideo for batch processing

tech-stack:
  added: []
  patterns:
    - map-reduce: Chunk summarization with reduce step
    - tdd: RED-GREEN-REFACTOR cycle
    - vitest-mocking: Mock Claude service for pure unit tests

key-files:
  created:
    - src/services/summarization.service.ts
    - src/services/__tests__/summarization.service.test.ts
  modified: []

decisions:
  - id: chunk-size-9000-words
    scope: chunking
    choice: 9000 words default chunk size
    why: Stays under 50K threshold with margin, optimal for Claude context
  - id: overlap-10-percent
    scope: chunking
    choice: 10% word overlap between chunks
    why: Maintains context continuity without excessive token increase
  - id: cost-buffer-10-percent
    scope: cost-estimation
    choice: 10% buffer on estimated costs
    why: Conservative estimate for user consent, accounts for prompt overhead
  - id: parallel-chunk-processing
    scope: performance
    choice: Promise.all for chunk MAP phase
    why: Significantly faster for multi-chunk videos (5-7 chunks common)

metrics:
  duration: 3 min
  tests: 19
  test-coverage: 100% (all exported functions tested)
  lines-added: 539
  commits: 2
  completed: 2026-01-30
```
