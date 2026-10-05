import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import GrowthBuddy, { BUDDY_STAGE_NAMES } from "./GrowthBuddy";
import type { BuddyMood } from "./GrowthBuddy";
import {
  BagLevel,
  BreathLevel,
  COLORS,
  FacesLevel,
  KindnessLevel,
  OddOneLevel,
  Shape,
  SimonLevel,
  shuffle,
} from "./skillsGames";
import type { LevelProps, ShapeKind } from "./skillsGames";
import { SORTS, STEPS, SortLevel, StepsLevel } from "./skillsGames2";
import { ChevronIcon, CheckCircleIcon, StarIcon, XCircleIcon } from "../icons/Glyphs";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { primeAudioForInteraction } from "../../lib/sound";
import {
  playGameCorrectSound,
  playGameFinishSound,
  playGameNextSound,
  playGameWelcomeSound,
  playGameWrongSound,
} from "../../lib/playSounds";

// ---------------------------------------------------------------------------
// تنمية المهارات النمائية — رحلة تفاعلية مع «نُمو».
// إحدى عشرة محطة (نجمة)، كل محطة تنمّي مهارة وفيها ٢–٣ ألعاب وأنشطة قصيرة.
// نجوم المحطة (١–٣) = متوسط نجوم أنشطتها، وكل نشاط يعتمد على عدد أخطائه فقط.
// لا رسوب: الخطأ يُعلّم ويمكن المتابعة. إكمال كل المحطات = الإشارة الحقيقية
// لإكمال المبادرة (onComplete) — لم يتغيّر هذا العقد مع الخادم.
// ---------------------------------------------------------------------------

type ActId =
  | "memory" | "simon" | "pattern" | "odd" | "faces" | "breath" | "feelingsQuiz" | "kindness" | "socialQuiz" | "bag" | "selfQuiz"
  | "foodSort" | "handwash" | "healthQuiz" | "morning" | "timeQuiz" | "problemQuiz" | "logicQuiz"
  | "envSort" | "envQuiz" | "confidenceQuiz" | "perseveranceQuiz"
  | "identitySort" | "homelandQuiz" | "identityQuiz";

interface Activity {
  id: ActId;
  title: string;
  /** حدّا الأخطاء لنيل ٣ نجوم ثم ٢ نجمة. */
  tiers: [number, number];
}

interface Domain {
  id: "memory" | "pattern" | "feelings" | "social" | "self" | "health" | "time" | "problem" | "citizen" | "identity" | "confidence";
  title: string;
  skill: string;
  blurb: string;
  emoji: string;
  color: string;
  soft: string;
  activities: Activity[];
}

const DOMAINS: Domain[] = [
  {
    id: "memory",
    title: "الانتباه والذاكرة",
    skill: "التركيز",
    blurb: "بطاقات متطابقة وأضواء ملوّنة تدرّب ذاكرتك.",
    emoji: "🧩",
    color: "#3A8FC4",
    soft: "#E9F4FB",
    activities: [
      { id: "memory", title: "بطاقات الذاكرة", tiers: [3, 6] },
      { id: "simon", title: "تسلسل الأضواء", tiers: [1, 3] },
    ],
  },
  {
    id: "pattern",
    title: "التفكير والمنطق",
    skill: "التفكير",
    blurb: "اكتشف الأنماط وابحث عن الشكل المختلف.",
    emoji: "💡",
    color: "#E3A422",
    soft: "#FDF3DC",
    activities: [
      { id: "pattern", title: "أكمل النمط", tiers: [0, 2] },
      { id: "odd", title: "الشكل المختلف", tiers: [0, 2] },
    ],
  },
  {
    id: "feelings",
    title: "المشاعر",
    skill: "التحكم في الانفعال",
    blurb: "تعرّف على مشاعرك وتعلّم كيف تهدئينها.",
    emoji: "💗",
    color: "#D6486E",
    soft: "#FCE9EE",
    activities: [
      { id: "faces", title: "وجوه المشاعر", tiers: [0, 2] },
      { id: "breath", title: "فقاعة الهدوء", tiers: [0, 0] },
      { id: "feelingsQuiz", title: "ماذا تفعل؟", tiers: [0, 2] },
    ],
  },
  {
    id: "social",
    title: "التعاون مع الآخرين",
    skill: "المهارات الاجتماعية",
    blurb: "كلمات لطيفة وتصرفات جميلة مع زملائك.",
    emoji: "🤝",
    color: "#1F7A4D",
    soft: "#EAF5EE",
    activities: [
      { id: "kindness", title: "صندوق اللطف", tiers: [1, 3] },
      { id: "socialQuiz", title: "ماذا تفعل؟", tiers: [0, 2] },
    ],
  },
  {
    id: "self",
    title: "الاعتماد على النفس",
    skill: "المسؤولية",
    blurb: "جهّز حقيبتك وكن مسؤولة عن أغراضك.",
    emoji: "🎒",
    color: "#8C55AD",
    soft: "#F3EBF7",
    activities: [
      { id: "bag", title: "جهّز حقيبتك", tiers: [1, 3] },
      { id: "selfQuiz", title: "ماذا تفعل؟", tiers: [0, 2] },
    ],
  },
  {
    id: "health",
    title: "العادات الصحية",
    skill: "العناية بالجسم",
    blurb: "غذاء صحي ويدان نظيفتان وجسم نشيط.",
    emoji: "🍎",
    color: "#E3612B",
    soft: "#FDEBDD",
    activities: [
      { id: "foodSort", title: "سلّة الطعام", tiers: [1, 3] },
      { id: "handwash", title: "خطوات غسل اليدين", tiers: [1, 3] },
      { id: "healthQuiz", title: "ماذا تفعل؟", tiers: [0, 2] },
    ],
  },
  {
    id: "time",
    title: "تنظيم الوقت",
    skill: "التخطيط",
    blurb: "رتّب يومك وأنجز مهامك في وقتها.",
    emoji: "⏰",
    color: "#0F8B8D",
    soft: "#E0F4F3",
    activities: [
      { id: "morning", title: "روتين الصباح", tiers: [1, 3] },
      { id: "timeQuiz", title: "ماذا تفعل؟", tiers: [0, 2] },
    ],
  },
  {
    id: "problem",
    title: "حل المشكلات",
    skill: "التفكير الناقد",
    blurb: "فكّر بهدوء وابحث عن الحل المناسب.",
    emoji: "🔍",
    color: "#5A67D8",
    soft: "#ECEEFB",
    activities: [
      { id: "problemQuiz", title: "ماذا تفعل؟", tiers: [0, 2] },
      { id: "logicQuiz", title: "ألغاز الأنماط", tiers: [0, 2] },
    ],
  },
  {
    id: "citizen",
    title: "المواطنة والبيئة",
    skill: "حب الوطن",
    blurb: "احم بيئة عُمان وحافظ على نظافتها.",
    emoji: "🌍",
    color: "#7CB342",
    soft: "#F0F7E4",
    activities: [
      { id: "envSort", title: "يحمي أم يضرّ؟", tiers: [1, 3] },
      { id: "envQuiz", title: "ماذا تفعل؟", tiers: [0, 2] },
    ],
  },
  {
    id: "identity",
    title: "هويتي ووطني",
    skill: "الانتماء والاعتزاز",
    blurb: "تعرّف على سلطنة عُمان: علمها وتراثها وعاداتنا الجميلة.",
    emoji: "🏰",
    color: "#B8322F",
    soft: "#FBE9E7",
    activities: [
      { id: "identitySort", title: "من عُمان أم من بلد آخر؟", tiers: [1, 3] },
      { id: "homelandQuiz", title: "اعرف وطنك عُمان", tiers: [0, 2] },
      { id: "identityQuiz", title: "أعتزّ بهويتي", tiers: [0, 2] },
    ],
  },
  {
    id: "confidence",
    title: "الثقة والمثابرة",
    skill: "الإصرار",
    blurb: "آمن بنفسك وحاول مرة أخرى دائمًا.",
    emoji: "💪",
    color: "#E08669",
    soft: "#FBEAE7",
    activities: [
      { id: "confidenceQuiz", title: "ماذا تقول لنفسك؟", tiers: [0, 2] },
      { id: "perseveranceQuiz", title: "ماذا تفعل؟", tiers: [0, 2] },
    ],
  },
];

