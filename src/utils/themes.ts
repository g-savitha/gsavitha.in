/**
 * Centralized theme color definitions.
 * This ensures consistency between the server-rendered BaseHead and the client-rendered ThemePicker.
 */

export type ThemeName = 'pink' | 'purple' | 'yellow' | 'green' | 'blue';

export interface ColorTheme {
  primary: string;
  hover: string;
}

export const THEMES: Record<ThemeName, ColorTheme> = {
  pink: { primary: '#f472b6', hover: '#f9a8d4' },
  purple: { primary: '#c084fc', hover: '#d8b4fe' },
  yellow: { primary: '#facc15', hover: '#fde047' },
  green: { primary: '#4ade80', hover: '#86efac' },
  blue: { primary: '#60a5fa', hover: '#93c5fd' },
};

export const DEFAULT_THEME: ThemeName = 'blue';

/**
 * Gets the primary color for a theme name.
 */
export function getThemeColor(name: ThemeName): string {
  return THEMES[name]?.primary || THEMES[DEFAULT_THEME].primary;
}

/**
 * Gets the hover color for a theme name.
 */
export function getThemeHoverColor(name: ThemeName): string {
  return THEMES[name]?.hover || THEMES[DEFAULT_THEME].hover;
}
