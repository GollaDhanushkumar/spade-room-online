'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  buildDeck,
  shuffle,
  deckOptionsForPlayerCount,
  defaultDeckCountForPlayerCount,
  maxRoundsFor,
  uid,
} from '@/lib/game-logic';
import { usePresence } from '@/lib/usePresence';
import { useHostPromotion } from '@/lib/useHostPromotion';
import Avatar from '@/components/Avatar';
import RejoinPrompt from '@/components/RejoinPrompt';
import MatchHistoryModal from '@/components/MatchHistory';
import ThemePicker from '@/components/ThemePicker';
import { useRoomTheme } from '@/lib/useRoomTheme';
import ThemeAnimation from '@/components/ThemeAnimation';
import VoicePanel from '@/components/VoicePanel';
import { useVoiceChat } from '@/lib/useVoiceChat';
import InstallAppButton from '@/components/InstallAppButton';
import { notifyDhanush } from '@/lib/notify';
import { useEmojiReactions, EmojiPicker, FloatingEmoji } from '@/components/EmojiBurst';


export default function RoomPage({ params }) {
  const { code } = use(params);
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [meChecked, setMeChecked] = useState(false);
  const [needsRejoin, setNeedsRejoin] = useState(false);
  const [players, setPlayers] = useState([]);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Settings modal state
 const [mode, setMode] = useState('individual');
  const [deckCount, setDeckCount] = useState(1);
  const [drawMethod, setDrawMethod] = useState('auto');
  const [maxRounds, setMaxRounds] = useState(13);
  const [direction, setDirection] = useState('asc');
  const [starting, setStarting] = useState(false);

  usePresence(me?.playerId);
  useHostPromotion(code, me?.playerId);
  useRoomTheme(room);

  const otherPlayerIds = players
    .filter((p) => p.id !== me?.playerId)
    .map((p) => p.id);
  const voice = useVoiceChat({
    roomCode: code,
    myPlayerId: me?.playerId,
    otherPlayerIds,
  });
  const { activeReactions, sendReaction } = useEmojiReactions({ roomCode: code, myPlayerId: me?.playerId });
  const [emojiTarget, setEmojiTarget] = useState(null); // { playerId, name, rect }

  useEffect(() => {
    const saved = localStorage.getItem(`spade-room-${code}`);
    if (!saved) {
      setNeedsRejoin(true);
      setMeChecked(true);
      return;
    }
    let parsed;
    try { parsed = JSON.parse(saved); } catch {
      setNeedsRejoin(true);
      setMeChecked(true);
      return;
    }
    supabase
      .from('players')
      .select('id, name, avatar_id')
      .eq('id', parsed.playerId)
      .eq('room_code', code)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMe({ ...parsed, name: data.name, avatarId: data.avatar_id });
          setMeChecked(true);
        } else {
          localStorage.removeItem(`spade-room-${code}`);
          setNeedsRejoin(true);
          setMeChecked(true);
        }
      });
  }, [code]);

  function handleRejoin(playerData) {
    localStorage.setItem(`spade-room-${code}`, JSON.stringify(playerData));
    setMe(playerData);
    setNeedsRejoin(false);
  }

  function handleCancelRejoin() {
    router.push('/');
  }

  // Count past matches for this room (badge on history button)
  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function refreshCount() {
      const { count } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true });
      if (!cancelled) setMatchCount(count ?? 0);
    }
    refreshCount();

    const channel = supabase
      .channel(`matches-count-${code}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches' },
        () => refreshCount())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [code]);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    async function loadInitial() {
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms').select('*').eq('code', code).single();
      if (roomErr || !roomData) {
        if (!cancelled) { setError('Room not found.'); setLoading(false); }
        return;
      }

      const { data: playerData, error: playerErr } = await supabase
        .from('players').select('*').eq('room_code', code)
        .order('joined_at', { ascending: true });
      if (playerErr) {
        if (!cancelled) { setError('Could not load players.'); setLoading(false); }
        return;
      }

      const stillInRoom = (playerData || []).some((p) => p.id === me.playerId);
      if (!cancelled && !stillInRoom) {
        localStorage.removeItem(`spade-room-${code}`);
        alert('You were removed from the room.');
        router.push('/');
        return;
      }

      if (!cancelled) {
        setRoom(roomData);
        setPlayers(playerData || []);
        setLoading(false);
        if (roomData.status === 'seating' && roomData.current_game_id) {
          router.push(`/room/${code}/seating`);
        } else if (roomData.status !== 'lobby' && roomData.current_game_id) {
          router.push(`/room/${code}/play`);
        }
      }
    }

    loadInitial();

    const channel = supabase
      .channel(`room-${code}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${code}` },
        () => {
          supabase
            .from('players').select('*').eq('room_code', code)
            .order('joined_at', { ascending: true })
            .then(({ data }) => {
              if (cancelled || !data) return;
              const stillInRoom = data.some((p) => p.id === me.playerId);
              if (!stillInRoom) {
                localStorage.removeItem(`spade-room-${code}`);
                alert('You were removed from the room.');
                router.push('/');
                return;
              }
              setPlayers(data);
            });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        (payload) => {
          if (cancelled) return;
          setRoom(payload.new);
          if (payload.new.status === 'seating' && payload.new.current_game_id) {
            router.push(`/room/${code}/seating`);
          } else if (payload.new.status !== 'lobby' && payload.new.current_game_id) {
            router.push(`/room/${code}/play`);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me, code, router]);

  useEffect(() => {
    const count = players.filter((p) => !p.is_spectator).length;
    if (count < 2) return;
    const options = deckOptionsForPlayerCount(count);
    if (!options.includes(deckCount)) {
      const def = defaultDeckCountForPlayerCount(count);
      setDeckCount(def);
      setMaxRounds(maxRoundsFor(count, def));
    } else {
      setMaxRounds((prev) => Math.min(prev, maxRoundsFor(count, deckCount)));
    }
    if (![4, 6, 8].includes(count) && mode === 'team') {
      setMode('individual');
    }
  }, [players, deckCount, mode]);

  async function handleLeave() {
    if (!me) return;
    await supabase.from('players').delete().eq('id', me.playerId);
    localStorage.removeItem(`spade-room-${code}`);
    router.push('/');
  }

  async function handleKick(playerId) {
    if (!confirm('Kick this player?')) return;
    await supabase.from('players').delete().eq('id', playerId);
    const { data } = await supabase.from('players').select('*')
      .eq('room_code', code).order('joined_at', { ascending: true });
    if (data) setPlayers(data);
  }

  async function handleTransferHost(targetPlayerId, targetName) {
    if (!iAmHost) return;
    if (!confirm(`Make ${targetName} the host? You'll become a regular player.`)) return;
    // Demote me, promote them, update room pointer
    await supabase.from('players').update({ is_host: false }).eq('id', me.playerId);
    await supabase.from('players').update({ is_host: true }).eq('id', targetPlayerId);
    await supabase.from('rooms').update({ host_player_id: targetPlayerId }).eq('code', code);
  }

  async function handleCopyCode() {
    try { await navigator.clipboard.writeText(code); } catch {}
  }

  async function handleConfirmStart() {
    setStarting(true);
    const activePlayers = players.filter((p) => !p.is_spectator);
    const gameId = uid();
    const seatingDeck = shuffle(buildDeck(deckCount));

    const { error: gameErr } = await supabase.from('games').insert({
      id: gameId,
      room_code: code,
      mode,
      deck_count: deckCount,
      max_rounds: maxRounds,
      draw_method: drawMethod,
      direction,
      status: 'seating',
      current_round: 0,
      shuffled_deck: seatingDeck,
      draw_cursor: drawMethod === 'auto' ? activePlayers.length : 0,
    });
    if (gameErr) {
      setError('Could not create game: ' + gameErr.message);
      setStarting(false);
      return;
    }

    const seatRows = activePlayers.map((p) => ({
      game_id: gameId,
      player_id: p.id,
      cards: [],
      has_drawn: false,
      is_tied: false,
    }));
    const { error: seatErr } = await supabase.from('game_seats').insert(seatRows);
    if (seatErr) {
      setError('Could not create seats: ' + seatErr.message);
      setStarting(false);
      return;
    }

    if (drawMethod === 'auto') {
      const updates = activePlayers.map((p, idx) => ({
        game_id: gameId,
        player_id: p.id,
        cards: [seatingDeck[idx]],
        has_drawn: true,
        is_tied: false,
      }));
      await supabase.from('game_seats').upsert(updates);
      await supabase.from('games').update({ draw_cursor: activePlayers.length }).eq('id', gameId);
    }

    await supabase.from('rooms').update({
      status: 'seating',
      current_game_id: gameId,
    }).eq('code', code);

    // Private notification to Dhanush — fire-and-forget, don't await
    const hostPlayer = players.find((p) => p.id === me?.playerId);
    notifyDhanush(
      `${hostPlayer?.name || 'Someone'} started a match in room ${code} (${activePlayers.length} players, ${mode === 'team' ? 'teams' : 'individual'})`,
      {
        title: 'New match starting',
        tags: 'game_die,spades',
        priority: 'high',
      }
    );
  }

  if (!meChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a1410] text-emerald-200">
        Loading...
      </main>
    );
  }

  if (needsRejoin) {
    return <RejoinPrompt code={code} onRejoin={handleRejoin} onCancel={handleCancelRejoin} />;
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a1410] text-emerald-200">
        Loading...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a1410] text-emerald-50 gap-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.push('/')}
          className="px-6 py-3 rounded-xl bg-amber-300 text-[#07100c] font-semibold">
          Go home
        </button>
      </main>
    );
  }

  const iAmHost = me && players.some((p) => p.id === me.playerId && p.is_host);
  const playerCount = players.filter((p) => !p.is_spectator).length;
  const teamAvailable = [4, 6, 8].includes(playerCount);
  const deckOptions = playerCount >= 2 ? deckOptionsForPlayerCount(playerCount) : [1];
  const maxRoundsAvailable = playerCount >= 2 ? maxRoundsFor(playerCount, deckCount) : 13;

  return (
    <main className="min-h-screen text-emerald-50 px-6 py-10 relative"
      style={{ background: `linear-gradient(to bottom, var(--theme-bg-from, #0a1410), var(--theme-bg-to, #0f3d2c))` }}>
        <ThemeAnimation room={room} />
       <VoicePanel
         voice={voice}
         players={players.map((p) => ({ player_id: p.id, name: p.name, avatar_id: p.avatar_id }))}
         mePlayerId={me?.playerId}
         className="top-3 left-16"
       />

      {/* Floating action buttons — top right */}
      <div className="fixed top-3 right-3 z-30 flex items-center gap-2">
        {iAmHost && room?.status === 'lobby' && (
          <button
            onClick={() => setShowThemePicker(true)}
            className="flex items-center gap-1.5 px-3 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition"
            title="Customize room"
            aria-label="Customize room"
          >
            <span className="text-lg">🎨</span>
            <span className="text-xs text-emerald-200/80 font-medium">Theme</span>
          </button>
        )}

<button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 px-3 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition"
          title="Match history & rankings"
          aria-label="Match history and rankings"
        >
          <span className="text-lg">📜</span>
          <span className="text-xs text-emerald-200/80 font-medium">History</span>
          {matchCount > 0 && (
            <span className="ml-1 text-[10px] bg-amber-300 text-[#07100c] rounded-full px-1.5 py-0.5 font-bold">
              {matchCount}
            </span>
          )}
        </button>
      </div>

      <div className="max-w-md mx-auto">

        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-2">Room Code</p>
          <button onClick={handleCopyCode}
            className="text-5xl font-mono font-bold text-amber-200 tracking-widest hover:text-amber-100 transition"
            title="Click to copy">
            {code}
          </button>
          <p className="text-emerald-200/40 text-xs mt-2">
            Tap the code to copy. Share with your friends.
          </p>
        </div>

        <div className="bg-[#0f1d18] border border-emerald-900 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-widest text-emerald-200/60">Players</h2>
            <span className="text-xs text-emerald-200/40 font-mono">
              {playerCount} in the room
            </span>
          </div>
          <ul className="space-y-2">
            {players.map((p) => {
              const isMe = me && p.id === me.playerId;
              return (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#14271f] border border-emerald-900/50">
                 <div className="flex items-center gap-3 min-w-0">
                   <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setEmojiTarget({ playerId: p.id, name: p.name, rect });
                      }}
                      className="relative cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                      title="Send a reaction"
                    >
                      <Avatar avatarId={p.avatar_id} playerName={p.name} size="sm" />
                      {voice.talkingPlayers.has(p.id) && (
                        <span
                          className="absolute inset-0 rounded-full pointer-events-none"
                          style={{
                            boxShadow: '0 0 0 2px #4ade80, 0 0 12px #4ade80',
                            animation: 'talkingPulse 0.8s ease-in-out infinite',
                          }}
                        />
                      )}
                      <FloatingEmoji emoji={activeReactions[p.id]?.emoji} />
                    </button>
                    <span className="font-medium truncate">
                      {p.name}
                      {isMe && <span className="text-emerald-200/40 text-xs ml-2">(you)</span>}
                    </span>
                    {p.is_host && <span className="text-amber-300 text-xs">👑 host</span>}
                    {p.is_spectator && <span className="text-emerald-200/40 text-xs">👁 spectator</span>}
                  </div>

                  {!isMe && voice.micEnabled && (
                    <button
                      onClick={() => voice.togglePlayerMute(p.id)}
                      className={`text-xs px-2 py-1 rounded transition ${
                        voice.mutedPlayers.has(p.id)
                          ? 'text-red-400/80 hover:text-red-300'
                          : 'text-emerald-200/50 hover:text-emerald-200'
                      }`}
                      title={voice.mutedPlayers.has(p.id) ? `Unmute ${p.name}` : `Mute ${p.name}`}
                    >
                      {voice.mutedPlayers.has(p.id) ? '🔇' : '🔊'}
                    </button>
                  )}
                  {iAmHost && !isMe && !p.is_spectator && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleTransferHost(p.id, p.name)}
                        className="text-amber-300/70 hover:text-amber-300 text-xs px-2 py-1 rounded transition"
                        title="Make this player the host">
                        👑
                      </button>
                      <button onClick={() => handleKick(p.id)}
                        className="text-red-400/70 hover:text-red-400 text-xs px-2 py-1 rounded transition">
                        kick
                      </button>
                    </div>
                  )}
                  {iAmHost && !isMe && p.is_spectator && (
                    <button onClick={() => handleKick(p.id)}
                      className="text-red-400/70 hover:text-red-400 text-xs px-2 py-1 rounded transition">
                      kick
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-3">
          {iAmHost && (
            <button
              disabled={playerCount < 2}
              onClick={() => setShowSettings(true)}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-40 disabled:cursor-not-allowed">
              {playerCount < 2
                ? 'Waiting for more players...'
                : `Start Game (${playerCount} players)`}
            </button>
          )}

          {!iAmHost && (
            <div className="text-center text-emerald-200/40 text-sm py-3">
              Waiting for the host to start the game...
            </div>
          )}

          <InstallAppButton className="w-full justify-center" />

          <button onClick={() => setConfirmLeave(true)}
            className="w-full py-3 rounded-xl border border-red-900/40 text-red-400/80 hover:bg-red-950/30 transition text-sm">
            Leave Room
          </button>
        </div>
      </div>

     {/* Theme picker modal */}
      {showThemePicker && (
        <ThemePicker
          code={code}
          currentTheme={room?.theme}
          currentCardBack={room?.card_back}
          animationsEnabled={room?.animations_enabled}
          onClose={() => setShowThemePicker(false)}
        />
      )}

        {/* History modal — visible to all players, hosts can manage rankings */}
      {showHistory && (
        <MatchHistoryModal code={code} onClose={() => setShowHistory(false)} iAmHost={iAmHost} />
      )}

      {/* Leave confirmation */}
      {confirmLeave && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-5"
          onClick={() => setConfirmLeave(false)}>
          <div className="max-w-sm w-full bg-[#0f1d18] border border-emerald-900 rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-serif italic text-amber-200 mb-2">Leave the room?</h3>
            <p className="text-emerald-200/60 text-sm mb-5">
              {iAmHost
                ? 'You\'re the host. If you leave, another player will become host automatically.'
                : 'You can rejoin later as long as the room is still open.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmLeave(false)}
                className="flex-1 py-3 rounded-xl border border-emerald-900 text-emerald-200/70 hover:bg-emerald-950/40 transition text-sm">
                Cancel
              </button>
              <button onClick={handleLeave}
                className="flex-1 py-3 rounded-xl bg-red-900/40 border border-red-900 text-red-300 hover:bg-red-900/60 transition text-sm">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {emojiTarget && (
        <EmojiPicker
          targetPlayerId={emojiTarget.playerId}
          targetName={emojiTarget.name}
          anchorRect={emojiTarget.rect}
          onPick={(emoji) => sendReaction(emojiTarget.playerId, emoji)}
          onClose={() => setEmojiTarget(null)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && iAmHost && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-5"
          onClick={() => !starting && setShowSettings(false)}>
          <div className="max-w-md w-full bg-[#0f1d18] border border-emerald-900 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-serif italic text-amber-200 mb-1">Game Setup</h2>
            <p className="text-emerald-200/50 text-sm mb-6">Configure before dealing cards.</p>

            <div className="mb-5">
              <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">Mode</label>
              <div className="flex gap-2">
                <button onClick={() => setMode('individual')}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition ${
                    mode === 'individual'
                      ? 'bg-amber-200/10 border-amber-300 text-amber-200'
                      : 'bg-[#14271f] border-emerald-900 text-emerald-200/70 hover:border-emerald-700'
                  }`}>
                  Individual
                </button>
                <button onClick={() => setMode('team')} disabled={!teamAvailable}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition disabled:opacity-30 disabled:cursor-not-allowed ${
                    mode === 'team'
                      ? 'bg-amber-200/10 border-amber-300 text-amber-200'
                      : 'bg-[#14271f] border-emerald-900 text-emerald-200/70 hover:border-emerald-700'
                  }`}>
                  Teams
                </button>
              </div>
              {!teamAvailable && (
                <p className="text-xs text-emerald-200/40 mt-2">
                  Team mode needs 4, 6, or 8 players.
                </p>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">Decks</label>
              <div className="flex gap-2">
                {[1, 2].map((n) => (
                  <button key={n} onClick={() => {
                    if (!deckOptions.includes(n)) return;
                    setDeckCount(n);
                    setMaxRounds(maxRoundsFor(playerCount, n));
                  }} disabled={!deckOptions.includes(n)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border transition disabled:opacity-30 disabled:cursor-not-allowed ${
                      deckCount === n
                        ? 'bg-amber-200/10 border-amber-300 text-amber-200'
                        : 'bg-[#14271f] border-emerald-900 text-emerald-200/70 hover:border-emerald-700'
                    }`}>
                    {n} {n === 1 ? 'deck' : 'decks'} ({n * 52} cards)
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">
                Max rounds <span className="text-emerald-200/40">(up to {maxRoundsAvailable})</span>
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={maxRoundsAvailable}
                  value={maxRounds} onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                  className="flex-1 accent-amber-300" />
                <span className="text-2xl font-serif italic text-amber-200 w-12 text-center">
                  {maxRounds}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">Round Direction</label>
              <div className="flex gap-2">
                <button onClick={() => setDirection('asc')}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition ${
                    direction === 'asc'
                      ? 'bg-amber-200/10 border-amber-300 text-amber-200'
                      : 'bg-[#14271f] border-emerald-900 text-emerald-200/70 hover:border-emerald-700'
                  }`}>
                  🔼 Ascending
                </button>
                <button onClick={() => setDirection('desc')}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition ${
                    direction === 'desc'
                      ? 'bg-amber-200/10 border-amber-300 text-amber-200'
                      : 'bg-[#14271f] border-emerald-900 text-emerald-200/70 hover:border-emerald-700'
                  }`}>
                  🔽 Descending
                </button>
              </div>
              <p className="text-xs text-emerald-200/40 mt-2">
                {direction === 'asc'
                  ? `R1 = 1 card · R${maxRounds} = ${maxRounds} cards`
                  : `R1 = ${maxRounds} cards · R${maxRounds} = 1 card`}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">Seating Draw</label>
              <div className="space-y-2">
                <button onClick={() => setDrawMethod('auto')}
                  className={`w-full p-4 rounded-xl text-left border transition ${
                    drawMethod === 'auto'
                      ? 'bg-amber-200/10 border-amber-300'
                      : 'bg-[#14271f] border-emerald-900 hover:border-emerald-700'
                  }`}>
                  <div className={`font-medium ${drawMethod === 'auto' ? 'text-amber-200' : 'text-emerald-100'}`}>
                    Auto-deal
                  </div>
                  <div className="text-xs text-emerald-200/50 mt-1">
                    App reveals everyone's card at once.
                  </div>
                </button>
                <button onClick={() => setDrawMethod('pick')}
                  className={`w-full p-4 rounded-xl text-left border transition ${
                    drawMethod === 'pick'
                      ? 'bg-amber-200/10 border-amber-300'
                      : 'bg-[#14271f] border-emerald-900 hover:border-emerald-700'
                  }`}>
                  <div className={`font-medium ${drawMethod === 'pick' ? 'text-amber-200' : 'text-emerald-100'}`}>
                    Pick your own
                  </div>
                  <div className="text-xs text-emerald-200/50 mt-1">
                    Each player taps a face-down deck to flip their card.
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowSettings(false)} disabled={starting}
                className="flex-1 py-3 rounded-xl border border-emerald-900 text-emerald-200/70 hover:bg-emerald-950/40 transition text-sm">
                Cancel
              </button>
              <button onClick={handleConfirmStart} disabled={starting}
                className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-50">
                {starting ? 'Dealing...' : 'Lock settings & deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}