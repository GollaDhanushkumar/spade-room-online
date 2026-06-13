'use client';

import { useEffect, useState } from 'react';

/**
 * Hidden easter egg — fires when player "Dhanush" (by name or specific avatar)
 * wins a match. Shows a custom image with shake + breathing animation.
 *
 * Plays for ~3 seconds then auto-dismisses.
 *
 * Props:
 *   onDone: () => void
 */
export default function VictoryEgg({ onDone }) {
  const [phase, setPhase] = useState('appear'); // 'appear' | 'hold' | 'fadeOut' | 'done'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 500);
    const t2 = setTimeout(() => setPhase('fadeOut'), 2500);
    const t3 = setTimeout(() => {
      setPhase('done');
      onDone?.();
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none"
      style={{
        opacity: phase === 'fadeOut' ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      {/* Backdrop glow */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(245, 217, 137, 0.25) 0%, rgba(0,0,0,0.75) 70%)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Light rays sweeping behind */}
      <div
        className="absolute"
        style={{
          width: '150vmax',
          height: '150vmax',
          background: `repeating-conic-gradient(from 0deg at 50% 50%,
            rgba(245, 217, 137, 0.15) 0deg,
            rgba(245, 217, 137, 0) 6deg,
            rgba(245, 217, 137, 0) 12deg,
            rgba(245, 217, 137, 0.15) 18deg)`,
          animation: 'eggRayspin 6s linear infinite',
          opacity: phase === 'appear' ? 0 : 0.6,
          transition: 'opacity 0.6s ease-out',
        }}
      />

      {/* Main image card */}
      <div
        className="relative"
        style={{
          animation: phase === 'appear'
            ? 'eggShakeIn 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both'
            : phase === 'hold'
              ? 'eggBreathing 2s ease-in-out infinite'
              : undefined,
          maxWidth: 'min(90vw, 500px)',
        }}
      >
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{
            border: '4px solid #f5d989',
            boxShadow: `
              0 0 60px rgba(245, 217, 137, 0.7),
              0 0 120px rgba(245, 217, 137, 0.4),
              0 0 200px rgba(245, 217, 137, 0.2)
            `,
            background: '#0f1d18',
          }}
        >
          <img
            src="/avatars/friends/dhanush-victory.png"
            alt="Victory!"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />

          {/* Sparkles around the image */}
          <span style={{ position: 'absolute', top: '-15px', left: '8%', fontSize: '30px', animation: 'eggSparkle 1.5s ease-in-out infinite', textShadow: '0 0 20px gold' }}>✨</span>
          <span style={{ position: 'absolute', top: '15%', right: '-15px', fontSize: '26px', animation: 'eggSparkle 1.5s ease-in-out infinite 0.3s', textShadow: '0 0 20px gold' }}>⭐</span>
          <span style={{ position: 'absolute', bottom: '20%', left: '-15px', fontSize: '28px', animation: 'eggSparkle 1.5s ease-in-out infinite 0.6s', textShadow: '0 0 20px gold' }}>✨</span>
          <span style={{ position: 'absolute', bottom: '-15px', right: '10%', fontSize: '30px', animation: 'eggSparkle 1.5s ease-in-out infinite 0.9s', textShadow: '0 0 20px gold' }}>⭐</span>
          <span style={{ position: 'absolute', top: '40%', left: '-20px', fontSize: '22px', animation: 'eggSparkle 1.5s ease-in-out infinite 1.2s', textShadow: '0 0 20px gold' }}>💫</span>
          <span style={{ position: 'absolute', top: '60%', right: '-18px', fontSize: '24px', animation: 'eggSparkle 1.5s ease-in-out infinite 1.5s', textShadow: '0 0 20px gold' }}>💫</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes eggShakeIn {
          0% {
            transform: scale(0.3) rotate(-15deg);
            opacity: 0;
          }
          30% {
            transform: scale(1.15) rotate(4deg);
            opacity: 1;
          }
          50% {
            transform: scale(0.95) rotate(-3deg);
          }
          70% {
            transform: scale(1.05) rotate(2deg);
          }
          85% {
            transform: scale(0.98) rotate(-1deg);
          }
          100% {
            transform: scale(1) rotate(0);
            opacity: 1;
          }
        }
        @keyframes eggBreathing {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.025);
          }
        }
        @keyframes eggSparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0); }
          50%      { opacity: 1; transform: scale(1.3) rotate(180deg); }
        }
        @keyframes eggRayspin {
          0%   { transform: rotate(0); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}