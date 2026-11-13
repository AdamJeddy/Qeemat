export const colors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textMuted: '#64748B',
  textSoft: '#94A3B8',
  primary: '#075FD8',
  primaryDark: '#0347A8',
  green: '#16833A',
  greenSoft: '#DDF8E5',
  red: '#C2410C',
  redSoft: '#FFEDD5',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  blueSoft: '#DBEAFE',
  scrim: '#0F172A80'
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12
};

export const shadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 3
};

export const typography = {
  screenTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  detailTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  sheetTitle: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  price: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  priceSmall: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '500' }
} as const;

export const layoutMetrics = {
  screenGutter: 20,
  cardPadding: 16,
  sectionGap: 16,
  rowGap: 12,
  touchTarget: 44
} as const;
