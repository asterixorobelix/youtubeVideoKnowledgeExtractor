import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Eye, EyeOff, ExternalLink } from 'lucide-react'
import { useApiKeys } from '@/context/ApiKeysContext'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const formSchema = z.object({
  anthropicKey: z.string(),
  youtubeKey: z.string(),
  openaiKey: z.string(),
})

type FormData = z.infer<typeof formSchema>

export function ApiKeyForm() {
  const { keys, setKeys, clearKeys, hasKeys } = useApiKeys()
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showYoutubeKey, setShowYoutubeKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      anthropicKey: keys.anthropicKey,
      youtubeKey: keys.youtubeKey,
      openaiKey: keys.openaiKey,
    },
  })

  const onSubmit = (data: FormData) => {
    setKeys(data)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  const handleClearKeys = () => {
    clearKeys()
    form.reset({ anthropicKey: '', youtubeKey: '', openaiKey: '' })
    setSaveSuccess(false)
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>API Configuration</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your keys are saved locally in your browser. Hit "Clear Keys" anytime to wipe them.
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="anthropicKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anthropic API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showAnthropicKey ? 'text' : 'password'}
                        placeholder="sk-ant-..."
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showAnthropicKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Used to summarize transcripts with Claude.{' '}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Get your key <ExternalLink size={12} />
                    </a>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="youtubeKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube Data API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showYoutubeKey ? 'text' : 'password'}
                        placeholder="AIza..."
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showYoutubeKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Used to look up channels and list videos.{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Get your key <ExternalLink size={12} />
                    </a>
                    {' '}&mdash; enable the{' '}
                    <a
                      href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      YouTube Data API v3
                    </a>
                    {' '}first. Tip: under API restrictions, select "Restrict key" and choose only YouTube Data API v3.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="openaiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OpenAI API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showOpenaiKey ? 'text' : 'password'}
                        placeholder="sk-..."
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showOpenaiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Optional. Used to transcribe videos without captions via Whisper.{' '}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Get your key <ExternalLink size={12} />
                    </a>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Save Keys
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClearKeys}
                disabled={!hasKeys}
              >
                Clear Keys
              </Button>
            </div>

            {saveSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Keys saved successfully!
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
