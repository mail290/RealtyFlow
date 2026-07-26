// =====================================================================
// GPS capture — honest, and never blocking.
// =====================================================================
// Position comes from navigator.geolocation, NOT from EXIF (browsers strip
// location from photos on iOS and Android). Captured once at check-in and
// once at check-out. A concrete cellar gives poor signal, so GPS must
// NEVER block an inspection — we record the status honestly instead, and
// the report shows it truthfully.
// =====================================================================

import type { GpsStatus } from '../../lib/care/inspections/types';

export interface GpsFix {
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  status: GpsStatus;
}

const LOW_ACCURACY_M = 100;
const TIMEOUT_MS = 10_000;

const unavailable: GpsFix = { lat: null, lng: null, accuracy_m: null, status: 'unavailable' };

export function capturePosition(): Promise<GpsFix> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(unavailable);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy ?? null;
        const status: GpsStatus =
          accuracy != null && accuracy > LOW_ACCURACY_M ? 'low_accuracy' : 'ok';
        resolve({
          lat: round6(pos.coords.latitude),
          lng: round6(pos.coords.longitude),
          accuracy_m: accuracy != null ? Math.round(accuracy) : null,
          status,
        });
      },
      (err) => {
        // 1 = PERMISSION_DENIED. Anything else = position unavailable/timeout.
        resolve({
          ...unavailable,
          status: err && err.code === 1 ? 'denied' : 'unavailable',
        });
      },
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 0 },
    );
  });
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
