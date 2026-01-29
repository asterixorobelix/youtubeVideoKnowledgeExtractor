# YouTube Video Knowledge Extractor

## What This Is

A web application that takes a YouTube channel URL, lists its videos, and lets the user select videos to extract transcripts from and summarize using Claude. Summaries are structured (title, key points, topics, notable quotes) and downloadable as a zip of markdown files.

## Core Value

Extract structured knowledge from YouTube video transcripts quickly and in bulk — turning video content into searchable, portable markdown.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can paste a YouTube channel URL and see a paginated list of its videos (most recent first)
- [ ] User can select individual videos or select all to process
- [ ] System extracts YouTube captions/subtitles for selected videos
- [ ] System sends transcripts to Claude API for structured summarization
- [ ] Each summary includes: title, key points, topics covered, notable quotes
- [ ] User can download all summaries as a zip of markdown files
- [ ] User provides their own Anthropic API key via the UI
- [ ] UI shows processing progress as videos are summarized
- [ ] Pagination or "load more" for channels with many videos

### Out of Scope

- User accounts / authentication — single-session tool, no persistence needed
- Whisper/audio transcription — relying on YouTube captions only
- Video download — only transcripts, not media files
- Multiple LLM providers — Claude API only for v1
- Persistent storage / database — stateless, no server-side data retention
- Browser extension — web app only

## Context

- YouTube Data API v3 provides channel video listings
- YouTube captions can be fetched via youtube-transcript-api (Python) or similar libraries
- Claude API handles summarization with structured output
- steipete/summarize is a reference project for video summarization patterns, though it's a CLI + browser extension rather than a web app
- Videos without captions will be skipped with a clear indicator to the user

## Constraints

- **API Key**: User-provided Anthropic API key — no server-side key management
- **Captions Only**: Videos without YouTube captions cannot be processed (no Whisper fallback)
- **Rate Limits**: YouTube API has quota limits; need to handle pagination and not fetch everything at once
- **Claude API Costs**: Each video summary costs tokens — UI should show estimated cost or video count before processing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app (not CLI) | User wants browser-based interface | — Pending |
| YouTube captions only (no Whisper) | Faster, simpler, no audio processing needed | — Pending |
| Claude API for summarization | User preference | — Pending |
| User-provided API key | No server-side secret management, simpler deployment | — Pending |
| Structured summary format | Title + key points + topics + quotes for consistent output | — Pending |
| Download as zip | Clean delivery of multiple markdown files | — Pending |

---
*Last updated: 2026-01-29 after initialization*
