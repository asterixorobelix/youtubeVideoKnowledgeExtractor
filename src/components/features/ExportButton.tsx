import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle } from 'lucide-react';

interface ExportButtonProps {
  onExport: () => void;
  isGenerating: boolean;
  isSuccess: boolean;
  completedCount: number;
  disabled?: boolean;
}

export function ExportButton({
  onExport,
  isGenerating,
  isSuccess,
  completedCount,
  disabled = false,
}: ExportButtonProps) {
  const isDisabled = disabled || isGenerating || completedCount === 0;

  return (
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
  );
}
