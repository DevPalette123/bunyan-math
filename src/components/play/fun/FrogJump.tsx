import { useEffect, useMemo, useState } from "react";
import { toArabicDigits as d } from "../../../utils/arabicNumerals";
import { rnd, shuffle } from "./funUtils";
import Critter from "./kit/Critters";
import { Burst, Progress, Stage, Talk } from "./kit/ui";
import { useEngine } from "./kit/useEngine";
import type { FunGameProps } from "./types";

// الجمع بدون حمل: الضفدع يقفز إلى ورقة النيلوفر التي عليها الناتج الصحيح.
interface Round {
  a: number;
  b: number;
  ans: number;
  opts: number[];
}

function makeRounds(): Round[] {
  const out: Round[] = [];
  const mk = (a: number, b: number) => {
    const ans = a + b;
    const wrongs = shuffle([ans + 1, ans - 1, ans + 10, ans - 10, ans + 2, ans - 2].filter((x) => x > 0 && x !== ans)).slice(0, 2);
    out.push({ a, b, ans, opts: shuffle([ans, ...wrongs]) });
  };
  for (let k = 0; k < 2; k++) {
    const u1 = rnd(0, 5);
    mk(rnd(1, 8) * 10 + u1, rnd(1, 9 - u1)); // عدد من رقمين + آحاد
  }
  for (let k = 0; k < 2; k++) {
    const t1 = rnd(1, 6);
    mk(t1 * 10 + rnd(1, 9), rnd(1, 9 - t1) * 10); // + عشرات كاملة
  }
  for (let k = 0; k < 2; k++) {
    const t1 = rnd(1, 5);
    const u1 = rnd(1, 6);
    mk(t1 * 10 + u1, rnd(1, 9 - t1) * 10 + rnd(1, 9 - u1)); // رقمين + رقمين
  }
  return out;
}

const PAD_X = [40, 63, 86]; // مواقع أوراق الإجابة (٪ من العرض)
const START_X = 13;

