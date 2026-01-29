# Phase 03: Video Selection - Research

**Researched:** 2026-01-29
**Domain:** React multi-select UI patterns, checkbox state management, selection persistence
**Confidence:** HIGH

## Summary

Phase 03 implements multi-select checkbox functionality for video lists. The standard approach uses native HTML checkboxes with React state management via Set (not Array) for O(1) lookup performance. shadcn/ui provides a Radix UI-based Checkbox component with built-in accessibility (keyboard navigation, ARIA attributes, indeterminate state).

The critical architectural decision is using Set for selection state instead of Array - when checking "is this video selected?" with 500+ videos loaded, Set provides O(1) lookup vs Array's O(n) scan, preventing UI lag. For "select all" functionality, the parent checkbox must support indeterminate state (some selected) using the ref-based indeterminate property. Selection persistence requires sessionStorage sync with a custom hook, using React 18's useSyncExternalStore for concurrent rendering compatibility.

The existing codebase uses "Load More" pagination that accumulates videos in a single array, making selection state straightforward - track selected video IDs in Set, persist to sessionStorage on change, restore on mount. The VideoCard component needs checkbox integration, and VideoList needs a selection toolbar with count + select all/none controls.

**Primary recommendation:** Use Set<string> for selection state (video IDs as keys), implement useSyncExternalStore hook for sessionStorage sync, add shadcn/ui Checkbox to VideoCard, create SelectionToolbar with indeterminate "select all" checkbox. Use TDD with React Testing Library's toBeChecked() assertions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui Checkbox | latest | Accessible checkbox component | Already chosen, built on Radix UI with ARIA support, indeterminate state |
| @radix-ui/react-checkbox | 1.x | Checkbox primitives | Underlies shadcn/ui, handles tri-state (checked/unchecked/indeterminate) |
| React 18 hooks | 19.2.0 | State management (useState, useEffect, useRef) | Already in project, useRef needed for indeterminate property |
| TypeScript | 5.9.3 | Type safety for selection state | Already in project, prevents ID type mismatches |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Testing Library | via vitest | Checkbox interaction tests | Testing selection behavior, use toBeChecked() assertion |
| lucide-react | 0.563.0 | Icons (Check, Minus for indeterminate) | Already in project, for checkbox indicators |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Set | Array | Array is O(n) for includes() - causes lag with 500+ videos. Set is O(1) for has() |
| sessionStorage | localStorage | localStorage persists across sessions - sessionStorage clears on tab close, better for ephemeral selection |
| Custom hook | Zustand/Jotai | State library adds dependency - custom hook with useSyncExternalStore sufficient for single feature |
| useSyncExternalStore | useState + useEffect | useState + useEffect works but doesn't support React 18 concurrent features - useSyncExternalStore is future-proof |

**Installation:**
```bash
# Checkbox component (if not installed)
npx shadcn@latest add checkbox

# No additional dependencies needed - Set, sessionStorage, hooks are native
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── features/
│       ├── VideoCard.tsx              # Add checkbox to existing component
│       ├── VideoList.tsx              # Add SelectionToolbar
│       └── SelectionToolbar.tsx       # NEW: Select all/none controls + count
├── hooks/
│   ├── useVideoSelection.ts           # NEW: Selection state + sessionStorage sync
│   └── useSessionStorage.ts           # NEW: Generic sessionStorage hook with useSyncExternalStore
└── types/
    └── youtube.ts                     # VideoItem already defined
```

### Pattern 1: Set-Based Selection State
**What:** Track selected video IDs in Set for O(1) lookup performance
**When to use:** Any multi-select list, especially with 50+ items
**Example:**
```typescript
// Source: https://www.simple-table.com/blog/react-table-row-selection-guide
// Verified: Set provides O(1) has() vs Array O(n) includes()

interface UseVideoSelectionResult {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  selectionCount: number;
}

function useVideoSelection(videoIds: string[]): UseVideoSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id); // O(1) lookup
  }, [selectedIds]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectionCount: selectedIds.size,
  };
}
```

