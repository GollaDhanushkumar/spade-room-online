'use client';
import PlayingCard from './PlayingCard';
import Avatar from './Avatar';
import { TEAM_COLORS } from '@/lib/game-logic';

/**
 * Circular felt table with players seated around the edge.
 * Each seat shows: a small numbered badge, the player's drawn card(s),
 * a name pill, and (for seat 0) a "LEADS" tag.
 *
 * All cards in a player's chain are shown inline: original first, tie-breaker(s) after.
 */export default function CircularTable({ seats, mode, hostId, mePlayerId, dealerSeatIdx = 0 }) {
  const ordered = [...seats].sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0));
  const N = ordered.length;
  if (N === 0) return null;

  // Layout constants (viewBox is 100×100 percent)
  const cx = 50;
  const cy = 50;
  const feltR = 28;
  const seatR = 40;

  // Team partner lines through center
  const teamLines = [];
  if (mode === 'team' && N % 2 === 0) {
    const half = N / 2;
    for (let i = 0; i < half; i++) {
      const a = ordered[i];
      const aAngle = (i / N) * 2 * Math.PI - Math.PI / 2;
      const bAngle = ((i + half) / N) * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + feltR * 0.75 * Math.cos(aAngle);
      const y1 = cy + feltR * 0.75 * Math.sin(aAngle);
      const x2 = cx + feltR * 0.75 * Math.cos(bAngle);
      const y2 = cy + feltR * 0.75 * Math.sin(bAngle);
      const color = TEAM_COLORS[a.team_palette_idx ?? i];
      teamLines.push({ x1, y1, x2, y2, color, key: a.team_id });
    }
  }

  function truncate(name, n = 10) {
    if (!name) return '';
    return name.length > n ? name.slice(0, n - 1) + '…' : name;
  }

  return (
    <div className="relative w-full aspect-square max-w-[420px] mx-auto">
      {/* The felt + ring SVG (background layer) */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <radialGradient id="feltGrad" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#1f5e44" />
            <stop offset="55%" stopColor="#0f3d2c" />
            <stop offset="100%" stopColor="#0a2519" />
          </radialGradient>
          <radialGradient id="feltGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(212,182,117,0.12)" />
            <stop offset="100%" stopColor="rgba(212,182,117,0)" />
          </radialGradient>
        </defs>

        {/* Outer thin gold ring */}
        <circle
          cx={cx}
          cy={cy}
          r={feltR + 1.5}
          fill="none"
          stroke="rgba(212,182,117,0.25)"
          strokeWidth="0.3"
        />
        {/* Main felt */}
        <circle
          cx={cx}
          cy={cy}
          r={feltR}
          fill="url(#feltGrad)"
          stroke="rgba(212,182,117,0.4)"
          strokeWidth="0.35"
        />
        {/* Soft glow */}
        <circle cx={cx} cy={cy} r={feltR} fill="url(#feltGlow)" />
        {/* Inner detail ring */}
        <circle
          cx={cx}
          cy={cy}
          r={feltR - 3}
          fill="none"
          stroke="rgba(212,182,117,0.12)"
          strokeWidth="0.2"
        />

        {/* Team partner lines through the center */}
        {teamLines.map((l) => (
          <line
            key={l.key}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.color}
            strokeWidth="0.35"
            strokeDasharray="1.4 1.4"
            opacity="0.55"
          />
        ))}

        {/* Center spade monogram */}
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(212,182,117,0.15)"
          fontFamily="Fraunces, serif"
        >
          ♠
        </text>
      </svg>

      {/* Seat markers */}
      {ordered.map((seat, i) => {
        const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
        const x = cx + seatR * Math.cos(angle);
        const y = cy + seatR * Math.sin(angle);
        const isMe = seat.player_id === mePlayerId;
        const isDealer = seat.seat_index === dealerSeatIdx;
        const cards = seat.cards || [];

        const teamColor =
          seat.team_palette_idx != null ? TEAM_COLORS[seat.team_palette_idx] : null;

        return (
          <div
            key={seat.player_id}
            className="absolute flex flex-col items-center gap-1"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              animation: `seatPop 0.5s ease ${i * 0.07}s both`,
              zIndex: 2,
            }}
          >
            {/* Seat number badge */}
            <div
              className="absolute w-5 h-5 rounded-full bg-[#07100c] text-amber-200 text-[10px] flex items-center justify-center"
              style={{
                top: -10,
                left: -15,
                border: '1px solid rgba(212,182,117,0.6)',
                fontFamily: 'Fraunces, serif',
                fontStyle: 'italic',
                fontWeight: 600,
                zIndex: 5,
              }}
            >
              {(seat.seat_index ?? 0) + 1}
            </div>

            {/* All cards in chain visible: original first, tie-breaker(s) after */}
           {/* Avatar above cards */}
            <Avatar
              avatarId={seat.avatar_id}
              playerName={seat.name}
              size="sm"
              borderColor={teamColor}
            />

            {/* All cards in chain visible: original first, tie-breaker(s) after */}
            <div className="flex items-center gap-0.5">
              {cards.map((c, idx) => (
                <div key={idx} className="flex items-center gap-0.5">
                  {idx > 0 && (
                    <span className="text-amber-300/70 text-[9px] font-bold">+</span>
                  )}
                  <PlayingCard card={c} size="sm" />
                </div>
              ))}
            </div>

            {/* Name pill */}
            <div
              className="px-2 py-0.5 rounded-md text-[11px] font-medium text-emerald-50 whitespace-nowrap shadow-md"
              style={{
                background: 'rgba(7, 16, 12, 0.92)',
                border: teamColor
                  ? `1.5px solid ${teamColor}`
                  : '1px solid rgba(34, 78, 60, 0.6)',
                maxWidth: 90,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {truncate(seat.name)}
              {isMe && <span className="opacity-50 text-[9px] ml-1">(you)</span>}
            </div>

            {/* Dealer / leader badge */}
            {isDealer && (
              <div
                className="text-[8px] tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: '#07100c',
                  background: 'linear-gradient(180deg, #f5d989, #d4b675)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                LEADS
              </div>
            )}
          </div>
        );
      })}

      <style jsx>{`
        @keyframes seatPop {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.6);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </div>
  );
}