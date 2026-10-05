// Kept in exact sync with the shared half of supabase/functions/_shared/studentCode.ts
// (the Edge Function copy). The client only needs to turn a typed code into
// the email + password used to sign in — code generation (BNY + a sequence
// number) happens server-side only, in the create-student Edge Function.
//
// الرموز الجديدة بسيطة، مثل BNY1 أو BNY12، والقديمة BNY-XXXXX ما زالت تعمل.

const LEGACY_CODE = /^BNY-[A-Z0-9]{5}$/;

export function normalizeStudentCode(raw: string): string {
  const t = raw
    .normalize("NFKC")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // ٠-٩
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ۰-۹
    .trim()
    .toUpperCase();
  if (LEGACY_CODE.test(t)) return t; // الرموز القديمة تبقى كما كانت
  return t.replace(/[^A-Z0-9]/g, "");
}

const STUDENT_EMAIL_DOMAIN = "students.bunyan-math.app";

/**
 * The student's login code IS their credential (it maps deterministically to
 * both the email and the password) — this is what makes "log in with just a
 * code" possible while still being a real Supabase Auth session (real JWT,
 * real RLS-aware auth.uid()), not a mock.
 */
export function studentCodeToEmail(code: string): string {
  return `${normalizeStudentCode(code).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

export function studentCodePassword(code: string): string {
  const n = normalizeStudentCode(code);
  return LEGACY_CODE.test(n) ? n : `${n}-bunyan`;
}
