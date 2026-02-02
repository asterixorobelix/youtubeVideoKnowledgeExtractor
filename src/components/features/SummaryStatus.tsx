import { Clock, Loader2, CheckCircle, XCircle, Download } from 'lucide-react'
import type { SummaryResult } from '@/types/summary'

interface SummaryStatusProps {
  result: SummaryResult | undefined
  onDownload?: () => void
}

export function SummaryStatus({ result, onDownload }: SummaryStatusProps) {
  if (!result) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        <Clock className="h-3 w-3" />
        <span>Queued</span>
      </div>
    )
  }

  switch (result.status) {
    case 'queued':
      return (
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="h-3 w-3" />
          <span>Queued</span>
        </div>
      )

    case 'estimating':
      return (
        <div className="flex items-center gap-1 text-blue-600 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Estimating...</span>
        </div>
      )

    case 'processing':
      return (
        <div className="flex items-center gap-1 text-blue-600 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Summarizing...</span>
        </div>
      )

    case 'completed':
      return (
        <div className="flex items-center gap-1 text-green-600 text-xs">
          <CheckCircle className="h-3 w-3" />
          <span>Summary ready</span>
          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDownload()
              }}
              className="ml-1 p-0.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              title="Download summary"
            >
              <Download className="h-3 w-3" />
            </button>
          )}
        </div>
      )

    case 'failed':
      return (
        <div className="flex items-center gap-1 text-red-600 text-xs">
          <XCircle className="h-3 w-3" />
          <span>{result.error || 'Error'}</span>
        </div>
      )

    default:
      return null
  }
}
