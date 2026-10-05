import { useMemo } from "react";
import { toArabicDigits as d } from "../../../utils/arabicNumerals";
import { rnd } from "./funUtils";
import Critter from "./kit/Critters";
import { Choice, Progress, Stage, Talk } from "./kit/ui";
import { useEngine } from "./kit/useEngine";
import type { FunGameProps, FunLevel } from "./types";

// التقريب: الكرة على قمّة التلّ تتدحرج نحو أقرب عشرة (أو مئة).
interface Round {
  n: number;
  unit: 10 | 100;
  lo: number;
  hi: number;
  ans: number;
}

// المستويات: ١ مبتدئ (عدد من رقم واحد ← أقرب عشرة) · ٢ متوسط (عدد من رقمين ← أقرب عشرة)
// · ٣ متقدم (ثلاثة أرقام ← أقرب عشرة ثم أقرب مئة). ٦ جولات في كل مستوى، بعضها أقل من
// المنتصف وبعضها أكبر منه وواحدة عند المنتصف تمامًا.
function makeRounds(level: FunLevel): Round[] {
  const out: Round[] = [];
  const mk = (n: number, unit: 10 | 100) => {
    const lo = Math.floor(n / unit) * unit;
    const hi = lo + unit;
    out.push({ n, unit, lo, hi, ans: n - lo >= unit / 2 ? hi : lo });
  };
  const mix = (items: Round[]) => items.sort(() => Math.random() - 0.5);
  const keep = () => {
    const made = out.splice(0, out.length);
    mix(made).forEach((r) => out.push(r));
  };

  if (level === 1) {
    // ٣ أعداد قبل المنتصف (١–٤) و٣ عند المنتصف وبعده (٥–٩)
    const low = [1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3);
    const high = [5, 6, 7, 8, 9].sort(() => Math.random() - 0.5).slice(0, 3);
    [...low, ...high].forEach((n) => mk(n, 10));
  } else if (level === 2) {
    const t = () => rnd(1, 8) * 10;
    [t() + rnd(1, 4), t() + rnd(1, 4), t() + rnd(1, 4), t() + 5, t() + rnd(6, 9), t() + rnd(6, 9)].forEach((n) => mk(n, 10));
  } else {
    const h = () => rnd(1, 8) * 100;
    // ٣ جولات لأقرب عشرة
    [h() + rnd(1, 9) * 10 + rnd(1, 4), h() + rnd(1, 9) * 10 + 5, h() + rnd(1, 9) * 10 + rnd(6, 9)].forEach((n) => mk(n, 10));
    // ٣ جولات لأقرب مئة
    [h() + rnd(10, 45), h() + 50, h() + rnd(55, 95)].forEach((n) => mk(n, 100));
  }
  keep();
  return out;
}

