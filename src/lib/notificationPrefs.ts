const STORAGE_KEY = "bunyan:notifications-enabled";

export function getNotificationsEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function setNotificationsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Storage unavailable (e.g. private browsing) — setting simply won't persist.
  }
}
