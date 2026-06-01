'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function generateId() {
    return Math.random().toString(36).slice(2, 12);
  }

  async function handleCreateRoom() {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    setLoading(true);

    const code = generateRoomCode();
    const hostId = generateId();
    const token = generateId();

    // Create the room
    const { error: roomError } = await supabase
      .from('rooms')
      .insert({ code, host_player_id: hostId, status: 'lobby' });

    if (roomError) {
      setError('Could not create room: ' + roomError.message);
      setLoading(false);
      return;
    }

    // Add the host as the first player
    const { error: playerError } = await supabase.from('players').insert({
      id: hostId,
      room_code: code,
      name: name.trim(),
      is_host: true,
      is_spectator: false,
      connection_token: token,
    });

    if (playerError) {
      setError('Could not join room: ' + playerError.message);
      setLoading(false);
      return;
    }

    // Save connection info in browser so this player can reconnect
    localStorage.setItem(
      `spade-room-${code}`,
      JSON.stringify({ playerId: hostId, token, name: name.trim() })
    );

    router.push(`/room/${code}`);
  }

  async function handleJoinRoom() {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    setError('');
    setLoading(true);

    const code = roomCode.trim().toUpperCase();

    // Check room exists
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('code, status')
      .eq('code', code)
      .single();

    if (roomError || !room) {
      setError('Room not found. Check the code and try again.');
      setLoading(false);
      return;
    }

    const playerId = generateId();
    const token = generateId();
    const isSpectator = room.status !== 'lobby'; // joined after game started

    const { error: playerError } = await supabase.from('players').insert({
      id: playerId,
      room_code: code,
      name: name.trim(),
      is_host: false,
      is_spectator: isSpectator,
      connection_token: token,
    });

    if (playerError) {
      if (playerError.code === '23505') {
        setError('That name is already taken in this room. Pick another.');
      } else {
        setError('Could not join: ' + playerError.message);
      }
      setLoading(false);
      return;
    }

    localStorage.setItem(
      `spade-room-${code}`,
      JSON.stringify({ playerId, token, name: name.trim() })
    );

    router.push(`/room/${code}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-b from-[#0a1410] to-[#0f3d2c]">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-2xl tracking-tighter mb-2">
            <span className="text-white">♠</span>
            <span className="text-red-400">♥</span>
            <span className="text-red-400">♦</span>
            <span className="text-white">♣</span>
          </div>
          <h1 className="text-5xl font-serif italic text-amber-200">
            The Spade Room
          </h1>
          <p className="text-emerald-200/60 mt-3 text-sm">
            Play Spades online with friends, anywhere
          </p>
        </div>

        {mode === null && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] hover:from-amber-100 hover:to-amber-300 transition"
            >
              Create a Room
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-xl font-semibold bg-transparent border border-emerald-700 text-emerald-100 hover:bg-emerald-900/40 transition"
            >
              Join a Room
            </button>
          </div>
        )}

        {mode !== null && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="What should we call you?"
                className="w-full px-4 py-3 rounded-xl bg-[#0f1d18] border border-emerald-900 text-emerald-50 placeholder-emerald-700 focus:outline-none focus:border-amber-300"
              />
            </div>

            {mode === 'join' && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ABCDEF"
                  className="w-full px-4 py-3 rounded-xl bg-[#0f1d18] border border-emerald-900 text-emerald-50 placeholder-emerald-700 focus:outline-none focus:border-amber-300 uppercase tracking-widest text-center text-lg font-mono"
                />
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              onClick={mode === 'create' ? handleCreateRoom : handleJoinRoom}
              disabled={loading}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] hover:from-amber-100 hover:to-amber-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Loading...'
                : mode === 'create'
                ? 'Create Room'
                : 'Join Room'}
            </button>
            <button
              onClick={() => {
                setMode(null);
                setError('');
              }}
              className="w-full py-3 text-emerald-200/60 hover:text-emerald-100 transition text-sm"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </main>
  );
}