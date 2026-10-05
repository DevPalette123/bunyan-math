import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { toArabicDigits as d } from "../../../utils/arabicNumerals";
import { playGameCorrectSound, playGameWrongSound } from "../../../lib/playSounds";
import { rnd, shuffle, starsFor, uniq, wait } from "./funUtils";
import { useEffect } from "react";
import { Burst, Progress, Talk } from "./kit/ui";
import type { FunGameProps, FunLevel } from "./types";

// الضعف «توصيل»: صِل كل عدد بضعفه — البومة تشجّع وتصحّح بلطف.
const COLORS = ["#E4526F", "#3A8FC4", "#E3A422", "#3E9C6B", "#8C55AD"];

interface Board {
  nums: number[]; // الأعداد (العمود الأول)
  doubles: number[]; // الأضعاف مخلوطة (العمود الثاني)
}

// المستويات: ١ مبتدئ (أعداد من رقم واحد) · ٢ متوسط (رقمان) · ٣ متقدم (ثلاثة أرقام).
// لوحتان في كل مستوى، في كل لوحة ٥ أعداد. في المتقدم: اللوحة الأولى أعداد مضاعفات العشرة،
// والثانية أرقامها لا تتجاوز ٤ فلا يوجد حمل عند التضعيف.
function makeBoards(level: FunLevel): Board[] {
  const mk = (xs: number[]): Board => ({ nums: shuffle(xs), doubles: shuffle(xs.map((x) => x * 2)) });
  if (level === 1) return [mk(uniq(5, () => rnd(1, 9))), mk(uniq(5, () => rnd(1, 9)))];
  if (level === 2) return [mk(uniq(5, () => rnd(10, 25))), mk(uniq(5, () => rnd(26, 49)))];
  return [
    mk(uniq(5, () => rnd(10, 49) * 10)),
    mk(uniq(5, () => rnd(1, 4) * 100 + rnd(0, 4) * 10 + rnd(0, 4))),
  ];
}

