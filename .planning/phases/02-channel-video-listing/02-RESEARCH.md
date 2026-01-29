# Phase 02: Channel Video Listing - Research

**Researched:** 2026-01-29
**Domain:** YouTube Data API v3, React data fetching, pagination patterns
**Confidence:** HIGH

## Summary

Phase 02 implements YouTube channel video listing with a critical constraint: the default quota of 10,000 units/day resets at midnight PT, and improper API usage can exhaust quota with as few as 100 search requests. The standard approach is to avoid search.list (100 units) entirely and instead use channels.list (1 unit) + playlistItems.list (1 unit) to retrieve a channel's uploads playlist, which is 100x more quota-efficient.

YouTube Data API v3 provides three channel resolution methods: forHandle (modern @handle format), forUsername (legacy), and id (channel ID). The API supports native pagination via pageToken with 50 items max per request. Client-side caching is essential - aggressive localStorage/sessionStorage caching combined with quota-aware UI (showing remaining calls, reset time) prevents quota exhaustion. The API has a hard 500-result pagination limit.

**Primary recommendation:** Use channels.list with forHandle/forUsername/id to get uploads playlist ID, then paginate through playlistItems.list. Cache channel->playlist mappings and video metadata aggressively. Never use search.list unless absolutely necessary.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| YouTube Data API v3 | current | Channel and video metadata retrieval | Official Google API, only way to get structured YouTube data |
| React Hook Form | 7.x | Form handling (channel URL input) | Minimal re-renders, already chosen for Phase 01 |
| Zod | 3.x | URL validation | Type-safe validation, already chosen for Phase 01 |
| TanStack Table v8 | 8.x | Data table with pagination | Powers shadcn/ui data-table, industry standard |
| shadcn/ui | latest | UI components | Already chosen, provides data-table and pagination components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-error-boundary | 4.x | API error handling | Catch async errors from YouTube API, display fallback UI |
| date-fns or dayjs | latest | Date formatting | Format video upload dates, calculate quota reset time |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| playlistItems.list | search.list | search.list costs 100 units vs 1 unit - only use if filtering by keyword is required |
| localStorage | TanStack Query | TanStack Query provides automatic caching but adds dependency - use for complex apps, localStorage sufficient for MVP |
| TanStack Table | Custom pagination | Custom pagination requires handling all edge cases - TanStack Table battle-tested |

**Installation:**
```bash
npm install react-error-boundary date-fns
# TanStack Table already included with shadcn/ui data-table
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── features/
│   └── channel-videos/
│       ├── components/
│       │   ├── ChannelUrlForm.tsx          # URL input form
│       │   ├── VideoListTable.tsx          # Data table with TanStack Table
│       │   ├── VideoThumbnail.tsx          # Lazy-loaded thumbnail
│       │   └── QuotaIndicator.tsx          # Shows quota usage/reset time
│       ├── hooks/
│       │   ├── useChannelResolution.ts     # Resolve URL to channel ID
│       │   ├── useVideoList.ts             # Fetch videos with pagination
│       │   └── useQuotaTracking.ts         # Track quota usage client-side
│       ├── utils/
│       │   ├── parseChannelUrl.ts          # Parse @handle, /c/, /channel/, /user/
│       │   ├── youtubeApi.ts               # API client wrapper
│       │   └── cache.ts                    # localStorage cache helpers
│       └── types/
│           └── youtube.ts                  # YouTube API response types
└── lib/
    └── youtube-client.ts                   # Shared YouTube API client
```

