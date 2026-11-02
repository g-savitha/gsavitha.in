import githubDark from 'shiki/themes/github-dark.mjs';
import type { ThemeRegistration } from 'shiki';

function scopesOf(scope: string | string[] | undefined): string[] {
  if (!scope) return [];
  return Array.isArray(scope) ? scope : [scope];
}

/** Comment tokens only. Mixed scopes that mention a comment stay as the theme defined them. */
function isCommentScope(scope: string): boolean {
  return (
    scope === 'comment' ||
    scope.startsWith('comment.') ||
    scope.startsWith('punctuation.definition.comment') ||
    scope === 'string.comment'
  );
}

/**
 * github-dark colours comments `#6A737D` and leaves them upright.
 * Set `fontStyle` on the comment token so comments render italic.
 */
export function codeTheme(): ThemeRegistration {
  const theme = githubDark as ThemeRegistration;
  return {
    ...theme,
    tokenColors: theme.tokenColors?.map((entry) => {
      const scopes = scopesOf(entry.scope);
      if (scopes.length === 0 || !scopes.every(isCommentScope)) return entry;
      return {
        ...entry,
        settings: { ...entry.settings, fontStyle: 'italic' },
      };
    }),
  };
}
