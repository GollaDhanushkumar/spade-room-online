'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TEAM_COLORS } from '@/lib/game-logic';
import Avatar from './Avatar';

// ──────────────────────────────────────────────────────────
// Top-level: tabs for Matches list + Rankings page
// ──────────────────────────────────────────────────────────
export default function MatchHistoryModal({ code, onClose, iAmHost }) {
  const [matches, setMatches] = useState([]);
  const [hiddenRows, setHiddenRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [activeTab, setActiveTab] = useState('matches');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ data: matchData }, { data: hiddenData }] = await Promise.all([
        supabase
          .from('matches')
          .select('*')
          .order('completed_at', { ascending: false })
          .limit(500),
        supabase
          .from('hidden_rankings')
          .select('*'),
      ]);
      if (!cancelled) {
        setMatches(matchData || []);
        setHiddenRows(hiddenData || []);
        setLoading(false);
      }
    }
    load();

    const channel = supabase
      .channel('hidden-rankings')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'hidden_rankings' },
        async () => {
          const { data } = await supabase.from('hidden_rankings').select('*');
          if (!cancelled) setHiddenRows(data || []);
        })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-900/50">
          <div>
            <h2 className="text-xl font-serif italic text-amber-200">
              {activeTab === 'matches' ? 'Match History' : 'Rankings'}
            </h2>
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

        <div className="flex border-b border-emerald-900/40">
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-3 text-xs uppercase tracking-widest transition ${
              activeTab === 'matches'
                ? 'text-amber-200 border-b-2 border-amber-300'
                : 'text-emerald-200/50 hover:text-emerald-200/80'
            }`}
          >
            📜 Matches
          </button>
          <button
            onClick={() => setActiveTab('rankings')}
            className={`flex-1 py-3 text-xs uppercase tracking-widest transition ${
              activeTab === 'rankings'
                ? 'text-amber-200 border-b-2 border-amber-300'
                : 'text-emerald-200/50 hover:text-emerald-200/80'
            }`}
          >
            🏆 Rankings
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
          ) : activeTab === 'matches' ? (
            <div className="space-y-2">
              {matches.map((m) => (
                <MatchRow key={m.id} match={m} currentRoom={code} onClick={() => setSelectedMatch(m)} />
              ))}
            </div>
          ) : (
            <RankingsView matches={matches} hiddenRows={hiddenRows} iAmHost={iAmHost} />
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

// ──────────────────────────────────────────────────────────
// Rankings view with sub-tabs (Individual / Pairs)
// ──────────────────────────────────────────────────────────
function RankingsView({ matches, hiddenRows, iAmHost }) {
  const [subTab, setSubTab] = useState('individual'); // 'individual' | 'pairs'
  const [editMode, setEditMode] = useState(false);
  const [showHiddenList, setShowHiddenList] = useState(false);
  const [confirmHide, setConfirmHide] = useState(null);
  const [working, setWorking] = useState(false);

  const hiddenSet = new Set(hiddenRows.map((h) => h.identifier));

  async function handleHide(identifier, displayName) {
    if (working) return;
    setWorking(true);
    const { error } = await supabase.from('hidden_rankings').insert({
      identifier,
      display_name: displayName,
    });
    if (error) console.error('Failed to hide:', error);
    setConfirmHide(null);
    setWorking(false);
  }

  async function handleUnhide(identifier) {
    if (working) return;
    setWorking(true);
    const { error } = await supabase.from('hidden_rankings').delete().eq('identifier', identifier);
    if (error) console.error('Failed to unhide:', error);
    setWorking(false);
  }

  return (
    <div className="space-y-2">
      {/* Sub-tabs */}
      <div className="flex bg-[#14271f] rounded-lg p-1 mb-2">
        <button
          onClick={() => setSubTab('individual')}
          className={`flex-1 py-2 text-[11px] uppercase tracking-wider rounded-md transition ${
            subTab === 'individual'
              ? 'bg-amber-300 text-[#07100c] font-bold'
              : 'text-emerald-200/60 hover:text-emerald-200'
          }`}
        >
          Individual
        </button>
        <button
          onClick={() => setSubTab('pairs')}
          className={`flex-1 py-2 text-[11px] uppercase tracking-wider rounded-md transition ${
            subTab === 'pairs'
              ? 'bg-amber-300 text-[#07100c] font-bold'
              : 'text-emerald-200/60 hover:text-emerald-200'
          }`}
        >
          Team Pairs
        </button>
      </div>

      {subTab === 'individual' ? (
        <IndividualRankings
          matches={matches}
          hiddenSet={hiddenSet}
          iAmHost={iAmHost}
          editMode={editMode}
          setEditMode={setEditMode}
          onHideClick={(p) => setConfirmHide({ identifier: p.identifier, displayName: p.displayName })}
        />
      ) : (
        <PairRankings
          matches={matches}
          hiddenSet={hiddenSet}
        />
      )}

      {/* Hidden players section (host-only, applies to both tabs) */}
      {iAmHost && hiddenRows.length > 0 && (
        <div className="mt-4 pt-3 border-t border-emerald-900/40">
          <button
            onClick={() => setShowHiddenList((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#14271f] border border-emerald-900/40 hover:border-amber-300/40 transition text-xs"
          >
            <span className="text-emerald-200/70">
              🚫 {hiddenRows.length} hidden {hiddenRows.length === 1 ? 'player' : 'players'}
            </span>
            <span className="text-emerald-200/40">{showHiddenList ? '▲' : '▼'}</span>
          </button>
          {showHiddenList && (
            <div className="mt-2 space-y-1.5">
              {hiddenRows.map((h) => (
                <div
                  key={h.identifier}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#14271f]/60 border border-emerald-900/30"
                >
                  <span className="text-xs text-emerald-200/60 truncate">{h.display_name || h.identifier}</span>
                  <button
                    onClick={() => handleUnhide(h.identifier)}
                    disabled={working}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-emerald-900 text-emerald-200/70 hover:text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"
                  >
                    Unhide
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-emerald-200/30 text-center mt-2">
            Hiding a player also hides every pair containing them.
          </p>
        </div>
      )}

      {/* Hide confirmation modal */}
      {confirmHide && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setConfirmHide(null)}
        >
          <div
            className="bg-[#0f1d18] border border-amber-300/40 rounded-2xl p-5 max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-serif italic text-amber-200 mb-2">Hide from rankings?</h3>
            <p className="text-emerald-200/70 text-sm mb-4">
              <span className="font-bold">{confirmHide.displayName}</span> will no longer appear in rankings for anyone. Any team pairs with them will also be hidden. You can unhide them later from the bottom of this page.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmHide(null)}
                disabled={working}
                className="flex-1 py-2.5 rounded-lg border border-emerald-900 text-emerald-200/70 text-sm hover:bg-emerald-950/40"
              >
                Cancel
              </button>
              <button
                onClick={() => handleHide(confirmHide.identifier, confirmHide.displayName)}
                disabled={working}
                className="flex-1 py-2.5 rounded-lg bg-red-900/40 border border-red-400/50 text-red-200 text-sm disabled:opacity-50"
              >
                {working ? 'Hiding...' : 'Hide'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Individual rankings (individual mode matches only)
// ──────────────────────────────────────────────────────────
function IndividualRankings({ matches, hiddenSet, iAmHost, editMode, setEditMode, onHideClick }) {
  const indivMatches = matches.filter((m) => m.mode === 'individual');
  const stats = computePlayerStats(indivMatches);
  const visible = Object.values(stats).filter((p) => !hiddenSet.has(p.identifier));
  const ranked = visible.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.totalPoints - a.totalPoints;
  });

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-emerald-200/40">
          {indivMatches.length} individual {indivMatches.length === 1 ? 'match' : 'matches'} · sorted by win rate
        </p>
        {iAmHost && ranked.length > 0 && (
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded transition ${
              editMode
                ? 'bg-amber-300 text-[#07100c] font-bold'
                : 'border border-emerald-900 text-emerald-200/70 hover:bg-emerald-950/40'
            }`}
          >
            {editMode ? '✓ Done' : '✎ Manage'}
          </button>
        )}
      </div>

      {ranked.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">🏆</p>
          <p className="text-emerald-200/60 text-sm">No individual matches yet</p>
        </div>
      ) : (
        ranked.map((p, idx) => (
          <PlayerRankingRow
            key={p.identifier}
            player={p}
            rank={idx + 1}
            editMode={editMode}
            onHideClick={() => onHideClick(p)}
          />
        ))
      )}

      <p className="text-[10px] text-emerald-200/30 text-center mt-4 leading-relaxed">
        Stats match by name first (case-insensitive), then avatar.
      </p>
    </>
  );
}

