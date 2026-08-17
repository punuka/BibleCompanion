/**
 * A warm, low-contrast palette. This app is often opened at 2am by someone who
 * is not okay — a bright clinical white screen is the wrong thing to hand them.
 */
export const theme = {
  colors: {
    bg: '#12110F',
    surface: '#1C1A17',
    surfaceRaised: '#252220',
    border: '#332F2B',
    text: '#F0EBE3',
    textMuted: '#A69C8F',
    textFaint: '#6E655C',
    accent: '#C8955A',
    accentSoft: '#3A2E20',
    verse: '#E8DCC8',
    danger: '#D9615A',
    dangerBg: '#3A1F1D',
    userBubble: '#2F3A34',
    assistantBubble: '#1C1A17',
  },
  space: (n: number) => n * 4,
  radius: { sm: 8, md: 14, lg: 22, pill: 999 },
  font: {
    body: 16,
    small: 13,
    tiny: 11,
    title: 26,
    heading: 19,
    verse: 17,
  },
} as const;

export type Theme = typeof theme;
