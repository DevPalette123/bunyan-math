import type { GameId, GameQuestion } from "../lib/games";
import type { MascotAccessory, MascotShape } from "../components/play/Mascot";
import { toArabicDigits } from "../utils/arabicNumerals";

// إعداد عرض كل لعبة في «ألعب». محرّك اللعب (components/play/*, pages/GamePage.tsx)
// عام لا يعرف شيئًا عن الجمع أو الطرح؛ كل ما يخص لعبة بعينها هنا: عنوانها وألوانها
// وشخصيتها وعباراتها وشرح الحل بعد الإجابة. إضافة لعبة جديدة لاحقًا = إدخال جديد
// في هذا الملف + صف في play_games + بنك أسئلتها (مع GameId جديد في lib/games.ts).

export interface GameTheme {
  gameId: GameId;
  title: string; // «مغامرة الجمع»
  skillName: string; // «الجمع بدون حمل» — للعرض للطالب والمعلم
  tagline: string;
  intro: string;
  /** لون جسم الشخصية وشكلها وإكسسوارها. */
  mascot: { body: string; dark: string; accessory: MascotAccessory; shape?: MascotShape };
  /** ألوان المشهد. */
  scene: { from: string; via: string; to: string; accent: string; accentDark: string; gem: string };
  /** لون كل خيار من الخيارات الأربعة (خلفية فاتحة + حافة + نص). */
  bubbles: { bg: string; edge: string; text: string }[];
  cheers: string[]; // عند الإجابة الصحيحة
  streakCheers: string[]; // عند ٣ إجابات صحيحة فأكثر متتالية
  oops: string[]; // عند الخطأ — لطيفة وتعليمية
  results: { great: string; good: string; ok: string; keep: string };
  operatorWord: string;
  /** شرح الحل خطوة خطوة (اختياري — مُفعَّل حاليًا للجمع والطرح فقط). */
  steps?: (q: Pick<GameQuestion, "operandA" | "operandB">) => string[];
}

const d = toArabicDigits;
const digits = (n: number) => ({ u: n % 10, t: Math.floor(n / 10) });

const BUBBLES = [
  { bg: "#FFF4D6", edge: "#E9B949", text: "#7A5A0E" },
  { bg: "#E3F1FB", edge: "#5BA9D6", text: "#1F5F86" },
  { bg: "#F1E8F8", edge: "#A570C2", text: "#56336B" },
  { bg: "#E3F3E9", edge: "#3E9C6B", text: "#146239" },
];

