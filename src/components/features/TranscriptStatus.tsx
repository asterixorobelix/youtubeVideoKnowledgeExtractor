import { Check, X, Loader2, Minus } from 'lucide-react'
import type { TranscriptResult } from '@/types/transcript'

interface TranscriptStatusProps {
  result: TranscriptResult | undefined
}

export function TranscriptStatus({ result }: TranscriptStatusProps) {
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

    case 'error':
      return (
        <div className="flex items-center gap-1 text-red-600 text-xs">
          <X className="h-3 w-3" />
          <span>{result.error || 'Error'}</span>
        </div>
      )

    default:
      return null
  }
}
