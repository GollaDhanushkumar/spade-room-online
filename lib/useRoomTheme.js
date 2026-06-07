'use client';

import { useEffect } from 'react';
import { getTheme, getCardBack } from './themes';

/**
 * Applies the room's theme to the document root as CSS variables.
 * Listens to changes via the `room` prop passed in.
 */
export function useRoomTheme(room) {
  useEffect(() => {
    const theme = getTheme(room?.theme);
    const cardBack = getCardBack(room?.card_back);
    const animations = !!room?.animations_enabled;

    const root = document.documentElement;
    // Theme variables
    root.style.setProperty('--theme-bg-from', theme.bgFrom);
    root.style.setProperty('--theme-bg-to', theme.bgTo);
    root.style.setProperty('--theme-felt-from', theme.felt.from);
    root.style.setProperty('--theme-felt-mid', theme.felt.mid);
    root.style.setProperty('--theme-felt-to', theme.felt.to);
    root.style.setProperty('--theme-accent', theme.accent);
    root.style.setProperty('--theme-panel-bg', theme.panelBg);
    root.style.setProperty('--theme-panel-bg2', theme.panelBg2);
    root.style.setProperty('--theme-line', theme.line);
    root.style.setProperty('--theme-text', theme.text);

    // Card back variables — set the actual CSS background-image based on pattern
    const p = cardBack.primary;
    const s = cardBack.secondary;
    const a = cardBack.accent || p;
    let bgImage = '';
    let bgSize = 'auto';

    if (cardBack.pattern === 'diagonal') {
      bgImage = `repeating-linear-gradient(45deg, ${p} 0 4px, ${s} 4px 8px)`;
    } else if (cardBack.pattern === 'geometric') {
      bgImage = `repeating-linear-gradient(45deg, ${p} 0 6px, ${s} 6px 10px), radial-gradient(circle at 50% 50%, ${a}33 0%, transparent 60%)`;
    } else if (cardBack.pattern === 'floral') {
      bgImage = `radial-gradient(circle at 25% 25%, ${a}55 2px, transparent 4px), radial-gradient(circle at 75% 75%, ${a}55 2px, transparent 4px), radial-gradient(circle at 50% 50%, ${a}33 1.5px, transparent 3px), linear-gradient(135deg, ${p}, ${s})`;
      bgSize = '14px 14px, 14px 14px, 10px 10px, 100% 100%';
    } else if (cardBack.pattern === 'stars') {
      bgImage = `radial-gradient(circle at 20% 20%, ${a} 0.5px, transparent 1.5px), radial-gradient(circle at 70% 50%, ${a} 0.6px, transparent 1.8px), radial-gradient(circle at 40% 80%, ${a} 0.4px, transparent 1.4px), radial-gradient(circle at 85% 25%, ${a} 0.5px, transparent 1.5px), linear-gradient(135deg, ${p}, ${s})`;
      bgSize = '20px 20px, 16px 16px, 24px 24px, 18px 18px, 100% 100%';
    } else if (cardBack.pattern === 'solid') {
      bgImage = `linear-gradient(180deg, ${p}, ${s})`;
    } else {
      bgImage = `linear-gradient(180deg, ${p}, ${s})`;
    }

    root.style.setProperty('--cardback-primary', p);
    root.style.setProperty('--cardback-secondary', s);
    root.style.setProperty('--cardback-accent', a);
    root.style.setProperty('--cardback-image', bgImage);
    root.style.setProperty('--cardback-size', bgSize);
    root.style.setProperty('--cardback-border',
      cardBack.id === 'floral' || cardBack.id === 'minimal'
        ? 'rgba(0, 0, 0, 0.25)'
        : 'rgba(212, 182, 117, 0.3)'
    );

    // Animation flag
    root.style.setProperty('--theme-animation', animations ? theme.animation : 'none');
    root.dataset.themeId = theme.id;
    root.dataset.animationsEnabled = animations ? 'on' : 'off';
  }, [room?.theme, room?.card_back, room?.animations_enabled]);
}