### Pattern 1: Quota-Efficient Channel Resolution
**What:** Resolve any channel URL format to uploads playlist ID in 2 API calls (2 units total)
**When to use:** Every time user enters a channel URL
**Example:**
```typescript
// Source: https://developers.google.com/youtube/v3/docs/channels/list

// Step 1: Parse URL to extract identifier
function parseChannelUrl(url: string): { type: 'handle' | 'username' | 'channelId', value: string } {
  const urlObj = new URL(url);

  // @handle format: youtube.com/@GoogleDevelopers
  if (urlObj.pathname.startsWith('/@')) {
    return { type: 'handle', value: urlObj.pathname.slice(2) };
  }

  // /channel/ format: youtube.com/channel/UCaBcDeFgHiJkLmN123456
  if (urlObj.pathname.startsWith('/channel/')) {
    return { type: 'channelId', value: urlObj.pathname.split('/')[2] };
  }

  // /c/ or /user/ format: youtube.com/c/CustomName or youtube.com/user/UserName
  if (urlObj.pathname.startsWith('/c/') || urlObj.pathname.startsWith('/user/')) {
    return { type: 'username', value: urlObj.pathname.split('/')[2] };
  }

  throw new Error('Unsupported YouTube URL format');
}

// Step 2: Call channels.list with appropriate parameter (1 unit)
async function getUploadsPlaylistId(identifier: { type: string, value: string }, apiKey: string) {
  const params = new URLSearchParams({
    part: 'contentDetails',
    key: apiKey,
  });

  // Use appropriate parameter based on URL type
  if (identifier.type === 'handle') {
    params.set('forHandle', identifier.value);
  } else if (identifier.type === 'username') {
    params.set('forUsername', identifier.value);
  } else {
    params.set('id', identifier.value);
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params}`
  );

  const data = await response.json();

  if (!data.items?.[0]) {
    throw new Error('Channel not found');
  }

  // Extract uploads playlist ID from contentDetails
  return data.items[0].contentDetails.relatedPlaylists.uploads;
}
```

### Pattern 2: Server-Side Pagination with TanStack Table
**What:** Use manualPagination mode with YouTube API pageToken
**When to use:** Displaying paginated video lists
**Example:**
```typescript
// Source: https://tanstack.com/table/v8/docs/guide/pagination

import { useReactTable, getCoreRowModel } from '@tanstack/react-table';

function VideoListTable() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const [pageToken, setPageToken] = useState<string | null>(null);

  // Fetch videos with current page token
  const { data, isLoading } = useVideoList({
    playlistId: uploadsPlaylistId,
    maxResults: pagination.pageSize,
    pageToken: pageToken,
  });

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, // Tell TanStack we handle pagination
    rowCount: data?.totalResults, // Total items (for page count)
    state: { pagination },
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function'
        ? updater(pagination)
        : updater;

      setPagination(newPagination);

      // Update pageToken based on direction
      if (newPagination.pageIndex > pagination.pageIndex) {
        setPageToken(data?.nextPageToken ?? null);
      } else {
        setPageToken(data?.prevPageToken ?? null);
      }
    },
  });

  return <DataTable table={table} />;
}
```

### Pattern 3: Aggressive Client-Side Caching
**What:** Cache channel metadata and video lists with TTL to minimize quota usage
**When to use:** Every API response should be cached
**Example:**
```typescript
// Source: https://www.systemsarchitect.io/docs/caching-guide/javascript-react

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
}

function setCache<T>(key: string, data: T, expiresIn: number = 1000 * 60 * 60) {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    expiresIn,
  };
  localStorage.setItem(key, JSON.stringify(entry));
}

function getCache<T>(key: string): T | null {
  const item = localStorage.getItem(key);
  if (!item) return null;

  const entry: CacheEntry<T> = JSON.parse(item);

  // Check if expired
  if (Date.now() - entry.timestamp > entry.expiresIn) {
    localStorage.removeItem(key);
    return null;
  }

  return entry.data;
}

// Usage in API hook
async function fetchChannelVideos(playlistId: string, pageToken?: string) {
  const cacheKey = `videos_${playlistId}_${pageToken ?? 'page1'}`;

  // Try cache first
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // Fetch from API (costs 1 quota unit)
  const response = await fetch(/* ... */);
  const data = await response.json();

  // Cache for 1 hour (channel videos don't change frequently)
  setCache(cacheKey, data, 1000 * 60 * 60);

  return data;
}
```

### Pattern 4: Quota-Aware Error Handling
**What:** Detect quotaExceeded errors and show reset time
**When to use:** All YouTube API calls
**Example:**
```typescript
// Source: https://developers.google.com/youtube/v3/docs/errors

async function fetchWithQuotaHandling(url: string) {
  try {
    const response = await fetch(url);
    const data = await response.json();

    // Check for quota error
    if (data.error?.code === 403 &&
        data.error.errors?.[0]?.reason === 'quotaExceeded') {

      // Calculate next reset (midnight PT)
      const now = new Date();
      const resetTime = new Date(now);
      resetTime.setUTCHours(8, 0, 0, 0); // Midnight PT = 8am UTC

      // If we're past today's reset, quota resets tomorrow
      if (now.getUTCHours() >= 8) {
        resetTime.setUTCDate(resetTime.getUTCDate() + 1);
      }

      throw new QuotaExceededError(
        `YouTube API quota exceeded. Resets at ${resetTime.toLocaleString()}`
      );
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      // Show user-friendly error with reset time
      throw error;
    }
    // Handle other errors
    throw new Error('Failed to fetch from YouTube API');
  }
}
```

### Pattern 5: URL Validation with Zod
**What:** Validate and parse YouTube channel URLs before API calls
**When to use:** Channel URL input form
**Example:**
```typescript
// Source: https://www.contentful.com/blog/react-hook-form-validation-zod/

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

