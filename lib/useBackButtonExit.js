'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Intercepts the browser/Android back button on a game screen.
 * Shows a "Quit game?" confirm. On "yes", navigates to home but KEEPS
 * localStorage so the player can rejoin via the home screen badge.
 *
 * Usage:
 *   useBackButtonExit({ enabled: !loading });
 */
export function useBackButtonExit({ enabled = true } = {}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    // Push a dummy history entry so the FIRST back press lands on us, not the previous page
    window.history.pushState({ spadeRoomGuard: true }, '');

    const handlePopState = () => {
      const confirmed = window.confirm(
        'Quit the game?\n\nYou can rejoin later from the home screen.'
      );

      if (confirmed) {
        // User wants to quit — navigate home. localStorage stays intact.
        router.push('/');
      } else {
        // User cancelled — re-push the guard so back press works again next time
        window.history.pushState({ spadeRoomGuard: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, router]);
}