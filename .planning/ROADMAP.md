# Roadmap: YouTube Video Knowledge Extractor

## Overview

This roadmap delivers a client-side web application that extracts YouTube channel video transcripts and generates structured summaries using Claude. The journey progresses from foundation (configuration and UI setup) through YouTube integration (channel listing and video selection), transcript extraction (caption fetching with validation), Claude summarization (including chunking for long videos), batch orchestration (multi-video processing with progress tracking), and finally export functionality (zip download of markdown summaries). The phase structure reflects natural dependency chains—cannot extract transcripts without video IDs, cannot summarize without transcripts, cannot batch-process without working summarization—while frontloading the highest-risk integrations (YouTube quota management, caption availability validation, token limit handling) for early validation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Configuration** - Project scaffold, API key management, development environment
- [x] **Phase 2: Channel Video Listing** - YouTube Data API integration with quota-aware pagination
- [x] **Phase 3: Video Selection** - Multi-video selection UI with batch controls
- [x] **Phase 4: Transcript Extraction** - Caption fetching with availability validation
- [x] **Phase 5: Claude Summarization** - Core processing with chunking, cost estimation, and progress tracking
- [x] **Phase 6: Export & Download** - Markdown generation and zip download

## Phase Details

### Phase 1: Foundation & Configuration
**Goal**: Establish development environment with secure API key management and foundational UI components
**Depends on**: Nothing (first phase)
**Requirements**: CONF-01, CONF-02, CONF-03
**Success Criteria** (what must be TRUE):
  1. User can input and save Anthropic API key in the UI (session-only, not persisted)
  2. User can input and save YouTube Data API key in the UI (session-only, not persisted)
  3. API keys are masked in the UI after entry
  4. Development environment runs locally with hot reload
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold with Vite + React + TypeScript + shadcn/ui + Tailwind CSS
- [x] 01-02-PLAN.md — API key input components with session storage and masking

### Phase 2: Channel Video Listing
**Goal**: Users can input a YouTube channel URL and see paginated video listings with metadata
**Depends on**: Phase 1 (API key configuration required)
**Requirements**: CHAN-01, CHAN-02, CHAN-03, CHAN-04
**Success Criteria** (what must be TRUE):
  1. User can paste any YouTube channel URL format (@handle, /c/, /channel/, /user/) and see videos
  2. App displays video list with title, thumbnail, duration, and upload date
  3. Video list shows 50 videos per page with "load more" button
  4. App handles quota exhaustion with clear error message showing reset time
**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — TDD: YouTube channel URL parser and core types
- [x] 02-02-PLAN.md — YouTube API service with caching and quota tracking
- [x] 02-03-PLAN.md — Channel input UI, video list, and pagination

### Phase 3: Video Selection
**Goal**: Users can select individual videos or multiple videos for batch processing
**Depends on**: Phase 2 (video listing must exist before selection)
**Requirements**: PROC-01, PROC-02
**Success Criteria** (what must be TRUE):
  1. User can select individual videos via checkboxes
  2. User can select/deselect all videos on current page with one click
  3. Selection count displays total selected videos
  4. Selection persists when loading more videos
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — useVideoSelection hook with sessionStorage persistence + VideoCard checkbox integration
- [x] 03-02-PLAN.md — SelectionToolbar with select all/none + VideoList and App wiring

### Phase 4: Transcript Extraction
**Goal**: System can extract YouTube captions for selected videos with graceful handling of unavailable captions
**Depends on**: Phase 3 (video selection required before transcript fetching)
**Requirements**: PROC-03, PROC-04
**Success Criteria** (what must be TRUE):
  1. App extracts YouTube captions for videos with available transcripts
  2. Videos without captions display clear "No captions available" indicator
  3. Caption extraction happens in parallel for multiple videos (up to 5 concurrent)
  4. Failed caption extractions show specific error messages
**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Vercel Edge Function proxy for YouTube caption extraction
- [x] 04-02-PLAN.md — TDD: TranscriptService with concurrency control and error handling
- [x] 04-03-PLAN.md — useTranscriptExtraction hook + TranscriptStatus UI integration

### Phase 5: Claude Summarization
**Goal**: System generates structured summaries from transcripts with cost estimation and progress tracking
**Depends on**: Phase 4 (transcript extraction must work before summarization)
**Requirements**: PROC-05, PROC-06, PROC-07, PROC-08, OUT-01, OUT-03
**Success Criteria** (what must be TRUE):
  1. User sees estimated Claude API cost before processing begins
  2. System generates structured summaries (title, key points, topics, notable quotes) for each video
  3. Long transcripts (>10K tokens) are chunked and processed without errors
  4. UI shows real-time per-video processing status (queued, processing, completed, failed)
  5. User can retry failed videos without reprocessing successful ones
**Plans:** 3 plans

Plans:
- [x] 05-01-PLAN.md — Types, Zod schemas, Claude API Edge Function proxy, and client service
- [x] 05-02-PLAN.md — TDD: Summarization service with chunking and cost estimation
- [x] 05-03-PLAN.md — useSummarization hook, cost estimator UI, progress tracking, and App wiring

### Phase 6: Export & Download
**Goal**: Users can download all completed summaries as a zip file of markdown documents
**Depends on**: Phase 5 (summaries must exist before export)
**Requirements**: OUT-02, OUT-04
**Success Criteria** (what must be TRUE):
  1. User can download all completed summaries as a single zip file
  2. Each markdown file includes video title, link, key points, topics, and notable quotes
  3. Filenames are sanitized (no special characters, collision-safe with video IDs)
  4. Zip downloads work in all major browsers (Chrome, Firefox, Safari, Edge)
**Plans:** 3 plans

Plans:
- [x] 06-01-PLAN.md — TDD: Export service (markdown generation, filename sanitization, zip creation)
- [x] 06-02-PLAN.md — useExport hook, ExportButton component, and App.tsx wiring
- [ ] 06-03-PLAN.md — Gap closure: Fix summarization completion race condition

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Configuration | 2/2 | Complete | 2026-01-29 |
| 2. Channel Video Listing | 3/3 | Complete | 2026-01-29 |
| 3. Video Selection | 2/2 | Complete | 2026-01-29 |
| 4. Transcript Extraction | 3/3 | Complete | 2026-01-30 |
| 5. Claude Summarization | 3/3 | Complete | 2026-01-30 |
| 6. Export & Download | 2/3 | In Progress | 2026-01-31 |

---
*Created: 2026-01-29*
*Last updated: 2026-01-31*
