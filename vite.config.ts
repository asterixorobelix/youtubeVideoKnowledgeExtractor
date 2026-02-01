import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

function apiProxy(): Plugin {
  return {
    name: 'api-proxy',
    configureServer(server) {
      // /api/transcribe-whisper - OpenAI Whisper transcription proxy
      server.middlewares.use('/api/transcribe-whisper', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        res.setHeader('Content-Type', 'application/json')

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
          return
        }

        try {
          const body = await new Promise<string>((resolve) => {
            let data = ''
            req.on('data', (chunk: Buffer) => { data += chunk.toString() })
            req.on('end', () => resolve(data))
          })

          const { videoId, openaiKey, lang } = JSON.parse(body)

          if (!videoId || !openaiKey) {
            res.statusCode = 400
            res.end(JSON.stringify({ success: false, error: 'Missing videoId or openaiKey' }))
            return
          }

          const { fetchPlayerResponse, getAudioStreamUrl } = await import('./api/lib/extract-captions')

          // Get audio stream URL from YouTube
          const playerData = await fetchPlayerResponse(videoId)
          const audioUrl = getAudioStreamUrl(playerData)

          // Download audio
          const audioResponse = await fetch(audioUrl)
          if (!audioResponse.ok) {
            throw new Error(`Failed to download audio: ${audioResponse.status}`)
          }

          const audioBuffer = await audioResponse.arrayBuffer()
          const MAX_AUDIO_SIZE = 25 * 1024 * 1024

          if (audioBuffer.byteLength > MAX_AUDIO_SIZE) {
            res.statusCode = 413
            res.end(JSON.stringify({
              success: false,
              error: `Audio file too large (${Math.round(audioBuffer.byteLength / 1024 / 1024)}MB). Whisper limit is 25MB.`,
            }))
            return
          }

          // Send to Whisper API
          const formData = new FormData()
          formData.append('file', new Blob([audioBuffer], { type: 'audio/mp4' }), 'audio.m4a')
          formData.append('model', 'whisper-1')
          if (lang) {
            formData.append('language', lang)
          }
          formData.append('response_format', 'text')

          const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
            },
            body: formData,
          })

          if (!whisperResponse.ok) {
            const errorBody = await whisperResponse.text()
            let errorMessage = `Whisper API error: ${whisperResponse.status}`
            try {
              const parsed = JSON.parse(errorBody)
              errorMessage = parsed?.error?.message || errorMessage
            } catch {
              // use default message
            }
            res.statusCode = whisperResponse.status
            res.end(JSON.stringify({ success: false, error: errorMessage }))
            return
          }

          const transcript = await whisperResponse.text()

          res.statusCode = 200
          res.end(JSON.stringify({ success: true, transcript: transcript.trim(), source: 'whisper' }))
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          res.statusCode = 500
          res.end(JSON.stringify({ success: false, error: msg }))
        }
      })

      // /api/summarize - Claude summarization proxy
      server.middlewares.use('/api/summarize', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        res.setHeader('Content-Type', 'application/json')

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
          return
        }

        try {
          const body = await new Promise<string>((resolve) => {
            let data = ''
            req.on('data', (chunk: Buffer) => { data += chunk.toString() })
            req.on('end', () => resolve(data))
          })

          const { transcript, apiKey, action } = JSON.parse(body)

          if (!transcript || !apiKey || !action) {
            res.statusCode = 400
            res.end(JSON.stringify({ success: false, error: 'Missing required fields: transcript, apiKey, action' }))
            return
          }

          const Anthropic = (await import('@anthropic-ai/sdk')).default
          const client = new Anthropic({ apiKey })

          const SYSTEM_PROMPT = `You are a video transcript analyzer. Analyze the provided YouTube video transcript and return a JSON object with this exact structure:
{
  "title": "A concise, descriptive title for the video content",
  "key_points": ["3-10 key takeaways from the video"],
  "topics": ["1-5 main topics covered"],
  "notable_quotes": [{"text": "exact quote", "context": "brief context"}]
}
Return ONLY valid JSON, no markdown formatting or code blocks.`

          if (action === 'count-tokens') {
            const countResult = await client.messages.countTokens({
              model: 'claude-sonnet-4-20250514',
              system: SYSTEM_PROMPT,
              messages: [{ role: 'user', content: transcript }],
            })
            res.statusCode = 200
            res.end(JSON.stringify({ success: true, inputTokens: countResult.input_tokens }))
            return
          }

          if (action === 'summarize') {
            const response = await client.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: SYSTEM_PROMPT,
              messages: [{ role: 'user', content: transcript }],
            })

            if (response.stop_reason === 'max_tokens') {
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: 'Response truncated - output exceeded max tokens' }))
              return
            }

            const textContent = response.content.find((block) => block.type === 'text')
            if (!textContent || textContent.type !== 'text') {
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: 'No text content in Claude response' }))
              return
            }

            let summary
            try {
              summary = JSON.parse(textContent.text)
            } catch {
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: 'Failed to parse Claude JSON response' }))
              return
            }

            res.statusCode = 200
            res.end(JSON.stringify({
              success: true,
              summary,
              usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
            }))
            return
          }

          res.statusCode = 400
          res.end(JSON.stringify({ success: false, error: 'Invalid action' }))
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          const status = msg.includes('authentication') || msg.includes('api_key') ? 401
            : msg.includes('rate_limit') || msg.includes('429') ? 429
            : 500
          res.statusCode = status
          res.end(JSON.stringify({ success: false, error: msg }))
        }
      })

      // /api/transcripts - YouTube caption extraction via Innertube ANDROID API
      server.middlewares.use('/api/transcripts', async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const videoId = url.searchParams.get('videoId')
        const lang = url.searchParams.get('lang') || 'en'

        res.setHeader('Content-Type', 'application/json')

        if (!videoId) {
          res.statusCode = 400
          res.end(JSON.stringify({ success: false, error: 'Missing videoId parameter' }))
          return
        }

        try {
          const { extractCaptions } = await import('./api/lib/extract-captions')

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 15000)
          })

          const transcript = await Promise.race([
            extractCaptions(videoId, lang),
            timeoutPromise,
          ])

          res.statusCode = 200
          res.end(JSON.stringify({ videoId, success: true, transcript }))
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          if (msg === 'Request timeout') {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: 'Request timed out after 15 seconds' }))
          } else {
            const status = msg.includes('returned 429') ? 429 : 404
            res.statusCode = status
            res.end(JSON.stringify({ success: false, error: msg }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiProxy()],
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
