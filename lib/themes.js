// lib/themes.js

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
    effect: 'none',
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
    effect: 'none',
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
    effect: 'none',
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
    effect: 'none',
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
    effect: 'none',
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
    effect: 'none',
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
    effect: 'none',
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
    effect: 'none',
  },

  galaxy: {
    id: 'galaxy',
    name: 'Galaxy',
    emoji: '🌌',
    felt: {
      from: '#1b1f4b',
      mid: '#11162f',
      to: '#090b18',
    },
    bgFrom: '#050816',
    bgTo: '#11162f',
    accent: '#8ab4ff',
    panelBg: '#0d1328',
    panelBg2: '#151d36',
    line: '#24304d',
    text: '#eef4ff',
    animation: 'stars',
    effect: 'galaxy-premium',
  },

  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    emoji: '🟣',
    felt: {
      from: '#1c1c3d',
      mid: '#111125',
      to: '#090914',
    },
    bgFrom: '#07070f',
    bgTo: '#1a1033',
    accent: '#00f5ff',
    panelBg: '#10101d',
    panelBg2: '#171729',
    line: '#2a2a45',
    text: '#f2f8ff',
    animation: 'pulse',
    effect: 'none',
  },

  aurora: {
    id: 'aurora',
    name: 'Aurora',
    emoji: '🟢',
    felt: {
      from: '#1d6b63',
      mid: '#12423e',
      to: '#0a2524',
    },
    bgFrom: '#071412',
    bgTo: '#163b40',
    accent: '#8df5d2',
    panelBg: '#0e1b19',
    panelBg2: '#142523',
    line: '#214542',
    text: '#eafff8',
    animation: 'waves',
    effect: 'none',
  },

  volcano: {
    id: 'volcano',
    name: 'Volcano',
    emoji: '🌋',
    felt: {
      from: '#6a2415',
      mid: '#3b120d',
      to: '#1f0a08',
    },
    bgFrom: '#130605',
    bgTo: '#3b120d',
    accent: '#ff8c42',
    panelBg: '#1a0e0c',
    panelBg2: '#231412',
    line: '#4a241b',
    text: '#ffe7d6',
    animation: 'pulse',
    effect: 'none',
  },

  'ice-palace': {
    id: 'ice-palace',
    name: 'Ice Palace',
    emoji: '❄️',
    felt: {
      from: '#8fd3ff',
      mid: '#4b8fc7',
      to: '#1e4f7a',
    },
    bgFrom: '#08131d',
    bgTo: '#1e4f7a',
    accent: '#dff6ff',
    panelBg: '#0f1b27',
    panelBg2: '#162635',
    line: '#29465d',
    text: '#eefaff',
    animation: 'none',
    effect: 'snow-fall',
  },

  'blood-moon': {
    id: 'blood-moon',
    name: 'Blood Moon',
    emoji: '🌕',
    felt: {
      from: '#552134',
      mid: '#2f101b',
      to: '#16070d',
    },
    bgFrom: '#0d0508',
    bgTo: '#2f101b',
    accent: '#ff7b7b',
    panelBg: '#180b10',
    panelBg2: '#221017',
    line: '#4a1d29',
    text: '#ffe8ee',
    animation: 'pulse',
    effect: 'none',
  },

  'toxic-green': {
    id: 'toxic-green',
    name: 'Toxic Green',
    emoji: '☣️',
    felt: {
      from: '#4d8f1f',
      mid: '#2f5f0f',
      to: '#172d08',
    },
    bgFrom: '#091406',
    bgTo: '#1d3a0d',
    accent: '#b7ff4a',
    panelBg: '#101b0b',
    panelBg2: '#182610',
    line: '#314d20',
    text: '#efffe0',
    animation: 'none',
    effect: 'toxic-bubbles',
  },

  'sakura-night': {
    id: 'sakura-night',
    name: 'Sakura Night',
    emoji: '🌸',
    felt: {
      from: '#6b3a57',
      mid: '#412338',
      to: '#24121f',
    },
    bgFrom: '#140a12',
    bgTo: '#412338',
    accent: '#ffc7de',
    panelBg: '#1d1018',
    panelBg2: '#291720',
    line: '#4a2a3b',
    text: '#ffeef5',
    animation: 'none',
    effect: 'petal-fall',
  },
'emoji-sky': {
  id: 'emoji-sky',
  name: 'Emoji Sky',
  emoji: '😄',
  felt: {
    from: '#1d2b53',
    mid: '#10172f',
    to: '#070a18',
  },
  bgFrom: '#05050b',
  bgTo: '#102447',
  accent: '#ffd84d',
  panelBg: '#0d1526',
  panelBg2: '#13213a',
  line: '#263b63',
  text: '#fff6d6',
  animation: 'none',
  effect: 'emoji-happy',
},

  'spooky-party': {
    id: 'spooky-party',
    name: 'Spooky Party',
    emoji: '👻',
    felt: {
      from: '#4a245a',
      mid: '#2d1438',
      to: '#160b1d',
    },
    bgFrom: '#3a2406',
    bgTo: '#ffd54a',
    accent: '#c78cff',
    panelBg: '#140d1c',
    panelBg2: '#1d1327',
    line: '#362246',
    text: '#f7ecff',
    animation: 'none',
    effect: 'emoji-spooky',
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

  floral: {
    id: 'floral',
    name: 'Floral',
    primary: '#e8e0d0',
    secondary: '#d4c8b0',
    accent: '#8b2820',
    pattern: 'floral',
  },

  starfield: {
    id: 'starfield',
    name: 'Starfield',
    primary: '#0a0a1a',
    secondary: '#1a1a2e',
    accent: '#ffffff',
    pattern: 'stars',
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal',
    primary: '#5b8c70',
    secondary: '#3a5d4a',
    pattern: 'solid',
  },

  'galaxy-purple': {
    id: 'galaxy-purple',
    name: 'Galaxy Purple',
    primary: '#24104a',
    secondary: '#120826',
    accent: '#f8d34f',
    pattern: 'stars',
  },

  'casino-black': {
    id: 'casino-black',
    name: 'Casino Black',
    primary: '#090909',
    secondary: '#181818',
    accent: '#d4b675',
    pattern: 'geometric',
  },

  'toxic-slime': {
    id: 'toxic-slime',
    name: 'Toxic Slime',
    primary: '#5a8d12',
    secondary: '#2b4608',
    accent: '#d4ff63',
    pattern: 'geometric',
  },

  'sakura-bloom': {
    id: 'sakura-bloom',
    name: 'Sakura Bloom',
    primary: '#f7d8e6',
    secondary: '#e7b9cf',
    accent: '#b83d74',
    pattern: 'floral',
  },

  'ice-crystal': {
    id: 'ice-crystal',
    name: 'Ice Crystal',
    primary: '#dff6ff',
    secondary: '#8fd3ff',
    accent: '#1e4f7a',
    pattern: 'geometric',
  },
};

export function getCardBack(cardBackId) {
  return CARD_BACKS[cardBackId] ?? CARD_BACKS['classic-red'];
}

export const CARD_BACK_LIST = Object.values(CARD_BACKS);