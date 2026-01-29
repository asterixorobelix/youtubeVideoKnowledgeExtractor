import { useState, useCallback, useEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'selected-videos'

/**
 * Custom hook for syncing a value with sessionStorage
 */
function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // Subscribe to storage events
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('storage', callback)
    return () => window.removeEventListener('storage', callback)
  }, [])

  // Get current value from sessionStorage
  const getSnapshot = useCallback((): T => {
    try {
      const item = sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  }, [key, initialValue])

  // Server-side snapshot (SSR fallback)
  const getServerSnapshot = useCallback(() => initialValue, [initialValue])

  // Use useSyncExternalStore to sync with sessionStorage
  const storedValue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Set value in sessionStorage and trigger storage event
  const setValue = useCallback((value: T) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
      // Manually dispatch storage event for same-window updates
      window.dispatchEvent(new Event('storage'))
    } catch (error) {
      console.error('Error writing to sessionStorage:', error)
    }
  }, [key])

  return [storedValue, setValue]
}

interface UseVideoSelectionReturn {
  selectedIds: Set<string>
  isSelected: (id: string) => boolean
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  getSelectedIds: () => string[]
  selectionCount: number
}

/**
 * Hook for managing video selection state with sessionStorage persistence
 *
 * @param availableVideoIds - Array of video IDs currently available in the list
 * @returns Selection state and controls
 */
export function useVideoSelection(availableVideoIds: string[]): UseVideoSelectionReturn {
  // Load initial selection from sessionStorage
  const [storedArray, setStoredArray] = useSessionStorage<string[]>(STORAGE_KEY, [])

  // Convert stored array to Set for O(1) lookup
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(storedArray))

  // Sync selectedIds to sessionStorage whenever it changes
  useEffect(() => {
    setStoredArray(Array.from(selectedIds))
  }, [selectedIds, setStoredArray])

  // Clear selection when switching to a completely different channel
  // (detected by checking if the first video ID is different)
  useEffect(() => {
    if (availableVideoIds.length > 0 && storedArray.length > 0) {
      const firstAvailableId = availableVideoIds[0]
      // If none of the stored IDs match any available IDs, we've switched channels
      const hasMatch = storedArray.some(id => availableVideoIds.includes(id))
      if (!hasMatch) {
        setSelectedIds(new Set())
      }
    }
  }, [availableVideoIds, storedArray])

  // Check if a video is selected (O(1) lookup)
  const isSelected = useCallback((id: string): boolean => {
    return selectedIds.has(id)
  }, [selectedIds])

  // Toggle selection for a single video
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  // Select all available videos
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(availableVideoIds))
  }, [availableVideoIds])

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Get selected IDs as an array
  const getSelectedIds = useCallback((): string[] => {
    return Array.from(selectedIds)
  }, [selectedIds])

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    getSelectedIds,
    selectionCount: selectedIds.size,
  }
}
