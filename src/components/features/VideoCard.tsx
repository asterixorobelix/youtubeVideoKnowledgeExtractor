import type { VideoItem } from '@/types/youtube'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface VideoCardProps {
  video: VideoItem
  isSelected: boolean
  onToggleSelection: (id: string) => void
}

export function VideoCard({ video, isSelected, onToggleSelection }: VideoCardProps) {
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
      {/* Selection checkbox */}
      <div className="flex items-start pt-1">
        <Checkbox
          id={`video-${video.id}`}
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(video.id)}
          aria-label={`Select ${video.title}`}
        />
      </div>

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
        <Label
          htmlFor={`video-${video.id}`}
          className="font-medium text-sm line-clamp-2 leading-tight cursor-pointer"
        >
          {video.title}
        </Label>
        <p className="text-xs text-muted-foreground">
          {formatDate(video.publishedAt)}
        </p>
      </div>
    </div>
  )
}