export default function RoundHill({ accent, accentDark, level, onDone }: FunGameProps) {
  const rounds = useMemo(() => makeRounds(level), [level]);
  const e = useEngine({ total: rounds.length, onDone, advanceMs: 1700 });
  const r = rounds[e.i];
  const rolled = e.phase === "right" ? (e.picked === r.lo ? "lo" : "hi") : null;
  const pos = ((r.n - r.lo) / (r.hi - r.lo)) * 100;
  const unitWord = r.unit === 10 ? "عشرة" : "مئة";

  // موضع الكرة: على القمّة، أو عند لافتة العدد الذي تدحرجت إليه.
  const ballLeft = rolled === "lo" ? 12 : rolled === "hi" ? 88 : 50;
  const ballTop = rolled ? 56 : 8;

  return (
    <div className="w-full flex flex-col gap-4">
      <Progress i={e.i} total={rounds.length} accent={accent} label="الجولة" />
      <Talk kind="ball" mood={e.mood} accentDark={accentDark}>
        <p className="text-xs sm:text-sm text-ink-500 mb-1">إلى أي عدد ستتدحرج الكرة؟</p>
        <p className="text-lg sm:text-xl">
          قرّب <span className="text-2xl">{d(r.n)}</span> إلى أقرب {unitWord}
        </p>
      </Talk>

      <Stage className="h-60 sm:h-64" style={{ background: "linear-gradient(180deg,#CDEBFB 0%,#EAF6FD 60%,#FFF6DE 100%)" }}>
        <div dir="ltr" className="absolute inset-0">
          <span className="absolute top-3 left-5 text-3xl" aria-hidden="true">☁️</span>
          <span className="absolute top-4 right-6 text-3xl" aria-hidden="true">☀️</span>
          <svg className="absolute inset-x-0 bottom-0 w-full h-[78%]" viewBox="0 0 400 190" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 190 L0 150 Q90 138 150 70 Q200 22 250 70 Q310 138 400 150 L400 190Z" fill="#7FCB7A" />
            <path d="M0 190 L0 168 Q100 160 160 110 Q200 82 240 110 Q300 160 400 168 L400 190Z" fill="#5FB566" />
          </svg>
          <span className="absolute bottom-[8%] left-[28%] text-xl" aria-hidden="true">🌼</span>
          <span className="absolute bottom-[10%] right-[30%] text-xl" aria-hidden="true">🌷</span>

          {/* لافتتا العددين */}
          {[
            { v: r.lo, x: 12 },
            { v: r.hi, x: 88 },
          ].map(({ v, x }) => (
            <div key={v} className="absolute bottom-[8%] -translate-x-1/2 flex flex-col items-center" style={{ left: `${x}%` }}>
              <span className={`origin-bottom ${rolled && ((rolled === "lo" && v === r.lo) || (rolled === "hi" && v === r.hi)) ? "fun-wave" : ""}`}>
                <span className="block px-3 py-1.5 rounded-lg bg-amber-100 border-2 border-amber-600 text-amber-900 font-extrabold text-lg sm:text-xl shadow-soft">
                  {d(v)}
                </span>
              </span>
              <span className="w-1.5 h-6 bg-amber-700 rounded-b" />
            </div>
          ))}

          {/* الكرة */}
          <div
            className="absolute w-[22%] max-w-[110px] -translate-x-1/2 pointer-events-none"
            style={{
              left: `${ballLeft}%`,
              top: `${ballTop}%`,
              transition: "left 1.1s cubic-bezier(.5,0,.75,.5), top 1.1s cubic-bezier(.5,0,.75,.5)",
            }}
          >
            <div
              style={{
                transform: rolled ? `rotate(${rolled === "lo" ? -540 : 540}deg)` : "none",
                transition: "transform 1.1s cubic-bezier(.5,0,.75,.5)",
              }}
            >
              <Critter kind="ball" mood={e.mood} className="w-full aspect-square" />
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-white border-2 font-extrabold text-sm shadow-soft" style={{ borderColor: accent, color: accentDark }}>
              {d(r.n)}
            </span>
          </div>
        </div>
      </Stage>

      {/* خط الأعداد: أين يقع العدد بالنسبة لمنتصف المسافة؟ */}
      <div dir="ltr" className="w-full bg-white/80 rounded-2xl px-4 pt-5 pb-3 shadow-soft">
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-3 h-2 rounded-full overflow-hidden flex">
            <span className="flex-1" style={{ backgroundColor: `${accent}55` }} />
            <span className="flex-1 bg-amber-200" />
          </div>
          {[0, 50, 100].map((p) => (
            <span key={p} className="absolute top-1 w-1 h-6 rounded bg-ink-700 -translate-x-1/2" style={{ left: `${p}%` }} />
          ))}
          <span
            className="absolute top-0 -translate-x-1/2 w-5 h-5 rounded-full border-4 border-white shadow transition-all duration-700"
            style={{ left: `${pos}%`, backgroundColor: accent }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-extrabold text-ink-500 mt-1">
          <span>{d(r.lo)}</span>
          <span>المنتصف {d(r.lo + r.unit / 2)}</span>
          <span>{d(r.hi)}</span>
        </div>
      </div>

      <div dir="ltr" className="grid grid-cols-2 gap-4">
        {[r.lo, r.hi].map((v) => (
          <Choice
            key={`${e.i}-${v}`}
            state={e.stateOf(v)}
            accent={accent}
            accentDark={accentDark}
            correct={v === r.ans}
            onClick={() => e.answer(v, v === r.ans)}
            className="py-4 text-3xl"
          >
            {d(v)}
          </Choice>
        ))}
      </div>
    </div>
  );
}
