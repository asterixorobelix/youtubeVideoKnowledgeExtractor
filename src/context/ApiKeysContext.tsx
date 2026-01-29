import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { ApiKeys } from '@/types/api-keys'

interface ApiKeysContextValue {
  keys: ApiKeys
  setKeys: (keys: Partial<ApiKeys>) => void
  clearKeys: () => void
  hasKeys: boolean
}

const ApiKeysContext = createContext<ApiKeysContextValue | null>(null)

const STORAGE_KEY = 'api-keys'

const getInitialKeys = (): ApiKeys => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load API keys from localStorage:', error)
  }
  return { anthropicKey: '', youtubeKey: '' }
}

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const [keys, setKeysState] = useState<ApiKeys>(getInitialKeys)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
    } catch (error) {
      console.error('Failed to save API keys to localStorage:', error)
    }
  }, [keys])

  const setKeys = (newKeys: Partial<ApiKeys>) => {
    setKeysState(prev => ({ ...prev, ...newKeys }))
  }

  const clearKeys = () => {
    setKeysState({ anthropicKey: '', youtubeKey: '' })
  }

  const hasKeys = keys.anthropicKey.trim() !== '' && keys.youtubeKey.trim() !== ''

  return (
    <ApiKeysContext.Provider value={{ keys, setKeys, clearKeys, hasKeys }}>
      {children}
    </ApiKeysContext.Provider>
  )
}

export function useApiKeys() {
  const context = useContext(ApiKeysContext)
  if (!context) {
    throw new Error('useApiKeys must be used within ApiKeysProvider')
  }
  return context
}
