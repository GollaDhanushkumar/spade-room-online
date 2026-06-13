'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  bidStarterSeatFor,
  teamBiddingOrder,
  individualBiddingOrder,
  groupSeatsByTeam,
  dealRound,
  TEAM_COLORS,
  legalCardIndices,
  determineTrickWinner,
  calcScore,
  cardLabel,
  cardsForRound,
} from '@/lib/game-logic';
import PlayingCard from '@/components/PlayingCard';
import MatchOverlay from '@/components/MatchOverlay';
import TricksWonModal from '@/components/TricksWonModal';
import VictoryEgg from '@/components/VictoryEgg';
import Avatar from '@/components/Avatar';
import AnimatedScore from '@/components/AnimatedScore';
import VoicePanel from '@/components/VoicePanel';
import { useVoiceChat } from '@/lib/useVoiceChat';
import SpectatorBadge from '@/components/SpectatorBadge';
import SpectatorWelcome from '@/components/SpectatorWelcome';
import { useSounds } from '@/lib/useSounds';
import { usePresence, useStalePlayers } from '@/lib/usePresence';
import { useHostPromotion } from '@/lib/useHostPromotion';
import { useRoomTheme } from '@/lib/useRoomTheme';
import CardBack from '@/components/CardBack';

// Sort a hand: by suit (Spades, Hearts, Clubs, Diamonds), then by rank low to high
const SUIT_ORDER = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
function sortHand(cards) {
  if (!Array.isArray(cards)) return cards;
  return [...cards].sort((a, b) => {
    const suitDiff = (SUIT_ORDER[a.suit] ?? 99) - (SUIT_ORDER[b.suit] ?? 99);
    if (suitDiff !== 0) return suitDiff;
    return (a.value ?? 0) - (b.value ?? 0);
  });
}

