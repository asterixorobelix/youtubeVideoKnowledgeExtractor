import type { ChannelIdentifier } from '@/types/youtube'

const VALID_YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com']
const CHANNEL_ID_LENGTH = 24

/**
 * Extract the segment after a prefix in a pathname
 * e.g., extractSegment('/channel/UC123', '/channel/') -> 'UC123'
 */
function extractPathSegment(path: string): string {
  return path.split('/')[2]
}

export function parseChannelUrl(input: string): ChannelIdentifier {
  // Handle empty input
  if (!input || input.trim() === '') {
    throw new Error('Please enter a YouTube channel URL or handle')
  }

  const trimmedInput = input.trim()

  // Try to parse as a full URL first
  try {
    const url = new URL(trimmedInput)

    // Validate it's a YouTube URL
    if (!VALID_YOUTUBE_HOSTS.includes(url.hostname)) {
      throw new Error('Please enter a valid YouTube URL')
    }

    const path = url.pathname

    // Check if it's a video URL (not allowed)
    if (path.includes('/watch') || url.searchParams.has('v')) {
      throw new Error('Please enter a YouTube channel URL, not a video URL')
    }

    // Parse different URL patterns
    // @handle format: youtube.com/@GoogleDevelopers
    if (path.startsWith('/@')) {
      const handle = path.slice(2).split('/')[0]
      return { type: 'handle', value: handle }
    }

    // /channel/ format: youtube.com/channel/UCaBcDeFgHiJkLmN123456
    if (path.startsWith('/channel/')) {
      return { type: 'channelId', value: extractPathSegment(path) }
    }

    // /c/ format: youtube.com/c/CustomName
    if (path.startsWith('/c/')) {
      return { type: 'customUrl', value: extractPathSegment(path) }
    }

    // /user/ format: youtube.com/user/UserName
    if (path.startsWith('/user/')) {
      return { type: 'username', value: extractPathSegment(path) }
    }

    throw new Error('Unsupported YouTube URL format. Please use @handle, /channel/, /c/, or /user/ format')
  } catch (error) {
    // If URL parsing failed, check for bare inputs

    // Bare @handle (e.g., "@MrBeast")
    if (trimmedInput.startsWith('@')) {
      const handle = trimmedInput.slice(1)
      if (handle.length > 0) {
        return { type: 'handle', value: handle }
      }
    }

    // Bare channel ID (starts with UC, 24 characters)
    if (trimmedInput.startsWith('UC') && trimmedInput.length === CHANNEL_ID_LENGTH) {
      return { type: 'channelId', value: trimmedInput }
    }

    // If we got here and the original error was from our validation, re-throw it
    if (error instanceof Error && error.message.startsWith('Please enter')) {
      throw error
    }

    // Otherwise, it's an invalid input
    throw new Error('Please enter a valid YouTube channel URL, handle (@username), or channel ID')
  }
}
