/** Public pages linked from the app (opened in the browser). */
export const links = {
  website: (locale: 'de' | 'en') => `https://mariokernich.github.io/pst-viewer/${locale}/docs/`,
  sourceCode: 'https://github.com/mariokernich/pst-viewer',
  reportProblem: 'https://github.com/mariokernich/pst-viewer/issues'
} as const