export default function FrogJump({ accent, accentDark, onDone }: FunGameProps) {
  const rounds = useMemo(makeRounds, []);
  const e = useEngine({ total: rounds.length, onDone });
  const r = rounds[e.i];
  const [frogAt, setFrogAt] = useState<number | "start">("start");
  const [jump, setJump] = useState(0);

  // الضفدع يقفز إلى الورقة المختارة؛ وإن أخطأت يقفز ثم يعود.
  useEffect(() => {
    if (e.picked !== null) {
      setFrogAt(r.opts.indexOf(e.picked as number));
      setJump((j) => j + 1);
    }
  }, [e.picked]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (e.wrongKey !== null) {
      setFrogAt(r.opts.indexOf(e.wrongKey as number));
      setJump((j) => j + 1);
      const t = setTimeout(() => {
        setFrogAt("start");
        setJump((j) => j + 1);
      }, 520);
      return () => clearTimeout(t);
    }
  }, [e.wrongKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setFrogAt("start");
  }, [e.i]);

  const frogX = frogAt === "start" ? START_X : PAD_X[frogAt];

  return (
    <div className="w-full flex flex-col gap-4">
      <Progress i={e.i} total={rounds.length} accent={accent} label="القفزة" />
      <Talk kind="frog" mood={e.mood} accentDark={accentDark}>
        <p className="text-xs sm:text-sm text-ink-500 mb-1">ساعدي الضفدع ليقفز إلى الجواب الصحيح</p>
        <p dir="ltr" className="text-2xl sm:text-3xl tracking-wide">
          {d(r.a)} + {d(r.b)} = {e.phase === "right" ? d(r.ans) : "؟"}
        </p>
      </Talk>

      <Stage className="h-64 sm:h-72" style={{ background: "linear-gradient(180deg,#CFEBFA 0%,#9ED3F0 55%,#5FB3E0 100%)" }}>
        <div dir="ltr" className="absolute inset-0">
          {/* شمس وسحب وزينة */}
          <span className="absolute top-3 right-4 text-3xl" aria-hidden="true">☀️</span>
          <span className="absolute top-5 left-6 text-3xl opacity-80" aria-hidden="true">☁️</span>
          <span className="absolute top-14 left-[46%] text-2xl opacity-60" aria-hidden="true">☁️</span>
          <span className="absolute bottom-3 left-3 text-2xl" aria-hidden="true">🌿</span>
          <span className="absolute bottom-3 right-3 text-2xl" aria-hidden="true">🌿</span>
          <span className="absolute top-20 right-8 text-xl fun-float" aria-hidden="true">🦋</span>
          {/* موج */}
          <svg className="absolute bottom-0 inset-x-0 w-full h-14" viewBox="0 0 400 56" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 22 Q25 8 50 22 T100 22 T150 22 T200 22 T250 22 T300 22 T350 22 T400 22 V56 H0Z" fill="#3E9AD1" opacity=".55" />
            <path d="M0 34 Q25 22 50 34 T100 34 T150 34 T200 34 T250 34 T300 34 T350 34 T400 34 V56 H0Z" fill="#2E86C1" opacity=".6" />
          </svg>

          {/* ورقة البداية */}
          <div
            className="absolute bottom-[26px] w-[19%] h-[22%] rounded-[50%] -translate-x-1/2"
            style={{ left: `${START_X}%`, background: "radial-gradient(circle at 40% 30%,#6DD27F,#2F9D4F)", boxShadow: "0 5px 0 #1F7A3D" }}
          />

          {/* أوراق الإجابات */}
          {r.opts.map((opt, k) => {
            const st = e.stateOf(opt);
            const sunk = e.eliminated.includes(opt);
            return (
              <button
                key={`${e.i}-${opt}`}
                type="button"
                data-correct={opt === r.ans ? "true" : undefined}
                disabled={st !== "idle"}
                onClick={() => e.answer(opt, opt === r.ans)}
                aria-label={String(opt)}
                className={`absolute bottom-[26px] w-[21%] h-[24%] min-h-[58px] rounded-[50%] -translate-x-1/2 flex items-center justify-center text-2xl sm:text-3xl font-extrabold text-white transition-transform active:scale-95 ${
                  sunk ? "fun-sink" : st === "idle" ? "hover:-translate-y-1" : ""
                } ${st === "right" ? "ring-4 ring-yellow-300" : ""}`}
                style={{
                  left: `${PAD_X[k]}%`,
                  background:
                    st === "wrong"
                      ? "radial-gradient(circle at 40% 30%,#F28BA5,#D6486E)"
                      : "radial-gradient(circle at 40% 30%,#6DD27F,#2F9D4F)",
                  boxShadow: st === "wrong" ? "0 5px 0 #A9294B" : "0 5px 0 #1F7A3D",
                  textShadow: "0 2px 0 rgba(0,0,0,.25)",
                }}
              >
                <span className="absolute -top-2 inset-x-[42%] h-3 rounded-b-full bg-[#9ED3F0]" aria-hidden="true" />
                {d(opt)}
                {st === "right" && <Burst burstKey={e.burst} />}
                {st === "wrong" && <span className="fun-ripple absolute inset-0 rounded-full border-4 border-white/80" aria-hidden="true" />}
              </button>
            );
          })}

          {/* الضفدع */}
          <div
            className="absolute bottom-[calc(26px+9%)] w-[17%] -translate-x-1/2 pointer-events-none transition-[left] duration-700 ease-in-out"
            style={{ left: `${frogX}%` }}
          >
            <div key={jump} className={jump > 0 ? "fun-arc" : ""}>
              <Critter kind="frog" mood={e.mood === "idle" && frogAt !== "start" ? "sad" : e.mood} className="w-full aspect-square" />
            </div>
          </div>
        </div>
      </Stage>
    </div>
  );
}
