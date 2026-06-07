'use client';

import { useEffect } from 'react';
import { supabase } from './supabase';
import { isPlayerStale } from './usePresence';

/**
 * Runs only when I'm the OLDEST non-host player in the room.
 * Every 30 seconds, checks if the current host has gone stale (last_seen_at > 60s old).
 * If yes, promotes me to host so the game can continue.
 *
 * This is decentralized — whichever client is the oldest non-host runs the check.
 * Single writer at any moment (the oldest player), so no race conditions.
 */
export function useHostPromotion(code, myPlayerId) {
  useEffect(() => {
    if (!code || !myPlayerId) return;

    let cancelled = false;

    async function checkAndMaybePromote() {
      if (cancelled) return;
      // Fetch all players in room, ordered by join time
      const { data: players } = await supabase
        .from('players')
        .select('id, is_host, last_seen_at, joined_at, is_spectator')
        .eq('room_code', code)
        .order('joined_at', { ascending: true });

      if (!players || players.length === 0) return;

      const host = players.find((p) => p.is_host);
      if (!host) {
        // No host at all! Promote oldest non-spectator.
        const oldestEligible = players.find((p) => !p.is_spectator);
        if (oldestEligible && oldestEligible.id === myPlayerId) {
          await promote(myPlayerId, code);
        }
        return;
      }

      // Host exists. Check if they're stale.
      if (!isPlayerStale(host.last_seen_at, 45)) return; // Host is alive
      if (host.id === myPlayerId) return; // I'M the host, ignore

      // Host is stale. Am I the oldest non-host non-spectator?
      const eligibleNonHosts = players.filter(
        (p) => !p.is_host && !p.is_spectator
      );
      const oldestNonHost = eligibleNonHosts[0];
      if (oldestNonHost && oldestNonHost.id === myPlayerId) {
        await promote(myPlayerId, code, host.id);
      }
    }

    async function promote(newHostId, roomCode, oldHostId = null) {
      // Demote old host (if any) and promote me
      if (oldHostId) {
        await supabase.from('players').update({ is_host: false }).eq('id', oldHostId);
      }
      await supabase.from('players').update({ is_host: true }).eq('id', newHostId);
      // Update rooms.host_player_id to point to the new host
      await supabase.from('rooms').update({ host_player_id: newHostId }).eq('code', roomCode);
    }

    // Run immediately + every 30 seconds
    checkAndMaybePromote();
    const interval = setInterval(checkAndMaybePromote, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [code, myPlayerId]);
}