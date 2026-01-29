import { ApiKeysProvider } from '@/context/ApiKeysContext'
import { ApiKeyForm } from '@/components/features/ApiKeyForm'

function App() {
  return (
    <ApiKeysProvider>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">YouTube Knowledge Extractor</h1>
            <p className="text-muted-foreground mt-2">
              Configure your API keys to get started
            </p>
          </div>
          <ApiKeyForm />
        </div>
      </div>
    </ApiKeysProvider>
  )
}

export default App
