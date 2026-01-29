interface QuotaStatusProps {
  isQuotaExhausted: boolean
  quotaResetTime: Date | null
}

export function QuotaStatus({ isQuotaExhausted, quotaResetTime }: QuotaStatusProps) {
  if (!isQuotaExhausted) {
    return null
  }

  const formatResetTime = (resetTime: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(resetTime)
  }

  return (
    <div className="p-4 rounded-lg border border-amber-500/50 bg-amber-500/10">
      <div className="flex items-start gap-3">
        <div className="text-2xl">⚠️</div>
        <div className="space-y-1">
          <h3 className="font-semibold text-amber-700 dark:text-amber-500">
            YouTube API quota exceeded
          </h3>
          {quotaResetTime && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Quota resets at {formatResetTime(quotaResetTime)}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Cached results are still available below
          </p>
        </div>
      </div>
    </div>
  )
}
