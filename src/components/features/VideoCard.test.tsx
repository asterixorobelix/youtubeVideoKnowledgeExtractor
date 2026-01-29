import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VideoCard } from './VideoCard'
import type { VideoItem } from '@/types/youtube'

const mockVideo: VideoItem = {
  id: 'v123',
  title: 'Test Video Title',
  thumbnail: 'https://example.com/thumb.jpg',
  publishedAt: '2026-01-15T00:00:00Z',
  duration: 'PT10M',
}

describe('VideoCard', () => {
  it('renders checkbox unchecked when not selected', () => {
    const onToggleSelection = vi.fn()

    render(
      <VideoCard
        video={mockVideo}
        isSelected={false}
        onToggleSelection={onToggleSelection}
      />
    )

    const checkbox = screen.getByRole('checkbox', { name: /select test video title/i })
    expect(checkbox).not.toBeChecked()
  })

  it('renders checkbox checked when selected', () => {
    const onToggleSelection = vi.fn()

    render(
      <VideoCard
        video={mockVideo}
        isSelected={true}
        onToggleSelection={onToggleSelection}
      />
    )

    const checkbox = screen.getByRole('checkbox', { name: /select test video title/i })
    expect(checkbox).toBeChecked()
  })

  it('calls onToggleSelection with video id on checkbox click', () => {
    const onToggleSelection = vi.fn()

    render(
      <VideoCard
        video={mockVideo}
        isSelected={false}
        onToggleSelection={onToggleSelection}
      />
    )

    const checkbox = screen.getByRole('checkbox', { name: /select test video title/i })
    fireEvent.click(checkbox)

    expect(onToggleSelection).toHaveBeenCalledWith('v123')
  })

  it('calls onToggleSelection when clicking the video title label', () => {
    const onToggleSelection = vi.fn()

    render(
      <VideoCard
        video={mockVideo}
        isSelected={false}
        onToggleSelection={onToggleSelection}
      />
    )

    const label = screen.getByText('Test Video Title')
    fireEvent.click(label)

    expect(onToggleSelection).toHaveBeenCalledWith('v123')
  })
})