function PlayerRankingRow({ player, rank, editMode, onHideClick }) {
  const [expanded, setExpanded] = useState(false);
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  const winRatePct = Math.round(player.winRate * 100);
  const avgScore = player.matchesPlayed > 0 ? Math.round(player.totalPoints / player.matchesPlayed) : 0;
  const bidAccuracyPct = player.totalBids > 0 ? Math.round((player.correctBids / player.totalBids) * 100) : 0;

  const streakLabel = player.currentStreak === 0
    ? 'No streak'
    : player.streakType === 'win'
      ? `🔥 ${player.currentStreak}W streak`
      : `❄️ ${player.currentStreak}L streak`;
  const streakColor = player.currentStreak === 0
    ? '#86a294'
    : player.streakType === 'win'
      ? '#86efac'
      : '#fca5a5';

  return (
    <div className="bg-[#14271f] border border-emerald-900/50 rounded-xl p-3 transition mb-2">
      <div className="flex items-center gap-3">
        <span className="text-lg font-serif italic text-amber-200 w-10 text-center flex-shrink-0">{medal}</span>
        <Avatar avatarId={player.avatarId} playerName={player.displayName} size="sm" />
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-medium truncate">{player.displayName}</p>
          <p className="text-[10px] text-emerald-200/50">
            {player.wins}W · {player.losses}L · {player.matchesPlayed} matches
          </p>
        </button>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-serif italic font-bold text-amber-200">{winRatePct}%</p>
          <p className="text-[9px] text-emerald-200/40 uppercase tracking-wider">win rate</p>
        </div>
        {editMode && (
          <button
            onClick={onHideClick}
            className="ml-1 w-7 h-7 rounded-full bg-red-900/40 border border-red-400/50 text-red-200 text-base hover:bg-red-900/60 flex items-center justify-center flex-shrink-0"
            title="Hide from rankings"
            aria-label="Hide from rankings"
          >
            ×
          </button>
        )}
      </div>

      {expanded && !editMode && (
        <div className="mt-3 pt-3 border-t border-emerald-900/40">
          <div className="grid grid-cols-4 gap-2 mb-3 pb-3 border-b border-emerald-900/30">
            <PlacementBadge emoji="🥇" count={player.firstCount} />
            <PlacementBadge emoji="🥈" count={player.secondCount} />
            <PlacementBadge emoji="🥉" count={player.thirdCount} />
            <PlacementBadge emoji="🪦" label="Last" count={player.lastCount} />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <StatLine label="Total points" value={`${player.totalPoints > 0 ? '+' : ''}${player.totalPoints}`} color={player.totalPoints > 0 ? '#86efac' : '#fca5a5'} />
            <StatLine label="Avg / match" value={`${avgScore > 0 ? '+' : ''}${avgScore}`} color={avgScore > 0 ? '#86efac' : '#fca5a5'} />
            <StatLine label="Best match" value={`${player.bestMatch > 0 ? '+' : ''}${player.bestMatch}`} color="#86efac" />
            <StatLine label="Worst match" value={`${player.worstMatch > 0 ? '+' : ''}${player.worstMatch}`} color="#fca5a5" />
            <StatLine label="Bid accuracy" value={`${bidAccuracyPct}% (${player.correctBids}/${player.totalBids})`} color="#e5d4a8" />
            <StatLine label="Current streak" value={streakLabel} color={streakColor} />
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Pair rankings — unique team pairings sorted by their win rate
// ──────────────────────────────────────────────────────────
function PairRankings({ matches, hiddenSet }) {
  const [filterPlayer, setFilterPlayer] = useState(null);
  const teamMatches = matches.filter((m) => m.mode === 'team');
  const pairs = computePairStats(teamMatches);

  // Filter out pairs where either member is hidden
  const visible = Object.values(pairs).filter((p) =>
    !hiddenSet.has(p.aIdentifier) && !hiddenSet.has(p.bIdentifier)
  );

  const ranked = visible
    .filter((p) => p.matchesPlayed >= 1)
    .sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.matchesPlayed - a.matchesPlayed;
    });

  // Collect all unique player names from visible pairs (for filter pills)
  const allPlayers = [];
  const seenNames = new Set();
  for (const p of ranked) {
    if (!seenNames.has(p.aIdentifier)) {
      seenNames.add(p.aIdentifier);
      allPlayers.push({ identifier: p.aIdentifier, name: p.aName, avatarId: p.aAvatarId });
    }
    if (!seenNames.has(p.bIdentifier)) {
      seenNames.add(p.bIdentifier);
      allPlayers.push({ identifier: p.bIdentifier, name: p.bName, avatarId: p.bAvatarId });
    }
  }
  allPlayers.sort((a, b) => a.name.localeCompare(b.name));

  // Apply filter
  const filtered = filterPlayer
    ? ranked.filter((p) =>
        p.aIdentifier === filterPlayer || p.bIdentifier === filterPlayer
      )
    : ranked;

  // Count matches for filtered player
  const filterPlayerMatchCount = filterPlayer
    ? filtered.reduce((sum, p) => sum + p.matchesPlayed, 0)
    : null;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-emerald-200/40">
          {teamMatches.length} team {teamMatches.length === 1 ? 'match' : 'matches'} · {ranked.length} unique {ranked.length === 1 ? 'pair' : 'pairs'}
        </p>
        {filterPlayer && (
          <button
            onClick={() => setFilterPlayer(null)}
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-amber-300 text-[#07100c] font-bold"
          >
            Clear ×
          </button>
        )}
      </div>

      {/* Player filter dropdown */}
      {allPlayers.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-widest text-emerald-200/40 flex-shrink-0">
            Filter by player
          </p>
          <select
            value={filterPlayer ?? ''}
            onChange={(e) => setFilterPlayer(e.target.value || null)}
            className="flex-1 px-3 py-2 rounded-xl bg-[#14271f] border border-emerald-900/60 text-emerald-200 text-xs focus:border-amber-300/60 outline-none cursor-pointer"
          >
            <option value="">All players</option>
            {allPlayers.map((pl) => {
              const pairCount = ranked.filter(
                (p) => p.aIdentifier === pl.identifier || p.bIdentifier === pl.identifier
              ).length;
              return (
                <option key={pl.identifier} value={pl.identifier}>
                  {pl.name} ({pairCount} {pairCount === 1 ? 'partner' : 'partners'})
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Filter summary */}
      {filterPlayer && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-200/8 border border-amber-300/20">
          <p className="text-xs text-amber-200/80">
            Showing <span className="font-bold text-amber-200">
              {allPlayers.find((p) => p.identifier === filterPlayer)?.name}
            </span>'s pairs · {filtered.length} {filtered.length === 1 ? 'partner' : 'partners'}
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">👥</p>
          <p className="text-emerald-200/60 text-sm">No team pairs yet</p>
          <p className="text-emerald-200/40 text-xs mt-1">Play team matches to see partnerships.</p>
        </div>
      ) : (
        filtered.map((p, idx) => (
          <PairRankingRow key={`${p.aIdentifier}__${p.bIdentifier}`} pair={p} rank={idx + 1} />
        ))
      )}

      <p className="text-[10px] text-emerald-200/30 text-center mt-4 leading-relaxed">
        Each pair = a unique 2-player team. Tap a player pill to filter their partnerships.
      </p>
    </>
  );
}

function PairRankingRow({ pair, rank }) {
  const [expanded, setExpanded] = useState(false);
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  const winRatePct = Math.round(pair.winRate * 100);
  const avgScore = pair.matchesPlayed > 0 ? Math.round(pair.totalPoints / pair.matchesPlayed) : 0;
  const bidAccuracyPct = pair.totalBids > 0 ? Math.round((pair.correctBids / pair.totalBids) * 100) : 0;

  const streakLabel = pair.currentStreak === 0
    ? 'No streak'
    : pair.streakType === 'win'
      ? `🔥 ${pair.currentStreak}W streak`
      : `❄️ ${pair.currentStreak}L streak`;
  const streakColor = pair.currentStreak === 0
    ? '#86a294'
    : pair.streakType === 'win'
      ? '#86efac'
      : '#fca5a5';

  return (
    <div className="bg-[#14271f] border border-emerald-900/50 rounded-xl p-3 transition mb-2">
      <div className="flex items-center gap-3">
        <span className="text-lg font-serif italic text-amber-200 w-10 text-center flex-shrink-0">{medal}</span>
        <div className="flex items-center -space-x-2 flex-shrink-0">
          <Avatar avatarId={pair.aAvatarId} playerName={pair.aName} size="sm" />
          <Avatar avatarId={pair.bAvatarId} playerName={pair.bName} size="sm" />
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-medium truncate">{pair.aName} + {pair.bName}</p>
          <p className="text-[10px] text-emerald-200/50">
            {pair.wins}W · {pair.losses}L · {pair.matchesPlayed} matches
          </p>
        </button>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-serif italic font-bold text-amber-200">{winRatePct}%</p>
          <p className="text-[9px] text-emerald-200/40 uppercase tracking-wider">win rate</p>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-emerald-900/40 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <StatLine label="Total points" value={`${pair.totalPoints > 0 ? '+' : ''}${pair.totalPoints}`} color={pair.totalPoints > 0 ? '#86efac' : '#fca5a5'} />
          <StatLine label="Avg / match" value={`${avgScore > 0 ? '+' : ''}${avgScore}`} color={avgScore > 0 ? '#86efac' : '#fca5a5'} />
          <StatLine label="Best match" value={`${pair.bestMatch > 0 ? '+' : ''}${pair.bestMatch}`} color="#86efac" />
          <StatLine label="Worst match" value={`${pair.worstMatch > 0 ? '+' : ''}${pair.worstMatch}`} color="#fca5a5" />
          <StatLine label="Bid accuracy" value={`${bidAccuracyPct}% (${pair.correctBids}/${pair.totalBids})`} color="#e5d4a8" />
          <StatLine label="Current streak" value={streakLabel} color={streakColor} />
        </div>
      )}
    </div>
  );
}



function PlacementBadge({ emoji, label, count }) {
  return (
    <div className="text-center bg-[#0f1d18] rounded-lg py-2">
      <p className="text-lg leading-none mb-1">{emoji}</p>
      <p className="text-sm font-bold font-mono text-amber-200">{count}</p>
      {label && <p className="text-[8px] text-emerald-200/40 uppercase tracking-wider mt-0.5">{label}</p>}
    </div>
  );
}

function StatLine({ label, value, color }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-emerald-200/40">{label}</p>
      <p className="text-xs font-mono font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Smart identifier matching (lowercase name first, then avatar)
// ──────────────────────────────────────────────────────────
function makeIdentifierResolver() {
  const seenAvatars = {}; // avatar_id -> identifier
  const seenIdentifiers = new Set();

  return function getIdentifier(name, avatarId) {
    const lowerName = (name || 'unknown').toLowerCase().trim();
    if (seenIdentifiers.has(lowerName)) return lowerName;
    if (avatarId && seenAvatars[avatarId]) return seenAvatars[avatarId];
    seenIdentifiers.add(lowerName);
    if (avatarId) seenAvatars[avatarId] = lowerName;
    return lowerName;
  };
}

// ──────────────────────────────────────────────────────────
// Compute individual stats (individual matches only)
// ──────────────────────────────────────────────────────────
function computePlayerStats(matches) {
  const statsByIdentifier = {};
  const getIdentifier = makeIdentifierResolver();

  for (const match of matches) {
    const finalScores = match.final_scores || {};
    const playerSnap = match.player_snapshot || [];
    const roundBreakdown = match.round_breakdown || [];

   const sortedScores = Object.entries(finalScores).sort((a, b) => b[1] - a[1]);
    const topScore = sortedScores[0]?.[1] ?? 0;

    // Build tie-aware placement map: players with equal scores share a rank;
    // the next distinct score skips ahead by the count of tied players (1,1,3,4...)
    const scoreEntries = playerSnap.map((p) => ({
      pid: p.player_id,
      score: finalScores[p.player_id] ?? 0,
    }));
    scoreEntries.sort((a, b) => b.score - a.score);
    const placementMap = {};
    let rank = 0;
    let prevScore = null;
    scoreEntries.forEach((e, idx) => {
      if (e.score !== prevScore) {
        rank = idx + 1;
        prevScore = e.score;
      }
      placementMap[e.pid] = rank;
    });
    const maxPlacement = scoreEntries.length > 0
      ? Math.max(...Object.values(placementMap))
      : 0;

    for (const p of playerSnap) {
      const identifier = getIdentifier(p.name, p.avatar_id);

      if (!statsByIdentifier[identifier]) {
        statsByIdentifier[identifier] = {
          identifier,
          displayName: p.name,
          avatarId: p.avatar_id,
          matchesPlayed: 0, wins: 0, losses: 0, winRate: 0,
          totalPoints: 0, bestMatch: -Infinity, worstMatch: Infinity,
          totalBids: 0, correctBids: 0,
          recentResults: [],
          currentStreak: 0, streakType: null,
          firstCount: 0, secondCount: 0, thirdCount: 0, lastCount: 0,
        };
      }
      const s = statsByIdentifier[identifier];
      s.matchesPlayed += 1;

      const myScore = finalScores[p.player_id] ?? 0;
      // Tied at top = win (everyone tied at max gets a W)
      const iWon = (p.player_id in finalScores) && myScore === topScore;

      s.totalPoints += myScore;
      if (myScore > s.bestMatch) s.bestMatch = myScore;
      if (myScore < s.worstMatch) s.worstMatch = myScore;
      if (iWon) s.wins += 1; else s.losses += 1;
      s.recentResults.push(iWon ? 'W' : 'L');

      // Placement (1st/2nd/3rd/last), tie-aware (competition ranking: ties share a place)
      const myPlacement = placementMap[p.player_id];
      if (myPlacement === 1) s.firstCount += 1;
      else if (myPlacement === 2) s.secondCount += 1;
      else if (myPlacement === 3) s.thirdCount += 1;
      if (maxPlacement > 3 && myPlacement === maxPlacement) s.lastCount += 1;

      for (const r of roundBreakdown) {
        if (!r.completed) continue;
        const rawBid = r.bids?.[p.player_id];
        const rawWon = r.tricks_won?.[p.player_id];
        // Treat missing values as 0 — a completed round counts whether they bid or not
        const bid = rawBid ?? 0;
        const won = rawWon ?? 0;
        s.totalBids += 1;
        if (bid === won) s.correctBids += 1;
      }
    }
  }

  for (const s of Object.values(statsByIdentifier)) {
    s.winRate = s.matchesPlayed > 0 ? s.wins / s.matchesPlayed : 0;
    if (s.bestMatch === -Infinity) s.bestMatch = 0;
    if (s.worstMatch === Infinity) s.worstMatch = 0;
    if (s.recentResults.length > 0) {
      const latest = s.recentResults[0];
      s.streakType = latest === 'W' ? 'win' : 'loss';
      let streak = 0;
      for (const r of s.recentResults) {
        if (r === latest) streak += 1;
        else break;
      }
      s.currentStreak = streak;
    }
  }

  return statsByIdentifier;
}

// ──────────────────────────────────────────────────────────
// Compute pair stats (team matches only)
// Each unique 2-player team becomes one ranking entry.
// Larger teams (e.g. 3-player teams in 6-player team mode) generate
// all 2-player sub-pairings.
// ──────────────────────────────────────────────────────────
function computePairStats(matches) {
  const pairsByKey = {};
  const getIdentifier = makeIdentifierResolver();

  function pairKey(idA, idB) {
    return idA < idB ? `${idA}__${idB}` : `${idB}__${idA}`;
  }

  for (const match of matches) {
    const finalScores = match.final_scores || {};
    const teamSnap = match.team_snapshot || [];
    const roundBreakdown = match.round_breakdown || [];

    const sortedScores = Object.entries(finalScores).sort((a, b) => b[1] - a[1]);
    const topScore = sortedScores[0]?.[1] ?? 0;

    for (const team of teamSnap) {
      const members = team.members || [];
      if (members.length < 2) continue;

      // Resolve identifiers for each member
      const resolved = members.map((m) => ({
        member: m,
        identifier: getIdentifier(m.name, m.avatar_id),
      }));

      const teamScore = finalScores[team.team_id] ?? 0;
      // Tied at top = win (all teams tied at max get a W)
      const teamWon = (team.team_id in finalScores) && teamScore === topScore;

      // Generate all unique 2-player sub-pairs from this team
      for (let i = 0; i < resolved.length; i++) {
        for (let j = i + 1; j < resolved.length; j++) {
          const a = resolved[i];
          const b = resolved[j];
          const key = pairKey(a.identifier, b.identifier);

          if (!pairsByKey[key]) {
            // Stable ordering: sort by identifier alphabetically
            const [first, second] = a.identifier < b.identifier ? [a, b] : [b, a];
            pairsByKey[key] = {
              aIdentifier: first.identifier,
              bIdentifier: second.identifier,
              aName: first.member.name,
              bName: second.member.name,
              aAvatarId: first.member.avatar_id,
              bAvatarId: second.member.avatar_id,
              matchesPlayed: 0, wins: 0, losses: 0, winRate: 0,
              totalPoints: 0, bestMatch: -Infinity, worstMatch: Infinity,
              totalBids: 0, correctBids: 0,
              recentResults: [],
              currentStreak: 0, streakType: null,
            };
          }

          const pair = pairsByKey[key];
          pair.matchesPlayed += 1;
          pair.totalPoints += teamScore;
          if (teamScore > pair.bestMatch) pair.bestMatch = teamScore;
          if (teamScore < pair.worstMatch) pair.worstMatch = teamScore;
          if (teamWon) pair.wins += 1; else pair.losses += 1;
          pair.recentResults.push(teamWon ? 'W' : 'L');

          // Bid accuracy across rounds — treat missing as 0
          for (const r of roundBreakdown) {
            if (!r.completed) continue;
            const rawBid = r.bids?.[team.team_id];
            const rawWon = r.tricks_won?.[team.team_id];
            const bid = rawBid ?? 0;
            const won = rawWon ?? 0;
            pair.totalBids += 1;
            if (bid === won) pair.correctBids += 1;
          }

          // Keep the most recent name/avatar (since matches are sorted DESC,
          // the FIRST iteration is newest — so we only set on first insert)
          // Already handled above.
        }
      }
    }
  }

  for (const p of Object.values(pairsByKey)) {
    p.winRate = p.matchesPlayed > 0 ? p.wins / p.matchesPlayed : 0;
    if (p.bestMatch === -Infinity) p.bestMatch = 0;
    if (p.worstMatch === Infinity) p.worstMatch = 0;
    if (p.recentResults.length > 0) {
      const latest = p.recentResults[0];
      p.streakType = latest === 'W' ? 'win' : 'loss';
      let streak = 0;
      for (const r of p.recentResults) {
        if (r === latest) streak += 1;
        else break;
      }
      p.currentStreak = streak;
    }
  }

  return pairsByKey;
}

// ──────────────────────────────────────────────────────────
// Match detail view (unchanged)
// ──────────────────────────────────────────────────────────
function MatchDetail({ match, onBack, onClose }) {
  const isTeam = match.mode === 'team';
  const ranked = buildRanking(match);
  const matchTopScore = ranked[0]?.total ?? 0;
  const winnersCount = ranked.filter((r) => r.total === matchTopScore).length;
  const completedRounds = (match.round_breakdown || []).filter((r) => r.completed);
  const mvp = computeMVPFromMatch(match);

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
          <button onClick={onBack} className="text-emerald-200/60 hover:text-emerald-100 transition text-sm">← Back</button>
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
              {' · '}{date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}{date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              {' · '}{minutesPlayed}m
            </p>
            <p className="text-[10px] text-emerald-200/40 uppercase tracking-wider mt-1">
              {isTeam ? 'Team' : 'Individual'} · {match.deck_count} deck · {match.player_count} players · {match.max_rounds} rounds
            </p>
          </div>

          {isTeam && mvp && (
            <div className="text-center mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-200/10 border border-amber-300/40">
                <Avatar avatarId={mvp.member.avatar_id} playerName={mvp.member.name} size="xs" />
                <span className="text-amber-200 font-medium text-xs">
                  🏅 MVP: {mvp.member.name}
                </span>
              </div>
              <p className="text-emerald-200/50 text-[10px] mt-1">
                {Math.round(mvp.bidAccuracy * 100)}% bid accuracy · {Math.round(mvp.contribution * 100)}% contribution
              </p>
            </div>
          )}

          <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4 mb-4">
            <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-3">Final ranking</p>
            <div className="space-y-2">
              {ranked.map((r, idx) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{
                    background: r.total === matchTopScore ? `${r.color}18` : '#14271f',
                    border: r.total === matchTopScore ? `1.5px solid ${r.color}80` : '1px solid rgba(34, 78, 60, 0.4)',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-serif italic w-6 text-center" style={{ color: r.total === matchTopScore ? r.color : '#86a294' }}>
                      {r.total === matchTopScore
                        ? '🥇'
                        : idx === winnersCount ? '🥈'
                        : idx === winnersCount + 1 ? '🥉'
                        : `${idx + 1}`}
                    </span>
                    {isTeam && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(r.avatars || []).map((a, i) => (<Avatar key={i} avatarId={a.id} playerName={a.name} size="xs" />))}
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
              <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-3">Round-by-round</p>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="text-emerald-200/40 uppercase tracking-wider">
                    <th className="text-left pb-2 pr-2">{isTeam ? 'Team' : 'Player'}</th>
                    {completedRounds.map((r) => (<th key={r.round_num} className="px-1.5 pb-2 text-center">R{r.round_num}</th>))}
                    <th className="pl-2 pb-2 text-right">Σ</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((rk) => (
                    <tr key={rk.id} className="border-t border-emerald-900/30">
                      <td className="py-2 pr-2 truncate" style={{ maxWidth: 110 }}>
                        <div className="flex items-center gap-1.5">
                          {isTeam && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: rk.color }} />}
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
                            <span style={{ color: s > 0 ? '#86efac' : s < 0 ? '#fca5a5' : '#86a294' }}>
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

function computeMVPFromMatch(match) {
  if (match.mode !== 'team') return null;
  const rounds = (match.round_breakdown || []).filter((r) => r.completed);
  if (rounds.length === 0) return null;

  // Per-team bid accuracy
  const teamBidStats = {};
  for (const r of rounds) {
    const bids = r.bids || {};      // team_id -> bid (team mode)
    const tw = r.tricks_won || {};  // team_id -> tricks won (team mode)
    for (const tId of Object.keys(bids)) {
      if (!teamBidStats[tId]) teamBidStats[tId] = { correct: 0, total: 0 };
      teamBidStats[tId].total += 1;
      if ((bids[tId] ?? 0) === (tw[tId] ?? 0)) teamBidStats[tId].correct += 1;
    }
  }

  // Per-player and per-team tricks
  const playerTricks = {};
  const teamTricks = {};
  for (const r of rounds) {
    for (const [pid, n] of Object.entries(r.player_tricks_won || {})) {
      playerTricks[pid] = (playerTricks[pid] ?? 0) + (n ?? 0);
    }
    for (const [tid, n] of Object.entries(r.tricks_won || {})) {
      teamTricks[tid] = (teamTricks[tid] ?? 0) + (n ?? 0);
    }
  }

  // Old matches may not have player_tricks_won — skip if missing
  if (Object.keys(playerTricks).length === 0) return null;

  // Find best MVP across team members
  const teamMembers = (match.team_snapshot || []).flatMap((t) =>
    (t.members || []).map((m) => ({ ...m, team_id: t.team_id }))
  );

  let mvp = null;
  let bestScore = -Infinity;
  for (const m of teamMembers) {
    const tId = m.team_id;
    if (!tId) continue;
    const stats = teamBidStats[tId];
    const bidAccuracy = stats && stats.total > 0 ? stats.correct / stats.total : 0;
    const tTotal = teamTricks[tId] ?? 0;
    const myTricks = playerTricks[m.player_id] ?? 0;
    const contribution = tTotal > 0 ? myTricks / tTotal : 0;
    const score = 0.6 * bidAccuracy + 0.4 * contribution;
    if (score > bestScore) {
      bestScore = score;
      mvp = { member: m, bidAccuracy, contribution, score };
    }
  }
  return mvp;
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