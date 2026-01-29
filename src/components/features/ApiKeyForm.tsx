import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { useApiKeys } from '@/context/ApiKeysContext'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const formSchema = z.object({
  anthropicKey: z.string().min(1, 'Anthropic API key is required'),
  youtubeKey: z.string().min(1, 'YouTube API key is required'),
})

type FormData = z.infer<typeof formSchema>

export function ApiKeyForm() {
  const { keys, setKeys, clearKeys, hasKeys } = useApiKeys()
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showYoutubeKey, setShowYoutubeKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      anthropicKey: keys.anthropicKey,
      youtubeKey: keys.youtubeKey,
    },
  })

  const onSubmit = (data: FormData) => {
    setKeys(data)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  const handleClearKeys = () => {
    clearKeys()
    form.reset({ anthropicKey: '', youtubeKey: '' })
    setSaveSuccess(false)
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>API Configuration</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your keys live in session storage only — poof, gone when you close the tab. No snooping.
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Save Keys
              </Button>
              {hasKeys && (
                <Button type="button" variant="outline" onClick={handleClearKeys}>
                  Clear Keys
                </Button>
              )}
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