const TOTAL_ACTIVITIES = DOMAINS.reduce((n, d) => n + d.activities.length, 0);

/** مراحل نُمو ٠–٥ موزّعة على كل المحطات مهما كان عددها. */
const stageOf = (done: number) => Math.min(5, Math.ceil((done * 5) / DOMAINS.length));

type Item = { kind: ShapeKind; color: string } | { num: number };
type Option = string | Item;

interface Question {
  prompt: string;
  seq?: Item[];
  options: Option[];
  answer: number;
  explain: string;
}

const c = (kind: ShapeKind, color: string): Item => ({ kind, color });

type QuizId =
  | "pattern" | "feelingsQuiz" | "socialQuiz" | "selfQuiz"
  | "healthQuiz" | "timeQuiz" | "problemQuiz" | "logicQuiz" | "envQuiz" | "confidenceQuiz" | "perseveranceQuiz"
  | "homelandQuiz" | "identityQuiz";

const QUESTIONS: Record<QuizId, Question[]> = {
  pattern: [
    {
      prompt: "ما الشكل التالي في النمط؟",
      seq: [c("circle", COLORS.red), c("square", COLORS.blue), c("circle", COLORS.red), c("square", COLORS.blue)],
      options: [c("circle", COLORS.red), c("triangle", COLORS.green), c("star", COLORS.sun)],
      answer: 0,
      explain: "النمط يتكرر: دائرة ثم مربع، فالتالي دائرة.",
    },
    {
      prompt: "ما الشكل التالي في النمط؟",
      seq: [c("triangle", COLORS.green), c("triangle", COLORS.green), c("star", COLORS.sun), c("triangle", COLORS.green), c("triangle", COLORS.green)],
      options: [c("triangle", COLORS.green), c("circle", COLORS.red), c("star", COLORS.sun)],
      answer: 2,
      explain: "بعد كل مثلثين تأتي نجمة، فالتالي نجمة.",
    },
    {
      prompt: "ما العدد التالي؟",
      seq: [{ num: 3 }, { num: 6 }, { num: 9 }],
      options: [{ num: 10 }, { num: 12 }, { num: 11 }],
      answer: 1,
      explain: "نزيد ٣ في كل مرة: ٩ + ٣ = ١٢.",
    },
  ],
  feelingsQuiz: [
    {
      prompt: "أضعت قلمك المفضّل وشعرت بالضيق. ماذا تفعل؟",
      options: ["أصرخ وأرمي حقيبتي", "آخذ نفسًا عميقًا ثم أبحث بهدوء", "أبكي وأرفض البحث"],
      answer: 1,
      explain: "التنفس العميق يهدّئ الجسم، وبعده نفكّر بشكل أفضل.",
    },
    {
      prompt: "فازت زميلك بالمسابقة ولم تفز أنت. كيف تتصرف؟",
      options: ["أهنّئها وأحاول مرة أخرى", "أقول لها إنها غشّت", "أبتعد وأغضب"],
      answer: 0,
      explain: "التهنئة تدلّ على خُلق جميل، والمحاولة من جديد تجعلنا نتحسّن.",
    },
    {
      prompt: "تشعر بالخوف قبل عرض أمام الصف. ما الذي يساعدك؟",
      options: ["أهرب من الصف", "أقول إنني مريضة", "أتنفّس ببطء وأقول: أستطيع"],
      answer: 2,
      explain: "الكلام الإيجابي مع النفس والتنفّس البطيء يقلّلان الخوف.",
    },
  ],
  socialQuiz: [
    {
      prompt: "تريد اللعب بلعبة مع زميلك. ماذا تقول؟",
      options: ["هل أستطيع اللعب معك من فضلك؟", "أخذها منها فورًا", "أصرخ حتى تعطيني إياها"],
      answer: 0,
      explain: "الطلب اللطيف بـ «من فضلك» يجعل الجميع يحبّون اللعب معنا.",
    },
    {
      prompt: "زميلك تحمل كتبًا كثيرة وتكاد تسقطها. ماذا تفعل؟",
      options: ["أضحك عليها", "أتجاهلها", "أساعدها بلطف"],
      answer: 2,
      explain: "مساعدة الآخرين تنشر الفرح وتقوّي الصداقة.",
    },
    {
      prompt: "في عمل جماعي اختلف رأيك مع رأي زملائك. ماذا تفعل؟",
      options: ["أصرّ على رأيي فقط", "أستمع لآرائهن ثم نتفق معًا", "أترك المجموعة"],
      answer: 1,
      explain: "الاستماع لبعضنا يساعدنا على الوصول إلى أفضل فكرة.",
    },
  ],
  selfQuiz: [
    {
      prompt: "قبل النوم، ماذا تجهّز للمدرسة؟",
      options: ["ألعابي فقط", "حقيبتي وواجباتي", "لا شيء، سأتذكّر غدًا"],
      answer: 1,
      explain: "تجهيز الحقيبة من الليل يجعل الصباح هادئًا وأنت مستعد.",
    },
    {
      prompt: "أخطأت في حل مسألة رياضيات. ماذا تفعل؟",
      options: ["أحاول من جديد وأتعلّم من خطئي", "أمزّق الورقة", "أقول: لا أستطيع أبدًا"],
      answer: 0,
      explain: "الخطأ خطوة للتعلّم، والمحاولة من جديد تصنع النجاح.",
    },
    {
      prompt: "وجدت ورقة ملقاة على أرض الصف. ماذا تفعل؟",
      options: ["أتركها مكانها", "أرميها في الممر", "أضعها في سلة المهملات"],
      answer: 2,
      explain: "المحافظة على نظافة الصف مسؤولية كل واحدة منّا.",
    },
  ],
  healthQuiz: [
    {
      prompt: "كم مرة يُنصح أن تنظّف أسنانك في اليوم؟",
      options: ["مرة واحدة كل أسبوع", "مرتين على الأقل: صباحًا وقبل النوم", "لا داعي لتنظيفها"],
      answer: 1,
      explain: "تنظيف الأسنان صباحًا وقبل النوم يحميها من التسوّس.",
    },
    {
      prompt: "ما أفضل مشروب يرافق طعامك ويحافظ على صحتك؟",
      options: ["الماء", "المشروبات الغازية", "عصير كثير السكر"],
      answer: 0,
      explain: "الماء يرطّب الجسم ولا يحتوي على سكر زائد.",
    },
    {
      prompt: "تشعر بالتعب في الصباح. ما الذي يساعدك على النشاط؟",
      options: ["السهر إلى وقت متأخر", "النوم مبكرًا وتناول فطور صحي", "ترك الفطور"],
      answer: 1,
      explain: "النوم الكافي والفطور الصحي يمنحان الجسم طاقة لليوم كله.",
    },
  ],
  timeQuiz: [
    {
      prompt: "لديك واجب ووقت للّعب. ماذا تفعل أولًا؟",
      options: ["أؤجّل الواجب إلى الغد", "أنجز الواجب ثم ألعب", "ألعب حتى أنام"],
      answer: 1,
      explain: "إنجاز المهام أولًا يمنحنا وقتًا للّعب براحة بال.",
    },
    {
      prompt: "كيف تساعدك قائمة المهام؟",
      options: ["تجعلني أنسى", "تنظّم وقتي وتذكّرني بما عليّ", "لا فائدة منها"],
      answer: 1,
      explain: "الكتابة تساعدنا على ترتيب ما نريد إنجازه.",
    },
    {
      prompt: "تأخّرت عن المدرسة هذا الصباح. ما الحل لتجنّب ذلك غدًا؟",
      options: ["أنام مبكرًا وأجهّز أغراضي من الليل", "أتجاهل موعد الاستيقاظ", "أقول: لا يهم"],
      answer: 0,
      explain: "التجهيز المسبق والنوم المبكر يجعلان الصباح هادئًا.",
    },
  ],
  problemQuiz: [
    {
      prompt: "ضاع دفترك في الصف. ما أول خطوة ذكية؟",
      options: ["أبكي وأتوقف عن الدراسة", "أتذكّر أين استخدمته آخر مرة وأبحث هناك", "أتّهم زميلي"],
      answer: 1,
      explain: "التفكير الهادئ في آخر مكان استخدمناه يقرّبنا من الحل.",
    },
    {
      prompt: "اختلفت مع صديقك على لعبة واحدة. ما الحل؟",
      options: ["نلعب بالتناوب، لكل واحدة دور", "نتوقف عن الكلام", "آخذ اللعبة بالقوة"],
      answer: 0,
      explain: "التناوب حلّ عادل يُرضي الجميع.",
    },
    {
      prompt: "لا تفهم خطوة في المسألة. ماذا تفعل؟",
      options: ["أطلب المساعدة من معلمي وأسأل بهدوء", "أترك الواجب فارغًا", "أنسخ من زميلي"],
      answer: 0,
      explain: "السؤال دليل على الذكاء، وبه نتعلّم أكثر.",
    },
  ],
  logicQuiz: [
    {
      prompt: "ما العدد التالي؟",
      seq: [{ num: 2 }, { num: 4 }, { num: 6 }, { num: 8 }],
      options: [{ num: 9 }, { num: 10 }, { num: 12 }],
      answer: 1,
      explain: "نزيد ٢ في كل مرة: ٨ + ٢ = ١٠.",
    },
    {
      prompt: "ما الشكل التالي في النمط؟",
      seq: [c("square", COLORS.red), c("triangle", COLORS.green), c("square", COLORS.red), c("triangle", COLORS.green), c("square", COLORS.red)],
      options: [c("triangle", COLORS.green), c("square", COLORS.red), c("circle", COLORS.blue)],
      answer: 0,
      explain: "النمط يتكرر: مربع ثم مثلث، فالتالي مثلث.",
    },
    {
      prompt: "ما العدد التالي؟",
      seq: [{ num: 5 }, { num: 10 }, { num: 15 }],
      options: [{ num: 18 }, { num: 20 }, { num: 25 }],
      answer: 1,
      explain: "نزيد ٥ في كل مرة: ١٥ + ٥ = ٢٠.",
    },
  ],
  envQuiz: [
    {
      prompt: "ماذا نفعل بالأوراق القديمة بدل رميها؟",
      options: ["نحرقها في الحديقة", "نضعها في صندوق إعادة التدوير", "نرميها في الطريق"],
      answer: 1,
      explain: "إعادة التدوير تحمي الأشجار وتقلّل النفايات.",
    },
    {
      prompt: "كيف نوفّر الماء عند تنظيف الأسنان؟",
      options: ["نترك الصنبور مفتوحًا", "نغلق الصنبور أثناء الفرك", "نملأ الحوض ثم نرميه"],
      answer: 1,
      explain: "الماء نعمة، وإغلاق الصنبور يوفّر الكثير منه.",
    },
    {
      prompt: "لماذا نحافظ على نظافة مدرستنا وحيّنا؟",
      options: ["لأنها وطننا وبيئتنا التي نعيش فيها", "لأن المعلم يراقبنا فقط", "لا يهم الأمر"],
      answer: 0,
      explain: "المحافظة على النظافة حبٌّ للوطن ومسؤولية الجميع.",
    },
  ],
  homelandQuiz: [
    {
      prompt: "ما عاصمة سلطنة عُمان؟",
      options: ["مسقط", "صلالة", "نزوى"],
      answer: 0,
      explain: "مسقط هي عاصمة سلطنة عُمان.",
    },
    {
      prompt: "ما ألوان علم سلطنة عُمان؟",
      options: ["الأزرق والأصفر", "الأبيض والأحمر والأخضر", "الأسود والأبيض"],
      answer: 1,
      explain: "علم عُمان فيه الأبيض والأحمر والأخضر، وفي أعلاه شعار الخنجرين والسيف.",
    },
    {
      prompt: "في أي يوم نحتفل باليوم الوطني العُماني؟",
      options: ["١ يناير", "١٨ نوفمبر", "٢٠ مارس"],
      answer: 1,
      explain: "نحتفل باليوم الوطني في ١٨ نوفمبر من كل عام، ونرفع فيه العلم فرحًا بوطننا.",
    },
  ],
  identityQuiz: [
    {
      prompt: "جاءت ضيفة إلى بيتكم. كيف نستقبلها كما يفعل العُمانيون؟",
      options: ["نرحّب بها بالقهوة والتمر والحلوى", "ندعها تنتظر وحدها", "لا ننتبه لها"],
      answer: 0,
      explain: "الكرم وحسن الضيافة من أجمل صفات أهل عُمان.",
    },
    {
      prompt: "في اليوم الوطني، كيف نعبّر عن حبّنا لوطننا؟",
      options: ["نرفع العلم ونفرح بأدب ونحافظ على نظافة المكان", "نرمي الأوراق الملوّنة في الشارع", "لا نهتم بالمناسبة"],
      answer: 0,
      explain: "حب الوطن يظهر في احترام العلم والمحافظة على بلدنا.",
    },
    {
      prompt: "كيف نحافظ على تراثنا وهويتنا العُمانية؟",
      options: ["نتعلّم من الكبار قصصهم وعاداتنا ونفخر بها", "نهمل لباسنا وعاداتنا", "نخجل من لهجتنا وتراثنا"],
      answer: 0,
      explain: "الاعتزاز بعاداتنا وتراثنا ونقلهما للأجيال يحفظ هويتنا.",
    },
  ],
  confidenceQuiz: [
    {
      prompt: "قالت زميلك إنك لا تجيد الرسم. ماذا تقول لنفسك؟",
      options: ["صحيح، لن أحاول أبدًا", "أستطيع أن أتحسّن إذا تدرّبت", "سأترك الرسم"],
      answer: 1,
      explain: "التدريب يجعلنا أفضل يومًا بعد يوم.",
    },
    {
      prompt: "أخطأت أثناء القراءة أمام الصف. ماذا تفعل؟",
      options: ["أبتسم وأكمل القراءة", "أبكي وأجلس", "أرفض القراءة بعد ذلك"],
      answer: 0,
      explain: "الجميع يخطئ، والشجاعة أن نكمل ونحاول.",
    },
    {
      prompt: "ما الذي يجعلك أقوى في التعلّم؟",
      options: ["الاستسلام سريعًا", "الثقة بنفسي وطلب المساعدة عند الحاجة", "المقارنة بالآخرين دائمًا"],
      answer: 1,
      explain: "الثقة بالنفس مع طلب المساعدة تصنع المتعلّم القوي.",
    },
  ],
  perseveranceQuiz: [
    {
      prompt: "حاولت ربط الحذاء ولم تنجح. ماذا تفعل؟",
      options: ["أحاول مرة أخرى بهدوء", "أرمي الحذاء", "أنتظر أن يفعلها غيري دائمًا"],
      answer: 0,
      explain: "التكرار بهدوء هو طريق النجاح في أي مهارة.",
    },
    {
      prompt: "المسألة صعبة جدًا. ما العبارة التي تقولينها؟",
      options: ["لن أنجح أبدًا", "سأحاول خطوة خطوة", "لا أريد أن أحاول"],
      answer: 1,
      explain: "تقسيم المسألة إلى خطوات صغيرة يجعلها أسهل.",
    },
    {
      prompt: "ماذا يفعل الأبطال عندما لا ينجحون من أول مرة؟",
      options: ["يتعلّمون من الخطأ ويعيدون المحاولة", "يتوقفون فورًا", "يلومون الآخرين"],
      answer: 0,
      explain: "الإصرار هو سرّ كل نجاح كبير.",
    },
  ],
};

