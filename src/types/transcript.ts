export type TranscriptStatus = 'pending' | 'fetching' | 'success' | 'error';

export interface TranscriptResult {
  videoId: string;
  status: TranscriptStatus;
  transcript?: string;     // Full joined transcript text
  error?: string;          // Error message if failed
}
