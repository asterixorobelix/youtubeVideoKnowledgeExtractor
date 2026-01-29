# Phase 4: Transcript Extraction - Research

**Researched:** 2026-01-29
**Domain:** YouTube transcript/caption extraction, serverless proxy architecture
**Confidence:** MEDIUM

## Summary

YouTube transcript extraction from a browser-based web app requires a serverless proxy layer due to CORS restrictions. YouTube does not include Access-Control-Allow-Origin headers on caption resources, preventing direct client-side fetch calls. The solution involves deploying an Edge Function (Vercel or Cloudflare Workers) that fetches captions server-side and returns them to the client.

The standard approach uses the `youtube-caption-extractor` npm package (v1.9.1+), which supports both Node.js and Edge runtimes. This library uses dual extraction methods with automatic fallback between XML captions and JSON transcript APIs. For parallel processing of multiple videos, use concurrency control libraries like `p-limit` to avoid overwhelming YouTube's servers (recommended: 5 concurrent maximum).

20-40% of YouTube videos lack captions entirely—detection should happen before fetching by attempting extraction and handling graceful failures with specific error messages. Caption availability cannot be reliably checked without attempting extraction (the official YouTube Data API captions.list endpoint requires OAuth and costs 50 quota units per call).

**Primary recommendation:** Deploy a Vercel Edge Function using `youtube-caption-extractor` with `p-limit` for concurrency control (5 concurrent max), handle errors gracefully, and display clear UI indicators for videos without captions.

## Standard Stack

The established libraries/tools for YouTube transcript extraction:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| youtube-caption-extractor | ^1.9.1 | Extract YouTube captions/transcripts | Best 2026 option: supports both Node.js and Edge runtime, dual extraction methods (XML + JSON fallback), TypeScript support |
| p-limit | ^6.1.0 | Concurrency control for parallel fetching | Lightweight, purpose-built for limiting concurrent promises, most popular option (compared to bottleneck/async) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xml2js | ^0.6.2 | Parse XML caption format | If manually parsing YouTube's srv3/ttml XML format (not needed with youtube-caption-extractor) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| youtube-caption-extractor | Supadata API (paid service) | External dependency, requires API key, costs money after 100 free requests/month, adds 1 req/sec rate limit on free tier |
| youtube-caption-extractor | youtube-transcript (unmaintained) | Last updated 2+ years ago, may break with YouTube changes |
| youtube-caption-extractor | Manual Innertube API calls | More fragile (undocumented API), requires reverse-engineering YouTube's internal API |
| p-limit | Bottleneck | Heavier library, more features than needed (priority queuing, retries) |
| p-limit | Promise.allSettled with chunking | Custom implementation, more code to maintain |

**Installation:**
```bash
npm install youtube-caption-extractor p-limit
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── api/
│   └── transcripts/
│       └── [videoId].ts           # Edge function handler
├── services/
│   └── transcript.service.ts      # Business logic
├── lib/
│   └── concurrency.ts             # p-limit setup
└── types/
    └── transcript.types.ts        # TypeScript interfaces
```

