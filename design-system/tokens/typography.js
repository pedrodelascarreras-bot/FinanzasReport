/**
 * DRIPFLOW — Typography Tokens (runtime JS)
 * Auto-derived from typography.ts — DO NOT edit manually.
 * Source of truth: design-system/tokens/typography.ts
 */

export const typography = Object.freeze({
  fontFamily:      "Plus Jakarta Sans",
  fontFamilyStack: "'Plus Jakarta Sans', 'Inter', 'DM Sans', system-ui, -apple-system, sans-serif",

  weights: Object.freeze({
    medium:   500,
    semibold: 600,
    bold:     700,
  }),

  scale: Object.freeze({
    xs:   "0.625rem",
    sm:   "0.6875rem",
    base: "0.8125rem",
    md:   "0.9375rem",
    lg:   "1.0625rem",
    xl:   "1.375rem",
    "2xl":"1.625rem",
    "3xl":"2rem",
  }),

  tracking: Object.freeze({
    kicker: "0.09em",
    tight:  "-0.03em",
    normal: "0",
  }),
});
