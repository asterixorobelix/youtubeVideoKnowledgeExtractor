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

  // Get current time in PT timezone
  const ptFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const ptParts = ptFormatter.formatToParts(now)
  const ptTime: Record<string, string> = {}
  ptParts.forEach((part) => {
    if (part.type !== 'literal') {
      ptTime[part.type] = part.value
    }
  })

  // Create a date string for tomorrow at midnight PT
  const year = parseInt(ptTime.year)
  const month = parseInt(ptTime.month) - 1 // JS months are 0-indexed
  const day = parseInt(ptTime.day)

  // Create tomorrow's date at midnight PT
  const tomorrowPT = new Date()
  tomorrowPT.setFullYear(year, month, day + 1)
  tomorrowPT.setHours(0, 0, 0, 0)

  // Convert to PT timezone by parsing a string in PT
  const tomorrowPTStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}T00:00:00`

  // Create the date and adjust for PT offset
  // Get the offset by comparing a known PT time
  const testDate = new Date('2024-01-15T00:00:00') // Standard time reference
  const testPTStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(testDate)

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

  // Build ISO string for tomorrow midnight PT
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
