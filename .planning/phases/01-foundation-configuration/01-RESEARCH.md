# Phase 1: Foundation & Configuration - Research

**Researched:** 2026-01-29
**Domain:** Web application development (Vite + React + TypeScript)
**Confidence:** HIGH

## Summary

Phase 1 focuses on establishing a modern web application development environment using Vite as the build tool, React with TypeScript for the UI, and shadcn/ui with Tailwind CSS for components. The research validates that this stack is current, well-supported, and represents industry best practices as of 2026.

**Key findings:**
- Vite with React TypeScript is the recommended approach for new React projects in 2026 (Create React App was officially deprecated in February 2025)
- shadcn/ui with Tailwind v4 provides a production-ready component library with excellent DX
- Session storage for API keys in browser-only apps is a known security limitation that requires user awareness
- React Hook Form with Zod validation is the modern standard for form handling

**Primary recommendation:** Use Vite's official `npm create vite@latest` scaffold with the `react-ts` template, add shadcn/ui via CLI, implement React Hook Form for API key inputs, and store keys in React Context with session storage backup.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | Latest (5.x+) | Build tool and dev server | Official recommendation since CRA deprecation; extremely fast HMR, native ESM, production builds |
| React | 19.x | UI framework | Industry standard for component-based UIs |
| TypeScript | 5.x | Type safety | Catches errors at compile time; mandatory for production apps |
| Tailwind CSS | 4.x | Utility-first CSS | CSS-first configuration in v4; pairs seamlessly with shadcn/ui |
| shadcn/ui | Latest | Component library | Not npm package - copy/paste into codebase; full customization; built on Radix UI primitives |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Hook Form | 7.x | Form state management | All forms requiring validation; minimal re-renders |
| Zod | 3.x | Schema validation | Type-safe validation with TypeScript inference |
| @hookform/resolvers | Latest | RHF + Zod integration | Connect validation schemas to forms |
| clsx | Latest | Conditional class names | Composing Tailwind classes conditionally |
| tailwind-merge | Latest | Merge Tailwind classes | Resolve conflicting utility classes |
| tw-animate-css | Latest | Animations | Replaces deprecated tailwindcss-animate in Tailwind v4 |
| lucide-react | Latest | Icon library | SVG icons; tree-shakeable; used by shadcn/ui |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite | Next.js | Next.js adds SSR/SSG complexity; use if SEO or server-side data fetching needed |
| React Hook Form | Formik | Formik has more re-renders; React Hook Form is more performant |
| shadcn/ui | Material UI, Chakra UI | Traditional npm packages easier to update, but less customizable |
| Zod | Yup, Joi | Yup lacks TypeScript inference; Joi more verbose |

**Installation:**
```bash
# Create Vite project
npm create vite@latest youtube-knowledge-extractor -- --template react-ts
cd youtube-knowledge-extractor
npm install

# Add Tailwind CSS (v4 style)
npm install tailwindcss@next @tailwindcss/postcss@next

# Add shadcn/ui dependencies
npm install class-variance-authority clsx tailwind-merge lucide-react tw-animate-css

# Add form handling
npm install react-hook-form @hookform/resolvers zod

# Initialize shadcn/ui
npx shadcn@latest init
```

## Architecture Patterns

### Recommended Project Structure
```
youtube-knowledge-extractor/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components (Button, Input, Form, etc.)
│   │   └── features/        # feature-specific components
│   ├── lib/
│   │   ├── utils.ts         # cn() utility for class merging
│   │   └── api/             # API client functions
│   ├── hooks/               # custom React hooks
│   ├── context/             # React Context providers (API keys)
│   ├── types/               # TypeScript type definitions
│   ├── App.tsx              # root component
│   ├── main.tsx             # entry point
│   └── styles/
│       └── globals.css      # Tailwind + theme CSS variables
├── public/                  # static assets
├── .env.example             # template for environment variables
├── components.json          # shadcn/ui config
├── tsconfig.json            # TypeScript config with path aliases
├── vite.config.ts           # Vite configuration
└── package.json
```

### Pattern 1: Session Storage with React Context
**What:** Store API keys in React Context backed by sessionStorage for persistence across page reloads within the same tab.

**When to use:** User-provided API keys that should not persist after browser closes.