export default function PlayPage({ params }) {
  const { code } = use(params);
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [hostId, setHostId] = useState(null);
  const [game, setGame] = useState(null);
  const [room, setRoom] = useState(null);
  const [seats, setSeats] = useState([]);
  const [allHands, setAllHands] = useState([]);
  const [myHand, setMyHand] = useState([]);
  const [round, setRound] = useState(null);
  const [allRounds, setAllRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [revealedWinner, setRevealedWinner] = useState(null);
  const [playingAgain, setPlayingAgain] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [iAmSpectator, setIAmSpectator] = useState(false);
  const [showSpectatorWelcome, setShowSpectatorWelcome] = useState(false);
  const [showTricksWon, setShowTricksWon] = useState(false);
  const [showVictoryEgg, setShowVictoryEgg] = useState(false);
  const bidDebounceRef = useRef(null);
  const localBidRef = useRef(null); // tracks my optimistic bid value, ignores stale realtime updates
  

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
  const stalePlayerIds = useStalePlayers(code);
  const sounds = useSounds();
  useRoomTheme(room);

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

    async function loadEverything() {
      const { data: roomData } = await supabase
        .from('rooms').select('*').eq('code', code).single();
      if (!roomData?.current_game_id) {
        if (!cancelled) router.push(`/room/${code}`);
        return;
      }
      setRoom(roomData);
      const gameId = roomData.current_game_id;

      const [
        { data: g },
        { data: hostRows },
        { data: seatRows },
        { data: playerRows },
        { data: myPlayerRow },
      ] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase.from('players').select('id').eq('room_code', code).eq('is_host', true),
        supabase.from('game_seats').select('*').eq('game_id', gameId),
        supabase.from('players').select('id, name, avatar_id').eq('room_code', code),
        supabase.from('players').select('is_spectator').eq('id', me.playerId).maybeSingle(),
      ]);

      if (cancelled) return;

      const playerMap = new Map((playerRows || []).map((p) => [p.id, p]));
      const enrichedSeats = (seatRows || []).map((s) => {
        const player = playerMap.get(s.player_id);
        return {
          ...s,
          name: player?.name ?? '?',
          avatar_id: player?.avatar_id ?? null,
        };
      });

      const amSpectator = !!myPlayerRow?.is_spectator;
      const wasSpectatorBefore = sessionStorage.getItem(`spade-spectator-acknowledged-${code}`);
      if (amSpectator && !wasSpectatorBefore) {
        setShowSpectatorWelcome(true);
      }
      setIAmSpectator(amSpectator);
      setGame(g);
      setHostId(hostRows?.[0]?.id ?? null);
      setSeats(enrichedSeats);

      if (g && g.current_round >= 1) {
        await refreshHandAndRound(gameId, g.current_round, me.playerId);
        await refreshAllRounds(gameId);
        await refreshAllHands(gameId, g.current_round);
      }
      setLoading(false);
    }

    async function refreshHandAndRound(gameId, roundNum, playerId) {
      const [{ data: handRow }, { data: roundRow }] = await Promise.all([
        supabase.from('hands').select('cards')
          .eq('game_id', gameId).eq('player_id', playerId).eq('round_num', roundNum)
          .maybeSingle(),
        supabase.from('rounds').select('*')
          .eq('game_id', gameId).eq('round_num', roundNum)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setMyHand(handRow?.cards || []);
      setRound(roundRow || null);
    }

    async function refreshAllRounds(gameId) {
      const { data } = await supabase.from('rounds').select('*')
        .eq('game_id', gameId).order('round_num', { ascending: true });
      if (!cancelled) setAllRounds(data || []);
    }

    async function refreshAllHands(gameId, roundNum) {
      const { data } = await supabase.from('hands').select('player_id, cards')
        .eq('game_id', gameId).eq('round_num', roundNum);
      if (!cancelled) setAllHands(data || []);
    }

    loadEverything();

   const channel = supabase
      .channel(`play-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' },
        async (payload) => {
          if (cancelled || payload.new.room_code !== code) return;
          setGame(payload.new);
          if (payload.new.current_round >= 1) {
            await refreshHandAndRound(payload.new.id, payload.new.current_round, me.playerId);
            await refreshAllRounds(payload.new.id);
            await refreshAllHands(payload.new.id, payload.new.current_round);
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' },
        async () => {
          const { data: room } = await supabase.from('rooms').select('current_game_id').eq('code', code).single();
          if (!room?.current_game_id) return;
          const { data: g } = await supabase.from('games').select('current_round').eq('id', room.current_game_id).single();
          if (!g) return;
          // Skip refresh if I just made a local bid change (avoid stale-update flicker)
          if (localBidRef.current && Date.now() - localBidRef.current.timestamp < 600) {
            await refreshAllRounds(room.current_game_id);
            return;
          }
          await refreshHandAndRound(room.current_game_id, g.current_round, me.playerId);
          await refreshAllRounds(room.current_game_id);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hands' },
        async () => {
          const { data: room } = await supabase.from('rooms').select('current_game_id').eq('code', code).single();
          if (!room?.current_game_id) return;
          const { data: g } = await supabase.from('games').select('current_round').eq('id', room.current_game_id).single();
          if (!g) return;
          await refreshHandAndRound(room.current_game_id, g.current_round, me.playerId);
          await refreshAllHands(room.current_game_id, g.current_round);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        (payload) => {
          if (cancelled) return;
          setRoom(payload.new);
          if (payload.new.status === 'lobby' || !payload.new.current_game_id) {
            router.push(`/room/${code}`);
          }
        })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [me, code, router]);


  useEffect(() => {
    async function dealIfNeeded() {
      if (!game || !me || !hostId) return;
      if (game.status !== 'bidding') return;
      if (me.playerId !== hostId) return;
      if (game.current_round < 1) return;

      const { data: existing } = await supabase.from('hands').select('player_id')
        .eq('game_id', game.id).eq('round_num', game.current_round);
      if (existing && existing.length > 0) return;

      const seatedPlayers = seats.filter((s) => s.seat_index != null);
      if (seatedPlayers.length === 0) return;

      const dealt = dealRound(seatedPlayers, cardsThisRound, game.deck_count);
      const handRows = seatedPlayers.map((s) => ({
        game_id: game.id,
        player_id: s.player_id,
        round_num: game.current_round,
        cards: dealt[s.player_id],
      }));
      await supabase.from('hands').insert(handRows);

      const N = seatedPlayers.length;
      const starterSeat = bidStarterSeatFor(game.current_round, N);
      await supabase.from('rounds').upsert({
        game_id: game.id,
        round_num: game.current_round,
        bid_starter_seat_index: starterSeat,
        leader_seat_index: starterSeat,
        bids: {}, team_bids: {}, bids_locked: {},
        tricks_won: {}, team_tricks_won: {}, scores: {}, team_scores: {},
        trick_history: [], current_trick: [],
        current_player_seat_index: starterSeat,
      });
    }
    dealIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status, game?.current_round, hostId, me?.playerId, seats]);

  const iAmHost = me && hostId === me.playerId;
  const mySeat = seats.find((s) => s.player_id === me?.playerId);
  const myTeam = mySeat?.team_id ?? null;
  const seatedPlayers = seats.filter((s) => s.seat_index != null);
  const N = seatedPlayers.length;
  const isTeamMode = game?.mode === 'team';
  const direction = game?.direction ?? 'asc';
  const cardsThisRound = game ? cardsForRound(game.current_round, game.max_rounds, direction) : 0;

  const starterSeatIdx = round?.bid_starter_seat_index ?? (N ? bidStarterSeatFor(game?.current_round ?? 1, N) : 0);
  const teamOrder = isTeamMode ? teamBiddingOrder(seatedPlayers, starterSeatIdx) : [];
  const teamsByTeam = groupSeatsByTeam(seatedPlayers);
  const teamBids = round?.team_bids ?? {};
  const bids = round?.bids ?? {};
  const bidsLocked = round?.bids_locked ?? {};

  let activeTeamId = null;
  if (isTeamMode && teamOrder.length > 0) {
    for (const tId of teamOrder) {
      if (!bidsLocked[tId]) { activeTeamId = tId; break; }
    }
  }
  const allTeamsLocked = isTeamMode && teamOrder.length > 0 &&
    teamOrder.every((tId) => bidsLocked[tId]);
  const itsMyTeamsTurn = isTeamMode && myTeam && activeTeamId === myTeam;

  const indivOrderSeatIdxs = !isTeamMode && N ? individualBiddingOrder(seatedPlayers, starterSeatIdx) : [];
  const indivOrder = indivOrderSeatIdxs
    .map((sIdx) => seatedPlayers.find((s) => s.seat_index === sIdx)?.player_id)
    .filter(Boolean);
  let activeIndivPlayerId = null;
  if (!isTeamMode && indivOrder.length > 0) {
    for (const pid of indivOrder) {
      if (!bidsLocked[pid]) { activeIndivPlayerId = pid; break; }
    }
  }
  const allIndivLocked = !isTeamMode && indivOrder.length > 0 &&
    indivOrder.every((pid) => bidsLocked[pid]);
  const itsMyBidTurn = !isTeamMode && activeIndivPlayerId === me?.playerId;

  const allBidsLocked = isTeamMode ? allTeamsLocked : allIndivLocked;

  const currentTrick = round?.current_trick ?? [];
  const currentPlayerSeatIdx = round?.current_player_seat_index ?? 0;
  const mySeatIdx = mySeat?.seat_index ?? -1;
  const itsMyTurn = game?.status === 'playing' && currentPlayerSeatIdx === mySeatIdx && currentTrick.length < N;
  const legalIndices = legalCardIndices(myHand, currentTrick);

  const roundComplete = !!round?.completed_at;
  const scoresWritten =
    (round?.team_scores && Object.keys(round.team_scores).length > 0) ||
    (round?.scores && Object.keys(round.scores).length > 0);
  const showRecap = game?.status === 'playing' && roundComplete && scoresWritten;
  const isLastRound = game && game.current_round >= game.max_rounds;

async function handleAdjustIndivBid(delta) {
    if (!round || !itsMyBidTurn) return;
    const maxBid = cardsThisRound;
    const current = bids[me.playerId] ?? 0;
    const next = Math.max(0, Math.min(maxBid, current + delta));
    if (next === current) return;
    const newBids = { ...bids, [me.playerId]: next };

    // Track local value so we can ignore stale incoming realtime updates
    localBidRef.current = { type: 'indiv', playerId: me.playerId, value: next, timestamp: Date.now() };

    // Update UI instantly
    setRound((prev) => prev ? { ...prev, bids: newBids } : prev);

    // Debounce the DB write
    if (bidDebounceRef.current) clearTimeout(bidDebounceRef.current);
    bidDebounceRef.current = setTimeout(() => {
      supabase.from('rounds').update({ bids: newBids })
        .eq('game_id', game.id).eq('round_num', game.current_round)
        .then(({ error }) => {
          if (error) console.error('Failed to sync bid:', error);
          setTimeout(() => { localBidRef.current = null; }, 500);
        });
    }, 150);
  }

  async function handleAdjustTeamBid(delta) {
    if (!round || !itsMyTeamsTurn) return;
    const maxBid = cardsThisRound;
    const current = teamBids[myTeam] ?? 0;
    const next = Math.max(0, Math.min(maxBid, current + delta));
    if (next === current) return;
    const newTeamBids = { ...teamBids, [myTeam]: next };

    // Track local value
    localBidRef.current = { type: 'team', teamId: myTeam, value: next, timestamp: Date.now() };

    setRound((prev) => prev ? { ...prev, team_bids: newTeamBids } : prev);

    if (bidDebounceRef.current) clearTimeout(bidDebounceRef.current);
    bidDebounceRef.current = setTimeout(() => {
      supabase.from('rounds').update({ team_bids: newTeamBids })
        .eq('game_id', game.id).eq('round_num', game.current_round)
        .then(({ error }) => {
          if (error) console.error('Failed to sync bid:', error);
          setTimeout(() => { localBidRef.current = null; }, 500);
        });
    }, 150);
  }
  async function handleLockTeamBid() {
    if (!round || !itsMyTeamsTurn || locking) return;
    if (bidDebounceRef.current) clearTimeout(bidDebounceRef.current);
    setLocking(true);
    const current = teamBids[myTeam] ?? 0;
    const newLocked = { ...bidsLocked, [myTeam]: true };
    const newTeamBids = { ...teamBids, [myTeam]: current };
    await supabase.from('rounds')
      .update({ team_bids: newTeamBids, bids_locked: newLocked })
      .eq('game_id', game.id).eq('round_num', game.current_round);
    setLocking(false);
  }



async function handleLockIndivBid() {
    if (!round || !itsMyBidTurn || locking) return;
    if (bidDebounceRef.current) clearTimeout(bidDebounceRef.current);
    setLocking(true);
    const current = bids[me.playerId] ?? 0;
    const newLocked = { ...bidsLocked, [me.playerId]: true };
    const newBids = { ...bids, [me.playerId]: current };
    await supabase.from('rounds')
      .update({ bids: newBids, bids_locked: newLocked })
      .eq('game_id', game.id).eq('round_num', game.current_round);
    setLocking(false);
  }

  async function handleStartPlay() {
    await supabase.from('games').update({ status: 'playing' }).eq('id', game.id);
  }

  // Host-only: play the disconnected player's lowest legal card for them.
  async function handleSkipTurn(targetSeat) {
    if (!iAmHost || skipping) return;
    if (!round || !game) return;
    const playerId = targetSeat.player_id;

    const { data: handRow } = await supabase
      .from('hands').select('cards')
      .eq('game_id', game.id)
      .eq('player_id', playerId)
      .eq('round_num', game.current_round)
      .maybeSingle();
    if (!handRow || !handRow.cards || handRow.cards.length === 0) {
      return;
    }
    const theirHand = handRow.cards;
    const legal = legalCardIndices(theirHand, currentTrick);

    let pickIdx = -1;
    let lowest = Infinity;
    legal.forEach((i) => {
      if (theirHand[i].value < lowest) {
        lowest = theirHand[i].value;
        pickIdx = i;
      }
    });
    if (pickIdx < 0) return;

    if (!confirm(`Skip ${targetSeat.name}'s turn? The app will play their lowest legal card (${cardLabel(theirHand[pickIdx])}).`)) {
      return;
    }
    setSkipping(true);

    const card = theirHand[pickIdx];
    const newHand = [...theirHand.slice(0, pickIdx), ...theirHand.slice(pickIdx + 1)];
    const newTrickEntry = { player_id: playerId, seat_index: targetSeat.seat_index, card };
    const newCurrentTrick = [...currentTrick, newTrickEntry];
    const nextPlayerSeat = (targetSeat.seat_index + 1) % N;

    await supabase.from('hands')
      .update({ cards: newHand })
      .eq('game_id', game.id)
      .eq('player_id', playerId)
      .eq('round_num', game.current_round);

    await supabase.from('rounds')
      .update({
        current_trick: newCurrentTrick,
        current_player_seat_index: nextPlayerSeat,
      })
      .eq('game_id', game.id)
      .eq('round_num', game.current_round);

    setSkipping(false);
  }

 async function handlePlayCard(handIdx) {
    if (!itsMyTurn || playing) return;
    if (!legalIndices.has(handIdx)) return;
    setPlaying(true);
    // sounds.play('cardPlay');

    const card = myHand[handIdx];
    const newHand = [...myHand.slice(0, handIdx), ...myHand.slice(handIdx + 1)];
    const newTrickEntry = { player_id: me.playerId, seat_index: mySeatIdx, card };
    const newCurrentTrick = [...currentTrick, newTrickEntry];
    const nextPlayerSeat = (mySeatIdx + 1) % N;

    // Optimistic UI — update locally first so card lands instantly
    setMyHand(newHand);
    setRound((prev) => prev ? {
      ...prev,
      current_trick: newCurrentTrick,
      current_player_seat_index: nextPlayerSeat,
    } : prev);

    // Fire both DB writes in parallel, don't block the UI
    Promise.all([
      supabase.from('hands')
        .update({ cards: newHand })
        .eq('game_id', game.id).eq('player_id', me.playerId)
        .eq('round_num', game.current_round),
      supabase.from('rounds')
        .update({ current_trick: newCurrentTrick, current_player_seat_index: nextPlayerSeat })
        .eq('game_id', game.id).eq('round_num', game.current_round),
    ]).then(() => {
      setPlaying(false);
    }).catch((err) => {
      console.error('Failed to sync card play:', err);
      setPlaying(false);
    });
  }
  useEffect(() => {
    async function resolveTrickIfComplete() {
      if (!round || !game || !iAmHost) return;
      if (currentTrick.length !== N || N === 0) return;
      if (revealedWinner) return;

      const winner = determineTrickWinner(currentTrick);
      if (!winner) return;
      setRevealedWinner(winner);

      await supabase.from('rounds').update({
        last_trick_winner: winner.player_id,
      }).eq('game_id', game.id).eq('round_num', game.current_round);

      await new Promise((r) => setTimeout(r, 2000));

      const newHistory = [...(round.trick_history || []), {
        cards: currentTrick,
        winner_player_id: winner.player_id,
        winner_seat_index: winner.seat_index,
      }];

      const tricksWon = { ...(round.tricks_won || {}) };
      tricksWon[winner.player_id] = (tricksWon[winner.player_id] || 0) + 1;

      const teamTricksWon = { ...(round.team_tricks_won || {}) };
      const winnerSeat = seats.find((s) => s.player_id === winner.player_id);
      if (winnerSeat?.team_id) {
        teamTricksWon[winnerSeat.team_id] = (teamTricksWon[winnerSeat.team_id] || 0) + 1;
      }

      const { data: handRows } = await supabase.from('hands').select('cards')
        .eq('game_id', game.id).eq('round_num', game.current_round);
      const isRoundComplete = (handRows || []).every((h) => !h.cards || h.cards.length === 0);

      const updates = {
        trick_history: newHistory,
        tricks_won: tricksWon,
        team_tricks_won: teamTricksWon,
        current_trick: [],
        current_player_seat_index: winner.seat_index,
        leader_seat_index: winner.seat_index,
        last_trick_winner: null,
      };

      if (isRoundComplete) {
        if (isTeamMode) {
          const teamScores = {};
          for (const tId of Object.keys(teamBids)) {
            const bid = teamBids[tId] ?? 0;
            const won = teamTricksWon[tId] ?? 0;
            teamScores[tId] = calcScore(bid, won);
          }
          updates.team_scores = teamScores;
        } else {
          const playerScores = {};
          for (const pid of Object.keys(bids)) {
            const bid = bids[pid] ?? 0;
            const won = tricksWon[pid] ?? 0;
            playerScores[pid] = calcScore(bid, won);
          }
          updates.scores = playerScores;
        }
        updates.completed_at = new Date().toISOString();
      }

      await supabase.from('rounds').update(updates)
        .eq('game_id', game.id).eq('round_num', game.current_round);

      setRevealedWinner(null);
    }
    resolveTrickIfComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrick.length, iAmHost, N]);

  // Play victory fanfare when the match ends and I won (must be at top with other hooks)
  const prevCompletedRef = useRef(false);
  useEffect(() => {
    if (game?.status === 'completed' && !prevCompletedRef.current) {
      // Wait until we have round data loaded before deciding
      if (!allRounds || allRounds.length === 0) return;
      if (!seats || seats.length === 0) return;

      prevCompletedRef.current = true;

      let myTotal = 0;
      let winningTotal = -Infinity;
      let allTotals = [];

      // ── Calculate totals for sound effect ──
      if (isTeamMode) {
        const teamTotals = {};
        for (const r of allRounds) {
          if (!r.team_scores) continue;
          for (const [tId, score] of Object.entries(r.team_scores)) {
            teamTotals[tId] = (teamTotals[tId] ?? 0) + score;
          }
        }
        allTotals = Object.values(teamTotals);
        winningTotal = Math.max(...allTotals);
        myTotal = teamTotals[myTeam] ?? 0;
      } else {
        const indivTotals = {};
        for (const r of allRounds) {
          if (!r.scores) continue;
          for (const [pid, score] of Object.entries(r.scores)) {
            indivTotals[pid] = (indivTotals[pid] ?? 0) + score;
          }
        }
        allTotals = Object.values(indivTotals);
        winningTotal = Math.max(...allTotals);
        myTotal = indivTotals[me?.playerId] ?? 0;
      }

      if (allTotals.length > 0) {
        if (myTotal === winningTotal) {
          sounds.play('matchWin');
        } else {
          sounds.play('matchLose');
        }
      }

      // ── EASTER EGG: Dhanush victory popup (shows for EVERYONE) ──
      const isDhanushIdentifier = (name, avatarId) => {
        const lower = (name || '').toLowerCase().trim();
        return lower === 'dhanush' || avatarId === 'dhanush';
      };

      let dhanushWon = false;
      if (isTeamMode) {
        const teamTotals = {};
        for (const r of allRounds) {
          if (!r.team_scores) continue;
          for (const [tId, score] of Object.entries(r.team_scores)) {
            teamTotals[tId] = (teamTotals[tId] ?? 0) + score;
          }
        }
        const sortedTeams = Object.entries(teamTotals).sort((a, b) => b[1] - a[1]);
        const winningTeamId = sortedTeams[0]?.[0];
        const winningSeats = seats.filter((s) => s.team_id === winningTeamId);
        dhanushWon = winningSeats.some((s) => isDhanushIdentifier(s.name, s.avatar_id));
      } else {
        const indivTotals = {};
        for (const r of allRounds) {
          if (!r.scores) continue;
          for (const [pid, score] of Object.entries(r.scores)) {
            indivTotals[pid] = (indivTotals[pid] ?? 0) + score;
          }
        }
        const sortedPlayers = Object.entries(indivTotals).sort((a, b) => b[1] - a[1]);
        const winnerId = sortedPlayers[0]?.[0];
        const winnerSeat = seats.find((s) => s.player_id === winnerId);
        if (winnerSeat) {
          dhanushWon = isDhanushIdentifier(winnerSeat.name, winnerSeat.avatar_id);
        }
      }

      if (dhanushWon) {
        setTimeout(() => setShowVictoryEgg(true), 3000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status, allRounds, seats]);

  // Play card sound when any card lands in the trick (from anyone)
  const prevTrickLenRef = useRef(0);
  useEffect(() => {
    const newLen = currentTrick.length;
    const prevLen = prevTrickLenRef.current;
    if (newLen > prevLen && newLen > 0) {
      const lastEntry = currentTrick[newLen - 1];
      if (lastEntry?.player_id !== me?.playerId) {
        // sounds.play('cardPlay');
      }
    }
    prevTrickLenRef.current = newLen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrick.length]);

  useEffect(() => {
    if (!round) return;
    const fromServer = round.last_trick_winner;
    if (fromServer && !revealedWinner) {
      const entry = currentTrick.find((e) => e.player_id === fromServer);
      setRevealedWinner(entry ?? { player_id: fromServer });
    } else if (!fromServer && revealedWinner) {
      setRevealedWinner(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.last_trick_winner]);

  // Save match to history when game completes (host only writes, idempotent)
  useEffect(() => {
    async function saveMatchHistory() {
      if (!game || !iAmHost || game.status !== 'completed' || !game.completed_at) return;
      if (!allRounds || allRounds.length === 0) return;
      if (seatedPlayers.length === 0) return;

      const { data: existing } = await supabase
        .from('matches').select('id').eq('game_id', game.id).maybeSingle();
      if (existing) return;

      const player_snapshot = seatedPlayers.map((s) => ({
        player_id: s.player_id,
        name: s.name,
        avatar_id: s.avatar_id,
        seat_index: s.seat_index,
        team_id: s.team_id ?? null,
      }));

      let team_snapshot = [];
      if (isTeamMode) {
        team_snapshot = teamOrder.map((tId) => {
          const teamSeats = teamsByTeam[tId] || [];
          return {
            team_id: tId,
            label: teamSeats.map((s) => s.name).join(' + '),
            palette_idx: teamSeats[0]?.team_palette_idx ?? 0,
            members: teamSeats.map((s) => ({
              player_id: s.player_id,
              name: s.name,
              avatar_id: s.avatar_id,
            })),
          };
        });
      }

      const final_scores = {};
      for (const r of allRounds) {
        if (!r.completed_at) continue;
        if (isTeamMode && r.team_scores) {
          for (const [tId, score] of Object.entries(r.team_scores)) {
            final_scores[tId] = (final_scores[tId] ?? 0) + score;
          }
        } else if (!isTeamMode && r.scores) {
          for (const [pid, score] of Object.entries(r.scores)) {
            final_scores[pid] = (final_scores[pid] ?? 0) + score;
          }
        }
      }

      const round_breakdown = allRounds.map((r) => ({
        round_num: r.round_num,
        completed: !!r.completed_at,
        bids: isTeamMode ? (r.team_bids || {}) : (r.bids || {}),
        tricks_won: isTeamMode ? (r.team_tricks_won || {}) : (r.tricks_won || {}),
        scores: isTeamMode ? (r.team_scores || {}) : (r.scores || {}),
      }));

      const entries = Object.entries(final_scores);
      entries.sort((a, b) => b[1] - a[1]);
      const winnerId = entries[0]?.[0];
      const winnerScore = entries[0]?.[1] ?? 0;
      let winnerLabel = '';
      if (winnerId) {
        if (isTeamMode) {
          const t = team_snapshot.find((tt) => tt.team_id === winnerId);
          winnerLabel = t?.label ?? 'Unknown';
        } else {
          const p = player_snapshot.find((pp) => pp.player_id === winnerId);
          winnerLabel = p?.name ?? 'Unknown';
        }
      }

      const matchId = Math.random().toString(36).slice(2, 14);
      const { error: matchErr } = await supabase.from('matches').insert({
        id: matchId,
        room_code: code,
        game_id: game.id,
        mode: game.mode,
        deck_count: game.deck_count,
        max_rounds: game.max_rounds,
        player_count: seatedPlayers.length,
        started_at: game.created_at ?? new Date().toISOString(),
        completed_at: game.completed_at ?? new Date().toISOString(),
        player_snapshot,
        team_snapshot,
        winner_label: winnerLabel,
        winner_score: winnerScore,
        final_scores,
        round_breakdown,
      });
      if (matchErr) {
        console.error('Failed to save match history:', matchErr);
      } else {
        console.log('Match history saved successfully:', matchId);
      }
    }
    saveMatchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status, game?.completed_at, iAmHost]);

  async function handleNextRound() {
    if (!iAmHost || !game || advancing) return;
    setAdvancing(true);
    if (isLastRound) {
      await supabase.from('games')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', game.id);
    } else {
      await supabase.from('games')
        .update({ status: 'bidding', current_round: game.current_round + 1 })
        .eq('id', game.id);
    }
    setAdvancing(false);
  }

  function dismissSpectatorWelcome() {
    sessionStorage.setItem(`spade-spectator-acknowledged-${code}`, 'true');
    setShowSpectatorWelcome(false);
  }

 async function handlePlayAgain() {
    if (!iAmHost || playingAgain) return;
    if (!confirm('Start a new match? Everyone returns to the lobby. Spectators will join as players.')) return;
    setPlayingAgain(true);

    // Promote all spectators to active players for the next match
    await supabase
      .from('players')
      .update({ is_spectator: false })
      .eq('room_code', code)
      .eq('is_spectator', true);

    await supabase.from('rooms').update({
      status: 'lobby',
      current_game_id: null,
    }).eq('code', code);
  }

  async function handleLeaveRoom() {
    if (!me) return;
    if (!confirm('Leave the room? You can rejoin later if it\'s still open.')) return;
    await supabase.from('players').delete().eq('id', me.playerId);
    localStorage.removeItem(`spade-room-${code}`);
    router.push('/');
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center bg-[#0a1410] text-emerald-200">Loading...</main>;
  }

  const overlayProps = {
    code, game, seats, allRounds, round,
    isTeamMode, teamOrder, teamsByTeam, seatedPlayers,
    hostId, mePlayerId: me?.playerId,
  };

  // Play victory fanfare when the match ends and I won
  

// ────── GAME OVER SCREEN ──────
  if (game?.status === 'completed') {
    return (
      <>
      {showSpectatorWelcome && <SpectatorWelcome onDismiss={dismissSpectatorWelcome} />}
      {iAmSpectator && <SpectatorBadge className="fixed top-3 right-3 z-40" />}
      <GameOverScreen
        code={code}
        isTeamMode={isTeamMode}
        teamOrder={teamOrder}
        teamsByTeam={teamsByTeam}
        seatedPlayers={seatedPlayers}
        allRounds={allRounds}
        iAmHost={iAmHost}
        iAmSpectator={iAmSpectator}
        myPlayerId={me?.playerId}
        onPlayAgain={handlePlayAgain}
        onLeaveRoom={handleLeaveRoom}
        playingAgain={playingAgain}
      />
      <MatchOverlay {...overlayProps} />{showTricksWon && (
        <TricksWonModal
          onClose={() => setShowTricksWon(false)}
          seatedPlayers={seatedPlayers}
          trickHistory={round?.trick_history || []}
          mePlayerId={me?.playerId}
          roundNum={game?.current_round || 1}
        />
      )}
       {showVictoryEgg && <VictoryEgg onDone={() => setShowVictoryEgg(false)} />}

      </>
    );
  }

  // ────── BIDDING VIEW ──────
  if (game?.status === 'bidding') {
    // Spectator's view of bidding: see hands face-up + bids, no controls
    if (iAmSpectator) {
      return (
        <>
        {showSpectatorWelcome && <SpectatorWelcome onDismiss={dismissSpectatorWelcome} />}
        <main className="min-h-screen text-emerald-50 px-5 py-7"
        style={{ background: `linear-gradient(to bottom, var(--theme-bg-from, #0a1410), var(--theme-bg-to, #0f3d2c))` }}>
         {(round?.trick_history?.length ?? 0) > 0 && (
  <button
    onClick={() => setShowTricksWon(true)}
    className="fixed top-3 left-3 z-30 w-11 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition flex items-center justify-center text-lg"
    title="View tricks won this round"
    aria-label="Tricks won this round"
  >
    🃏
  </button>
)}
<VoicePanel
  voice={voice}
  players={seatedPlayers.map((s) => ({ player_id: s.player_id, name: s.name, avatar_id: s.avatar_id }))}
  mePlayerId={me?.playerId}
  className="top-3 left-16"
/>
          <SpectatorBadge className="fixed top-3 right-3 z-30" />
          <div className="max-w-md mx-auto pt-12">

            <div className="text-center mb-5">
              <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-1">
                Room {code} · Round {game?.current_round} · Bidding
              </p>
              <h1 className="text-2xl font-serif italic text-amber-200">Watching the bids</h1>
            </div>

            {/* All players' hands face-up */}
            <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4 mb-5">
              <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-3">All hands (god-mode)</p>
              <div className="space-y-3">
                {seatedPlayers.map((s) => {
                  const handRow = allHands.find((h) => h.player_id === s.player_id);
                  const cards = handRow?.cards ?? [];
                  return (
                    <div key={s.player_id} className="rounded-xl bg-[#14271f] border border-emerald-900/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar avatarId={s.avatar_id} playerName={s.name} size="xs" />
                        <span className="font-medium text-sm">{s.name}</span>
                        <span className="text-xs text-emerald-200/40">Seat {s.seat_index + 1}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {cards.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bids in progress */}
            <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-3">Bids</p>
              {isTeamMode ? (
                <div className="space-y-2">
                  {teamOrder.map((tId) => {
                    const teamSeats = teamsByTeam[tId] || [];
                    const teamColor = TEAM_COLORS[teamSeats[0]?.team_palette_idx ?? 0];
                    const locked = !!bidsLocked[tId];
                    return (
                      <div key={tId} className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: teamColor }} />
                          <span className="text-sm truncate">{teamSeats.map((s) => s.name).join(' + ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-serif italic" style={{ color: teamColor }}>
                            {teamBids[tId] ?? 0}
                          </span>
                          {locked && <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {indivOrder.map((pid) => {
                    const seat = seatedPlayers.find((s) => s.player_id === pid);
                    if (!seat) return null;
                    const locked = !!bidsLocked[pid];
                    return (
                      <div key={pid} className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-sm truncate">{seat.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-serif italic text-amber-200">{bids[pid] ?? 0}</span>
                          {locked && <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {allBidsLocked && (
              <div className="text-center text-emerald-200/40 text-sm py-3 mt-3">
                Waiting for the host to start the round...
              </div>
            )}
          </div>
        </main>
        <MatchOverlay {...overlayProps} />
        {showTricksWon && (
        <TricksWonModal
          onClose={() => setShowTricksWon(false)}
          seatedPlayers={seatedPlayers}
          trickHistory={round?.trick_history || []}
          mePlayerId={me?.playerId}
          roundNum={game?.current_round || 1}
        />
      )}
        </>
      );
    }

    return (
      <>
      {showSpectatorWelcome && <SpectatorWelcome onDismiss={dismissSpectatorWelcome} />}
      <main className="min-h-screen text-emerald-50 px-5 py-7"
        style={{ background: `linear-gradient(to bottom, var(--theme-bg-from, #0a1410), var(--theme-bg-to, #0f3d2c))` }}>
        {(round?.trick_history?.length ?? 0) > 0 && (
  <button
    onClick={() => setShowTricksWon(true)}
    className="fixed top-3 left-3 z-30 w-11 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition flex items-center justify-center text-lg"
    title="View tricks won this round"
    aria-label="Tricks won this round"
  >
    🃏
  </button>
)}
<VoicePanel
  voice={voice}
  players={seatedPlayers.map((s) => ({ player_id: s.player_id, name: s.name, avatar_id: s.avatar_id }))}
  mePlayerId={me?.playerId}
  className="top-3 left-16"
/>
        {iAmSpectator && <SpectatorBadge className="fixed top-3 right-3 z-30" />}
        <div className="max-w-md mx-auto">
          <div className="text-center mb-5">
            <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-1">
              Room {code} · Round {game?.current_round}
            </p>
            <h1 className="text-2xl font-serif italic text-amber-200">Place your bid</h1>
          </div>

         
          <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4 mb-5">
            <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-3">Your hand</p>
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {myHand.length === 0 && <p className="text-emerald-200/40 text-sm italic">Waiting for deal...</p>}
              {sortHand(myHand).map((c, i) => (<PlayingCard key={`${c.suit}-${c.value}-${i}`} card={c} size="md" />))}
            </div>
          </div>

          {isTeamMode && (
            <div className="space-y-3 mb-5">
              {teamOrder.map((tId, orderIdx) => {
                const teamSeats = teamsByTeam[tId] || [];
                const teamColor = TEAM_COLORS[teamSeats[0]?.team_palette_idx ?? orderIdx];
                const isMyTeam = tId === myTeam;
                const isActive = activeTeamId === tId;
                const isLocked = !!bidsLocked[tId];
                const bidValue = teamBids[tId] ?? 0;
                const memberNames = teamSeats.map((s) => s.name).join(' + ');
                return (
                  <div key={tId}
                    className={`rounded-2xl p-4 border transition ${
                      isActive ? 'bg-amber-200/10 border-amber-300'
                      : isLocked ? 'bg-emerald-950/30 border-emerald-900/50'
                      : 'bg-emerald-950/10 border-emerald-900/20 opacity-50'
                    }`}
                    style={isActive ? {
                      boxShadow: `0 0 0 2px ${teamColor}, 0 0 24px ${teamColor}55, 0 4px 12px rgba(0,0,0,0.4)`,
                    } : undefined}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: teamColor }} />
                        <div className="flex items-center gap-1">
                          {teamSeats.map((s) => (
                            <Avatar key={s.player_id} avatarId={s.avatar_id} playerName={s.name} size="xs" />
                          ))}
                        </div>
                        <span className="font-medium text-sm truncate">{memberNames}</span>
                        {isMyTeam && <span className="text-xs text-emerald-200/50">(you)</span>}
                      </div>
                      {isLocked && <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">✓ Locked</span>}
                    </div>
                    {isLocked ? (
                      <div className="text-center py-3">
                        <span className="text-4xl font-serif italic text-amber-200">{bidValue}</span>
                        <p className="text-xs text-emerald-200/40 mt-1">bid locked</p>
                      </div>
                    ) : isActive && isMyTeam ? (
                      <>
                        <div className="flex items-center justify-center gap-4 py-2">
                          <button onClick={() => handleAdjustTeamBid(-1)} disabled={(teamBids[tId] ?? 0) === 0}
                            className="w-12 h-12 rounded-full bg-[#14271f] border border-emerald-900 text-2xl font-bold text-emerald-200 disabled:opacity-30 active:scale-95 transition">−</button>
                         <span
                            key={bidValue}
                            className="text-5xl font-serif italic text-amber-200 w-20 text-center inline-block"
                            style={{ animation: 'bidPop 0.18s ease-out' }}
                          >
                            {bidValue}
                          </span>
                          <button onClick={() => handleAdjustTeamBid(1)} disabled={(teamBids[tId] ?? 0) >= cardsThisRound}
                            className="w-12 h-12 rounded-full bg-[#14271f] border border-emerald-900 text-2xl font-bold text-emerald-200 disabled:opacity-30 active:scale-95 transition">+</button>
                        </div>
                        <p className="text-xs text-emerald-200/40 text-center mb-3">Up to {cardsThisRound}</p>
                        <button onClick={handleLockTeamBid} disabled={locking}
                          className="w-full py-3 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-50">
                          {locking ? 'Locking...' : `Lock Bid (${bidValue})`}
                        </button>
                      </>
                    ) : isActive ? (
                      <div className="text-center py-4">
                        <p className="text-emerald-200/60 text-sm italic">{memberNames} are bidding...</p>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-emerald-200/30 text-sm">waiting...</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!isTeamMode && (
            <div className="space-y-3 mb-5">
              {indivOrder.map((pid) => {
                const seat = seatedPlayers.find((s) => s.player_id === pid);
                if (!seat) return null;
                const isMe = pid === me?.playerId;
                const isActive = activeIndivPlayerId === pid;
                const isLocked = !!bidsLocked[pid];
                const bidValue = bids[pid] ?? 0;
                return (
                  <div key={pid}
                    className={`rounded-2xl p-4 border transition ${
                      isActive ? 'bg-amber-200/10 border-amber-300'
                      : isLocked ? 'bg-emerald-950/30 border-emerald-900/50'
                      : 'bg-emerald-950/10 border-emerald-900/20 opacity-50'
                    }`}
                    style={isActive ? {
                      boxShadow: `0 0 0 2px #f5d989, 0 0 24px rgba(245,217,137,0.35), 0 4px 12px rgba(0,0,0,0.4)`,
                    } : undefined}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-emerald-200/40 text-xs">Seat {seat.seat_index + 1}</span>
                        <Avatar avatarId={seat.avatar_id} playerName={seat.name} size="xs" />
                        <span className="font-medium text-sm truncate">{seat.name}</span>
                        {isMe && <span className="text-xs text-emerald-200/50">(you)</span>}
                      </div>
                      {isLocked && <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">✓ Locked</span>}
                    </div>
                    {isLocked ? (
                      <div className="text-center py-3">
                        <span className="text-4xl font-serif italic text-amber-200">{bidValue}</span>
                        <p className="text-xs text-emerald-200/40 mt-1">bid locked</p>
                      </div>
                    ) : isActive && isMe ? (
                      <>
                        <div className="flex items-center justify-center gap-4 py-2">
                          <button onClick={() => handleAdjustIndivBid(-1)} disabled={(bids[pid] ?? 0) === 0}
                            className="w-12 h-12 rounded-full bg-[#14271f] border border-emerald-900 text-2xl font-bold text-emerald-200 disabled:opacity-30 active:scale-95 transition">−</button>
                         <span
                            key={bidValue}
                            className="text-5xl font-serif italic text-amber-200 w-20 text-center inline-block"
                            style={{ animation: 'bidPop 0.18s ease-out' }}
                          >
                            {bidValue}
                          </span>
                         <button onClick={() => handleAdjustIndivBid(1)} disabled={(bids[pid] ?? 0) >= cardsThisRound}
                            className="w-12 h-12 rounded-full bg-[#14271f] border border-emerald-900 text-2xl font-bold text-emerald-200 disabled:opacity-30 active:scale-95 transition">+</button>
                        </div>
                        <p className="text-xs text-emerald-200/40 text-center mb-3">Up to {cardsThisRound}</p>
                        <button onClick={handleLockIndivBid} disabled={locking}
                          className="w-full py-3 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-50">
                          {locking ? 'Locking...' : `Lock Bid (${bidValue})`}
                        </button>
                      </>
                    ) : isActive ? (
                      <div className="text-center py-4">
                        <p className="text-emerald-200/60 text-sm italic">{seat.name} is bidding...</p>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-emerald-200/30 text-sm">waiting...</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

{allBidsLocked && (
            <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4 mb-3">
              <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-2">All bids in</p>
              {isTeamMode ? (
                <div className="flex justify-around">
                  {teamOrder.map((tId) => {
                    const teamSeats = teamsByTeam[tId] || [];
                    const teamColor = TEAM_COLORS[teamSeats[0]?.team_palette_idx ?? 0];
                    return (
                      <div key={tId} className="text-center">
                        <p className="text-xs text-emerald-200/60 mb-1">{teamSeats.map((s) => s.name).join(' + ')}</p>
                        <p className="text-3xl font-serif italic" style={{ color: teamColor }}>{teamBids[tId]}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex justify-around flex-wrap gap-2">
                  {indivOrder.map((pid) => {
                    const seat = seatedPlayers.find((s) => s.player_id === pid);
                    if (!seat) return null;
                    return (
                      <div key={pid} className="text-center">
                        <p className="text-xs text-emerald-200/60 mb-1">{seat.name}</p>
                        <p className="text-2xl font-serif italic text-amber-200">{bids[pid] ?? 0}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Bid-sum toast — small notification when all bids lock */}
          <BidSumToast
            allBidsLocked={allBidsLocked}
            totalBids={isTeamMode
              ? teamOrder.reduce((sum, tId) => sum + (teamBids[tId] ?? 0), 0)
              : indivOrder.reduce((sum, pid) => sum + (bids[pid] ?? 0), 0)}
            tricksAvailable={cardsThisRound}
            roundKey={game.current_round}
          />

          {allBidsLocked && iAmHost && (
            <button onClick={handleStartPlay}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c]">
              Start Round {game.current_round} →
            </button>
          )}
          {allBidsLocked && !iAmHost && (
            <div className="text-center text-emerald-200/40 text-sm py-3">Waiting for the host to start the round...</div>
          )}
        </div>
      </main>
      <MatchOverlay {...overlayProps} />
      {showTricksWon && (
        <TricksWonModal
          onClose={() => setShowTricksWon(false)}
          seatedPlayers={seatedPlayers}
          trickHistory={round?.trick_history || []}
          mePlayerId={me?.playerId}
          roundNum={game?.current_round || 1}
        />
      )}
      </>
    );
  }
// ────── ROUND RECAP ──────
  if (showRecap) {
    return (
      <>
      {showSpectatorWelcome && <SpectatorWelcome onDismiss={dismissSpectatorWelcome} />}
      <main className="min-h-screen text-emerald-50 px-5 py-7"
        style={{ background: `linear-gradient(to bottom, var(--theme-bg-from, #0a1410), var(--theme-bg-to, #0f3d2c))` }}>
        {(round?.trick_history?.length ?? 0) > 0 && (
  <button
    onClick={() => setShowTricksWon(true)}
    className="fixed top-3 left-3 z-30 w-11 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition flex items-center justify-center text-lg"
    title="View tricks won this round"
    aria-label="Tricks won this round"
  >
    🃏
  </button>
)}
<VoicePanel
  voice={voice}
  players={seatedPlayers.map((s) => ({ player_id: s.player_id, name: s.name, avatar_id: s.avatar_id }))}
  mePlayerId={me?.playerId}
  className="top-3 left-16"
/>
        {iAmSpectator && <SpectatorBadge className="fixed top-3 right-3 z-30" />}
        <div className={`max-w-md mx-auto ${iAmSpectator ? 'pt-12' : ''}`}>
          <div className="text-center mb-5">
            <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-1">Room {code}</p>
            <h1 className="text-3xl font-serif italic text-amber-200 mb-1">Round {game.current_round} complete</h1>
            <p className="text-emerald-200/50 text-sm">
              {isLastRound ? 'Final round!' : `Next: Round ${game.current_round + 1}`}
            </p>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-5 mb-4">
            <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-4">This round</p>
            <div className="space-y-3">
              {isTeamMode ? teamOrder.map((tId) => {
                const teamSeats = teamsByTeam[tId] || [];
                const teamColor = TEAM_COLORS[teamSeats[0]?.team_palette_idx ?? 0];
                const bid = round.team_bids?.[tId] ?? 0;
                const won = round.team_tricks_won?.[tId] ?? 0;
                const score = round.team_scores?.[tId] ?? 0;
                return (
                  <div key={tId} className="rounded-xl bg-[#14271f] border border-emerald-900/40 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: teamColor }} />
                      <div className="flex items-center gap-1">
                        {teamSeats.map((s) => (
                          <Avatar key={s.player_id} avatarId={s.avatar_id} playerName={s.name} size="xs" />
                        ))}
                      </div>
                      <span className="font-medium text-sm truncate">{teamSeats.map((s) => s.name).join(' + ')}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-emerald-200/60">
                        Bid <span className="text-emerald-200 font-mono">{bid}</span>
                        <span className="mx-2">·</span>
                        Won <span className="text-emerald-200 font-mono">{won}</span>
                      </span>
                      <AnimatedScore
                        value={score}
                        className="text-3xl font-serif italic font-bold"
                        style={{ color: score > 0 ? '#86efac' : score === 0 ? '#e5d4a8' : '#fca5a5' }}
                      />
                    </div>
                  </div>
                );
              }) : seatedPlayers.map((s) => {
                const bid = round.bids?.[s.player_id] ?? 0;
                const won = round.tricks_won?.[s.player_id] ?? 0;
                const score = round.scores?.[s.player_id] ?? 0;
                return (
                 <div key={s.player_id} className="rounded-xl bg-[#14271f] border border-emerald-900/40 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar avatarId={s.avatar_id} playerName={s.name} size="sm" />
                      <span className="font-medium text-sm truncate">{s.name}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-emerald-200/60">
                        Bid <span className="text-emerald-200 font-mono">{bid}</span>
                        <span className="mx-2">·</span>
                        Won <span className="text-emerald-200 font-mono">{won}</span>
                      </span>
                      <AnimatedScore
                        value={score}
                        className="text-3xl font-serif italic font-bold"
                        style={{ color: score > 0 ? '#86efac' : score === 0 ? '#e5d4a8' : '#fca5a5' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <CumulativeScoreboard
            allRounds={allRounds} teamOrder={teamOrder}
            teamsByTeam={teamsByTeam} seatedPlayers={seatedPlayers}
            isTeamMode={isTeamMode} title="Running totals"
          />

          {iAmHost ? (
            <button onClick={handleNextRound} disabled={advancing}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-50 mt-4">
              {advancing ? 'Advancing...' : isLastRound ? 'See Final Results →' : `Start Round ${game.current_round + 1} →`}
            </button>
          ) : (
            <div className="text-center text-emerald-200/40 text-sm py-3 mt-3">Waiting for the host...</div>
          )}
       </div>
      </main>
      <MatchOverlay {...overlayProps} />
      {showTricksWon && (
        <TricksWonModal
          onClose={() => setShowTricksWon(false)}
          seatedPlayers={seatedPlayers}
          trickHistory={round?.trick_history || []}
          mePlayerId={me?.playerId}
          roundNum={game?.current_round || 1}
        />
      )}
      </>
    );
  }
  // ────── PLAYING VIEW ──────
  if (game?.status === 'playing') {
    const currentSeatForPause = seats.find((s) => s.seat_index === currentPlayerSeatIdx);
    const isCurrentPlayerStale =
      currentSeatForPause &&
      currentTrick.length < N &&
      stalePlayerIds.has(currentSeatForPause.player_id);

    // Spectator gets a special god-mode view (sees all hands face-up)
    if (iAmSpectator) {
      return (
        <>
        {showSpectatorWelcome && <SpectatorWelcome onDismiss={dismissSpectatorWelcome} />}
        <main className="min-h-screen text-emerald-50 px-3 py-5 flex flex-col"
        style={{ background: `linear-gradient(to bottom, var(--theme-bg-from, #0a1410), var(--theme-bg-to, #0f3d2c))` }}>
         {(round?.trick_history?.length ?? 0) > 0 && (
  <button
    onClick={() => setShowTricksWon(true)}
    className="fixed top-3 left-3 z-30 w-11 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition flex items-center justify-center text-lg"
    title="View tricks won this round"
    aria-label="Tricks won this round"
  >
    🃏
  </button>
)}
<VoicePanel
  voice={voice}
  players={seatedPlayers.map((s) => ({ player_id: s.player_id, name: s.name, avatar_id: s.avatar_id }))}
  mePlayerId={me?.playerId}
  className="top-3 left-16"
/>
          <SpectatorBadge className="fixed top-3 right-3 z-30" />
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col pt-12">

            <div className="text-center mb-3">
              <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-1">
                Round {game.current_round} · Trick {(round?.trick_history?.length ?? 0) + 1} / {cardsThisRound}
              </p>
              <h1 className="text-lg font-serif italic text-amber-200">
                {revealedWinner
                  ? `${seats.find((s) => s.player_id === revealedWinner.player_id)?.name} wins!`
                  : `Waiting for ${seats.find((s) => s.seat_index === currentPlayerSeatIdx)?.name ?? '...'}`}
              </h1>
            </div>

            {/* Bid summary mini-bar */}
            {isTeamMode ? (
              <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-2 mb-3 flex justify-around text-xs">
                {teamOrder.map((tId) => {
                  const teamSeats = teamsByTeam[tId] || [];
                  const teamColor = TEAM_COLORS[teamSeats[0]?.team_palette_idx ?? 0];
                  const won = round?.team_tricks_won?.[tId] ?? 0;
                  const bid = teamBids[tId] ?? 0;
                  return (
                    <div key={tId} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: teamColor }} />
                      <span className="text-emerald-200/70 truncate max-w-[100px]">
                        {teamSeats.map((s) => s.name).join('+')}
                      </span>
                      <span className="font-mono">
                        <span className="text-amber-200">{won}</span>
                        <span className="text-emerald-200/40">/{bid}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-2 mb-3 flex justify-around flex-wrap gap-x-3 gap-y-1 text-xs">
                {seatedPlayers.map((s) => {
                  const won = round?.tricks_won?.[s.player_id] ?? 0;
                  const bid = bids[s.player_id] ?? 0;
                  return (
                    <div key={s.player_id} className="flex items-center gap-1.5">
                      <span className="text-emerald-200/70 truncate max-w-[60px]">{s.name}</span>
                      <span className="font-mono">
                        <span className="text-amber-200">{won}</span>
                        <span className="text-emerald-200/40">/{bid}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <SpectatorTable
              seats={seatedPlayers}
              allHands={allHands}
              currentTrick={currentTrick}
              currentPlayerSeatIdx={currentPlayerSeatIdx}
              revealedWinner={revealedWinner}
              N={N}
            />
          </div>
        </main>
        <MatchOverlay {...overlayProps} />
        {showTricksWon && (
        <TricksWonModal
          onClose={() => setShowTricksWon(false)}
          seatedPlayers={seatedPlayers}
          trickHistory={round?.trick_history || []}
          mePlayerId={me?.playerId}
          roundNum={game?.current_round || 1}
        />
      )}
        </>
      );
    }

    return (
      <>
      {showSpectatorWelcome && <SpectatorWelcome onDismiss={dismissSpectatorWelcome} />}
      <main className="min-h-screen text-emerald-50 px-3 py-5 flex flex-col"
        style={{ background: `linear-gradient(to bottom, var(--theme-bg-from, #0a1410), var(--theme-bg-to, #0f3d2c))` }}>
       {(round?.trick_history?.length ?? 0) > 0 && (
  <button
    onClick={() => setShowTricksWon(true)}
    className="fixed top-3 left-3 z-30 w-11 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition flex items-center justify-center text-lg"
    title="View tricks won this round"
    aria-label="Tricks won this round"
  >
    🃏
  </button>
)}
<VoicePanel
  voice={voice}
  players={seatedPlayers.map((s) => ({ player_id: s.player_id, name: s.name, avatar_id: s.avatar_id }))}
  mePlayerId={me?.playerId}
  className="top-3 left-16"
/>
        {iAmSpectator && <SpectatorBadge className="fixed top-3 right-3 z-30" />}
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
          <div className="text-center mb-3">
            <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-1">
              Round {game.current_round} · Trick {(round?.trick_history?.length ?? 0) + 1} / {game.current_round}
            </p>
            <h1 className="text-lg font-serif italic text-amber-200">
              {revealedWinner
                ? `${seats.find((s) => s.player_id === revealedWinner.player_id)?.name} wins!`
                : itsMyTurn ? 'Your turn'
                : `Waiting for ${seats.find((s) => s.seat_index === currentPlayerSeatIdx)?.name ?? '...'}`}
            </h1>
          </div>

          {/* Pause-on-disconnect banner */}
          {isCurrentPlayerStale && (
            <div className="mb-3 p-3 rounded-xl bg-amber-950/30 border border-amber-900/50 flex items-center gap-3">
              <span className="text-2xl">⏸️</span>
              <div className="flex-1 min-w-0">
                <p className="text-amber-200 text-sm font-medium">
                  Waiting for {currentSeatForPause.name}
                </p>
                <p className="text-amber-200/50 text-xs">
                  They appear to be offline.
                </p>
              </div>
              {iAmHost && (
                <button
                  onClick={() => handleSkipTurn(currentSeatForPause)}
                  disabled={skipping}
                  className="text-xs px-3 py-2 rounded-lg bg-amber-300 text-[#07100c] font-semibold hover:bg-amber-200 active:scale-95 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {skipping ? 'Skipping...' : 'Skip turn'}
                </button>
              )}
            </div>
          )}

          {isTeamMode ? (
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-2 mb-3 flex justify-around text-xs">
              {teamOrder.map((tId) => {
                const teamSeats = teamsByTeam[tId] || [];
                const teamColor = TEAM_COLORS[teamSeats[0]?.team_palette_idx ?? 0];
                const won = round?.team_tricks_won?.[tId] ?? 0;
                const bid = teamBids[tId] ?? 0;
                return (
                  <div key={tId} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: teamColor }} />
                    <span className="text-emerald-200/70 truncate max-w-[100px]">
                      {teamSeats.map((s) => s.name).join('+')}
                    </span>
                    <span className="font-mono">
                      <span className="text-amber-200">{won}</span>
                      <span className="text-emerald-200/40">/{bid}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-2 mb-3 flex justify-around flex-wrap gap-x-3 gap-y-1 text-xs">
              {seatedPlayers.map((s) => {
                const won = round?.tricks_won?.[s.player_id] ?? 0;
                const bid = bids[s.player_id] ?? 0;
                return (
                  <div key={s.player_id} className="flex items-center gap-1.5">
                    <span className="text-emerald-200/70 truncate max-w-[60px]">{s.name}</span>
                    <span className="font-mono">
                      <span className="text-amber-200">{won}</span>
                      <span className="text-emerald-200/40">/{bid}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <PlayTable
            seats={seatedPlayers}
            allHands={allHands}
            mySeat={mySeat}
            currentTrick={currentTrick}
            currentPlayerSeatIdx={currentPlayerSeatIdx}
            revealedWinner={revealedWinner}
            talkingPlayers={voice.talkingPlayers}
          />

          <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-3 mt-3">
            <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-2">
              Your hand {currentTrick[0]?.card?.suit && itsMyTurn && (
                <span className="text-amber-300/70 text-[10px] normal-case ml-1">
                  (must follow {currentTrick[0].card.suit})
                </span>
              )}
            </p>
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {myHand.length === 0 && <p className="text-emerald-200/40 text-sm italic py-3">No cards left</p>}
              {sortHand(myHand.map((c, i) => ({ ...c, _originalIndex: i }))).map((c) => {
                const originalIdx = c._originalIndex;
                const isLegal = legalIndices.has(originalIdx);
                const canTap = itsMyTurn && isLegal && !playing;
                return (
                  <button key={`${c.suit}-${c.value}-${originalIdx}`} onClick={() => canTap && handlePlayCard(originalIdx)} disabled={!canTap}
                    className="transition-transform"
                    style={{
                      opacity: itsMyTurn && !isLegal ? 0.35 : 1,
                      cursor: canTap ? 'pointer' : 'default',
                      background: 'none', border: 'none', padding: 0,
                    }}
                    onMouseEnter={(e) => { if (canTap) e.currentTarget.style.transform = 'translateY(-8px)'; }}
                    onMouseLeave={(e) => { if (canTap) e.currentTarget.style.transform = ''; }}>
                    <PlayingCard card={c} size="md" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <MatchOverlay {...overlayProps} />
      {showTricksWon && (
        <TricksWonModal
          onClose={() => setShowTricksWon(false)}
          seatedPlayers={seatedPlayers}
          trickHistory={round?.trick_history || []}
          mePlayerId={me?.playerId}
          roundNum={game?.current_round || 1}
        />
      )}
      </>
    );
  }

  return <main className="min-h-screen flex items-center justify-center bg-[#0a1410] text-emerald-200">Loading game state...</main>;
}

// ──────────────────────────────────────────────────────────
// GameOverScreen — confetti, final ranking, totals, round-by-round
// ──────────────────────────────────────────────────────────
function GameOverScreen({
  code, isTeamMode, teamOrder, teamsByTeam, seatedPlayers, allRounds,
  iAmHost, iAmSpectator, myPlayerId, onPlayAgain, onLeaveRoom, playingAgain,
}) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4500);
    return () => clearTimeout(t);
  }, []);

  let ranked;
  if (isTeamMode) {
    const teamTotals = computeTeamTotals(allRounds);
    ranked = teamOrder.map((tId) => {
      const teamSeats = teamsByTeam[tId] || [];
      return {
        id: tId,
        label: teamSeats.map((s) => s.name).join(' + '),
        color: TEAM_COLORS[teamSeats[0]?.team_palette_idx ?? 0],
        total: teamTotals[tId] ?? 0,
        amIIn: teamSeats.some((s) => s.player_id === myPlayerId),
        avatars: teamSeats.map((s) => ({ id: s.avatar_id, name: s.name })),
      };
    }).sort((a, b) => b.total - a.total);
  } else {
    const indivTotals = computeIndivTotals(allRounds);
    ranked = seatedPlayers.map((s) => ({
      id: s.player_id,
      label: s.name,
      color: '#f5d989',
      total: indivTotals[s.player_id] ?? 0,
      amIIn: s.player_id === myPlayerId,
      avatars: [{ id: s.avatar_id, name: s.name }],
    })).sort((a, b) => b.total - a.total);
  }

  const winner = ranked[0];
  const completedRounds = allRounds.filter((r) => r.completed_at);

  return (
   <main className="min-h-screen text-emerald-50 px-5 py-7 relative overflow-hidden"
      style={{ background: `linear-gradient(to bottom, var(--theme-bg-from, #0a1410), var(--theme-bg-to, #0f3d2c))` }}>
      {showConfetti && <ConfettiBurst />}

      <div className="max-w-md mx-auto relative z-10">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-1">Room {code}</p>
          <p className="text-emerald-200/40 text-xs uppercase tracking-widest mb-3">Match complete</p>
          <h1 className="text-2xl font-serif italic text-amber-200/80 mb-2">🏆 Winners</h1>
          <div
            className="text-3xl md:text-4xl font-serif italic font-bold leading-tight px-4 py-3 rounded-2xl inline-block"
            style={{
              color: winner?.color ?? '#f5d989',
              background: `${winner?.color ?? '#f5d989'}15`,
              border: `2px solid ${winner?.color ?? '#f5d989'}80`,
              boxShadow: `0 0 30px ${winner?.color ?? '#f5d989'}40`,
            }}>
            {winner?.label}
          </div>
          <p className="text-amber-200 text-2xl font-serif italic mt-3">
            {winner?.total > 0 ? '+' : ''}{winner?.total}
          </p>
        </div>

        <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-5 mb-4">
          <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-4">Final ranking</p>
          <div className="space-y-2">
            {ranked.map((r, idx) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-3 py-3 rounded-xl"
                style={{
                  background: idx === 0
                    ? `${r.color}18`
                    : '#14271f',
                  border: idx === 0
                    ? `1.5px solid ${r.color}80`
                    : '1px solid rgba(34, 78, 60, 0.4)',
                }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg font-serif italic w-6 text-center"
                    style={{ color: idx === 0 ? r.color : '#86a294' }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                  </span>
                  {isTeamMode && (
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(r.avatars || []).map((a, i) => (
                      <Avatar key={i} avatarId={a.id} playerName={a.name} size="sm" />
                    ))}
                  </div>
                  <span className="text-sm truncate font-medium">
                    {r.label}
                    {r.amIIn && <span className="text-xs text-emerald-200/40 ml-1">(you)</span>}
                  </span>
                </div>
                <span className="text-2xl font-serif italic font-bold whitespace-nowrap"
                  style={{ color: r.total > 0 ? '#86efac' : r.total < 0 ? '#fca5a5' : '#e5d4a8' }}>
                  {r.total > 0 ? '+' : ''}{r.total}
                </span>
              </div>
            ))}
          </div>
        </div>

        {completedRounds.length > 0 && (
          <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4 mb-5 overflow-x-auto">
            <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-4">
              Round-by-round
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-emerald-200/40 uppercase tracking-wider">
                  <th className="text-left pb-2 pr-2">{isTeamMode ? 'Team' : 'Player'}</th>
                  {completedRounds.map((r) => (
                    <th key={r.round_num} className="px-1.5 pb-2 text-center">R{r.round_num}</th>
                  ))}
                  <th className="pl-2 pb-2 text-right">Σ</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((rk) => {
                  let running = 0;
                  return (
                    <tr key={rk.id} className="border-t border-emerald-900/30">
                      <td className="py-2 pr-2 truncate" style={{ maxWidth: 110 }}>
                        <div className="flex items-center gap-1.5">
                          {isTeamMode && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: rk.color }} />
                          )}
                          <span className="truncate">{rk.label}</span>
                        </div>
                      </td>
                      {completedRounds.map((r) => {
                        const s = isTeamMode
                          ? (r.team_scores?.[rk.id] ?? 0)
                          : (r.scores?.[rk.id] ?? 0);
                        running += s;
                        return (
                          <td key={r.round_num} className="px-1.5 py-2 text-center font-mono">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-2">
          {iAmHost && (
            <button onClick={onPlayAgain} disabled={playingAgain}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-50">
              {playingAgain ? 'Resetting...' : '🔄 Play Again'}
            </button>
          )}
          {iAmSpectator && (
            <div className="rounded-xl bg-amber-200/10 border border-amber-300/30 px-4 py-3 text-center">
              <p className="text-amber-200 text-sm font-medium mb-1">
                👁 Watching from the side
              </p>
              <p className="text-emerald-200/60 text-xs">
                You'll join the next match automatically when the host starts a new one.
              </p>
            </div>
          )}
          <button onClick={onLeaveRoom}
            className="w-full py-3 rounded-xl font-medium bg-[#14271f] border border-emerald-900/60 text-emerald-200 hover:bg-[#1a3024] transition">
            Leave Room
          </button>
          {!iAmHost && !iAmSpectator && (
            <p className="text-center text-emerald-200/40 text-xs mt-1">
              The host can start a new match
            </p>
          )}
        </div>     </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────
// ConfettiBurst
// ──────────────────────────────────────────────────────────
function ConfettiBurst() {
  const pieces = Array.from({ length: 60 }, (_, i) => i);
  const colors = ['#f5d989', '#7ab8d4', '#c47ab8', '#b8c47a', '#86efac', '#fca5a5', '#e5d4a8'];
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const duration = 2.5 + Math.random() * 1.5;
        const rot = Math.random() * 360;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 8;
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${left}%`,
            top: '-20px',
            width: size,
            height: size * 1.2,
            background: color,
            borderRadius: '2px',
            transform: `rotate(${rot}deg)`,
            animation: `confettiFall ${duration}s linear ${delay}s forwards`,
            opacity: 0.9,
          }} />
        );
      })}
      <style jsx>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0.95; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// PlayTable
// ──────────────────────────────────────────────────────────
function PlayTable({ seats, allHands, mySeat, currentTrick, currentPlayerSeatIdx, revealedWinner, talkingPlayers }) {
  const N = seats.length;
  if (N === 0 || !mySeat) return null;

  const mySeatIdx = mySeat.seat_index;
  const positioned = seats.map((s) => {
    let relativeIdx = (s.seat_index - mySeatIdx + N) % N;
    return { seat: s, relativeIdx };
  });

  const positionsByN = {
    2: [{ l: 50, t: 88 }, { l: 50, t: 12 }],
    3: [{ l: 50, t: 88 }, { l: 88, t: 30 }, { l: 12, t: 30 }],
    4: [{ l: 50, t: 88 }, { l: 88, t: 50 }, { l: 50, t: 12 }, { l: 12, t: 50 }],
    5: [{ l: 50, t: 88 }, { l: 88, t: 60 }, { l: 75, t: 15 }, { l: 25, t: 15 }, { l: 12, t: 60 }],
    6: [{ l: 50, t: 88 }, { l: 88, t: 60 }, { l: 80, t: 18 }, { l: 50, t: 12 }, { l: 20, t: 18 }, { l: 12, t: 60 }],
    7: [{ l: 50, t: 90 }, { l: 88, t: 65 }, { l: 85, t: 25 }, { l: 62, t: 10 }, { l: 38, t: 10 }, { l: 15, t: 25 }, { l: 12, t: 65 }],
    8: [{ l: 50, t: 90 }, { l: 85, t: 72 }, { l: 92, t: 40 }, { l: 72, t: 12 }, { l: 50, t: 8 }, { l: 28, t: 12 }, { l: 8, t: 40 }, { l: 15, t: 72 }],
  };
  const positions = positionsByN[N] ?? positionsByN[4];

  const trickPosByN = {
    2: [{ l: 50, t: 65 }, { l: 50, t: 35 }],
    3: [{ l: 50, t: 65 }, { l: 65, t: 42 }, { l: 35, t: 42 }],
    4: [{ l: 50, t: 65 }, { l: 65, t: 50 }, { l: 50, t: 35 }, { l: 35, t: 50 }],
    5: [{ l: 50, t: 65 }, { l: 65, t: 55 }, { l: 60, t: 38 }, { l: 40, t: 38 }, { l: 35, t: 55 }],
    6: [{ l: 50, t: 65 }, { l: 64, t: 56 }, { l: 60, t: 40 }, { l: 50, t: 35 }, { l: 40, t: 40 }, { l: 36, t: 56 }],
    7: [{ l: 50, t: 66 }, { l: 64, t: 58 }, { l: 62, t: 44 }, { l: 54, t: 36 }, { l: 46, t: 36 }, { l: 38, t: 44 }, { l: 36, t: 58 }],
    8: [{ l: 50, t: 66 }, { l: 62, t: 60 }, { l: 64, t: 48 }, { l: 58, t: 38 }, { l: 50, t: 35 }, { l: 42, t: 38 }, { l: 36, t: 48 }, { l: 38, t: 60 }],
  };
  const trickPositions = trickPosByN[N] ?? trickPosByN[4];

  // Felt scales slightly bigger for more players to give cards more room
  const feltSize = N <= 4 ? 52 : N <= 6 ? 58 : 62;
  // Cards arranged in an even ring around the center of the felt
  const totalTricks = currentTrick.length;
  // Ring radius (as % of container) — slightly smaller than felt edge
  const ringRadius = N <= 4 ? 14 : N <= 6 ? 17 : 19;
  const cardSize = N <= 4 ? 'md' : 'sm';

  return (
    <div className="relative w-full flex-1" style={{ minHeight: 380 }}>
      <div className="absolute"
        style={{
          left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: `${feltSize}%`, aspectRatio: '1',
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 45%, var(--theme-felt-from, #1f5e44) 0%, var(--theme-felt-mid, #0f3d2c) 60%, var(--theme-felt-to, #0a2519) 100%)`,
          border: '1px solid rgba(212, 182, 117, 0.35)',
          boxShadow: 'inset 0 0 24px rgba(0,0,0,0.5)',
        }}
      />

      {currentTrick.map((entry, i) => {
        // Evenly space cards in a circle. First card at top, going clockwise.
        const angle = (i / Math.max(1, totalTricks)) * 2 * Math.PI - Math.PI / 2;
        const left = 50 + ringRadius * Math.cos(angle);
        const top = 50 + ringRadius * Math.sin(angle);
        const isWinner = revealedWinner && revealedWinner.player_id === entry.player_id;
        return (
          <div key={`played-${i}`}
            className="absolute"
            style={{
              left: `${left}%`, top: `${top}%`,
              transform: 'translate(-50%, -50%)',
              animation: 'cardSlideIn 0.3s ease both',
              zIndex: 10 + i,
            }}>
            <div style={isWinner ? {
              boxShadow: '0 0 0 3px #f5d989, 0 0 28px rgba(245,217,137,0.8)',
              borderRadius: 10,
              transform: 'translateY(-4px)',
              transition: 'all 0.3s',
            } : undefined}>
              <PlayingCard card={entry.card} size={cardSize} />
            </div>
          </div>
        );
      })}

      {positioned.map(({ seat, relativeIdx }) => {
        const pos = positions[relativeIdx];
        if (!pos) return null;
        const isMe = seat.player_id === mySeat.player_id;
        const isTurn = seat.seat_index === currentPlayerSeatIdx && currentTrick.length < N && !revealedWinner;
        const isWinningSeat = revealedWinner && revealedWinner.player_id === seat.player_id;
        const handRow = allHands.find((h) => h.player_id === seat.player_id);
        const cardCount = handRow?.cards?.length ?? 0;
        const teamColor = seat.team_palette_idx != null ? TEAM_COLORS[seat.team_palette_idx] : null;

        return (
          <div key={seat.player_id}
            className="absolute"
            style={{
              left: `${pos.l}%`, top: `${pos.t}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: isWinningSeat ? 8 : 3,
            }}>
           <PlayerSeat
              seat={{ ...seat, _talking: talkingPlayers?.has(seat.player_id) ?? false }}
              isMe={isMe}
              isTurn={isTurn}
              isWinningSeat={isWinningSeat}
              cardCount={cardCount}
              teamColor={teamColor}
            />
          </div>
        );
      })}

      <style jsx>{`
        @keyframes cardSlideIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}

function PlayerSeat({ seat, isMe, isTurn, isWinningSeat, cardCount, teamColor }) {
  const showPile = !isMe;
  const fanCount = Math.min(cardCount, 7);
  const overlap = cardCount > 5 ? 8 : 12;

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{
        animation: isTurn ? 'turnPulse 1.4s ease-in-out infinite' : undefined,
        padding: 4,
        borderRadius: 12,
        background: isWinningSeat ? 'rgba(245, 217, 137, 0.12)' : 'transparent',
        boxShadow: isWinningSeat
          ? '0 0 0 2px #f5d989, 0 0 30px rgba(245,217,137,0.7)'
          : undefined,
        transition: 'box-shadow 0.3s, background 0.3s',
      }}>
      {showPile && (
        <div className="relative" style={{
          width: fanCount > 0 ? 36 + (fanCount - 1) * overlap : 50,
          height: 50,
        }}>
          {cardCount > 0 ? (
            Array.from({ length: fanCount }).map((_, i) => (
              <div key={i} className="absolute" style={{
                left: i * overlap,
                top: 0,
                transform: `rotate(${(i - (fanCount - 1) / 2) * 4}deg)`,
                transformOrigin: 'bottom center',
                zIndex: i,
              }}>
                <PlayingCard faceDown size="sm" />
              </div>
            ))
          ) : (
            <div style={{
              width: 36, height: 50,
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.2)', fontSize: 9,
            }}>empty</div>
          )}
        </div>
      )}

     <div className="flex items-center gap-1.5 mt-1">
        <div className="relative">
          <Avatar avatarId={seat.avatar_id} playerName={seat.name} size="xs" borderColor={teamColor} />
          {seat._talking && (
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                boxShadow: '0 0 0 2px #4ade80, 0 0 10px #4ade80',
                animation: 'talkingPulse 0.8s ease-in-out infinite',
              }}
            />
          )}
        </div>
        <div
          className="px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap shadow-md"
          style={{
            background: isWinningSeat ? '#f5d989' : isTurn ? 'rgba(245, 217, 137, 0.95)' : 'rgba(7, 16, 12, 0.92)',
            color: (isWinningSeat || isTurn) ? '#07100c' : '#ecfdf5',
            border: teamColor ? `1.5px solid ${teamColor}` : '1px solid rgba(34, 78, 60, 0.6)',
            maxWidth: 90,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
          {seat.name?.length > 9 ? seat.name.slice(0, 8) + '…' : seat.name}
          {isMe && <span className="opacity-50 text-[9px] ml-1">(you)</span>}
        </div>
      </div>

      <style jsx>{`
        @keyframes turnPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}

function computeTeamTotals(allRounds) {
  const totals = {};
  for (const r of allRounds) {
    if (!r.team_scores) continue;
    for (const [tId, score] of Object.entries(r.team_scores)) {
      totals[tId] = (totals[tId] ?? 0) + score;
    }
  }
  return totals;
}

function computeIndivTotals(allRounds) {
  const totals = {};
  for (const r of allRounds) {
    if (!r.scores) continue;
    for (const [pid, score] of Object.entries(r.scores)) {
      totals[pid] = (totals[pid] ?? 0) + score;
    }
  }
  return totals;
}

function CumulativeScoreboard({ allRounds, teamOrder, teamsByTeam, seatedPlayers, isTeamMode, title }) {
  const teamTotals = computeTeamTotals(allRounds);
  const indivTotals = computeIndivTotals(allRounds);

  const hasAnyScores =
    allRounds.some((r) => r.team_scores && Object.keys(r.team_scores).length > 0) ||
    allRounds.some((r) => r.scores && Object.keys(r.scores).length > 0);
  if (!hasAnyScores) return null;

  return (
    <div className="bg-emerald-950/30 border border-emerald-900/60 rounded-2xl p-4 mb-4">
      <p className="text-xs uppercase tracking-widest text-emerald-200/60 text-center mb-3">
        {title ?? 'Match scoreboard'}
      </p>
      <div className="space-y-2">
        {isTeamMode ? teamOrder.map((tId) => {
          const teamSeats = teamsByTeam[tId] || [];
          const teamColor = TEAM_COLORS[teamSeats[0]?.team_palette_idx ?? 0];
          const total = teamTotals[tId] ?? 0;
          return (
            <div key={tId} className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: teamColor }} />
                <span className="text-sm truncate">{teamSeats.map((s) => s.name).join(' + ')}</span>
              </div>
              <AnimatedScore
                value={total}
                className="text-xl font-serif italic font-bold"
                style={{ color: total > 0 ? '#86efac' : total < 0 ? '#fca5a5' : '#e5d4a8' }}
              />
            </div>
          );
        }) : seatedPlayers
          .slice()
          .sort((a, b) => (indivTotals[b.player_id] ?? 0) - (indivTotals[a.player_id] ?? 0))
          .map((s) => {
            const total = indivTotals[s.player_id] ?? 0;
            return (
              <div key={s.player_id} className="flex items-center justify-between px-2">
                <span className="text-sm truncate">{s.name}</span>
                <AnimatedScore
                  value={total}
                  className="text-xl font-serif italic font-bold"
                  style={{ color: total > 0 ? '#86efac' : total < 0 ? '#fca5a5' : '#e5d4a8' }}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// BidSumToast — small toast notification matching V1 style
// ──────────────────────────────────────────────────────────
function BidSumToast({ allBidsLocked, totalBids, tricksAvailable, roundKey }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!allBidsLocked) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [allBidsLocked, roundKey]);

  if (!visible) return null;

  const diff = totalBids - tricksAvailable;
  let message, color;
  if (diff === 0) {
    message = 'Correct bets';
    color = '#86efac';
  } else if (diff < 0) {
    message = 'Under bets';
    color = '#f5d989';
  } else {
    message = 'Over bets';
    color = '#fca5a5';
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 30,
        transform: 'translateX(-50%)',
        background: '#1a3127',
        border: `1px solid ${color}66`,
        color: color,
        padding: '12px 22px',
        borderRadius: 12,
        fontSize: '0.95rem',
        fontWeight: 500,
        boxShadow: '0 12px 40px -12px rgba(0,0,0,0.6)',
        zIndex: 300,
        animation: 'toastIn 0.25s ease',
        fontFamily: 'inherit',
      }}
    >
      {message}
      <style jsx>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// SpectatorTable — god-mode view of the table showing all hands face-up
// ──────────────────────────────────────────────────────────
function SpectatorTable({ seats, allHands, currentTrick, currentPlayerSeatIdx, revealedWinner, N }) {
  if (N === 0) return null;

  // Position seats in a circle. Spectator sees from outside, all seats equal weight.
  const positionsByN = {
    2: [{ l: 50, t: 88 }, { l: 50, t: 12 }],
    3: [{ l: 50, t: 88 }, { l: 88, t: 30 }, { l: 12, t: 30 }],
    4: [{ l: 50, t: 88 }, { l: 88, t: 50 }, { l: 50, t: 12 }, { l: 12, t: 50 }],
    5: [{ l: 50, t: 88 }, { l: 88, t: 60 }, { l: 75, t: 15 }, { l: 25, t: 15 }, { l: 12, t: 60 }],
    6: [{ l: 50, t: 88 }, { l: 88, t: 60 }, { l: 80, t: 18 }, { l: 50, t: 12 }, { l: 20, t: 18 }, { l: 12, t: 60 }],
    7: [{ l: 50, t: 90 }, { l: 88, t: 65 }, { l: 85, t: 25 }, { l: 62, t: 10 }, { l: 38, t: 10 }, { l: 15, t: 25 }, { l: 12, t: 65 }],
    8: [{ l: 50, t: 90 }, { l: 85, t: 72 }, { l: 92, t: 40 }, { l: 72, t: 12 }, { l: 50, t: 8 }, { l: 28, t: 12 }, { l: 8, t: 40 }, { l: 15, t: 72 }],
  };
  const positions = positionsByN[N] ?? positionsByN[4];

  const trickPosByN = {
    2: [{ l: 50, t: 65 }, { l: 50, t: 35 }],
    3: [{ l: 50, t: 65 }, { l: 65, t: 42 }, { l: 35, t: 42 }],
    4: [{ l: 50, t: 65 }, { l: 65, t: 50 }, { l: 50, t: 35 }, { l: 35, t: 50 }],
    5: [{ l: 50, t: 65 }, { l: 65, t: 55 }, { l: 60, t: 38 }, { l: 40, t: 38 }, { l: 35, t: 55 }],
    6: [{ l: 50, t: 65 }, { l: 64, t: 56 }, { l: 60, t: 40 }, { l: 50, t: 35 }, { l: 40, t: 40 }, { l: 36, t: 56 }],
    7: [{ l: 50, t: 66 }, { l: 64, t: 58 }, { l: 62, t: 44 }, { l: 54, t: 36 }, { l: 46, t: 36 }, { l: 38, t: 44 }, { l: 36, t: 58 }],
    8: [{ l: 50, t: 66 }, { l: 62, t: 60 }, { l: 64, t: 48 }, { l: 58, t: 38 }, { l: 50, t: 35 }, { l: 42, t: 38 }, { l: 36, t: 48 }, { l: 38, t: 60 }],
  };
  const trickPositions = trickPosByN[N] ?? trickPosByN[4];

  // Felt scales slightly bigger for more players
  const feltSize = N <= 4 ? 52 : N <= 6 ? 58 : 62;
  const totalTricks = currentTrick.length;
  const ringRadius = N <= 4 ? 14 : N <= 6 ? 17 : 19;
  const cardSize = N <= 4 ? 'md' : 'sm';

  return (
    <div className="relative w-full flex-1" style={{ minHeight: 460 }}>
      {/* Central felt table */}
      <div className="absolute"
        style={{
          left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: `${feltSize}%`, aspectRatio: '1',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 45%, #1f5e44 0%, #0f3d2c 60%, #0a2519 100%)',
          border: '1px solid rgba(212, 182, 117, 0.35)',
          boxShadow: 'inset 0 0 24px rgba(0,0,0,0.5)',
        }}
      />

      {/* Cards played in current trick — evenly spaced in a circle */}
      {currentTrick.map((entry, i) => {
        const angle = (i / Math.max(1, totalTricks)) * 2 * Math.PI - Math.PI / 2;
        const left = 50 + ringRadius * Math.cos(angle);
        const top = 50 + ringRadius * Math.sin(angle);
        const isWinner = revealedWinner && revealedWinner.player_id === entry.player_id;
        return (
          <div key={`played-${i}`}
            className="absolute"
            style={{
              left: `${left}%`, top: `${top}%`,
              transform: 'translate(-50%, -50%)',
              animation: 'cardSlideInSpec 0.3s ease both',
              zIndex: 10 + i,
            }}>
            <div style={isWinner ? {
              boxShadow: '0 0 0 3px #f5d989, 0 0 28px rgba(245,217,137,0.8)',
              borderRadius: 10,
              transform: 'translateY(-4px)',
              transition: 'all 0.3s',
            } : undefined}>
              <PlayingCard card={entry.card} size={cardSize} />
            </div>
          </div>
        );
      })}

      {/* All seats around the table — god-mode shows their HAND face up */}
      {seats.map((seat) => {
        const pos = positions[seat.seat_index];
        if (!pos) return null;
        const isTurn = seat.seat_index === currentPlayerSeatIdx && currentTrick.length < N && !revealedWinner;
        const isWinningSeat = revealedWinner && revealedWinner.player_id === seat.player_id;
        const handRow = allHands.find((h) => h.player_id === seat.player_id);
        const cards = handRow?.cards ?? [];
        const teamColor = seat.team_palette_idx != null ? TEAM_COLORS[seat.team_palette_idx] : null;

        return (
          <div key={seat.player_id}
            className="absolute"
            style={{
              left: `${pos.l}%`, top: `${pos.t}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: isWinningSeat ? 8 : 3,
            }}>
            <SpectatorSeat
              seat={seat}
              cards={cards}
              isTurn={isTurn}
              isWinningSeat={isWinningSeat}
              teamColor={teamColor}
            />
          </div>
        );
      })}

      <style jsx>{`
        @keyframes cardSlideInSpec {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}

function SpectatorSeat({ seat, cards, isTurn, isWinningSeat, teamColor }) {
  // Show cards small + horizontal so they fit. If >7 cards, fan + overlap.
  const visibleCards = cards.slice(0, 10); // safety cap
  const overlap = cards.length > 5 ? 14 : 18;

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{
        animation: isTurn ? 'turnPulseSpec 1.4s ease-in-out infinite' : undefined,
        padding: 4,
        borderRadius: 12,
        background: isWinningSeat ? 'rgba(245, 217, 137, 0.12)' : 'transparent',
        boxShadow: isWinningSeat
          ? '0 0 0 2px #f5d989, 0 0 30px rgba(245,217,137,0.7)'
          : undefined,
        transition: 'box-shadow 0.3s, background 0.3s',
      }}>
      <div className="relative" style={{
        width: visibleCards.length > 0 ? 36 + (visibleCards.length - 1) * overlap : 50,
        height: 54,
      }}>
        {visibleCards.length > 0 ? (
          visibleCards.map((c, i) => (
            <div key={i} className="absolute" style={{
              left: i * overlap,
              top: 0,
              transform: `rotate(${(i - (visibleCards.length - 1) / 2) * 3}deg)`,
              transformOrigin: 'bottom center',
              zIndex: i,
            }}>
              <PlayingCard card={c} size="sm" />
            </div>
          ))
        ) : (
          <div style={{
            width: 36, height: 50,
            border: '1px dashed rgba(255,255,255,0.15)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.2)', fontSize: 9,
          }}>empty</div>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-1">
        <Avatar avatarId={seat.avatar_id} playerName={seat.name} size="xs" borderColor={teamColor} />
        <div
          className="px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap shadow-md"
          style={{
            background: isWinningSeat ? '#f5d989' : isTurn ? 'rgba(245, 217, 137, 0.95)' : 'rgba(7, 16, 12, 0.92)',
            color: (isWinningSeat || isTurn) ? '#07100c' : '#ecfdf5',
            border: teamColor ? `1.5px solid ${teamColor}` : '1px solid rgba(34, 78, 60, 0.6)',
            maxWidth: 110,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
          {seat.name?.length > 11 ? seat.name.slice(0, 10) + '…' : seat.name}
        </div>
      </div>

      <style jsx>{`
        @keyframes turnPulseSpec {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}