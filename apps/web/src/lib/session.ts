/**
 * Per-trip session ids + the list of trips this device knows about.
 * A session id identifies one membership (one person on one device) and is
 * sent as the `x-session-id` header on member routes.
 */

const sessionKey = (tripId: string) => `tripvault:session:${tripId}`;
const TRIPS_KEY = 'tripvault:trips';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode etc.) — sessions stay in memory only */
  }
}

/** Get (creating + persisting when missing) the session id for a trip. */
export function getSessionId(tripId: string): string {
  const existing = readStorage(sessionKey(tripId));
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  writeStorage(sessionKey(tripId), fresh);
  return fresh;
}

/** Persist a known session id for a trip (used right after create/join). */
export function setSessionId(tripId: string, sessionId: string): void {
  writeStorage(sessionKey(tripId), sessionId);
}

export interface KnownTrip {
  tripId: string;
  inviteCode: string;
  name: string;
  sessionId: string;
}

/** Trips this device has created or joined. */
export function getKnownTrips(): KnownTrip[] {
  try {
    const raw = readStorage(TRIPS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is KnownTrip =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as KnownTrip).tripId === 'string' &&
        typeof (t as KnownTrip).inviteCode === 'string' &&
        typeof (t as KnownTrip).name === 'string' &&
        typeof (t as KnownTrip).sessionId === 'string',
    );
  } catch {
    return [];
  }
}

export function addKnownTrip(trip: KnownTrip): void {
  const rest = getKnownTrips().filter((t) => t.tripId !== trip.tripId);
  writeStorage(TRIPS_KEY, JSON.stringify([trip, ...rest]));
}

export function removeKnownTrip(tripId: string): void {
  writeStorage(
    TRIPS_KEY,
    JSON.stringify(getKnownTrips().filter((t) => t.tripId !== tripId)),
  );
}

export function findKnownTrip(tripId: string): KnownTrip | undefined {
  return getKnownTrips().find((t) => t.tripId === tripId);
}
