import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'selected-videos'

/**
 * Read initial value from sessionStorage (called once on mount)
 */
function readSessionStorage<T>(key: string, initialValue: T): T {
  try {
    const item = sessionStorage.getItem(key)
    return item ? JSON.parse(item) : initialValue
  } catch {
    return initialValue
  }
}

/**
 * Write value to sessionStorage
 */
function writeSessionStorage<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Error writing to sessionStorage:', error)
  }
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
  // Initialize Set from sessionStorage (read once on mount)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(readSessionStorage<string[]>(STORAGE_KEY, []))
  )

  // Track whether this is the initial mount to avoid writing on first render
  const isInitialMount = useRef(true)

  // Sync selectedIds to sessionStorage whenever it changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    writeSessionStorage(STORAGE_KEY, Array.from(selectedIds))
  }, [selectedIds])

  // Clear stale selection when video list completely changes (new channel)
  // Prunes any selected IDs not in current video list
  useEffect(() => {
    if (availableVideoIds.length > 0) {
      setSelectedIds(prev => {
        const stillValid = new Set([...prev].filter(id => availableVideoIds.includes(id)))
        if (stillValid.size !== prev.size) {
          return stillValid
        }
        return prev
      })
    }
  }, [availableVideoIds])

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
