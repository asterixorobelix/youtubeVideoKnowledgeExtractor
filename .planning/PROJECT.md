# YouTube Video Knowledge Extractor

## What This Is

A web application that takes a YouTube channel URL, lists its videos, and lets the user select videos to extract transcripts from and summarize using Claude. Summaries are structured (title, key points, topics, notable quotes) and downloadable as a zip of markdown files. Built with Vite + React 19 + TypeScript, deployed on Vercel with Edge Function proxies.

## Core Value

Extract structured knowledge from YouTube video transcripts quickly and in bulk — turning video content into searchable, portable markdown.

## Requirements

### Validated

- ✓ User can paste a YouTube channel URL and see a paginated list of its videos — v1.0
- ✓ User can select individual videos or select all to process — v1.0
- ✓ System extracts YouTube captions/subtitles for selected videos — v1.0
- ✓ System sends transcripts to Claude API for structured summarization — v1.0
- ✓ Each summary includes: title, key points, topics covered, notable quotes — v1.0
- ✓ User can download all summaries as a zip of markdown files — v1.0
- ✓ User provides their own Anthropic API key via the UI — v1.0
- ✓ UI shows processing progress as videos are summarized — v1.0
- ✓ Pagination or "load more" for channels with many videos — v1.0

### Active

(None — define with `/gsd:new-milestone`)

### Out of Scope

- User accounts / authentication — single-session tool, no persistence needed
- Whisper/audio transcription — relying on YouTube captions only, keeps scope manageable
- Video download — only transcripts, not media files
- Multiple LLM providers — Claude API only for v1
- Persistent storage / database — stateless, no server-side data retention
- Browser extension — web app only
- Playlist support — channels only for v1
- Multi-language caption selection — use default available captions
- Offline mode — web app requires API access

## Context

Shipped v1.0 MVP with 11,276 LOC TypeScript/React across 115 files.
Tech stack: Vite + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui, Vercel Edge Functions.
Client-side architecture: React Context for state, sessionStorage for persistence, JSZip for export.
API proxies: Vercel Edge Functions for YouTube caption extraction and Claude API access.
20-40% of YouTube videos lack captions — handled gracefully with clear UI indicators.
Long transcripts (50K+ tokens) handled via map-reduce chunking with 10% overlap.

## Constraints

- **API Key**: User-provided Anthropic + YouTube API keys — no server-side key management
- **Captions Only**: Videos without YouTube captions cannot be processed (no Whisper fallback)
- **Rate Limits**: YouTube API has quota limits; caching and quota tracking mitigate
- **Claude API Costs**: Each video summary costs tokens — UI shows estimated cost before processing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app (not CLI) | User wants browser-based interface | ✓ Good |
| YouTube captions only (no Whisper) | Faster, simpler, no audio processing needed | ✓ Good |
| Claude API for summarization | User preference | ✓ Good |
| User-provided API key | No server-side secret management, simpler deployment | ✓ Good |
| Structured summary format | Title + key points + topics + quotes for consistent output | ✓ Good |
| Download as zip | Clean delivery of multiple markdown files | ✓ Good |
| Vite + React 19 + TypeScript | Modern tooling, fast dev experience | ✓ Good |
| Tailwind CSS v4 (CSS-first) | New CSS-first config, no tailwind.config.js needed | ✓ Good |
| shadcn/ui + Radix UI | Accessible, composable UI primitives | ✓ Good |
| Vercel Edge Functions | CORS proxy for YouTube + Claude APIs | ✓ Good |
| sessionStorage (not localStorage) | API keys clear on tab close for security | ✓ Good |
| p-limit concurrency (5 max) | Prevents overwhelming YouTube rate limits | ✓ Good |
| Map-reduce chunking | Handles 50K+ token transcripts without context window overflow | ✓ Good |
| JSZip client-side | No server needed for zip generation | ✓ Good |
| Derived state for completion | Eliminates race condition vs explicit dispatch | ✓ Good |

---
*Last updated: 2026-01-31 after v1.0 milestone*
