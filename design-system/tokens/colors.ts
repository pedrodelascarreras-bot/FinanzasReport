/**
 * DRIPFLOW — Official Color Tokens
 *
 * CRITICAL: These hex values are the single source of truth.
 * DO NOT modify, approximate, or derive new values without brand approval.
 * Any UI element that does not match these tokens is considered a bug.
 */

export const colors = {
  /** Page / app background */
  background: "#0B0F1A",

  /** Card surfaces, sidebar, modals */
  backgroundSecondary: "#1A1F36",

  /** Interactive elements: buttons, links, active states */
  primary: "#2563EB",

  /**
   * Gradient array — always applied left→right or top→bottom.
   * [0] = gradient start (blue), [1] = gradient end (purple)
   */
  primaryGradient: ["#2563EB", "#7C3AED"] as const,

  /** Accent / highlight — teal / cyan, used sparingly */
  accent: "#00D4CB",

  /** Primary text — headings and body copy */
  textPrimary: "#F4F6FB",
} as const;

export type ColorToken = keyof typeof colors;

/** CSS custom-property names that map each token in the runtime layer */
export const CSS_VARS = {
  background:          "--df-bg",
  backgroundSecondary: "--df-bg2",
  primary:             "--df-primary",
  accent:              "--df-accent",
  textPrimary:         "--df-text",
} as const;
