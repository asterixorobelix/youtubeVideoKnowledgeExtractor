---
phase: 04
plan: 01
subsystem: api
tags: [vercel, edge-function, youtube, captions, cors, proxy]
requires:
  - 03-02 # Video selection UI complete
provides:
  - Vercel Edge Function at /api/transcripts
  - CORS-enabled YouTube caption extraction proxy
  - Error handling for missing captions and timeouts
affects:
  - 04-02 # TranscriptService will consume this API
tech-stack:
  added:
    - youtube-caption-extractor@1.9.1
  patterns:
    - Vercel Edge Functions
    - Promise.race for timeout handling
    - CORS proxy pattern
key-files:
  created:
    - api/transcripts.ts
    - vercel.json
  modified:
    - vite.config.ts
key-decisions:
  - decision: Use Vercel Edge Functions for transcript proxy
    rationale: "YouTube caption URLs lack CORS headers, edge function bypasses browser restrictions"
    alternatives: ["Client-side CORS proxy services", "Server-side Node.js API"]
    impact: "Serverless, globally distributed, zero infrastructure management"
  - decision: 15-second timeout for caption extraction
    rationale: "Balance between waiting for slow responses and user experience"
    alternatives: ["30 seconds", "10 seconds", "No timeout"]
    impact: "Prevents hanging requests, fails fast for unavailable captions"
duration: 64s
completed: 2026-01-30
---

# Phase 4 Plan 1: Transcript Extraction API Summary

**One-liner:** Vercel Edge Function proxy for YouTube caption extraction with CORS support, 15s timeout, and comprehensive error handling.

## Performance

**Duration:** 64 seconds (2026-01-30T05:15:22Z to 2026-01-30T05:16:26Z)

**Tasks completed:** 1/1
**Files created:** 2
**Files modified:** 1

## Accomplishments

Created a production-ready Vercel Edge Function that:

1. **Proxies YouTube caption extraction** - Bypasses CORS restrictions by fetching captions server-side
2. **Handles multiple error scenarios** - Differentiates missing videoId (400), no captions (404), timeout (500)
3. **Implements timeout protection** - 15-second timeout using Promise.race prevents hanging requests
4. **Enables local development** - CORS headers allow browser-based testing
5. **Configures SPA routing** - vercel.json rewrites ensure both API and client routes work correctly

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install youtube-caption-extractor and create Edge Function | 8424758 | api/transcripts.ts, vercel.json, vite.config.ts |

## Files Created

**api/transcripts.ts** - Vercel Edge Function handler
- Exports default async handler and config with runtime: 'edge'
- Validates videoId parameter (returns 400 if missing)
- Accepts optional lang parameter (defaults to 'en')
- Calls getSubtitles from youtube-caption-extractor
- Joins subtitle text segments with space normalization
- Implements 15-second timeout using Promise.race
- Returns JSON with { videoId, success, transcript } or { success, error }
- Includes CORS headers for local development
- Differentiates timeout errors from no-caption errors

**vercel.json** - Vercel deployment configuration
- Routes /api/** to Edge Functions
- Rewrites all non-API, non-asset routes to /index.html for SPA support

## Files Modified

**vite.config.ts**
- Fixed import from 'vite' to 'vitest/config' to support test configuration
- Resolves TypeScript compilation error

## Decisions Made

1. **Edge Function vs. serverless function**: Chose Edge Functions for global distribution and low latency
2. **15-second timeout**: Balances user experience (don't wait too long) with caption availability (some videos are slow)
3. **Error granularity**: Three distinct error types (400 missing param, 404 no captions, 500 timeout) for better client-side handling
4. **CORS headers**: Allow-all origin for development flexibility (production will be same-origin)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vite.config.ts TypeScript compilation error**
- **Found during:** Task 1 verification (npm run build)
- **Issue:** vite.config.ts imported from 'vite' instead of 'vitest/config', causing TypeScript error for test configuration
- **Fix:** Changed import to 'vitest/config' which supports both Vite and Vitest configuration types
- **Files modified:** vite.config.ts
- **Commit:** 8424758 (included with main task)

## Issues Encountered

None beyond the vite.config.ts TypeScript error (resolved).

## Next Phase Readiness

**Blockers:** None

**Ready for:**
- 04-02: TranscriptService implementation can now call /api/transcripts
- Client-side integration with API key validation and error handling

**Concerns:**
- Rate limiting: Edge Function has no rate limiting yet (future enhancement)
- Caching: No caching of transcripts (future enhancement for performance)
- Language selection: Defaults to 'en', client should expose lang parameter if needed

**Verification needed:**
- Manual testing with real YouTube video IDs
- Test with video without captions to verify 404 response
- Test timeout behavior with network throttling or slow video

## Notes

The Edge Function is ready for deployment to Vercel. Local testing requires Vercel CLI or deployment to preview/production environment, as Vite dev server doesn't execute Edge Functions.

For local development workflow:
1. Run `vercel dev` instead of `vite dev` to test Edge Functions locally
2. Or deploy to Vercel preview environment for integration testing

The youtube-caption-extractor library handles caption URL resolution and fetching internally, making the implementation very concise.
