'use client';

/**
 * One-time popup shown when a spectator enters a game in progress.
 * Renders fullscreen overlay. Tap "Got it" to dismiss.
 */
export default function SpectatorWelcome({ onDismiss }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-5"
      onClick={onDismiss}
    >
      <div
        className="max-w-sm w-full bg-[#0f1d18] border border-amber-300/40 rounded-2xl p-6 text-center"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 0 40px rgba(245, 217, 137, 0.2)' }}
      >
        <div className="text-5xl mb-3">👁</div>
        <h2 className="text-2xl font-serif italic text-amber-200 mb-2">
          You're spectating
        </h2>
        <p className="text-emerald-200/70 text-sm mb-5 leading-relaxed">
          You joined while a match was already in progress. You'll see everyone's hand face-up and watch the action live — but you can't play this match.
        </p>
        <p className="text-emerald-200/50 text-xs mb-6">
          When the host starts a new match, you'll automatically join as a player.
        </p>
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] active:scale-[0.98] transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
}