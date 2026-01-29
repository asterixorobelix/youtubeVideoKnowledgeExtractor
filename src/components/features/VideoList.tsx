import type { VideoItem } from '@/types/youtube'
import { VideoCard } from './VideoCard'
import { Button } from '@/components/ui/button'

interface VideoListProps {
  videos: VideoItem[]
  isLoadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  totalResults: number
}

export function VideoList({ videos, isLoadingMore, hasMore, onLoadMore, totalResults }: VideoListProps) {
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

      {/* Video cards */}
      <div className="space-y-2">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
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
