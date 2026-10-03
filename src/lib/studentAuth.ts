// Kept in exact sync with supabase/functions/_shared/studentCode.ts (the
// Edge Function copy). The client only ever needs the email-derivation half
// (for logging in with a code) — code generation happens server-side only,
// in the create-student Edge Function.

export function normalizeStudentCode(raw: string): string {
  return raw.trim().toUpperCase();
}

const STUDENT_EMAIL_DOMAIN = "students.bunyan-math.app";

/**
 * The student's login code IS their full credential (used as both the
 * deterministic email local-part and the password) — this is what makes
 * "log in with just a code" possible while still being a real Supabase Auth
 * session (real JWT, real RLS-aware auth.uid()), not a mock.
 */
export function studentCodeToEmail(code: string): string {
  return `${normalizeStudentCode(code).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}
