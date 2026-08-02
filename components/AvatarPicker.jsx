'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FRIEND_AVATARS,
  SECRET_AVATARS,
  ANIMAL_AVATARS,
  SECRET_ANIMAL_AVATARS,
  SECRET_AVATAAARS,
  DICEBEAR_AVATARS,
  findSecretAvatarByName,
} from '@/lib/avatars';
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
  const [showSecretAnimals, setShowSecretAnimals] = useState(false);
  const [showSecretAvataaars, setShowSecretAvataaars] = useState(false);

  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const animalTapCountRef = useRef(0);
  const lastAnimalTapRef = useRef(0);

  const avataaarsTapCountRef = useRef(0);
  const lastAvataaarsTapRef = useRef(0);

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

  // Unlock-by-tap: triple-tap the "Friends" label within 1.5s to reveal ALL friend secrets
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

  // Unlock-by-tap: triple-tap the "Animals" label within 1.5s to reveal Prakash/Siddarth/Vasisht
  function handleAnimalsLabelTap() {
    const now = Date.now();

    if (now - lastAnimalTapRef.current > 1500) {
      animalTapCountRef.current = 1;
    } else {
      animalTapCountRef.current += 1;
    }

    lastAnimalTapRef.current = now;

    if (animalTapCountRef.current >= 3) {
      animalTapCountRef.current = 0;
      setShowSecretAnimals(true);
    }
  }

  // Unlock-by-tap: tap/click the "Avataaars" label 4 times within 1.5s to reveal Sravya
  function handleAvataaarsLabelTap() {
    const now = Date.now();

    if (now - lastAvataaarsTapRef.current > 1500) {
      avataaarsTapCountRef.current = 1;
    } else {
      avataaarsTapCountRef.current += 1;
    }

    lastAvataaarsTapRef.current = now;

    if (avataaarsTapCountRef.current >= 4) {
      avataaarsTapCountRef.current = 0;
      setShowSecretAvataaars(true);
    }
  }

  // Friends list = 11 originals + any unlocked secret avatars
  const unlockedSecrets = SECRET_AVATARS.filter((a) => unlockedSecretIds.has(a.id));
  const friendsList = [...FRIEND_AVATARS, ...unlockedSecrets];

  // Animals list = normal animals + hidden BTech friends after triple-clicking Animals
  const animalsList = showSecretAnimals
    ? [...ANIMAL_AVATARS, ...SECRET_ANIMAL_AVATARS]
    : ANIMAL_AVATARS;

  // Avataaars list = normal DiceBear avataaars + hidden Sravya after 4 clicks
  const avataaarsList = showSecretAvataaars
    ? [
        ...DICEBEAR_AVATARS.filter((a) => a.style === 'avataaars'),
        ...SECRET_AVATAAARS,
      ]
    : DICEBEAR_AVATARS.filter((a) => a.style === 'avataaars');

  const groups = [
    {
      title: 'Friends',
      items: friendsList.map((a) => ({ ...a, group: 'friend' })),
      onTitleTap: handleFriendsLabelTap,
    },
    {
      title: 'Animals',
      items: animalsList.map((a) => ({ ...a, group: 'animal' })),
      onTitleTap: handleAnimalsLabelTap,
    },
    {
      title: 'Avataaars',
      items: avataaarsList.map((a) => ({ ...a, group: 'avataaars' })),
      onTitleTap: handleAvataaarsLabelTap,
    },
    {
      title: 'Lorelei',
      items: DICEBEAR_AVATARS.filter((a) => a.style === 'lorelei'),
    },
  ];

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.title}>
          <p
            className="text-[10px] uppercase tracking-widest text-emerald-200/40 mb-2 px-1 select-none cursor-pointer"
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
                  title={isTaken ? 'Taken by another player' : a.name}
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