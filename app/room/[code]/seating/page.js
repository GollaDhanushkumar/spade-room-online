'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  findTiedGroups,
  isFullyResolved,
  assignSeatsAndTeams,
  rankChainKey,
  cardLabel,
} from '@/lib/game-logic';
import PlayingCard from '@/components/PlayingCard';
import CircularTable from '@/components/CircularTable';
import Avatar from '@/components/Avatar';
import { usePresence } from '@/lib/usePresence';
import { useHostPromotion } from '@/lib/useHostPromotion';
import { useRoomTheme } from '@/lib/useRoomTheme';
import VoicePanel from '@/components/VoicePanel';
import SoundToggle from '@/components/SoundToggle';
import { useSounds } from '@/lib/useSounds';
import { useVoiceChat } from '@/lib/useVoiceChat';
import CardBack from '@/components/CardBack';

export default function SeatingPage({ params }) {
  const { code } = use(params);
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [hostId, setHostId] = useState(null);
  const [game, setGame] = useState(null);
  const [room, setRoom] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [backing, setBacking] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [pickedIdx, setPickedIdx] = useState(null); // for animation
  const resolveInProgressRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(`spade-room-${code}`);
    if (!saved) {
      router.push(`/room/${code}`);
      return;
    }
    setMe(JSON.parse(saved));
  }, [code, router]);

  usePresence(me?.playerId);
  useHostPromotion(code, me?.playerId);
  useRoomTheme(room);
  const sounds = useSounds();

  const otherPlayerIds = seats
    .filter((s) => s.player_id !== me?.playerId)
    .map((s) => s.player_id);
  const voice = useVoiceChat({
    roomCode: code,
    myPlayerId: me?.playerId,
    otherPlayerIds,
  });

  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    async function refreshSeats(gameId) {
      const [{ data: seatRows }, { data: playerRows }] = await Promise.all([
        supabase.from('game_seats').select('*').eq('game_id', gameId),
        supabase.from('players').select('id, name, avatar_id').eq('room_code', code),
      ]);
      if (cancelled) return;
      const playerMap = new Map((playerRows || []).map((p) => [p.id, p]));
      const enriched = (seatRows || []).map((s) => {
        const player = playerMap.get(s.player_id);
        return {
          ...s,
          name: player?.name ?? '?',
          avatar_id: player?.avatar_id ?? null,
        };
      });
      setSeats(enriched);
    }

    async function load() {
      const { data: roomData } = await supabase
        .from('rooms').select('*').eq('code', code).single();
      if (!roomData) { if (!cancelled) router.push('/'); return; }
      if (roomData.status === 'lobby' || !roomData.current_game_id) {
        if (!cancelled) router.push(`/room/${code}`); return;
      }
      setRoom(roomData);
      const [{ data: g }, { data: hostRows }] = await Promise.all([
        supabase.from('games').select('*').eq('id', roomData.current_game_id).single(),
        supabase.from('players').select('id').eq('room_code', code).eq('is_host', true),
      ]);
      if (cancelled) return;
      setGame(g);
      setHostId(hostRows?.[0]?.id ?? null);
      await refreshSeats(roomData.current_game_id);

      if (g?.status === 'bidding' || g?.status === 'playing') {
        router.push(`/room/${code}/play`);
      }
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`seating-${code}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        (payload) => {
          if (cancelled) return;
          setRoom(payload.new);
          if (payload.new.status === 'lobby' || !payload.new.current_game_id) {
            router.push(`/room/${code}`);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games' },
        (payload) => {
          if (cancelled) return;
          if (payload.new.room_code !== code) return;
          setGame(payload.new);
          if (payload.new.status === 'bidding' || payload.new.status === 'playing') {
            router.push(`/room/${code}/play`);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_seats' },
        async () => {
          const { data: room } = await supabase
            .from('rooms').select('current_game_id').eq('code', code).single();
          if (!room?.current_game_id) return;
          await refreshSeats(room.current_game_id);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me, code, router]);

  // Compute these BEFORE the auto-resolve effect
  const iAmHost = me && hostId === me.playerId;
  const mySeat = seats.find((s) => s.player_id === me?.playerId);
  const tiedGroups = findTiedGroups(seats);
  const fullyResolved = isFullyResolved(seats, seats.length);

  async function handleBackToLobby() {
    if (!confirm('Cancel this game and return everyone to the lobby?')) return;
    setBacking(true);
    const gameId = game?.id;
    await supabase.from('rooms').update({ status: 'lobby', current_game_id: null }).eq('code', code);
    if (gameId) {
      await supabase.from('game_seats').delete().eq('game_id', gameId);
      await supabase.from('games').delete().eq('id', gameId);
    }
    router.push(`/room/${code}`);
  }

  async function handlePickFromDeck(pickIndex) {
    if (!game || drawing) return;
    setDrawing(true);
    setPickedIdx(pickIndex);

    // Give the rise+flip animation a moment to play before writing to DB
    await new Promise((r) => setTimeout(r, 850));

    const { data: g } = await supabase
      .from('games').select('shuffled_deck, draw_cursor').eq('id', game.id).single();
    if (!g) { setDrawing(false); setPickedIdx(null); return; }
    const absoluteIdx = (g.draw_cursor ?? 0) + pickIndex;
    const card = g.shuffled_deck[absoluteIdx];
    const newDeck = [...g.shuffled_deck];
    if (absoluteIdx !== g.draw_cursor) {
      [newDeck[g.draw_cursor], newDeck[absoluteIdx]] = [newDeck[absoluteIdx], newDeck[g.draw_cursor]];
    }
    const mySeatRow = seats.find((s) => s.player_id === me.playerId);
    const isTieBreaker = mySeatRow && mySeatRow.cards.length > 0;
    const newCards = isTieBreaker ? [...mySeatRow.cards, card] : [card];
    await supabase.from('games')
      .update({ shuffled_deck: newDeck, draw_cursor: g.draw_cursor + 1 })
      .eq('id', game.id);
    await supabase.from('game_seats')
      .update({ cards: newCards, has_drawn: true })
      .eq('game_id', game.id)
      .eq('player_id', me.playerId);
    setDrawing(false);
    setPickedIdx(null);
  }

  useEffect(() => {
    async function autoResolveTies() {
      if (!game || !hostId || game.draw_method !== 'auto') return;
      if (!iAmHost) return;
      if (seats.length === 0) return;
      if (seats.some((s) => !s.has_drawn)) return;
      const ties = findTiedGroups(seats);
      if (ties.length === 0) return;

      // LOCK: prevent concurrent invocations from racing
      if (resolveInProgressRef.current) return;
      resolveInProgressRef.current = true;

      try {
        const { data: g } = await supabase
          .from('games').select('shuffled_deck, draw_cursor').eq('id', game.id).single();
        if (!g) return;
        let cursor = g.draw_cursor ?? 0;
        const updates = [];
        for (const group of ties) {
          const maxLen = Math.max(...group.map((s) => s.cards.length));
          for (const seat of group) {
            if (seat.cards.length < maxLen ||
                group.some((other) =>
                  other !== seat &&
                  other.cards.length === maxLen &&
                  rankChainKey(other.cards) === rankChainKey(seat.cards))) {
              // Safety: bail if we'd run out of cards
              if (cursor >= g.shuffled_deck.length) {
                console.error('Tie-breaker ran out of cards');
                return;
              }
              const card = g.shuffled_deck[cursor++];
              updates.push({
                game_id: game.id,
                player_id: seat.player_id,
                cards: [...seat.cards, card],
              });
            }
          }
        }
        if (updates.length === 0) return;
        await new Promise((r) => setTimeout(r, 1500));
        await supabase.from('games').update({ draw_cursor: cursor }).eq('id', game.id);
        // Write all updates in parallel (faster, and atomic from React's view)
        await Promise.all(updates.map((u) =>
          supabase.from('game_seats')
            .update({ cards: u.cards })
            .eq('game_id', u.game_id)
            .eq('player_id', u.player_id)
        ));
      } finally {
        // Release lock so the NEXT seats update can trigger another resolve pass
        // (in case tie-breakers ALSO tied)
        resolveInProgressRef.current = false;
      }
    }
    autoResolveTies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats, game?.draw_method, iAmHost]);

  async function handleContinue() {
    if (!game || continuing) return;
    setContinuing(true);
    const enriched = seats.map((s) => ({ ...s }));
    assignSeatsAndTeams(enriched, game.mode);
    for (const s of enriched) {
      await supabase.from('game_seats')
        .update({
          seat_index: s.seat_index,
          team_id: s.team_id,
          team_palette_idx: s.team_palette_idx,
        })
        .eq('game_id', game.id)
        .eq('player_id', s.player_id);
    }
    await supabase.from('games').update({
      status: 'bidding',
      current_round: 1,
      leader_seat_index: 0,
    }).eq('id', game.id);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a1410] text-emerald-200">
        Loading...
      </main>
    );
  }

  const drawsStarted = seats.some((s) => s.cards && s.cards.length > 0);
  const canBack = iAmHost && (game?.draw_method === 'auto' ? game?.status === 'seating' : !drawsStarted);

  const tiedIds = new Set();
  tiedGroups.forEach((g) => g.forEach((s) => tiedIds.add(s.player_id)));

  let displaySeats = seats;
  if (fullyResolved) {
    displaySeats = [...seats].map((s) => ({ ...s }));
    assignSeatsAndTeams(displaySeats, game.mode);
  }

  const iNeedTieBreaker = (() => {
    if (!mySeat || !tiedIds.has(mySeat.player_id)) return false;
    const myGroup = tiedGroups.find((g) => g.some((s) => s.player_id === mySeat.player_id));
    if (!myGroup) return false;
    const maxLen = Math.max(...myGroup.map((s) => s.cards.length));
    if (mySeat.cards.length < maxLen) return true;
    const myKey = rankChainKey(mySeat.cards);
    return myGroup.some(
      (other) =>
        other.player_id !== mySeat.player_id &&
        other.cards.length === maxLen &&
        rankChainKey(other.cards) === myKey
    );
  })();

  const cardsRemaining = game ? (game.shuffled_deck?.length ?? 0) - (game.draw_cursor ?? 0) : 0;
  const canIPick = game?.draw_method === 'pick' && mySeat &&
    (mySeat.cards.length === 0 || iNeedTieBreaker);

  return (
    <main className="min-h-screen text-emerald-50 px-6 py-8"
      style={{ background: `linear-gradient(to bottom, var(--theme-bg-from, #0a1410), var(--theme-bg-to, #0f3d2c))` }}>
     <SoundToggle enabled={sounds.enabled} onToggle={sounds.toggle} className="fixed top-3 left-3 z-30" />
      <VoicePanel
        voice={voice}
        players={seats.map((s) => ({ player_id: s.player_id, name: s.name, avatar_id: s.avatar_id }))}
        mePlayerId={me?.playerId}
        className="top-3 left-16"
      />
      <div className="max-w-md mx-auto pt-12">

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-200/60">Room {code}</p>
            <h1 className="text-2xl font-serif italic text-amber-200">
              {fullyResolved ? 'Take your seats' : 'The draw'}
            </h1>
          </div>
          {canBack && (
            <button
              onClick={handleBackToLobby}
              disabled={backing}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-900/40 text-red-400/80 hover:bg-red-950/30 transition disabled:opacity-50"
            >
              {backing ? 'Returning...' : '← Back to Lobby'}
            </button>
          )}
        </div>

        {fullyResolved && (
          <>
            <p className="text-emerald-200/60 text-sm mb-5 text-center">
              {game.mode === 'team'
                ? 'Teams form by who sits across the circle.'
                : 'Sorted lowest card → highest. Seat 1 leads round 1.'}
            </p>

            <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4 mb-5">
              <CircularTable
                seats={displaySeats}
                mode={game.mode}
                mePlayerId={me?.playerId}
              />
            </div>

            {iAmHost ? (
              <button
                onClick={handleContinue}
                disabled={continuing}
                className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-50"
              >
                {continuing ? 'Starting...' : 'Continue to Bidding →'}
              </button>
            ) : (
              <div className="text-center text-emerald-200/40 text-sm py-3">
                Waiting for the host to continue...
              </div>
            )}
          </>
        )}

        {!fullyResolved && (
          <>
            {tiedGroups.length > 0 && (
              <div className="mb-4 p-4 rounded-xl bg-red-950/30 border border-red-900/50">
                <p className="text-red-300 text-sm font-medium mb-1">⚠ Tie-breaker needed</p>
                <p className="text-red-200/70 text-xs leading-relaxed">
                  {tiedGroups.map((g, i) => {
                    const names = g.map((s) => s.name).join(', ');
                    const sample = g[0]?.cards?.[g[0].cards.length - 1];
                    return (
                      <span key={i}>
                        {i > 0 && ' · '}
                        {names} matched on {cardLabel(sample)}
                      </span>
                    );
                  })}
                  . {game.draw_method === 'auto'
                    ? 'The app is dealing tie-breakers...'
                    : 'Tied players: pick another card from the deck.'}
                </p>
              </div>
            )}

            {game.draw_method === 'pick' && (
              <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-5 mb-5">
                <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-1">
                  {canIPick
                    ? (mySeat.cards.length === 0 ? 'Pick a card from the deck' : 'Pick a tie-breaker')
                    : (mySeat?.cards.length > 0 ? 'You picked your card' : 'Waiting your turn...')}
                </p>
                <p className="text-center text-xs text-emerald-200/40 mb-4 font-mono">
                  {cardsRemaining} cards left
                </p>
                <FannedDeck
                  count={cardsRemaining}
                  onPick={handlePickFromDeck}
                  disabled={!canIPick || drawing}
                  pickedIdx={pickedIdx}
                />

                {mySeat && mySeat.cards.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-emerald-900/40 flex flex-col items-center gap-2">
                    <p className="text-xs uppercase tracking-widest text-emerald-200/60">
                      Your card{mySeat.cards.length > 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      {mySeat.cards.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {idx > 0 && <span className="text-amber-300/60">+</span>}
                          <PlayingCard card={c} size="lg" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-widest text-emerald-200/60">Players</h3>
                <span className="text-xs text-emerald-200/40 font-mono">
                  {seats.filter((s) => s.has_drawn).length} / {seats.length}
                </span>
              </div>
              <div className="space-y-2">
                {seats.map((s) => {
                  const isMe = s.player_id === me?.playerId;
                  const tied = tiedIds.has(s.player_id);
                  return (
                    <div
                      key={s.player_id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                        tied
                          ? 'bg-red-950/30 border-red-900/40'
                          : s.has_drawn
                            ? 'bg-[#14271f] border-emerald-900/50'
                            : 'bg-amber-950/10 border-amber-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative">
                          <Avatar avatarId={s.avatar_id} playerName={s.name} size="sm" />
                          {voice.talkingPlayers.has(s.player_id) && (
                            <span
                              className="absolute inset-0 rounded-full pointer-events-none"
                              style={{
                                boxShadow: '0 0 0 2px #4ade80, 0 0 12px #4ade80',
                                animation: 'talkingPulse 0.8s ease-in-out infinite',
                              }}
                            />
                          )}
                        </div>
                        <span className="font-medium text-sm truncate">{s.name}</span>
                        {isMe && <span className="text-xs text-emerald-200/40">(you)</span>}
                        {tied && <span className="text-xs text-red-400">tied</span>}
                      </div>
                     <div className="flex items-center gap-1">
                        {!isMe && voice.micEnabled && (
                          <button
                            onClick={() => voice.togglePlayerMute(s.player_id)}
                            className={`text-xs px-2 py-1 rounded transition ${
                              voice.mutedPlayers.has(s.player_id)
                                ? 'text-red-400/80 hover:text-red-300'
                                : 'text-emerald-200/50 hover:text-emerald-200'
                            }`}
                            title={voice.mutedPlayers.has(s.player_id) ? `Unmute ${s.name}` : `Mute ${s.name}`}
                          >
                            {voice.mutedPlayers.has(s.player_id) ? '🔇' : '🔊'}
                          </button>
                        )}
                        {!s.has_drawn && (
                          <span className="text-xs text-amber-300/60 italic">picking...</span>
                        )}
                        {(s.cards || []).map((c, i) => (
                          <div key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-amber-300/60 text-[10px]">+</span>}
                            <PlayingCard card={c} size="sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────
// Fanned-out face-down deck — wider spread, taller arc, with
// satisfying rise+flip animation when a card is picked
// ──────────────────────────────────────────────────────────
function FannedDeck({ count, onPick, disabled, pickedIdx }) {
  if (count <= 0) return null;
  const maxDisplay = Math.min(count, 52);
  const cards = Array.from({ length: maxDisplay }, (_, i) => i);

  // Bigger, more theatrical fan
  const spreadWidth = 320;
  const cardW = 52;
  const cardH = 74;
  const gap = maxDisplay > 1 ? Math.min(11, (spreadWidth - cardW) / (maxDisplay - 1)) : 0;
  const totalWidth = cardW + gap * (maxDisplay - 1);
  const arcHeight = 26;
  const maxRotate = 18;

  return (
    <div
      className="relative w-full"
      style={{
        height: cardH + arcHeight + 90, // extra room for the card to rise into
        perspective: '1000px',
        overflow: 'visible',
      }}
    >
      <div
        className="relative mx-auto"
        style={{
          width: totalWidth,
          height: cardH + arcHeight,
          marginTop: 90, // push fan down so picked card has room above
        }}
      >
        {cards.map((i) => {
          const t = maxDisplay === 1 ? 0 : (i / (maxDisplay - 1)) * 2 - 1;
          const y = Math.abs(t) * arcHeight;
          const rotate = t * maxRotate;
          const x = i * gap;
          const isPicked = pickedIdx === i;
          const otherPicked = pickedIdx !== null && pickedIdx !== i;

          return (
            <button
              key={i}
              onClick={() => !disabled && onPick(i)}
              disabled={disabled || pickedIdx !== null}
              className={`absolute ${
                disabled || pickedIdx !== null
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer'
              } ${!disabled && pickedIdx === null ? 'fan-card-hover' : ''}`}
              style={{
                left: x,
                top: y,
                width: cardW,
                height: cardH,
                zIndex: isPicked ? 100 : i,
                transformOrigin: 'bottom center',
                // Animation: picked card rises + flips, others fade slightly
                transform: isPicked
                  ? `translate(${(totalWidth / 2 - x - cardW / 2)}px, -${cardH + 70}px) rotate(0deg) scale(1.35) rotateY(180deg)`
                  : `rotate(${rotate}deg)`,
                opacity: otherPicked ? 0.35 : 1,
                transition: pickedIdx !== null
                  ? 'transform 0.75s cubic-bezier(0.25, 1.2, 0.5, 1), opacity 0.4s ease'
                  : 'transform 0.18s ease',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Back of card (visible until mid-flip) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <CardBack width="100%" height="100%" />
              </div>
              {/* Face of card (placeholder gold sheen — actual card reveals in the slot below) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #f5d989 0%, #d4a857 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 28px rgba(245, 217, 137, 0.5)',
                  fontSize: 36,
                }}
              >
                ✦
              </div>
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .fan-card-hover {
          transition: transform 0.18s ease;
        }
        .fan-card-hover:hover {
          transform: translateY(-12px) rotate(0deg) scale(1.08) !important;
          z-index: 50 !important;
        }
        .fan-card-hover:active {
          transform: translateY(-8px) scale(0.96) !important;
        }
      `}</style>
    </div>
  );
}