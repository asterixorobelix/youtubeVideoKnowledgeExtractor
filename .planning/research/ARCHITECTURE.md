# Architecture Patterns

**Domain:** YouTube Transcript Extraction + LLM Summarization Web App
**Researched:** 2026-01-29
**Confidence:** HIGH (based on established client-side web app patterns)

## Recommended Architecture

**Pattern:** Client-side web application with external API integrations (YouTube Data API, YouTube Transcript API, Claude API)

**Architecture Style:** Layered frontend with service-oriented API clients

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    UI Layer (React/Vue/Svelte)           │   │
│  │  - ChannelInput                                           │   │
│  │  - VideoList (with selection)                            │   │
│  │  - ProcessingProgress                                     │   │
│  │  - DownloadButton                                         │   │
│  └────────────────┬────────────────────────────────────────┘   │
│                   │                                              │
│  ┌────────────────▼────────────────────────────────────────┐   │
│  │              State Management Layer                      │   │
│  │  - Channel state                                         │   │
│  │  - Video selection state                                 │   │
│  │  - Processing state (progress, errors)                   │   │
│  │  - API key state                                         │   │
│  └────────────────┬────────────────────────────────────────┘   │
│                   │                                              │
│  ┌────────────────▼────────────────────────────────────────┐   │
│  │              Service Layer                               │   │
│  │  - YouTubeChannelService                                 │   │
│  │  - TranscriptService                                     │   │
│  │  - SummarizationService (Claude API)                     │   │
│  │  - ExportService (zip generation)                        │   │
│  │  - BatchProcessor (orchestrates multi-video processing)  │   │
│  └──────┬──────────┬──────────┬────────────────────────────┘   │
│         │          │          │                                  │
└─────────┼──────────┼──────────┼──────────────────────────────────┘
          │          │          │
          ▼          ▼          ▼
    ┌─────────┐ ┌─────────┐ ┌──────────┐
    │YouTube  │ │YouTube  │ │Claude API│
    │Data API │ │Transcript│ │          │
    │         │ │ (proxy)  │ │          │
    └─────────┘ └─────────┘ └──────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Input | Output |
|-----------|---------------|-------------------|-------|--------|
| **ChannelInput** | Captures YouTube channel URL | State Management | User input | Channel URL |
| **VideoList** | Displays paginated videos with selection UI | State Management | Video metadata, selection state | Selected video IDs |
| **ProcessingProgress** | Shows batch processing status per video | State Management | Processing events | Visual progress |
| **DownloadButton** | Triggers zip download | ExportService | Completed summaries | Zip file download |
| **State Management** | Centralized state (Zustand/Jotai/Context) | UI Layer, Service Layer | State updates | Reactive state |
| **YouTubeChannelService** | Fetches channel videos via YouTube Data API | YouTube Data API | Channel URL/ID, page token | Video list, next page token |
| **TranscriptService** | Extracts YouTube captions | YouTube Transcript API (via proxy) | Video ID | Transcript text |
| **SummarizationService** | Sends transcripts to Claude for summarization | Claude API | Transcript, API key, prompt | Structured summary |
| **ExportService** | Packages summaries as markdown files in zip | Browser File API | Summary objects | Zip blob |
| **BatchProcessor** | Orchestrates multi-video processing with concurrency control | TranscriptService, SummarizationService, State Management | Selected video IDs | Progress events, results |

### Data Flow

**1. Channel Discovery Flow**
```
User enters channel URL
  → YouTubeChannelService.getChannelId(url)
  → YouTube Data API: channels.list
  → Extract channel ID
  → YouTubeChannelService.getVideos(channelId, pageToken)
  → YouTube Data API: search.list OR playlistItems.list (uploads playlist)
  → Video metadata (id, title, thumbnail, published date)
  → State Management updates videoList
  → VideoList renders with selection checkboxes
```

**2. Processing Flow (Batch)**
```
User selects videos + clicks "Process"
  → State Management: processingState = { status: 'running', progress: {} }
  → BatchProcessor.processVideos(selectedVideoIds, apiKey)

  For each video (with concurrency limit = 3):
    → TranscriptService.getTranscript(videoId)
      → YouTube Transcript API
      → Returns transcript text OR null (if unavailable)

    → If transcript exists:
      → SummarizationService.summarize(transcript, apiKey)
        → Claude API: messages.create with structured prompt
        → Returns { title, keyPoints, topics, quotes }
      → Emit progress event: { videoId, status: 'completed', summary }

    → If transcript unavailable:
      → Emit progress event: { videoId, status: 'skipped', reason: 'No captions' }

    → If error:
      → Emit progress event: { videoId, status: 'error', error: errorMessage }

  → State Management updates progress for each video
  → ProcessingProgress renders live status

  → When all complete:
    → State Management: summaries = completed results
    → Enable download button
```

