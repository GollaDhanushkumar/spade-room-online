'use client';

import { cardRankLabel, suitSymbol, suitColor } from '@/lib/game-logic';

/**
 * Clean, simple playing card matching standard design:
 * - White background, rounded corners
 * - Rank + suit in top-left
 * - Single large suit symbol in center
 * - Rank + suit rotated 180° in bottom-right
 *
 * Face-down cards use CSS variables set by useRoomTheme (theme-aware card back).
 */
export default function PlayingCard({ card, size = 'md', faceDown = false, className = '' }) {
  const sizes = {
    sm: { w: 44, h: 62 },
    md: { w: 64, h: 90 },
    lg: { w: 88, h: 124 },
    xl: { w: 120, h: 170 },
  };
  const s = sizes[size] ?? sizes.md;

  // ── Face-down card back (theme-aware) ──
  if (faceDown || !card) {
    return (
      <div
        className={`relative rounded-lg select-none ${className}`}
        style={{
          width: s.w,
          height: s.h,
          backgroundImage: 'var(--cardback-image, linear-gradient(135deg, #1a3a2c 0%, #0f2820 100%))',
          backgroundColor: 'var(--cardback-primary, #1a3a2c)',
          backgroundSize: 'var(--cardback-size, auto)',
          border: '1.5px solid var(--cardback-border, rgba(212, 182, 117, 0.4))',
          boxShadow:
            '0 4px 10px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          className="absolute rounded"
          style={{
            inset: '6%',
            border: '1px solid var(--cardback-border, rgba(212, 182, 117, 0.3))',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  // ── Face-up card ──
  const color = suitColor(card.suit);
  const rank = cardRankLabel(card);
  const symbol = suitSymbol(card.suit);
  const inkColor = color === 'red' ? '#c41818' : '#1a1a1a';

  const rankSize = s.w * 0.22;
  const cornerSuitSize = s.w * 0.18;
  const centerSuitSize = s.w * 0.50;

  const CornerBlock = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        color: inkColor,
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
      }}
    >
      <span style={{ fontSize: rankSize, fontWeight: 700, letterSpacing: '-0.04em' }}>
        {rank}
      </span>
      <span style={{ fontSize: cornerSuitSize, marginTop: 1 }}>{symbol}</span>
    </div>
  );

  return (
    <div
      className={`relative rounded-lg select-none ${className}`}
      style={{
        width: s.w,
        height: s.h,
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        boxShadow:
          '0 3px 8px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        overflow: 'hidden',
      }}
    >
      <div className="absolute" style={{ top: s.w * 0.07, left: s.w * 0.09 }}>
        {CornerBlock}
      </div>

      <div
        className="absolute"
        style={{
          bottom: s.w * 0.07,
          right: s.w * 0.09,
          transform: 'rotate(180deg)',
        }}
      >
        {CornerBlock}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <span
          style={{
            fontSize: centerSuitSize,
            color: inkColor,
            lineHeight: 1,
            fontFamily: 'serif',
          }}
        >
          {symbol}
        </span>
      </div>
    </div>
  );
}