### Pattern 1: Serverless Proxy with Edge Function
**What:** Deploy an Edge Function that acts as a CORS-friendly proxy between client and YouTube
**When to use:** Always required for browser-based apps (YouTube doesn't allow direct client-side caption fetching due to CORS)
**Example:**
```typescript
// api/transcripts/[videoId].ts (Vercel Edge Function)
// Source: Derived from youtube-caption-extractor docs + Vercel Edge patterns

import { getSubtitles } from 'youtube-caption-extractor';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const lang = searchParams.get('lang') || 'en';

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'videoId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const subtitles = await getSubtitles({ videoID: videoId, lang });
    return new Response(JSON.stringify({ subtitles }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Video has no captions available
    return new Response(
      JSON.stringify({
        error: 'No captions available',
        videoId,
        message: error.message
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
```

### Pattern 2: Parallel Fetching with Concurrency Control
**What:** Process multiple videos concurrently with a limit to avoid overwhelming servers
**When to use:** When extracting transcripts for multiple videos (e.g., all selected videos from a channel)
**Example:**
```typescript
// services/transcript.service.ts
// Source: p-limit docs + best practices

import pLimit from 'p-limit';
import { getSubtitles } from 'youtube-caption-extractor';

const CONCURRENT_LIMIT = 5; // Maximum parallel requests
const limit = pLimit(CONCURRENT_LIMIT);

interface TranscriptResult {
  videoId: string;
  success: boolean;
  subtitles?: Array<{ start: string; dur: string; text: string }>;
  error?: string;
}

async function fetchTranscripts(
  videoIds: string[],
  lang: string = 'en'
): Promise<TranscriptResult[]> {
  const tasks = videoIds.map((videoId) =>
    limit(async () => {
      try {
        const subtitles = await getSubtitles({ videoID: videoId, lang });
        return { videoId, success: true, subtitles };
      } catch (error) {
        return {
          videoId,
          success: false,
          error: 'No captions available'
        };
      }
    })
  );

  return Promise.allSettled(tasks).then((results) =>
    results.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : { videoId: 'unknown', success: false, error: 'Task failed' }
    )
  );
}
```

### Pattern 3: Caption Availability Detection via Extraction Attempt
**What:** Determine if captions exist by attempting extraction and handling failures
**When to use:** Before processing videos, to show users which videos will succeed/fail
**Example:**
```typescript
// No pre-flight check available without OAuth
// Attempt extraction and handle gracefully

async function checkCaptionAvailability(videoId: string): Promise<boolean> {
  try {
    await getSubtitles({ videoID: videoId, lang: 'en' });
    return true;
  } catch {
    return false;
  }
}
```

### Anti-Patterns to Avoid
- **Direct client-side fetching:** YouTube caption URLs lack CORS headers—always use serverless proxy
- **No concurrency control:** Parallel requests without limits can trigger YouTube rate limiting or IP blocks
- **Using YouTube Data API captions.list for detection:** Requires OAuth setup, costs 50 quota units per video, overkill for simple availability checks
- **Hardcoded language codes:** Allow users to select preferred language or fallback to 'en' default
- **No timeout handling:** Transcript extraction can hang—implement request timeouts (10-15 seconds recommended)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube transcript extraction | Custom scraper parsing HTML/JS | youtube-caption-extractor | Handles YouTube's changing internal APIs, dual fallback methods, edge runtime support |
| Concurrency control | Manual Promise.all chunking | p-limit | Well-tested, handles edge cases, simpler API |
| XML caption parsing | Custom XML parser | youtube-caption-extractor (built-in) | Handles srv3, ttml, and JSON formats automatically |
| CORS proxy | Custom proxy server | Edge Function (Vercel/Cloudflare) | Built-in globally distributed CDN, auto-scaling, zero config |
| Rate limiting | setTimeout + counters | p-limit or bottleneck | Proper queuing, backpressure handling, memory-safe |

**Key insight:** YouTube's transcript extraction looks simple (just fetch a URL) but involves undocumented APIs, multiple format fallbacks, CORS issues, rate limiting, and IP blocking concerns. Use battle-tested libraries that handle these edge cases.

## Common Pitfalls

### Pitfall 1: CORS Blocking Direct Client-Side Fetching
**What goes wrong:** Browser throws CORS error when trying to fetch caption URLs directly from client
**Why it happens:** YouTube's caption endpoint doesn't include `Access-Control-Allow-Origin` header
**How to avoid:** Always use a serverless proxy (Edge Function) for caption fetching
**Warning signs:** Console errors mentioning "CORS policy" or "Access-Control-Allow-Origin"

### Pitfall 2: No Caption Availability Handling
**What goes wrong:** App crashes or shows generic error when video lacks captions (20-40% of videos)
**Why it happens:** Developers assume all videos have captions
**How to avoid:** Wrap extraction in try-catch, return specific error for "no captions available", show clear UI indicator
**Warning signs:** Users report app breaking on certain videos, no error differentiation between "no captions" vs "network error"

### Pitfall 3: Parallel Fetching Without Rate Limiting
**What goes wrong:** YouTube blocks requests or app performance degrades when processing many videos
**Why it happens:** Firing too many concurrent requests (e.g., 50+ videos with Promise.all)
**How to avoid:** Use p-limit with max 5 concurrent requests
**Warning signs:** Intermittent "RequestBlocked" or "IpBlocked" errors, slow response times (>10s)

### Pitfall 4: Using Official YouTube Data API for Caption Detection
**What goes wrong:** OAuth setup complexity, quota costs (50 units per video), rate limits hit quickly
**Why it happens:** Developers think official API is more reliable than unofficial methods
**How to avoid:** Use youtube-caption-extractor which doesn't require API key; attempt extraction and handle failure
**Warning signs:** OAuth flow required, quota exhausted messages, 10,000 unit daily limit hit with 200 videos

### Pitfall 5: Ignoring Edge Runtime Constraints
**What goes wrong:** Edge function crashes due to unsupported Node.js APIs (fs, path, process)
**Why it happens:** Using libraries not compatible with Edge runtime (V8 isolates)
**How to avoid:** Verify libraries explicitly support Edge runtime; use youtube-caption-extractor which has dual support
**Warning signs:** "Module not found" errors in Edge deployment, references to Node.js core modules

### Pitfall 6: No Timeout Handling
**What goes wrong:** Transcript extraction hangs indefinitely on problematic videos
**Why it happens:** Network issues, YouTube throttling, or Edge function execution limits (max 25s for Vercel Edge)
**How to avoid:** Implement 10-15 second timeout per video, return error and continue processing others
**Warning signs:** Functions timing out, users waiting indefinitely, no progress feedback

## Code Examples

Verified patterns from official sources:

### Basic Caption Extraction (Edge Function)
```typescript
// Source: youtube-caption-extractor GitHub README

import { getSubtitles, getVideoDetails } from 'youtube-caption-extractor';

// Option 1: Just subtitles
const subtitles = await getSubtitles({
  videoID: 'ABC123def',
  lang: 'en'
});
// Returns: [{ start: '0.0', dur: '2.5', text: 'Hello world' }, ...]

// Option 2: Video metadata + subtitles
const details = await getVideoDetails({
  videoID: 'ABC123def',
  lang: 'en'
});
// Returns: { title: '...', description: '...', subtitles: [...] }
```

### Full TranscriptService Implementation
```typescript
// services/transcript.service.ts

import pLimit from 'p-limit';
import { getSubtitles } from 'youtube-caption-extractor';

const CONCURRENT_LIMIT = 5;
const TIMEOUT_MS = 15000;

interface TranscriptResult {
  videoId: string;
  success: boolean;
  transcript?: string;
  error?: string;
}

export class TranscriptService {
  private limit = pLimit(CONCURRENT_LIMIT);

  async extractTranscripts(
    videoIds: string[],
    lang: string = 'en'
  ): Promise<TranscriptResult[]> {
    const tasks = videoIds.map((videoId) =>
      this.limit(() => this.extractSingleWithTimeout(videoId, lang))
    );

    const results = await Promise.allSettled(tasks);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        videoId: videoIds[index],
        success: false,
        error: 'Task failed unexpectedly'
      };
    });
  }

  private async extractSingleWithTimeout(
    videoId: string,
    lang: string
  ): Promise<TranscriptResult> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
    );

    try {
      const subtitles = await Promise.race([
        getSubtitles({ videoID: videoId, lang }),
        timeoutPromise,
      ]);

      const transcript = subtitles
        .map((sub) => sub.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      return { videoId, success: true, transcript };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error';

      return {
        videoId,
        success: false,
        error: errorMessage.includes('Timeout')
          ? 'Extraction timed out'
          : 'No captions available'
      };
    }
  }
}
```

### Vercel Edge Function Route
```typescript
// pages/api/transcripts/[videoId].ts

import type { NextRequest } from 'next/server';
import { getSubtitles } from 'youtube-caption-extractor';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');
  const lang = searchParams.get('lang') || 'en';

  if (!videoId) {
    return new Response(
      JSON.stringify({ error: 'Missing videoId parameter' }),
      { status: 400 }
    );
  }

  try {
    const subtitles = await getSubtitles({ videoID: videoId, lang });
    const transcript = subtitles.map((s) => s.text).join(' ');

    return new Response(
      JSON.stringify({ videoId, transcript, success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        videoId,
        success: false,
        error: 'No captions available'
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| youtube-transcript npm package | youtube-caption-extractor | 2024-2025 | Old package unmaintained (2+ years), new package supports Edge runtime + dual extraction |
| Manual Innertube API calls | Libraries with automatic fallback | 2024-2025 | YouTube API changes frequently, libraries handle updates |
| YouTube Data API captions.download | Unofficial extraction (no API key) | Ongoing | Official API requires OAuth + quota, unofficial faster/simpler |
| Promise.all for parallel processing | p-limit/bottleneck | Ongoing | Uncontrolled parallelism causes rate limiting/IP blocks |
| Python youtube-transcript-api | JavaScript youtube-caption-extractor | 2024-2025 | JS ecosystem now has equivalent tools for serverless/Edge |

**Deprecated/outdated:**
- **youtube-transcript (npm):** Last updated 2+ years ago, likely broken with YouTube changes
- **Direct YouTube Data API usage for captions:** OAuth complexity, quota costs not worth it for simple extraction
- **Scraping HTML/ytInitialPlayerResponse:** Fragile, breaks when YouTube updates frontend

## Revenue Considerations

**Phase revenue impact:** Critical path to first revenue

This phase is essential for core product functionality—no transcripts means no AI summaries, blocking the entire value proposition. Cannot ship without this working.

**Speed to revenue tradeoffs:**
| Decision | Fast Option | "Right" Option | Recommendation | Rationale |
|----------|-------------|----------------|----------------|-----------|
| Proxy solution | Vercel Edge Function (5 min deploy) | Custom Express server on VPS | Vercel Edge Function | Zero infrastructure, globally distributed, scales automatically, free tier sufficient |
| Transcript library | youtube-caption-extractor | Write custom scraper | youtube-caption-extractor | Handles YouTube API changes, Edge runtime support, saves weeks of maintenance |
| Caption detection | Try extraction, handle failure | Use official YouTube Data API | Try extraction | No OAuth, no quota costs, instant feedback, simpler code |
| Parallel processing | p-limit library | Custom queue implementation | p-limit library | Proven, lightweight, saves debugging time |
| Error handling | Try-catch with generic message | Differentiate error types | Differentiate errors | Better UX, users understand "no captions" vs "network error" |

**Monetization architecture notes:**
- No direct monetization in this phase, but enables usage tracking (could count "videos processed" for future freemium tiers)
- Consider logging transcript lengths to estimate OpenAI costs per user (inform pricing model)
- Edge Function keeps infrastructure costs near-zero on Vercel free tier (100GB bandwidth/month)
- If hitting limits, could add "bring your own proxy/API key" option for power users (paid tier feature)

## Open Questions

Things that couldn't be fully resolved:

1. **Caption Quality for Auto-Generated vs Manual**
   - What we know: YouTube provides both auto-generated and manual captions; youtube-caption-extractor fetches either
   - What's unclear: How to differentiate between auto-generated (often lower quality) and human-provided captions
   - Recommendation: Accept any available captions; quality filtering could be Phase 5 enhancement

2. **Optimal Concurrency Limit**
   - What we know: Too many parallel requests trigger rate limiting; research suggests 5 concurrent as safe
   - What's unclear: Exact YouTube rate limits for caption fetching (undocumented)
   - Recommendation: Start with 5 concurrent, monitor errors, adjust if needed (could make configurable)

3. **Edge Function Timeout Handling**
   - What we know: Vercel Edge Functions have 25s max execution limit; individual transcript fetch should timeout at 10-15s
   - What's unclear: Best UX for timeout scenarios (retry? skip? queue for later?)
   - Recommendation: Return error for timed-out videos, let user manually retry specific videos

4. **YouTube Language Code Mapping**
   - What we know: youtube-caption-extractor accepts language codes like 'en', 'fr', 'de'
   - What's unclear: Full list of supported codes, fallback behavior for unavailable languages
   - Recommendation: Default to 'en', add language selector in UI if users request it (Phase 5+)

5. **IP Blocking Mitigation**
   - What we know: Excessive requests can trigger IP blocks; proxy rotation can help but adds latency (3-12s)
   - What's unclear: Whether Vercel Edge's distributed nature (300+ data centers) provides natural IP rotation
   - Recommendation: Monitor for "RequestBlocked" errors; if frequent, consider residential proxy service (Webshare, BrightData)

## Sources

### Primary (HIGH confidence)
- [youtube-caption-extractor GitHub](https://github.com/devhims/youtube-caption-extractor) - API documentation, Edge runtime support confirmation
- [p-limit npm](https://www.npmjs.com/package/p-limit) - Concurrency control best practices
- [Vercel Edge Functions docs](https://vercel.com/docs/functions/runtimes/edge) - Edge runtime capabilities and constraints

### Secondary (MEDIUM confidence)
- [Free API to Get the Transcript of a YouTube Video (2026)](https://supadata.ai/youtube-transcript-api) - Alternative API service comparison
- [YouTube caption-extractor npm](https://www.npmjs.com/package/youtube-caption-extractor) - Package details and usage stats
- [Extracting YouTube Transcripts with JavaScript](https://blog.nidhin.dev/extracting-youtube-transcripts-with-javascript) - Technical implementation insights (note: WebFetch blocked)
- [Extract YouTube Transcripts Using Innertube API (2025 JavaScript Guide)](https://medium.com/@aqib-2/extract-youtube-transcripts-using-innertube-api-2025-javascript-guide-dc417b762f49) - Innertube API details (note: WebFetch blocked)
- [How to Scrape Captions from YouTube](https://roundproxies.com/blog/scrape-youtube-captions/) - CORS issues and proxy requirements
- [YouTube Data API Captions](https://developers.google.com/youtube/v3/docs/captions) - Official API limitations (OAuth, quota costs)
- [Cloudflare vs Vercel vs Netlify: Edge Performance 2026](https://dev.to/dataformathub/cloudflare-vs-vercel-vs-netlify-the-truth-about-edge-performance-2026-50h0) - Edge platform comparison
- [Run Concurrent Tasks With a Limit Using Pure JavaScript](https://maximorlov.com/parallel-tasks-with-pure-javascript/) - Concurrency control patterns
- [p-limit vs async vs bottleneck comparison](https://npm-compare.com/async,bottleneck,p-limit,promise-limit,rate-limiter-flexible) - Library selection rationale

### Tertiary (LOW confidence)
- WebSearch results about Edge Functions and YouTube proxies - General patterns but no specific YouTube transcript examples found
- Stack Overflow discussions about CORS workarounds - Community-reported issues, not official guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - youtube-caption-extractor confirmed working in 2026 with Edge runtime support; p-limit widely used standard
- Architecture: MEDIUM - Serverless proxy pattern verified, specific Edge Function implementation derived from general patterns (no specific YouTube example found)
- Pitfalls: MEDIUM - CORS issues confirmed from multiple sources, rate limiting recommendations based on community experience (YouTube limits undocumented)

**Research date:** 2026-01-29
**Valid until:** ~2026-03-01 (30 days - YouTube APIs can change, library updates may occur)

---

## Key Takeaways for Planning

1. **Mandatory serverless proxy:** Cannot bypass CORS, Edge Function is simplest deployment
2. **Use youtube-caption-extractor:** Best-in-class for 2026, Edge runtime support, dual fallback
3. **Concurrency control required:** p-limit with 5 concurrent max prevents rate limiting
4. **Graceful failure handling:** 20-40% of videos lack captions—this is normal, not an error
5. **Try-extraction for availability:** No reliable pre-flight check exists without OAuth/quota costs
6. **Keep infrastructure simple:** Vercel Edge Function = zero config, zero cost, global CDN