**Example:**
```typescript
// src/context/ApiKeysContext.tsx
import { createContext, useContext, useState, useEffect } from 'react'

interface ApiKeys {
  anthropicKey: string
  youtubeKey: string
}

const ApiKeysContext = createContext<{
  keys: ApiKeys
  setKeys: (keys: ApiKeys) => void
} | null>(null)

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const [keys, setKeysState] = useState<ApiKeys>(() => {
    // Initialize from sessionStorage
    const stored = sessionStorage.getItem('api-keys')
    return stored ? JSON.parse(stored) : { anthropicKey: '', youtubeKey: '' }
  })

  // Sync to sessionStorage on changes
  useEffect(() => {
    sessionStorage.setItem('api-keys', JSON.stringify(keys))
  }, [keys])

  const setKeys = (newKeys: ApiKeys) => {
    setKeysState(newKeys)
  }

  return (
    <ApiKeysContext.Provider value={{ keys, setKeys }}>
      {children}
    </ApiKeysContext.Provider>
  )
}

export function useApiKeys() {
  const context = useContext(ApiKeysContext)
  if (!context) throw new Error('useApiKeys must be used within ApiKeysProvider')
  return context
}
```

### Pattern 2: React Hook Form with Zod Validation
**What:** Type-safe form validation using Zod schemas with React Hook Form.

**When to use:** All forms requiring validation (API key inputs, YouTube URL inputs).

**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/forms/react-hook-form
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const apiKeySchema = z.object({
  anthropicKey: z.string().min(1, 'Anthropic API key is required'),
  youtubeKey: z.string().min(1, 'YouTube API key is required'),
})

type ApiKeyFormValues = z.infer<typeof apiKeySchema>

export function ApiKeyForm() {
  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      anthropicKey: '',
      youtubeKey: '',
    },
  })

  const onSubmit = (data: ApiKeyFormValues) => {
    // Save keys to context
    setKeys(data)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields using shadcn/ui Form components */}
    </form>
  )
}
```

### Pattern 3: Masked Password Input
**What:** Input field that masks sensitive data (API keys) after entry while allowing toggle visibility.

**When to use:** API key inputs to prevent shoulder-surfing.

**Example:**
```typescript
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

export function MaskedInput({ value, onChange, placeholder }: Props) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="relative">
      <Input
        type={showKey ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2"
        onClick={() => setShowKey(!showKey)}
      >
        {showKey ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  )
}
```

### Pattern 4: TypeScript Path Aliases
**What:** Configure `@/` import alias for cleaner imports.

**When to use:** All projects to avoid relative path hell (`../../../components`).

**Example:**
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// vite.config.ts
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

// Usage in files
import { Button } from '@/components/ui/button'  // instead of ../../../components/ui/button
```

### Anti-Patterns to Avoid
- **Storing API keys in .env files:** Vite exposes `VITE_*` prefixed variables to client bundle - never put secrets here
- **Using `any` types:** TypeScript's power comes from types; `any` defeats the purpose
- **Excessive re-renders:** Avoid putting form state in React state if using React Hook Form (it manages state internally)
- **Hardcoding Tailwind classes:** Use `cn()` utility from shadcn/ui for conditional classes
- **Not using TypeScript strict mode:** Enable `"strict": true` in tsconfig.json to catch errors early

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validation logic | React Hook Form + Zod | Handles re-renders, error states, async validation, field arrays |
| Class name merging | String concatenation | clsx + tailwind-merge (via `cn()`) | Resolves conflicting Tailwind classes, conditional logic |
| Session persistence | Custom storage wrapper | React Context + useEffect | Standard pattern; easy to test; clear separation |
| Password masking | Custom input component | Native `type="password"` + toggle | Browser-optimized; autocomplete support; accessibility built-in |
| Icon library | Custom SVGs | lucide-react | 1000+ icons, tree-shakeable, consistent sizing |
| UI components | Build from scratch | shadcn/ui | Accessible (Radix UI), themeable, customizable |

**Key insight:** Modern React development is about composition and configuration, not custom solutions. The ecosystem provides battle-tested libraries for common problems. Building custom solutions for these wastes time and introduces bugs.

## Common Pitfalls

### Pitfall 1: VITE_ Prefix Confusion
**What goes wrong:** Developers put API keys in .env files without realizing they're exposed to the client bundle.

**Why it happens:** Coming from Node.js where `process.env` is server-side only; Vite's `import.meta.env` exposes `VITE_*` variables to client.

**How to avoid:**
- Never use `VITE_*` prefix for secrets
- Add warning comments in .env.example: `# WARNING: VITE_* variables are PUBLIC in client bundle`
- For this project, API keys are user-provided via UI, not .env

**Warning signs:** Seeing API keys in browser DevTools Network tab or source code.

### Pitfall 2: shadcn/ui Component Updates
**What goes wrong:** Components are copied into your codebase, so updates require manual re-copying, and breaking changes in dependencies (like cmdk) can break your components.

**Why it happens:** shadcn/ui is not an npm package - it's a copy/paste approach. You own the code after copying.

**How to avoid:**
- Track which components you've installed and their versions
- Monitor shadcn/ui changelog: https://ui.shadcn.com/docs/changelog
- Test components after dependency updates
- Consider the tradeoff: full customization vs. easier updates

