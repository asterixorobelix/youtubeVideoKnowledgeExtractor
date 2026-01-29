import { useState, useCallback } from 'react'
import type { ChannelInfo, VideoItem, YouTubeApiError } from '@/types/youtube'
import { parseChannelUrl } from '@/lib/youtube/parse-channel-url'
import { resolveChannel, fetchVideosPage } from '@/lib/youtube/youtube-api'
import { useApiKeys } from '@/context/ApiKeysContext'

interface UseChannelVideosState {
  channel: ChannelInfo | null
  videos: VideoItem[]
  nextPageToken: string | null
  totalResults: number
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  isQuotaExhausted: boolean
  quotaResetTime: Date | null
}

interface UseChannelVideosReturn extends UseChannelVideosState {
  fetchChannel: (url: string) => Promise<void>
  loadMore: () => Promise<void>
}

export function useChannelVideos(): UseChannelVideosReturn {
  const { keys } = useApiKeys()

  const [state, setState] = useState<UseChannelVideosState>({
    channel: null,
    videos: [],
    nextPageToken: null,
    totalResults: 0,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    isQuotaExhausted: false,
    quotaResetTime: null,
  })

  const fetchChannel = useCallback(async (url: string) => {
    // Reset state
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      isQuotaExhausted: false,
      quotaResetTime: null,
    }))

    try {
      // Parse URL
      const identifier = parseChannelUrl(url)

      // Check for API key
      if (!keys.youtubeKey || keys.youtubeKey.trim() === '') {
        throw new Error('Please configure your YouTube API key first')
      }

      // Resolve channel
      const channelInfo = await resolveChannel(identifier, keys.youtubeKey)

      // Fetch first page of videos
      const videosPage = await fetchVideosPage(channelInfo.uploadsPlaylistId, keys.youtubeKey)

      setState({
        channel: channelInfo,
        videos: videosPage.videos,
        nextPageToken: videosPage.nextPageToken,
        totalResults: videosPage.totalResults,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        isQuotaExhausted: false,
        quotaResetTime: null,
      })
    } catch (error) {
      // Handle YouTube API errors
      if (error && typeof error === 'object' && 'isQuotaExhausted' in error) {
        const apiError = error as YouTubeApiError
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: apiError.message,
          isQuotaExhausted: apiError.isQuotaExhausted,
          quotaResetTime: apiError.quotaResetTime,
        }))
      } else {
        // Handle other errors (parse errors, network errors)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred',
        }))
      }
    }
  }, [keys.youtubeKey])

  const loadMore = useCallback(async () => {
    if (!state.nextPageToken || !state.channel) {
      return
    }

    setState(prev => ({ ...prev, isLoadingMore: true, error: null }))

    try {
      const videosPage = await fetchVideosPage(
        state.channel.uploadsPlaylistId,
        keys.youtubeKey,
        state.nextPageToken
      )

      setState(prev => ({
        ...prev,
        videos: [...prev.videos, ...videosPage.videos],
        nextPageToken: videosPage.nextPageToken,
        isLoadingMore: false,
      }))
    } catch (error) {
      // Handle YouTube API errors
      if (error && typeof error === 'object' && 'isQuotaExhausted' in error) {
        const apiError = error as YouTubeApiError
        setState(prev => ({
          ...prev,
          isLoadingMore: false,
          error: apiError.message,
          isQuotaExhausted: apiError.isQuotaExhausted,
          quotaResetTime: apiError.quotaResetTime,
        }))
      } else {
        setState(prev => ({
          ...prev,
          isLoadingMore: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred',
        }))
      }
    }
  }, [state.nextPageToken, state.channel, keys.youtubeKey])

  return {
    ...state,
    fetchChannel,
    loadMore,
  }
}
