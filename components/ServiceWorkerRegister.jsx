'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker so the browser recognizes this site as installable.
 * Renders nothing visually.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register on idle so it doesn't compete with page load
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service worker registered:', reg.scope);
        })
        .catch((err) => {
          console.error('Service worker registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}