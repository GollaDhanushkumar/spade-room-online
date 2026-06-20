'use client';

import { useState, useEffect, useRef } from 'react';
import { FRIEND_AVATARS, SECRET_AVATARS, DICEBEAR_AVATARS, findSecretAvatarByName } from '@/lib/avatars';
import Avatar from './Avatar';

// Inline picker — fits inside the home page form OR the lobby modal
export default function AvatarPicker({
  selectedId,
  onSelect,
  takenIds = [],     // avatar ids already used by other players in this room
  compact = false,   // smaller version (for lobby modal)
  playerName = '',   // typed name — used to detect secret avatar unlocks
}) {
  const taken = new Set(takenIds);
  const [unlockedSecretIds, setUnlockedSecretIds] = useState(new Set());
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  // Unlock-by-name: when the typed name matches a secret trigger, reveal it
  useEffect(() => {
    const secret = findSecretAvatarByName(playerName);
    if (secret) {
      setUnlockedSecretIds((prev) => {
        if (prev.has(secret.id)) return prev;
        const next = new Set(prev);
        next.add(secret.id);
        return next;
      });
    }
  }, [playerName]);

  // Unlock-by-tap: triple-tap the "Friends" label within 1.5s to reveal ALL secrets
  function handleFriendsLabelTap() {
    const now = Date.now();
    if (now - lastTapRef.current > 1500) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }
    lastTapRef.current = now;
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      setUnlockedSecretIds((prev) => {
        const next = new Set(prev);
        SECRET_AVATARS.forEach((a) => next.add(a.id));
        return next;
      });
    }
  }

  // Friends list = 11 originals + any unlocked secret avatars
  const unlockedSecrets = SECRET_AVATARS.filter((a) => unlockedSecretIds.has(a.id));
  const friendsList = [...FRIEND_AVATARS, ...unlockedSecrets];

  const groups = [
    { title: 'Friends', items: friendsList.map((a) => ({ ...a, group: 'friend' })), onTitleTap: handleFriendsLabelTap },
    { title: 'Adventurer', items: DICEBEAR_AVATARS.filter((a) => a.style === 'adventurer') },
    { title: 'Avataaars', items: DICEBEAR_AVATARS.filter((a) => a.style === 'avataaars') },
    { title: 'Micah', items: DICEBEAR_AVATARS.filter((a) => a.style === 'micah') },
  ];

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.title}>
          <p
            className="text-[10px] uppercase tracking-widest text-emerald-200/40 mb-2 px-1 select-none"
            onClick={g.onTitleTap}
          >
            {g.title}
          </p>
          <div className="flex flex-wrap gap-2">
            {g.items.map((a) => {
              const isSelected = a.id === selectedId;
              const isTaken = taken.has(a.id) && !isSelected;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => !isTaken && onSelect(a.id)}
                  disabled={isTaken}
                  className="relative transition active:scale-95 disabled:cursor-not-allowed"
                  style={{
                    opacity: isTaken ? 0.25 : 1,
                  }}
                  title={isTaken ? `Taken by another player` : a.name}
                >
                  <Avatar
                    avatarId={a.id}
                    size={compact ? 'sm' : 'md'}
                    borderColor={isSelected ? '#f5d989' : undefined}
                  />
                  {isSelected && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-300 text-[#07100c] text-[10px] font-bold flex items-center justify-center"
                      style={{ border: '2px solid #0a1410' }}
                    >
                      ✓
                    </span>
                  )}
                  {isTaken && (
                    <span className="absolute inset-0 flex items-center justify-center text-red-400 text-lg font-bold pointer-events-none">
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}