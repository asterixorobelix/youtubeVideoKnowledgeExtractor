import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const channelInputSchema = z.object({
  url: z.string().min(1, 'Please enter a channel URL'),
})

type ChannelInputForm = z.infer<typeof channelInputSchema>

interface ChannelInputProps {
  onSubmit: (url: string) => void
  isLoading: boolean
  error: string | null
}

export function ChannelInput({ onSubmit, isLoading, error }: ChannelInputProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChannelInputForm>({
    resolver: zodResolver(channelInputSchema),
  })

  const handleFormSubmit = (data: ChannelInputForm) => {
    onSubmit(data.url)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="channel-url">YouTube Channel URL</Label>
          <Input
            id="channel-url"
            type="text"
            placeholder="Paste a YouTube channel URL (e.g., youtube.com/@MrBeast)"
            disabled={isLoading}
            {...register('url')}
          />
          {errors.url && (
            <p className="text-sm text-destructive">{errors.url.message}</p>
          )}
        </div>
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <span className="inline-block animate-spin mr-2">⏳</span>
              Loading...
            </>
          ) : (
            'Load Videos'
          )}
        </Button>
      </form>
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
