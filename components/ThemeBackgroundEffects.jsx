'use client';

import { getTheme } from '@/lib/themes';

const HAPPY_EMOJIS = ['😀', '😄', '😁', '😆', '😊', '😍', '😎', '🥳', '😉', '😂'];
const SPOOKY_EMOJIS = ['👻', '💀', '🎃', '🕷️', '🕸️', '😈', '🦇', '🍬', '🍭', '👽'];

function makeItems(count, mapper) {
  return Array.from({ length: count }, (_, i) => mapper(i));
}

export default function ThemeBackgroundEffects({ room }) {
  const theme = getTheme(room?.theme);
  const effect = theme.effect || 'none';

  if (effect === 'none') return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {effect === 'emoji-happy' && <EmojiFall type="happy" />}
        {effect === 'emoji-spooky' && <EmojiFall type="spooky" />}
        {effect === 'galaxy-premium' && <GalaxyPremium />}
        {effect === 'petal-fall' && <PetalFall />}
        {effect === 'snow-fall' && <SnowFall />}
        {effect === 'toxic-bubbles' && <ToxicBubbles />}
      </div>

      <style jsx global>{`
        @keyframes themeEmojiFall {
          0% {
            transform: translate3d(0, -14vh, 0) rotate(0deg) scale(0.9);
            opacity: 0;
          }
          10% {
            opacity: 0.82;
          }
          50% {
            transform: translate3d(calc(var(--drift) * 0.45), 45vh, 0) rotate(140deg) scale(1);
          }
          100% {
            transform: translate3d(var(--drift), 114vh, 0) rotate(340deg) scale(1.05);
            opacity: 0;
          }
        }

        @keyframes themePetalFall {
          0% {
            transform: translate3d(0, -12vh, 0) rotate(0deg);
            opacity: 0;
          }
          12% {
            opacity: 0.7;
          }
          35% {
            transform: translate3d(16px, 30vh, 0) rotate(90deg);
          }
          70% {
            transform: translate3d(-18px, 70vh, 0) rotate(220deg);
          }
          100% {
            transform: translate3d(14px, 114vh, 0) rotate(340deg);
            opacity: 0;
          }
        }

        @keyframes themeSnowFall {
          0% {
            transform: translate3d(0, -12vh, 0) scale(0.8);
            opacity: 0;
          }
          15% {
            opacity: 0.82;
          }
          50% {
            transform: translate3d(10px, 48vh, 0) scale(1);
          }
          100% {
            transform: translate3d(-10px, 114vh, 0) scale(0.9);
            opacity: 0;
          }
        }

        @keyframes themeBubbleRise {
          0% {
            transform: translate3d(0, 12vh, 0) scale(0.65);
            opacity: 0;
          }
          15% {
            opacity: 0.65;
          }
          60% {
            transform: translate3d(18px, -60vh, 0) scale(1);
          }
          100% {
            transform: translate3d(-12px, -116vh, 0) scale(1.2);
            opacity: 0;
          }
        }

        @keyframes themeTwinkle {
          0%, 100% {
            opacity: 0.2;
            transform: scale(0.75);
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
          }
        }

        @keyframes themeNebulaPulse {
          0%, 100% {
            opacity: 0.75;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.04);
          }
        }

        @keyframes themeNebulaDrift {
          0% {
            transform: translate3d(-1.5%, -1%, 0) scale(1);
          }
          50% {
            transform: translate3d(1.5%, 1%, 0) scale(1.04);
          }
          100% {
            transform: translate3d(-1.5%, -1%, 0) scale(1);
          }
        }

        @keyframes themeMeteor {
          0% {
            transform: translate3d(0, 0, 0) rotate(-35deg);
            opacity: 0;
          }
          12% {
            opacity: 0.8;
          }
          100% {
            transform: translate3d(-160px, 160px, 0) rotate(-35deg);
            opacity: 0;
          }
        }

        @keyframes themeToxicPulse {
          0%, 100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 0.75;
            transform: scale(1.05);
          }
        }
      `}</style>
    </>
  );
}

function EmojiFall({ type }) {
  const source = type === 'spooky' ? SPOOKY_EMOJIS : HAPPY_EMOJIS;

  return (
    <>
      {makeItems(24, (i) => {
        const emoji = source[i % source.length];
        const left = (i * 83) % 100;
        const duration = 10 + (i % 7);
        const delay = (i % 9) * 0.75;
        const size = 16 + (i % 5) * 5;
        const drift = -36 + (i % 9) * 9;

        return (
          <span
            key={`${type}-emoji-${i}`}
            className="absolute select-none"
            style={{
              left: `${left}%`,
              top: '-14vh',
              fontSize: `${size}px`,
              opacity: 0.5,
              animation: `themeEmojiFall ${duration}s linear ${delay}s infinite`,
              filter: 'drop-shadow(0 0 12px rgba(255,216,77,0.35))',
              '--drift': `${drift}px`,
            }}
          >
            {emoji}
          </span>
        );
      })}
    </>
  );
}