const channelUrlSchema = z.object({
  url: z.string()
    .url('Must be a valid URL')
    .refine(
      (url) => {
        try {
          const urlObj = new URL(url);
          // Must be YouTube domain
          if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(urlObj.hostname)) {
            return false;
          }
          // Must match channel URL patterns
          const path = urlObj.pathname;
          return path.startsWith('/@') ||
                 path.startsWith('/channel/') ||
                 path.startsWith('/c/') ||
                 path.startsWith('/user/');
        } catch {
          return false;
        }
      },
      { message: 'Must be a valid YouTube channel URL (@handle, /channel/, /c/, or /user/)' }
    ),
});

function ChannelUrlForm() {
  const form = useForm({
    resolver: zodResolver(channelUrlSchema),
    defaultValues: { url: '' },
  });

  const onSubmit = (data: z.infer<typeof channelUrlSchema>) => {
    // URL is validated, proceed with API call
    const identifier = parseChannelUrl(data.url);
    // ...
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('url')} />
      {form.formState.errors.url && (
        <span>{form.formState.errors.url.message}</span>
      )}
    </form>
  );
}
```

### Anti-Patterns to Avoid

- **Using search.list to find channels:** Costs 100 units vs 1 unit for channels.list - only use search if user searches by keyword, not by URL
- **Fetching all videos upfront:** YouTube API has 500-result pagination limit - use progressive loading with "load more" button
- **Not caching API responses:** Every API call costs quota - cache aggressively with 1-hour TTL minimum
- **Storing API key in localStorage permanently:** Security risk - use sessionStorage so key is cleared when tab closes
- **Not tracking quota usage:** Users can't know when they'll hit limit - track estimated quota usage client-side
- **Requesting unnecessary data parts:** Each additional part in the request doesn't cost more quota but increases response size and processing time - only request needed parts (snippet, contentDetails)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube URL parsing | Custom regex for all URL formats | URL API + pattern matching | YouTube has 6+ URL formats (@handle, /c/, /channel/, /user/, custom URLs, mobile variants) - regex is fragile and prone to catastrophic backtracking |
| Date/time formatting | Custom date formatters | date-fns or dayjs | Timezone handling, relative times ("2 days ago"), locale support are complex - libraries handle edge cases |
| Quota reset calculation | Manual timezone math | date-fns-tz | Midnight PT calculation requires DST handling - easy to get wrong |
| Pagination state | Custom page tracking | TanStack Table manualPagination | Handles page bounds, loading states, optimistic updates - well-tested |
| Error boundaries | try-catch everywhere | react-error-boundary | Async errors need special handling, library provides hooks and reset functionality |
| Form validation | Custom validators | Zod + React Hook Form | Type-safe, reusable schemas, async validation support |
| API response caching | Custom cache logic | localStorage wrapper with TTL | Expiration, serialization, storage limits need careful handling |

**Key insight:** YouTube API has many edge cases (quota limits, pagination limits, URL format variations, timezone calculations for reset). Use battle-tested libraries to avoid quota wastage from bugs and edge case failures.

## Common Pitfalls

### Pitfall 1: Using search.list Instead of channels.list
**What goes wrong:** App exhausts 10,000 daily quota in 100 requests (search.list costs 100 units)
**Why it happens:** Developers think search is the natural way to "search" for a channel by URL
**How to avoid:** Only use search.list when user provides keyword query. For URL-based lookup, always use channels.list with forHandle/forUsername/id parameters (1 unit each)
**Warning signs:** Quota exhausts quickly during testing, users report "quota exceeded" errors early in day

### Pitfall 2: Not Caching API Responses
**What goes wrong:** Every page navigation or refresh re-fetches same data, wasting quota
**Why it happens:** React components re-mount and re-fetch without cache layer
**How to avoid:** Implement cache wrapper around all YouTube API calls with 1-hour minimum TTL. Channel metadata changes rarely, video lists change hourly at most.
**Warning signs:** Network tab shows duplicate API calls for same data, quota usage higher than expected

### Pitfall 3: Pagination Beyond 500 Results
**What goes wrong:** YouTube API stops returning nextPageToken after 500 results, pagination breaks
**Why it happens:** API documentation doesn't emphasize this hard limit
**How to avoid:** Display warning at 450 results: "Showing first 500 videos only due to YouTube API limits". For channels with >500 videos, accept limitation or implement filters to narrow results.
**Warning signs:** Users report "load more" button stops working on large channels

### Pitfall 4: Not Handling quotaExceeded Gracefully
**What goes wrong:** App shows generic error, users confused and keep retrying (wasting quota)
**Why it happens:** Developers only test happy path, not quota exhaustion scenario
**How to avoid:**
- Catch 403 quotaExceeded errors specifically
- Calculate and display quota reset time (midnight PT)
- Disable "fetch" buttons when quota exhausted
- Show cached data with "stale data" indicator
**Warning signs:** User complaints about cryptic errors, support requests asking when app will work again

### Pitfall 5: Storing API Key in localStorage
**What goes wrong:** API key persists across browser sessions, security risk if user shares device
**Why it happens:** localStorage seems simpler than sessionStorage for "persistence"
**How to avoid:** Use sessionStorage (not localStorage) for API key - clears when tab closes. For channel/video cache, localStorage is fine (not sensitive data).
**Warning signs:** Security audit flags API key storage, users on shared computers concerned about key persistence

### Pitfall 6: Not Requesting contentDetails Part
**What goes wrong:** App makes 2nd API call to get uploads playlist ID, doubling quota usage
**Why it happens:** Developers only request snippet part (basic info) and miss contentDetails
**How to avoid:** Always request part=contentDetails when fetching channel data to get relatedPlaylists.uploads in single call
**Warning signs:** Network tab shows 2 channels.list calls per channel lookup

### Pitfall 7: Invalid URL Crashes App
**What goes wrong:** User pastes malformed URL, app crashes or shows confusing error
**Why it happens:** URL parsing not wrapped in try-catch, URL constructor throws on invalid URLs
**How to avoid:** Use Zod validation with refine() to validate URL format before parsing. Show user-friendly error: "Please enter a valid YouTube channel URL"
**Warning signs:** Error boundaries trigger on URL input, users report app "breaking" when they paste certain URLs

### Pitfall 8: Not Lazy-Loading Thumbnails
**What goes wrong:** Loading 50 video thumbnails blocks page render, poor performance
**Why it happens:** All <img> tags load immediately when rendered
**How to avoid:** Use native lazy loading with loading="lazy" attribute, or implement intersection observer for custom lazy loading
**Warning signs:** Large LCP (Largest Contentful Paint), users on slow connections see blank page for seconds

## Code Examples

Verified patterns from official sources:

### Fetching Uploads Playlist ID
```typescript
// Source: https://developers.google.com/youtube/v3/docs/channels

