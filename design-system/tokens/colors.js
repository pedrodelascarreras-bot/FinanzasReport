/**
 * DRIPFLOW — Color Tokens (runtime JS)
 * Auto-derived from colors.ts — DO NOT edit manually.
 * Source of truth: design-system/tokens/colors.ts
 */

/** @type {Readonly<Record<string, string | string[]>>} */
export const colors = Object.freeze({
  background:          "#0B0F1A",
  backgroundSecondary: "#1A1F36",
  primary:             "#2563EB",
  primaryGradient:     Object.freeze(["#2563EB", "#7C3AED"]),
  accent:              "#00D4CB",
  textPrimary:         "#F4F6FB",
});

/** CSS custom-property names used in the runtime CSS layer */
export const CSS_VARS = Object.freeze({
  background:          "--df-bg",
  backgroundSecondary: "--df-bg2",
  primary:             "--df-primary",
  accent:              "--df-accent",
  textPrimary:         "--df-text",
});