const CHEERS = ["أحسنت!", "رائع!", "ممتاز!", "ما شاء الله!", "أنت ذكي!", "كبرتُ بفضلك! 🌱"];
const COMFORTS = ["لا بأس، جرّب مرة أخرى!", "الخطأ يعلّمنا، أنت تستطيع!", "خطوة أخرى وستنجح 💪"];

function starsFor(mistakes: number, tiers: [number, number]): number {
  if (mistakes <= tiers[0]) return 3;
  if (mistakes <= tiers[1]) return 2;
  return 1;
}

function ItemView({ item, size = "w-12 h-12 sm:w-14 sm:h-14" }: { item: Item; size?: string }) {
  if ("num" in item) {
    return <span className="text-4xl sm:text-5xl font-extrabold text-ink-900 leading-none">{toArabicDigits(item.num)}</span>;
  }
  return <Shape kind={item.kind} color={item.color} className={size} />;
}

// ---------------------------------------------------------------------------
// لعبة بطاقات الذاكرة
// ---------------------------------------------------------------------------

interface MemoryCard {
  id: number;
  pair: number;
  kind: ShapeKind;
  color: string;
}

const MEMORY_PAIRS: { kind: ShapeKind; color: string }[] = [
  { kind: "circle", color: COLORS.red },
  { kind: "star", color: COLORS.sun },
  { kind: "triangle", color: COLORS.green },
  { kind: "diamond", color: COLORS.blue },
];

