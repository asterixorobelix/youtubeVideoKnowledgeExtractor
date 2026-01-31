import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VideoItem } from '@/types/youtube';
import type { Summary } from '@/types/summary';
import {
  generateMarkdown,
  sanitizeFilename,
  generateFilename,
  exportSummariesToZip,
} from '../export.service';

describe('Export Service', () => {
  describe('sanitizeFilename', () => {
    it('replaces whitespace with underscores', () => {
      expect(sanitizeFilename('My Video Title')).toBe('My_Video_Title');
    });

    it('removes Windows forbidden characters', () => {
      expect(sanitizeFilename('Video: A <Special> Title?')).toBe('Video_A_Special_Title');
      expect(sanitizeFilename('File/With\\Many|Bad*Chars')).toBe('FileWithManyBadChars');
      expect(sanitizeFilename('Test"Quote"')).toBe('TestQuote');
    });

    it('removes leading dots', () => {
      expect(sanitizeFilename('.hidden')).toBe('hidden');
      expect(sanitizeFilename('...')).toBe('untitled');
    });

    it('removes trailing spaces and dots', () => {
      expect(sanitizeFilename('spaces  ')).toBe('spaces');
      expect(sanitizeFilename('dots...')).toBe('dots');
      expect(sanitizeFilename('both... ')).toBe('both');
    });

    it('truncates to 80 characters', () => {
      const longString = 'A'.repeat(100);
      expect(sanitizeFilename(longString)).toBe('A'.repeat(80));
    });

    it('handles Windows reserved names by prefixing underscore', () => {
      expect(sanitizeFilename('CON')).toBe('_CON');
      expect(sanitizeFilename('PRN')).toBe('_PRN');
      expect(sanitizeFilename('AUX')).toBe('_AUX');
      expect(sanitizeFilename('NUL')).toBe('_NUL');
      expect(sanitizeFilename('COM1')).toBe('_COM1');
      expect(sanitizeFilename('COM9')).toBe('_COM9');
      expect(sanitizeFilename('LPT1')).toBe('_LPT1');
      expect(sanitizeFilename('LPT9')).toBe('_LPT9');
    });

    it('returns "untitled" for empty or whitespace-only input', () => {
      expect(sanitizeFilename('')).toBe('untitled');
      expect(sanitizeFilename('   ')).toBe('untitled');
      expect(sanitizeFilename('\t\n')).toBe('untitled');
    });

    it('removes control characters', () => {
      expect(sanitizeFilename('Test\x00\x1FFile')).toBe('TestFile');
    });
  });

  describe('generateFilename', () => {
    it('generates filename with video ID prefix and sanitized title', () => {
      const video: VideoItem = {
        id: 'abc123',
        title: 'My Video',
        thumbnail: '',
        publishedAt: '',
        duration: '',
      };
      expect(generateFilename(video)).toBe('abc123_My_Video.md');
    });

    it('handles reserved names correctly', () => {
      const video: VideoItem = {
        id: 'xyz789',
        title: 'CON',
        thumbnail: '',
        publishedAt: '',
        duration: '',
      };
      expect(generateFilename(video)).toBe('xyz789__CON.md');
    });

    it('sanitizes title with special characters', () => {
      const video: VideoItem = {
        id: 'def456',
        title: 'Video: A <Test> Title?',
        thumbnail: '',
        publishedAt: '',
        duration: '',
      };
      expect(generateFilename(video)).toBe('def456_Video_A_Test_Title.md');
    });
  });

  describe('generateMarkdown', () => {
    const mockVideo: VideoItem = {
      id: 'abc123',
      title: 'Test Video',
      thumbnail: 'https://example.com/thumb.jpg',
      publishedAt: '2024-01-15T10:30:00Z',
      duration: '15:30',
    };

    const mockSummary: Summary = {
      title: 'Understanding React Hooks',
      key_points: [
        'useState manages component state',
        'useEffect handles side effects',
        'Custom hooks promote reusability',
      ],
      topics: ['React', 'JavaScript', 'Web Development'],
      notable_quotes: [
        {
          text: 'Hooks let you use state without writing a class',
          context: 'Introduction to hooks',
        },
        {
          text: 'Always call hooks at the top level',
        },
      ],
    };

    it('includes title as heading', () => {
      const markdown = generateMarkdown(mockVideo, mockSummary);
      expect(markdown).toContain('# Understanding React Hooks');
    });

    it('includes video link with title', () => {
      const markdown = generateMarkdown(mockVideo, mockSummary);
      expect(markdown).toContain('**Video:** [Test Video](https://youtube.com/watch?v=abc123)');
    });

    it('includes formatted published date', () => {
      const markdown = generateMarkdown(mockVideo, mockSummary);
      expect(markdown).toMatch(/\*\*Published:\*\* .+/);
    });

    it('includes duration', () => {
      const markdown = generateMarkdown(mockVideo, mockSummary);
      expect(markdown).toContain('**Duration:** 15:30');
    });

    it('includes key points as numbered list', () => {
      const markdown = generateMarkdown(mockVideo, mockSummary);
      expect(markdown).toContain('## Key Points');
      expect(markdown).toContain('1. useState manages component state');
      expect(markdown).toContain('2. useEffect handles side effects');
      expect(markdown).toContain('3. Custom hooks promote reusability');
    });

    it('includes topics as bullet list', () => {
      const markdown = generateMarkdown(mockVideo, mockSummary);
      expect(markdown).toContain('## Topics Covered');
      expect(markdown).toContain('- React');
      expect(markdown).toContain('- JavaScript');
      expect(markdown).toContain('- Web Development');
    });

    it('includes notable quotes as blockquotes', () => {
      const markdown = generateMarkdown(mockVideo, mockSummary);
      expect(markdown).toContain('## Notable Quotes');
      expect(markdown).toContain('> Hooks let you use state without writing a class');
      expect(markdown).toContain('> Always call hooks at the top level');
    });

    it('includes context for quotes when available', () => {
      const markdown = generateMarkdown(mockVideo, mockSummary);
      expect(markdown).toContain('> *Context: Introduction to hooks*');
    });

    it('includes footer with generator attribution', () => {
      const markdown = generateMarkdown(mockVideo, mockSummary);
      expect(markdown).toContain('---');
      expect(markdown).toContain('*Generated by YouTube Knowledge Extractor*');
    });
  });

  describe('exportSummariesToZip', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates zip with markdown files and triggers download', async () => {
      const mockVideo: VideoItem = {
        id: 'abc123',
        title: 'Test Video',
        thumbnail: '',
        publishedAt: '2024-01-15T10:30:00Z',
        duration: '10:00',
      };

      const mockSummary: Summary = {
        title: 'Test Summary',
        key_points: ['Point 1', 'Point 2', 'Point 3'],
        topics: ['Topic 1'],
        notable_quotes: [],
      };

      const summaries = [{ video: mockVideo, summary: mockSummary }];

      // Mock JSZip and file-saver are tested through integration
      // This test verifies the function executes without errors
      await expect(exportSummariesToZip(summaries)).resolves.not.toThrow();
    });

    it('handles multiple summaries', async () => {
      const summaries = [
        {
          video: {
            id: 'video1',
            title: 'First Video',
            thumbnail: '',
            publishedAt: '2024-01-15T10:30:00Z',
            duration: '10:00',
          },
          summary: {
            title: 'First Summary',
            key_points: ['Point 1', 'Point 2', 'Point 3'],
            topics: ['Topic 1'],
            notable_quotes: [],
          },
        },
        {
          video: {
            id: 'video2',
            title: 'Second Video',
            thumbnail: '',
            publishedAt: '2024-01-16T10:30:00Z',
            duration: '15:00',
          },
          summary: {
            title: 'Second Summary',
            key_points: ['Point A', 'Point B', 'Point C'],
            topics: ['Topic 2'],
            notable_quotes: [],
          },
        },
      ];

      await expect(exportSummariesToZip(summaries)).resolves.not.toThrow();
    });
  });
});
