// Kept in exact sync with src/lib/studentAuth.ts (the client-side copy).
// Deno Edge Functions and the Vite/React app are two separate build targets
// that can't share a module directly, so this logic is intentionally
// duplicated in both places — if you change one, change the other.

// Excludes visually-confusable characters (0/O, 1/I) since this code is read
// aloud and typed by young students.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateStudentCode(): string {
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `BNY-${suffix}`;
}

export function normalizeStudentCode(raw: string): string {
  return raw.trim().toUpperCase();
}

const STUDENT_EMAIL_DOMAIN = "students.bunyan-math.app";

/**
 * The student's login code IS their full credential (used as both the
 * deterministic email local-part and the password) — this is what makes
 * "log in with just a code" possible while still being a real Supabase Auth
 * session (real JWT, real RLS-aware auth.uid()), not a mock. The email
 * itself is never meant to receive mail; it only needs to be a
 * syntactically valid, stable, unique identifier Supabase Auth accepts.
 */
export function studentCodeToEmail(code: string): string {
  return `${normalizeStudentCode(code).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}
