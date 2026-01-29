# Requirements: YouTube Video Knowledge Extractor

**Defined:** 2026-01-29
**Core Value:** Extract structured knowledge from YouTube video transcripts quickly and in bulk

## v1 Requirements

### Channel Input

- [ ] **CHAN-01**: User can paste a YouTube channel URL (supports @handle, /c/, /channel/, /user/ formats)
- [ ] **CHAN-02**: App resolves any channel URL format to a channel ID
- [ ] **CHAN-03**: App displays video list with title, thumbnail, duration, and upload date
- [ ] **CHAN-04**: Video list paginates (50 per page) with "load more" button

### Processing

- [ ] **PROC-01**: User can select individual videos via checkboxes
- [ ] **PROC-02**: User can select/deselect all videos on current page
- [ ] **PROC-03**: System extracts YouTube captions for selected videos
- [ ] **PROC-04**: System skips videos without captions with clear indicator
- [ ] **PROC-05**: System sends transcripts to Claude API for structured summarization
- [ ] **PROC-06**: Each summary includes: title, key points, topics covered, notable quotes
- [ ] **PROC-07**: System shows estimated Claude API cost before processing begins
- [ ] **PROC-08**: System handles long transcripts via chunking (>50K tokens)

### Output

- [ ] **OUT-01**: UI shows per-video processing status (queued, processing, completed, failed)
- [ ] **OUT-02**: User can download all completed summaries as a zip of markdown files
- [ ] **OUT-03**: User can retry failed videos without reprocessing successful ones
- [ ] **OUT-04**: Markdown files include video title, link, key points, topics, and quotes

### Configuration

- [ ] **CONF-01**: User provides their own Anthropic API key via the UI
- [ ] **CONF-02**: User provides their own YouTube Data API key via the UI
- [ ] **CONF-03**: API keys stored in session only (not persisted)

## v2 Requirements

### Enhanced Channel Navigation

- **CHAN-05**: User can search/filter videos by title or date within a channel

### Advanced Configuration

- **CONF-04**: User can customize the summarization prompt template
- **CONF-05**: User can choose summary output language

### Enhanced Output

- **OUT-05**: User can preview summaries inline before downloading

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / authentication | Single-session tool, no persistence needed |
| Whisper / audio transcription | YouTube captions only, keeps scope manageable |
| Video download | Only transcripts, not media files |
| Multiple LLM providers | Claude API only for v1 |
| Database / persistent storage | Stateless, no server-side data retention |
| Browser extension | Web app only |
| Playlist support | Channels only for v1 |
| Multi-language caption selection | Use default available captions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONF-01 | Phase 1 | Pending |
| CONF-02 | Phase 1 | Pending |
| CONF-03 | Phase 1 | Pending |
| CHAN-01 | Phase 2 | Pending |
| CHAN-02 | Phase 2 | Pending |
| CHAN-03 | Phase 2 | Pending |
| CHAN-04 | Phase 2 | Pending |
| PROC-01 | Phase 3 | Pending |
| PROC-02 | Phase 3 | Pending |
| PROC-03 | Phase 4 | Pending |
| PROC-04 | Phase 4 | Pending |
| PROC-05 | Phase 5 | Pending |
| PROC-06 | Phase 5 | Pending |
| PROC-07 | Phase 5 | Pending |
| PROC-08 | Phase 5 | Pending |
| OUT-01 | Phase 5 | Pending |
| OUT-03 | Phase 5 | Pending |
| OUT-02 | Phase 6 | Pending |
| OUT-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 with phase mappings*
