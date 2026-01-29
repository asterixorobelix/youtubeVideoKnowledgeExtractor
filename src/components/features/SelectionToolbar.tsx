import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

interface SelectionToolbarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
}

export function SelectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
}: SelectionToolbarProps) {
  // Don't render if no videos
  if (totalCount === 0) {
    return null
  }

  // Determine checkbox state
  const allSelected = selectedCount === totalCount && totalCount > 0
  const someSelected = selectedCount > 0 && selectedCount < totalCount
  const noneSelected = selectedCount === 0

  // Checkbox checked prop: true, false, or "indeterminate"
  const checkedState = allSelected ? true : someSelected ? 'indeterminate' : false

  // Handle checkbox change
  const handleCheckboxChange = () => {
    if (allSelected || someSelected) {
      onClearSelection()
    } else {
      onSelectAll()
    }
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
      {/* Left side: checkbox and count */}
      <div className="flex items-center gap-3">
        <Checkbox
          checked={checkedState}
          onCheckedChange={handleCheckboxChange}
          aria-label="Select all videos"
        />
        <span className="text-sm font-medium">
          {noneSelected
            ? 'Select videos'
            : `${selectedCount} of ${totalCount} selected`}
        </span>
      </div>

      {/* Right side: clear button */}
      {selectedCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Clear selection
        </Button>
      )}
    </div>
  )
}