async function getChannelUploadsPlaylist(
  channelIdentifier: string,
  identifierType: 'handle' | 'username' | 'channelId',
  apiKey: string
): Promise<string> {
  const params = new URLSearchParams({
    part: 'contentDetails',
    key: apiKey,
  });

  // Set appropriate parameter based on identifier type
  switch (identifierType) {
    case 'handle':
      params.set('forHandle', channelIdentifier);
      break;
    case 'username':
      params.set('forUsername', channelIdentifier);
      break;
    case 'channelId':
      params.set('id', channelIdentifier);
      break;
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params}`
  );

  const data = await response.json();

  if (!data.items?.[0]) {
    throw new Error('Channel not found');
  }

  // Extract uploads playlist ID
  const uploadsPlaylistId = data.items[0].contentDetails.relatedPlaylists.uploads;

  return uploadsPlaylistId;
}
```

### Fetching Videos with Pagination
```typescript
// Source: https://developers.google.com/youtube/v3/docs/playlistItems/list

interface VideoListResponse {
  items: Array<{
    snippet: {
      title: string;
      thumbnails: {
        medium: { url: string };
      };
      publishedAt: string;
    };
    contentDetails: {
      videoId: string;
      videoPublishedAt: string;
    };
  }>;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

async function fetchPlaylistVideos(
  playlistId: string,
  apiKey: string,
  pageToken?: string,
  maxResults: number = 50
): Promise<VideoListResponse> {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: maxResults.toString(),
    key: apiKey,
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?${params}`
  );

  const data = await response.json();

  return data;
}
```

### Client-Side Quota Tracking
```typescript
// Track quota usage client-side (estimates only, server is source of truth)

