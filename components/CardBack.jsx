'use client';

/**
 * Renders a face-down card using CSS variables set by useRoomTheme.
 * Falls back to default green diagonal if theme not loaded yet.
 *
 * Props: width, height, className, style
 */
export default function CardBack({ width = 44, height = 62, className = '', style = {} }) {
  return (
    <div
      className={`rounded-md border shadow-md ${className}`}
      style={{
        width,
        height,
        backgroundImage: 'var(--cardback-image, repeating-linear-gradient(45deg, #1a3127 0 4px, #14271f 4px 8px))',
        backgroundColor: 'var(--cardback-primary, #1a3127)',
        backgroundSize: 'var(--cardback-size, auto)',
        borderColor: 'var(--cardback-border, rgba(212, 182, 117, 0.3))',
        ...style,
      }}
    />
  );
}