### Pattern 2: sessionStorage Sync with useSyncExternalStore
**What:** Persist selection to sessionStorage, sync across re-mounts (not tabs - sessionStorage is tab-scoped)
**When to use:** Selection that should survive "Load More" operations and component re-renders
**Example:**
```typescript
// Source: https://www.yeti.co/blog/managing-persistent-browser-data-with-usesyncexternalstore
// Verified: React 18 useSyncExternalStore is the modern approach for external stores

import { useSyncExternalStore, useCallback } from 'react';

function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  // Subscribe to storage events (not for sessionStorage cross-tab, but for consistency)
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
  }, []);

  // Get current value from sessionStorage
  const getSnapshot = useCallback(() => {
    const item = sessionStorage.getItem(key);
    if (!item) return initialValue;
    try {
      return JSON.parse(item) as T;
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  // SSR-safe server snapshot
  const getServerSnapshot = () => initialValue;

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback((newValue: T) => {
    sessionStorage.setItem(key, JSON.stringify(newValue));
    // Dispatch storage event to notify other useSyncExternalStore instances
    window.dispatchEvent(new Event('storage'));
  }, [key]);

  return [value, setValue];
}

// Usage in selection hook
function useVideoSelection(videoIds: string[]) {
  // Persist selection to sessionStorage as array (Set not JSON-serializable)
  const [selectedArray, setSelectedArray] = useSessionStorage<string[]>(
    'selected-videos',
    []
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(selectedArray)
  );

  // Sync Set to sessionStorage whenever it changes
  useEffect(() => {
    setSelectedArray(Array.from(selectedIds));
  }, [selectedIds, setSelectedArray]);

  // ... rest of selection logic
}
```

### Pattern 3: Indeterminate "Select All" Checkbox
**What:** Parent checkbox shows checked/unchecked/indeterminate state based on children
**When to use:** Select all/none controls for multi-select lists
**Example:**
```typescript
// Source: https://dev.to/gsto/how-to-build-an-indeterminate-checkbox-in-react-kbh
// Source: https://www.radix-ui.com/docs/primitives/components/checkbox
// Verified: indeterminate is IDL property, must be set via ref

import { useRef, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

interface SelectAllCheckboxProps {
  totalCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function SelectAllCheckbox({
  totalCount,
  selectedCount,
  onSelectAll,
  onClearAll,
}: SelectAllCheckboxProps) {
  const checkboxRef = useRef<HTMLButtonElement>(null);

  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isSomeSelected = selectedCount > 0 && selectedCount < totalCount;

  // Set indeterminate state via ref (not available as prop)
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const handleChange = () => {
    if (isAllSelected || isSomeSelected) {
      onClearAll();
    } else {
      onSelectAll();
    }
  };

  return (
    <Checkbox
      ref={checkboxRef}
      checked={isAllSelected}
      onCheckedChange={handleChange}
      aria-label="Select all videos"
    />
  );
}
```

### Pattern 4: Checkbox Integration in List Items
**What:** Add checkbox to VideoCard without breaking existing layout
**When to use:** Multi-select in card/list layouts
**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/components/checkbox
// Verified: shadcn/ui Checkbox with label pattern

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { VideoItem } from '@/types/youtube';

interface VideoCardProps {
  video: VideoItem;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
}

export function VideoCard({ video, isSelected, onToggleSelection }: VideoCardProps) {
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg border hover:shadow-md transition-shadow overflow-hidden">
      {/* Checkbox - added to existing card */}
      <div className="flex items-start pt-1">
        <Checkbox
          id={`video-${video.id}`}
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(video.id)}
          aria-label={`Select ${video.title}`}
        />
      </div>

      {/* Existing thumbnail */}
      <div className="flex-shrink-0">
        <img
          src={video.thumbnail}
          alt={video.title}
          width={120}
          height={68}
          loading="lazy"
          className="rounded object-cover"
          style={{ aspectRatio: '16/9' }}
        />
      </div>

      {/* Existing video info */}
      <div className="flex-1 min-w-0 space-y-1">
        <Label
          htmlFor={`video-${video.id}`}
          className="font-medium text-sm line-clamp-2 leading-tight cursor-pointer"
        >
          {video.title}
        </Label>
        <p className="text-xs text-muted-foreground">
          {formatDate(video.publishedAt)}
        </p>
      </div>
    </div>
  );
}
```

### Pattern 5: Selection Toolbar Component
**What:** Persistent toolbar showing selection count and controls
**When to use:** Multi-select interfaces that need bulk actions
**Example:**
```typescript
// Source: Best practices from https://www.eleken.co/blog-posts/checkbox-ux
// Verified: Selection count + clear controls are UX standard

