import { useMemo } from "react";
import { toArabicDigits as d } from "../../../utils/arabicNumerals";
import { rnd, shuffle } from "./funUtils";
import { Burst, Choice, Progress, Stage, Talk } from "./kit/ui";
import { useEngine } from "./kit/useEngine";
import type { FunGameProps, FunLevel } from "./types";

// الطرح بدون استلاف: القرد يأكل الموز، والطالب تختار كم بقي.
interface Round {
  a: number;
  b: number;
  ans: number;
  opts: number[];
}

// المستويات: ١ مبتدئ (آحاد فقط) · ٢ متوسط (رقمان) · ٣ متقدم (ثلاثة أرقام).
// في كل مستوى ٦ جولات من ثلاثة أنواع (جولتان لكل نوع)، وكلها بلا استلاف: كل خانة في
// المطروح أصغر من أو تساوي خانتها في العدد الأصلي.
function makeRounds(level: FunLevel): Round[] {
  const out: Round[] = [];
  const seen = new Set<string>();
  const mk = (a: number, b: number) => {
    const ans = a - b;
    const pool =
      level === 1
        ? [ans + 1, ans - 1, ans + 2, ans - 2, b]
        : level === 2
          ? [ans + 1, ans - 1, ans + 10, ans - 10, ans + 2, b + 1]
          : [ans + 1, ans - 1, ans + 10, ans - 10, ans + 100, ans - 100];
    const wrongs = shuffle([...new Set(pool)].filter((x) => x >= 0 && x !== ans)).slice(0, 2);
    out.push({ a, b, ans, opts: shuffle([ans, ...wrongs]) });
  };
  const add = (gen: () => [number, number]) => {
    for (let g = 0; g < 40; g++) {
      const [a, b] = gen();
      const key = `${a}-${b}`;
      if (!seen.has(key)) {
        seen.add(key);
        mk(a, b);
        return;
      }
    }
    const [a, b] = gen();
    mk(a, b);
  };

  if (level === 1) {
    for (let k = 0; k < 2; k++) add(() => [rnd(4, 9), rnd(1, 2)]); // طرح ١ أو ٢
    for (let k = 0; k < 2; k++) { const a = rnd(5, 9); add(() => [a, rnd(2, a - 1)]); } // عددان من رقم واحد
    for (let k = 0; k < 2; k++) { const a = rnd(3, 9); add(() => [a, rnd(1, a - 1)]); } // أي طرح بسيط
  } else if (level === 2) {
    for (let k = 0; k < 2; k++) add(() => { const u1 = rnd(5, 9); return [rnd(1, 4) * 10 + u1, rnd(1, u1)]; }); // رقمين − آحاد
    for (let k = 0; k < 2; k++) add(() => { const t1 = rnd(3, 9); return [t1 * 10 + rnd(1, 9), rnd(1, t1 - 1) * 10]; }); // − عشرات كاملة
    for (let k = 0; k < 2; k++) add(() => { const t1 = rnd(4, 9); const u1 = rnd(3, 9); return [t1 * 10 + u1, rnd(1, t1 - 1) * 10 + rnd(1, u1)]; }); // رقمين − رقمين
  } else {
    for (let k = 0; k < 2; k++) add(() => { const u1 = rnd(3, 9); return [rnd(1, 9) * 100 + rnd(0, 9) * 10 + u1, rnd(1, u1)]; }); // ثلاثة أرقام − آحاد
    for (let k = 0; k < 2; k++) add(() => { const h1 = rnd(2, 9); return [h1 * 100 + rnd(11, 99), rnd(1, h1 - 1) * 100]; }); // − مئات كاملة
    for (let k = 0; k < 2; k++) add(() => { const h1 = rnd(2, 9); const t1 = rnd(3, 9); const u1 = rnd(3, 9); return [h1 * 100 + t1 * 10 + u1, rnd(1, h1 - 1) * 100 + rnd(1, t1) * 10 + rnd(1, u1)]; }); // ثلاثة أرقام − ثلاثة أرقام
  }
  return out;
}

