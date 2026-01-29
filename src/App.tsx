import { useState } from 'react'
import { ApiKeysProvider, useApiKeys } from '@/context/ApiKeysContext'
import { ApiKeyForm } from '@/components/features/ApiKeyForm'
import { ChannelInput } from '@/components/features/ChannelInput'
import { VideoList } from '@/components/features/VideoList'
import { QuotaStatus } from '@/components/features/QuotaStatus'
import { useChannelVideos } from '@/hooks/useChannelVideos'
import { useVideoSelection } from '@/hooks/useVideoSelection'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'

function AppContent() {
  const { hasKeys, hasYoutubeKey } = useApiKeys()
  const [showSettings, setShowSettings] = useState(false)
  const {
    channel,
    videos,
    nextPageToken,
    totalResults,
    isLoading,
    isLoadingMore,
    error,
    isQuotaExhausted,
    quotaResetTime,
    fetchChannel,
    loadMore,
  } = useChannelVideos()

  // Video selection state
  const videoIds = videos.map(v => v.id)
  const {
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectionCount,
  } = useVideoSelection(videoIds)

  // Show API key form if no YouTube key configured OR if settings is opened
  if (!hasYoutubeKey || showSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="text-5xl">🧠</div>
            <h1 className="text-3xl font-bold tracking-tight">
              YouTube Knowledge Extractor
            </h1>
            <p className="text-muted-foreground">
              Turn hours of video into minutes of reading.
              <br />
              <span className="text-sm">Drop your API keys below to get started.</span>
            </p>
          </div>
          <ApiKeyForm />
          {hasKeys && (
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => setShowSettings(false)}
              >
                Back to Channel Browser
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main channel browsing interface
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with settings */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              🧠 YouTube Knowledge Extractor
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse videos from any YouTube channel
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(true)}
            title="API Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Channel input */}
        <div className="max-w-2xl">
          <ChannelInput
            onSubmit={fetchChannel}
            isLoading={isLoading}
            error={!isQuotaExhausted ? error : null}
          />
        </div>

        {/* Quota status */}
        {isQuotaExhausted && (
          <QuotaStatus
            isQuotaExhausted={isQuotaExhausted}
            quotaResetTime={quotaResetTime}
          />
        )}

        {/* Channel info and video list */}
        {channel && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
              <img
                src={channel.thumbnail}
                alt={channel.title}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <h2 className="font-semibold">{channel.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {totalResults.toLocaleString()} videos
                </p>
              </div>
            </div>

            <VideoList
              videos={videos}
              isLoadingMore={isLoadingMore}
              hasMore={nextPageToken !== null}
              onLoadMore={loadMore}
              totalResults={totalResults}
              isSelected={isSelected}
              onToggleSelection={toggleSelection}
              selectedCount={selectionCount}
              onSelectAll={selectAll}
              onClearSelection={clearSelection}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <ApiKeysProvider>
      <AppContent />
    </ApiKeysProvider>
  )
}

export default App
