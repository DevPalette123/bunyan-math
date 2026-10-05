// Kept in sync with src/lib/studentAuth.ts (the client-side copy).
// Deno Edge Functions and the Vite/React app are two separate build targets
// that can't share a module directly, so the shared half (normalize / email /
// password) is intentionally duplicated in both places — if you change one,
// change the other. The generation half (sequence numbers) lives only here.
//
// صيغتان للرمز:
//   1) الجديدة (البسيطة): BNY + رقم تسلسلي، مثل BNY1 و BNY2 و BNY12.
//   2) القديمة: BNY-XXXXX — تبقى تعمل كما هي للطلاب الذين أُنشئوا قبل هذا التعديل
//      (وما زالت تستعملها حسابات التجربة).

export const CODE_PREFIX = "BNY";

const LEGACY_CODE = /^BNY-[A-Z0-9]{5}$/;
const SEQUENTIAL_CODE = /^BNY(\d+)$/;

// Excludes visually-confusable characters (0/O, 1/I). Used only by the legacy
// generator below (demo accounts).
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateStudentCode(): string {
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `BNY-${suffix}`;
}

/**
 * توحيد الكتابة حتى يدخل الطفل رمزه بأي شكل مقبول: أحرف صغيرة أو كبيرة،
 * أرقام عربية (١٢) أو لاتينية، مسافات أو شرطة (bny 12 ، BNY-12).
 */
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
 * The student's login code IS their credential — it deterministically maps to
 * both the (never-mailed) email and the password, so "log in with just a code"
 * is still a real Supabase Auth session (real JWT, real RLS-aware auth.uid()),
 * not a mock.
 */
export function studentCodeToEmail(code: string): string {
  return `${normalizeStudentCode(code).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

/**
 * الرمز الجديد قصير (مثل BNY1) وأقصر من الحد الأدنى لطول كلمة مرور Supabase،
 * لذلك تُضاف له لاحقة ثابتة. الرموز القديمة تبقى كلمة مرورها هي الرمز نفسه.
 */
export function studentCodePassword(code: string): string {
  const n = normalizeStudentCode(code);
  return LEGACY_CODE.test(n) ? n : `${n}-bunyan`;
}

// ───────────── توليد الرمز (على الخادم فقط) ─────────────

/**
 * أصغر رقم غير مستعمل (١، ٢، ٣ …). `existingCodes` هي الرموز الموجودة فعلًا في
 * الجدول، و`skip` أرقام جرّبناها للتو وتبيّن أنها محجوزة.
 */
export function nextSequenceNumber(existingCodes: string[], skip: Set<number> = new Set()): number {
  const used = new Set<number>(skip);
  for (const c of existingCodes) {
    const m = SEQUENTIAL_CODE.exec(c);
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n++;
  return n;
}
