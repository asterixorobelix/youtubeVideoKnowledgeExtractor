import { useState, useCallback } from 'react';
import type { VideoItem } from '@/types/youtube';
import type { SummaryResult } from '@/types/summary';
import { exportSummariesToZip } from '@/services/export.service';

type ExportStatus = 'idle' | 'generating' | 'success' | 'error';

export function useExport() {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const exportSummaries = useCallback(
    async (videos: VideoItem[], summaryResults: Map<string, SummaryResult>) => {
      try {
        setStatus('generating');
        setError(null);

        // Filter to only completed summaries
        const completedSummaries: Array<{ video: VideoItem; summary: any }> = [];
        summaryResults.forEach((result, videoId) => {
          if (result.status === 'completed' && result.summary) {
            const video = videos.find((v) => v.id === videoId);
            if (video) {
              completedSummaries.push({ video, summary: result.summary });
            }
          }
        });

        if (completedSummaries.length === 0) {
          throw new Error('No completed summaries to export');
        }

        // Generate and download zip
        await exportSummariesToZip(completedSummaries);

        // Show success state
        setStatus('success');

        // Reset to idle after 2 seconds
        setTimeout(() => {
          setStatus('idle');
        }, 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed';
        setError(message);
        setStatus('error');
      }
    },
    []
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return {
    status,
    error,
    isGenerating: status === 'generating',
    exportSummaries,
    reset,
  };
}
