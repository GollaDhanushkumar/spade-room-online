'use client';

import PlayingCard from './PlayingCard';
import Avatar from './Avatar';
import { TEAM_COLORS } from '@/lib/game-logic';

/**
 * Shows each player and the face-up cards they've captured (won)
 * in the current round, grouped by trick.
 *
 * Resets when round changes (parent only shows this for current round's trick_history).
 *
 * Props:
 *   onClose
 *   seatedPlayers — array of seats sorted by seat_index
 *   trickHistory — round.trick_history (array of { cards, winner_player_id, winner_seat_index })
 *   mePlayerId — to position "you" at the bottom of the circle
 *   roundNum — for the modal title
 */
export default function TricksWonModal({ onClose, seatedPlayers, trickHistory, mePlayerId, roundNum }) {
  const N = seatedPlayers.length;
  const mySeat = seatedPlayers.find((s) => s.player_id === mePlayerId);
  const mySeatIdx = mySeat?.seat_index ?? 0;

  // Group tricks by winner_player_id
  const tricksByWinner = {};
  for (const trick of (trickHistory || [])) {
    const wid = trick.winner_player_id;
    if (!tricksByWinner[wid]) tricksByWinner[wid] = [];
    tricksByWinner[wid].push(trick.cards);
  }

  // Position seats in a circle, "me" at the bottom — pulled inward for breathing room
  const positionsByN = {
    2: [{ l: 50, t: 75 }, { l: 50, t: 25 }],
    3: [{ l: 50, t: 78 }, { l: 78, t: 35 }, { l: 22, t: 35 }],
    4: [{ l: 50, t: 78 }, { l: 78, t: 50 }, { l: 50, t: 22 }, { l: 22, t: 50 }],
    5: [{ l: 50, t: 78 }, { l: 80, t: 58 }, { l: 70, t: 25 }, { l: 30, t: 25 }, { l: 20, t: 58 }],
    6: [{ l: 50, t: 80 }, { l: 80, t: 60 }, { l: 75, t: 28 }, { l: 50, t: 22 }, { l: 25, t: 28 }, { l: 20, t: 60 }],
    7: [{ l: 50, t: 82 }, { l: 80, t: 62 }, { l: 78, t: 32 }, { l: 60, t: 22 }, { l: 40, t: 22 }, { l: 22, t: 32 }, { l: 20, t: 62 }],
    8: [{ l: 50, t: 82 }, { l: 78, t: 66 }, { l: 82, t: 42 }, { l: 68, t: 22 }, { l: 50, t: 18 }, { l: 32, t: 22 }, { l: 18, t: 42 }, { l: 22, t: 66 }],
  };
  const positions = positionsByN[N] ?? positionsByN[4];

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-[#0f1d18] border border-emerald-900 rounded-2xl w-full max-w-md max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-900/50">
          <div>
            <h2 className="text-lg font-serif italic text-amber-200">Tricks Won</h2>
            <p className="text-[10px] text-emerald-200/40 uppercase tracking-wider">
              Round {roundNum} · {trickHistory?.length ?? 0} {trickHistory?.length === 1 ? 'trick' : 'tricks'} played
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200/60 hover:text-emerald-100 transition text-2xl leading-none w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-950/40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {(!trickHistory || trickHistory.length === 0) ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🃏</p>
              <p className="text-emerald-200/60 text-sm">No tricks yet this round</p>
              <p className="text-emerald-200/40 text-xs mt-1">Captured cards will appear here as tricks are won.</p>
            </div>
          ) : (
            <div className="relative w-full" style={{ minHeight: 380, aspectRatio: '1 / 1', maxWidth: 420, margin: '0 auto', padding: '20px 30px' }}>
              {/* Felt circle */}
              <div className="absolute"
                style={{
                  left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                  width: '38%', aspectRatio: '1',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 50% 45%, var(--theme-felt-from, #1f5e44) 0%, var(--theme-felt-mid, #0f3d2c) 60%, var(--theme-felt-to, #0a2519) 100%)',
                  border: '1px solid rgba(212, 182, 117, 0.35)',
                  boxShadow: 'inset 0 0 24px rgba(0,0,0,0.5)',
                }}
              />

              {/* Center label */}
              <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <p className="text-amber-200/70 font-serif italic text-base">Round {roundNum}</p>
                <p className="text-emerald-200/40 text-[10px] uppercase tracking-widest mt-1">cards captured</p>
              </div>

              {/* Each player around the circle */}
              {seatedPlayers.map((seat) => {
                const relativeIdx = (seat.seat_index - mySeatIdx + N) % N;
                const pos = positions[relativeIdx];
                if (!pos) return null;
                const isMe = seat.player_id === mePlayerId;
                const myTricks = tricksByWinner[seat.player_id] || [];
                const teamColor = seat.team_palette_idx != null ? TEAM_COLORS[seat.team_palette_idx] : null;

                return (
                  <div
                    key={seat.player_id}
                    className="absolute"
                    style={{
                      left: `${pos.l}%`,
                      top: `${pos.t}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <PlayerCapturedPile
                      seat={seat}
                      isMe={isMe}
                      tricks={myTricks}
                      teamColor={teamColor}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-2 border-t border-emerald-900/40 text-center">
          <p className="text-[10px] text-emerald-200/40 uppercase tracking-widest">
            Resets when Round {roundNum} ends
          </p>
        </div>
      </div>
    </div>
  );
}

function PlayerCapturedPile({ seat, isMe, tricks, teamColor }) {
  const totalTricks = tricks.length;
  const totalCards = tricks.reduce((sum, t) => sum + (t?.length ?? 0), 0);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Cards captured — horizontal fan grouped by trick */}
      <div className="flex items-end gap-1.5 flex-wrap justify-center" style={{ maxWidth: 180 }}>
        {tricks.length === 0 ? (
          <div className="text-[10px] text-emerald-200/30 italic px-2 py-1">No tricks won</div>
        ) : (
          tricks.map((trickCards, trickIdx) => (
            <div key={trickIdx} className="relative" style={{
              width: Math.max(20, 20 + ((trickCards?.length ?? 0) - 1) * 7),
              height: 36,
            }}>
              {(trickCards || []).map((entry, cardIdx) => {
                // Each entry might be { player_id, seat_index, card } or just a card object
                const card = entry?.card ?? entry;
                return (
                  <div
                    key={cardIdx}
                    className="absolute"
                    style={{
                      left: cardIdx * 7,
                      top: 0,
                      transform: `rotate(${(cardIdx - ((trickCards.length - 1) / 2)) * 3}deg)`,
                      transformOrigin: 'bottom center',
                      zIndex: cardIdx,
                    }}
                  >
                    <PlayingCard card={card} size="xs" />
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Player tag */}
      <div className="flex items-center gap-1.5 mt-1">
        <Avatar avatarId={seat.avatar_id} playerName={seat.name} size="xs" borderColor={teamColor} />
        <div
          className="px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap shadow"
          style={{
            background: totalTricks > 0 ? 'rgba(245, 217, 137, 0.92)' : 'rgba(7, 16, 12, 0.85)',
            color: totalTricks > 0 ? '#07100c' : '#ecfdf5',
            border: teamColor ? `1.5px solid ${teamColor}` : '1px solid rgba(34, 78, 60, 0.6)',
            maxWidth: 90,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {seat.name?.length > 8 ? seat.name.slice(0, 7) + '…' : seat.name}
          {isMe && <span className="opacity-50 text-[9px] ml-1">(you)</span>}
        </div>
      </div>

      {/* Trick count */}
      <p className="text-[9px] text-emerald-200/50 mt-0.5">
        {totalTricks} {totalTricks === 1 ? 'trick' : 'tricks'} · {totalCards} {totalCards === 1 ? 'card' : 'cards'}
      </p>
    </div>
  );
}