**3. Export Flow**
```
User clicks "Download"
  → ExportService.createZip(summaries)
  → For each summary:
    → Generate markdown file: `${sanitize(title)}.md`
    → Content: formatted markdown (title, key points, topics, quotes)
  → Use JSZip to bundle files
  → Generate blob
  → Trigger browser download: `knowledge-export-${timestamp}.zip`
```

### Critical Architecture Decisions

#### 1. Client-Side Only (No Backend)
**Why:** Stateless requirement, no auth, no database → pure client-side app

**Implications:**
- YouTube Data API requires API key → CORS-enabled public key OR user-provided key
- YouTube Transcript API → CORS proxy needed (cannot call directly from browser)
- Claude API → Direct from browser with user-provided key
- All state lives in browser memory (lost on refresh)

**Recommendation:**
- YouTube Data API: Use public API key (quota shared, acceptable for MVP)
- YouTube Transcript: Backend proxy endpoint OR serverless function (Cloudflare Worker, Vercel Edge)
- Claude API: Direct from browser (user's key, no CORS issues)

#### 2. Transcript Extraction Method
**Problem:** YouTube Transcript API is Python library, not browser-accessible

**Options:**
| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Serverless proxy** (Vercel/CF Worker) | Stateless, scales, simple | Adds deployment dependency | **YES** - Best fit |
| **CORS proxy service** (3rd party) | Zero deployment | Reliability, privacy concerns | NO |
| **Bundled backend** (Express/Fastify) | Full control | Contradicts stateless requirement | NO |

**Chosen:** Serverless function as transcript proxy (Vercel Edge Function or Cloudflare Worker)

```
Browser → /api/transcript?videoId=xxx → Serverless function → YouTube → Browser
```

#### 3. Batch Processing Strategy
**Pattern:** Concurrent batch processor with progress streaming

```typescript
class BatchProcessor {
  async processVideos(
    videoIds: string[],
    apiKey: string,
    onProgress: (event: ProgressEvent) => void,
    concurrency: number = 3
  ): Promise<Summary[]> {
    const queue = [...videoIds];
    const results: Summary[] = [];
    const inProgress = new Set<Promise<void>>();

    while (queue.length > 0 || inProgress.size > 0) {
      // Fill concurrency slots
      while (queue.length > 0 && inProgress.size < concurrency) {
        const videoId = queue.shift()!;
        const task = this.processOne(videoId, apiKey, onProgress)
          .then(result => {
            if (result) results.push(result);
            inProgress.delete(task);
          });
        inProgress.add(task);
      }

      // Wait for at least one to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }

    return results;
  }
}
```

**Why concurrency limit:**
- Claude API rate limits (tier-dependent)
- User experience (show progress incrementally)
- Error isolation (one failure doesn't block others)

#### 4. State Management Choice
**Pattern:** Reactive state with persistence option

**Options:**
| Library | Pros | Cons | Fit |
|---------|------|------|-----|
| **Zustand** | Minimal, TypeScript, middleware support | Less structure | **Best** - Simple, extensible |
| **Jotai** | Atomic, granular reactivity | More boilerplate | Good |
| **React Context** | Built-in, zero deps | Manual optimization | OK for small apps |
| **Redux Toolkit** | Full-featured, devtools | Overkill for stateless app | NO |

**Recommendation:** Zustand with localStorage middleware (optional persistence of API key)

```typescript
interface AppState {
  // API Keys
  apiKey: string | null;
  setApiKey: (key: string) => void;

  // Channel
  channelUrl: string;
  channelId: string | null;
  videos: Video[];
  nextPageToken: string | null;

  // Selection
  selectedVideoIds: Set<string>;
  toggleSelection: (id: string) => void;

  // Processing
  processingState: 'idle' | 'running' | 'completed' | 'error';
  progress: Map<string, VideoProgress>; // videoId → status
  summaries: Summary[];
}
```

## Patterns to Follow

### Pattern 1: Service Layer Abstraction
**What:** Encapsulate API calls in service classes with error handling

**When:** All external API interactions

**Example:**
```typescript
class SummarizationService {
  async summarize(
    transcript: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<Summary> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: this.buildPrompt(transcript)
          }]
        }),
        signal
      });

      if (!response.ok) {
        throw new APIError(response.status, await response.text());
      }

      const data = await response.json();
      return this.parseResponse(data.content[0].text);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new CancellationError();
      }
      throw error;
    }
  }

  private buildPrompt(transcript: string): string {
    return `Analyze this YouTube video transcript and provide a structured summary...`;
  }
}
```

### Pattern 2: Progress Event Streaming
**What:** Emit progress events during batch processing for real-time UI updates

**When:** Any long-running batch operation

**Example:**
```typescript
type ProgressEvent =
  | { type: 'started'; videoId: string; title: string }
  | { type: 'transcript_fetched'; videoId: string }
  | { type: 'summarizing'; videoId: string }
  | { type: 'completed'; videoId: string; summary: Summary }
  | { type: 'skipped'; videoId: string; reason: string }
  | { type: 'error'; videoId: string; error: string };

// In BatchProcessor
onProgress({ type: 'started', videoId, title });
// ... processing
onProgress({ type: 'completed', videoId, summary });

// In UI
useEffect(() => {
  const unsubscribe = store.subscribe(
    state => state.progress,
    (progress) => {
      // Reactively update UI based on progress map
    }
  );
  return unsubscribe;
}, []);
```

### Pattern 3: Pagination with Lazy Loading
**What:** Fetch YouTube videos incrementally as user scrolls/clicks "Load More"

**When:** Channel video listing (can be 100s-1000s of videos)

**Example:**
```typescript
class YouTubeChannelService {
  async getVideos(
    channelId: string,
    pageToken?: string
  ): Promise<{ videos: Video[]; nextPageToken: string | null }> {
    // Use uploads playlist (more reliable than search.list)
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
    );
    const uploadsPlaylistId = channelResponse.items[0].contentDetails.relatedPlaylists.uploads;

    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}&key=${API_KEY}`
    );

    return {
      videos: playlistResponse.items.map(item => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url,
        publishedAt: item.snippet.publishedAt
      })),
      nextPageToken: playlistResponse.nextPageToken || null
    };
  }
}
```

### Pattern 4: Markdown File Generation
**What:** Convert structured summary objects to formatted markdown

**When:** Export preparation before zipping

**Example:**
```typescript
class ExportService {
  generateMarkdown(summary: Summary): string {
    return `# ${summary.title}

**Video:** [${summary.videoTitle}](https://youtube.com/watch?v=${summary.videoId})
**Processed:** ${new Date().toISOString()}

## Key Points

${summary.keyPoints.map(point => `- ${point}`).join('\n')}

## Topics Covered

${summary.topics.map(topic => `- ${topic}`).join('\n')}

## Notable Quotes

${summary.quotes.map(quote => `> ${quote}`).join('\n\n')}

---
*Generated with YouTube Video Knowledge Extractor*
`;
  }

