# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Extract structured knowledge from YouTube video transcripts quickly and in bulk
**Current focus:** Phase 3 complete, ready for Phase 4

## Current Position

Phase: 4 of 6 (Transcript Extraction) — IN PROGRESS
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-30 — Completed 04-02-PLAN.md

Progress: [█████░░░░░] 53% (9/17 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 3.1 min
- Total execution time: 0.54 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation & Configuration | 2/2 | 12.5 min | 6.3 min |
| 2. Channel Video Listing | 3/3 | 12.7 min | 4.2 min |
| 3. Video Selection | 2/2 | 4 min | 2 min |
| 4. Transcript Extraction | 2/3 | 2.6 min | 1.3 min |
| 5. Claude Summarization | 0/4 | 0 min | - |
| 6. Export & Download | 0/3 | 0 min | - |

**Recent Trend:**
- Last 5 plans: 03-01 (3 min), 03-02 (1 min), 04-01 (1.1 min), 04-02 (1.5 min)
- Trend: Highly efficient, sub-2min average

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Web app (not CLI) for browser-based interface
- YouTube captions only (no Whisper) for faster, simpler processing
- User-provided API keys to avoid server-side secret management
- Structured summary format (title + key points + topics + quotes) for consistency
- Download as zip for clean delivery of multiple markdown files

**From 01-01:**
- Use Tailwind CSS v4 with CSS-first configuration (@theme inline)
- Use shadcn/ui component library for UI components
- Configure @/ path alias for clean imports

**From 01-02:**
- Use React Context + sessionStorage for API key management
- Use React Hook Form + Zod for form validation
- Use `import type` for TypeScript interfaces in Vite projects

**From 02-01:**
- Use vitest for testing (lightweight, fast, Vite-native)
- Support all YouTube URL formats (@handle, /c/, /channel/, /user/) plus bare inputs
- Follow TDD methodology (RED-GREEN-REFACTOR) for robust feature development

**From 02-02:**
- Use native Intl.DateTimeFormat instead of date-fns for PT midnight calculation (avoid dependencies)
- Cache channels for 24h, videos for 1h to balance freshness and quota conservation
- Track quota in sessionStorage (per-session), exhaustion flag persists across refreshes
- Use channels.list (1 unit) instead of search.list (100 units) for channel resolution

**From 02-03:**
- API keys independently saveable — YouTube key alone enables channel browsing
- Help links inline in form fields pointing to platform consoles

**From 03-01:**
- Use useSyncExternalStore for sessionStorage sync instead of manual event listeners
- Store Set as Array in sessionStorage (Set not JSON-serializable)
- Auto-clear selection on channel switch detected via video ID comparison
- Configure vitest with jsdom environment for component testing

**From 03-02:**
- Use Radix UI Checkbox checked="indeterminate" prop for partial selection state (not DOM ref approach)
- Prune stale selections continuously in useVideoSelection via useEffect filtering
- SelectionToolbar returns null when totalCount is 0 (no videos loaded)
- Clear selection triggers when checkbox clicked in all-selected or indeterminate state

**From 04-01:**
- Use Vercel Edge Functions for transcript proxy to bypass CORS restrictions
- 15-second timeout for caption extraction balances UX and availability
- Differentiate error types (400 missing param, 404 no captions, 500 timeout) for better client handling

**From 04-02:**
- Use p-limit for concurrency control (5 concurrent requests max) to avoid overwhelming YouTube
- Return structured TranscriptResult per video with status field ('success' | 'error')
- Handle errors gracefully with specific error messages (network, no captions)

### Pending Todos

None yet.

### Blockers/Concerns

**Research insights flagged for planning:**
- Phase 4: 20-40% of YouTube videos lack captions—need graceful handling with clear UI indicators
- Phase 5: Long videos (>1 hour) produce 50K-150K token transcripts requiring chunking strategy before MVP—this is blocking

## Session Continuity

Last session: 2026-01-30T05:17:31Z
Stopped at: Completed 04-02-PLAN.md
Resume file: None

---
*Created: 2026-01-29*
*Last updated: 2026-01-30T05:17:31Z*
