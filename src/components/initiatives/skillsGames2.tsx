import { useMemo, useRef, useState, useEffect } from "react";
import type { LevelProps } from "./skillsGames";
import { shuffle } from "./skillsGames";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { playGameCorrectSound, playGameNextSound, playGameWrongSound } from "../../lib/playSounds";

// ألعاب إضافية لمحطات «تنمية المهارات النمائية» الجديدة: التصنيف وترتيب الخطوات.
// نفس عقد بقية المستويات: onDone(عدد الأخطاء) وonFeedback(صح/خطأ)، ولا رسوب —
// الخطأ يُحتسب ثم تكمل الطالبة حتى تصيب.

function useLater() {
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
}

// ---------------------------------------------------------------------------
// التصنيف: بطاقة واحدة في كل مرة وسلّتان
// ---------------------------------------------------------------------------

export interface SortSide {
  label: string;
  emoji: string;
  color: string;
}
export interface SortItem {
  text: string;
  emoji: string;
  side: "left" | "right";
}
export interface SortData {
  prompt: string;
  left: SortSide;
  right: SortSide;
  items: SortItem[];
}

export function SortLevel({ data, onDone, onFeedback }: LevelProps & { data: SortData }) {
  const items = useMemo(() => shuffle(data.items), [data]);
  const [i, setI] = useState(0);
  const [wrongSide, setWrongSide] = useState<"left" | "right" | null>(null);
  const [okSide, setOkSide] = useState<"left" | "right" | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const later = useLater();
  const item = items[i];
  const streak = useRef(0);

  function pick(side: "left" | "right") {
    if (okSide) return;
    if (side === item.side) {
      streak.current += 1;
      playGameCorrectSound(streak.current);
      onFeedback(true);
      setOkSide(side);
      later(() => {
        if (i === items.length - 1) {
          onDone(mistakes);
          return;
        }
        playGameNextSound();
        setI(i + 1);
        setOkSide(null);
        setWrongSide(null);
      }, 650);
    } else {
      streak.current = 0;
      playGameWrongSound();
      onFeedback(false);
      setMistakes((m) => m + 1);
      setWrongSide(side);
      later(() => setWrongSide(null), 700);
    }
  }

  const sideBtn = (side: "left" | "right", s: SortSide) => (
    <button
      type="button"
      onClick={() => pick(side)}
      className={`flex-1 rounded-2xl border-b-[6px] px-3 py-4 flex flex-col items-center gap-1 font-extrabold text-sm text-white active:translate-y-[3px] active:border-b-[3px] transition-all ${
        wrongSide === side ? "opacity-40" : ""
      } ${okSide === side ? "ring-4 ring-palm-400" : ""}`}
      style={{ backgroundColor: s.color, borderColor: "rgba(0,0,0,.22)" }}
    >
      <span className="text-3xl" aria-hidden="true">
        {s.emoji}
      </span>
      {s.label}
    </button>
  );

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <span className="text-xs font-extrabold text-ink-500">
        {toArabicDigits(i + 1)} من {toArabicDigits(items.length)}
      </span>
      <p className="text-center text-sm sm:text-base font-bold text-ink-700">{data.prompt}</p>
      <div
        key={i}
        className="w-full max-w-xs rounded-[28px] bg-white shadow-soft py-6 px-4 flex flex-col items-center gap-2 animate-pop-in"
      >
        <span className="text-6xl" aria-hidden="true">
          {item.emoji}
        </span>
        <span className="text-lg font-extrabold text-ink-900 text-center">{item.text}</span>
      </div>
      <div className="w-full max-w-sm flex gap-3">
        {sideBtn("right", data.right)}
        {sideBtn("left", data.left)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ترتيب الخطوات: اضغطي الخطوات بالترتيب الصحيح
// ---------------------------------------------------------------------------

export interface StepsData {
  prompt: string;
  /** بالترتيب الصحيح. */
  steps: { text: string; emoji: string }[];
}

export function StepsLevel({ data, onDone, onFeedback }: LevelProps & { data: StepsData }) {
  const order = useMemo(() => shuffle(data.steps.map((_, k) => k)), [data]);
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const later = useLater();

  function tap(k: number) {
    if (picked.includes(k) || picked.length === data.steps.length) return;
    if (k === picked.length) {
      const next = [...picked, k];
      setPicked(next);
      playGameCorrectSound(next.length);
      onFeedback(true);
      if (next.length === data.steps.length) later(() => onDone(mistakes), 700);
    } else {
      playGameWrongSound();
      onFeedback(false);
      setMistakes((m) => m + 1);
      setWrong(k);
      later(() => setWrong(null), 600);
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <p className="text-center text-sm sm:text-base font-bold text-ink-700">{data.prompt}</p>

      <ol className="w-full max-w-sm flex flex-col gap-2 list-none">
        {data.steps.map((s, k) => {
          const done = picked.includes(k);
          return (
            <li
              key={k}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border-2 transition-all ${
                done ? "bg-palm-50 border-palm-400" : "bg-white/60 border-dashed border-ink-300"
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0 ${
                  done ? "bg-palm-500 text-white" : "bg-sand-100 text-ink-400"
                }`}
              >
                {toArabicDigits(k + 1)}
              </span>
              <span className={`text-sm font-extrabold ${done ? "text-ink-900" : "text-transparent select-none"}`}>
                {done ? `${s.emoji} ${s.text}` : "……"}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs font-bold text-ink-500">اضغطي الخطوة التي تأتي {picked.length === 0 ? "أولًا" : "بعد ذلك"}:</p>
      <div className="w-full max-w-sm flex flex-col gap-2">
        {order.map((k) => {
          const s = data.steps[k];
          const used = picked.includes(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => tap(k)}
              disabled={used}
              className={`rounded-2xl bg-white shadow-soft border-b-4 border-sand-200 px-4 py-3 text-start font-extrabold text-sm text-ink-900 transition-all ${
                used ? "opacity-20 scale-95" : "hover:-translate-y-0.5 active:translate-y-0.5"
              } ${wrong === k ? "border-rose-400 bg-rose-50" : ""}`}
            >
              <span className="me-2" aria-hidden="true">
                {s.emoji}
              </span>
              {s.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// المحتوى
// ---------------------------------------------------------------------------

export const SORTS: Record<"foodSort" | "envSort", SortData> = {
  foodSort: {
    prompt: "ضعي كل طعام في السلّة المناسبة:",
    left: { label: "قليلًا فقط", emoji: "🍬", color: "#E08669" },
    right: { label: "يقوّي جسمي", emoji: "💪", color: "#3E9C6B" },
    items: [
      { text: "تفاحة", emoji: "🍎", side: "right" },
      { text: "كعكة بالكريمة", emoji: "🍰", side: "left" },
      { text: "حليب", emoji: "🥛", side: "right" },
      { text: "رقائق البطاطس", emoji: "🍟", side: "left" },
      { text: "جزر", emoji: "🥕", side: "right" },
      { text: "مشروب غازي", emoji: "🥤", side: "left" },
      { text: "سمك", emoji: "🐟", side: "right" },
      { text: "حلوى ملوّنة", emoji: "🍭", side: "left" },
    ],
  },
  envSort: {
    prompt: "هل هذا التصرف يحمي بيئتنا أم يضرّها؟",
    left: { label: "يضرّ البيئة", emoji: "🚯", color: "#D6486E" },
    right: { label: "يحمي البيئة", emoji: "🌿", color: "#3E9C6B" },
    items: [
      { text: "رمي القمامة في السلّة", emoji: "🗑️", side: "right" },
      { text: "ترك الصنبور مفتوحًا", emoji: "🚰", side: "left" },
      { text: "زراعة شجرة", emoji: "🌳", side: "right" },
      { text: "رمي الأوراق في البحر", emoji: "🌊", side: "left" },
      { text: "إطفاء الضوء عند الخروج", emoji: "💡", side: "right" },
      { text: "كسر أغصان الأشجار", emoji: "🪓", side: "left" },
      { text: "استخدام حقيبة قماشية", emoji: "👜", side: "right" },
      { text: "ترك النفايات على الشاطئ", emoji: "🏖️", side: "left" },
    ],
  },
};

export const STEPS: Record<"handwash" | "morning", StepsData> = {
  handwash: {
    prompt: "رتّبي خطوات غسل اليدين:",
    steps: [
      { text: "أبلّل يديّ بالماء", emoji: "🚰" },
      { text: "أضع الصابون وأفركهما جيدًا", emoji: "🧼" },
      { text: "أشطفهما بالماء", emoji: "💦" },
      { text: "أجفّفهما بمنشفة نظيفة", emoji: "🧻" },
    ],
  },
  morning: {
    prompt: "رتّبي روتين الصباح من البداية إلى الذهاب للمدرسة:",
    steps: [
      { text: "أستيقظ من النوم", emoji: "⏰" },
      { text: "أغسل وجهي وأسناني", emoji: "🪥" },
      { text: "أرتدي ملابس المدرسة", emoji: "👕" },
      { text: "أتناول فطوري", emoji: "🥣" },
      { text: "أحمل حقيبتي وأذهب للمدرسة", emoji: "🎒" },
    ],
  },
};
