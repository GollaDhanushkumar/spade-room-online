'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';

// Public STUN servers (Google's, free, no signup)
// STUN helps peers find each other behind NAT.
// We're NOT using TURN yet — voice will work for ~85% of player pairs.
// If that's a problem, we add free TURN later.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Voice chat hook using WebRTC + Supabase realtime for signaling.
 *
 * Usage:
 *   const voice = useVoiceChat({ roomCode, myPlayerId, otherPlayerIds });
 *   voice.micEnabled, voice.toggleMic()
 *   voice.talkingPlayers — Set of player IDs currently talking
 *   voice.mutedPlayers — Set of player IDs I've muted
 *   voice.togglePlayerMute(playerId)
 *   voice.masterMute, voice.toggleMasterMute()
 *
 * Returns null until ready.
 */
export function useVoiceChat({ roomCode, myPlayerId, otherPlayerIds }) {
  const [micEnabled, setMicEnabled] = useState(false);
  const [talkingPlayers, setTalkingPlayers] = useState(new Set());
  const [mutedPlayers, setMutedPlayers] = useState(new Set());
  const [masterMute, setMasterMute] = useState(false);

  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // playerId -> RTCPeerConnection
  const audioElsRef = useRef({}); // playerId -> HTMLAudioElement
  const talkingDetectorsRef = useRef({}); // playerId -> { stop }
  const channelRef = useRef(null);

  // ─── 1. Send a signal to another player via Supabase ───
  const sendSignal = useCallback(async (toPlayerId, signalType, payload) => {
    if (!roomCode || !myPlayerId) return;
    await supabase.from('voice_signals').insert({
      room_code: roomCode,
      from_player_id: myPlayerId,
      to_player_id: toPlayerId,
      signal_type: signalType,
      payload,
    });
  }, [roomCode, myPlayerId]);

  // ─── 2. Create or get a peer connection ───
  const getOrCreatePeer = useCallback((otherPlayerId) => {
    if (peersRef.current[otherPlayerId]) {
      return peersRef.current[otherPlayerId];
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // When we have a local ICE candidate, send it
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(otherPlayerId, 'ice', e.candidate.toJSON());
      }
    };

    // When the remote stream arrives, play it
    pc.ontrack = (e) => {
      let audioEl = audioElsRef.current[otherPlayerId];
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioElsRef.current[otherPlayerId] = audioEl;
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = e.streams[0];
      audioEl.play().catch(() => {});

      // Set up talking detection
      setupTalkingDetection(otherPlayerId, e.streams[0]);
    };

    // Add our local stream if mic is enabled
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peersRef.current[otherPlayerId] = pc;
    return pc;
  }, [sendSignal]);

  // ─── 3. Detect when someone is talking ───
  const setupTalkingDetection = useCallback((playerId, stream) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastTalkingState = false;
      let stopped = false;

      function check() {
        if (stopped) return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const isTalking = avg > 15; // threshold
        if (isTalking !== lastTalkingState) {
          lastTalkingState = isTalking;
          setTalkingPlayers((prev) => {
            const next = new Set(prev);
            if (isTalking) next.add(playerId);
            else next.delete(playerId);
            return next;
          });
        }
        requestAnimationFrame(check);
      }
      check();

      talkingDetectorsRef.current[playerId] = {
        stop: () => { stopped = true; audioCtx.close().catch(() => {}); },
      };
    } catch (e) {
      console.error('Talking detection failed:', e);
    }
  }, []);

  // ─── 4. Handle incoming signals ───
  useEffect(() => {
    if (!roomCode || !myPlayerId) return;
    let cancelled = false;

    const channel = supabase
      .channel(`voice-${roomCode}-${myPlayerId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voice_signals', filter: `to_player_id=eq.${myPlayerId}` },
        async (payload) => {
          if (cancelled) return;
          const sig = payload.new;
          if (sig.room_code !== roomCode) return;
          const from = sig.from_player_id;
          const pc = getOrCreatePeer(from);

          try {
            if (sig.signal_type === 'offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendSignal(from, 'answer', answer);
            } else if (sig.signal_type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
            } else if (sig.signal_type === 'ice') {
              await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
            }
          } catch (e) {
            console.error('Signal handling error:', e);
          }

          // Clean up the consumed signal
          await supabase.from('voice_signals').delete().eq('id', sig.id);
        })
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomCode, myPlayerId, getOrCreatePeer, sendSignal]);

  // ─── 5. Toggle mic ───
  const toggleMic = useCallback(async () => {
    if (micEnabled) {
      // Turn off
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      // Close all peer connections
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      // Stop talking detectors
      Object.values(talkingDetectorsRef.current).forEach((d) => d.stop());
      talkingDetectorsRef.current = {};
      // Remove audio elements
      Object.values(audioElsRef.current).forEach((el) => {
        try { el.remove(); } catch {}
      });
      audioElsRef.current = {};
      setTalkingPlayers(new Set());
      setMicEnabled(false);
    } else {
      // Turn on
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        localStreamRef.current = stream;
        setMicEnabled(true);

        // Initiate connections to all other players (we offer; they answer)
        for (const otherId of otherPlayerIds) {
          if (otherId === myPlayerId) continue;
          const pc = getOrCreatePeer(otherId);
          // Add our tracks
          stream.getTracks().forEach((track) => {
            try { pc.addTrack(track, stream); } catch {}
          });
          // Create + send offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal(otherId, 'offer', offer);
        }
      } catch (err) {
        console.error('Could not access mic:', err);
        alert('Could not access your microphone. Check browser permissions.');
        setMicEnabled(false);
      }
    }
  }, [micEnabled, otherPlayerIds, myPlayerId, getOrCreatePeer, sendSignal]);

  // ─── 6. Per-player mute ───
  const togglePlayerMute = useCallback((playerId) => {
    setMutedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);

      // Apply mute to the audio element
      const audioEl = audioElsRef.current[playerId];
      if (audioEl) {
        audioEl.muted = next.has(playerId);
      }
      return next;
    });
  }, []);

  // ─── 7. Master mute (mute everyone for me) ───
  const toggleMasterMute = useCallback(() => {
    setMasterMute((prev) => {
      const next = !prev;
      // Apply to all audio elements
      Object.values(audioElsRef.current).forEach((el) => {
        el.muted = next;
      });
      return next;
    });
  }, []);

  // Re-apply mutes if new players join
  useEffect(() => {
    Object.entries(audioElsRef.current).forEach(([pid, el]) => {
      el.muted = masterMute || mutedPlayers.has(pid);
    });
  }, [mutedPlayers, masterMute, talkingPlayers]);

  // ─── 8. Cleanup on unmount ───
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      Object.values(peersRef.current).forEach((pc) => pc.close());
      Object.values(talkingDetectorsRef.current).forEach((d) => d.stop());
      Object.values(audioElsRef.current).forEach((el) => {
        try { el.remove(); } catch {}
      });
    };
  }, []);

  return {
    micEnabled,
    toggleMic,
    talkingPlayers,
    mutedPlayers,
    togglePlayerMute,
    masterMute,
    toggleMasterMute,
  };
}