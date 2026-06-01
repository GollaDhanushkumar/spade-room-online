'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RoomPage({ params }) {
  const { code } = use(params);
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [players, setPlayers] = useState([]);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(`spade-room-${code}`);
    if (!saved) {
      router.push('/');
      return;
    }
    setMe(JSON.parse(saved));
  }, [code, router]);

  useEffect(() => {
    if (!me) return;

    let cancelled = false;

    async function loadInitial() {
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single();
      if (roomErr || !roomData) {
        if (!cancelled) {
          setError('Room not found.');
          setLoading(false);
        }
        return;
      }

      const { data: playerData, error: playerErr } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', code)
        .order('joined_at', { ascending: true });
      if (playerErr) {
        if (!cancelled) {
          setError('Could not load players.');
          setLoading(false);
        }
        return;
      }

      // If I'm not in the player list, I was kicked or my row was deleted
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
      }
    }

    loadInitial();

    const channel = supabase
      .channel(`room-${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${code}` },
        () => {
          supabase
            .from('players')
            .select('*')
            .eq('room_code', code)
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        (payload) => {
          if (!cancelled) setRoom(payload.new);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me, code, router]);

  async function handleLeave() {
    if (!me) return;
    await supabase.from('players').delete().eq('id', me.playerId);
    localStorage.removeItem(`spade-room-${code}`);
    router.push('/');
  }

  async function handleKick(playerId) {
    if (!confirm('Kick this player?')) return;
    await supabase.from('players').delete().eq('id', playerId);
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_code', code)
      .order('joined_at', { ascending: true });
    if (data) setPlayers(data);
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // ignore
    }
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
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 rounded-xl bg-amber-300 text-[#07100c] font-semibold"
        >
          Go home
        </button>
      </main>
    );
  }

  const iAmHost = me && players.some((p) => p.id === me.playerId && p.is_host);
  const playerCount = players.filter((p) => !p.is_spectator).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a1410] to-[#0f3d2c] text-emerald-50 px-6 py-10">
      <div className="max-w-md mx-auto">

        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-2">
            Room Code
          </p>
          <button
            onClick={handleCopyCode}
            className="text-5xl font-mono font-bold text-amber-200 tracking-widest hover:text-amber-100 transition"
            title="Click to copy"
          >
            {code}
          </button>
          <p className="text-emerald-200/40 text-xs mt-2">
            Tap the code to copy. Share with your friends.
          </p>
        </div>

        <div className="bg-[#0f1d18] border border-emerald-900 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-widest text-emerald-200/60">
              Players
            </h2>
            <span className="text-xs text-emerald-200/40 font-mono">
              {playerCount} in the room
            </span>
          </div>
          <ul className="space-y-2">
            {players.map((p) => {
              const isMe = me && p.id === me.playerId;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#14271f] border border-emerald-900/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="font-medium truncate">
                      {p.name}
                      {isMe && (
                        <span className="text-emerald-200/40 text-xs ml-2">
                          (you)
                        </span>
                      )}
                    </span>
                    {p.is_host && (
                      <span className="text-amber-300 text-xs">👑 host</span>
                    )}
                    {p.is_spectator && (
                      <span className="text-emerald-200/40 text-xs">
                        👁 spectator
                      </span>
                    )}
                  </div>
                  {iAmHost && !isMe && (
                    <button
                      onClick={() => handleKick(p.id)}
                      className="text-red-400/70 hover:text-red-400 text-xs px-2 py-1 rounded transition"
                    >
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
              onClick={() => alert('Game start coming next phase!')}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-40 disabled:cursor-not-allowed"
            >
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

          <button
            onClick={handleLeave}
            className="w-full py-3 rounded-xl border border-red-900/40 text-red-400/80 hover:bg-red-950/30 transition text-sm"
          >
            Leave Room
          </button>
        </div>
      </div>
    </main>
  );
}