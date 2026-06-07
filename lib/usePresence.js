'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/**
 * Heartbeats the player's last_seen_at every 20 seconds while the tab is open.
 * Also pings immediately on mount, on visibility change, and on focus.
 *
 * Other clients can check last_seen_at to detect stale/disconnected players.
 * Threshold for "disconnected": last_seen_at older than 45 seconds.
 */
export function usePresence(playerId) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!playerId) return;

    async function ping() {
      try {
        await supabase
          .from('players')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', playerId);
      } catch (e) {
        // Swallow errors — heartbeats failing shouldn't break the app
      }
    }

    ping();
    intervalRef.current = setInterval(ping, 20000);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') ping();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', ping);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', ping);
    };
  }, [playerId]);
}

/**
 * Helper: check if a player is "stale" (last_seen_at older than threshold).
 * Returns true if player should be considered disconnected.
 */
export function isPlayerStale(lastSeenAt, thresholdSeconds = 45) {
  if (!lastSeenAt) return true;
  const last = new Date(lastSeenAt).getTime();
  const now = Date.now();
  return (now - last) > thresholdSeconds * 1000;
}

/**
 * Hook that returns a Set of player IDs that are currently stale (offline).
 * Re-checks every 10 seconds. Subscribes to player updates so heartbeats
 * coming back refresh the offline list quickly.
 */
export function useStalePlayers(code, thresholdSeconds = 45) {
  const [stalePlayerIds, setStalePlayerIds] = useState(new Set());

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function refresh() {
      const { data } = await supabase
        .from('players')
        .select('id, last_seen_at')
        .eq('room_code', code);
      if (cancelled || !data) return;
      const stale = new Set(
        data.filter((p) => isPlayerStale(p.last_seen_at, thresholdSeconds)).map((p) => p.id)
      );
      setStalePlayerIds(stale);
    }

    refresh();
    const interval = setInterval(refresh, 10000);

    // Also refresh when any player row updates (heartbeat came in)
    const channel = supabase
      .channel(`stale-${code}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `room_code=eq.${code}` },
        () => { refresh(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [code, thresholdSeconds]);

  return stalePlayerIds;
}