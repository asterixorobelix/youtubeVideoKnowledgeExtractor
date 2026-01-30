import { useState, useCallback, useMemo } from 'react'
import { fetchTranscripts } from '@/services/transcript.service'
import type { TranscriptResult } from '@/types/transcript'

interface UseTranscriptExtractionReturn {
  extractTranscripts: (videoIds: string[]) => void
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

      // fetchTranscripts handles concurrency internally with p-limit
      const transcriptResults = await fetchTranscripts(videoIds)

      // Convert array to Map
      const finalResults = new Map<string, TranscriptResult>()
      transcriptResults.forEach((result) => {
        finalResults.set(result.videoId, result)
      })
      setResults(finalResults)
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

  const reset = useCallback(() => {
    setResults(new Map())
    setIsExtracting(false)
    setExtractionComplete(false)
  }, [])

  return {
    extractTranscripts,
    results,
    isExtracting,
    extractionComplete,
    successCount,
    errorCount,
    getResult,
    reset,
  }
}
