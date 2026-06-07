'use client';

import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';

/**
 * Collapsible voice control panel.
 * Shows just a single mic button when collapsed.
 * Expands to show: mic toggle, master mute, per-player mute list.
 *
 * Props:
 *   voice — the useVoiceChat return value
 *   players — array of { player_id, name, avatar_id } for other players in the room
 *   mePlayerId — current user's player ID
 *   className — positioning
 */
export default function VoicePanel({ voice, players, mePlayerId, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [expanded]);

  const otherPlayers = (players || []).filter((p) => p.player_id !== mePlayerId && p.id !== mePlayerId);
  const hasOthers = otherPlayers.length > 0;

  return (
    <div ref={panelRef} className={`fixed z-30 ${className}`}>
      {/* Collapsed: just one button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`flex items-center justify-center w-11 h-11 rounded-full border shadow-lg transition ${
          voice.micEnabled
            ? 'bg-emerald-600/40 border-emerald-300 text-emerald-50'
            : 'bg-[#0f1d18] border-emerald-900 hover:bg-[#14271f] hover:border-amber-300/40 text-emerald-200/80'
        }`}
        title="Voice chat"
        aria-label="Voice chat options"
      >
        <span className="text-lg">🎤</span>
      </button>

      {/* Expanded: full panel */}
      {expanded && (
        <div className="absolute top-13 left-0 mt-2 w-64 bg-[#0f1d18] border border-emerald-900 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header — mic on/off main toggle */}
          <div className="px-4 py-3 border-b border-emerald-900/50">
            <button
              onClick={voice.toggleMic}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition ${
                voice.micEnabled
                  ? 'bg-emerald-600/30 border border-emerald-400/60 text-emerald-50'
                  : 'bg-[#14271f] border border-emerald-900 text-emerald-200/80 hover:border-amber-300/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">🎤</span>
                <span className="text-sm font-medium">
                  {voice.micEnabled ? 'Mic is ON' : 'Mic is OFF'}
                </span>
              </span>
              <span className="text-xs uppercase tracking-wider opacity-70">
                {voice.micEnabled ? 'tap to mute' : 'tap to talk'}
              </span>
            </button>
          </div>

          {/* Body — only if mic is on */}
          {voice.micEnabled && (
            <div className="px-4 py-3 max-h-80 overflow-y-auto">
              {/* Master mute */}
              <button
                onClick={voice.toggleMasterMute}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg mb-3 transition ${
                  voice.masterMute
                    ? 'bg-red-900/40 border border-red-400/50 text-red-200'
                    : 'bg-[#14271f] border border-emerald-900 text-emerald-200/80 hover:border-amber-300/40'
                }`}
              >
                <span className="text-sm">
                  {voice.masterMute ? '🔕 Everyone muted' : '🔔 Hear everyone'}
                </span>
                <span className="text-[10px] uppercase tracking-wider opacity-70">
                  {voice.masterMute ? 'tap to unmute' : 'tap to silence'}
                </span>
              </button>

              {/* Per-player mute list */}
              {hasOthers ? (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-200/40 mb-2 px-1">
                    Mute specific players
                  </p>
                  <div className="space-y-1.5">
                    {otherPlayers.map((p) => {
                      const pid = p.player_id ?? p.id;
                      const isMuted = voice.mutedPlayers.has(pid);
                      const isTalking = voice.talkingPlayers.has(pid);
                      return (
                        <div
                          key={pid}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-[#14271f]"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="relative">
                              <Avatar avatarId={p.avatar_id} playerName={p.name} size="xs" />
                              {isTalking && !isMuted && !voice.masterMute && (
                                <span
                                  className="absolute inset-0 rounded-full pointer-events-none"
                                  style={{
                                    boxShadow: '0 0 0 2px #4ade80, 0 0 8px #4ade80',
                                    animation: 'talkingPulse 0.8s ease-in-out infinite',
                                  }}
                                />
                              )}
                            </div>
                            <span className="text-xs truncate">{p.name}</span>
                          </div>
                          <button
                            onClick={() => voice.togglePlayerMute(pid)}
                            className={`text-xs px-2 py-1 rounded transition ${
                              isMuted
                                ? 'bg-red-900/40 border border-red-400/50 text-red-200'
                                : 'border border-emerald-900 text-emerald-200/70 hover:bg-emerald-950/40'
                            }`}
                          >
                            {isMuted ? '🔇' : '🔊'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-xs text-emerald-200/40 text-center py-2">
                  No other players yet
                </p>
              )}

              <p className="text-[9px] text-emerald-200/30 text-center mt-3 leading-relaxed">
                Mutes are local — only YOU stop hearing them.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}