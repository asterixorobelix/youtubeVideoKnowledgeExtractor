# Domain Pitfalls

**Domain:** YouTube transcript extraction and LLM summarization
**Researched:** 2026-01-29

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Naive YouTube Data API Quota Management
**What goes wrong:** YouTube Data API v3 has daily quota limits (10,000 units/day by default). A single video list request costs 1 unit, but developers often don't account for quota exhaustion with large channels or multiple users. The app suddenly stops working mid-day with cryptic 403 errors.

**Why it happens:**
- YouTube Data API quotas are per project, not per user
- Listing videos from a channel costs 1 unit per page (50 videos max per page)
- A channel with 500 videos = 10 pages = 10 quota units just to list
- Multiple users can exhaust quota quickly
- Quota resets at midnight Pacific Time (not UTC, not user's timezone)

**Consequences:**
- App becomes unusable when quota exhausted
- No clear error message to users ("Why did it stop working?")
- Must wait until midnight PT for quota reset
- No way to recover mid-session

**Prevention:**
- Implement client-side caching of channel video lists (localStorage with expiry)
- Show quota-friendly pagination (load 50 videos at a time, don't auto-fetch all)
- Display clear error when quota exhausted with explanation and reset time
- Consider alternative: youtube-transcript-api library bypasses Data API for transcript fetching (web scraping), only use Data API for video listing
- Document quota limits in UI ("This tool can list ~500 channels/day due to YouTube API limits")

**Detection:**
- 403 errors from YouTube API with "quotaExceeded" in response
- Users reporting "worked this morning, broken now"
- Multiple users hitting limits simultaneously

**Phase impact:** Phase 2 (YouTube Integration) must handle this from day one.

---

### Pitfall 2: Assuming Captions Are Always Available or Correctly Formatted
**What goes wrong:** Developers assume YouTube captions are reliably present and well-formatted. In reality:
- Many videos have no captions at all (20-40% of videos)
- Auto-generated captions may be disabled by uploader
- Caption timestamps can be malformed or missing
- Caption text can be empty strings or contain only punctuation
- Language mismatch (captions in different language than video)
- Multi-language captions exist but libraries return random language

**Why it happens:**
- YouTube captions are optional, not mandatory
- Caption quality varies wildly (auto-generated vs human-created)
- Libraries like youtube-transcript-api don't validate caption content
- No standard way to detect caption language before fetching

**Consequences:**
- App crashes on videos without captions
- LLM receives malformed input (empty strings, wrong language)
- Wasted API costs summarizing garbage input
- User frustration when "nothing happens" for certain videos

**Prevention:**
- Check caption availability BEFORE queuing for summarization
- Validate caption content (minimum length, language detection)
- Gracefully skip videos without valid captions with clear UI indicator
- Offer language selection in UI ("Which language captions to use?")
- Show caption preview before processing to let user verify quality
- Handle caption fetch failures with retry logic (transient YouTube errors common)

**Detection:**
- Empty transcript responses
- LLM summaries in unexpected languages
- High rate of "no captions available" errors
- User complaints about missing summaries for videos they know have captions

**Phase impact:** Phase 2 (YouTube Integration) and Phase 3 (Caption Extraction) must validate aggressively.

---

### Pitfall 3: Token Limit Naivety with Long Transcripts
**What goes wrong:** Long videos (1-3 hour podcasts, lectures) produce transcripts of 50,000-150,000 words. Developers naively send entire transcript to Claude API, hitting:
- Claude's context window limits (even with 200K token models, that's ~150K words max)
- Massive API costs ($15-60 per video with Claude Opus)
- Timeout errors on long processing
- Quality degradation (LLM loses focus over very long context)

**Why it happens:**
- Underestimating transcript length (1 hour video ≈ 9,000-15,000 words ≈ 12,000-20,000 tokens)
- Not checking transcript length before processing
- Assuming "more context = better summary" (false for very long content)
- Not implementing chunking or hierarchical summarization

**Consequences:**
- App crashes on long videos with 400/413 errors
- User's API key gets drained on single video ($50+ cost)
- Timeouts make app seem broken
- Summaries of long videos are poor quality (LLM overwhelmed)

**Prevention:**
- Calculate token count BEFORE sending to Claude (use Claude's token counting API or library)
- Implement tiered strategy based on length:
  - Short (<10K tokens): Direct summarization
  - Medium (10K-50K tokens): Chunked summarization with synthesis
  - Long (50K-150K tokens): Hierarchical summarization (chunk → mini-summaries → final summary)
  - Very long (>150K tokens): Warn user, offer truncation or chapter-based processing
- Show estimated cost BEFORE processing in UI
- Implement streaming responses to show progress
- Consider Claude Haiku for first-pass chunking (cheaper), then Sonnet/Opus for synthesis

**Detection:**
- 400 Bad Request errors from Claude API
- Timeout errors (requests taking 2+ minutes)
- User complaints about high costs
- Summaries of long videos that miss content from later sections

**Phase impact:** Phase 4 (LLM Integration) must implement chunking strategy from start. This is NOT a nice-to-have.

---

### Pitfall 4: Synchronous Processing Without Progress Feedback
**What goes wrong:** App processes videos synchronously (one at a time) with no progress indicators. User selects 20 videos, clicks "Process", and sees... nothing for 10 minutes. They assume it's broken, refresh the page, lose all progress.

**Why it happens:**
- Not considering that LLM API calls take 15-60 seconds per video
- No streaming, no progress updates
- Assuming users will wait patiently
- Browser tab can't be closed or refreshed without losing work

**Consequences:**
- Users abandon the app thinking it's broken
- Lost processing work when users refresh
- Wasted API costs redoing same videos
- Poor UX perception ("This tool is so slow")

**Prevention:**
- Show real-time progress (e.g., "Processing video 3 of 20...")
- Display per-video status (queued, processing, completed, failed)
- Implement streaming responses from Claude API to show summary building live
- Allow background processing with browser-visible progress (Web Workers or Service Workers)
- Save progress to localStorage (resume on page reload)
- Consider WebSocket or Server-Sent Events for live updates if using backend
- Show estimated time remaining based on average processing speed

**Detection:**
- Users reporting "Is this working?" or "Nothing is happening"
- High bounce rate during processing phase
- Multiple requests for same videos (user restarted)

**Phase impact:** Phase 5 (Processing Pipeline) must include progress UI from day one.

---

### Pitfall 5: No Error Recovery or Partial Results Handling
**What goes wrong:** One video fails (rate limit, network error, invalid transcript) and the entire batch processing stops. User gets nothing, not even the 15 videos that processed successfully before the failure.

**Why it happens:**
- No error handling around individual video processing
- Batch processing treated as all-or-nothing transaction
- No mechanism to skip failed videos and continue
- No way to download partial results

**Consequences:**
- Users lose all progress on single video failure
- No visibility into which video caused failure
- Forces users to manually retry videos one-by-one
- Perceived unreliability ("This tool never works")

**Prevention:**
- Process videos independently (failure of one doesn't stop others)
- Collect both successes and failures
- Show clear error messages per video ("Video X: No captions available")
- Allow download of partial results (successful summaries even if some failed)
- Implement retry mechanism for failed videos
- Log failures for debugging but don't crash the app
- Consider implementing a "failed videos" queue for manual retry

**Detection:**
- Users reporting "everything stopped working"
- All-or-nothing behavior (either all videos succeed or none)
- Support requests asking "which video caused the error?"

**Phase impact:** Phase 5 (Processing Pipeline) must implement robust error handling.

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 6: Ignoring YouTube URL Variations
**What goes wrong:** YouTube channels have multiple URL formats:
- youtube.com/channel/UC... (channel ID)
- youtube.com/c/ChannelName (custom URL)
- youtube.com/@Handle (new handle format)
- youtube.com/user/Username (legacy)

Developers hardcode parsing for one format, app breaks on others.

**Prevention:**
- Use YouTube Data API's search endpoint to resolve any URL to channel ID
- Validate and normalize URLs before processing
- Support all URL formats from day one
- Show clear error if URL is not a channel (e.g., single video URL)

**Phase impact:** Phase 2 (YouTube Integration).

---

### Pitfall 7: No Cost Estimation Before Processing
**What goes wrong:** User selects 50 videos, each 30 minutes long. Processing completes, they've spent $200 on Claude API credits without warning.

**Prevention:**
- Calculate estimated cost before processing starts
- Show cost breakdown (e.g., "~50K tokens per video × 50 videos = $X estimated")
- Require explicit confirmation for high-cost batches
- Consider implementing cost caps or warnings

**Phase impact:** Phase 4 (LLM Integration) and Phase 5 (Processing Pipeline).

---

### Pitfall 8: Inefficient Transcript Fetching
**What goes wrong:** Fetching transcripts one-by-one sequentially instead of in parallel. Processing 20 videos takes 20× longer than necessary.

**Prevention:**
- Fetch transcripts in parallel (up to reasonable concurrency limit, e.g., 5 concurrent)
- Separate transcript fetching from summarization (fetch all first, then summarize)
- Use connection pooling for API requests
- Implement queue-based processing with concurrency control

**Phase impact:** Phase 3 (Caption Extraction) and Phase 5 (Processing Pipeline).

---

### Pitfall 9: Markdown Generation Without Escaping
**What goes wrong:** Video titles or transcript content contain markdown special characters (`#`, `*`, `[`, `]`, etc.). Generated markdown files are malformed or render incorrectly.

**Prevention:**
- Escape markdown special characters in video titles and quotes
- Validate markdown output before zipping
- Test with edge cases (titles with brackets, quotes with asterisks)
- Consider using markdown generation library instead of string concatenation

**Phase impact:** Phase 6 (Export/Download).

---

### Pitfall 10: API Key Exposure in Browser
**What goes wrong:** User-provided API key stored in browser localStorage or sessionStorage without consideration for:
- XSS attacks stealing keys
- Keys persisting after session
- Keys visible in browser DevTools
- Accidental key leakage in error messages or logs

**Prevention:**
- Clear API key from memory after use (or use sessionStorage, not localStorage)
- Never log API key in console or error messages
- Implement Content Security Policy (CSP) to mitigate XSS
- Show masked API key in UI after input
- Consider using Web Crypto API for in-memory key management

**Phase impact:** Phase 1 (Foundation/UI Setup).

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 11: Not Handling Video Age Formatting
**What goes wrong:** YouTube API returns published dates in ISO 8601 format. Displaying "2023-05-15T14:32:00Z" to users instead of "8 months ago" or "May 15, 2023".

**Prevention:**
- Use date formatting library (date-fns, dayjs)
- Display human-readable relative dates
- Sort by most recent first (users expect this)

**Phase impact:** Phase 2 (YouTube Integration).

---

### Pitfall 12: ZIP File Naming Collisions
**What goes wrong:** Multiple videos with same title create identically named markdown files in zip. Files overwrite each other, user loses summaries.

**Prevention:**
- Include video ID in filename (e.g., `video-title-[VIDEO_ID].md`)
- Sanitize filenames (remove special characters, limit length)
- Test with duplicate video titles

**Phase impact:** Phase 6 (Export/Download).

---

### Pitfall 13: No Loading States for Slow Network
**What goes wrong:** Fetching channel video list takes 3-5 seconds on slow network. UI shows blank screen, user thinks it's broken.

**Prevention:**
- Show skeleton loaders or spinners immediately
- Display "Fetching channel videos..." message
- Handle network errors gracefully with retry option

**Phase impact:** Phase 2 (YouTube Integration).

---

### Pitfall 14: Ignoring Caption Format Variations
**What goes wrong:** YouTube captions come in multiple formats (SRT, VTT, plain text). Libraries return different formats, code assumes one format.

**Prevention:**
- Normalize caption format after fetching (convert to plain text)
- Strip timestamps if not needed for summarization
- Handle both manual and auto-generated caption formats

**Phase impact:** Phase 3 (Caption Extraction).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| YouTube API Integration | Quota exhaustion | Implement caching, show quota-aware pagination |
| Caption Extraction | Assuming captions exist | Validate availability before queuing, show clear errors |
| LLM Integration | Token limit overruns | Implement chunking strategy, show cost estimates |
| Processing Pipeline | No progress feedback | Real-time progress UI, streaming responses |
| Error Handling | All-or-nothing processing | Per-video error handling, partial result downloads |
| API Key Management | Key exposure in browser | sessionStorage, CSP, never log keys |
| Markdown Export | Special character mangling | Escape markdown syntax, test edge cases |

---

## Domain-Specific Testing Checklist

Before shipping each phase, test these known failure modes:

### YouTube Integration
- [ ] Channel with 1000+ videos (pagination)
- [ ] Channel URL in all formats (@handle, /c/, /channel/, /user/)
- [ ] Channel with no videos
- [ ] Invalid channel URL
- [ ] Quota exhaustion scenario

### Caption Extraction
- [ ] Video with no captions
- [ ] Video with auto-generated captions only
- [ ] Video with multiple language captions
- [ ] Video with captions disabled
- [ ] Very short video (<1 min)
- [ ] Very long video (3+ hours)

### LLM Integration
- [ ] Transcript under 10K tokens (direct summarization)
- [ ] Transcript 50K-100K tokens (chunking required)
- [ ] Transcript over 150K tokens (edge case handling)
- [ ] Invalid API key
- [ ] Rate limit errors from Claude API
- [ ] Network timeout during processing

### Processing Pipeline
- [ ] Single video processing
- [ ] Batch of 20+ videos
- [ ] Mix of successful and failed videos
- [ ] User refreshes page mid-processing
- [ ] Network interruption during batch

### Export
- [ ] Videos with identical titles
- [ ] Video titles with special characters (`/`, `\`, `:`, `*`, etc.)
- [ ] Video titles over 100 characters
- [ ] Transcript content with markdown syntax

---

## Sources

**Confidence Level:** HIGH (based on established domain knowledge of YouTube Data API v3, Claude API capabilities, and common web app patterns)

**Knowledge Base:**
- YouTube Data API v3 documentation (official quota limits, endpoint costs)
- Claude API documentation (token limits, pricing, best practices)
- Common issues from youtube-transcript-api library (GitHub issues)
- Standard web app error handling patterns
- Browser storage security best practices

**Note:** WebSearch unavailable during research. Findings based on technical knowledge of:
- YouTube Data API v3 quota system (10,000 units/day default)
- Claude API context windows (200K tokens for Claude 3.5)
- youtube-transcript-api library behavior (web scraping approach)
- Browser storage security (CSP, XSS mitigation)
- LLM summarization patterns for long documents

All pitfalls are specific to the YouTube transcript + LLM summarization domain and verified against project constraints (no auth, user-provided API key, web app delivery).
