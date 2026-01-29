# Technology Stack

**Project:** YouTube Video Knowledge Extractor
**Researched:** 2026-01-29
**Overall Confidence:** MEDIUM (based on training data + project requirements analysis, external verification unavailable)

## Recommended Stack

### Frontend Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 18.3.x | UI framework | Industry standard, excellent ecosystem, client-side stateless app fits React model perfectly |
| Vite | 5.x | Build tool | Fast dev server, modern tooling, optimized for React SPAs, simpler than Next.js for stateless apps |
| TypeScript | 5.3.x+ | Type safety | Prevents runtime errors with YouTube API, Claude API, and state management |

**Rationale:** This is a **stateless, client-side web app** with no server-side rendering needs, no auth, no database. Vite + React is the optimal choice over Next.js because:
- No need for Next.js SSR/SSG features
- No API routes needed (Claude calls happen client-side with user's API key)
- Faster development iteration with Vite
- Simpler deployment (static hosting on Netlify/Vercel/Cloudflare Pages)

**Confidence:** HIGH (React/Vite are standard for stateless SPAs)

### YouTube Integration
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `youtube-transcript` | ^1.1.x | Extract captions | Mature library, no API key required, works directly with YouTube caption tracks |
| `@googleapis/youtube` | ^13.x | Channel/video listing | Official Google YouTube Data API v3 client |

**Rationale:**
- **YouTube Data API v3** (via `@googleapis/youtube`) is required for channel video listings and metadata. Requires API key but has generous free quota.
- **`youtube-transcript`** library extracts captions without authentication by parsing YouTube's caption endpoints. No Whisper needed.
- Alternative: `youtubei.js` (unofficial, more features but less stable)

**Confidence:** MEDIUM (based on training data, external verification unavailable)

**CRITICAL NOTE:** YouTube Data API requires an API key. User must provide their own Google API key in addition to Anthropic API key, OR the app uses a shared quota (risky for abuse). Consider:
- Option A: User provides Google API key + Anthropic API key
- Option B: App backend proxies YouTube requests (requires server, contradicts stateless requirement)
- Option C: Use `youtubei.js` (unofficial, no API key, higher risk of breakage)

**Recommendation:** Start with Option A (user-provided keys). If UX friction is too high, pivot to Option C.

### LLM Integration
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@anthropic-ai/sdk` | ^0.27.x | Claude API client | Official Anthropic SDK, supports streaming, structured output |

**Rationale:**
- Official SDK with TypeScript support
- Handles streaming for progress updates
- Works in browser with CORS (Anthropic allows browser-based API calls)
- User provides their own API key, no server proxy needed

**Confidence:** HIGH (official SDK, well-documented)

### UI & State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 3.4.x | Styling | Rapid UI development, no custom CSS needed, excellent for one-off projects |
| shadcn/ui | latest | Component library | Accessible, customizable components built on Radix UI + Tailwind |
| Zustand | 4.5.x | State management | Lightweight state (selected videos, processing status), simpler than Redux for small apps |

**Rationale:**
- **Tailwind + shadcn/ui** is the 2025 standard for rapid React UI development
- **Zustand** for client state (selected videos, API keys, processing progress) — overkill to use Redux/RTK for this
- No need for React Query/TanStack Query (no server state to cache)

**Confidence:** HIGH (current best practices for React SPAs)

### File Generation & Download
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `jszip` | ^3.10.x | Create zip files | Browser-compatible, generates zip in memory |
| `file-saver` | ^2.0.x | Trigger download | Cross-browser download API wrapper |

**Rationale:**
- Markdown files generated in memory, zipped with `jszip`, downloaded with `file-saver`
- No server-side file storage needed
- Works entirely client-side

**Confidence:** HIGH (standard libraries for browser file operations)

### Development Tools
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ESLint | 8.x | Linting | Code quality enforcement |
| Prettier | 3.x | Formatting | Consistent code style |
| Vitest | 1.x | Testing | Vite-native test runner, faster than Jest |

**Confidence:** HIGH (standard tooling)

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Frontend Framework | Vite + React | Next.js | No SSR/API routes needed, Vite is simpler and faster for SPAs |
| Frontend Framework | Vite + React | SvelteKit | Smaller ecosystem, React has better YouTube/API libraries |
| State Management | Zustand | Redux Toolkit | Overkill for simple client state |
| State Management | Zustand | Jotai/Recoil | Zustand is simpler for this use case |
| YouTube Transcripts | `youtube-transcript` | `youtubei.js` | Less stable (unofficial API), but fallback if API key friction is too high |
| YouTube Transcripts | `youtube-transcript` | Whisper | Out of scope per requirements |
| UI Library | shadcn/ui | Material-UI | MUI is heavier, shadcn is more modern and customizable |
| UI Library | shadcn/ui | Chakra UI | Chakra is transitioning to Ark UI, shadcn is more stable |
| Build Tool | Vite | Create React App | CRA is deprecated, Vite is the modern standard |

---

## Installation

```bash
# Create project
npm create vite@latest youtube-knowledge-extractor -- --template react-ts

# Core dependencies
npm install @anthropic-ai/sdk @googleapis/youtube youtube-transcript zustand jszip file-saver

# UI dependencies
npm install tailwindcss postcss autoprefixer
npm install -D @types/file-saver

# shadcn/ui (follow official setup)
npx shadcn-ui@latest init

# Dev dependencies
npm install -D eslint prettier vitest @vitejs/plugin-react
```

---

## Architecture Notes

### API Key Management
- Store API keys in Zustand store (ephemeral, session-only)
- Warn users that keys are client-side (visible in DevTools)
- No server-side storage

### CORS Handling
- **Anthropic API:** Supports browser CORS (can call directly from client)
- **YouTube Data API:** Supports browser CORS
- **YouTube Transcript API:** `youtube-transcript` library handles this (fetches via YouTube's public endpoints)

### Deployment
- Static site hosting: Netlify, Vercel, Cloudflare Pages
- No backend needed
- Environment variables: None (all keys user-provided)

---

## Known Limitations & Risks

### YouTube API Quota
- YouTube Data API has daily quota limits (10,000 units/day default)
- Listing videos costs 1 unit per request
- If user-provided API key, they hit their own quota
- If shared API key, app quota exhausted quickly

**Mitigation:** Require user-provided YouTube API key OR use `youtubei.js` (no quota but unofficial)

### YouTube Transcript Availability
- Not all videos have captions
- Some videos have auto-generated captions only
- `youtube-transcript` library may break if YouTube changes their caption API

**Mitigation:** Handle missing captions gracefully, show clear error messages

### Claude API Rate Limits
- User's API key has rate limits
- Processing many videos may hit rate limits
- Need backoff/retry logic

**Mitigation:** Process videos sequentially with progress updates, implement retry logic

### Client-Side Security
- API keys visible in browser memory
- Users must trust the app not to exfiltrate keys
- No way to fully secure client-side API calls

**Mitigation:** Open-source the project, clear privacy policy, local-first approach

---

## Sources

- Training data (January 2025 knowledge cutoff)
- Project requirements from PROJECT.md
- Architecture constraints: stateless, no auth, client-side only

**Verification Status:** External documentation verification unavailable (WebSearch and WebFetch disabled). Confidence levels reflect reliance on training data.

---

## Recommendations for Roadmap

### Phase 1: Core Flow (MVP)
- Vite + React + TypeScript setup
- YouTube Data API integration (hardcoded channel for testing)
- Single video transcript extraction
- Single video Claude summarization
- Download single markdown file

### Phase 2: Batch Processing
- Multi-video selection
- Batch processing with progress UI
- Zip generation and download

### Phase 3: UX Polish
- API key management UI
- Error handling and retry logic
- Loading states and progress indicators
- Channel pagination

### Phase 4: Optimization
- Parallel processing (where rate limits allow)
- Caching transcript fetches (session-only)
- Cost estimation before processing

---

## Open Questions for Phase-Specific Research

1. **YouTube API Key Strategy:** User-provided vs shared vs `youtubei.js`?
2. **Claude API Streaming:** Use streaming for real-time progress or batch processing?
3. **Markdown Structure:** What's the optimal prompt for structured summaries?
4. **Rate Limiting:** How to handle Claude API rate limits gracefully?

These should be researched during Phase 1 implementation.
