import type { VideoItem } from '@/types/youtube'
import type { TranscriptResult } from '@/types/transcript'
import type { SummaryResult } from '@/types/summary'
import { VideoCard } from './VideoCard'
import { SelectionToolbar } from './SelectionToolbar'
import { Button } from '@/components/ui/button'

interface VideoListProps {
  videos: VideoItem[]
  isLoadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  totalResults: number
  isSelected: (id: string) => boolean
  onToggleSelection: (id: string) => void
  selectedCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  getTranscriptResult?: (videoId: string) => TranscriptResult | undefined
  getSummaryResult?: (videoId: string) => SummaryResult | undefined
  onRetryTranscript?: (videoId: string) => void
  onRetrySummary?: (videoId: string) => void
  onDownloadSummary?: (videoId: string) => void
  onWhisperTranscribe?: (videoId: string) => void
  hasOpenaiKey?: boolean
}

export function VideoList({
  videos,
  isLoadingMore,
  hasMore,
  onLoadMore,
  totalResults,
  isSelected,
  onToggleSelection,
  selectedCount,
  onSelectAll,
  onClearSelection,
  getTranscriptResult,
  getSummaryResult,
  onRetryTranscript,
  onRetrySummary,
  onDownloadSummary,
  onWhisperTranscribe,
  hasOpenaiKey,
}: VideoListProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No videos found for this channel
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Video count */}
      <div className="text-sm text-muted-foreground">
        Showing {videos.length} of {totalResults.toLocaleString()} videos
      </div>

      {/* Selection toolbar */}
      <SelectionToolbar
        selectedCount={selectedCount}
        totalCount={videos.length}
        onSelectAll={onSelectAll}
        onClearSelection={onClearSelection}
      />

      {/* Video cards */}
      <div className="space-y-2">
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            isSelected={isSelected(video.id)}
            onToggleSelection={onToggleSelection}
            transcriptResult={getTranscriptResult?.(video.id)}
            summaryResult={getSummaryResult?.(video.id)}
            onRetryTranscript={onRetryTranscript}
            onRetrySummary={onRetrySummary}
            onDownloadSummary={onDownloadSummary}
            onWhisperTranscribe={onWhisperTranscribe}
            hasOpenaiKey={hasOpenaiKey}
          />
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            variant="outline"
          >
            {isLoadingMore ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Loading more...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
