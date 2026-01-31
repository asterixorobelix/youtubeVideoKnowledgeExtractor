import { Check, X, Loader2, Minus, RotateCw } from 'lucide-react'
import type { TranscriptResult } from '@/types/transcript'

interface TranscriptStatusProps {
  result: TranscriptResult | undefined
  onRetry?: () => void
}

export function TranscriptStatus({ result, onRetry }: TranscriptStatusProps) {
  if (!result) {
    return null
  }

  switch (result.status) {
    case 'pending':
      return (
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Minus className="h-3 w-3" />
        </div>
      )

    case 'fetching':
      return (
        <div className="flex items-center gap-1 text-blue-600 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
        </div>
      )

    case 'success':
      return (
        <div className="flex items-center gap-1 text-green-600 text-xs">
          <Check className="h-3 w-3" />
          <span>Transcript ready</span>
        </div>
      )

    case 'error': {
      const isNoCaptions = result.error?.toLowerCase().includes('no captions')
        || result.error?.toLowerCase().includes('not available')
      return (
        <div className="flex items-center gap-1 text-red-500 text-xs">
          <X className="h-3 w-3 flex-shrink-0" />
          <span>{isNoCaptions ? 'No captions available' : (result.error || 'Error')}</span>
          {onRetry && !isNoCaptions && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry() }}
              className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 transition-colors"
            >
              <RotateCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )
    }

    default:
      return null
  }
}
