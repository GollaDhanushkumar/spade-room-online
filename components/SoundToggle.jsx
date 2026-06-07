'use client';

export default function SoundToggle({ enabled, onToggle, className = '' }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-center w-11 h-11 rounded-full bg-[#0f1d18] border border-emerald-900 shadow-lg hover:bg-[#14271f] hover:border-amber-300/40 transition ${className}`}
      title={enabled ? 'Sound on (tap to mute)' : 'Sound off (tap to enable)'}
      aria-label={enabled ? 'Mute sounds' : 'Enable sounds'}
    >
      <span className="text-lg">{enabled ? '🔊' : '🔇'}</span>
    </button>
  );
}