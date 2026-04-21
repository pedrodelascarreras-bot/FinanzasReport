# DRIPFLOW — Brand Identity Guidelines

> **These rules are enforced at code-review level.  
> Any violation is treated as a production bug, not a style preference.**

---

## 1. Logo usage

| Rule | Detail |
|------|--------|
| **Always use SVG assets** | Never recreate the logo with CSS, HTML, or Canvas. |
| **Source files** | `design-system/branding/logo.svg` (full wordmark) · `logo-icon.svg` (isotipo) |
| **Minimum size** | Full wordmark: 120px wide · Isotipo only: 24px wide |
| **Clear space** | Equal to the height of the "D" isotipo on all four sides |
| **Forbidden** | Rotating, stretching, recolouring, adding shadows/borders not in the asset, placing on a non-approved background, recreating in CSS |

### Approved backgrounds for the logo
- `#0B0F1A` (brand dark) ✅
- `#1A1F36` (brand secondary) ✅
- White / light neutral for print only ✅
- Any other background requires explicit brand sign-off ❌

---

## 2. Color palette

All colors live in `design-system/tokens/colors.ts` (TypeScript reference) and `design-system/tokens/index.css` (runtime CSS layer).

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0B0F1A` | Page background |
| `backgroundSecondary` | `#1A1F36` | Cards, sidebar, modals |
| `primary` | `#2563EB` | Buttons, links, active states |
| `primaryGradient[0]` | `#2563EB` | Gradient start |
| `primaryGradient[1]` | `#7C3AED` | Gradient end |
| `accent` | `#00D4CB` | Highlights, badges (use sparingly) |
| `textPrimary` | `#F4F6FB` | All body and heading text |

### Rules
- **Never hardcode hex values** in component CSS — always consume a `--df-*` CSS variable.
- **Never modify hex values** without a formal brand decision and update to `colors.ts`.
- **Gradients** always go from `#2563EB` → `#7C3AED`, direction 135° (diagonal) or 90° (horizontal). No other gradient endpoints are approved.
- The `accent` (`#00D4CB`) is a **highlight only** — never use it as a primary action colour.

---

## 3. Typography

Font family: **Plus Jakarta Sans** — load via Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">
```

| Weight | Value | Usage |
|--------|-------|-------|
| Medium | 500 | Body copy, meta labels |
| Semibold | 600 | Subheadings, table values |
| Bold | 700 | KPI values, headings, wordmark |

Rules:
- **Always** reference `var(--df-font)` in CSS, never a hardcoded font string.
- **Never** use system-ui or SF Pro as the intended font in DRIPFLOW UI — the fallback stack is for degradation only.
- Letter-spacing on kicker labels: `var(--df-tracking-kicker)` (`0.09em`).
- Letter-spacing on large numerals / brand wordmark: `var(--df-tracking-tight)` (`-0.03em`).

---

## 4. Applying tokens in CSS

```css
/* ✅ Correct */
.my-button {
  background: var(--df-gradient);
  color: var(--df-text);
  font-family: var(--df-font);
  font-weight: var(--df-weight-semibold);
}

/* ❌ Bug — hardcoded values */
.my-button {
  background: linear-gradient(135deg, #2563EB, #7C3AED);
  color: #F4F6FB;
  font-family: 'Plus Jakarta Sans';
}
```

---

## 5. Applying tokens in JavaScript / TypeScript

```ts
import { colors } from "@/design-system/tokens/colors";
import { typography } from "@/design-system/tokens/typography";

// Use token values directly
const bg = colors.background;          // "#0B0F1A"
const [gradStart, gradEnd] = colors.primaryGradient;
const fontStack = typography.fontFamilyStack;
```

For vanilla JS (no bundler):
```js
import { colors } from "/design-system/tokens/colors.js";
```

---

## 6. What constitutes a bug

The following are **automatic bugs** that block merging:

- [ ] Any hardcoded hex value in a component stylesheet
- [ ] Any use of a font other than Plus Jakarta Sans in DRIPFLOW UI
- [ ] Logo recreated in CSS, Canvas, or any non-SVG technique  
- [ ] A gradient that does not use the exact approved endpoints  
- [ ] Any `--df-*` variable redefined outside `design-system/tokens/index.css`
- [ ] A new UI colour introduced without a matching entry in `colors.ts`

---

## 7. Adding new tokens

1. Add the value to `design-system/tokens/colors.ts` (or `typography.ts`).
2. Mirror it in `design-system/tokens/colors.js` (runtime copy).
3. Add the CSS custom property to `design-system/tokens/index.css`.
4. Update this guidelines file with a new table row.
5. Open a PR titled `[design-system] Add token: <name>`.

Never skip steps — partial token additions break the audit trail.
