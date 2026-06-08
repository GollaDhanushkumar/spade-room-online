'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { pickRandomAvatar, getAvatarById } from '@/lib/avatars';
import AvatarPicker from '@/components/AvatarPicker';
import Avatar from '@/components/Avatar';
import InstallAppButton from '@/components/InstallAppButton';
import SplashScreen from '@/components/SplashScreen';

const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += SAFE_ALPHABET[Math.floor(Math.random() * SAFE_ALPHABET.length)];
  }
  return code;
}

function generatePlayerId() {
  return Math.random().toString(36).slice(2, 12);
}

function generateToken() {
  return Math.random().toString(36).slice(2, 18);
}

export default function HomePage() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState(null);
  const [takenAvatars, setTakenAvatars] = useState([]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // When in "join" mode and code is 6 chars, fetch already-taken avatars for that room
  useEffect(() => {
    if (mode !== 'join' || code.length !== 6) {
      setTakenAvatars([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('players')
        .select('avatar_id')
        .eq('room_code', code.toUpperCase());
      if (!cancelled) {
        setTakenAvatars((data || []).map((p) => p.avatar_id).filter(Boolean));
      }
    })();
    return () => { cancelled = true; };
  }, [mode, code]);

  async function handleCreate() {
    setError('');
    if (!name.trim()) { setError('Enter your name first.'); return; }
    setLoading(true);

    let avatarId = selectedAvatarId;
    if (!avatarId) avatarId = pickRandomAvatar().id;

    const newCode = generateRoomCode();
    const playerId = generatePlayerId();
    const token = generateToken();

    const { error: roomErr } = await supabase.from('rooms').insert({
      code: newCode,
      status: 'lobby',
      host_player_id: playerId,
    });
    if (roomErr) { setError('Could not create room: ' + roomErr.message); setLoading(false); return; }

    const { error: playerErr } = await supabase.from('players').insert({
      id: playerId,
      room_code: newCode,
      name: name.trim(),
      is_host: true,
      is_spectator: false,
      connection_token: token,
      avatar_id: avatarId,
    });
    if (playerErr) { setError('Could not join: ' + playerErr.message); setLoading(false); return; }

    localStorage.setItem(`spade-room-${newCode}`, JSON.stringify({
      playerId, token, name: name.trim(), avatarId,
    }));
    router.push(`/room/${newCode}`);
  }

  async function handleJoin() {
    setError('');
    if (!name.trim()) { setError('Enter your name first.'); return; }
    if (code.length !== 6) { setError('Enter the 6-letter room code.'); return; }
    setLoading(true);

    const upperCode = code.toUpperCase();
    const { data: room } = await supabase.from('rooms').select('*').eq('code', upperCode).single();
    if (!room) { setError('Room not found.'); setLoading(false); return; }

    let avatarId = selectedAvatarId;
    if (!avatarId || takenAvatars.includes(avatarId)) {
      avatarId = pickRandomAvatar(takenAvatars).id;
    }

    const playerId = generatePlayerId();
    const token = generateToken();

    const { error: playerErr } = await supabase.from('players').insert({
      id: playerId,
      room_code: upperCode,
      name: name.trim(),
      is_host: false,
      is_spectator: room.status !== 'lobby',
      connection_token: token,
      avatar_id: avatarId,
    });
    if (playerErr) {
      if (playerErr.message?.includes('duplicate')) {
        setError('That name is already taken in this room.');
      } else {
        setError('Could not join: ' + playerErr.message);
      }
      setLoading(false);
      return;
    }

    localStorage.setItem(`spade-room-${upperCode}`, JSON.stringify({
      playerId, token, name: name.trim(), avatarId,
    }));
    router.push(`/room/${upperCode}`);
  }

  if (mode === null) {
    return (
      <>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a1410] to-[#0f3d2c] px-6">
        <div className="max-w-sm w-full text-center">
          <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-2">welcome to</p>
          <h1 className="text-4xl font-serif italic text-amber-200 mb-2">The Spade Room</h1>
          <p className="text-emerald-200/50 text-sm mb-10">
            Play Spades online with friends.
          </p>
        <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c]"
            >
              Create a Room
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-xl font-medium bg-[#0f1d18] border border-emerald-900 text-emerald-100 hover:bg-[#14271f] transition"
            >
              Join a Room
            </button>
          </div>

          <div className="mt-8 flex justify-center">
            <InstallAppButton />
          </div>
        </div>
      </main>
      </>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a1410] to-[#0f3d2c] px-6 py-10">
      <div className="max-w-sm mx-auto">
        <button
          onClick={() => { setMode(null); setError(''); setShowAvatarPicker(false); }}
          className="text-emerald-200/60 text-sm mb-6 hover:text-emerald-100 transition"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-serif italic text-amber-200 mb-1">
          {mode === 'create' ? 'Create a Room' : 'Join a Room'}
        </h1>
        <p className="text-emerald-200/50 text-sm mb-6">
          {mode === 'create' ? 'Start a new game.' : 'Enter the room code your friend shared.'}
        </p>

        <div className="space-y-4">
          {mode === 'join' && (
            <div>
              <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">
                Room code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABCDEF"
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl bg-[#0f1d18] border border-emerald-900 text-amber-200 font-mono text-2xl tracking-widest text-center placeholder-emerald-200/20 focus:border-amber-300 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              placeholder="Type a name..."
              maxLength={20}
              className="w-full px-4 py-3 rounded-xl bg-[#0f1d18] border border-emerald-900 text-emerald-100 focus:border-amber-300 outline-none"
            />
          </div>

          {/* Avatar selection */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-emerald-200/60 mb-2">
              Avatar
            </label>
            <div className="flex items-center gap-3 mb-3">
              <Avatar avatarId={selectedAvatarId} playerName={name} size="lg" />
              <div className="flex-1">
                <p className="text-sm text-emerald-100">
                  {selectedAvatarId ? getAvatarById(selectedAvatarId)?.name ?? 'Picked' : 'Random (skip)'}
                </p>
                <p className="text-xs text-emerald-200/40">
                  {selectedAvatarId ? 'Tap below to change' : 'Or pick one yourself'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarPicker((v) => !v)}
                className="text-xs px-3 py-2 rounded-lg border border-emerald-900 text-emerald-200/80 hover:bg-emerald-950/40 transition"
              >
                {showAvatarPicker ? 'Hide' : 'Choose'}
              </button>
            </div>
            {showAvatarPicker && (
              <div className="bg-[#0f1d18] border border-emerald-900 rounded-xl p-3 max-h-72 overflow-y-auto">
                <AvatarPicker
                  selectedId={selectedAvatarId}
                  onSelect={(id) => setSelectedAvatarId(id)}
                  takenIds={takenAvatars}
                  compact
                />
              </div>
            )}
            {mode === 'join' && takenAvatars.length > 0 && (
              <p className="text-xs text-emerald-200/40 mt-2">
                {takenAvatars.length} avatar{takenAvatars.length === 1 ? '' : 's'} already taken in this room
              </p>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            className="w-full py-4 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-50"
          >
            {loading
              ? (mode === 'create' ? 'Creating...' : 'Joining...')
              : (mode === 'create' ? 'Create Room' : 'Join Room')
            }
          </button>
          <div className="mt-6 flex justify-center">
          <InstallAppButton />
        </div>
        </div>
      </div>
    </main>
  );
}