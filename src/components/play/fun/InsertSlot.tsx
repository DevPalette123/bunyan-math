import { useEffect, useMemo, useRef, useState } from "react";
import { toArabicDigits as d } from "../../../utils/arabicNumerals";
import { playGameCorrectSound, playGameWrongSound } from "../../../lib/playSounds";
import { rnd, starsFor, uniq, wait } from "./funUtils";
import Critter from "./kit/Critters";
import { Bubble, Burst, Progress, Stage } from "./kit/ui";
import type { FunGameProps } from "./types";

// الترتيب التنازلي: البطاريق تتسلّق درج الجليد — الأكبر يصعد أولًا إلى أعلى درجة.
function makeRounds(): number[][] {
  const base = rnd(2, 8) * 100;
  return [uniq(4, () => rnd(10, 99)), uniq(4, () => rnd(100, 999)), uniq(5, () => base + rnd(0, 99))];
}

export default function InsertSlot({ accent, accentDark, onDone }: FunGameProps) {
  const rounds = useMemo(makeRounds, []);
  const [r, setR] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [cheer, setCheer] = useState(false);
  const [burst, setBurst] = useState(0);
  const mistakes = useRef(0);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const nums = rounds[r];
  const sorted = useMemo(() => [...nums].sort((a, b) => b - a), [nums]);
  const target = sorted[placed.length];

  async function tap(n: number) {
    if (lock.current || placed.includes(n)) return;
    lock.current = true;
    if (n !== target) {
      mistakes.current += 1;
      setWrong(n);
      playGameWrongSound();
      await wait(650);
      if (!alive.current) return;
      setWrong(null);
      lock.current = false;
      return;
    }
    const next = [...placed, n];
    setPlaced(next);
    playGameCorrectSound(next.length);
    if (next.length < nums.length) {
      lock.current = false;
      return;
    }
    setCheer(true);
    setBurst((b) => b + 1);
    await wait(1500);
    if (!alive.current) return;
    if (r === rounds.length - 1) {
      onDone(starsFor(mistakes.current, 1, 4), mistakes.current);
      return;
    }
    setR(r + 1);
    setPlaced([]);
    setCheer(false);
    lock.current = false;
  }

  const count = nums.length;
  return (
    <div className="w-full flex flex-col gap-4">
      <Progress i={r} total={rounds.length} accent={accent} label="الدرج" />
      <Bubble accentDark={accentDark} tail={false}>
        <p className="text-sm sm:text-base">ساعدي البطاريق على صعود الدرج من الأكبر إلى الأصغر</p>
        <p className="text-xs text-ink-500 mt-0.5">من يصعد أولًا؟ صاحب أكبر عدد 🐧</p>
      </Bubble>

      <Stage className="pt-6 px-3 pb-0" style={{ background: "linear-gradient(180deg,#CDEBFB 0%,#EAF6FD 100%)" }}>
        <span className="absolute top-2 start-4 text-2xl" aria-hidden="true">❄️</span>
        <span className="absolute top-6 end-10 text-xl opacity-70" aria-hidden="true">❄️</span>
        <div className="flex items-end gap-1 min-h-[210px]">
          {sorted.map((n, k) => {
            const filled = k < placed.length;
            const h = 34 + (count - k) * 22;
            return (
              <div key={n} className="flex-1 min-w-0 flex flex-col items-center justify-end">
                <div className="h-[84px] w-full flex items-end justify-center">
                  {filled && (
                    <div className="relative w-[78%] max-w-[84px]">
                      <Critter kind="penguin" mood={cheer ? "happy" : "idle"} className="w-full aspect-square" />
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-lg bg-white border-2 text-sm font-extrabold shadow-soft" style={{ borderColor: accent, color: accentDark }}>
                        {d(n)}
                      </span>
                    </div>
                  )}
                </div>
                <div
                  className="w-full rounded-t-xl flex items-start justify-center pt-1.5 text-[11px] font-extrabold text-sky-700 transition-all"
                  style={{
                    height: h,
                    background: "linear-gradient(180deg,#F4FBFF,#BFE3F6)",
                    borderTop: "4px solid #fff",
                    boxShadow: "inset 0 -6px 0 #9FD0EA",
                  }}
                >
                  {d(k + 1)}
                </div>
              </div>
            );
          })}
        </div>
        <Burst burstKey={burst} />
      </Stage>

      <div className="flex flex-wrap justify-center gap-4 min-h-[8rem]">
        {nums
          .filter((n) => !placed.includes(n))
          .map((n) => (
            <button
              key={`${r}-${n}`}
              type="button"
              data-correct={n === target ? "true" : undefined}
              onClick={() => tap(n)}
              className={`flex flex-col items-center transition-transform active:scale-95 ${wrong === n ? "fun-shake" : "fun-bounce-in"}`}
              aria-label={String(n)}
            >
              <Critter kind="penguin" mood={wrong === n ? "sad" : "idle"} className="w-16 h-16 sm:w-20 sm:h-20" />
              <span
                className="-mt-1 px-3 py-1 rounded-xl border-2 border-b-4 bg-white text-xl sm:text-2xl font-extrabold"
                style={{ borderColor: wrong === n ? "#D6486E" : accent, color: wrong === n ? "#A9294B" : accentDark }}
              >
                {d(n)}
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}
