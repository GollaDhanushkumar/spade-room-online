'use client';

import { useState } from 'react';
import PlayingCard from './PlayingCard';
import Avatar from './Avatar';
import { TEAM_COLORS } from '@/lib/game-logic';

/**
 * Shows each player and the face-up cards they've captured (won)
 * in the current round, grouped by trick.
 */
export default function TricksWonModal({
  onClose,
  seatedPlayers,
  trickHistory,
  mePlayerId,
  roundNum,
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  const N = seatedPlayers.length;
  const mySeat = seatedPlayers.find((s) => s.player_id === mePlayerId);
  const mySeatIdx = mySeat?.seat_index ?? 0;

  const tricksByWinner = {};
  for (const trick of trickHistory || []) {
    const wid = trick.winner_player_id;
    if (!tricksByWinner[wid]) tricksByWinner[wid] = [];
    tricksByWinner[wid].push(trick.cards || []);
  }

  const positions = getCircularTrickPositions(N);

  const selectedSeat = seatedPlayers.find((s) => s.player_id === selectedPlayerId);
  const selectedTricks = selectedSeat ? tricksByWinner[selectedSeat.player_id] || [] : [];
  const shortLabels = buildShortNameLabels(seatedPlayers);

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
            <h2 className="text-lg font-serif italic text-amber-200">
              Tricks Won
            </h2>

            <p className="text-[10px] text-emerald-200/40 uppercase tracking-wider">
              Round {roundNum} · {trickHistory?.length ?? 0}{' '}
              {trickHistory?.length === 1 ? 'trick' : 'tricks'} played
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
          {!trickHistory || trickHistory.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🃏</p>
              <p className="text-emerald-200/60 text-sm">
                No tricks yet this round
              </p>
              <p className="text-emerald-200/40 text-xs mt-1">
                Captured cards will appear here as tricks are won.
              </p>
            </div>
          ) : (
            <>
              <div
                className="relative w-full"
                style={{
                  minHeight: N >= 10 ? 430 : 380,
                  aspectRatio: '1 / 1',
                  maxWidth: 430,
                  margin: '0 auto',
                }}
              >
                <div
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: N >= 10 ? '48%' : '42%',
                    aspectRatio: '1',
                    borderRadius: '50%',
                    background:
                      'radial-gradient(circle at 50% 45%, var(--theme-felt-from, #1f5e44) 0%, var(--theme-felt-mid, #0f3d2c) 60%, var(--theme-felt-to, #0a2519) 100%)',
                    border: '1px solid rgba(212, 182, 117, 0.35)',
                    boxShadow: 'inset 0 0 24px rgba(0,0,0,0.5)',
                  }}
                />

                <div
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}
                >
                  <p className="text-amber-200/70 font-serif italic text-base">
                    Round {roundNum}
                  </p>

                  <p className="text-emerald-200/40 text-[10px] uppercase tracking-widest mt-1">
                    tap player
                  </p>
                </div>

                {seatedPlayers.map((seat) => {
                  const relativeIdx = (seat.seat_index - mySeatIdx + N) % N;
                  const pos = positions[relativeIdx];
                  if (!pos) return null;

                  const isMe = seat.player_id === mePlayerId;
                  const myTricks = tricksByWinner[seat.player_id] || [];
                  const totalCards = myTricks.reduce(
                    (sum, t) => sum + (t?.length ?? 0),
                    0
                  );

                  const teamColor =
                    seat.team_palette_idx != null
                      ? TEAM_COLORS[seat.team_palette_idx]
                      : null;

                  return (
                    <button
                      key={seat.player_id}
                      type="button"
                      onClick={() => setSelectedPlayerId(seat.player_id)}
                      className="absolute flex flex-col items-center gap-1 active:scale-95 transition"
                      style={{
                        left: `${pos.l}%`,
                        top: `${pos.t}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <PlayerSummary
                        seat={seat}
                        isMe={isMe}
                        tricksCount={myTricks.length}
                        totalCards={totalCards}
                        teamColor={teamColor}
                        compact={N >= 9}
                      />
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-[10px] text-emerald-200/35 mt-2 uppercase tracking-widest">
                Tap any player to see trick details
              </p>
            </>
          )}
        </div>

        <div className="px-5 py-2 border-t border-emerald-900/40 text-center">
          <p className="text-[10px] text-emerald-200/40 uppercase tracking-widest">
            Resets when Round {roundNum} ends
          </p>
        </div>

        {selectedSeat && (
          <PlayerTrickDetails
            seat={selectedSeat}
            tricks={selectedTricks}
            mePlayerId={mePlayerId}
            shortLabels={shortLabels}
            onClose={() => setSelectedPlayerId(null)}
          />
        )}
      </div>
    </div>
  );
}

function PlayerSummary({ seat, isMe, tricksCount, totalCards, teamColor, compact }) {
  const hasWon = tricksCount > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <Avatar
          avatarId={seat.avatar_id}
          playerName={seat.name}
          size="xs"
          borderColor={teamColor}
        />

        {hasWon && (
          <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-300 text-[#07100c] text-[9px] font-bold flex items-center justify-center border border-[#07100c]">
            {tricksCount}
          </span>
        )}
      </div>

      <div
        className="px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap shadow"
        style={{
          background: hasWon
            ? 'rgba(245, 217, 137, 0.92)'
            : 'rgba(7, 16, 12, 0.85)',
          color: hasWon ? '#07100c' : '#ecfdf5',
          border: teamColor
            ? `1.5px solid ${teamColor}`
            : '1px solid rgba(34, 78, 60, 0.6)',
          maxWidth: compact ? 64 : 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {truncateName(seat.name, compact ? 7 : 9)}
        {isMe && <span className="opacity-50 text-[9px] ml-1">(you)</span>}
      </div>

      <p className="text-[9px] text-emerald-200/45">
        {tricksCount}T · {totalCards}C
      </p>
    </div>
  );
}

function PlayerTrickDetails({ seat, tricks, mePlayerId, shortLabels = {}, onClose }) {
  const isMe = seat.player_id === mePlayerId;
  const totalCards = tricks.reduce((sum, t) => sum + (t?.length ?? 0), 0);
  const teamColor =
    seat.team_palette_idx != null ? TEAM_COLORS[seat.team_palette_idx] : null;

  return (
    <div
      className="absolute inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm max-h-[78vh] overflow-hidden rounded-2xl bg-[#10241c] border border-amber-300/35 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-900/50">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              avatarId={seat.avatar_id}
              playerName={seat.name}
              size="sm"
              borderColor={teamColor}
            />

            <div className="min-w-0">
              <p className="text-amber-200 font-semibold truncate">
                {seat.name}
                {isMe && (
                  <span className="text-emerald-200/40 text-xs ml-1">
                    (you)
                  </span>
                )}
              </p>

              <p className="text-[10px] text-emerald-200/45 uppercase tracking-widest">
                {tricks.length} {tricks.length === 1 ? 'trick' : 'tricks'} ·{' '}
                {totalCards} {totalCards === 1 ? 'card' : 'cards'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-emerald-200/60 hover:text-emerald-100 transition text-2xl leading-none w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-950/40"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {tricks.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">🫙</p>
              <p className="text-emerald-200/60 text-sm">
                No tricks won by this player yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tricks.map((trickCards, trickIdx) => (
                <div
                  key={trickIdx}
                  className="rounded-xl bg-[#07100c]/70 border border-emerald-900/60 p-3"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-widest text-amber-200/80">
                      Trick {trickIdx + 1}
                    </p>

                    <p className="text-[10px] text-emerald-200/40">
                      {trickCards?.length ?? 0} cards
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 justify-center">
                    {(trickCards || []).map((entry, cardIdx) => {
                      const card = entry?.card ?? entry;
                      const playedById = entry?.player_id;
                      const isWinningCard = playedById === seat.player_id;
                      const label = shortLabels[playedById] || '?';

                      return (
                        <div
                          key={cardIdx}
                          className="relative pt-3"
                          title={label}
                          style={{
                            animation: isWinningCard
                              ? 'winningCardPop 1.6s ease-in-out infinite'
                              : 'cardSoftIn 0.25s ease both',
                          }}
                        >
                          <div
                            className="absolute left-1/2 flex items-center justify-center rounded-full pointer-events-none"
                            style={{
                              top: 1,
                              transform: 'translate(-50%, -35%)',
                              width: 17,
                              height: 17,
                              background: isWinningCard
                                ? 'rgba(30, 64, 175, 0.32)'
                                : 'rgba(7, 16, 12, 0.34)',
                              border: isWinningCard
                                ? '1px solid rgba(96, 165, 250, 0.75)'
                                : '1px solid rgba(245, 217, 137, 0.14)',
                              color: isWinningCard
                                ? 'rgba(219, 234, 254, 0.96)'
                                : 'rgba(245, 217, 137, 0.46)',
                              fontSize: 7,
                              fontWeight: 700,
                              lineHeight: 1,
                              zIndex: 5,
                              backdropFilter: 'blur(2px)',
                              boxShadow: isWinningCard
                                ? '0 0 12px rgba(59, 130, 246, 0.60)'
                                : 'none',
                            }}
                          >
                            {label}
                          </div>

                          <div
                            style={{
                              borderRadius: 10,
                              boxShadow: isWinningCard
                                ? '0 0 0 2px rgba(59, 130, 246, 0.88), 0 0 18px rgba(37, 99, 235, 0.70), 0 0 34px rgba(30, 64, 175, 0.48)'
                                : 'none',
                              transition: 'box-shadow 0.25s ease, transform 0.25s ease',
                            }}
                          >
                            <PlayingCard card={card} size="sm" />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <style jsx>{`
                    @keyframes winningCardPop {
                      0%, 100% {
                        transform: scale(1);
                      }
                      50% {
                        transform: scale(1.04);
                      }
                    }

                    @keyframes cardSoftIn {
                      from {
                        opacity: 0;
                        transform: scale(0.96);
                      }
                      to {
                        opacity: 1;
                        transform: scale(1);
                      }
                    }
                  `}</style>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getCircularTrickPositions(count) {
  const radiusX = count >= 10 ? 45 : count >= 8 ? 42 : 36;
  const radiusY = count >= 10 ? 41 : count >= 8 ? 39 : 36;

  return Array.from({ length: count }, (_, i) => {
    const angle = (90 - (i * 360) / count) * (Math.PI / 180);

    return {
      l: clampPercent(50 + Math.cos(angle) * radiusX, 5, 95),
      t: clampPercent(50 + Math.sin(angle) * radiusY, 8, 92),
    };
  });
}

function clampPercent(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function truncateName(name, max = 9) {
  if (!name) return '';
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

function buildShortNameLabels(players) {
  const labels = {};

  for (const player of players || []) {
    labels[player.player_id] = makeInitialLabel(player.name, 1);
  }

  const counts = {};
  for (const label of Object.values(labels)) {
    counts[label] = (counts[label] || 0) + 1;
  }

  for (const player of players || []) {
    const current = labels[player.player_id];

    if (counts[current] > 1) {
      labels[player.player_id] = makeInitialLabel(player.name, 2);
    }
  }

  return labels;
}

function makeInitialLabel(name, length = 1) {
  const clean = String(name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

  if (!clean) return '?';

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length >= 2 && length === 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  return clean.slice(0, length).toUpperCase();
}