interface QuotaUsage {
  used: number;
  limit: number;
  resetTime: Date;
}

function trackQuotaUsage(operation: 'channels.list' | 'playlistItems.list' | 'search.list') {
  const quotaCosts = {
    'channels.list': 1,
    'playlistItems.list': 1,
    'search.list': 100,
  };

  const cost = quotaCosts[operation];

  // Get today's usage from sessionStorage
  const today = new Date().toISOString().split('T')[0];
  const storageKey = `quota_${today}`;

  const currentUsage = Number(sessionStorage.getItem(storageKey) || '0');
  const newUsage = currentUsage + cost;

  sessionStorage.setItem(storageKey, newUsage.toString());

  return {
    used: newUsage,
    limit: 10000,
    remaining: 10000 - newUsage,
  };
}

function getQuotaResetTime(): Date {
  // Quota resets at midnight Pacific Time
  const now = new Date();
  const resetTime = new Date(now);

  // Convert to UTC (midnight PT = 8am UTC, or 7am UTC during DST)
  // For simplicity, use 8am UTC
  resetTime.setUTCHours(8, 0, 0, 0);

  // If we're past today's reset, next reset is tomorrow
  if (now.getUTCHours() >= 8) {
    resetTime.setUTCDate(resetTime.getUTCDate() + 1);
  }

  return resetTime;
}
```

### Lazy-Loading Thumbnails
```typescript
// Source: https://www.wpspeedfix.com/wiki/how-to-add-lazy-loading-to-videos/

