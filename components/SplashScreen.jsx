'use client';

import { useEffect, useState } from 'react';

/**
 * Animated splash screen shown when the home page first loads.
 * Zooms in the spade logo with a gold glow pulse, then fades out.
 * Total duration: ~1.2 seconds + 0.3s fade = ~1.5 seconds.
 */
export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('intro'); // 'intro' | 'hold' | 'fadeOut' | 'done'

  useEffect(() => {
    // intro animation runs for 0.6s, then hold for 0.5s, then fade out 0.3s
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('fadeOut'), 1100);
    const t3 = setTimeout(() => {
      setPhase('done');
      onDone?.();
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'linear-gradient(to bottom, #0a1410, #0f3d2c)',
        opacity: phase === 'fadeOut' ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        pointerEvents: phase === 'fadeOut' ? 'none' : 'auto',
      }}
    >
      <div
        className="relative"
        style={{
          animation: phase === 'intro'
            ? 'splashZoomIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            : phase === 'hold'
              ? 'splashGlow 1s ease-in-out infinite'
              : undefined,
        }}
      >
        {/* The spade logo — uses your PWA icon SVG */}
        <svg width="160" height="160" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="splashBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a01818" />
              <stop offset="100%" stopColor="#6e1010" />
            </linearGradient>
            <linearGradient id="splashBorder" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f5d989" />
              <stop offset="50%" stopColor="#d4b675" />
              <stop offset="100%" stopColor="#8e7340" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="192" height="192" rx="42" fill="url(#splashBg)" />
          <rect x="3" y="3" width="186" height="186" rx="39" fill="none" stroke="url(#splashBorder)" strokeWidth="6" />
          <g transform="translate(96, 96)" fill="#ffffff">
            <path d="M 0,-50
                     C -10,-32  -30,-18  -42,-2
                     C -52,12  -52,28  -38,36
                     C -28,42  -16,38  -8,28
                     C -10,38  -14,46  -22,52
                     L 22,52
                     C 14,46  10,38  8,28
                     C 16,38  28,42  38,36
                     C 52,28  52,12  42,-2
                     C 30,-18  10,-32  0,-50 Z" />
          </g>
        </svg>

        {/* App name beneath the logo */}
        <p
          className="text-center mt-4 font-serif italic text-amber-200 text-2xl tracking-wide"
          style={{
            opacity: phase === 'intro' ? 0 : 1,
            transition: 'opacity 0.4s ease-out 0.2s',
          }}
        >
          Spades Game
        </p>
      </div>

      <style jsx>{`
        @keyframes splashZoomIn {
          0% {
            transform: scale(0.5) rotate(-8deg);
            opacity: 0;
            filter: drop-shadow(0 0 0 rgba(245, 217, 137, 0));
          }
          60% {
            transform: scale(1.08) rotate(2deg);
            opacity: 1;
            filter: drop-shadow(0 0 30px rgba(245, 217, 137, 0.7));
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
            filter: drop-shadow(0 0 20px rgba(245, 217, 137, 0.5));
          }
        }
        @keyframes splashGlow {
          0%, 100% {
            filter: drop-shadow(0 0 20px rgba(245, 217, 137, 0.5));
          }
          50% {
            filter: drop-shadow(0 0 35px rgba(245, 217, 137, 0.85));
          }
        }
      `}</style>
    </div>
  );
}