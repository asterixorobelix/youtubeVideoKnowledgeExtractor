import type { VideoItem } from '@/types/youtube'

interface VideoCardProps {
  video: VideoItem
}

export function VideoCard({ video }: VideoCardProps) {
  // Format the published date to a readable format
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString)
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  }

  return (
    <div className="flex gap-3 p-3 rounded-lg border hover:shadow-md transition-shadow overflow-hidden">
      {/* Thumbnail */}
      <div className="flex-shrink-0">
        <img
          src={video.thumbnail}
          alt={video.title}
          width={120}
          height={68}
          loading="lazy"
          className="rounded object-cover"
          style={{ aspectRatio: '16/9' }}
        />
      </div>

      {/* Video info */}
      <div className="flex-1 min-w-0 space-y-1">
        <h3 className="font-medium text-sm line-clamp-2 leading-tight">
          {video.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {formatDate(video.publishedAt)}
        </p>
      </div>
    </div>
  )
}
