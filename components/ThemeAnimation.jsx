'use client';

import { useEffect, useState } from 'react';
import { getTheme } from '@/lib/themes';

export default function ThemeAnimation({ room }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !room?.animations_enabled) return null;

  const theme = getTheme(room?.theme);
  if (!theme.animation || theme.animation === 'none') return null;

  if (theme.animation === 'stars') return <StarsAnimation />;
  if (theme.animation === 'pulse') return <NeonPulseAnimation />;
  if (theme.animation === 'waves') return <OceanWavesAnimation />;
  return null;
}

function StarsAnimation() {
  const stars = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1 + Math.random() * 2,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 2,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {stars.map((s) => (
        <span
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: 'white',
            boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.6)`,
            animation: `starTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%      { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

function NeonPulseAnimation() {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 5,
        background:
          'radial-gradient(circle at 25% 30%, rgba(0, 255, 234, 0.18) 0%, transparent 50%), radial-gradient(circle at 75% 70%, rgba(212, 165, 245, 0.18) 0%, transparent 50%)',
        animation: 'neonPulseAnim 4s ease-in-out infinite',
      }}
    >
      <style jsx>{`
        @keyframes neonPulseAnim {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

function OceanWavesAnimation() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          background:
            'radial-gradient(ellipse 50% 30% at 30% 70%, rgba(126, 196, 245, 0.15) 0%, transparent 70%), radial-gradient(ellipse 40% 25% at 70% 30%, rgba(126, 196, 245, 0.12) 0%, transparent 70%)',
          animation: 'oceanDriftAnim 14s ease-in-out infinite alternate',
        }}
      />
      <style jsx>{`
        @keyframes oceanDriftAnim {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-30px, 20px) scale(1.05); }
          100% { transform: translate(20px, -15px) scale(0.98); }
        }
      `}</style>
    </div>
  );
}