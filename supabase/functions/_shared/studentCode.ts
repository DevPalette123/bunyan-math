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

// ───────────── رمز الدخول الجديد: حرفان من الاسم + رقمان (مثل Mo-12) ─────────────

const AR_TO_LATIN: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ٱ": "a", "ء": "a", "ئ": "i", "ؤ": "o", "ى": "a",
  "ب": "b", "ت": "t", "ث": "t", "ج": "j", "ح": "h", "خ": "k", "د": "d", "ذ": "d",
  "ر": "r", "ز": "z", "س": "s", "ش": "s", "ص": "s", "ض": "d", "ط": "t", "ظ": "z",
  "ع": "a", "غ": "g", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "ة": "h", "و": "w", "ي": "y",
};
// حروف المد: إن جاءت ثانيةً تعطي حرفًا متحركًا (ناصر → Na، نور → No، سيف → Si).
const LONG_VOWEL: Record<string, string> = { "ا": "a", "أ": "a", "آ": "a", "و": "o", "ي": "i", "ى": "a" };
// حروف تبدأ بصوت متحرك: نأخذ بعدها الحرف الثاني نفسه (أحمد → Ah، عبد → Ab، علي → Al).
const VOWEL_START = new Set(["ا", "أ", "إ", "آ", "ٱ", "ع", "ء", "ئ", "ؤ"]);

/**
 * أول حرفين لاتينيين من اسم الطالب، الأول كبير والثاني صغير:
 * محمد → Mo ، ناصر → Na ، أحمد → Ah ، فاطمة → Fa ، سعيد → Sa ، يوسف → Yo.
 * اسم لاتيني يؤخذ حرفاه الأولان كما هما. وإن لم نجد حروفًا نستعمل «St».
 */
export function nameCodePrefix(fullName: string): string {
  const first = fullName
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // التشكيل والتطويل
    .trim()
    .split(/\s+/)[0] ?? "";

  const latin = first.replace(/[^A-Za-z]/g, "");
  if (latin.length >= 2) return latin[0].toUpperCase() + latin[1].toLowerCase();

  let name = first.replace(/[^\u0621-\u064A]/g, "");
  if (name.length > 3 && name.startsWith("ال")) name = name.slice(2); // الجوهرة → جوهرة
  if (name.length < 2) return "St";
  if (name.startsWith("محم")) return "Mo"; // محمد، محمود، محمد علي …

  const a = name[0];
  const b = name[1];
  const l1 = AR_TO_LATIN[a];
  if (!l1) return "St";
  let l2: string | undefined;
  if (VOWEL_START.has(a)) l2 = AR_TO_LATIN[b];
  else l2 = LONG_VOWEL[b] ?? "a";
  if (!l2) l2 = "a";
  return l1.toUpperCase() + l2.toLowerCase();
}

/**
 * يولّد رمزًا فريدًا مثل Mo-12. `existingCodes` الرموز الموجودة فعلًا، و`skip` رموز
 * (بصيغتها الموحّدة) جرّبناها للتو وتبيّن أنها محجوزة. الرقمان من ١٠ إلى ٩٩، فإن امتلأت
 * كلها لهذا الحرفين نستعمل ثلاثة أرقام (١٠٠–٩٩٩).
 */
export function generateNameCode(
  fullName: string,
  existingCodes: string[],
  skip: Set<string> = new Set()
): string {
  const prefix = nameCodePrefix(fullName);
  const used = new Set<string>(skip);
  for (const c of existingCodes) used.add(normalizeStudentCode(c));

  for (const [lo, hi] of [[10, 99], [100, 999]] as const) {
    const free: number[] = [];
    for (let n = lo; n <= hi; n++) {
      if (!used.has(normalizeStudentCode(`${prefix}${n}`))) free.push(n);
    }
    if (free.length > 0) {
      const n = free[Math.floor(Math.random() * free.length)];
      return `${prefix}-${n}`;
    }
  }
  throw new Error("لا توجد أرقام متاحة لهذا الاسم.");
}
