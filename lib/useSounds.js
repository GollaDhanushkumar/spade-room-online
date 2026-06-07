'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const SOUND_FILES = {
  cardPlay: '/sounds/card-play.mp3',
  matchWin: '/sounds/match-win.mp3',
};

const STORAGE_KEY = 'spade-sound-enabled';

export function useSounds() {
  const [enabled, setEnabled] = useState(false);
  const audioRefs = useRef({});

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setEnabled(true);
  }, []);

  useEffect(() => {
    Object.entries(SOUND_FILES).forEach(([key, path]) => {
      if (!audioRefs.current[key]) {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = 0.5;
        audioRefs.current[key] = audio;
      }
    });
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const play = useCallback((soundName) => {
    if (!enabled) return;
    const audio = audioRefs.current[soundName];
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (e) {}
  }, [enabled]);

  return { enabled, toggle, play };
}