interface Line {
  n: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export default function MemoryMatch({ accent, accentDark, level, onDone }: FunGameProps) {
  const boards = useMemo(() => makeBoards(level), [level]);
  const [b, setB] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]); // الأعداد الموصولة
  const [wrongPair, setWrongPair] = useState<{ n: number; dbl: number } | null>(null);
  const [burst, setBurst] = useState(0);
  const [mood, setMood] = useState<"idle" | "happy" | "sad">("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const mistakes = useRef(0);
  const busy = useRef(false);
  const alive = useRef(true);
  const box = useRef<HTMLDivElement>(null);
  const lRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const rRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const board = boards[b];

  // مواضع الخطوط تُقاس من البطاقات الفعلية، وتُعاد عند تغيّر الحجم.
  useLayoutEffect(() => {
    function measure() {
      if (!box.current) return;
      const c = box.current.getBoundingClientRect();
      const next: Line[] = [];
      for (const n of done) {
        const l = lRefs.current[n]?.getBoundingClientRect();
        const rr = rRefs.current[n * 2]?.getBoundingClientRect();
        if (!l || !rr) continue;
        next.push({ n, x1: l.left - c.left, y1: l.top - c.top + l.height / 2, x2: rr.right - c.left, y2: rr.top - c.top + rr.height / 2 });
      }
      setLines(next);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [done, b]);

  async function tapDouble(dbl: number) {
    if (sel === null || busy.current) return;
    busy.current = true;
    const n = sel;
    if (dbl === n * 2) {
      const next = [...done, n];
      setDone(next);
      setSel(null);
      setBurst((x) => x + 1);
      setMood("happy");
      playGameCorrectSound(next.length);
      await wait(next.length === board.nums.length ? 1200 : 700);
      if (!alive.current) return;
      setMood("idle");
      if (next.length === board.nums.length) {
        if (b === boards.length - 1) {
          onDone(starsFor(mistakes.current, 1, 4), mistakes.current);
          return;
        }
        setB(b + 1);
        setDone([]);
        setLines([]);
      }
    } else {
      mistakes.current += 1;
      setWrongPair({ n, dbl });
      setMood("sad");
      playGameWrongSound();
      await wait(800);
      if (!alive.current) return;
      setWrongPair(null);
      setSel(null);
      setMood("idle");
    }
    busy.current = false;
  }

  const colorOf = (n: number) => COLORS[board.nums.indexOf(n) % COLORS.length];

  return (
    <div className="w-full flex flex-col gap-4">
      <Progress i={b} total={boards.length} accent={accent} label="اللوحة" />
      <Talk kind="owl" mood={mood} accentDark={accentDark}>
        <p className="text-sm sm:text-base">
          الضعف = العدد + نفسه
          <br />
          <span className="text-xs text-ink-500">اضغط على عدد ثم على ضعفه ليتّصلا</span>
        </p>
      </Talk>

      <div ref={box} className="relative w-full rounded-[2rem] border-4 border-white shadow-soft px-3 py-4 sm:px-6" style={{ background: "linear-gradient(180deg,#F1E8F8,#FFF6DE)" }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" aria-hidden="true">
          {lines.map((l) => (
            <path
              key={l.n}
              d={`M${l.x1} ${l.y1} C ${(l.x1 + l.x2) / 2} ${l.y1}, ${(l.x1 + l.x2) / 2} ${l.y2}, ${l.x2} ${l.y2}`}
              stroke={colorOf(l.n)}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="600"
              strokeDashoffset="600"
              style={{ animation: "fun-draw .5s ease-out forwards" }}
            />
          ))}
        </svg>
        <style>{`@keyframes fun-draw { to { stroke-dashoffset: 0; } }`}</style>

        <div key={b} className="relative z-10 flex justify-between gap-10 sm:gap-24">
          {/* الأعداد */}
          <div className="flex flex-col gap-3 flex-1">
            {board.nums.map((n) => {
              const isDone = done.includes(n);
              const isSel = sel === n;
              const isWrong = wrongPair?.n === n;
              return (
                <button
                  key={n}
                  ref={(el) => {
                    lRefs.current[n] = el;
                  }}
                  data-left={n}
                  type="button"
                  disabled={isDone}
                  onClick={() => setSel(isSel ? null : n)}
                  className={`relative h-14 sm:h-16 rounded-2xl border-2 border-b-[5px] font-extrabold text-xl sm:text-2xl flex items-center justify-center gap-2 transition-all ${
                    isWrong ? "fun-shake" : ""
                  } ${isSel ? "scale-105 -translate-y-0.5" : ""}`}
                  style={{
                    backgroundColor: isDone ? colorOf(n) : isSel ? "#FFF3C4" : "#fff",
                    borderColor: isDone ? colorOf(n) : isSel ? "#E3A422" : isWrong ? "#D6486E" : accent,
                    color: isDone ? "#fff" : accentDark,
                  }}
                >
                  <span className="text-xs font-bold opacity-70">ضعف</span>
                  {d(n)}
                  <span className="absolute -start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: isDone ? colorOf(n) : isSel ? "#E3A422" : accent }} />
                </button>
              );
            })}
          </div>
          {/* الأضعاف */}
          <div className="flex flex-col gap-3 flex-1">
            {board.doubles.map((dbl) => {
              const isDone = done.includes(dbl / 2);
              const isWrong = wrongPair?.dbl === dbl;
              return (
                <button
                  key={dbl}
                  ref={(el) => {
                    rRefs.current[dbl] = el;
                  }}
                  data-right={dbl}
                  type="button"
                  disabled={isDone || sel === null}
                  onClick={() => tapDouble(dbl)}
                  className={`relative h-14 sm:h-16 rounded-2xl border-2 border-b-[5px] font-extrabold text-xl sm:text-2xl flex items-center justify-center transition-all ${
                    isWrong ? "fun-shake" : ""
                  } ${sel !== null && !isDone ? "hover:-translate-y-0.5" : ""}`}
                  style={{
                    backgroundColor: isDone ? colorOf(dbl / 2) : "#fff",
                    borderColor: isDone ? colorOf(dbl / 2) : isWrong ? "#D6486E" : sel !== null ? accent : "#E7E1D8",
                    color: isDone ? "#fff" : accentDark,
                    opacity: sel === null && !isDone ? 0.75 : 1,
                  }}
                >
                  {d(dbl)}
                  <span className="absolute -end-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: isDone ? colorOf(dbl / 2) : "#CFC7BA" }} />
                </button>
              );
            })}
          </div>
        </div>
        <Burst burstKey={burst} />
      </div>
    </div>
  );
}
