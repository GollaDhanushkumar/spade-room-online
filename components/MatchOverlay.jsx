'use client';

import { useState } from 'react';
import { TEAM_COLORS, bidStarterSeatFor } from '@/lib/game-logic';
import CircularTable from './CircularTable';
import Avatar from './Avatar';

export default function MatchOverlay({
  code, game, seats, allRounds, round,
  isTeamMode, teamOrder, teamsByTeam, seatedPlayers,
  hostId, mePlayerId,
  chat,
  iAmSpectator,
}) {
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showSeating, setShowSeating] = useState(false);

  if (!game) return null;
  const N = seatedPlayers.length;

  return (
    <>
      {/* Floating buttons — top-right, fixed, vertical stack */}
      <div className="fixed top-3 right-3 z-30 flex flex-col gap-2">
        <button
          onClick={() => setShowScoreboard(true)}
          className="w-11 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition flex items-center justify-center text-lg"
          title="Scoreboard"
          aria-label="Scoreboard"
        >
          📊
        </button>
        <button
          onClick={() => setShowSeating(true)}
          className="w-11 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition flex items-center justify-center text-lg"
          title="Seating"
          aria-label="Seating"
        >
          🪑
        </button>
        {chat && !iAmSpectator && (
          <button
            onClick={() => chat.setIsOpen(true)}
            className="w-11 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition flex items-center justify-center text-lg relative"
            title="Chat"
            aria-label="Open chat"
          >
            💬
            {chat.unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-300 text-[#07100c] text-[10px] font-bold flex items-center justify-center">
                {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {showScoreboard && (
        <ScoreboardModal
          onClose={() => setShowScoreboard(false)}
          allRounds={allRounds}
          currentRound={round}
          maxRounds={game.max_rounds}
          isTeamMode={isTeamMode}
          teamOrder={teamOrder}
          teamsByTeam={teamsByTeam}
          seatedPlayers={seatedPlayers}
        />
      )}

      {showSeating && (
        <SeatingModal
          onClose={() => setShowSeating(false)}
          seats={seats.filter((s) => s.seat_index != null)}
          mode={game.mode}
          hostId={hostId}
          mePlayerId={mePlayerId}
          dealerSeatIdx={N > 0 ? bidStarterSeatFor(game.current_round || 1, N) : 0}
        />
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────
// Scoreboard modal — rounds as rows, teams/players as cols
// ───────────────────────────────────────────────────────
function ScoreboardModal({
  onClose, allRounds, currentRound, maxRounds,
  isTeamMode, teamOrder, teamsByTeam, seatedPlayers,
}) {
  const columns = isTeamMode
    ? teamOrder.map((tId) => {
        const teamSeats = teamsByTeam[tId] || [];
        return {
          id: tId,
          label: teamSeats.map((s) => s.name).join(' & '),
          color: TEAM_COLORS[teamSeats[0]?.team_palette_idx ?? 0],
          avatars: teamSeats.map((s) => ({ id: s.avatar_id, name: s.name })),
        };
      })
    : seatedPlayers.map((s) => ({
        id: s.player_id,
        label: s.name,
        color: '#f5d989',
        avatars: [{ id: s.avatar_id, name: s.name }],
      }));

  const rows = [];
  for (let r = 1; r <= maxRounds; r++) {
    const found = allRounds.find((rr) => rr.round_num === r);
    rows.push({ num: r, data: found || null });
  }

  const totals = {};
  for (const col of columns) totals[col.id] = 0;
  for (const r of rows) {
    if (!r.data) continue;
    const scores = isTeamMode ? r.data.team_scores : r.data.scores;
    if (!scores) continue;
    for (const col of columns) {
      totals[col.id] += (scores[col.id] ?? 0);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f1d18] border border-emerald-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-900/50">
          <h2 className="text-xl font-serif italic text-amber-200">Scoreboard</h2>
          <button
            onClick={onClose}
            className="text-emerald-200/60 hover:text-emerald-100 transition text-2xl leading-none w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-950/40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-auto flex-1 p-4">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="sticky top-0 bg-[#0f1d18] text-left px-3 py-2 text-xs uppercase tracking-widest text-emerald-200/40 font-medium border-b border-emerald-900/40">
                  R
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="sticky top-0 bg-[#0f1d18] px-2 py-2 text-xs text-emerald-200/70 font-medium border-b border-emerald-900/40"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        {col.avatars.map((a, i) => (
                          <Avatar key={i} avatarId={a.id} playerName={a.name} size="xs" />
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                        <span className="truncate" style={{ maxWidth: 120 }}>{col.label}</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isCurrent = currentRound &&
                  currentRound.round_num === r.num &&
                  !r.data?.completed_at;
                const bidsSrc = r.data ? (isTeamMode ? r.data.team_bids : r.data.bids) : null;
                const wonSrc = r.data ? (isTeamMode ? r.data.team_tricks_won : r.data.tricks_won) : null;
                const scoreSrc = r.data ? (isTeamMode ? r.data.team_scores : r.data.scores) : null;
                const hasScores = scoreSrc && Object.keys(scoreSrc).length > 0;
                return (
                  <tr
                    key={r.num}
                    className={isCurrent ? 'bg-amber-200/5' : ''}
                  >
                    <td
                      className={`px-3 py-3 border-b border-emerald-900/30 font-serif italic ${
                        isCurrent ? 'text-amber-200 text-lg font-bold' : 'text-emerald-200/70'
                      }`}
                    >
                      {r.num}
                    </td>
                    {columns.map((col) => {
                      const bid = bidsSrc?.[col.id];
                      const won = wonSrc?.[col.id] ?? 0;
                      const score = scoreSrc?.[col.id];
                      const hasBid = bid != null;
                      return (
                        <td
                          key={col.id}
                          className="px-2 py-3 border-b border-emerald-900/30 text-center"
                        >
                          {!r.data ? (
                            <span className="text-emerald-200/20">—</span>
                          ) : (
                            <>
                              <div className={`text-xs font-mono ${isCurrent ? 'text-emerald-200/70' : 'text-emerald-200/50'}`}>
                                {won}/{hasBid ? bid : '?'}
                              </div>
                              <div
                                className={`font-mono font-bold ${isCurrent ? 'text-base' : 'text-sm'}`}
                                style={{
                                  color: hasScores
                                    ? (score > 0 ? '#86efac' : score < 0 ? '#fca5a5' : '#e5d4a8')
                                    : 'rgba(167, 209, 188, 0.25)',
                                }}
                              >
                                {hasScores ? (score > 0 ? `+${score}` : score) : '—'}
                              </div>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="bg-[#14271f]">
                <td className="px-3 py-3 font-bold text-amber-200 uppercase tracking-widest text-xs">
                  Total
                </td>
                {columns.map((col) => {
                  const t = totals[col.id] ?? 0;
                  return (
                    <td key={col.id} className="px-2 py-3 text-center">
                      <span
                        className="text-xl font-serif italic font-bold"
                        style={{
                          color: t > 0 ? '#86efac' : t < 0 ? '#fca5a5' : '#e5d4a8',
                        }}
                      >
                        {t > 0 ? '+' : ''}{t}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────
// Seating modal — circular table only (mute moved to VoicePanel)
// ───────────────────────────────────────────────────────
function SeatingModal({ onClose, seats, mode, hostId, mePlayerId, dealerSeatIdx }) {
  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f1d18] border border-emerald-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-900/50">
          <h2 className="text-xl font-serif italic text-amber-200">The Table</h2>
          <button
            onClick={onClose}
            className="text-emerald-200/60 hover:text-emerald-100 transition text-2xl leading-none w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-950/40"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <p className="text-xs text-emerald-200/50 text-center mb-3">
            Seating cards. <span className="text-amber-200 font-bold">DEALS</span> = this round's starter.
          </p>
          <CircularTable
            seats={seats}
            mode={mode}
            hostId={hostId}
            mePlayerId={mePlayerId}
            dealerSeatIdx={dealerSeatIdx}
          />
        </div>
      </div>
    </div>
  );
}