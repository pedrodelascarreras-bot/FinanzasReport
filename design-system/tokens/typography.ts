/**
 * DRIPFLOW — Official Typography Tokens
 *
 * Font: Plus Jakarta Sans (Google Fonts)
 * Load via: <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">
 *
 * DO NOT substitute with system fonts in production UI.
 * Fallback stack below is for graceful degradation only.
 */

export const typography = {
  fontFamily: "Plus Jakarta Sans",

  /** Ordered fallback stack — only active when Plus Jakarta Sans fails to load */
  fontFamilyStack:
    "'Plus Jakarta Sans', 'Inter', 'DM Sans', system-ui, -apple-system, sans-serif",

  weights: {
    medium:   500,
    semibold: 600,
    bold:     700,
  },

  /** Type scale — rem units, base 16px */
  scale: {
    xs:   "0.625rem",   // 10px — labels, badges, kickers
    sm:   "0.6875rem",  // 11px — meta, captions
    base: "0.8125rem",  // 13px — body
    md:   "0.9375rem",  // 15px — subheadings
    lg:   "1.0625rem",  // 17px — headings
    xl:   "1.375rem",   // 22px — section titles
    "2xl":"1.625rem",   // 26px — KPI values
    "3xl":"2rem",       // 32px — hero values
  },

  /** Tracking (letter-spacing) presets */
  tracking: {
    kicker: "0.09em",   // ALL-CAPS labels
    tight:  "-0.03em",  // large numerals, brand wordmark
    normal: "0",
  },
} as const;

export type TypographyToken = keyof typeof typography;
