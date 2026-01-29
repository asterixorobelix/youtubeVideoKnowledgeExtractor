const QUOTA_LIMIT = 10000 // YouTube API daily quota limit

/**
 * Get the current date in PT timezone (YYYY-MM-DD format)
 */
function getPTDate(): string {
  const now = new Date()
  // Use Intl.DateTimeFormat to get PT timezone date
  const ptDateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  // Format is MM/DD/YYYY, convert to YYYY-MM-DD
  const [month, day, year] = ptDateStr.split('/')
  return `${year}-${month}-${day}`
}

/**
 * Calculate next midnight PT (00:00 America/Los_Angeles)
 */
function getNextMidnightPT(): Date {
  const now = new Date()

  // Calculate midnight PT for tomorrow
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Format tomorrow at midnight in PT timezone and convert to UTC
  const midnightPTFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const tomorrowParts = midnightPTFormatter.formatToParts(tomorrow)
  const tomorrowDate: Record<string, string> = {}
  tomorrowParts.forEach((part) => {
    if (part.type !== 'literal') {
      tomorrowDate[part.type] = part.value
    }
  })

  // Build ISO string for tomorrow midnight PT (PT is UTC-8 in standard time, UTC-7 in DST)
  // Using 08:00 UTC as a safe approximation for midnight PT
  const isoStr = `${tomorrowDate.year}-${tomorrowDate.month}-${tomorrowDate.day}T08:00:00.000Z`
  return new Date(isoStr)
}

class QuotaTrackerClass {
  private getStorageKey(): string {
    return `yt_quota_${getPTDate()}`
  }

  /**
   * Track an API call with its quota cost
   */
  trackCall(units: number): void {
    try {
      const key = this.getStorageKey()
      const current = this.getEstimatedUsage()
      sessionStorage.setItem(key, String(current + units))
    } catch (error) {
      console.warn('Failed to track quota usage:', error)
    }
  }

  /**
   * Get estimated quota usage for today (PT timezone day)
   */
  getEstimatedUsage(): number {
    try {
      const key = this.getStorageKey()
      const stored = sessionStorage.getItem(key)
      return stored ? parseInt(stored, 10) : 0
    } catch (error) {
      console.warn('Failed to read quota usage:', error)
      return 0
    }
  }

  /**
   * Check if quota has been exhausted (403 quotaExceeded received)
   */
  isQuotaExhausted(): boolean {
    try {
      const key = `yt_quota_exhausted_${getPTDate()}`
      return sessionStorage.getItem(key) === 'true'
    } catch (error) {
      return false
    }
  }

  /**
   * Mark quota as exhausted for today
   */
  setQuotaExhausted(): void {
    try {
      const key = `yt_quota_exhausted_${getPTDate()}`
      sessionStorage.setItem(key, 'true')
    } catch (error) {
      console.warn('Failed to set quota exhausted flag:', error)
    }
  }

  /**
   * Get the time when quota resets (next midnight PT)
   */
  getQuotaResetTime(): Date {
    return getNextMidnightPT()
  }

  /**
   * Get estimated remaining quota (best-effort)
   */
  getEstimatedRemaining(): number {
    const used = this.getEstimatedUsage()
    const remaining = QUOTA_LIMIT - used
    return Math.max(0, remaining)
  }
}

export const quotaTracker = new QuotaTrackerClass()

// Named exports for convenience
export const isQuotaExhausted = () => quotaTracker.isQuotaExhausted()
export const getQuotaResetTime = () => quotaTracker.getQuotaResetTime()