export default function SubtractBasket({ accent, accentDark, level, onDone }: FunGameProps) {
  const rounds = useMemo(() => makeRounds(level), [level]);
  const e = useEngine({ total: rounds.length, onDone });
  const r = rounds[e.i];

  // الخانات: مئات (للمستوى المتقدم فقط) وعشرات وآحاد. بلا استلاف فكل خانة تُطرح من خانتها.
  const hundreds = Math.floor(r.a / 100);
  const tens = Math.floor((r.a % 100) / 10);
  const ones = r.a % 10;
  const rmH = Math.floor(r.b / 100);
  const rmT = Math.floor((r.b % 100) / 10);
  const rmU = r.b % 10;
  const eating = e.phase === "right";

  return (
    <div className="w-full flex flex-col gap-4">
      <Progress i={e.i} total={rounds.length} accent={accent} label="الجولة" />
      <Talk kind="monkey" mood={e.mood} accentDark={accentDark}>
        <p className="text-xs sm:text-sm text-ink-500 mb-1">
          عند القرد {d(r.a)} موزة، وسيأكل {d(r.b)}. كم يبقى؟
        </p>
        <p dir="ltr" className="text-2xl sm:text-3xl tracking-wide">
          {d(r.a)} − {d(r.b)} = {eating ? d(r.ans) : "؟"}
        </p>
      </Talk>

      <Stage className="px-3 pt-4 pb-5" style={{ background: "linear-gradient(180deg,#E6F6D9 0%,#FFF6DE 100%)" }}>
        <span className="absolute top-2 end-3 text-2xl" aria-hidden="true">🌴</span>
        <p className="text-center text-[11px] font-extrabold text-rose-500 mb-3">
          الموز الذي له حلقة حمراء سيأكله القرد
        </p>
        <div key={e.i} className="flex flex-wrap items-end justify-center gap-2 min-h-[110px] relative">
          {Array.from({ length: hundreds }, (_, k) => {
            const gone = k >= hundreds - rmH;
            return (
              <span
                key={`h${k}`}
                className={`w-14 h-16 rounded-xl flex flex-col items-center justify-center text-[10px] font-extrabold text-amber-900 bg-gradient-to-b from-orange-200 to-orange-400 border-b-4 border-orange-600 ${
                  gone ? (eating ? "fun-eaten" : "ring-4 ring-rose-400") : ""
                }`}
                style={gone && eating ? ({ "--ex": "-40px", animationDelay: `${(hundreds - 1 - k) * 90}ms` } as React.CSSProperties) : undefined}
              >
                <span className="text-xl leading-none">🍌</span>
                {d(100)}
              </span>
            );
          })}
          {Array.from({ length: tens }, (_, k) => {
            const gone = k >= tens - rmT;
            return (
              <span
                key={`t${k}`}
                className={`w-11 h-14 rounded-xl flex flex-col items-center justify-center text-[10px] font-extrabold text-amber-800 bg-gradient-to-b from-yellow-200 to-yellow-400 border-b-4 border-yellow-600 ${
                  gone ? (eating ? "fun-eaten" : "ring-4 ring-rose-400") : ""
                }`}
                style={gone && eating ? ({ "--ex": "-40px", animationDelay: `${(tens - 1 - k) * 90}ms` } as React.CSSProperties) : undefined}
              >
                <span className="text-lg leading-none">🍌</span>
                {d(10)}
              </span>
            );
          })}
          {Array.from({ length: ones }, (_, k) => {
            const gone = k >= ones - rmU;
            return (
              <span
                key={`o${k}`}
                className={`text-3xl rounded-full leading-none ${gone ? (eating ? "fun-eaten" : "ring-4 ring-rose-400 bg-rose-100") : ""}`}
                style={gone && eating ? ({ "--ex": "-40px", animationDelay: `${(ones - 1 - k) * 90}ms` } as React.CSSProperties) : undefined}
              >
                🍌
              </span>
            );
          })}
        </div>
      </Stage>

      <div className="grid grid-cols-3 gap-3">
        {r.opts.map((opt) => (
          <div key={`${e.i}-${opt}`} className="relative">
            <Choice
              state={e.stateOf(opt)}
              accent={accent}
              accentDark={accentDark}
              correct={opt === r.ans}
              onClick={() => e.answer(opt, opt === r.ans)}
              className="w-full py-4 text-3xl flex flex-col items-center gap-0.5"
            >
              <span className="text-xl leading-none" aria-hidden="true">🧺</span>
              {d(opt)}
            </Choice>
            {e.picked === opt && <Burst burstKey={e.burst} />}
          </div>
        ))}
      </div>
    </div>
  );
}