function MemoryLevel({ onDone, onFeedback }: LevelProps) {
  const cards = useMemo<MemoryCard[]>(
    () => shuffle(MEMORY_PAIRS.flatMap((p, i) => [0, 1].map((n) => ({ id: i * 2 + n, pair: i, kind: p.kind, color: p.color })))),
    []
  );
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [locked, setLocked] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function flip(card: MemoryCard) {
    if (locked || flipped.includes(card.id) || matched.includes(card.pair)) return;
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length < 2) return;

    setLocked(true);
    const [a, b] = next.map((id) => cards.find((x) => x.id === id)!);
    if (a.pair === b.pair) {
      playGameCorrectSound(1);
      onFeedback(true);
      later(() => {
        const nextMatched = [...matched, a.pair];
        setMatched(nextMatched);
        setFlipped([]);
        setLocked(false);
        if (nextMatched.length === MEMORY_PAIRS.length) later(() => onDone(mistakes), 500);
      }, 450);
    } else {
      playGameWrongSound();
      onFeedback(false);
      setMistakes((m) => m + 1);
      later(() => {
        setFlipped([]);
        setLocked(false);
      }, 900);
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <p className="text-center text-sm sm:text-base font-bold text-ink-700">اقلب بطاقتين في كل مرة، وابحث عن الشكلين المتطابقين.</p>
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3 w-full max-w-md" style={{ perspective: 800 }}>
        {cards.map((card) => {
          const open = flipped.includes(card.id) || matched.includes(card.pair);
          const isMatched = matched.includes(card.pair);
          return (
            <button
              key={card.id}
              onClick={() => flip(card)}
              aria-label={open ? "بطاقة مكشوفة" : "بطاقة مغلقة"}
              className={`aspect-square relative rounded-2xl shadow-soft transition-transform duration-500 active:scale-95 ${isMatched ? "ring-4 ring-palm-400" : ""}`}
              style={{ transformStyle: "preserve-3d", transform: open ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
              {/* الوجه الخلفي (مغلقة) */}
              <span
                className="absolute inset-0 rounded-2xl flex items-center justify-center bg-berry-400"
                style={{ backfaceVisibility: "hidden" }}
              >
                <StarIcon className="w-1/2 h-1/2 text-white/80" />
              </span>
              {/* الوجه الأمامي (مكشوفة) */}
              <span
                className="absolute inset-0 rounded-2xl flex items-center justify-center bg-white"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <Shape kind={card.kind} color={card.color} className="w-3/4 h-3/4" />
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs font-bold text-ink-500">
        الأزواج: {toArabicDigits(matched.length)} من {toArabicDigits(MEMORY_PAIRS.length)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// أنشطة الأسئلة (تفكير، مشاعر، تعاون، اعتماد على النفس)
// ---------------------------------------------------------------------------

const OPTION_TINTS = [
  { bg: "bg-sky-50", edge: "border-sky-400" },
  { bg: "bg-sun-50", edge: "border-sun-400" },
  { bg: "bg-berry-50", edge: "border-berry-300" },
];

function QuizLevel({
  domain,
  questions,
  onDone,
  onFeedback,
}: LevelProps & {
  domain: Domain;
  questions: Question[];
}) {
  const [qi, setQi] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [correct, setCorrect] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [cheer, setCheer] = useState(CHEERS[0]);
  const streak = useRef(0);
  const q = questions[qi];
  const isText = typeof q.options[0] === "string";

  function pick(i: number) {
    if (correct !== null || wrong.includes(i)) return;
    if (i === q.answer) {
      streak.current += 1;
      playGameCorrectSound(streak.current);
      setCheer(CHEERS[Math.floor(Math.random() * 5)]);
      setCorrect(i);
      onFeedback(true);
    } else {
      streak.current = 0;
      playGameWrongSound();
      onFeedback(false);
      setWrong((w) => [...w, i]);
      setMistakes((m) => m + 1);
    }
  }

  function next() {
    playGameNextSound();
    if (qi === questions.length - 1) {
      onDone(mistakes);
      return;
    }
    setQi(qi + 1);
    setWrong([]);
    setCorrect(null);
  }

  return (
    <div className="w-full flex flex-col items-center gap-5" key={qi}>
      <span className="text-xs font-extrabold text-ink-500">
        السؤال {toArabicDigits(qi + 1)} من {toArabicDigits(questions.length)}
      </span>

      <div className="w-full rounded-[28px] bg-white shadow-soft p-5 sm:p-6 flex flex-col items-center gap-4 animate-rise-in">
        <h2 className="text-lg sm:text-xl font-extrabold text-ink-900 text-center text-balance leading-relaxed">{q.prompt}</h2>
        {q.seq && (
          <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: domain.soft }}>
            {q.seq.map((item, i) => (
              <div key={i} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white flex items-center justify-center shadow-soft">
                <ItemView item={item} />
              </div>
            ))}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-dashed border-ink-300 flex items-center justify-center text-3xl font-extrabold text-ink-400">
              ؟
            </div>
          </div>
        )}
      </div>

      <div className={isText ? "w-full flex flex-col gap-3" : "w-full grid grid-cols-3 gap-3"}>
        {q.options.map((opt, i) => {
          const isWrong = wrong.includes(i);
          const isRight = correct === i;
          const tint = OPTION_TINTS[i % OPTION_TINTS.length];
          const state = isRight
            ? "bg-palm-50 border-palm-500"
            : isWrong
              ? "bg-rose-50 border-rose-400 opacity-70"
              : `${tint.bg} ${tint.edge} hover:scale-[1.02] active:scale-95`;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={correct !== null || isWrong}
              className={`border-2 rounded-2xl transition-all flex items-center gap-3 text-right ${state} ${isText ? "px-4 py-3.5" : "justify-center py-4"}`}
              style={isWrong ? { animation: "sg-shake 0.35s" } : undefined}
            >
              {typeof opt === "string" ? (
                <>
                  <span className="flex-1 text-sm sm:text-base font-extrabold text-ink-900 leading-relaxed">{opt}</span>
                  {isRight && <CheckCircleIcon className="w-5 h-5 text-palm-500 shrink-0" />}
                  {isWrong && <XCircleIcon className="w-5 h-5 text-rose-500 shrink-0" />}
                </>
              ) : (
                <ItemView item={opt} size="w-12 h-12 sm:w-14 sm:h-14" />
              )}
            </button>
          );
        })}
      </div>

      {wrong.length > 0 && correct === null && (
        <p className="text-sm font-bold text-rose-500 text-center animate-rise-in">لا بأس، فكّر مرة أخرى وجرّب خيارًا آخر.</p>
      )}

      {correct !== null && (
        <div className="w-full flex flex-col items-center gap-3 animate-rise-in">
          <p className="text-sm sm:text-base font-extrabold text-palm-600 text-center">
            {cheer} {q.explain}
          </p>
          <button
            onClick={next}
            className="flex items-center gap-1.5 text-white font-extrabold text-sm rounded-2xl px-6 py-2.5 transition-opacity hover:opacity-90"
            style={{ backgroundColor: domain.color }}
          >
            {qi === questions.length - 1 ? "أنهيتُ النشاط" : "التالي"}
            <ChevronIcon className="w-4 h-4 rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// مشهد الخلفية: سماء، غيوم تطفو، تلال خضراء، ونجوم تتلألأ
// ---------------------------------------------------------------------------

function Cloud({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 120 50" className={`absolute pointer-events-none sg-cloud ${className}`} style={style} aria-hidden="true">
      <path d="M22 44 Q4 44 6 30 Q8 18 22 20 Q26 6 44 8 Q58 2 68 14 Q88 8 96 24 Q116 24 114 38 Q112 44 100 44 Z" fill="#fff" opacity="0.85" />
    </svg>
  );
}

function Scene({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden min-h-[calc(100vh-4rem)] lg:min-h-screen"
      style={{ background: "linear-gradient(180deg,#CFEAFA 0%,#EAF6FD 42%,#FFF6DE 100%)" }}
    >
      <style>{`
        @keyframes sg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        @keyframes sg-drift{0%{transform:translateX(-30px)}100%{transform:translateX(60px)}}
        @keyframes sg-twinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:.9;transform:scale(1.1)}}
        @keyframes sg-burst{0%{opacity:0;transform:translateY(0) scale(.2)}25%{opacity:1}100%{opacity:0;transform:translateY(-105px) scale(1.1)}}
        @keyframes sg-bubble{0%{opacity:0;transform:translateY(6px) scale(.9)}100%{opacity:1;transform:translateY(0) scale(1)}}
        .sg-cloud{animation:sg-drift 26s ease-in-out infinite alternate}
        .sg-sparkle{animation:sg-twinkle 2.4s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
        .sg-burst{animation:sg-burst 1.1s ease-out both}
        .sg-say{animation:sg-bubble .3s ease-out both}
      `}</style>

      <Cloud className="top-6 start-[6%] w-28 sm:w-36" />
      <Cloud className="top-24 end-[4%] w-24 sm:w-32" style={{ animationDuration: "34s", animationDelay: "-8s" }} />
      <Cloud className="top-[46%] start-[58%] w-20 sm:w-28 opacity-70" style={{ animationDuration: "40s", animationDelay: "-15s" }} />

      <svg className="absolute inset-x-0 bottom-0 w-full h-40 sm:h-52 pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 90 Q70 40 150 80 T300 70 T400 60 V160 H0 Z" fill="#BFE3C9" />
        <path d="M0 120 Q90 80 190 115 T400 100 V160 H0 Z" fill="#8FCFA5" />
        <path d="M0 145 Q120 118 240 140 T400 132 V160 H0 Z" fill="#5FB884" />
        <g fill="#F0B94A">
          <circle className="sg-sparkle" cx="60" cy="112" r="2.4" />
          <circle className="sg-sparkle" style={{ animationDelay: ".8s" }} cx="210" cy="126" r="2.2" />
          <circle className="sg-sparkle" style={{ animationDelay: "1.6s" }} cx="330" cy="118" r="2.6" />
        </g>
      </svg>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Confetti() {
  const colors = ["#F0B94A", "#DC7F5C", "#3E9C6B", "#5BA9D6", "#E86E8F", "#F3DFC1"];
  const pieces = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 7 + Math.random() * 7,
        round: Math.random() < 0.35,
        color: colors[i % colors.length],
        drift: Math.round((Math.random() - 0.5) * 140),
        duration: 2.8 + Math.random() * 2.2,
        delay: Math.random() * 0.9,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute -top-4 block animate-confetti-fall"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.7,
              borderRadius: p.round ? "9999px" : "2px",
              backgroundColor: p.color,
              "--drift": `${p.drift}px`,
              "--dur": `${p.duration}s`,
              "--delay": `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** انفجار نجوم حول الشخصية عند إنهاء محطة. */
function StarBurst() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="absolute top-1/2 start-1/2 w-0 h-0" style={{ transform: `rotate(${i * 36}deg)` }}>
          <StarIcon className="sg-burst w-5 h-5 text-sun-400 -ms-2.5" />
        </div>
      ))}
    </div>
  );
}

/** فقاعة كلام «نُمو». */
function SpeechBubble({ text, color }: { text: string; color: string }) {
  return (
    <div key={text} className="sg-say relative rounded-2xl bg-white shadow-soft px-4 py-2.5 text-sm font-extrabold text-ink-900 leading-relaxed" style={{ border: `2px solid ${color}33` }}>
      {text}
      <span className="absolute top-1/2 -translate-y-1/2 -start-[7px] w-3 h-3 bg-white rotate-45" style={{ borderTop: `2px solid ${color}33`, borderRight: `2px solid ${color}33` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// الشاشة الرئيسية للعبة
// ---------------------------------------------------------------------------

type Screen = "intro" | "play" | "stationDone" | "final";

interface SkillsGrowthGameProps {
  /** هل أكملت الطالب هذه المبادرة سابقًا (من قاعدة البيانات). */
  alreadyCompleted: boolean;
  /** يُستدعى مرة عند إنهاء كل المحطات — يسجّل الإكمال ويمنح النجوم في الخادم. */
  onComplete: () => void;
  /** حالة الحفظ الحقيقية في الخادم — لا نعرض «أُضيفت النجوم» إلا بعد نجاحه فعلًا. */
  saveStatus: "idle" | "saving" | "saved" | "error";
  onExit: () => void;
}

export default function SkillsGrowthGame({ alreadyCompleted, onComplete, saveStatus, onExit }: SkillsGrowthGameProps) {
  const [screen, setScreen] = useState<Screen>("intro");
  const [level, setLevel] = useState(0);
  const [act, setAct] = useState(0);
  const [actStars, setActStars] = useState<number[]>([]);
  const [earned, setEarned] = useState<number[]>([]);
  const [wasAlready, setWasAlready] = useState(false);
  const [mood, setMood] = useState<BuddyMood>("idle");
  const [say, setSay] = useState("");
  const moodTimer = useRef<number | null>(null);
  const domain = DOMAINS[level];
  const activity = domain.activities[act];

  useEffect(
    () => () => {
      if (moodTimer.current) window.clearTimeout(moodTimer.current);
    },
    []
  );

  /** نُمو يفرح عند الإجابة الصحيحة ويحزن بلطف عند الخطأ ثم يعود هادئًا. */
  function react(good: boolean) {
    const list = good ? CHEERS : COMFORTS;
    setSay(list[Math.floor(Math.random() * list.length)]);
    setMood(good ? "happy" : "sad");
    if (moodTimer.current) window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood("idle"), 1500);
  }

  function start() {
    primeAudioForInteraction();
    playGameWelcomeSound();
    setLevel(0);
    setAct(0);
    setActStars([]);
    setEarned([]);
    setMood("idle");
    setScreen("play");
  }

  function finishActivity(mistakes: number) {
    const stars = starsFor(mistakes, activity.tiers);
    const nextActStars = [...actStars, stars];

    if (act < domain.activities.length - 1) {
      // نشاط آخر في نفس المحطة
      setActStars(nextActStars);
      setAct(act + 1);
      setMood("cheer");
      if (moodTimer.current) window.clearTimeout(moodTimer.current);
      moodTimer.current = window.setTimeout(() => setMood("idle"), 1600);
      playGameNextSound();
      return;
    }

    // انتهت المحطة: نجوم المحطة = متوسط نجوم أنشطتها (لا تقل عن نجمة)
    const avg = nextActStars.reduce((a, b) => a + b, 0) / nextActStars.length;
    const stationStars = Math.max(1, Math.round(avg));
    const nextEarned = [...earned, stationStars];
    setEarned(nextEarned);
    setActStars([]);
    if (nextEarned.length === DOMAINS.length) {
      setWasAlready(alreadyCompleted);
      playGameFinishSound(true);
      if (!alreadyCompleted) onComplete();
      setScreen("final");
    } else {
      playGameNextSound();
      setScreen("stationDone");
    }
  }

  function goNext() {
    setLevel(level + 1);
    setAct(0);
    setMood("idle");
    setScreen("play");
  }

  const total = earned.reduce((a, b) => a + b, 0);

  const header = (
    <div className="w-full flex items-center justify-between">
      <button
        onClick={onExit}
        className="flex items-center gap-1 text-xs font-bold text-ink-700 hover:text-ink-900 bg-white/70 rounded-full px-3 py-1.5 transition-colors"
      >
        <ChevronIcon className="w-3.5 h-3.5 rotate-180" />
        الرئيسية
      </button>
      <h1 className="text-base sm:text-lg font-extrabold text-ink-900">تنمية المهارات النمائية</h1>
      <span className="w-16" />
    </div>
  );

  /** شريط الرحلة: محطات بأيقونات، المضيئة أكملتها الطالب. */
  const trail = (current: number, done: number) => (
    <div className="w-full flex items-center justify-center gap-1 sm:gap-1.5" aria-label="محطات الرحلة">
      {DOMAINS.map((d, i) => {
        const lit = i < done;
        const isCurrent = i === current;
        return (
          <div key={d.id} className="flex items-center gap-1 sm:gap-1.5">
            <div
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base transition-all duration-300 ${isCurrent ? "scale-110" : ""}`}
              style={{
                backgroundColor: lit ? d.color : isCurrent ? "#fff" : "rgba(255,255,255,.65)",
                boxShadow: isCurrent ? `0 0 0 4px ${d.soft}, 0 0 0 6px ${d.color}` : undefined,
                filter: lit || isCurrent ? undefined : "grayscale(.6)",
              }}
              title={d.title}
            >
              {lit ? <StarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <span aria-hidden="true">{d.emoji}</span>}
            </div>
            {i < DOMAINS.length - 1 && <span className={`w-1.5 sm:w-3 h-1.5 rounded-full ${i < done ? "bg-sun-400" : "bg-white/70"}`} />}
          </div>
        );
      })}
    </div>
  );

  function renderActivity() {
    const common = { onDone: finishActivity, onFeedback: react };
    const key = `${level}-${act}`;
    switch (activity.id) {
      case "memory":
        return <MemoryLevel key={key} {...common} />;
      case "simon":
        return <SimonLevel key={key} {...common} />;
      case "odd":
        return <OddOneLevel key={key} {...common} />;
      case "faces":
        return <FacesLevel key={key} {...common} />;
      case "breath":
        return <BreathLevel key={key} {...common} />;
      case "kindness":
        return <KindnessLevel key={key} {...common} />;
      case "bag":
        return <BagLevel key={key} {...common} />;
      case "foodSort":
      case "envSort":
      case "identitySort":
        return <SortLevel key={key} data={SORTS[activity.id]} {...common} />;
      case "handwash":
      case "morning":
        return <StepsLevel key={key} data={STEPS[activity.id]} {...common} />;
      default:
        return <QuizLevel key={key} domain={domain} questions={QUESTIONS[activity.id]} {...common} />;
    }
  }

  let body: ReactNode;

  if (screen === "intro") {
    body = (
      <div className="w-full flex flex-col items-center gap-5 animate-rise-in">
        <div className="flex items-center gap-3 sm:gap-4">
          <GrowthBuddy stage={0} mood="idle" className="w-36 h-48 sm:w-40 sm:h-52 shrink-0" />
          <div className="relative rounded-3xl bg-white shadow-soft px-4 py-3.5 max-w-[15rem]">
            <p className="text-sm font-extrabold text-ink-900 leading-relaxed">
              مرحبًا! أنا «نُمو» 🌱 برعم صغير أحلم أن أُزهر نجمة. ساعدني على النمو في كل محطة!
            </p>
            <span className="absolute top-1/2 -translate-y-1/2 -start-[7px] w-3.5 h-3.5 bg-white rotate-45" />
          </div>
        </div>

        <div className="text-center flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-900">رحلة النجوم الإحدى عشرة</h2>
          <p className="text-sm font-bold text-ink-500">
            {toArabicDigits(DOMAINS.length)} محطات و{toArabicDigits(TOTAL_ACTIVITIES)} لعبة ونشاطًا ممتعًا
          </p>
        </div>

        <ul className="w-full flex flex-col gap-2.5">
          {DOMAINS.map((d, i) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-2xl bg-white/90 shadow-soft px-4 py-3 animate-rise-in"
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: d.soft }} aria-hidden="true">
                {d.emoji}
              </span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-extrabold text-ink-900">{d.title}</span>
                <span className="text-xs font-bold text-ink-500">{d.blurb}</span>
              </div>
              <span className="text-[11px] font-extrabold rounded-full px-2.5 py-1 shrink-0" style={{ backgroundColor: d.soft, color: d.color }}>
                {toArabicDigits(d.activities.length)} ألعاب
              </span>
            </li>
          ))}
        </ul>

        <button
          onClick={start}
          className="flex items-center gap-2 bg-berry-500 hover:bg-berry-600 text-white font-extrabold text-base rounded-2xl px-9 py-3.5 shadow-lift transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          ابدأ الرحلة
          <ChevronIcon className="w-4 h-4 rotate-180" />
        </button>
      </div>
    );
  } else if (screen === "play") {
    const shownMood: BuddyMood = mood === "idle" && activity.id === "breath" ? "calm" : mood;
    const idleLine = act === 0 ? `المحطة ${toArabicDigits(level + 1)}: ${domain.title}. هيا نبدأ!` : `نشاط جديد: ${activity.title}. أنت رائعة!`;
    const bubbleText = mood === "happy" || mood === "sad" ? say : idleLine;

    body = (
      <div className="w-full flex flex-col items-center gap-4">
        {trail(level, earned.length)}

        <div className="w-full flex items-center gap-3 rounded-3xl bg-white/85 shadow-soft px-3 py-2.5" style={{ borderInlineStart: `6px solid ${domain.color}` }}>
          <GrowthBuddy stage={stageOf(earned.length)} mood={shownMood} className="w-16 h-[5.25rem] shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold" style={{ color: domain.color }}>
                {domain.emoji} {domain.title} — {domain.skill}
              </span>
              <span className="text-[11px] font-extrabold text-ink-500 shrink-0">
                {toArabicDigits(act + 1)}/{toArabicDigits(domain.activities.length)}
              </span>
            </div>
            <SpeechBubble text={bubbleText} color={domain.color} />
          </div>
        </div>

        <div className="w-full rounded-[32px] bg-white/70 backdrop-blur-sm shadow-soft px-4 sm:px-6 py-5 flex flex-col items-center gap-4">
          <h2 className="text-base sm:text-lg font-extrabold" style={{ color: domain.color }}>
            {activity.title}
          </h2>
          {renderActivity()}
        </div>
      </div>
    );
  } else if (screen === "stationDone") {
    const got = earned[earned.length - 1];
    body = (
      <div className="w-full flex flex-col items-center gap-5 animate-rise-in">
        {trail(-1, earned.length)}
        <div className="relative">
          <StarBurst />
          <GrowthBuddy stage={stageOf(earned.length)} mood="cheer" className="w-40 h-52" />
        </div>
        <div className="text-center flex flex-col gap-2 items-center">
          <h2 className="text-xl sm:text-2xl font-extrabold text-ink-900">أضأت نجمة «{domain.title}»!</h2>
          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3].map((n) => (
              <StarIcon
                key={n}
                className={`w-10 h-10 ${n <= got ? "text-sun-400 animate-gem-pop" : "text-white/80"}`}
              />
            ))}
          </div>
          <p className="text-sm font-extrabold text-palm-600">كبرتُ بفضلك! أصبحتُ الآن: {BUDDY_STAGE_NAMES[stageOf(earned.length)]}</p>
          <p className="text-sm font-bold text-ink-700">
            {got === 3 ? "أداء مذهل بلا أخطاء تُذكر!" : got === 2 ? "أداء جميل جدًا، استمر!" : "أحسنت، المحاولة تصنع التميّز."}
          </p>
        </div>
        <button
          onClick={goNext}
          className="flex items-center gap-2 text-white font-extrabold text-base rounded-2xl px-8 py-3.5 shadow-lift transition-all hover:-translate-y-0.5"
          style={{ backgroundColor: DOMAINS[level + 1].color }}
        >
          المحطة التالية: {DOMAINS[level + 1].title}
          <ChevronIcon className="w-4 h-4 rotate-180" />
        </button>
      </div>
    );
  } else {
    body = (
      <div className="w-full flex flex-col items-center gap-5 animate-rise-in">
        <Confetti />
        {trail(-1, DOMAINS.length)}
        <div className="relative">
          <StarBurst />
          <GrowthBuddy stage={5} mood="cheer" className="w-44 h-56" />
        </div>
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-900">أزهرتُ بفضلك! 🌟</h2>
          <p className="text-sm sm:text-base font-bold text-ink-700 text-balance">
            أضأت النجوم الإحدى عشرة ونمّيت مهاراتك في التركيز والتفكير والمشاعر والتعاون والاعتماد على النفس والصحة وتنظيم الوقت وحل المشكلات والمواطنة والاعتزاز بهويتك العُمانية والثقة بالنفس.
          </p>
        </div>

        <div className="w-full grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-sun-50 text-sun-600 p-4 flex flex-col items-center gap-1 shadow-soft">
            <StarIcon className="w-5 h-5" />
            <span className="text-2xl font-extrabold">
              {toArabicDigits(total)} / {toArabicDigits(DOMAINS.length * 3)}
            </span>
            <span className="text-xs font-bold">نجوم الرحلة</span>
          </div>
          {saveStatus === "error" && !wasAlready ? (
            <div className="rounded-2xl bg-rose-50 text-rose-500 p-4 flex flex-col items-center gap-1.5 shadow-soft">
              <XCircleIcon className="w-5 h-5" />
              <span className="text-xs font-extrabold text-center">تعذّر حفظ النجوم</span>
              <button onClick={onComplete} className="text-[11px] font-extrabold underline">
                إعادة المحاولة
              </button>
            </div>
          ) : saveStatus === "saving" && !wasAlready ? (
            <div className="rounded-2xl bg-sand-100 text-ink-500 p-4 flex flex-col items-center gap-1 shadow-soft">
              <span className="text-lg font-extrabold">...</span>
              <span className="text-xs font-bold">جارٍ حفظ إنجازك</span>
            </div>
          ) : (
            <div className="rounded-2xl bg-palm-50 text-palm-600 p-4 flex flex-col items-center gap-1 shadow-soft">
              <CheckCircleIcon className="w-5 h-5" />
              <span className="text-2xl font-extrabold">{wasAlready ? "مكتملة" : "+٥"}</span>
              <span className="text-xs font-bold">{wasAlready ? "أُضيفت نجومها سابقًا" : "نجوم أُضيفت لرصيدك"}</span>
            </div>
          )}
        </div>

        <ul className="w-full flex flex-col gap-2">
          {DOMAINS.map((d, i) => (
            <li key={d.id} className="flex items-center justify-between rounded-2xl bg-white/90 shadow-soft px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-extrabold text-ink-900">
                <span aria-hidden="true">{d.emoji}</span>
                {d.title}
              </span>
              <span className="flex items-center gap-0.5">
                {[1, 2, 3].map((n) => (
                  <StarIcon key={n} className={`w-5 h-5 ${n <= (earned[i] ?? 0) ? "text-sun-400" : "text-sand-200"}`} />
                ))}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <button onClick={start} className="bg-berry-500 hover:bg-berry-600 text-white font-extrabold text-sm rounded-2xl px-6 py-2.5 transition-colors">
            العب مرة أخرى
          </button>
          <button onClick={onExit} className="bg-white shadow-soft text-ink-700 font-extrabold text-sm rounded-2xl px-6 py-2.5">
            الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <Scene>
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-28 lg:pb-10 flex flex-col items-center gap-5">
        {header}
        {body}
      </main>
    </Scene>
  );
}