**Warning signs:** Components breaking after `npm update`, styles not applying, TypeScript errors in UI components.

### Pitfall 3: Session Storage Security Misunderstanding
**What goes wrong:** Developers treat session storage as "secure" for API keys, when it's accessible to any script on the page (including malicious browser extensions or XSS attacks).

**Why it happens:** Confusion between "session-only" (temporal security) and "secure" (access control).

**How to avoid:**
- Document clearly that this is a browser-only app with limited security
- Warn users not to use on shared/public computers
- Consider adding a disclaimer in the UI: "API keys are stored in your browser session only. Don't use on shared computers."
- For production apps with sensitive data, use BFF (Backend for Frontend) pattern instead

**Warning signs:** User reports of API key theft, unexpected API usage from their keys.

### Pitfall 4: Hot Module Replacement (HMR) Not Working
**What goes wrong:** After making changes, the browser doesn't update, or full page reload is required.

**Why it happens:** Plugin conflicts, caching issues, or incorrect Vite configuration.

**How to avoid:**
- Restart Vite with `--force` flag to clear cache: `npm run dev -- --force`
- Avoid disabling browser cache in DevTools (Vite relies on it)
- Keep Vite plugin list minimal
- Disable browser extensions during development (create dev profile)

**Warning signs:** Having to manually refresh browser, changes not reflecting, stale modules loading.

### Pitfall 5: TypeScript Path Alias Not Working
**What goes wrong:** Imports using `@/` alias cause TypeScript or runtime errors.

**Why it happens:** Path aliases need to be configured in both tsconfig.json (TypeScript) and vite.config.ts (runtime).

**How to avoid:**
- Configure both files (see Pattern 4 above)
- Install `@types/node` for path.resolve: `npm install -D @types/node`
- Restart TypeScript server in editor after config changes

**Warning signs:** "Cannot find module '@/components/ui/button'" errors.

## Code Examples

Verified patterns from official sources:

### Vite + React + TypeScript Project Setup
```bash
# Source: https://vite.dev/guide/
# Requires Node.js 20.19+, 22.12+
npm create vite@latest youtube-knowledge-extractor -- --template react-ts
cd youtube-knowledge-extractor
npm install
npm run dev
```

### shadcn/ui Initialization
```bash
# Source: https://ui.shadcn.com/docs/installation/manual
npx shadcn@latest init

# Add specific components
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add form
npx shadcn@latest add label
```

### Tailwind v4 Setup in globals.css
```css
/* Source: https://ui.shadcn.com/docs/tailwind-v4 */
@import "tailwindcss";
@import "tw-animate-css";

@theme {
  /* CSS variables for colors in oklch format */
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(10% 0 0);
  --color-primary: oklch(55% 0.2 270);
  --color-primary-foreground: oklch(100% 0 0);
  /* ... more theme variables */
}

@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

### React Hook Form with shadcn/ui Form Components
```typescript
// Source: https://ui.shadcn.com/docs/forms/react-hook-form
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const formSchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters'),
})

export function ApiKeyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { apiKey: '' },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create React App | Vite | Feb 2025 (CRA deprecated) | Faster dev server, better DX, official recommendation |
| tailwind.config.js | CSS-first config in globals.css | Tailwind v4 (2024) | Cleaner config, CSS variables for themes |
| tailwindcss-animate | tw-animate-css | Tailwind v4 migration | New package required for shadcn/ui animations |
| Local Storage for sessions | Session Storage + Context | Ongoing best practice | Better security boundary (tab-scoped) |
| LiveData/Redux | React Hook Form for forms | 2022+ | Less boilerplate, better performance |
| Yup validation | Zod validation | 2023+ | TypeScript-first, better inference |

**Deprecated/outdated:**
- **Create React App:** Officially deprecated February 2025; use Vite instead
- **tailwindcss-animate:** Replaced by tw-animate-css in Tailwind v4 + shadcn/ui
- **tailwind.config.js:** Moved to CSS-first configuration in Tailwind v4
- **Formik:** Not deprecated but React Hook Form is more performant and modern

## Revenue Considerations

**Phase revenue impact:** Critical path - must complete before any features can be built.

**Speed to revenue tradeoffs:**
| Decision | Fast Option | "Right" Option | Recommendation | Rationale |
|----------|-------------|----------------|----------------|-----------|
| Component library | Plain HTML + Tailwind | shadcn/ui | shadcn/ui | Copy/paste is fast, accessible out of box, looks professional |
| Form validation | Basic HTML5 validation | React Hook Form + Zod | React Hook Form + Zod | Small upfront cost, prevents bugs that delay launch |
| API key storage | Plain localStorage | Session storage + Context | Session storage + Context | Security matters for user trust; minimal complexity difference |
| TypeScript strict mode | loose config | strict: true | strict: true | Catches bugs early; prevents costly rewrites |
| Testing setup | Skip for now | Vitest + Testing Library | Skip for Phase 1 | Can add in Phase 2; focus on shipping first |

