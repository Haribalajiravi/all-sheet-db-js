/**
 * Browser script loader for GIS and gapi.
 *
 * Idempotent: if the script tag already exists and the expected global is
 * available, resolves immediately without adding a duplicate tag.
 */

import { ServiceError } from '../../utils/errors';
import { GIS_SCRIPT, GAPI_SCRIPT } from './constants';

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already available — short-circuit
    if (src === GIS_SCRIPT && window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    if (src === GAPI_SCRIPT && window.gapi?.load) {
      resolve();
      return;
    }

    // A <script> tag already exists but the global isn't ready yet
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (src === GIS_SCRIPT && window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      if (src === GAPI_SCRIPT && window.gapi?.load) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new ServiceError(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    // First load — inject a new tag
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new ServiceError(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}
