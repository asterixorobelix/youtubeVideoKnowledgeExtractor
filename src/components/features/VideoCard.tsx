import type { VideoItem } from '@/types/youtube'
import type { TranscriptResult } from '@/types/transcript'
import type { SummaryResult } from '@/types/summary'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TranscriptStatus } from './TranscriptStatus'
import { SummaryStatus } from './SummaryStatus'
import { RotateCw } from 'lucide-react'

interface VideoCardProps {
  video: VideoItem
  isSelected: boolean
  onToggleSelection: (id: string) => void
  transcriptResult?: TranscriptResult
  summaryResult?: SummaryResult
  onRetryTranscript?: (videoId: string) => void
  onRetrySummary?: (videoId: string) => void
}

export function VideoCard({ video, isSelected, onToggleSelection, transcriptResult, summaryResult, onRetryTranscript, onRetrySummary }: VideoCardProps) {
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
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {formatDate(video.publishedAt)}
          </p>
          <TranscriptStatus result={transcriptResult} onRetry={onRetryTranscript ? () => onRetryTranscript(video.id) : undefined} />
          {summaryResult && (
            <>
              <span className="text-muted-foreground">•</span>
              <SummaryStatus result={summaryResult} />
              {summaryResult.status === 'failed' && onRetrySummary && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs"
                  onClick={() => onRetrySummary(video.id)}
                >
                  <RotateCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
