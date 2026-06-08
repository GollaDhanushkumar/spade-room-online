'use client';

import { useEffect, useState } from 'react';

/**
 * Animated splash screen — designed to feel continuous from the OS splash
 * on phones. Logo starts at full size (same as OS), then glow + gentle zoom
 * + text fade-in, finally fades out to the welcome screen.
 *
 * Total: ~3.5 seconds.
 */
export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('appear'); // 'appear' | 'pulse' | 'fadeOut' | 'done'

  useEffect(() => {
    // appear (logo lands + glow) — 0.6s
    // pulse (gentle breathing glow + text shown) — 2.4s
    // fadeOut — 0.5s
    const t1 = setTimeout(() => setPhase('pulse'), 600);
    const t2 = setTimeout(() => setPhase('fadeOut'), 3000);
    const t3 = setTimeout(() => {
      setPhase('done');
      onDone?.();
    }, 3500);

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
        transition: 'opacity 0.5s ease-out',
        pointerEvents: phase === 'fadeOut' ? 'none' : 'auto',
      }}
    >
      <div className="flex flex-col items-center">
        <div
          style={{
            animation: phase === 'appear'
              ? 'splashAppear 0.6s ease-out forwards'
              : phase === 'pulse'
                ? 'splashPulse 2.4s ease-in-out forwards'
                : undefined,
          }}
        >
          {/* The spade logo — same as your PWA icon */}
          <svg width="180" height="180" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
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
        </div>

        <p
          className="text-center mt-5 font-serif italic text-amber-200 tracking-wide"
          style={{
            fontSize: '1.75rem',
            opacity: phase === 'appear' ? 0 : 1,
            transform: phase === 'appear' ? 'translateY(8px)' : 'translateY(0)',
            transition: 'opacity 0.7s ease-out 0.4s, transform 0.7s ease-out 0.4s',
          }}
        >
          Spades Game
        </p>

        <p
          className="text-center mt-2 text-emerald-200/50 text-xs uppercase tracking-widest"
          style={{
            opacity: phase === 'appear' ? 0 : 1,
            transition: 'opacity 0.8s ease-out 0.9s',
          }}
        >
          Play with your friends
        </p>
      </div>

      <style jsx>{`
        @keyframes splashAppear {
          0% {
            filter: drop-shadow(0 0 0 rgba(245, 217, 137, 0));
          }
          50% {
            filter: drop-shadow(0 0 40px rgba(245, 217, 137, 0.9));
            transform: scale(1.04);
          }
          100% {
            filter: drop-shadow(0 0 25px rgba(245, 217, 137, 0.6));
            transform: scale(1);
          }
        }
        @keyframes splashPulse {
          0%, 100% {
            filter: drop-shadow(0 0 25px rgba(245, 217, 137, 0.5));
            transform: scale(1);
          }
          25% {
            filter: drop-shadow(0 0 38px rgba(245, 217, 137, 0.8));
            transform: scale(1.03);
          }
          50% {
            filter: drop-shadow(0 0 28px rgba(245, 217, 137, 0.55));
            transform: scale(1);
          }
          75% {
            filter: drop-shadow(0 0 35px rgba(245, 217, 137, 0.75));
            transform: scale(1.02);
          }
        }
      `}</style>
    </div>
  );
}