export const GAME_THEMES: Record<GameId, GameTheme> = {
  addition: {
    gameId: "addition",
    title: "مغامرة الجمع",
    skillName: "الجمع بدون حمل",
    tagline: "اجمع الأعداد واجمع الجواهر!",
    intro: "ساعد نجمة الصغيرة في جمع عشر جواهر. كل جمع صحيح يعطيك جوهرة.",
    mascot: { body: "#F0B94A", dark: "#B78317", accessory: "crown" },
    scene: { from: "#DDEFFA", via: "#F3F9FD", to: "#FFF6DE", accent: "#F0B94A", accentDark: "#B78317", gem: "#F0B94A" },
    bubbles: BUBBLES,
    cheers: ["أحسنت!", "رائع!", "ممتاز!", "عمل جميل!", "جمع صحيح!", "أنت ذكي!"],
    streakCheers: ["ما شاء الله! سلسلة رائعة!", "أنت بطل الجمع!", "لا أحد يوقفك اليوم!"],
    oops: [
      "قريبة جدًا! انظر إلى الجواب الصحيح وتعلّم منه.",
      "لا بأس، الخطأ يعلّمنا. جرّب الآحاد أولًا في السؤال القادم.",
      "محاولة جيدة! في المرة القادمة ستنجح.",
    ],
    results: {
      great: "أنت بطل الجمع! جواهرك كثيرة ولمعانها جميل.",
      good: "جمعت جواهر كثيرة، أداء جيد جدًا!",
      ok: "بداية طيبة! العب مرة أخرى وستجمع جواهر أكثر.",
      keep: "لا بأس، كل لعبة تجعلك أقوى. أعد المحاولة وستتحسن.",
    },
    operatorWord: "جمع",
    steps: ({ operandA: a, operandB: b }) => {
      if (b === null) return [];
      const A = digits(a);
      const B = digits(b);
      if (a < 10 && b < 10) return [`${d(a)} + ${d(b)} = ${d(a + b)}`];
      const lines = [`الآحاد: ${d(A.u)} + ${d(B.u)} = ${d(A.u + B.u)}`];
      lines.push(`العشرات: ${d(A.t)} + ${d(B.t)} = ${d(A.t + B.t)}`);
      lines.push(`الناتج: ${d(a + b)}`);
      return lines;
    },
  },
  subtraction: {
    gameId: "subtraction",
    title: "مغامرة الطرح",
    skillName: "الطرح بدون استلاف",
    tagline: "اطرح الأعداد واكتشف الكنز!",
    intro: "ساعد المستكشف الصغير في العثور على عشر جواهر. كل طرح صحيح يقرّبك من الكنز.",
    mascot: { body: "#3E9C6B", dark: "#146239", accessory: "cap" },
    scene: { from: "#D8EFE2", via: "#F1F8F3", to: "#E4F1FA", accent: "#3E9C6B", accentDark: "#146239", gem: "#5BA9D6" },
    bubbles: BUBBLES,
    cheers: ["أحسنت!", "رائع!", "ممتاز!", "طرح صحيح!", "عمل جميل!", "أنت مستكشف ماهر!"],
    streakCheers: ["ما شاء الله! سلسلة رائعة!", "أنت بطل الطرح!", "الكنز يقترب!"],
    oops: [
      "قريبة جدًا! انظر إلى الجواب الصحيح وتعلّم منه.",
      "لا بأس، الخطأ يعلّمنا. اطرح الآحاد أولًا ثم العشرات.",
      "محاولة جيدة! في المرة القادمة ستنجح.",
    ],
    results: {
      great: "أنت بطل الطرح! وجدت الكنز كاملًا.",
      good: "وجدت جواهر كثيرة، أداء جيد جدًا!",
      ok: "بداية طيبة! العب مرة أخرى وستجد جواهر أكثر.",
      keep: "لا بأس، كل لعبة تجعلك أقوى. أعد المحاولة وستتحسن.",
    },
    operatorWord: "طرح",
    steps: ({ operandA: a, operandB: b }) => {
      if (b === null) return [];
      const A = digits(a);
      const B = digits(b);
      if (a < 10 && b < 10) return [`${d(a)} − ${d(b)} = ${d(a - b)}`];
      const lines = [`الآحاد: ${d(A.u)} − ${d(B.u)} = ${d(A.u - B.u)}`];
      lines.push(`العشرات: ${d(A.t)} − ${d(B.t)} = ${d(A.t - B.t)}`);
      lines.push(`الناتج: ${d(a - b)}`);
      return lines;
    },
  },
  rounding: {
    gameId: "rounding",
    title: "مغامرة التقريب",
    skillName: "التقريب",
    tagline: "قرّب العدد وحلّق بالمنطاد!",
    intro: "ساعد منطاد الأرقام في الهبوط عند أقرب محطة. كل تقريب صحيح يقرّبك خطوة في السماء.",
    mascot: { body: "#5BA9D6", dark: "#1F5F86", accessory: "antenna", shape: "star" },
    scene: { from: "#E3F1FB", via: "#F1F8FD", to: "#EDF6EC", accent: "#5BA9D6", accentDark: "#1F5F86", gem: "#5BA9D6" },
    bubbles: BUBBLES,
    cheers: ["أحسنت!", "هبوط مثالي!", "ممتاز!", "تقريب صحيح!", "عمل جميل!", "أنت بارع!"],
    streakCheers: ["ما شاء الله! سلسلة رائعة!", "أنت بطل التقريب!", "منطادك يحلّق عاليًا!"],
    oops: [
      "قريبة جدًا! انظر إلى المحطة الأقرب على الخط.",
      "لا بأس، الخطأ يعلّمنا. إذا كانت الآحاد ٥ فأكثر قرّب للأعلى.",
      "محاولة جيدة! في المرة القادمة ستهبط في المكان الصحيح.",
    ],
    results: {
      great: "أنت بطل التقريب! هبط منطادك في كل محطة بدقة.",
      good: "هبطت في محطات كثيرة بنجاح، أداء جيد جدًا!",
      ok: "بداية طيبة! العب مرة أخرى وستحلّق أعلى.",
      keep: "لا بأس، كل رحلة تجعلك أمهر. أعد المحاولة وستتحسن.",
    },
    operatorWord: "تقريب",
  },
  doubling: {
    gameId: "doubling",
    title: "مغامرة الضعف",
    skillName: "الضعف",
    tagline: "ضاعف العدد وازرع حديقتك!",
    intro: "ساعد فراشة الحديقة في مضاعفة الأزهار. كل ضعف صحيح يضيف زهرة جديدة.",
    mascot: { body: "#E4A6C7", dark: "#9C5B7E", accessory: "bow", shape: "cloud" },
    scene: { from: "#F8ECF3", via: "#F4F8ED", to: "#EAF6EF", accent: "#E4A6C7", accentDark: "#9C5B7E", gem: "#3E9C6B" },
    bubbles: BUBBLES,
    cheers: ["أحسنت!", "ضاعفتها بنجاح!", "ممتاز!", "ضعف صحيح!", "عمل جميل!", "أنت ماهر!"],
    streakCheers: ["ما شاء الله! سلسلة رائعة!", "أنت بطل الضعف!", "حديقتك تزدهر!"],
    oops: [
      "قريبة جدًا! تذكّر: الضعف يعني الجمع مع النفس.",
      "لا بأس، الخطأ يعلّمنا. جرّب جمع العدد مع نفسه في السؤال القادم.",
      "محاولة جيدة! في المرة القادمة ستنجح.",
    ],
    results: {
      great: "أنت بطل الضعف! حديقتك امتلأت بالأزهار.",
      good: "زرعت أزهارًا كثيرة، أداء جيد جدًا!",
      ok: "بداية طيبة! العب مرة أخرى وستزرع أزهارًا أكثر.",
      keep: "لا بأس، كل لعبة تجعلك أقوى. أعد المحاولة وستتحسن.",
    },
    operatorWord: "ضعف",
  },
  "ascending-order": {
    gameId: "ascending-order",
    title: "مغامرة الترتيب التصاعدي",
    skillName: "الترتيب التصاعدي",
    tagline: "اصعد السلّم ورتّب الأعداد من الأصغر للأكبر!",
    intro: "ساعد نملة السلّم في الصعود درجة درجة. كل ترتيب صحيح يرفعها درجة أعلى.",
    mascot: { body: "#E9B949", dark: "#8A6A17", accessory: "antenna" },
    scene: { from: "#FFF6DE", via: "#FBF7ED", to: "#E3F1FB", accent: "#E9B949", accentDark: "#8A6A17", gem: "#5BA9D6" },
    bubbles: BUBBLES,
    cheers: ["أحسنت!", "رائع!", "ترتيب صحيح!", "درجة أعلى!", "عمل جميل!", "أنت ذكي!"],
    streakCheers: ["ما شاء الله! سلسلة رائعة!", "أنت بطل الترتيب!", "السلّم لا يوقفك اليوم!"],
    oops: [
      "قريبة جدًا! انظر إلى الترتيب الصحيح وتعلّم منه.",
      "لا بأس، الخطأ يعلّمنا. ابدأ بأصغر عدد ثم الذي يليه.",
      "محاولة جيدة! في المرة القادمة ستنجح.",
    ],
    results: {
      great: "أنت بطل الترتيب التصاعدي! وصلت إلى أعلى السلّم.",
      good: "صعدت درجات كثيرة، أداء جيد جدًا!",
      ok: "بداية طيبة! العب مرة أخرى وستصعد أعلى.",
      keep: "لا بأس، كل محاولة تجعلك أقوى. أعد المحاولة وستتحسن.",
    },
    operatorWord: "ترتيب تصاعدي",
  },
  "descending-order": {
    gameId: "descending-order",
    title: "مغامرة الترتيب التنازلي",
    skillName: "الترتيب التنازلي",
    tagline: "انزلق من الأعلى ورتّب الأعداد من الأكبر للأصغر!",
    intro: "ساعد بطة الانزلاقة في النزول بأمان. كل ترتيب صحيح يقرّبها من الأرض.",
    mascot: { body: "#A570C2", dark: "#6B4380", accessory: "bow", shape: "cloud" },
    scene: { from: "#F1E8F8", via: "#F4F1FB", to: "#E3F1FB", accent: "#A570C2", accentDark: "#6B4380", gem: "#5BA9D6" },
    bubbles: BUBBLES,
    cheers: ["أحسنت!", "رائع!", "ترتيب صحيح!", "نزول آمن!", "عمل جميل!", "أنت ماهر!"],
    streakCheers: ["ما شاء الله! سلسلة رائعة!", "أنت بطل الترتيب!", "انزلاق مثالي!"],
    oops: [
      "قريبة جدًا! انظر إلى الترتيب الصحيح وتعلّم منه.",
      "لا بأس، الخطأ يعلّمنا. ابدأ بأكبر عدد ثم الذي يليه.",
      "محاولة جيدة! في المرة القادمة ستنجح.",
    ],
    results: {
      great: "أنت بطل الترتيب التنازلي! نزلت بأمان في كل مرة.",
      good: "نزلت درجات كثيرة، أداء جيد جدًا!",
      ok: "بداية طيبة! العب مرة أخرى وستتحسن.",
      keep: "لا بأس، كل محاولة تجعلك أقوى. أعد المحاولة وستتحسن.",
    },
    operatorWord: "ترتيب تنازلي",
  },
  comparison: {
    gameId: "comparison",
    title: "مغامرة المقارنة",
    skillName: "المقارنة",
    tagline: "اختر العلامة الصحيحة وأمِل كفة الميزان!",
    intro: "ساعد بومة الميزان في اختيار العلامة الصحيحة بين العددين: أكبر، أصغر، أم متساويان؟",
    mascot: { body: "#E8935A", dark: "#A85F2E", accessory: "crown", shape: "star" },
    scene: { from: "#FCEBDD", via: "#FBF3EA", to: "#FFF6DE", accent: "#E8935A", accentDark: "#A85F2E", gem: "#E9B949" },
    bubbles: BUBBLES,
    cheers: ["أحسنت!", "رائع!", "مقارنة صحيحة!", "الكفة مالت!", "عمل جميل!", "أنت حكيم!"],
    streakCheers: ["ما شاء الله! سلسلة رائعة!", "أنت بطل المقارنة!", "ميزانك لا يخطئ!"],
    oops: [
      "قريبة جدًا! انظر إلى العلامة الصحيحة وتعلّم منها.",
      "لا بأس، الخطأ يعلّمنا. قارن خانة العشرات أولًا، ثم الآحاد إن تساوت.",
      "محاولة جيدة! في المرة القادمة ستنجح.",
    ],
    results: {
      great: "أنت بطل المقارنة! ميزانك لم يخطئ ولو مرة.",
      good: "اخترت العلامة الصحيحة مرات كثيرة، أداء جيد جدًا!",
      ok: "بداية طيبة! العب مرة أخرى وسيتحسّن ميزانك.",
      keep: "لا بأس، كل محاولة تجعلك أقوى. أعد المحاولة وستتحسن.",
    },
    operatorWord: "مقارنة",
  },
  "even-odd": {
    gameId: "even-odd",
    title: "مغامرة الزوجي والفردي",
    skillName: "الزوجي والفردي",
    tagline: "صنّف العدد: زوجي أم فردي؟",
    intro: "ساعد نحلة الحديقة في وضع كل زهرة رقمية في حديقتها الصحيحة: الزوجية أو الفردية.",
    mascot: { body: "#4FB8A8", dark: "#276E63", accessory: "cap", shape: "cloud" },
    scene: { from: "#DFF3EF", via: "#EFF8F6", to: "#EAF6EF", accent: "#4FB8A8", accentDark: "#276E63", gem: "#3E9C6B" },
    bubbles: BUBBLES,
    cheers: ["أحسنت!", "رائع!", "تصنيف صحيح!", "زهرة جديدة!", "عمل جميل!", "أنت ذكي!"],
    streakCheers: ["ما شاء الله! سلسلة رائعة!", "أنت بطل التصنيف!", "حديقتك تمتلئ!"],
    oops: [
      "قريبة جدًا! انظر إلى الإجابة الصحيحة وتعلّم منها.",
      "لا بأس، الخطأ يعلّمنا. انظر لآخر رقم فيه: صفر أو زوجي ← زوجي، وإلا فردي.",
      "محاولة جيدة! في المرة القادمة ستنجح.",
    ],
    results: {
      great: "أنت بطل الزوجي والفردي! حديقتك مصنَّفة بإتقان.",
      good: "صنّفت أزهارًا كثيرة بنجاح، أداء جيد جدًا!",
      ok: "بداية طيبة! العب مرة أخرى وستتحسن.",
      keep: "لا بأس، كل محاولة تجعلك أقوى. أعد المحاولة وستتحسن.",
    },
    operatorWord: "تصنيف",
  },
};

export function isGameId(value: string | undefined): value is GameId {
  return value !== undefined && Object.prototype.hasOwnProperty.call(GAME_THEMES, value);
}

/** نص تشجيعي حسب النسبة النهائية. */
export function resultMessage(theme: GameTheme, percentage: number): string {
  if (percentage >= 90) return theme.results.great;
  if (percentage >= 70) return theme.results.good;
  if (percentage >= 50) return theme.results.ok;
  return theme.results.keep;
}

/** «٢ د ١٤ ث» أو «١٤ ث». */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${d(m)} د ${d(s)} ث` : `${d(s)} ث`;
}