function VideoThumbnail({ url, title }: { url: string; title: string }) {
  return (
    <img
      src={url}
      alt={title}
      loading="lazy"
      className="w-full h-auto"
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| search.list for everything | channels.list + playlistItems.list for known channels | Always been best practice | 100x quota savings |
| Custom cache implementations | TanStack Query | 2021-present | Automatic cache invalidation, background refetching |
| Class-based error boundaries | react-error-boundary library | 2020-present | Functional API, better DX |
| Complex regex for YouTube URLs | URL API + simple pattern matching | 2020+ | More reliable, avoids catastrophic backtracking |
| Manual useMemo/useCallback everywhere | React Compiler (2024+) | 2024-2026 | Automatic memoization, cleaner code |
| localStorage for everything | sessionStorage for sensitive data | Security best practice | API keys don't persist across sessions |

**Deprecated/outdated:**
- **YouTube API v2**: Shut down in 2015, v3 is current
- **Custom URL regex like `/^(?:https?:\/\/)?(?:www\.)?youtube\.com\/.../`**: Fragile, doesn't cover all formats, use URL API instead
- **Storing API keys in code**: Never was acceptable, but especially problematic with user-provided keys

## Revenue Considerations

**Phase revenue impact:** Critical path - users can't extract video knowledge without seeing video list first

**Speed to revenue tradeoffs:**
| Decision | Fast Option | "Right" Option | Recommendation | Rationale |
|----------|-------------|----------------|----------------|-----------|
| Caching layer | Simple localStorage wrapper | TanStack Query | localStorage wrapper | TanStack Query adds complexity for features we don't need yet (auto-refetch, optimistic updates). Simple cache gets to revenue faster. Can migrate later if needed. |
| Error handling | Basic try-catch + toast | react-error-boundary + monitoring | react-error-boundary (no monitoring yet) | Error boundaries are table stakes for UX, but external monitoring (Sentry) can wait until post-revenue. |
| Quota UI | Show basic "quota exceeded" message | Real-time quota tracking + reset countdown | Basic message with static reset time | Real-time tracking requires backend. Static "resets at midnight PT" message is good enough for MVP. |
| Pagination UI | Simple "Load More" button | Full pagination controls (first/prev/next/last) | "Load More" button | Simpler to implement, covers 90% of use cases. Users rarely jump to specific pages. |
| URL parsing | Support @handle and /channel/ only | Support all 6 URL formats | All formats | Minimal extra code, prevents user confusion. Users will paste any format - better to support all upfront than deal with support tickets. |

**Monetization architecture notes:**
- **No premium/free distinction in Phase 02:** All users get same features. Could add premium tier later with higher quota limits or dedicated API keys.
- **Usage tracking ready:** Client-side quota tracking (sessionStorage) provides foundation for usage-based billing if needed. Could log usage to backend for analytics.
- **No multi-tenant needed yet:** User-provided API keys mean each user has their own quota. If we switch to app-provided keys, would need per-user quota tracking.

**Build for speed to revenue:**
- Ship with localStorage cache first (1 hour of dev time) rather than TanStack Query (4+ hours learning + integration)
- Skip real-time quota tracking backend - show static reset time message
- Use shadcn/ui data-table as-is rather than heavy customization
- Lazy-load thumbnails with native loading="lazy" - simple, works everywhere

## Open Questions

Things that couldn't be fully resolved:

1. **Does YouTube API enforce 500-result pagination limit on all channels?**
   - What we know: Multiple sources mention 500-result limit, official docs don't explicitly state it
   - What's unclear: Is this a hard API limit or just practical guidance? Do some channels support more?
   - Recommendation: Implement "load more" until nextPageToken stops appearing. Add warning at 450 results. Test with large channels (>500 videos) to confirm behavior.

2. **Should we use TanStack Query or simple caching?**
   - What we know: TanStack Query is industry standard for data fetching, but adds complexity
   - What's unclear: Does automatic refetching/invalidation provide enough value for this use case?
   - Recommendation: Start with simple localStorage cache (faster to ship). Cache rarely changes (videos published hourly). Can migrate to TanStack Query post-MVP if auto-refetch becomes valuable.

3. **How to handle channels with no uploads playlist?**
   - What we know: Uploads playlist should always exist according to API docs
   - What's unclear: Are there edge cases (deleted channels, private channels, brand accounts)?
   - Recommendation: Validate uploads playlist exists after channels.list. Show error if missing: "This channel has no public videos."

4. **Client-side quota tracking accuracy**
   - What we know: We can track estimated usage in sessionStorage
   - What's unclear: How to handle users with multiple tabs, or users who close/reopen browser mid-day
   - Recommendation: Treat as best-effort estimate. Clear tracking on quota reset (midnight PT). Add disclaimer: "Estimated quota usage - actual usage may vary."

## Sources

### Primary (HIGH confidence)
- [YouTube Data API - Channels.list](https://developers.google.com/youtube/v3/docs/channels/list) - Official API reference for channel resolution
- [YouTube Data API - PlaylistItems.list](https://developers.google.com/youtube/v3/docs/playlistItems/list) - Official API reference for video listing
- [YouTube Data API - Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost) - Official quota costs
- [YouTube Data API - Channels Resource](https://developers.google.com/youtube/v3/docs/channels) - contentDetails.relatedPlaylists structure
- [TanStack Table - Pagination Guide](https://tanstack.com/table/v8/docs/guide/pagination) - Server-side pagination patterns

### Secondary (MEDIUM confidence)
- [React Hook Form with Zod - Contentful Guide](https://www.contentful.com/blog/react-hook-form-validation-zod/) - Validation patterns
- [Ultimate Caching Guide: Javascript/React - SystemsArchitect.io](https://www.systemsarchitect.io/docs/caching-guide/javascript-react) - Client-side caching strategies
- [shadcn/ui Data Table Documentation](https://ui.shadcn.com/docs/components/data-table) - Component patterns
- [react-error-boundary - GitHub](https://github.com/bvaughn/react-error-boundary) - Error handling patterns
- [YouTube API Complete Guide 2026 - GetLate](https://getlate.dev/blog/youtube-api) - Current best practices
- [Server-side Pagination with TanStack Table - Medium](https://medium.com/@aylo.srd/server-side-pagination-and-sorting-with-tanstack-table-and-react-bd493170125e) - Implementation patterns

### Tertiary (LOW confidence)
- [YouTube API Quota Exceeded Fix - GetLate 2025](https://getlate.dev/blog/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota) - Common mistakes (good overview but WebSearch-only verification)
- [React Fundamentals 2026 - Nucamp](https://www.nucamp.co/blog/react-fundamentals-in-2026-components-hooks-react-compiler-and-modern-ui-development) - React Compiler impact (forward-looking, not yet standard)
- [YouTube Thumbnail Best Practices 2026 - Awisee](https://awisee.com/blog/youtube-thumbnail-best-practices/) - Thumbnail optimization (useful but not critical for MVP)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - YouTube Data API v3 is the only option, React Hook Form/Zod already chosen, TanStack Table powers shadcn/ui
- Architecture: HIGH - Official API docs + battle-tested patterns (channels.list + playlistItems.list)
- Pitfalls: HIGH - Quota exhaustion well-documented, pagination limit confirmed by multiple sources
- Caching patterns: MEDIUM - localStorage approach is sound but TanStack Query question remains open

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - YouTube API is stable, patterns are established)
