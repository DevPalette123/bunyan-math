import { useEffect, useMemo, useState } from "react";
import { toArabicDigits as d } from "../../../utils/arabicNumerals";
import { rnd, uniq } from "./funUtils";
import Critter from "./kit/Critters";
import { Bubble, Burst, Progress, Stage } from "./kit/ui";
import { useEngine } from "./kit/useEngine";
import type { FunGameProps } from "./types";

// المقارنة: التمساح الجائع يلتهم العدد المطلوب (الأكبر أو الأصغر)، أو لا يأكل شيئًا إن تساويا.
type Key = "a" | "b" | "eq";
interface Round {
  a: number;
  b: number;
  mode: "big" | "small";
  ans: Key;
}

function pair(lo: number, hi: number, gap?: number): [number, number] {
  if (gap) {
    const a = rnd(lo, hi - gap);
    return [a, a + gap];
  }
  const [x, y] = uniq(2, () => rnd(lo, hi));
  return [x, y];
}

function makeRounds(): Round[] {
  const mk = (a: number, b: number, mode: "big" | "small"): Round => ({
    a,
    b,
    mode,
    ans: a === b ? "eq" : (mode === "big" ? a > b : a < b) ? "a" : "b",
  });
  const flip = (p: [number, number]): [number, number] => (Math.random() < 0.5 ? p : [p[1], p[0]]);
  const same = rnd(100, 999);
  return [
    mk(...flip(pair(11, 99)), "big"),
    mk(...flip(pair(11, 99)), "small"),
    mk(...flip(pair(100, 899, rnd(30, 120))), "big"),
    mk(...flip(pair(100, 899, rnd(10, 40))), "small"),
    mk(same, same, "big"),
    mk(...flip(pair(100, 989, rnd(1, 9))), "big"),
  ];
}

export default function BalanceScale({ accent, accentDark, onDone }: FunGameProps) {
  const rounds = useMemo(makeRounds, []);
  const e = useEngine({ total: rounds.length, onDone, advanceMs: 1700 });
  const r = rounds[e.i];
  const [closed, setClosed] = useState(false);

  // الفم مفتوح أثناء الانتظار، ثم يُطبق بعد أن تنزلق الوجبة إليه.
  useEffect(() => {
    if (e.phase === "right") {
      const t = setTimeout(() => setClosed(true), 650);
      return () => clearTimeout(t);
    }
    setClosed(false);
  }, [e.phase, e.i]);

  const picked = e.picked as Key | null;
  const eats = (side: "a" | "b") => e.phase === "right" && (picked === side || picked === "eq");
  const fish = (side: "a" | "b", v: number) => {
    const st = e.stateOf(side);
    const eaten = eats(side);
    return (
      <button
        key={`${e.i}-${side}`}
        type="button"
        data-correct={r.ans === side ? "true" : undefined}
        disabled={st !== "idle"}
        onClick={() => e.answer(side, r.ans === side)}
        className={`relative flex-1 max-w-[9.5rem] rounded-3xl border-2 border-b-[6px] py-4 flex flex-col items-center gap-1 text-3xl sm:text-4xl font-extrabold ${
          st === "wrong" ? "fun-shake" : ""
        } ${st === "dim" && !eaten ? "opacity-35" : ""} active:translate-y-[3px] active:border-b-[3px]`}
        style={{
          backgroundColor: st === "wrong" ? "#FDE7EE" : "#fff",
          borderColor: st === "wrong" ? "#D6486E" : accent,
          color: st === "wrong" ? "#A9294B" : accentDark,
          transform: eaten ? `translateX(${side === "a" ? "70%" : "-70%"}) scale(.2)` : undefined,
          opacity: eaten ? 0 : undefined,
          transition: eaten ? "transform .6s ease-in, opacity .6s ease-in" : undefined,
        }}
      >
        <span className="text-2xl" aria-hidden="true">🐟</span>
        {d(v)}
      </button>
    );
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <Progress i={e.i} total={rounds.length} accent={accent} label="الوجبة" />
      <Bubble accentDark={accentDark} tail={false}>
        {r.mode === "big" ? (
          <p className="text-sm sm:text-base">التمساح جائع! يريد العدد <span className="text-lg" style={{ color: "#D6486E" }}>الأكبر</span></p>
        ) : (
          <p className="text-sm sm:text-base">التمساح في حمية اليوم! يريد العدد <span className="text-lg" style={{ color: "#D6486E" }}>الأصغر</span></p>
        )}
        <p className="text-xs text-ink-500 mt-1">وإن تساوى العددان فلا يأكل شيئًا</p>
      </Bubble>

      <Stage className="px-3 py-6" style={{ background: "linear-gradient(180deg,#D7F0DF 0%,#E3F1FB 100%)" }}>
        <div dir="ltr" className="flex items-stretch justify-between gap-3">
          {fish("a", r.a)}
          <Critter kind="croc" mood={e.mood} open={!closed} className="w-24 sm:w-32 shrink-0 self-center" />
          {fish("b", r.b)}
        </div>
        <Burst burstKey={e.burst} />
      </Stage>

      <div className="flex justify-center">
        <button
          type="button"
          data-correct={r.ans === "eq" ? "true" : undefined}
          disabled={e.stateOf("eq") !== "idle"}
          onClick={() => e.answer("eq", r.ans === "eq")}
          className={`rounded-2xl border-2 border-b-[6px] px-8 py-3 text-lg font-extrabold active:translate-y-[3px] active:border-b-[3px] ${
            e.stateOf("eq") === "wrong" ? "fun-shake" : ""
          } ${e.stateOf("eq") === "dim" ? "opacity-35" : ""}`}
          style={{
            backgroundColor: e.stateOf("eq") === "right" ? "#3E9C6B" : e.stateOf("eq") === "wrong" ? "#FDE7EE" : "#fff",
            borderColor: e.stateOf("eq") === "right" ? "#1F6B45" : e.stateOf("eq") === "wrong" ? "#D6486E" : accent,
            color: e.stateOf("eq") === "right" ? "#fff" : e.stateOf("eq") === "wrong" ? "#A9294B" : accentDark,
          }}
        >
          🟰 متساويان
        </button>
      </div>
    </div>
  );
}
