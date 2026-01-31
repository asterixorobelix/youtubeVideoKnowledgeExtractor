import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle } from 'lucide-react';

interface ExportButtonProps {
  onExport: () => void;
  isGenerating: boolean;
  isSuccess: boolean;
  completedCount: number;
  channelName?: string;
  disabled?: boolean;
}

export function ExportButton({
  onExport,
  isGenerating,
  isSuccess,
  completedCount,
  channelName,
  disabled = false,
}: ExportButtonProps) {
  const isDisabled = disabled || isGenerating || completedCount === 0;

  const today = new Date().toISOString().split('T')[0];
  const zipName = channelName
    ? `${channelName.replace(/\s+/g, '_')}-summaries-${today}.zip`
    : `youtube-summaries-${today}.zip`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button onClick={onExport} disabled={isDisabled} size="lg">
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating zip...
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            Downloaded!
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download Summaries ({completedCount})
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">{zipName}</p>
    </div>
  );
}
