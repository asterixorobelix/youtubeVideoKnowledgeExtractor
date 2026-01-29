import { ApiKeysProvider } from '@/context/ApiKeysContext'
import { ApiKeyForm } from '@/components/features/ApiKeyForm'

function App() {
  return (
    <ApiKeysProvider>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="text-5xl">🧠</div>
            <h1 className="text-3xl font-bold tracking-tight">
              YouTube Knowledge Extractor
            </h1>
            <p className="text-muted-foreground">
              Turn hours of video into minutes of reading.
              <br />
              <span className="text-sm">Drop your API keys below to get started.</span>
            </p>
          </div>
          <ApiKeyForm />
        </div>
      </div>
    </ApiKeysProvider>
  )
}

export default App
