// ──────────────────────────────────────────────────────────
// THEMES — felt color + background gradient + accent palette
// ──────────────────────────────────────────────────────────

export const THEMES = {
  forest: {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    felt: {
      from: '#1f5e44',
      mid: '#0f3d2c',
      to: '#0a2519',
    },
    bgFrom: '#0a1410',
    bgTo: '#0f3d2c',
    accent: '#f5d989',
    panelBg: '#0f1d18',
    panelBg2: '#14271f',
    line: '#1f3a2e',
    text: '#ecfdf5',
    animation: 'none',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    felt: {
      from: '#1e4a6e',
      mid: '#0f2d4a',
      to: '#0a1a30',
    },
    bgFrom: '#0a0f1a',
    bgTo: '#0f2d4a',
    accent: '#7ec4f5',
    panelBg: '#0f1825',
    panelBg2: '#142336',
    line: '#1f3050',
    text: '#e0f0fd',
    animation: 'waves',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    emoji: '🍷',
    felt: {
      from: '#5e1f2a',
      mid: '#3d0f1a',
      to: '#250a12',
    },
    bgFrom: '#1a0a0f',
    bgTo: '#3d0f1a',
    accent: '#f5b07a',
    panelBg: '#1d0f12',
    panelBg2: '#27141a',
    line: '#3a1f25',
    text: '#fde0e7',
    animation: 'none',
  },
  royal: {
    id: 'royal',
    name: 'Royal',
    emoji: '👑',
    felt: {
      from: '#4a1f6e',
      mid: '#2d0f4a',
      to: '#1a0a30',
    },
    bgFrom: '#100a1a',
    bgTo: '#2d0f4a',
    accent: '#d4a5f5',
    panelBg: '#180f25',
    panelBg2: '#221436',
    line: '#3a1f50',
    text: '#f0e0fd',
    animation: 'none',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    emoji: '🌅',
    felt: {
      from: '#6e3a1f',
      mid: '#4a1f0f',
      to: '#30140a',
    },
    bgFrom: '#1a0d0a',
    bgTo: '#4a1f0f',
    accent: '#ffc473',
    panelBg: '#251410',
    panelBg2: '#36211b',
    line: '#503a2f',
    text: '#fde7d0',
    animation: 'none',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    emoji: '✨',
    felt: {
      from: '#1a1a2e',
      mid: '#0f0f1a',
      to: '#080812',
    },
    bgFrom: '#050508',
    bgTo: '#0f0f1a',
    accent: '#d4b675',
    panelBg: '#0f0f18',
    panelBg2: '#141420',
    line: '#252535',
    text: '#f0f0fa',
    animation: 'stars',
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    emoji: '💫',
    felt: {
      from: '#6e1f5e',
      mid: '#4a0f4a',
      to: '#1a0a30',
    },
    bgFrom: '#0a0518',
    bgTo: '#4a0f4a',
    accent: '#00ffea',
    panelBg: '#180f20',
    panelBg2: '#22142e',
    line: '#3a1f50',
    text: '#f0e0ff',
    animation: 'pulse',
  },
  ivory: {
    id: 'ivory',
    name: 'Ivory',
    emoji: '🪶',
    felt: {
      from: '#8e7a55',
      mid: '#6e5c3a',
      to: '#4a3d25',
    },
    bgFrom: '#1a1410',
    bgTo: '#4a3d25',
    accent: '#fff3d4',
    panelBg: '#1d1812',
    panelBg2: '#271f18',
    line: '#3a2f25',
    text: '#fdf5e0',
    animation: 'none',
  },
};

export function getTheme(themeId) {
  return THEMES[themeId] ?? THEMES.forest;
}

export const THEME_LIST = Object.values(THEMES);

// ──────────────────────────────────────────────────────────
// CARD BACK DESIGNS
// ──────────────────────────────────────────────────────────

export const CARD_BACKS = {
  'classic-red': {
    id: 'classic-red',
    name: 'Classic Red',
    primary: '#8b2820',
    secondary: '#5a1610',
    pattern: 'diagonal',
  },
  'classic-blue': {
    id: 'classic-blue',
    name: 'Classic Blue',
    primary: '#1e4a8b',
    secondary: '#0f2d5a',
    pattern: 'diagonal',
  },
  'black-gold': {
    id: 'black-gold',
    name: 'Black & Gold',
    primary: '#0a0a0a',
    secondary: '#1a1a1a',
    accent: '#d4b675',
    pattern: 'geometric',
  },
  'floral': {
    id: 'floral',
    name: 'Floral',
    primary: '#e8e0d0',
    secondary: '#d4c8b0',
    accent: '#8b2820',
    pattern: 'floral',
  },
  'starfield': {
    id: 'starfield',
    name: 'Starfield',
    primary: '#0a0a1a',
    secondary: '#1a1a2e',
    accent: '#ffffff',
    pattern: 'stars',
  },
  'minimal': {
    id: 'minimal',
    name: 'Minimal',
    primary: '#5b8c70',
    secondary: '#3a5d4a',
    pattern: 'solid',
  },
};

export function getCardBack(cardBackId) {
  return CARD_BACKS[cardBackId] ?? CARD_BACKS['classic-red'];
}

export const CARD_BACK_LIST = Object.values(CARD_BACKS);