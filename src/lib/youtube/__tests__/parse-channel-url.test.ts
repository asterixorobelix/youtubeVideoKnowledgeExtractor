import { describe, it, expect } from 'vitest'
import { parseChannelUrl } from '../parse-channel-url'

describe('parseChannelUrl', () => {
  describe('valid URL formats', () => {
    it('should parse @handle format with https://www.youtube.com', () => {
      const result = parseChannelUrl('https://www.youtube.com/@MrBeast')
      expect(result).toEqual({ type: 'handle', value: 'MrBeast' })
    })

    it('should parse @handle format with https://youtube.com', () => {
      const result = parseChannelUrl('https://youtube.com/@MrBeast')
      expect(result).toEqual({ type: 'handle', value: 'MrBeast' })
    })

    it('should parse /c/ custom URL format', () => {
      const result = parseChannelUrl('https://www.youtube.com/c/Fireship')
      expect(result).toEqual({ type: 'customUrl', value: 'Fireship' })
    })

    it('should parse /channel/ format with channel ID', () => {
      const result = parseChannelUrl('https://www.youtube.com/channel/UCBcRF18a7Qf58cCRy5xuWwQ')
      expect(result).toEqual({ type: 'channelId', value: 'UCBcRF18a7Qf58cCRy5xuWwQ' })
    })

    it('should parse /user/ format', () => {
      const result = parseChannelUrl('https://www.youtube.com/user/Google')
      expect(result).toEqual({ type: 'username', value: 'Google' })
    })
  })

  describe('bare inputs without full URL', () => {
    it('should parse bare @handle without URL', () => {
      const result = parseChannelUrl('@MrBeast')
      expect(result).toEqual({ type: 'handle', value: 'MrBeast' })
    })

    it('should parse bare channel ID starting with UC', () => {
      const result = parseChannelUrl('UCBcRF18a7Qf58cCRy5xuWwQ')
      expect(result).toEqual({ type: 'channelId', value: 'UCBcRF18a7Qf58cCRy5xuWwQ' })
    })
  })

  describe('error cases', () => {
    it('should throw error for empty string', () => {
      expect(() => parseChannelUrl('')).toThrow()
    })

    it('should throw error for non-YouTube URL', () => {
      expect(() => parseChannelUrl('https://google.com')).toThrow()
    })

    it('should throw error for YouTube video URL', () => {
      expect(() => parseChannelUrl('https://youtube.com/watch?v=abc')).toThrow('not a video URL')
    })

    it('should throw error for invalid input', () => {
      expect(() => parseChannelUrl('not a url at all')).toThrow()
    })
  })
})