interface SelectionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function SelectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearAll,
}: SelectionToolbarProps) {
  if (totalCount === 0) return null;

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        <SelectAllCheckbox
          totalCount={totalCount}
          selectedCount={selectedCount}
          onSelectAll={onSelectAll}
          onClearAll={onClearAll}
        />
        <span className="text-sm font-medium">
          {selectedCount === 0
            ? 'Select videos'
            : `${selectedCount} of ${totalCount} selected`}
        </span>
      </div>

      {selectedCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
        >
          Clear selection
        </Button>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Using Array for selection state:** Array.includes() is O(n) - with 500 videos loaded, every checkbox click triggers 500 comparisons. Use Set.has() for O(1).
- **Storing full video objects in selection:** Only store IDs (strings). Storing full objects wastes memory and makes serialization to sessionStorage expensive.
- **Using localStorage instead of sessionStorage:** Selection is ephemeral - should clear when user closes tab. localStorage persists forever.
- **Setting indeterminate via prop:** indeterminate is an IDL property, not a content attribute. Must set via ref (checkbox.current.indeterminate = true).
- **Not using aria-label on checkboxes:** Screen readers need context - "Select Video Title" not just "checkbox".
- **Controlling checkbox with value prop:** Checkboxes use checked prop, not value. value is for form submission data.
- **Forgetting keyboard navigation:** Space key should toggle checkbox. shadcn/ui handles this, but custom checkboxes must implement.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checkbox component | Custom styled input[type=checkbox] | shadcn/ui Checkbox (Radix UI) | Indeterminate state, keyboard nav, ARIA, focus management - 200+ lines to do correctly |
| sessionStorage sync | Manual getItem/setItem in useEffect | useSyncExternalStore hook | React 18 concurrent rendering needs external store integration - race conditions with manual sync |
| Selection state logic | Inline useState in component | Custom useVideoSelection hook | Select all/none, toggle, persistence - logic gets complex quickly, better isolated |
| Indeterminate calculation | Manual if/else in render | Derived state in hook | isSomeSelected = count > 0 && count < total - easy to get wrong, belongs in reusable logic |
| Set to Array conversion | Manual Array.from() everywhere | Utility functions in hook | JSON.stringify(new Set()) returns {} - need explicit conversion, centralize it |

**Key insight:** Multi-select checkbox lists have surprising complexity - indeterminate state requires refs, selection persistence needs serialization, performance requires Set not Array, accessibility requires ARIA labels and keyboard support. shadcn/ui Checkbox + custom selection hook handles 90% of the work.

## Common Pitfalls

### Pitfall 1: Using Array Instead of Set for Selection State
**What goes wrong:** UI lags when toggling checkboxes with 100+ videos loaded
**Why it happens:** Array.includes(id) iterates entire array - O(n) complexity. With 500 videos, every click does 500 comparisons.
**How to avoid:** Use Set<string> for selection state. Set.has(id) is O(1) hashtable lookup. Convert to Array only when serializing to sessionStorage.
**Warning signs:** Checkbox clicks feel sluggish, React DevTools shows slow render times on large lists

### Pitfall 2: Not Setting Indeterminate State via Ref
**What goes wrong:** "Select all" checkbox never shows indeterminate state (dash icon when some selected)
**Why it happens:** Developers try to set indeterminate as a prop like <Checkbox indeterminate={true} />. indeterminate is an IDL property (JavaScript-only), not an HTML attribute.
**How to avoid:** Use useRef to get checkbox element, set element.indeterminate = true in useEffect. See Pattern 3 example.
**Warning signs:** Checkbox only shows checked/unchecked, never shows dash icon for partial selection

### Pitfall 3: Selection State Lost on "Load More"
**What goes wrong:** User selects videos, clicks "Load More", selection disappears
**Why it happens:** Selection state in useState without persistence, component re-renders lose state
**How to avoid:** Persist selection to sessionStorage using useSyncExternalStore hook. Restore on mount, save on every change.
**Warning signs:** Users complain selection doesn't persist when loading more videos

### Pitfall 4: Horizontal Checkbox Layout
**What goes wrong:** Hard to scan options, users miss checkboxes
**Why it happens:** Trying to fit more on screen by arranging horizontally
**How to avoid:** Always use vertical layout for checkbox lists. Horizontal only works for 2-3 options. With 50+ videos, vertical is mandatory.
**Warning signs:** User testing shows people scrolling past checkboxes, low selection engagement

### Pitfall 5: Small Clickable Area
**What goes wrong:** Users must click tiny checkbox, miss clicks, frustration
**Why it happens:** Only checkbox input is clickable, not label or entire card
**How to avoid:** Use Label component with htmlFor pointing to checkbox ID. Optionally make entire card clickable (more controversial for cards with other actions).
**Warning signs:** User testing shows multiple failed click attempts, accessibility complaints

### Pitfall 6: Not Clearing Selection After Action
**What goes wrong:** User processes selected videos, selection persists, confusion on next operation
**Why it happens:** Forgot to call clearSelection() after batch action completes
**How to avoid:** In Phase 4 (batch processing), call clearSelection() after processing completes successfully. Also provide manual "Clear selection" button.
**Warning signs:** Users report "videos still selected" after processing

### Pitfall 7: Checkbox State Desync with Video List
**What goes wrong:** Checkbox shows checked but video ID not in selection Set (or vice versa)
**Why it happens:** Selection state updated but not propagated to child components, or using stale closure in callbacks
**How to avoid:** Derive isSelected from selection Set in parent, pass to VideoCard. Never track selection state in VideoCard itself.
**Warning signs:** Checkboxes appear checked/unchecked incorrectly, selection count doesn't match visible checkmarks

### Pitfall 8: Using localStorage Instead of sessionStorage
**What goes wrong:** Selection persists across browser sessions, user confused seeing old selections
**Why it happens:** localStorage seems "better" because it persists longer
**How to avoid:** Use sessionStorage for ephemeral selection state. Clear when user closes tab. This matches user mental model - selection is temporary workflow state.
**Warning signs:** User opens app next day, sees videos still selected from yesterday

## Code Examples

Verified patterns from official sources:

### Complete useVideoSelection Hook
```typescript
// Source: Combining patterns from React 18 useSyncExternalStore + Set-based state
// Verified: HIGH confidence - built on React 18 primitives + Web Storage API

import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';

// Generic sessionStorage hook with useSyncExternalStore
function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
  }, []);

  const getSnapshot = useCallback(() => {
    const item = sessionStorage.getItem(key);
    if (!item) return initialValue;
    try {
      return JSON.parse(item) as T;
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const getServerSnapshot = () => initialValue;

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback((newValue: T) => {
    sessionStorage.setItem(key, JSON.stringify(newValue));
    window.dispatchEvent(new Event('storage'));
  }, [key]);

  return [value, setValue];
}

// Video selection hook with persistence
export function useVideoSelection(availableVideoIds: string[]) {
  const [selectedArray, setSelectedArray] = useSessionStorage<string[]>(
    'selected-videos',
    []
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(selectedArray)
  );

  // Sync Set to sessionStorage
  useEffect(() => {
    setSelectedArray(Array.from(selectedIds));
  }, [selectedIds, setSelectedArray]);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(availableVideoIds));
  }, [availableVideoIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const getSelectedIds = useCallback(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    getSelectedIds,
    selectionCount: selectedIds.size,
  };
}
```

### Testing Checkbox Selection with React Testing Library
```typescript
// Source: https://testing-library.com/docs/preact-testing-library/example/
// Verified: Use getByRole('checkbox') and toBeChecked() assertion

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VideoCard } from './VideoCard';

describe('VideoCard', () => {
  const mockVideo = {
    id: 'video123',
    title: 'Test Video',
    thumbnail: 'https://example.com/thumb.jpg',
    publishedAt: '2026-01-15T00:00:00Z',
    videoId: 'video123',
  };

  it('renders checkbox that toggles selection', () => {
    const handleToggle = vi.fn();

    render(
      <VideoCard
        video={mockVideo}
        isSelected={false}
        onToggleSelection={handleToggle}
      />
    );

    // Query checkbox by role
    const checkbox = screen.getByRole('checkbox', { name: /select test video/i });
    expect(checkbox).not.toBeChecked();

    // Click to select
    fireEvent.click(checkbox);
    expect(handleToggle).toHaveBeenCalledWith('video123');
  });

  it('shows checkbox as checked when isSelected is true', () => {
    render(
      <VideoCard
        video={mockVideo}
        isSelected={true}
        onToggleSelection={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /select test video/i });
    expect(checkbox).toBeChecked();
  });

  it('label is clickable and toggles checkbox', () => {
    const handleToggle = vi.fn();

    render(
      <VideoCard
        video={mockVideo}
        isSelected={false}
        onToggleSelection={handleToggle}
      />
    );

    // Click label text
    const label = screen.getByText('Test Video');
    fireEvent.click(label);

    expect(handleToggle).toHaveBeenCalledWith('video123');
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Array for selection state | Set for selection | Performance best practice (2020+) | O(1) vs O(n) lookup - critical for 100+ items |
| useState + useEffect for storage | useSyncExternalStore | React 18 (2022) | Concurrent rendering support, cleaner API |
| Custom checkbox styling | shadcn/ui (Radix UI) | 2023-present | Accessibility, indeterminate state, keyboard nav built-in |
| localStorage for all state | sessionStorage for ephemeral | Security best practice | Ephemeral selection doesn't persist across sessions |
| Controlled checkboxes in parent | Derived state pattern | Modern React (2021+) | Single source of truth, no prop drilling |
| Manual indeterminate management | useRef + useEffect | Always been required | indeterminate is IDL property, no way around it |

**Deprecated/outdated:**
- **Array.includes() for selection:** Use Set.has() for performance
- **setting indeterminate as prop:** Never worked, must use ref
- **localStorage for temporary UI state:** Use sessionStorage for ephemeral data
- **Custom checkbox components without accessibility:** Use Radix UI primitives via shadcn/ui

## Revenue Considerations

**Phase revenue impact:** Critical path - users must select videos before batch processing (Phase 4), which is the core product value

**Speed to revenue tradeoffs:**
| Decision | Fast Option | "Right" Option | Recommendation | Rationale |
|----------|-------------|----------------|----------------|-----------|
| Selection UI | Basic checkboxes only | Checkboxes + advanced filters (date range, keyword) | Basic checkboxes only | Filters add complexity but most users will "select all" initially. Can add filters post-MVP based on user feedback. |
| Persistence | No persistence (in-memory only) | sessionStorage persistence | sessionStorage persistence | Minimal code (20 lines) prevents frustration when "Load More" loses selection. Worth the small effort. |
| Select all scope | "Select all on current page" only | "Select all in channel" (across pages) | Current page only | Selecting across pages requires backend or loading all pages - complex. Page-scoped is 90% use case. |
| Indeterminate state | Skip indeterminate (always checked/unchecked) | Full indeterminate support | Full indeterminate support | Indeterminate prevents user confusion ("did I select all?"). Only 10 extra lines with ref approach. |
| Selection count | No count display | Count + progress bar + estimated time | Count only | Count is 1 line of code. Progress bar and time estimates require processing time data from Phase 4. Add later. |

**Monetization architecture notes:**
- **Selection limits for tiers:** Could restrict free tier to 10 videos per batch, premium tier unlimited. Selection hook already tracks count, easy to enforce.
- **Usage tracking:** Selection count + batch size is valuable analytics for pricing model (e.g., charge per video processed). Hook already exposes count.
- **No multi-tenant concerns:** Selection is client-side only, no server state to manage per-user.

**Build for speed to revenue:**
- Use shadcn/ui Checkbox as-is, no custom styling needed
- Implement basic Set-based selection (50 lines total)
- Add sessionStorage persistence (20 lines)
- Skip "select all videos in channel" across pages - page-scoped sufficient for MVP
- No selection filters (date range, keyword) until users request it

## Open Questions

Things that couldn't be fully resolved:

1. **Should selection persist across browser sessions (localStorage)?**
   - What we know: sessionStorage clears on tab close, localStorage persists forever
   - What's unclear: Do users want to resume selection next day, or start fresh?
   - Recommendation: Start with sessionStorage (ephemeral). If users complain about losing selection after closing tab, add "Save selection" feature that moves to localStorage on-demand. Most batch workflows are single-session.

2. **Should "select all" work across paginated pages?**
   - What we know: Current implementation loads videos with "Load More" button. Could have 500+ videos (YouTube API limit).
   - What's unclear: Do users want to select ALL videos in channel, or just loaded videos?
   - Recommendation: "Select all" only applies to currently loaded videos. If user needs all videos, they must "Load More" until all are loaded, then "Select All". Display: "Select all 127 loaded videos" to clarify scope. Avoid false promise of selecting unloaded videos.

3. **How to handle selection when videos list changes (new channel)?**
   - What we know: User can load different channel, video IDs change
   - What's unclear: Clear selection automatically, or persist selection (even though IDs are now invalid)?
   - Recommendation: Clear selection when channel changes (new channel URL submitted). Track current channel ID in selection state, clear if channel ID changes. Prevents phantom selections.

4. **Should clicking video card (not checkbox) toggle selection?**
   - What we know: Larger click target improves UX, but cards might have other actions later (preview, edit)
   - What's unclear: Will cards have other interactive elements? Is click-to-select intuitive?
   - Recommendation: Start with checkbox-only selection. Label is clickable (htmlFor attribute), but not entire card. If user testing shows people struggling to click checkboxes, make card clickable in Phase 3.1 iteration. Safer to start conservative.

## Sources

### Primary (HIGH confidence)
- [Radix UI Checkbox Documentation](https://www.radix-ui.com/docs/primitives/components/checkbox) - Official API reference for indeterminate state, ARIA, keyboard nav
- [shadcn/ui Checkbox Component](https://ui.shadcn.com/docs/components/checkbox) - Radix UI wrapper used in project
- [React 18 useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) - Official React docs for external store integration
- [MDN: Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) - sessionStorage vs localStorage specification

### Secondary (MEDIUM confidence)
- [React Table Row Selection Guide](https://www.simple-table.com/blog/react-table-row-selection-guide) - Set vs Array performance verification
- [Managing Persistent Browser Data with useSyncExternalStore](https://www.yeti.co/blog/managing-persistent-browser-data-with-usesyncexternalstore) - Modern storage sync pattern
- [How to Build an Indeterminate Checkbox in React](https://dev.to/gsto/how-to-build-an-indeterminate-checkbox-in-react-kbh) - indeterminate via ref pattern
- [React Testing Library Best Practices](https://medium.com/@ignatovich.dm/best-practices-for-using-react-testing-library-0f71181bb1f4) - getByRole and toBeChecked patterns
- [Checkbox UX Best Practices](https://www.eleken.co/blog-posts/checkbox-ux) - UX patterns (vertical layout, large click area)

### Tertiary (LOW confidence)
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns) - Zustand growth trends (WebSearch only)
- [Checkbox Design Mistakes](https://cieden.com/book/atoms/checkbox/how-to-design-checkbox-and-avoid-mistakes) - Common UX pitfalls (design-focused, not technical)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - shadcn/ui Checkbox already chosen, Set vs Array performance well-documented, useSyncExternalStore is official React 18 API
- Architecture: HIGH - Patterns verified with official docs (Radix UI, React, MDN)
- Pitfalls: HIGH - Set performance, indeterminate ref requirement, sessionStorage scope confirmed by specs
- sessionStorage sync: MEDIUM - useSyncExternalStore pattern verified but less common than useState + useEffect in wild (newer API)

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - React patterns stable, shadcn/ui active but not rapidly changing)
