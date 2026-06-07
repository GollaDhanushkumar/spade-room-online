'use client';

/**
 * Small floating badge that tells the user they're a spectator.
 * Renders top-left by default. Pass className to override position.
 */
export default function SpectatorBadge({ className = '' }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 h-11 rounded-full bg-[#0f1d18] border border-amber-300/50 shadow-lg ${className}`}
      title="You're spectating this match"
    >
      <span className="text-base">👁</span>
      <span className="text-xs text-amber-200 font-medium uppercase tracking-wider">Spectating</span>
    </div>
  );
}