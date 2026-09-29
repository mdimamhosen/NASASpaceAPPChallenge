const key = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY?.trim();
let pending: Promise<typeof google.maps> | undefined;

export const hasGoogleMapsKey = Boolean(key);

type MapsHost = Window & {
  __marsExplorerMapsReady?: () => void;
  gm_authFailure?: () => void;
};

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps needs a browser.'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!key) return Promise.reject(new Error('Set NEXT_PUBLIC_GOOGLE_MAP_API_KEY in apps/web/.env.local.'));

  pending ??= new Promise((resolve, reject) => {
    const host = window as MapsHost;
    const fail = (message: string) => {
      pending = undefined;
      reject(new Error(message));
    };

    host.__marsExplorerMapsReady = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else fail('Google Maps loaded without the maps library.');
    };
    host.gm_authFailure = () => fail('Google Maps rejected this browser key. Enable Maps JavaScript API, billing, and localhost referrer access — or use the Leaflet fallback.');

    const existing = document.querySelector<HTMLScriptElement>('script[data-mars-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => host.__marsExplorerMapsReady?.(), { once: true });
      existing.addEventListener('error', () => fail('Google Maps script failed to load.'), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.marsGoogleMaps = 'true';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=__marsExplorerMapsReady`;
    script.async = true;
    script.defer = true;
    script.onerror = () => fail('Google Maps script failed to load. Check network and API key.');
    document.head.appendChild(script);
  });

  return pending;
}
