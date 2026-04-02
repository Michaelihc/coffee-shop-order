import {
  teamsLightTheme,
  teamsDarkTheme,
  teamsHighContrastTheme,
  type Theme,
} from "@fluentui/react-components";

/**
 * Coffee Shop light theme — warm cream/brown palette layered on top of
 * the Teams light theme so all Fluent tokens resolve correctly.
 */
export const coffeeTheme: Theme = {
  ...teamsLightTheme,

  /* ── Brand (primary action color — coffee brown) ── */
  colorBrandBackground: "#9F5A37",
  colorBrandBackgroundHover: "#8A4E30",
  colorBrandBackgroundPressed: "#7B4529",
  colorBrandBackgroundSelected: "#9F5A37",
  colorBrandBackgroundStatic: "#9F5A37",
  colorBrandForeground1: "#9F5A37",
  colorBrandForeground2: "#7B4529",
  colorBrandForeground2Hover: "#5A3420",
  colorBrandForeground2Pressed: "#3B2218",
  colorBrandForegroundLink: "#9F5A37",
  colorBrandForegroundLinkHover: "#7B4529",
  colorBrandForegroundLinkPressed: "#5A3420",
  colorBrandForegroundLinkSelected: "#9F5A37",
  colorBrandStroke1: "#9F5A37",
  colorBrandStroke2: "rgba(159,90,55,0.35)",
  colorBrandStroke2Hover: "rgba(159,90,55,0.50)",
  colorBrandStroke2Pressed: "#9F5A37",
  colorBrandStroke2Contrast: "rgba(159,90,55,0.35)",

  /* ── Compound brand (tab indicators, toggles, checkboxes) ── */
  colorCompoundBrandBackground: "#9F5A37",
  colorCompoundBrandBackgroundHover: "#8A4E30",
  colorCompoundBrandBackgroundPressed: "#7B4529",
  colorCompoundBrandForeground1: "#9F5A37",
  colorCompoundBrandForeground1Hover: "#8A4E30",
  colorCompoundBrandForeground1Pressed: "#7B4529",
  colorCompoundBrandStroke: "#9F5A37",
  colorCompoundBrandStrokeHover: "#8A4E30",
  colorCompoundBrandStrokePressed: "#7B4529",

  /* ── Brand background 2 (selected/tinted surfaces) ── */
  colorBrandBackground2: "rgba(159,90,55,0.12)",
  colorBrandBackground2Hover: "rgba(159,90,55,0.18)",
  colorBrandBackground2Pressed: "rgba(159,90,55,0.24)",
  colorBrandBackgroundInverted: "#FFF9F3",
  colorBrandBackgroundInvertedHover: "rgba(159,90,55,0.12)",
  colorBrandBackgroundInvertedPressed: "rgba(159,90,55,0.20)",
  colorBrandBackgroundInvertedSelected: "rgba(159,90,55,0.16)",
  colorBrandForegroundInverted: "#C87A54",
  colorBrandForegroundInvertedHover: "#D48B64",
  colorBrandForegroundInvertedPressed: "#C87A54",
  colorBrandForegroundOnLight: "#9F5A37",
  colorBrandForegroundOnLightHover: "#8A4E30",
  colorBrandForegroundOnLightPressed: "#7B4529",
  colorBrandForegroundOnLightSelected: "#8A4E30",

  /* ── Neutral foreground brand variants ── */
  colorNeutralForeground2BrandHover: "#9F5A37",
  colorNeutralForeground2BrandPressed: "#7B4529",
  colorNeutralForeground2BrandSelected: "#9F5A37",
  colorNeutralForeground3BrandHover: "#9F5A37",
  colorNeutralForeground3BrandPressed: "#7B4529",
  colorNeutralForeground3BrandSelected: "#9F5A37",

  /* ── Neutral backgrounds (warm cream palette) ── */
  colorNeutralBackground1: "#FFF9F3",
  colorNeutralBackground1Hover: "#F4EAD2",
  colorNeutralBackground1Pressed: "#E8D5C0",
  colorNeutralBackground2: "#F4EAD2",
  colorNeutralBackground3: "#E8D5C0",
  colorNeutralBackground3Hover: "#DDCBB2",
  colorNeutralBackground4: "#D4C0A8",
  colorNeutralBackgroundDisabled: "#E8D5C0",

  /* ── Neutral foregrounds (dark espresso text) ── */
  colorNeutralForeground1: "#3B2218",
  colorNeutralForeground2: "#5A3420",
  colorNeutralForeground3: "#7B4B2A",
  colorNeutralForeground4: "#9F7A5A",
  colorNeutralForegroundDisabled: "#B8A08A",
  colorNeutralForegroundOnBrand: "#FFF9F3",

  /* ── Strokes / borders ── */
  colorNeutralStroke1: "rgba(159,90,55,0.18)",
  colorNeutralStroke1Hover: "rgba(159,90,55,0.28)",
  colorNeutralStroke1Pressed: "rgba(159,90,55,0.35)",
  colorNeutralStroke2: "rgba(159,90,55,0.10)",
  colorNeutralStrokeDisabled: "rgba(159,90,55,0.08)",
  colorNeutralStrokeAccessible: "#9F5A37",

  /* ── Subtle backgrounds (for subtle buttons, hover rows) ── */
  colorSubtleBackground: "transparent",
  colorSubtleBackgroundHover: "rgba(159,90,55,0.08)",
  colorSubtleBackgroundPressed: "rgba(159,90,55,0.14)",
  colorSubtleBackgroundSelected: "rgba(159,90,55,0.10)",

  /* ── Shadow (warm tone) ── */
  shadow2: "0 1px 2px rgba(59,34,24,0.08)",
  shadow4: "0 2px 8px rgba(59,34,24,0.10)",
  shadow8: "0 4px 16px rgba(59,34,24,0.12)",
  shadow16: "0 8px 32px rgba(59,34,24,0.14)",
};

