import type { ChannelIdentifier, ChannelInfo, VideoItem, VideosPage, YouTubeApiError } from '@/types/youtube'
import { getCached, setCache, CHANNEL_CACHE_TTL, VIDEOS_CACHE_TTL } from './cache'
import { quotaTracker } from './quota'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

/**
 * YouTube API error response structure
 */
interface YouTubeErrorResponse {
  error: {
    code: number
    message: string
    errors: Array<{
      reason: string
      domain: string
      message: string
    }>
  }
}

/**
 * YouTube channels.list API response structure
 */
interface ChannelsListResponse {
  items: Array<{
    id: string
    snippet: {
      title: string
      thumbnails: {
        default: { url: string }
        medium?: { url: string }
        high?: { url: string }
      }
    }
    contentDetails: {
      relatedPlaylists: {
        uploads: string
      }
    }
  }>
}

/**
 * YouTube playlistItems.list API response structure
 */
interface PlaylistItemsListResponse {
  items: Array<{
    snippet: {
      title: string
      publishedAt: string
      thumbnails: {
        default: { url: string }
        medium?: { url: string }
        high?: { url: string }
      }
    }
    contentDetails: {
      videoId: string
    }
  }>
  nextPageToken?: string
  pageInfo: {
    totalResults: number
  }
}

/**
 * Create a YouTubeApiError from an error response
 */
function createYouTubeError(
  code: number,
  message: string,
  isQuotaExhausted: boolean = false,
  quotaResetTime: Date | null = null
): YouTubeApiError {
  return {
    code,
    message,
    isQuotaExhausted,
    quotaResetTime,
  }
}

/**
 * Handle YouTube API error responses
 */
async function handleApiError(response: Response): Promise<never> {
  let errorData: YouTubeErrorResponse | null = null

  try {
    errorData = await response.json()
  } catch {
    // Failed to parse error JSON
  }

  const code = response.status
  const message = errorData?.error?.message || response.statusText

  // Check for quota exhaustion
  if (code === 403 && errorData?.error?.errors?.[0]?.reason === 'quotaExceeded') {
    quotaTracker.setQuotaExhausted()
    throw createYouTubeError(code, 'YouTube API quota exceeded. Quota resets at midnight Pacific Time.', true, quotaTracker.getQuotaResetTime())
  }

  // Handle other common errors
  if (code === 400) {
    throw createYouTubeError(code, 'Invalid request. Please check your input and try again.', false, null)
  }

  if (code === 404) {
    throw createYouTubeError(code, 'Not found. The requested resource does not exist.', false, null)
  }

  // Generic error
  throw createYouTubeError(code, message || 'An error occurred while calling the YouTube API.', false, null)
}

/**
 * Resolve a channel identifier to full channel info
 * @param identifier Channel identifier (handle, username, channelId, customUrl)
 * @param apiKey YouTube Data API key
 * @returns Channel info including uploads playlist ID
 */
export async function resolveChannel(identifier: ChannelIdentifier, apiKey: string): Promise<ChannelInfo> {
  // Check cache first
  const cacheKey = `yt_channel_${identifier.type}_${identifier.value}`
  const cached = getCached<ChannelInfo>(cacheKey)
  if (cached) {
    return cached
  }

  // Build API URL based on identifier type
  const url = new URL(`${YOUTUBE_API_BASE}/channels`)
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('key', apiKey)

  switch (identifier.type) {
    case 'handle':
      url.searchParams.set('forHandle', identifier.value)
      break
    case 'username':
      url.searchParams.set('forUsername', identifier.value)
      break
    case 'channelId':
      url.searchParams.set('id', identifier.value)
      break
    case 'customUrl':
      // Try as handle first (many custom URLs work as handles)
      url.searchParams.set('forHandle', identifier.value)
      break
  }

  // Make API call
  let response: Response
  try {
    response = await fetch(url.toString())
  } catch (error) {
    throw createYouTubeError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`, false, null)
  }

  if (!response.ok) {
    await handleApiError(response)
  }

  const data: ChannelsListResponse = await response.json()

  // Check if channel was found
  if (!data.items || data.items.length === 0) {
    throw createYouTubeError(404, 'Channel not found. Check the URL and try again.', false, null)
  }

  const channel = data.items[0]
  const channelInfo: ChannelInfo = {
    id: channel.id,
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails.default.url,
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
  }

  // Cache the result
  setCache(cacheKey, channelInfo, CHANNEL_CACHE_TTL)

  // Track quota usage (1 unit for channels.list)
  quotaTracker.trackCall(1)

  return channelInfo
}

/**
 * Fetch a page of videos from a channel's uploads playlist
 * @param uploadsPlaylistId The uploads playlist ID from channel info
 * @param apiKey YouTube Data API key
 * @param pageToken Optional pagination token for next page
 * @returns Page of videos with pagination info
 */
export async function fetchVideosPage(uploadsPlaylistId: string, apiKey: string, pageToken?: string): Promise<VideosPage> {
  // Check cache first
  const cacheKey = `yt_videos_${uploadsPlaylistId}_${pageToken || 'first'}`
  const cached = getCached<VideosPage>(cacheKey)
  if (cached) {
    return cached
  }

  // Build API URL
  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`)
  url.searchParams.set('playlistId', uploadsPlaylistId)
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('maxResults', '50')
  url.searchParams.set('key', apiKey)

  if (pageToken) {
    url.searchParams.set('pageToken', pageToken)
  }

  // Make API call
  let response: Response
  try {
    response = await fetch(url.toString())
  } catch (error) {
    throw createYouTubeError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`, false, null)
  }

  if (!response.ok) {
    await handleApiError(response)
  }

  const data: PlaylistItemsListResponse = await response.json()

  // Map items to VideoItem[]
  const videos: VideoItem[] = data.items.map((item) => ({
    id: item.contentDetails.videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
    publishedAt: item.snippet.publishedAt,
    duration: '', // playlistItems.list doesn't return duration
  }))

  const videosPage: VideosPage = {
    videos,
    nextPageToken: data.nextPageToken || null,
    totalResults: data.pageInfo.totalResults,
  }

  // Cache the result
  setCache(cacheKey, videosPage, VIDEOS_CACHE_TTL)

  // Track quota usage (1 unit for playlistItems.list)
  quotaTracker.trackCall(1)

  return videosPage
}
