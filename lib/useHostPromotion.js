'use client';

import { useEffect } from 'react';
import { supabase } from './supabase';
import { isPlayerStale, STALE_SECONDS } from './usePresence';

const CHECK_MS = 5000;

export function useHostPromotion(code, myPlayerId) {
  useEffect(() => {
    if (!code || !myPlayerId) return;

    let cancelled = false;

    async function promote(newHostId) {
      await supabase
        .from('players')
        .update({ is_host: false })
        .eq('room_code', code);

      await supabase
        .from('players')
        .update({ is_host: true })
        .eq('id', newHostId);

      await supabase
        .from('rooms')
        .update({ host_player_id: newHostId })
        .eq('code', code);
    }

    async function checkAndMaybePromote() {
      if (cancelled) return;

      const { data: players, error } = await supabase
        .from('players')
        .select('id, is_host, last_seen_at, joined_at, is_spectator, spectator_status')
        .eq('room_code', code)
        .order('joined_at', { ascending: true });

      if (cancelled || error || !players?.length) return;

      const activeEligiblePlayers = players.filter(
        (p) =>
          !p.is_spectator &&
          p.spectator_status !== 'pending' &&
          p.spectator_status !== 'ghost' &&
          !isPlayerStale(p.last_seen_at, STALE_SECONDS)
      );

      if (activeEligiblePlayers.length === 0) return;

      const host = players.find((p) => p.is_host);

      if (host && !isPlayerStale(host.last_seen_at, STALE_SECONDS)) {
        return;
      }

      const nextHost =
        activeEligiblePlayers.find((p) => p.id !== host?.id) ||
        activeEligiblePlayers[0];

      if (nextHost?.id === myPlayerId) {
        await promote(myPlayerId);
      }
    }

    checkAndMaybePromote();

    const interval = setInterval(checkAndMaybePromote, CHECK_MS);

    const channel = supabase
      .channel(`host-promotion-${code}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${code}`,
        },
        () => checkAndMaybePromote()
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [code, myPlayerId]);
}