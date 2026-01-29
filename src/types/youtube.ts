export interface ChannelIdentifier {
  type: "handle" | "channelId" | "username" | "customUrl"
  value: string
}

export interface ChannelInfo {
  id: string
  title: string
  thumbnail: string
  uploadsPlaylistId: string
}

export interface VideoItem {
  id: string
  title: string
  thumbnail: string
  publishedAt: string
  duration: string
}

export interface VideosPage {
  videos: VideoItem[]
  nextPageToken: string | null
  totalResults: number
}

export interface YouTubeApiError {
  code: number
  message: string
  isQuotaExhausted: boolean
  quotaResetTime: Date | null
}
