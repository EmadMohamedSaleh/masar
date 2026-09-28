import type { Profile } from "./types";

const PROFILE_KEY = "masar.profile.v1";
const PEER_OPTIN_KEY = "masar.peerOptIn.v1";
const PEER_ID_KEY = "masar.peerId.v1";

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (typeof parsed.monthlyIncome !== "number" || !Array.isArray(parsed.fixed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY);
}

export function loadPeerOptIn(): boolean {
  return localStorage.getItem(PEER_OPTIN_KEY) === "true";
}

export function savePeerOptIn(value: boolean): void {
  localStorage.setItem(PEER_OPTIN_KEY, value ? "true" : "false");
}

export function getPeerId(): string {
  let id = localStorage.getItem(PEER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PEER_ID_KEY, id);
  }
  return id;
}
