import { useReducer, useCallback, useRef, useMemo } from 'react'
import { summarizeVideo, estimateBatchCost } from '@/services/summarization.service'
import { countTranscriptTokens } from '@/services/claude.service'
import type { SummaryResult, BatchCostEstimate, SummaryStatus } from '@/types/summary'

interface SummarizationState {
  phase: 'idle' | 'estimating' | 'estimated' | 'processing' | 'complete'
  results: Map<string, SummaryResult>
  costEstimate: BatchCostEstimate | null
  totalActualCost: number
  processedCount: number
}

type SummarizationAction =
  | { type: 'START_ESTIMATE' }
  | { type: 'SET_ESTIMATE'; estimate: BatchCostEstimate }
  | { type: 'ESTIMATE_ERROR'; error: string }
  | { type: 'START_PROCESSING'; videoIds: string[] }
  | { type: 'SET_VIDEO_STATUS'; videoId: string; status: SummaryStatus }
  | { type: 'SET_VIDEO_RESULT'; videoId: string; summary: any; cost: number; inputTokens: number; outputTokens: number }
  | { type: 'SET_VIDEO_ERROR'; videoId: string; error: string }
  | { type: 'COMPLETE' }
  | { type: 'RESET' }

const initialState: SummarizationState = {
  phase: 'idle',
  results: new Map(),
  costEstimate: null,
  totalActualCost: 0,
  processedCount: 0,
}

function summarizationReducer(
  state: SummarizationState,
  action: SummarizationAction
): SummarizationState {
  switch (action.type) {
    case 'START_ESTIMATE':
      return {
        ...state,
        phase: 'estimating',
        costEstimate: null,
      }

    case 'SET_ESTIMATE':
      return {
        ...state,
        phase: 'estimated',
        costEstimate: action.estimate,
      }

    case 'ESTIMATE_ERROR':
      return {
        ...state,
        phase: 'idle',
        costEstimate: null,
      }

    case 'START_PROCESSING': {
      const newResults = new Map<string, SummaryResult>()
      action.videoIds.forEach((videoId) => {
        newResults.set(videoId, {
          videoId,
          status: 'queued',
        })
      })
      return {
        ...state,
        phase: 'processing',
        results: newResults,
        totalActualCost: 0,
        processedCount: 0,
      }
    }

    case 'SET_VIDEO_STATUS': {
      const newResults = new Map(state.results)
      const existing = newResults.get(action.videoId)
      if (existing) {
        newResults.set(action.videoId, {
          ...existing,
          status: action.status,
        })
      }
      return {
        ...state,
        results: newResults,
      }
    }

    case 'SET_VIDEO_RESULT': {
      const newResults = new Map(state.results)
      newResults.set(action.videoId, {
        videoId: action.videoId,
        status: 'completed',
        summary: action.summary,
        cost: action.cost,
        inputTokens: action.inputTokens,
        outputTokens: action.outputTokens,
      })
      return {
        ...state,
        results: newResults,
        totalActualCost: state.totalActualCost + action.cost,
        processedCount: state.processedCount + 1,
      }
    }

    case 'SET_VIDEO_ERROR': {
      const newResults = new Map(state.results)
      const existing = newResults.get(action.videoId)
      newResults.set(action.videoId, {
        videoId: action.videoId,
        status: 'failed',
        error: action.error,
        cost: existing?.cost,
        inputTokens: existing?.inputTokens,
        outputTokens: existing?.outputTokens,
      })
      return {
        ...state,
        results: newResults,
        processedCount: state.processedCount + 1,
      }
    }

    case 'COMPLETE':
      return {
        ...state,
        phase: 'complete',
      }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

export function useSummarization(apiKey: string) {
  const [state, dispatch] = useReducer(summarizationReducer, initialState)
  const transcriptsRef = useRef<Map<string, string>>(new Map())

  const estimateCost = useCallback(
    async (transcripts: Map<string, string>) => {
      dispatch({ type: 'START_ESTIMATE' })
      transcriptsRef.current = transcripts

      try {
        // Count tokens for each video
        const tokenCounts = new Map<string, number>()
        const tokenCountPromises = Array.from(transcripts.entries()).map(
          async ([videoId, transcript]) => {
            const result = await countTranscriptTokens(transcript, apiKey)
            tokenCounts.set(videoId, result.inputTokens)
          }
        )

        await Promise.all(tokenCountPromises)

        // Build batch cost estimate
        const estimate = estimateBatchCost(tokenCounts)
        dispatch({ type: 'SET_ESTIMATE', estimate })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to estimate cost'
        dispatch({ type: 'ESTIMATE_ERROR', error: errorMessage })
        throw error
      }
    },
    [apiKey]
  )

  const startProcessing = useCallback(async () => {
    const transcripts = transcriptsRef.current
    const videoIds = Array.from(transcripts.keys())

    dispatch({ type: 'START_PROCESSING', videoIds })

    // Use p-limit for concurrency control
    const pLimit = (await import('p-limit')).default
    const limit = pLimit(3)

    const processingPromises = videoIds.map((videoId) =>
      limit(async () => {
        const transcript = transcripts.get(videoId)
        if (!transcript) return

        try {
          dispatch({ type: 'SET_VIDEO_STATUS', videoId, status: 'processing' })

          const result = await summarizeVideo(transcript, apiKey)

          dispatch({
            type: 'SET_VIDEO_RESULT',
            videoId,
            summary: result.summary,
            cost: result.cost,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Summarization failed'
          dispatch({ type: 'SET_VIDEO_ERROR', videoId, error: errorMessage })
        }
      })
    )

    await Promise.all(processingPromises)
    dispatch({ type: 'COMPLETE' })
  }, [apiKey])

  const retryVideo = useCallback(
    async (videoId: string, transcript: string) => {
      dispatch({ type: 'SET_VIDEO_STATUS', videoId, status: 'processing' })

      try {
        const result = await summarizeVideo(transcript, apiKey)

        dispatch({
          type: 'SET_VIDEO_RESULT',
          videoId,
          summary: result.summary,
          cost: result.cost,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Summarization failed'
        dispatch({ type: 'SET_VIDEO_ERROR', videoId, error: errorMessage })
      }
    },
    [apiKey]
  )

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
    transcriptsRef.current = new Map()
  }, [])

  const getResult = useCallback(
    (videoId: string): SummaryResult | undefined => {
      return state.results.get(videoId)
    },
    [state.results]
  )

  const completedCount = useMemo(() => {
    return Array.from(state.results.values()).filter((r) => r.status === 'completed').length
  }, [state.results])

  const failedCount = useMemo(() => {
    return Array.from(state.results.values()).filter((r) => r.status === 'failed').length
  }, [state.results])

  return {
    phase: state.phase,
    results: state.results,
    costEstimate: state.costEstimate,
    totalActualCost: state.totalActualCost,
    processedCount: state.processedCount,
    completedCount,
    failedCount,
    estimateCost,
    startProcessing,
    retryVideo,
    reset,
    getResult,
  }
}
