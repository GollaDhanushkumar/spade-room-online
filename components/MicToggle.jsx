'use client';

/**
 * Floating mic on/off toggle.
 */
export default function MicToggle({ enabled, onToggle, className = '' }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-center gap-1 px-3 h-11 rounded-full border shadow-lg transition ${
        enabled
          ? 'bg-emerald-600/40 border-emerald-300 text-emerald-50'
          : 'bg-[#0f1d18] border-emerald-900 hover:bg-[#14271f] hover:border-amber-300/40 text-emerald-200/80'
      } ${className}`}
      title={enabled ? 'Mic ON — tap to mute' : 'Mic OFF — tap to talk'}
      aria-label={enabled ? 'Turn off microphone' : 'Turn on microphone'}
    >
      <span className="text-lg">🎤</span>
      <span className="text-xs font-medium">{enabled ? 'ON' : 'OFF'}</span>
    </button>
  );
}