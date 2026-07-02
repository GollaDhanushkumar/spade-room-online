'use client';

import { useState, useRef } from 'react';
import { resolveAvatar, FRIEND_PLACEHOLDER_COLORS, FRIEND_AVATARS } from '@/lib/avatars';

// size: 'xs' (20px) | 'sm' (32px) | 'md' (44px) | 'lg' (64px) | 'xl' (96px)
export default function Avatar({
  avatarId,
  playerName,
  size = 'md',
  className = '',
  showBorder = true,
  borderColor,
}) {
  const sizes = {
    xs: 20, sm: 32, md: 44, lg: 64, xl: 96,
  };
  const px = sizes[size] ?? sizes.md;

  const av = resolveAvatar(avatarId);
  const [imgError, setImgError] = useState(false);
  const [showSecretFlip, setShowSecretFlip] = useState(false);
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const currentAvatarSrc =
    showSecretFlip && av?.secretFlipSrc ? av.secretFlipSrc : av?.src;

  function handleAvatarTap() {
    if (!av?.secretFlipSrc) return;

    const now = Date.now();

    if (now - lastTapRef.current > 1200) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }

    lastTapRef.current = now;

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      setImgError(false);
      setShowSecretFlip((prev) => !prev);
    }
  }

  // Determine what to show
  let content;
  if (!av || av.type === 'fallback' || imgError) {
    // No avatar set, or image failed to load → show initial in a colored circle
    let initial = '?';
    let color = '#3a5a4d';

    if (avatarId?.startsWith('friend:')) {
      const friendIdx = FRIEND_AVATARS.findIndex((f) => f.id === avatarId);
      const friendData = FRIEND_AVATARS[friendIdx];
      if (friendData) {
        initial = friendData.name[0]?.toUpperCase() ?? '?';
        color = FRIEND_PLACEHOLDER_COLORS[friendIdx % FRIEND_PLACEHOLDER_COLORS.length];
      }
    } else if (playerName) {
      initial = playerName[0]?.toUpperCase() ?? '?';
      // Hash name → consistent color
      let hash = 0;
      for (let i = 0; i < playerName.length; i++) {
        hash = (hash + playerName.charCodeAt(i)) % FRIEND_PLACEHOLDER_COLORS.length;
      }
      color = FRIEND_PLACEHOLDER_COLORS[hash];
    }

    content = (
      <div
        style={{
          width: px, height: px,
          background: color, color: '#07100c',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', fontSize: px * 0.45,
          fontFamily: 'serif',
        }}
      >
        {initial}
      </div>
    );
  } else {
   content = (
      <img
        key={currentAvatarSrc}
        src={currentAvatarSrc}
        alt={av.name || playerName || ''}
        width={px * 2}
        height={px * 2}
        onClick={handleAvatarTap}
        onError={() => setImgError(true)}
        loading="eager"
        decoding="async"
        style={{
          width: px, height: px,
          borderRadius: '50%',
          objectFit: 'cover',
          background: '#14271f',
          imageRendering: 'auto',
          cursor: av.secretFlipSrc ? 'pointer' : 'default',
          transition: 'transform 0.35s ease',
          transform: showSecretFlip ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      />
    );
  }

  if (!showBorder) return <div className={className}>{content}</div>;

  return (
    <div
      className={className}
      style={{
        width: px, height: px,
        borderRadius: '50%',
        border: borderColor ? `2px solid ${borderColor}` : '1.5px solid rgba(34, 78, 60, 0.6)',
        padding: 1,
        background: '#0a1410',
        display: 'inline-flex',
        flexShrink: 0,
      }}
    >
      {content}
    </div>
  );
}