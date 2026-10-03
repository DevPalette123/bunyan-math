import { useMemo, type ReactNode } from "react";
import { toArabicDigits as d } from "../../../../utils/arabicNumerals";
import Critter, { type CritterKind, type Mood } from "./Critters";

/** شريط تقدّم من أجزاء: الجزء المكتمل بلون اللعبة، والحالي ينبض. */
export function Progress({ i, total, accent, label }: { i: number; total: number; accent: string; label: string }) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-extrabold text-ink-500">
        <span>
          {label} {d(Math.min(i + 1, total))} من {d(total)}
        </span>
      </div>
      <div className="flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={i}>
        {Array.from({ length: total }, (_, k) => (
          <span
            key={k}
            className={`h-2.5 flex-1 rounded-full transition-colors duration-500 ${k === i ? "fun-pulse" : ""}`}
            style={{ backgroundColor: k < i ? accent : k === i ? `${accent}88` : "#E7E1D8" }}
          />
        ))}
      </div>
    </div>
  );
}

/** فقاعة كلام بذيل يشير إلى الشخصية. */
export function Bubble({ children, accentDark, tail = true }: { children: ReactNode; accentDark: string; tail?: boolean }) {
  return (
    <div className="relative flex-1 min-w-0 bg-white rounded-3xl px-4 py-3 shadow-soft border-2 border-white">
      {tail && <span className="absolute -start-1.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rotate-45 rounded-sm" aria-hidden="true" />}
      <div className="relative text-sm sm:text-base font-extrabold leading-relaxed text-center" style={{ color: accentDark }}>
        {children}
      </div>
    </div>
  );
}

/** الشخصية + فقاعة السؤال في صف واحد. */
export function Talk({
  kind,
  mood,
  open,
  accentDark,
  children,
}: {
  kind: CritterKind;
  mood: Mood;
  open?: boolean;
  accentDark: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full flex items-center gap-3">
      <Critter kind={kind} mood={mood} open={open} className="w-24 h-24 sm:w-28 sm:h-28 shrink-0" />
      <Bubble accentDark={accentDark}>{children}</Bubble>
    </div>
  );
}

/** مساحة اللعب: بطاقة مدوّرة بخلفية ملوّنة. */
export function Stage({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative w-full rounded-[2rem] overflow-hidden shadow-soft border-4 border-white ${className}`} style={style}>
      {children}
    </div>
  );
}

type ChoiceState = "idle" | "right" | "wrong" | "dim";

/** زر اختيار ثلاثي الأبعاد كبير يناسب أصابع الصغار. */
export function Choice({
  children,
  state = "idle",
  onClick,
  accent,
  accentDark,
  correct,
  className = "",
  disabled,
}: {
  children: ReactNode;
  state?: ChoiceState;
  onClick: () => void;
  accent: string;
  accentDark: string;
  /** للاختبار الآلي فقط. */
  correct?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const palette =
    state === "right"
      ? { bg: "#3E9C6B", border: "#1F6B45", color: "#fff" }
      : state === "wrong"
      ? { bg: "#FDE7EE", border: "#D6486E", color: "#A9294B" }
      : { bg: "#FFFFFF", border: accent, color: accentDark };
  return (
    <button
      type="button"
      data-correct={correct ? "true" : undefined}
      disabled={disabled || state === "dim" || state === "wrong" || state === "right"}
      onClick={onClick}
      className={`rounded-2xl border-2 border-b-[6px] font-extrabold transition-transform active:translate-y-[3px] active:border-b-[3px] ${
        state === "wrong" ? "fun-shake" : ""
      } ${state === "right" ? "fun-bounce-in" : ""} ${state === "dim" ? "opacity-35" : ""} ${className}`}
      style={{ backgroundColor: palette.bg, borderColor: palette.border, color: palette.color }}
    >
      {children}
    </button>
  );
}

const CONFETTI = ["#F0B94A", "#E4526F", "#5BA9D6", "#3E9C6B", "#A570C2", "#FF8A5B"];

/** انفجار قصاصات ملوّنة عند الإجابة الصحيحة (يتغيّر `burstKey` لإعادة التشغيل). */
export function Burst({ burstKey }: { burstKey: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 16 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 46 + Math.random() * 46;
        return {
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist - 12,
          rot: Math.round(Math.random() * 360),
          color: CONFETTI[k % CONFETTI.length],
          round: k % 3 === 0,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey]
  );
  if (!burstKey) return null;
  return (
    <span key={burstKey} className="pointer-events-none absolute inset-0 flex items-center justify-center z-20" aria-hidden="true">
      {bits.map((b, k) => (
        <span
          key={k}
          className="fun-confetti absolute w-2.5 h-2.5"
          style={
            {
              backgroundColor: b.color,
              borderRadius: b.round ? "9999px" : "2px",
              "--dx": `${b.dx}px`,
              "--dy": `${b.dy}px`,
              "--rot": `${b.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
