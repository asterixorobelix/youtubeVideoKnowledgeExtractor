import { DollarSign } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { BatchCostEstimate } from '@/types/summary'

interface CostEstimatorProps {
  estimate: BatchCostEstimate
  isProcessing: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function CostEstimator({ estimate, isProcessing, onConfirm, onCancel }: CostEstimatorProps) {
  const formatCost = (cost: number): string => {
    if (cost < 0.01) {
      return `$${cost.toFixed(4)}`
    }
    return `$${cost.toFixed(2)}`
  }

  const videoCount = estimate.estimates.length
  const averageCost = estimate.totalEstimatedCost / videoCount

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <CardTitle>Cost Estimation</CardTitle>
        </div>
        <CardDescription>
          Review the estimated costs before processing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Estimated Cost</p>
            <p className="text-2xl font-bold">{formatCost(estimate.totalEstimatedCost)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Videos to Process</p>
            <p className="text-2xl font-bold">{videoCount}</p>
          </div>
        </div>

        {estimate.videosNeedingChunking > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <span className="font-semibold">{estimate.videosNeedingChunking}</span> video
              {estimate.videosNeedingChunking !== 1 ? 's are' : ' is'} long and will be processed in chunks
            </p>
          </div>
        )}

        <div className="pt-2 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Average per video</span>
            <span className="font-medium">{formatCost(averageCost)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total tokens (input)</span>
            <span className="font-medium">{estimate.totalInputTokens.toLocaleString()}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic">
          Note: Actual cost may vary by up to 10%
        </p>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isProcessing}
          className="flex-1"
        >
          Proceed ({formatCost(estimate.totalEstimatedCost)})
        </Button>
      </CardFooter>
    </Card>
  )
}