function GalaxyPremium() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 18% 24%, rgba(90, 120, 255, 0.22), transparent 26%), radial-gradient(circle at 82% 20%, rgba(180, 90, 255, 0.18), transparent 28%), radial-gradient(circle at 60% 78%, rgba(90, 220, 255, 0.14), transparent 30%), radial-gradient(circle at 35% 70%, rgba(255, 209, 102, 0.08), transparent 22%)',
          animation: 'themeNebulaPulse 8s ease-in-out infinite, themeNebulaDrift 18s ease-in-out infinite',
        }}
      />

      {makeItems(58, (i) => {
        const left = (i * 67) % 100;
        const top = (i * 53) % 100;
        const size = i % 5 === 0 ? 3 : i % 3 === 0 ? 2.5 : 1.8;
        const duration = 2.4 + (i % 6) * 0.55;
        const delay = (i % 12) * 0.28;

        return (
          <span
            key={`galaxy-star-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: 'rgba(255,255,255,0.92)',
              boxShadow: '0 0 9px rgba(138,180,255,0.8)',
              animation: `themeTwinkle ${duration}s ease-in-out ${delay}s infinite`,
            }}
          />
        );
      })}

      {makeItems(5, (i) => {
        const left = 25 + i * 16;
        const top = 8 + (i % 3) * 14;
        const delay = i * 2.6;

        return (
          <span
            key={`meteor-${i}`}
            className="absolute"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: 54,
              height: 2,
              borderRadius: 999,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.95), rgba(138,180,255,0.55), transparent)',
              boxShadow: '0 0 12px rgba(138,180,255,0.75)',
              animation: `themeMeteor 7s ease-in-out ${delay}s infinite`,
            }}
          />
        );
      })}
    </>
  );
}

function PetalFall() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(255, 199, 222, 0.10), transparent 24%), radial-gradient(circle at 80% 70%, rgba(255, 170, 210, 0.08), transparent 25%)',
        }}
      />

      {makeItems(28, (i) => {
        const left = (i * 79) % 100;
        const duration = 10 + (i % 7);
        const delay = (i % 10) * 0.7;
        const size = 12 + (i % 5) * 3;

        return (
          <span
            key={`petal-${i}`}
            className="absolute select-none"
            style={{
              left: `${left}%`,
              top: '-12vh',
              fontSize: `${size}px`,
              opacity: 0.68,
              animation: `themePetalFall ${duration}s linear ${delay}s infinite`,
              filter: 'drop-shadow(0 0 8px rgba(255,199,222,0.20))',
            }}
          >
            🌸
          </span>
        );
      })}
    </>
  );
}

function SnowFall() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 18%, rgba(223, 246, 255, 0.10), transparent 24%), radial-gradient(circle at 80% 74%, rgba(143, 211, 255, 0.10), transparent 26%)',
        }}
      />

      {makeItems(34, (i) => {
        const left = (i * 73) % 100;
        const duration = 8 + (i % 8);
        const delay = (i % 12) * 0.5;
        const size = 9 + (i % 5) * 3;

        return (
          <span
            key={`snow-${i}`}
            className="absolute select-none"
            style={{
              left: `${left}%`,
              top: '-12vh',
              fontSize: `${size}px`,
              opacity: 0.78,
              animation: `themeSnowFall ${duration}s linear ${delay}s infinite`,
              filter: 'drop-shadow(0 0 8px rgba(223,246,255,0.25))',
            }}
          >
            ❄️
          </span>
        );
      })}
    </>
  );
}

function ToxicBubbles() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 80%, rgba(183, 255, 74, 0.10), transparent 25%), radial-gradient(circle at 82% 24%, rgba(80, 255, 80, 0.08), transparent 24%)',
          animation: 'themeToxicPulse 6s ease-in-out infinite',
        }}
      />

      {makeItems(26, (i) => {
        const left = (i * 61) % 100;
        const duration = 8 + (i % 7);
        const delay = (i % 10) * 0.55;
        const size = 12 + (i % 6) * 6;
        const opacity = 0.28 + (i % 4) * 0.08;

        return (
          <span
            key={`toxic-bubble-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              bottom: '-12vh',
              width: `${size}px`,
              height: `${size}px`,
              opacity,
              background:
                'radial-gradient(circle at 30% 30%, rgba(220,255,145,0.95), rgba(120,220,45,0.42), rgba(0,0,0,0.02))',
              border: '1px solid rgba(183,255,74,0.26)',
              boxShadow: '0 0 14px rgba(183,255,74,0.35)',
              animation: `themeBubbleRise ${duration}s linear ${delay}s infinite`,
            }}
          />
        );
      })}
    </>
  );
}