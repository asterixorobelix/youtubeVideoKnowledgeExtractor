import { useState, useCallback, useMemo } from 'react'
import { fetchTranscripts, fetchSingleTranscript, whisperTranscribe } from '@/services/transcript.service'
import type { TranscriptResult } from '@/types/transcript'

interface UseTranscriptExtractionReturn {
  extractTranscripts: (videoIds: string[]) => void
  retryTranscript: (videoId: string) => void
  whisperTranscript: (videoId: string, openaiKey: string) => void
  results: Map<string, TranscriptResult>
  isExtracting: boolean
  extractionComplete: boolean
  successCount: number
  errorCount: number
  getResult: (videoId: string) => TranscriptResult | undefined
  reset: () => void
}

export function useTranscriptExtraction(): UseTranscriptExtractionReturn {
  const [results, setResults] = useState<Map<string, TranscriptResult>>(new Map())
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionComplete, setExtractionComplete] = useState(false)

  const extractTranscripts = useCallback(async (videoIds: string[]) => {
    setIsExtracting(true)
    setExtractionComplete(false)

    // Initialize all video IDs with 'pending' status
    const pendingResults = new Map<string, TranscriptResult>()
    videoIds.forEach((videoId) => {
      pendingResults.set(videoId, { videoId, status: 'pending' })
    })
    setResults(pendingResults)

    try {
      // Update to 'fetching' status for all videos
      const fetchingResults = new Map<string, TranscriptResult>()
      videoIds.forEach((videoId) => {
        fetchingResults.set(videoId, { videoId, status: 'fetching' })
      })
      setResults(fetchingResults)

      await fetchTranscripts(videoIds, 'en', (result) => {
        setResults((prev) => {
          const next = new Map(prev)
          next.set(result.videoId, result)
          return next
        })
      })
    } catch (error) {
      // Handle network-level errors
      const errorResults = new Map<string, TranscriptResult>()
      videoIds.forEach((videoId) => {
        errorResults.set(videoId, {
          videoId,
          status: 'error',
          error: 'Network error',
        })
      })
      setResults(errorResults)
    } finally {
      setIsExtracting(false)
      setExtractionComplete(true)
    }
  }, [])

  const successCount = useMemo(() => {
    return Array.from(results.values()).filter((r) => r.status === 'success').length
  }, [results])

  const errorCount = useMemo(() => {
    return Array.from(results.values()).filter((r) => r.status === 'error').length
  }, [results])

  const getResult = useCallback(
    (videoId: string): TranscriptResult | undefined => {
      return results.get(videoId)
    },
    [results]
  )

  const retryTranscript = useCallback(async (videoId: string) => {
    // Set this video to fetching
    setResults((prev) => {
      const next = new Map(prev)
      next.set(videoId, { videoId, status: 'fetching' })
      return next
    })

    const result = await fetchSingleTranscript(videoId)
    setResults((prev) => {
      const next = new Map(prev)
      next.set(videoId, result)
      return next
    })
  }, [])

  const whisperTranscript = useCallback(async (videoId: string, openaiKey: string) => {
    // Set this video to whisper-fetching
    setResults((prev) => {
      const next = new Map(prev)
      next.set(videoId, { videoId, status: 'whisper-fetching' })
      return next
    })

    const result = await whisperTranscribe(videoId, openaiKey)
    setResults((prev) => {
      const next = new Map(prev)
      next.set(videoId, result)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setResults(new Map())
    setIsExtracting(false)
    setExtractionComplete(false)
  }, [])

  return {
    extractTranscripts,
    retryTranscript,
    whisperTranscript,
    results,
    isExtracting,
    extractionComplete,
    successCount,
    errorCount,
    getResult,
    reset,
  }
}