/** Shared brand overrides for dark mode */
const coffeeBrandDark = {
  /* ── Brand (lighter coffee/gold tones for dark backgrounds) ── */
  colorBrandBackground: "#9F5A37",
  colorBrandBackgroundHover: "#B56A44",
  colorBrandBackgroundPressed: "#7B4529",
  colorBrandBackgroundSelected: "#9F5A37",
  colorBrandBackgroundStatic: "#9F5A37",
  colorBrandForeground1: "#C87A54",
  colorBrandForeground2: "#DDAF6B",
  colorBrandForeground2Hover: "#E8C484",
  colorBrandForeground2Pressed: "#C87A54",
  colorBrandForegroundLink: "#DDAF6B",
  colorBrandForegroundLinkHover: "#E8C484",
  colorBrandForegroundLinkPressed: "#C87A54",
  colorBrandForegroundLinkSelected: "#DDAF6B",
  colorBrandStroke1: "#C87A54",
  colorBrandStroke2: "rgba(200,122,84,0.35)",
  colorBrandStroke2Hover: "rgba(200,122,84,0.50)",
  colorBrandStroke2Pressed: "#C87A54",
  colorBrandStroke2Contrast: "rgba(200,122,84,0.35)",

  /* ── Compound brand ── */
  colorCompoundBrandBackground: "#9F5A37",
  colorCompoundBrandBackgroundHover: "#B56A44",
  colorCompoundBrandBackgroundPressed: "#8A4E30",
  colorCompoundBrandForeground1: "#C87A54",
  colorCompoundBrandForeground1Hover: "#DDAF6B",
  colorCompoundBrandForeground1Pressed: "#B56A44",
  colorCompoundBrandStroke: "#C87A54",
  colorCompoundBrandStrokeHover: "#DDAF6B",
  colorCompoundBrandStrokePressed: "#B56A44",

  /* ── Brand background 2 ── */
  colorBrandBackground2: "rgba(159,90,55,0.20)",
  colorBrandBackground2Hover: "rgba(159,90,55,0.28)",
  colorBrandBackground2Pressed: "rgba(159,90,55,0.36)",
  colorBrandBackgroundInverted: "#3B2218",
  colorBrandBackgroundInvertedHover: "rgba(159,90,55,0.20)",
  colorBrandBackgroundInvertedPressed: "rgba(159,90,55,0.30)",
  colorBrandBackgroundInvertedSelected: "rgba(159,90,55,0.25)",
  colorBrandForegroundInverted: "#9F5A37",
  colorBrandForegroundInvertedHover: "#8A4E30",
  colorBrandForegroundInvertedPressed: "#9F5A37",
  colorBrandForegroundOnLight: "#9F5A37",
  colorBrandForegroundOnLightHover: "#8A4E30",
  colorBrandForegroundOnLightPressed: "#7B4529",
  colorBrandForegroundOnLightSelected: "#8A4E30",

  /* ── Neutral foreground brand variants ── */
  colorNeutralForeground2BrandHover: "#C87A54",
  colorNeutralForeground2BrandPressed: "#DDAF6B",
  colorNeutralForeground2BrandSelected: "#C87A54",
  colorNeutralForeground3BrandHover: "#C87A54",
  colorNeutralForeground3BrandPressed: "#DDAF6B",
  colorNeutralForeground3BrandSelected: "#C87A54",

  colorNeutralForegroundOnBrand: "#FFF9F3",
};

/**
 * Coffee Shop dark theme — same brand palette adapted for dark surfaces.
 */
export const coffeeDarkTheme: Theme = {
  ...teamsDarkTheme,
  ...coffeeBrandDark,
};

/**
 * Coffee Shop high-contrast theme — brand overrides on the accessible HC base.
 * Uses the same dark brand tokens but keeps HC's strong contrast ratios intact.
 */
export const coffeeHighContrastTheme: Theme = {
  ...teamsHighContrastTheme,
  ...coffeeBrandDark,
};

/**
 * Returns the correct coffee theme for a Teams theme string.
 * Teams sends: "default" (light), "dark", "contrast", or "glass".
 */
export function resolveTheme(teamsTheme: string | undefined): Theme {
  switch (teamsTheme) {
    case "dark":
      return coffeeDarkTheme;
    case "contrast":
      return coffeeHighContrastTheme;
    default:
      return coffeeTheme;
  }
}