**Monetization architecture notes:**
- This is a browser-only app with user-provided API keys, so no server-side billing infrastructure needed
- Future monetization could involve:
  - Offering managed API keys (requires BFF backend + billing)
  - Premium features like batch processing (requires rate limiting tracking)
  - Export to additional formats (easy to add)
- Current architecture supports freemium model: free tier with user API keys, paid tier with managed keys

**Recommendation:** Ship Phase 1 as-is with user-provided keys. This validates demand without server costs. If users want managed keys later, add BFF backend + Stripe integration.

## Open Questions

Things that couldn't be fully resolved:

1. **Anthropic API Rate Limits in Browser**
   - What we know: Anthropic uses tiered rate limits (Tier 1: 50 RPM, $5 deposit required). Token bucket algorithm with burst protection.
   - What's unclear: How to communicate rate limits to users when they hit them; whether browser usage counts differently than server usage.
   - Recommendation: Implement error handling for rate limit responses (HTTP 429) and display user-friendly messages. Consider adding a "Check API Status" button that tests the key without processing video.

2. **YouTube Data API Quota Management**
   - What we know: YouTube API has daily quota limits per project (not per user). Captions API has specific cost per request.
   - What's unclear: Exact quota costs for this use case; how to warn users before exhausting quota.
   - Recommendation: Research YouTube API quota costs in Phase 2 when implementing YouTube integration. Add quota usage display if possible via API.

3. **CORS Issues with Direct API Calls**
   - What we know: Anthropic API may require CORS proxy for browser usage; YouTube API supports CORS with API key.
   - What's unclear: Whether Anthropic API allows direct browser calls or requires proxy.
   - Recommendation: Test in Phase 2. If CORS blocked, options are: (a) document that users need CORS browser extension, (b) add simple proxy server, or (c) switch to BFF pattern.

## Sources

### Primary (HIGH confidence)
- [Vite Official Guide](https://vite.dev/guide/) - Getting started, commands, HMR
- [Vite Environment Variables](https://vite.dev/guide/env-and-mode) - VITE_ prefix, security
- [shadcn/ui Manual Installation](https://ui.shadcn.com/docs/installation/manual) - Setup steps, dependencies
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) - CSS-first config, tw-animate-css
- [shadcn/ui React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form) - Form pattern with Zod
- [React Hook Form Official Docs](https://react-hook-form.com/) - useForm, Controller, validation modes

### Secondary (MEDIUM confidence)
- [OneUpTime: Production-Ready React + Vite Setup (2026-01-08)](https://oneuptime.com/blog/post/2026-01-08-react-typescript-vite-production-setup/view) - Folder structure, ESLint, TypeScript config
- [Medium: Complete Guide to React + Vite + TypeScript (2026)](https://medium.com/@robinviktorsson/complete-guide-to-setting-up-react-with-typescript-and-vite-2025-468f6556aaf2) - Setup best practices
- [GitGuardian: Stop Leaking API Keys - BFF Pattern (2026-01)](https://blog.gitguardian.com/stop-leaking-api-keys-the-backend-for-frontend-bff-pattern-explained/) - API key security in browsers
- [Medium: React Context + Session Storage](https://medium.com/@rangad/simplifying-state-management-using-react-context-api-with-session-storage-instead-of-redux-cf0563ec9ac4) - Session storage pattern
- [The Register: Claude API Usage Limits (2026-01-05)](https://www.theregister.com/2026/01/05/claude_devs_usage_limits/) - Recent rate limit changes
- [AI Free API: Claude API Quota Guide (2026)](https://www.aifreeapi.com/en/posts/claude-api-quota-tiers-limits) - Tier system details

### Tertiary (LOW confidence)
- WebSearch results for "React Hook Form validation 2026 best practices" - General validation patterns
- WebSearch results for "Vite React common mistakes pitfalls 2026" - HMR troubleshooting

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified from official docs, version numbers current as of 2026-01
- Architecture patterns: HIGH - Patterns extracted from official documentation (Vite, shadcn/ui, React Hook Form)
- Pitfalls: MEDIUM - Based on GitHub issues, blog posts, and official troubleshooting guides; some are anecdotal
- API security: MEDIUM - Security principles verified, but specific CORS behavior needs testing in Phase 2

**Research date:** 2026-01-29
**Valid until:** 2026-03-29 (60 days - React/Vite ecosystem is relatively stable)

**Notes for planner:**
- All dependencies are current and production-ready
- No blockers identified for Phase 1
- Phase 2 will need to verify Anthropic API CORS support
- Consider adding basic error boundaries (not researched but recommended for production apps)
