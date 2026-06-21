/**
 * Centralized theme color definitions.
 * This ensures consistency between the server-rendered BaseHead and the client-rendered ThemePicker.
 */

export const THEME_NAMES = ['pink', 'purple', 'yellow', 'green', 'blue'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const DEFAULT_THEME: ThemeName = 'blue';
