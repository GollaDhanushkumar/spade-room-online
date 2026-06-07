'use client';

import { useEffect, useState } from 'react';

/**
 * "Install App" button that:
 * - On Android Chrome: triggers native install prompt
 * - On iPhone Safari: shows manual install instructions
 * - On desktop browsers that support it: triggers install
 * - Hides itself if the app is already installed
 */
export default function InstallAppButton({ className = '' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Detect iOS Safari (which doesn't support beforeinstallprompt)
    const ua = window.navigator.userAgent;
    const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIOS(iOSDevice);

    // Detect if already installed (running in standalone mode)
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsInstalled(installed);

    // Capture the install prompt event (Android Chrome / desktop Chrome / Edge)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  async function handleClick() {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  }

  // Don't render anything until mounted (avoid hydration mismatch)
  if (!mounted) return null;

  // Already installed — don't show the button
  if (isInstalled) return null;

  // Not iOS AND no install prompt available — browser doesn't support PWA install
  if (!isIOS && !deferredPrompt) return null;

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-[#14271f] border border-emerald-900 text-emerald-200 hover:bg-[#1a3024] hover:border-amber-300/40 transition active:scale-[0.98] ${className}`}
      >
        <span className="text-lg">📱</span>
        <span className="text-sm font-medium">Install as app</span>
      </button>

      {showIOSInstructions && (
        <IOSInstructionsModal onClose={() => setShowIOSInstructions(false)} />
      )}
    </>
  );
}

function IOSInstructionsModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <div
        className="max-w-sm w-full bg-[#0f1d18] border border-amber-300/30 rounded-2xl p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-3">📱</div>
        <h2 className="text-xl font-serif italic text-amber-200 mb-2">
          Install on iPhone
        </h2>
        <p className="text-emerald-200/70 text-sm mb-5 leading-relaxed">
          Add Spades Game to your home screen so it opens like a real app.
        </p>

        <div className="space-y-3 mb-6 text-left">
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-300 text-[#07100c] font-bold text-sm flex items-center justify-center">1</span>
            <p className="text-sm text-emerald-100 flex-1">
              Tap the <span className="font-mono text-amber-200">Share</span> button at the bottom of Safari (the square with the up arrow)
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-300 text-[#07100c] font-bold text-sm flex items-center justify-center">2</span>
            <p className="text-sm text-emerald-100 flex-1">
              Scroll down and tap <span className="font-mono text-amber-200">"Add to Home Screen"</span>
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-300 text-[#07100c] font-bold text-sm flex items-center justify-center">3</span>
            <p className="text-sm text-emerald-100 flex-1">
              Tap <span className="font-mono text-amber-200">"Add"</span> in the top-right corner
            </p>
          </div>
        </div>

        <p className="text-xs text-emerald-200/40 mb-4">
          The Spades Game icon will appear on your home screen.
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-semibold bg-gradient-to-b from-amber-200 to-amber-400 text-[#07100c]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}