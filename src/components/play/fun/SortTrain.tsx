import { useEffect, useMemo, useRef, useState } from "react";
import { toArabicDigits as d } from "../../../utils/arabicNumerals";
import { playGameCorrectSound, playGameWrongSound } from "../../../lib/playSounds";
import { rnd, starsFor, uniq, wait } from "./funUtils";
import { TrainEngine, type Mood } from "./kit/Critters";
import { Bubble, Burst, Progress, Stage } from "./kit/ui";
import type { FunGameProps } from "./types";

// الترتيب التصاعدي: كل عربة تنتظر عددها؛ اضغطي أصغر عدد متبقٍّ فينزلق إلى القطار.
const CAR_COLORS = ["#F0B94A", "#5BA9D6", "#A570C2", "#3E9C6B", "#E4526F"];

function makeRounds(): number[][] {
  const base = rnd(2, 8) * 100;
  return [uniq(4, () => rnd(10, 99)), uniq(5, () => rnd(100, 999)), uniq(5, () => base + rnd(0, 99))];
}

export default function SortTrain({ accent, accentDark, onDone }: FunGameProps) {
  const rounds = useMemo(makeRounds, []);
  const [r, setR] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [driving, setDriving] = useState(false);
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
  const sorted = useMemo(() => [...nums].sort((a, b) => a - b), [nums]);
  const target = sorted[placed.length];
  const mood: Mood = driving ? "happy" : wrong !== null ? "sad" : "idle";

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
    // القطار مكتمل: ينطلق بعيدًا ثم ننتقل للجولة التالية.
    setBurst((b) => b + 1);
    await wait(700);
    if (!alive.current) return;
    setDriving(true);
    await wait(1300);
    if (!alive.current) return;
    if (r === rounds.length - 1) {
      onDone(starsFor(mistakes.current, 1, 4), mistakes.current);
      return;
    }
    setR(r + 1);
    setPlaced([]);
    setDriving(false);
    lock.current = false;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <Progress i={r} total={rounds.length} accent={accent} label="القطار" />
      <Bubble accentDark={accentDark} tail={false}>
        <p className="text-sm sm:text-base">رتّبي العربات من الأصغر إلى الأكبر</p>
        <p className="text-xs text-ink-500 mt-0.5">اضغطي على أصغر عدد أولًا 🚂</p>
      </Bubble>

      <Stage className="pt-8 pb-3 px-2" style={{ background: "linear-gradient(180deg,#DDEFFA 0%,#FFF1DA 70%)" }}>
        <span className="absolute top-2 start-4 text-2xl" aria-hidden="true">☁️</span>
        <span className="absolute top-4 end-8 text-2xl opacity-80" aria-hidden="true">☁️</span>
        <div
          className="flex items-end justify-center gap-0.5"
          style={{
            transform: driving ? "translateX(-130%)" : "translateX(0)",
            transition: driving ? "transform 1.3s cubic-bezier(.6,0,.9,.6)" : "none",
          }}
        >
          <TrainEngine mood={mood} className="w-[24%] shrink-0" />
          {sorted.map((n, k) => {
            const filled = k < placed.length;
            return (
              <div key={n} className="flex-1 min-w-0 flex flex-col items-center">
                <div
                  className={`w-full h-14 sm:h-16 rounded-xl border-2 flex items-center justify-center text-base sm:text-xl font-extrabold ${
                    filled ? "fun-bounce-in border-white text-white" : "border-dashed border-ink-300 text-ink-300"
                  }`}
                  style={{ backgroundColor: filled ? CAR_COLORS[k % CAR_COLORS.length] : "#ffffff99" }}
                >
                  {filled ? d(placed[k]) : d(k + 1)}
                </div>
                <div className="flex justify-around w-full px-1 -mt-0.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#2E4A62] border-2 border-[#F5C242]" />
                  <span className="w-3.5 h-3.5 rounded-full bg-[#2E4A62] border-2 border-[#F5C242]" />
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-1.5 mt-0 mx-1 rounded-full bg-ink-700/70" aria-hidden="true" />
        <Burst burstKey={burst} />
      </Stage>

      <div className="flex flex-wrap justify-center gap-3 min-h-[5.5rem]">
        {nums
          .filter((n) => !placed.includes(n))
          .map((n) => (
            <button
              key={`${r}-${n}`}
              type="button"
              data-correct={n === target ? "true" : undefined}
              onClick={() => tap(n)}
              className={`min-w-[5rem] px-4 py-3.5 rounded-2xl border-2 border-b-[6px] bg-white text-2xl sm:text-3xl font-extrabold transition-transform active:translate-y-[3px] active:border-b-[3px] ${
                wrong === n ? "fun-shake" : "fun-bounce-in"
              }`}
              style={{
                borderColor: wrong === n ? "#D6486E" : accent,
                color: wrong === n ? "#A9294B" : accentDark,
                backgroundColor: wrong === n ? "#FDE7EE" : "#fff",
              }}
            >
              {d(n)}
            </button>
          ))}
      </div>
    </div>
  );
}
