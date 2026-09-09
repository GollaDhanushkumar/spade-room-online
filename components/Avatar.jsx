'use client';

import { resolveAvatar, FRIEND_PLACEHOLDER_COLORS, FRIEND_AVATARS } from '@/lib/avatars';

// size: 'xs' (20px) | 'sm' (32px) | 'md' (44px) | 'lg' (64px) | 'xl' (96px)
export default function Avatar({
  avatarId,
  playerName,
  size = 'md',
  className = '',
  showBorder = true,
  borderColor,
  onDoubleTap,
  canDoubleTap = false,
}) {
  const sizes = {
    xs: 20,
    sm: 32,
    md: 44,
    lg: 64,
    xl: 96,
  };

  const px = sizes[size] ?? sizes.md;
  const av = resolveAvatar(avatarId);

  function handleClick(e) {
    if (!canDoubleTap || !onDoubleTap) return;
    if (e.detail === 2) {
      e.preventDefault();
      e.stopPropagation();
      onDoubleTap();
    }
  }

  let content;

  if (!av || av.type === 'fallback') {
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

      let hash = 0;
      for (let i = 0; i < playerName.length; i++) {
        hash = (hash + playerName.charCodeAt(i)) % FRIEND_PLACEHOLDER_COLORS.length;
      }

      color = FRIEND_PLACEHOLDER_COLORS[hash];
    }

    content = (
      <div
        onClick={handleClick}
        style={{
          width: px,
          height: px,
          background: color,
          color: '#07100c',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: px * 0.45,
          fontFamily: 'serif',
          cursor: canDoubleTap ? 'pointer' : 'default',
        }}
      >
        {initial}
      </div>
    );
  } else {
    content = (
      <img
        src={av.src}
        alt={av.name || playerName || ''}
        width={px * 2}
        height={px * 2}
        onClick={handleClick}
        loading="eager"
        decoding="async"
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          objectFit: 'cover',
          background: '#14271f',
          imageRendering: 'auto',
          cursor: canDoubleTap ? 'pointer' : 'default',
          transform: 'none',
        }}
      />
    );
  }

  if (!showBorder) return <div className={className}>{content}</div>;

  return (
    <div
      className={className}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        border: borderColor
          ? `2px solid ${borderColor}`
          : '1.5px solid rgba(34, 78, 60, 0.6)',
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