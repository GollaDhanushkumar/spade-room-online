'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Avatar from './Avatar';

/**
 * Shown when a user lands on a room URL with NO matching localStorage.
 * Checks if any players in the room match what they might be coming back to,
 * and offers a quick "Rejoin as X?" UI.
 *
 * If they pick one → restores their session.
 * If they pick "I'm new" → goes back to home for a fresh join.
 */
export default function RejoinPrompt({ code, onRejoin, onCancel }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('id, name, avatar_id, is_host, last_seen_at')
        .eq('room_code', code)
        .order('joined_at', { ascending: true });
      if (!cancelled) {
        setPlayers(data || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [code]);

  function handlePick(p) {
    onRejoin({
      playerId: p.id,
      name: p.name,
      avatarId: p.avatar_id,
      token: 'rejoined-' + Math.random().toString(36).slice(2, 10),
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a1410] to-[#0f3d2c] text-emerald-50 px-6 py-10 flex flex-col items-center justify-center">
      <div className="max-w-md w-full">
        <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-2 text-center">
          Room {code}
        </p>
        <h1 className="text-2xl font-serif italic text-amber-200 mb-1 text-center">
          Welcome back
        </h1>
        <p className="text-emerald-200/50 text-sm mb-6 text-center">
          Tap your name to rejoin where you left off.
        </p>

        {loading ? (
          <p className="text-emerald-200/40 text-center text-sm">Loading...</p>
        ) : players.length === 0 ? (
          <div className="bg-[#0f1d18] border border-emerald-900 rounded-2xl p-5 text-center">
            <p className="text-emerald-200/60 text-sm mb-4">
              This room is empty or doesn't exist anymore.
            </p>
            <button
              onClick={onCancel}
              className="w-full py-3 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c]"
            >
              Back to home
            </button>
          </div>
        ) : (
          <>
            <div className="bg-[#0f1d18] border border-emerald-900 rounded-2xl p-4 space-y-2 mb-4">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePick(p)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#14271f] border border-emerald-900/50 hover:bg-[#1a3024] hover:border-amber-300/40 active:scale-[0.98] transition text-left"
                >
                  <Avatar avatarId={p.avatar_id} playerName={p.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    {p.is_host && (
                      <p className="text-amber-300/80 text-xs">👑 host</p>
                    )}
                  </div>
                  <span className="text-emerald-200/40 text-xs">tap to rejoin</span>
                </button>
              ))}
            </div>
            <button
              onClick={onCancel}
              className="w-full py-3 rounded-xl border border-emerald-900 text-emerald-200/70 hover:bg-emerald-950/40 transition text-sm"
            >
              I'm new — go back home
            </button>
          </>
        )}
      </div>
    </main>
  );
}