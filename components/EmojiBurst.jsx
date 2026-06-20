'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const REACTION_EMOJIS = ['👏', '🔥', '😂', '😱', '👀', '💀', '🔪', '🐷', '🤮', '😭'];

// Shared hook: subscribes to emoji broadcasts for the room
// Returns { activeReactions, sendReaction, lastSentRef }
export function useEmojiReactions({ roomCode, myPlayerId }) {
  // active reactions: { [playerId]: { emoji, ts } }
  const [activeReactions, setActiveReactions] = useState({});
  const channelRef = useRef(null);
  const lastSentRef = useRef(0); // cooldown timestamp

  // Clear a reaction after 2 seconds
  const scheduleClear = useCallback((playerId, ts) => {
    setTimeout(() => {
      setActiveReactions((prev) => {
        const current = prev[playerId];
        if (current && current.ts === ts) {
          const { [playerId]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    }, 2000);
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    const channel = supabase
      .channel(`emoji-${roomCode}`)
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const { targetId, emoji, fromId, fromName } = payload || {};
        if (!targetId || !emoji) return;
        const ts = Date.now();
        setActiveReactions((prev) => ({ ...prev, [targetId]: { emoji, ts, fromId, fromName } }));
        scheduleClear(targetId, ts);
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [roomCode, scheduleClear]);

  const sendReaction = useCallback((targetId, emoji, fromName) => {
    const now = Date.now();
    if (now - lastSentRef.current < 3000) return false; // cooldown
    lastSentRef.current = now;
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { targetId, emoji, fromId: myPlayerId, fromName },
      });
    }
    // Also show locally (broadcast may not echo back to sender)
    const ts = Date.now();
    setActiveReactions((prev) => ({ ...prev, [targetId]: { emoji, ts, fromId: myPlayerId, fromName } }));
    scheduleClear(targetId, ts);
    return true;
  }, [myPlayerId, scheduleClear]);

  return { activeReactions, sendReaction };
}

// Picker popup that floats next to an avatar
export function EmojiPicker({ targetPlayerId, targetName, onPick, onClose, anchorRect }) {
  // Position picker centered above the avatar
  const pickerWidth = 280;
  const pickerHeight = 70;
  let left = anchorRect ? anchorRect.left + anchorRect.width / 2 - pickerWidth / 2 : 100;
  let top = anchorRect ? anchorRect.top - pickerHeight - 12 : 100;
  // Keep within viewport
  if (typeof window !== 'undefined') {
    left = Math.max(8, Math.min(left, window.innerWidth - pickerWidth - 8));
    if (top < 8) top = anchorRect ? anchorRect.bottom + 12 : 100; // below if not enough room above
  }

  return (
    <>
      {/* Backdrop to close on outside click */}
      <div
        className="fixed inset-0 z-[80]"
        onClick={onClose}
      />
      <div
        className="fixed z-[81] bg-[#0f1d18] border border-amber-300/40 rounded-2xl shadow-2xl p-2 flex flex-wrap justify-center items-center gap-1"
        style={{
          left, top,
          width: pickerWidth,
          animation: 'emojiPickerIn 0.18s ease-out',
        }}
      >
        <p className="w-full text-center text-[10px] uppercase tracking-wider text-emerald-200/60 mb-1">
          React to {targetName}
        </p>
        {REACTION_EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => { onPick(e); onClose(); }}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-2xl hover:bg-amber-300/20 active:scale-90 transition"
          >
            {e}
          </button>
        ))}
        <style jsx>{`
          @keyframes emojiPickerIn {
            from { opacity: 0; transform: translateY(8px) scale(0.92); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </>
  );
}
// Floating emoji that appears above an avatar, with sender name below
export function FloatingEmoji({ emoji, fromName }) {
  if (!emoji) return null;
  return (
    <div
      className="absolute pointer-events-none flex flex-col items-center"
      style={{
        left: '50%',
        top: -8,
        transform: 'translate(-50%, -100%)',
        zIndex: 70,
        animation: 'emojiFloatPop 2s ease-out forwards',
      }}
    >
      <div style={{ fontSize: 32, lineHeight: 1 }}>{emoji}</div>
      {fromName && (
        <div
          className="mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap"
          style={{
            background: 'rgba(7, 16, 12, 0.92)',
            color: '#f5d989',
            border: '1px solid rgba(245, 217, 137, 0.4)',
            maxWidth: 100,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          from {fromName}
        </div>
      )}
      <style jsx>{`
        @keyframes emojiFloatPop {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          15%  { opacity: 1; transform: translate(-50%, -110%) scale(1.4); }
          70%  { opacity: 1; transform: translate(-50%, -130%) scale(1.0); }
          100% { opacity: 0; transform: translate(-50%, -160%) scale(0.9); }
        }
      `}</style>
    </div>
  );
}