  async createZip(summaries: Summary[]): Promise<Blob> {
    const zip = new JSZip();

    summaries.forEach(summary => {
      const filename = this.sanitizeFilename(summary.videoTitle) + '.md';
      const content = this.generateMarkdown(summary);
      zip.file(filename, content);
    });

    return await zip.generateAsync({ type: 'blob' });
  }

  private sanitizeFilename(title: string): string {
    return title
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking UI During Batch Processing
**What:** Awaiting all videos sequentially before updating UI

**Why bad:** Poor UX, no progress indication, appears frozen

**Instead:** Stream progress events and update UI reactively per video

```typescript
// BAD: No progress indication
const summaries = await Promise.all(
  videos.map(v => processVideo(v))
);
// UI only updates when ALL complete

// GOOD: Progressive updates
for await (const result of batchProcessor.process(videos)) {
  updateProgress(result); // UI updates immediately
}
```

### Anti-Pattern 2: Hardcoding API Keys in Client Code
**What:** Embedding Anthropic API key in frontend bundle

**Why bad:** Security risk, key exposure, shared quota abuse

**Instead:** User provides their own API key via UI input (stored in-memory or localStorage with warning)

### Anti-Pattern 3: Unbounded Concurrency
**What:** Processing all selected videos simultaneously without limit

**Why bad:**
- Claude API rate limits → failures
- Browser memory issues with 100+ concurrent requests
- Poor error visibility (cascade failures)

**Instead:** Limit concurrency to 2-5 concurrent requests with queue

### Anti-Pattern 4: Ignoring Transcript Unavailability
**What:** Failing entire batch if one video lacks captions

**Why bad:** Most channels have mix of captioned/uncaptioned videos

**Instead:** Skip videos without captions gracefully, report in progress UI

```typescript
// GOOD: Graceful handling
try {
  const transcript = await transcriptService.getTranscript(videoId);
  if (!transcript) {
    return { status: 'skipped', reason: 'No captions available' };
  }
  // ... continue processing
} catch (error) {
  return { status: 'error', error: error.message };
}
```

### Anti-Pattern 5: YouTube Data API Search Endpoint for Channel Videos
**What:** Using `search.list` to get channel videos

**Why bad:**
- Higher quota cost (100 units vs 1 unit)
- Less reliable ordering
- More complex filtering

**Instead:** Use channel's "uploads" playlist via `playlistItems.list` (1 quota unit, reliable)

## Scalability Considerations

| Concern | At 10 videos | At 100 videos | At 1000+ videos |
|---------|--------------|---------------|-----------------|
| **Video listing** | Single API call | 2-3 paginated calls | Lazy loading essential |
| **Memory** | All in-state | All in-state | Virtual scrolling OR keep only visible |
| **Processing time** | ~30-60 seconds | ~5-10 minutes | Background processing with pause/resume |
| **Download size** | ~50KB zip | ~500KB zip | ~5MB+ zip (still manageable) |
| **YouTube quota** | Negligible | 50-100 units | Could hit daily limit (10K units) |

**Recommendations:**
- **MVP (Phase 1):** Support up to 100 videos per channel, no virtual scrolling
- **Phase 2:** Virtual scrolling for video list if 100+ videos
- **Future:** Process/export in batches (e.g., 50 at a time) to avoid memory issues

## Monetization Architecture

### No Server-Side Costs
**Advantage:** Client-side architecture means zero hosting/compute costs beyond static hosting

**Implication:** Cannot monetize via freemium API proxying (no server to enforce limits)

### Revenue Model Fits
| Model | Feasibility | Implementation |
|-------|-------------|----------------|
| **One-time purchase** | HIGH | License key validated client-side (obfuscated check) |
| **Gumroad/LemonSqueezy** | HIGH | Download behind paywall, standard web app |
| **Freemium (video limit)** | MEDIUM | Client-side limit (bypassable, acceptable for MVP) |
| **Subscription** | LOW | No account system, hard to enforce |

**Recommended:** One-time purchase via Gumroad with download link

### Build vs Buy
| Capability | Build | Buy | Recommendation | Rationale |
|------------|-------|-----|----------------|-----------|
| **YouTube transcript proxy** | 2-4 hours | $5/mo (serverless) | **Build** | Simple serverless function, under 50 lines |
| **Zip generation** | 1 hour | Library (JSZip) | **Buy** (library) | Battle-tested, zero cost |
| **Progress UI** | 4-6 hours | Component library | **Build** | Domain-specific, custom logic |
| **Payment** | 40+ hours | Gumroad/LemonSqueezy | **Buy** | Not core value, focus on product |

## Technology Stack Recommendations

### Frontend Framework
**Recommendation:** React (most popular) OR Svelte (simplest)

**Rationale:**
- React: Largest ecosystem, easy hiring, familiar to most devs
- Svelte: Minimal boilerplate, excellent DX, smaller bundle

### Key Libraries
| Purpose | Library | Version | Why |
|---------|---------|---------|-----|
| State Management | Zustand | ^4.5.0 | Minimal, TypeScript-first, middleware support |
| API Client | fetch (native) | - | Sufficient for simple REST calls, zero deps |
| Zip Generation | JSZip | ^3.10.1 | Industry standard, reliable |
| UI Components | shadcn/ui OR Mantine | Latest | Accessible, customizable, good DX |
| YouTube API | @googleapis/youtube | ^14.0.0 (optional) | Typed API client (alternative to raw fetch) |

### Serverless Transcript Proxy
**Recommendation:** Vercel Edge Function OR Cloudflare Worker

```typescript
// /api/transcript.ts (Vercel Edge Function)
import { YoutubeTranscript } from 'youtube-transcript';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return new Response('Missing videoId', { status: 400 });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return new Response(JSON.stringify(transcript), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## Build Order and Dependencies

### Phase 1: Core Infrastructure (No API dependencies)
**Build:**
1. Project scaffolding (Vite + React/Svelte)
2. UI component library setup (shadcn/ui or Mantine)
3. State management setup (Zustand store with types)
4. Basic routing (if multi-page) OR single-page layout
5. API key input component with validation

**Why first:** Foundation with no external API dependencies

**Deliverable:** App shell with API key input

### Phase 2: YouTube Channel Integration (YouTube Data API)
**Build:**
1. YouTubeChannelService (channel ID resolution, video listing)
2. ChannelInput component (URL validation, channel lookup)
3. VideoList component (display videos with metadata)
4. Pagination/load more functionality
5. Video selection state (checkboxes, select all)

**Dependencies:** YouTube Data API key (developer account required)

**Deliverable:** Can list and select videos from a channel

### Phase 3: Transcript Extraction (Serverless proxy)
**Build:**
1. Serverless function for transcript proxy (/api/transcript)
2. TranscriptService (calls proxy, handles errors)
3. Integration with BatchProcessor (transcript step)
4. UI indication for videos without captions

**Dependencies:** Serverless deployment (Vercel/Cloudflare)

**Deliverable:** Can fetch transcripts for selected videos

### Phase 4: Claude Summarization (Claude API)
**Build:**
1. SummarizationService (Claude API integration)
2. Prompt engineering for structured output
3. Response parsing (extract title, key points, topics, quotes)
4. Error handling (rate limits, invalid API key)

**Dependencies:** User-provided Anthropic API key

**Deliverable:** Can summarize individual transcript

### Phase 5: Batch Processing (Orchestration)
**Build:**
1. BatchProcessor (concurrency control, queue management)
2. Progress event system (typed events, state updates)
3. ProcessingProgress UI component (per-video status)
4. Cancellation support (AbortController)

**Dependencies:** Phases 3 + 4 complete

**Deliverable:** Can process multiple videos with live progress

### Phase 6: Export (File generation)
**Build:**
1. ExportService (markdown generation, zip creation)
2. DownloadButton component (triggers download)
3. Filename sanitization
4. Metadata inclusion (processed date, video link)

**Dependencies:** JSZip library, Phase 5 complete

**Deliverable:** Can download summaries as zip

### Critical Path
```
Phase 1 (infrastructure)
  ↓
Phase 2 (YouTube integration) ← Required for any functionality
  ↓
Phase 3 (transcript) ← Blocking for summarization
  ↓
Phase 4 (Claude) ← Blocking for export
  ↓
Phase 5 (batch) ← Enables multi-video UX
  ↓
Phase 6 (export) ← Final deliverable
```

**Parallel opportunities:**
- Phase 4 (Claude) can be prototyped in parallel with Phase 3 (using mock transcripts)
- Phase 6 (export) can be prototyped early (using mock summaries)

## Deployment Architecture

**Hosting:** Static hosting (Vercel, Netlify, Cloudflare Pages)

**Assets:**
- `/index.html` - SPA entry
- `/assets/*` - Bundled JS/CSS
- `/api/transcript` - Serverless function (if Vercel/Netlify)

**Environment Variables:**
- `VITE_YOUTUBE_API_KEY` - Public YouTube Data API key (quota-limited)
- No secrets (user provides own Claude API key)

**Build command:** `npm run build` (Vite)

**Deploy time:** < 2 minutes (static site + 1 serverless function)

## Sources

**Confidence Note:** This architecture is based on established patterns for client-side web applications with external API integrations. Confidence level is HIGH for general patterns, MEDIUM for YouTube-specific implementation details (based on YouTube Data API v3 documentation knowledge from training data, which should be verified against current official documentation).

Key architectural patterns drawn from:
- Client-side batch processing patterns (common in ETL tools)
- YouTube Data API v3 structure (channels, playlists, videos)
- Claude API integration patterns (streaming, structured output)
- Browser File API capabilities (download triggers, Blob handling)

**Verification needed:**
- Current YouTube Data API v3 quota costs and endpoint recommendations
- Current Claude API rate limits per tier (affects concurrency recommendations)
- Latest JSZip API (assumed stable based on maturity)
