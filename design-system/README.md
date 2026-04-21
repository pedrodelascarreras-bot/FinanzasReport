# DRIPFLOW Design System

> Single source of truth for all brand identity, design tokens, and UI consistency rules.

## Structure

```
design-system/
├── branding/
│   ├── logo.svg          # Full wordmark (isotipo + DRIPFLOW + tagline)
│   ├── logo-icon.svg     # Isotipo only — for favicons, app icons, small spaces
│   └── favicon.svg       # 32×32 favicon (convert to .ico / .png for production)
│
├── tokens/
│   ├── colors.ts         # Color tokens — TypeScript source of truth
│   ├── colors.js         # Runtime copy — import in vanilla JS modules
│   ├── typography.ts     # Typography tokens — TypeScript source of truth
│   ├── typography.js     # Runtime copy — import in vanilla JS modules
│   └── index.css         # CSS custom properties — imported first in styles.css
│
└── guidelines/
    └── branding.md       # Strict brand rules — violations are treated as bugs
```

## Quick start

### 1 — CSS (all components)
`design-system/tokens/index.css` is already imported at the top of `css/styles.css`.  
Use `--df-*` variables in any component:

```css
.card { background: var(--df-bg2); color: var(--df-text); }
.btn  { background: var(--df-gradient); font-family: var(--df-font); }
```

### 2 — JavaScript (vanilla)
```js
import { colors } from "/design-system/tokens/colors.js";
const gradient = `linear-gradient(135deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`;
```

### 3 — TypeScript (build-time tooling)
```ts
import { colors } from "@/design-system/tokens/colors";
```

## Core brand values

| Token | Value |
|-------|-------|
| Background | `#0B0F1A` |
| Surface | `#1A1F36` |
| Primary | `#2563EB` |
| Gradient end | `#7C3AED` |
| Accent | `#00D4CB` |
| Text | `#F4F6FB` |
| Font | Plus Jakarta Sans 500/600/700 |

## Enforcement

- Any hardcoded hex in a component = **bug**
- Any font other than Plus Jakarta Sans = **bug**
- Logo recreated in CSS/Canvas = **bug**
- New colour not in `colors.ts` = **bug**

See [`guidelines/branding.md`](./guidelines/branding.md) for the full ruleset.
