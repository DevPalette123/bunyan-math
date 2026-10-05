// ألعاب «ألعب» — لكل بطاقة مهارة لعبة بفكرة مختلفة تمامًا (بدل «سؤال فأربع خيارات»).
// المعرّفات هي نفسها معرّفات المهارات في playGames.ts. تُحفَظ كل نتيجة في قاعدة
// البيانات (lib/funGames.ts ← supabase/phase8-fun-games.sql) وتظهر للمعلم في «نتائج
// الألعاب»؛ وأفضل نجوم الطالب تُخزَّن أيضًا في جهازها (localStorage) لعرضها على البطاقة.
// لإعادة اللعبة القديمة لمهارة ما: في components/practice/GameCard.tsx احذف السطر الخاص بـ findFunGame.

export type FunGameId =
  | "addition"
  | "subtraction"
  | "rounding"
  | "doubling"
  | "ascending-order"
  | "descending-order"
  | "comparison"
  | "even-odd";

export interface FunGame {
  id: FunGameId;
  /** اسم اللعبة (يختلف عن اسم المهارة). */
  title: string;
  tagline: string;
  emoji: string;
  from: string;
  to: string;
  accent: string;
  accentDark: string;
}

export const funGames: FunGame[] = [
  { id: "addition", title: "الضفدع القفّاز", tagline: "ساعد الضفدع ليقفز إلى الجواب", emoji: "🐸",
    from: "#E3F3E9", to: "#E9F4FB", accent: "#1F7A4D", accentDark: "#0F4E2E" },
  { id: "subtraction", title: "قرد الموز", tagline: "كم موزة بقيت للقرد؟", emoji: "🐒",
    from: "#FDE7EE", to: "#FFF6DE", accent: "#D6486E", accentDark: "#A9294B" },
  { id: "rounding", title: "كرة التلّ", tagline: "إلى أي عدد تتدحرج الكرة؟", emoji: "⛰️",
    from: "#E3F1FB", to: "#E3F3E9", accent: "#3A8FC4", accentDark: "#1F5F86" },
  { id: "doubling", title: "البومة الذكية", tagline: "صِل كل عدد بضعفه", emoji: "🦉",
    from: "#F1E8F8", to: "#FFF6DE", accent: "#8C55AD", accentDark: "#56336B" },
  { id: "ascending-order", title: "قطار الأعداد", tagline: "رتّب العربات من الأصغر", emoji: "🚂",
    from: "#FFF1DA", to: "#DDEFFA", accent: "#E3A422", accentDark: "#8A5F0A" },
  { id: "descending-order", title: "درج البطاريق", tagline: "من الأكبر إلى الأصغر", emoji: "🐧",
    from: "#EEE6F8", to: "#E9F4FB", accent: "#6F428A", accentDark: "#56336B" },
  { id: "comparison", title: "التمساح الجائع", tagline: "أيّ عدد يلتهمه التمساح؟", emoji: "🐊",
    from: "#FFF1DA", to: "#E3F3E9", accent: "#B8552F", accentDark: "#7A3A1E" },
  { id: "even-odd", title: "أرنب التوصيل", tagline: "وصّل الطرد إلى بيته", emoji: "🐰",
    from: "#FDE7EE", to: "#E9F4FB", accent: "#D6486E", accentDark: "#A9294B" },
];

// ───────────── المستويات (كل الألعاب الثماني) ─────────────
// مبتدئ = أعداد من رقم واحد، متوسط = رقمان، متقدم = ثلاثة أرقام. أنواع الأسئلة في كل لعبة
// تبقى نفسها وتتغيّر أحجام الأعداد فقط. لعبة جديدة: أضف معرّفها هنا ثم اجعل مكوّنها
// يقرأ `level`.
export type FunLevelId = 1 | 2 | 3;

export const LEVELED_GAMES: FunGameId[] = [
  "addition",
  "subtraction",
  "rounding",
  "doubling",
  "ascending-order",
  "descending-order",
  "comparison",
  "even-odd",
];

export function hasLevels(id: string | undefined): boolean {
  return LEVELED_GAMES.includes(id as FunGameId);
}

export const FUN_LEVELS: { id: FunLevelId; label: string; hint: string; emoji: string }[] = [
  { id: 1, label: "مبتدئ", hint: "أعداد من رقم واحد", emoji: "🌱" },
  { id: 2, label: "متوسط", hint: "أعداد من رقمين", emoji: "🌿" },
  { id: 3, label: "متقدم", hint: "أعداد من ثلاثة أرقام", emoji: "🌳" },
];

/** مثال قصير يُعرض على زر كل مستوى (مبتدئ، متوسط، متقدم). */
export const LEVEL_EXAMPLES: Partial<Record<FunGameId, [string, string, string]>> = {
  addition: ["٣ + ٤", "٣٥ + ٢٤", "٣٤٥ + ٢٣٢"],
  subtraction: ["٨ − ٣", "٧٨ − ٣٥", "٦٨٩ − ٢٤٥"],
  rounding: ["قرّب ٧", "قرّب ٣٨", "قرّب ٤٦٣"],
  doubling: ["ضعف ٦", "ضعف ٣٤", "ضعف ٢١٠"],
  "ascending-order": ["٣ ٧ ٢", "٤٣ ٧٨ ١٥", "٣٤٥ ٧١٢ ١٥٠"],
  "descending-order": ["٩ ٤ ٦", "٨٢ ٣٧ ٥٩", "٦٤٠ ٨٩٣ ٣٥٧"],
  comparison: ["٤ ؟ ٧", "٣٥ ؟ ٦٢", "٣٤٥ ؟ ٦٢١"],
  "even-odd": ["٦", "٤٧", "٣٥٨"],
};

export function findFunGame(id: string | undefined): FunGame | undefined {
  return funGames.find((g) => g.id === id);
}

const BEST_KEY = (id: string) => `bunyan.fun.best.${id}`;

export function getBestStars(id: string): number {
  try {
    return Number(localStorage.getItem(BEST_KEY(id))) || 0;
  } catch {
    return 0;
  }
}

export function saveBestStars(id: string, stars: number): void {
  try {
    if (stars > getBestStars(id)) localStorage.setItem(BEST_KEY(id), String(stars));
  } catch {
    /* التخزين غير متاح — لا مشكلة */
  }
}
