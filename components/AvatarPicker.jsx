'use client';

import { useState } from 'react';
import { FRIEND_AVATARS, DICEBEAR_AVATARS } from '@/lib/avatars';
import Avatar from './Avatar';

// Inline picker — fits inside the home page form OR the lobby modal
export default function AvatarPicker({
  selectedId,
  onSelect,
  takenIds = [],     // avatar ids already used by other players in this room
  compact = false,   // smaller version (for lobby modal)
}) {
  const taken = new Set(takenIds);

  const groups = [
    { title: 'Friends', items: FRIEND_AVATARS.map((a) => ({ ...a, group: 'friend' })) },
    { title: 'Adventurer', items: DICEBEAR_AVATARS.filter((a) => a.style === 'adventurer') },
    { title: 'Avataaars', items: DICEBEAR_AVATARS.filter((a) => a.style === 'avataaars') },
    { title: 'Micah', items: DICEBEAR_AVATARS.filter((a) => a.style === 'micah') },
  ];

  const cellSize = compact ? 48 : 56;

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="text-[10px] uppercase tracking-widest text-emerald-200/40 mb-2 px-1">
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