import { useState } from 'react'
import { ApiKeysProvider, useApiKeys } from '@/context/ApiKeysContext'
import { ApiKeyForm } from '@/components/features/ApiKeyForm'
import { ChannelInput } from '@/components/features/ChannelInput'
import { VideoList } from '@/components/features/VideoList'
import { QuotaStatus } from '@/components/features/QuotaStatus'
import { useChannelVideos } from '@/hooks/useChannelVideos'
import { useVideoSelection } from '@/hooks/useVideoSelection'
import { useTranscriptExtraction } from '@/hooks/useTranscriptExtraction'
import { useSummarization } from '@/hooks/useSummarization'
import { CostEstimator } from '@/components/features/CostEstimator'
import { Button } from '@/components/ui/button'
import { Settings, Loader2, X } from 'lucide-react'

function AppContent() {
  const { hasKeys, hasYoutubeKey, keys } = useApiKeys()
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
    clearChannel,
  } = useChannelVideos()

  // Video selection state
  const videoIds = videos.map(v => v.id)
  const {
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectionCount,
    getSelectedIds,
  } = useVideoSelection(videoIds)

  // Transcript extraction state
  const {
    extractTranscripts,
    retryTranscript,
    isExtracting,
    extractionComplete,
    successCount,
    errorCount,
    getResult: getTranscriptResult,
    results: transcriptResults,
  } = useTranscriptExtraction()

  // Summarization state
  const {
    phase: summaryPhase,
    costEstimate,
    totalActualCost,
    processedCount,
    completedCount,
    failedCount,
    estimateCost,
    startProcessing,
    retryVideo,
    reset: resetSummary,
    getResult: getSummaryResult,
  } = useSummarization(keys.anthropicKey)

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
              <div className="flex-1">
                <h2 className="font-semibold">{channel.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {totalResults.toLocaleString()} videos
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  clearChannel()
                  clearSelection()
                  reset()
                  resetSummary()
                }}
                title="Clear channel"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Extract Transcripts button - appears when new videos selected */}
            {selectionCount > 0 && !isExtracting && (
              <div className="flex justify-center">
                <Button
                  onClick={() => extractTranscripts(getSelectedIds())}
                  disabled={isExtracting}
                  size="lg"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extracting transcripts...
                    </>
                  ) : (
                    `Extract Transcripts (${selectionCount})`
                  )}
                </Button>
              </div>
            )}

            {/* Extraction summary - appears after extraction completes */}
            {extractionComplete && (
              <div className={`p-4 rounded-lg border text-center space-y-2 ${errorCount > 0 && successCount === 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-muted/50'}`}>
                <p className="text-sm font-medium">
                  {successCount} transcript{successCount !== 1 ? 's' : ''} ready{errorCount > 0 ? `, ${errorCount} failed` : ''}
                </p>
                {errorCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Some videos may not have captions available. Check individual videos below for retry options.
                  </p>
                )}
              </div>
            )}

            {/* Summarize button - appears after extraction with at least 1 success */}
            {extractionComplete && successCount > 0 && summaryPhase === 'idle' && (
              <div className="flex justify-center">
                {!keys.anthropicKey ? (
                  <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-center">
                    <p className="text-sm text-amber-900 dark:text-amber-100">
                      Add Anthropic API key in settings to summarize
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      const transcripts = new Map<string, string>()
                      Array.from(transcriptResults.values()).forEach((result) => {
                        if (result.status === 'success' && result.transcript) {
                          transcripts.set(result.videoId, result.transcript)
                        }
                      })
                      estimateCost(transcripts)
                    }}
                    size="lg"
                  >
                    Summarize with Claude ({successCount} video{successCount !== 1 ? 's' : ''})
                  </Button>
                )}
              </div>
            )}

            {/* Cost estimation card */}
            {summaryPhase === 'estimated' && costEstimate && (
              <div className="max-w-2xl mx-auto">
                <CostEstimator
                  estimate={costEstimate}
                  isProcessing={false}
                  onConfirm={startProcessing}
                  onCancel={resetSummary}
                />
              </div>
            )}

            {/* Processing progress */}
            {summaryPhase === 'processing' && (
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Processing... {processedCount} of {successCount} complete
                  </p>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Cost so far: ${totalActualCost.toFixed(4)}
                </p>
              </div>
            )}

            {/* Completion summary */}
            {summaryPhase === 'complete' && (
              <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-center space-y-2">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  {completedCount} summar{completedCount !== 1 ? 'ies' : 'y'} ready
                  {failedCount > 0 && `, ${failedCount} failed`}
                </p>
                {failedCount > 0 && (
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Click retry on failed videos below
                  </p>
                )}
                <p className="text-xs text-green-700 dark:text-green-300">
                  Total cost: ${totalActualCost.toFixed(4)}
                </p>
              </div>
            )}

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
              getTranscriptResult={getTranscriptResult}
              getSummaryResult={getSummaryResult}
              onRetryTranscript={retryTranscript}
              onRetrySummary={(videoId) => {
                const transcript = transcriptResults.get(videoId)?.transcript
                if (transcript) {
                  retryVideo(videoId, transcript)
                }
              }}
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
