'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TEAM_COLORS } from '@/lib/game-logic';
import Avatar from './Avatar';

// ──────────────────────────────────────────────────────────
// Top-level: list of ALL past matches across all rooms
// (host-only — gated by the parent that renders this modal)
// ──────────────────────────────────────────────────────────
export default function MatchHistoryModal({ code, onClose }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(200);
      if (error) console.error('Failed to load match history:', error);
      if (!cancelled) {
        setMatches(data || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (selectedMatch) {
    return <MatchDetail match={selectedMatch} onBack={() => setSelectedMatch(null)} onClose={onClose} />;
  }

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
          <div>
            <h2 className="text-xl font-serif italic text-amber-200">Match History</h2>
            <p className="text-[10px] text-emerald-200/40 uppercase tracking-wider mt-0.5">
              All-time · {matches.length} matches
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
          {loading ? (
            <p className="text-emerald-200/40 text-center text-sm py-8">Loading...</p>
          ) : matches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🎴</p>
              <p className="text-emerald-200/60 text-sm">No matches yet</p>
              <p className="text-emerald-200/40 text-xs mt-2">Play one to see it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map((m) => (
                <MatchRow key={m.id} match={m} currentRoom={code} onClick={() => setSelectedMatch(m)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchRow({ match, currentRoom, onClick }) {
  const date = new Date(match.completed_at);
  const dateStr = formatRelativeDate(date);
  const isTeam = match.mode === 'team';
  const wasInThisRoom = match.room_code === currentRoom;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#14271f] hover:bg-[#1a3024] border border-emerald-900/50 hover:border-amber-300/40 rounded-xl p-4 transition active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-emerald-200/50 uppercase tracking-widest">{dateStr}</p>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${
            wasInThisRoom ? 'bg-amber-300/15 text-amber-200' : 'bg-emerald-950/40 text-emerald-200/40'
          }`}>
            {match.room_code}
          </span>
          <p className="text-[10px] text-emerald-200/40 uppercase tracking-wider">
            {isTeam ? 'Team' : 'Indiv'} · {match.player_count}p · R{match.max_rounds}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🏆</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-200 truncate">
            {match.winner_label}
          </p>
        </div>
        <p className="text-2xl font-serif italic font-bold whitespace-nowrap"
          style={{ color: match.winner_score > 0 ? '#86efac' : match.winner_score < 0 ? '#fca5a5' : '#e5d4a8' }}>
          {match.winner_score > 0 ? '+' : ''}{match.winner_score}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {(match.player_snapshot || []).slice(0, 8).map((p, i) => (
          <Avatar key={i} avatarId={p.avatar_id} playerName={p.name} size="xs" />
        ))}
        {(match.player_snapshot || []).length > 8 && (
          <span className="text-xs text-emerald-200/40 ml-1">
            +{match.player_snapshot.length - 8}
          </span>
        )}
      </div>

      <p className="text-xs text-emerald-200/30 mt-2">Tap to view round-by-round →</p>
    </button>
  );
}

function MatchDetail({ match, onBack, onClose }) {
  const isTeam = match.mode === 'team';
  const ranked = buildRanking(match);
  const completedRounds = (match.round_breakdown || []).filter((r) => r.completed);

  const date = new Date(match.completed_at);
  const startDate = new Date(match.started_at);
  const minutesPlayed = Math.max(1, Math.round((date - startDate) / 60000));

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
          <button
            onClick={onBack}
            className="text-emerald-200/60 hover:text-emerald-100 transition text-sm"
          >
            ← Back
          </button>
          <h2 className="text-base font-serif italic text-amber-200">Match Detail</h2>
          <button
            onClick={onClose}
            className="text-emerald-200/60 hover:text-emerald-100 transition text-2xl leading-none w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-950/40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          <div className="text-center mb-4">
            <p className="text-xs text-emerald-200/40 uppercase tracking-widest">
              Room {match.room_code}
              {' · '}
              {date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}
              {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              {' · '}
              {minutesPlayed}m
            </p>
            <p className="text-[10px] text-emerald-200/40 uppercase tracking-wider mt-1">
              {isTeam ? 'Team' : 'Individual'} · {match.deck_count} deck · {match.player_count} players · {match.max_rounds} rounds
            </p>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4 mb-4">
            <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-3">Final ranking</p>
            <div className="space-y-2">
              {ranked.map((r, idx) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{
                    background: idx === 0 ? `${r.color}18` : '#14271f',
                    border: idx === 0 ? `1.5px solid ${r.color}80` : '1px solid rgba(34, 78, 60, 0.4)',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-serif italic w-6 text-center"
                      style={{ color: idx === 0 ? r.color : '#86a294' }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                    </span>
                    {isTeam && (
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                    )}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(r.avatars || []).map((a, i) => (
                        <Avatar key={i} avatarId={a.id} playerName={a.name} size="xs" />
                      ))}
                    </div>
                    <span className="text-sm truncate font-medium">{r.label}</span>
                  </div>
                  <span className="text-lg font-serif italic font-bold whitespace-nowrap"
                    style={{ color: r.total > 0 ? '#86efac' : r.total < 0 ? '#fca5a5' : '#e5d4a8' }}>
                    {r.total > 0 ? '+' : ''}{r.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {completedRounds.length > 0 && (
            <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4 overflow-x-auto">
              <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-3">
                Round-by-round
              </p>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="text-emerald-200/40 uppercase tracking-wider">
                    <th className="text-left pb-2 pr-2">{isTeam ? 'Team' : 'Player'}</th>
                    {completedRounds.map((r) => (
                      <th key={r.round_num} className="px-1.5 pb-2 text-center">R{r.round_num}</th>
                    ))}
                    <th className="pl-2 pb-2 text-right">Σ</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((rk) => (
                    <tr key={rk.id} className="border-t border-emerald-900/30">
                      <td className="py-2 pr-2 truncate" style={{ maxWidth: 110 }}>
                        <div className="flex items-center gap-1.5">
                          {isTeam && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: rk.color }} />
                          )}
                          <span className="truncate">{rk.label}</span>
                        </div>
                      </td>
                      {completedRounds.map((r) => {
                        const s = r.scores?.[rk.id] ?? 0;
                        const bid = r.bids?.[rk.id];
                        const won = r.tricks_won?.[rk.id] ?? 0;
                        return (
                          <td key={r.round_num} className="px-1.5 py-2 text-center font-mono">
                            <div className="text-[10px] text-emerald-200/40">{won}/{bid ?? 0}</div>
                            <span style={{
                              color: s > 0 ? '#86efac' : s < 0 ? '#fca5a5' : '#86a294',
                            }}>
                              {s > 0 ? '+' : ''}{s}
                            </span>
                          </td>
                        );
                      })}
                      <td className="pl-2 py-2 text-right font-mono font-bold"
                        style={{ color: rk.total > 0 ? '#86efac' : rk.total < 0 ? '#fca5a5' : '#e5d4a8' }}>
                        {rk.total > 0 ? '+' : ''}{rk.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildRanking(match) {
  const isTeam = match.mode === 'team';
  const finalScores = match.final_scores || {};

  if (isTeam) {
    return (match.team_snapshot || []).map((t) => ({
      id: t.team_id,
      label: t.label,
      color: TEAM_COLORS[t.palette_idx ?? 0],
      avatars: (t.members || []).map((m) => ({ id: m.avatar_id, name: m.name })),
      total: finalScores[t.team_id] ?? 0,
    })).sort((a, b) => b.total - a.total);
  }

  return (match.player_snapshot || []).map((p) => ({
    id: p.player_id,
    label: p.name,
    color: '#f5d989',
    avatars: [{ id: p.avatar_id, name: p.name }],
    total: finalScores[p.player_id] ?? 0,
  })).sort((a, b) => b.total - a.total);
}

function formatRelativeDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}