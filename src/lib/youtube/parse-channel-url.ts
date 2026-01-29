import type { ChannelIdentifier } from '@/types/youtube'

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
    const validHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com']
    if (!validHosts.includes(url.hostname)) {
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
      const channelId = path.split('/')[2]
      return { type: 'channelId', value: channelId }
    }

    // /c/ format: youtube.com/c/CustomName
    if (path.startsWith('/c/')) {
      const customUrl = path.split('/')[2]
      return { type: 'customUrl', value: customUrl }
    }

    // /user/ format: youtube.com/user/UserName
    if (path.startsWith('/user/')) {
      const username = path.split('/')[2]
      return { type: 'username', value: username }
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
    if (trimmedInput.startsWith('UC') && trimmedInput.length === 24) {
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
