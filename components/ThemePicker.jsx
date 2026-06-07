'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { THEME_LIST, CARD_BACK_LIST } from '@/lib/themes';

export default function ThemePicker({ code, currentTheme, currentCardBack, animationsEnabled, onClose }) {
  const [theme, setTheme] = useState(currentTheme || 'forest');
  const [cardBack, setCardBack] = useState(currentCardBack || 'classic-red');
  const [animations, setAnimations] = useState(!!animationsEnabled);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await supabase
      .from('rooms')
      .update({
        theme,
        card_back: cardBack,
        animations_enabled: animations,
      })
      .eq('code', code);
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-w-md w-full bg-[#0f1d18] border border-emerald-900 rounded-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-900/50">
          <h2 className="text-xl font-serif italic text-amber-200">🎨 Customize Room</h2>
          <button
            onClick={onClose}
            className="text-emerald-200/60 hover:text-emerald-100 transition text-2xl w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-950/40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">

          {/* Theme picker */}
          <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-3">Table Theme</p>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {THEME_LIST.map((t) => {
              const selected = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className="p-3 rounded-xl border transition active:scale-[0.97] text-left"
                  style={{
                    background: `linear-gradient(135deg, ${t.felt.from} 0%, ${t.felt.mid} 60%, ${t.felt.to} 100%)`,
                    borderColor: selected ? t.accent : 'rgba(34, 78, 60, 0.4)',
                    boxShadow: selected ? `0 0 0 2px ${t.accent}66, 0 0 20px ${t.accent}33` : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{t.emoji}</span>
                    <span className="text-sm font-medium" style={{ color: t.text }}>{t.name}</span>
                  </div>
                  {selected && (
                    <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: t.accent }}>
                      ✓ Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Card back picker */}
          <p className="text-xs uppercase tracking-widest text-emerald-200/60 mb-3">Card Back</p>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {CARD_BACK_LIST.map((cb) => {
              const selected = cardBack === cb.id;
              return (
                <button
                  key={cb.id}
                  onClick={() => setCardBack(cb.id)}
                  className="p-2 rounded-xl border transition active:scale-[0.97] flex flex-col items-center gap-1"
                  style={{
                    background: '#14271f',
                    borderColor: selected ? '#f5d989' : 'rgba(34, 78, 60, 0.4)',
                    boxShadow: selected ? `0 0 0 2px #f5d98966, 0 0 16px #f5d98933` : 'none',
                  }}
                >
                  {/* Mini card back preview */}
                  <div
                    className="rounded-md"
                    style={{
                      width: 42,
                      height: 58,
                      background: cb.pattern === 'diagonal'
                        ? `repeating-linear-gradient(45deg, ${cb.primary} 0 4px, ${cb.secondary} 4px 8px)`
                        : cb.pattern === 'geometric'
                        ? `repeating-linear-gradient(45deg, ${cb.primary} 0 6px, ${cb.secondary} 6px 8px), radial-gradient(circle at 50% 50%, ${cb.accent}40 0%, transparent 70%)`
                        : cb.pattern === 'stars'
                        ? `radial-gradient(circle at 30% 30%, ${cb.accent} 0.5px, transparent 1px), radial-gradient(circle at 70% 60%, ${cb.accent} 0.5px, transparent 1px), radial-gradient(circle at 50% 80%, ${cb.accent} 0.5px, transparent 1px), ${cb.primary}`
                        : cb.pattern === 'floral'
                        ? `radial-gradient(circle at 30% 30%, ${cb.accent}55 1.5px, transparent 3px), radial-gradient(circle at 70% 70%, ${cb.accent}55 1.5px, transparent 3px), ${cb.primary}`
                        : cb.pattern === 'solid'
                        ? `linear-gradient(180deg, ${cb.primary}, ${cb.secondary})`
                        : cb.primary,
                      border: '1px solid rgba(0,0,0,0.3)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                  <span className="text-[10px] text-emerald-200/70 text-center leading-tight">{cb.name}</span>
                </button>
              );
            })}
          </div>

          {/* Animations toggle */}
          <div className="bg-[#14271f] border border-emerald-900/50 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-100">Animations</p>
                <p className="text-xs text-emerald-200/50 mt-0.5">Subtle background motion per theme</p>
              </div>
              <button
                onClick={() => setAnimations(!animations)}
                className={`w-12 h-7 rounded-full transition relative ${
                  animations ? 'bg-amber-300' : 'bg-emerald-900'
                }`}
                aria-label={animations ? 'Disable animations' : 'Enable animations'}
              >
                <div
                  className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all"
                  style={{ left: animations ? '22px' : '2px' }}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-emerald-900/50 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl border border-emerald-900 text-emerald-200/70 hover:bg-emerald-950/40 transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Apply Theme'}
          </button>
        </div>
      </div>
    </div>
  );
}