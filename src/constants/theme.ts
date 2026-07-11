/**
 * Sipelle design tokens. Values are device points taken from the design
 * handoff prototype (design/design_handoff_sipelle_app) — the app is
 * light-only, so there is no dark palette.
 */

export const colors = {
  ink: '#2B2528',
  body: '#4A4245',
  muted: '#9B8F91',
  washSplash: '#FBE7E6',
  washCream: '#F7EDE0',
  washMint: '#D8EFE4',
  card: '#F3E7D8',
  tile: '#FFFFFF',
  pill: '#F7EDDD',
  rose: '#E9A6B3',
  tabInactive: 'rgba(43, 37, 40, 0.4)',
} as const;

export const homeGradient = {
  colors: ['#E4F5FC', '#F9E4E6', '#FBE9D9', '#FFFFFF'],
  locations: [0, 0.34, 0.62, 1],
} as const;

export const fonts = {
  serif: 'PlayfairDisplay_600SemiBold',
  hand: 'Caveat_600SemiBold',
} as const;

export const shadows = {
  card: '0 10px 24px rgba(90, 70, 50, 0.14)',
  tile: '0 2px 8px rgba(90, 70, 50, 0.10)',
  pill: '0 4px 10px rgba(90, 70, 50, 0.18)',
  toast: '0 6px 16px rgba(0, 0, 0, 0.2)',
} as const;

export const layout = {
  gutter: 20,
  tabBarHeight: 72,
} as const;
