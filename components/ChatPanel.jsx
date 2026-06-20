'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Avatar from './Avatar';

const MESSAGE_LIMIT = 50;

// Hook: subscribes to chat for a room
export function useChat({ roomCode, myPlayerId, myName, myAvatarId }) {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpenState] = useState(false);

  const isOpenRef = useRef(false);
  const setIsOpen = useCallback((v) => {
    isOpenRef.current = v;
    setIsOpenState(v);
    if (v) setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    async function loadMessages() {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT);
      if (!cancelled && data) {
        setMessages(data.reverse());
      }
    }
    loadMessages();

    const channel = supabase
      .channel(`chat-${roomCode}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if (cancelled) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            const next = [...prev, payload.new].slice(-MESSAGE_LIMIT);
            return next;
          });
          if (!isOpenRef.current && payload.new.player_id !== myPlayerId) {
            setUnreadCount((n) => n + 1);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomCode, myPlayerId]);

  const sendMessage = useCallback(async ({ text, replyTo, mentionedIds }) => {
    if (!text.trim() || !roomCode || !myPlayerId) return;
    const payload = {
      room_code: roomCode,
      player_id: myPlayerId,
      player_name: myName || 'Unknown',
      player_avatar_id: myAvatarId || null,
      message: text.trim().slice(0, 500),
      reply_to_id: replyTo?.id ?? null,
      reply_to_name: replyTo?.player_name ?? null,
      reply_to_message: replyTo?.message ? replyTo.message.slice(0, 100) : null,
      mentioned_player_ids: mentionedIds || [],
    };
    const { error } = await supabase.from('chat_messages').insert(payload);
    if (error) {
      console.error('Failed to send chat message:', error);
    }
  }, [roomCode, myPlayerId, myName, myAvatarId]);

  return { messages, sendMessage, unreadCount, isOpen, setIsOpen };
}

export function ChatPanel({
  isOpen, onClose, messages, sendMessage,
  myPlayerId, roomPlayers,
}) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (el) {
      setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    const lastAt = text.lastIndexOf('@');
    if (lastAt === -1) { setShowMentions(false); return; }
    const after = text.slice(lastAt + 1);
    const charBefore = lastAt === 0 ? ' ' : text[lastAt - 1];
    if ((charBefore === ' ' || charBefore === '') && !after.includes(' ')) {
      setShowMentions(true);
      setMentionFilter(after.toLowerCase());
    } else {
      setShowMentions(false);
    }
  }, [text]);

  function pickMention(player) {
    const lastAt = text.lastIndexOf('@');
    if (lastAt === -1) return;
    const newText = text.slice(0, lastAt) + '@' + player.name + ' ';
    setText(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  function handleSend() {
    if (!text.trim()) return;
    const mentioned = [];
    for (const p of roomPlayers) {
      const pattern = new RegExp(`@${p.name}\\b`, 'i');
      if (pattern.test(text) && !mentioned.includes(p.player_id)) {
        mentioned.push(p.player_id);
      }
    }
    sendMessage({ text, replyTo, mentionedIds: mentioned });
    setText('');
    setReplyTo(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const filteredMentions = roomPlayers
    .filter((p) => p.player_id !== myPlayerId)
    .filter((p) => p.name.toLowerCase().includes(mentionFilter))
    .slice(0, 5);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f1d18] border border-emerald-900 sm:rounded-2xl w-full max-w-md flex flex-col"
        style={{ height: '80dvh', maxHeight: 600 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-900/50">
          <h2 className="text-lg font-serif italic text-amber-200">💬 Chat</h2>
          <button
            onClick={onClose}
            className="text-emerald-200/60 hover:text-emerald-100 transition text-2xl leading-none w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-950/40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {messages.length === 0 ? (
            <p className="text-center text-emerald-200/40 text-sm py-8">
              No messages yet. Say hi! 👋
            </p>
          ) : (
            messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                isMe={m.player_id === myPlayerId}
                myPlayerId={myPlayerId}
                onReply={() => setReplyTo(m)}
              />
            ))
          )}
        </div>

        {replyTo && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-emerald-950/40 border-l-2 border-amber-300/60 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-amber-200/60">Replying to {replyTo.player_name}</p>
              <p className="text-xs text-emerald-200/70 truncate">{replyTo.message}</p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="text-emerald-200/60 hover:text-emerald-100 text-xl leading-none w-6 h-6 rounded flex items-center justify-center"
              aria-label="Cancel reply"
            >
              ×
            </button>
          </div>
        )}

        {showMentions && filteredMentions.length > 0 && (
          <div className="mx-3 mb-1 rounded-lg bg-[#14271f] border border-emerald-900/60 overflow-hidden">
            {filteredMentions.map((p) => (
              <button
                key={p.player_id}
                onClick={() => pickMention(p)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-emerald-950/40 transition text-left"
              >
                <Avatar avatarId={p.avatar_id} playerName={p.name} size="xs" />
                <span className="text-sm">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-emerald-900/50 p-3 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (use @ to mention)"
            rows={1}
            className="flex-1 px-3 py-2 rounded-xl bg-[#14271f] border border-emerald-900 text-emerald-100 placeholder-emerald-200/30 text-sm focus:border-amber-300 outline-none resize-none"
            style={{ maxHeight: 100 }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="px-4 py-2 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-40 text-sm whitespace-nowrap"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageRow({ message, isMe, myPlayerId, onReply }) {
  const [showActions, setShowActions] = useState(false);
  const isMentioned = (message.mentioned_player_ids || []).includes(myPlayerId);

  return (
    <div
      className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
      onClick={() => setShowActions((v) => !v)}
    >
      {!isMe && (
        <div className="flex-shrink-0 mt-1">
          <Avatar avatarId={message.player_avatar_id} playerName={message.player_name} size="xs" />
        </div>
      )}
      <div className={`flex-1 min-w-0 ${isMe ? 'text-right' : ''}`}>
        {!isMe && (
          <p className="text-[10px] text-emerald-200/50 mb-0.5">{message.player_name}</p>
        )}
        <div
          className={`inline-block max-w-[85%] px-3 py-2 rounded-2xl text-sm cursor-pointer ${
            isMe
              ? 'bg-amber-300 text-[#07100c] rounded-tr-sm'
              : isMentioned
                ? 'bg-amber-300/20 border border-amber-300/50 text-emerald-50 rounded-tl-sm'
                : 'bg-[#14271f] text-emerald-50 rounded-tl-sm'
          }`}
        >
          {message.reply_to_id && message.reply_to_name && (
            <div className={`mb-1 pb-1 border-b ${isMe ? 'border-[#07100c]/20' : 'border-emerald-900/40'} text-[10px] opacity-70`}>
              <p className="font-medium">↩ {message.reply_to_name}</p>
              <p className="truncate">{message.reply_to_message}</p>
            </div>
          )}
          <p className="whitespace-pre-wrap break-words">{message.message}</p>
        </div>
        {showActions && (
          <button
            onClick={(e) => { e.stopPropagation(); onReply(); setShowActions(false); }}
            className="ml-2 text-[10px] text-emerald-200/60 hover:text-amber-200 transition"
          >
            ↩ Reply
          </button>
        )}
      </div>
    </div>
  );
}