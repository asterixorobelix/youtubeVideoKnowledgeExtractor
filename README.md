# YouTube Video Knowledge Extractor

A client-side web app that extracts YouTube channel video transcripts and generates structured summaries using Claude. Paste a channel URL, select videos, and get markdown summaries with key points, topics, and notable quotes.

## Features

- **Channel Video Listing** — Paste any YouTube channel URL format (`@handle`, `/c/`, `/channel/`, `/user/`) and browse videos with thumbnails, titles, and upload dates
- **Quota-Aware API Usage** — Uses `channels.list` + `playlistItems.list` (1 unit each) instead of `search.list` (100 units), with localStorage caching and quota exhaustion detection
- **Client-Side Only** — All API keys stay in your browser (localStorage). No server, no secrets to manage.
- **Pagination** — Load 50 videos at a time with "Load More" support

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) key

## Getting Started

1. **Clone the repo:**

   ```bash
   git clone <repo-url>
   cd youtubeVideoKnowledgeExtractor
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the dev server:**

   ```bash
   npm run dev
   ```

4. **Open the app** at the URL shown in the terminal (usually http://localhost:5173).

5. **Enter your API keys** in the configuration form (see below for how to get each key).

6. **Paste a YouTube channel URL** and start browsing videos.

## API Keys

This app requires two API keys. Both stay in your browser's localStorage — nothing is sent to any server except the official API endpoints.

### YouTube Data API Key (required)

Used to look up channels and list their videos.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Navigate to **APIs & Services > Library**
4. Search for **YouTube Data API v3** and click **Enable**
5. Go to **APIs & Services > Credentials**
6. Click **Create Credentials > API Key**
7. Copy the key (starts with `AIza...`) and paste it into the app

**Quota:** The free tier provides 10,000 units/day. This app uses 1 unit per channel lookup and 1 unit per page of 50 videos — so you can browse roughly 10,000 pages before hitting the limit.

**Recommended: Restrict your key** to reduce security risk if it's ever leaked:

1. On the key creation screen (or edit the key after), find **Restrict your key to reduce security risks**
2. Leave **Application restrictions** as **None** (fine for local use)
3. Under **API restrictions**, select **Restrict key** and choose only **YouTube Data API v3**
4. Click **Save**

This ensures the key can only call the YouTube API, even if exposed.

### Anthropic API Key (required for summarization)

Used to generate structured summaries of video transcripts via Claude.

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys** in the sidebar
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-...`) and paste it into the app

**Pricing:** Anthropic charges per token. Summarizing a typical 10-minute video transcript costs roughly $0.01-0.03 depending on the model used. See [Anthropic pricing](https://www.anthropic.com/pricing) for current rates.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run tests with vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** for bundling and dev server
- **Tailwind CSS v4** for styling
- **shadcn/ui** for UI components
- **React Hook Form** + **Zod** for form validation
- **Vitest** for testing
