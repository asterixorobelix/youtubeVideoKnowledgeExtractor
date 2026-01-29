// Cache TTL constants
export const CHANNEL_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
export const VIDEOS_CACHE_TTL = 60 * 60 * 1000 // 1 hour

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Read from localStorage cache with TTL checking
 * @param key Cache key (use format: yt_${type}_${identifier})
 * @returns Cached data or null if expired/missing
 */
export function getCached<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return null
    }

    const entry: CacheEntry<T> = JSON.parse(stored)
    const now = Date.now()

    // Check if expired
    if (now - entry.timestamp > entry.ttl) {
      localStorage.removeItem(key)
      return null
    }

    return entry.data
  } catch (error) {
    // Handle localStorage errors (quota exceeded, private browsing, etc.)
    console.warn('Cache read failed:', error)
    return null
  }
}

/**
 * Write to localStorage cache with TTL
 * @param key Cache key
 * @param data Data to cache
 * @param ttlMs Time to live in milliseconds
 */
export function setCache<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch (error) {
    // Handle localStorage errors (quota exceeded, private browsing, etc.)
    console.warn('Cache write failed:', error)
  }
}

/**
 * Clear all YouTube-related cache entries (keys starting with yt_)
 */
export function clearCache(): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('yt_')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Cache clear failed:', error)
  }
}
