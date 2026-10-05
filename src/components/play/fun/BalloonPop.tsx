import { useMemo } from "react";
import { toArabicDigits as d } from "../../../utils/arabicNumerals";
import { rnd, shuffle } from "./funUtils";
import { Burst, Progress, Stage, Talk } from "./kit/ui";
import { useEngine } from "./kit/useEngine";
import type { FunGameProps, FunLevel } from "./types";

// الزوجي والفردي: الأرنب يوصّل الطرد إلى البيت الصحيح — بيت الزوجي أو بيت الفردي.
type Key = "even" | "odd";

function gen(lo: number, hi: number, parity: 0 | 1): number {
  const v = rnd(lo, hi);
  if (v % 2 === parity) return v;
  return v + 1 <= hi ? v + 1 : v - 1;
}

// المستويات: ١ مبتدئ (رقم واحد) · ٢ متوسط (رقمان) · ٣ متقدم (ثلاثة أرقام).
// ٨ طرود في كل مستوى: ٤ زوجية و٤ فردية، بلا تكرار لنفس العدد.
function makeRounds(level: FunLevel): number[] {
  if (level === 1) return shuffle([2, 4, 6, 8, ...shuffle([1, 3, 5, 7, 9]).slice(0, 4)]);
  const [lo, hi] = level === 2 ? [10, 99] : [100, 999];
  const parities = shuffle<0 | 1>([0, 0, 0, 0, 1, 1, 1, 1]);
  const out: number[] = [];
  for (const p of parities) {
    let v = gen(lo, hi, p);
    for (let g = 0; g < 30 && out.includes(v); g++) v = gen(lo, hi, p);
    out.push(v);
  }
  return out;
}

const HOUSES: { key: Key; label: string; chips: string; roof: string; wall: string; side: number }[] = [
  { key: "even", label: "زوجي", chips: "٢ ٤ ٦ ٨ ٠", roof: "#3A8FC4", wall: "#DCEEFB", side: 1 },
  { key: "odd", label: "فردي", chips: "١ ٣ ٥ ٧ ٩", roof: "#D6486E", wall: "#FDE7EE", side: -1 },
];

export default function BalloonPop({ accent, accentDark, level, onDone }: FunGameProps) {
  const nums = useMemo(() => makeRounds(level), [level]);
  const e = useEngine({ total: nums.length, onDone, advanceMs: 1400 });
  const n = nums[e.i];
  const ans: Key = n % 2 === 0 ? "even" : "odd";
  const text = d(n);
  const flying = e.phase === "right" ? HOUSES.find((h) => h.key === e.picked) : undefined;

  return (
    <div className="w-full flex flex-col gap-4">
      <Progress i={e.i} total={nums.length} accent={accent} label="الطرد" />
      <Talk kind="bunny" mood={e.mood} accentDark={accentDark}>
        <p className="text-sm sm:text-base">ساعد الأرنب على توصيل الطرد إلى بيته</p>
        <p className="text-xs text-ink-500 mt-0.5">انظر إلى رقم الآحاد 👀</p>
      </Talk>

      <Stage className="px-3 pt-6 pb-4" style={{ background: "linear-gradient(180deg,#FDE7EE 0%,#E9F4FB 100%)" }}>
        <span className="absolute top-2 start-4 text-2xl" aria-hidden="true">☁️</span>
        <span className="absolute top-3 end-6 text-2xl" aria-hidden="true">🌤️</span>

        {/* الطرد */}
        <div className="flex justify-center h-28 sm:h-32 items-center">
          <div
            style={{
              transform: flying ? `translate(calc(${flying.side} * min(30vw, 150px)), 120px) scale(.35) rotate(${flying.side * 25}deg)` : undefined,
              opacity: flying ? 0 : 1,
              transition: flying ? "transform .8s cubic-bezier(.5,0,.8,.6), opacity .8s ease-in" : undefined,
            }}
          >
            <div key={e.i} className="fun-bounce-in">
              <div className="relative px-7 py-4 rounded-2xl bg-gradient-to-b from-amber-200 to-amber-400 border-b-[6px] border-amber-600 shadow-soft">
                <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-3 bg-rose-400/60" aria-hidden="true" />
                <span className="relative text-4xl sm:text-5xl font-extrabold text-amber-950 tracking-wide">
                  {text.slice(0, -1)}
                  <span className="px-1.5 rounded-lg bg-white" style={{ color: accent }}>
                    {text.slice(-1)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* البيتان */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          {HOUSES.map((h) => {
            const st = e.stateOf(h.key);
            return (
              <div key={h.key} className="relative">
                <button
                  type="button"
                  data-correct={h.key === ans ? "true" : undefined}
                  disabled={st !== "idle"}
                  onClick={() => e.answer(h.key, h.key === ans)}
                  className={`w-full flex flex-col items-center transition-transform active:scale-95 ${st === "wrong" ? "fun-shake" : ""} ${
                    st === "dim" ? "opacity-40" : ""
                  } ${st === "right" ? "scale-105" : ""}`}
                >
                  <span className="block w-[88%] h-9 sm:h-11" style={{ backgroundColor: h.roof, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
                  <span
                    className="w-[76%] rounded-b-2xl border-b-[6px] px-2 pt-2 pb-3 flex flex-col items-center gap-1"
                    style={{ backgroundColor: h.wall, borderColor: h.roof, outline: st === "wrong" ? "3px solid #D6486E" : undefined }}
                  >
                    <span className="text-xl sm:text-2xl font-extrabold" style={{ color: h.roof }}>{h.label}</span>
                    <span
                      className="w-8 h-10 rounded-t-full transition-colors"
                      style={{ backgroundColor: st === "right" ? "#FFE27A" : h.roof, boxShadow: st === "right" ? "0 0 18px 6px #FFE27A" : undefined }}
                    />
                    <span className="text-[10px] sm:text-xs font-bold text-ink-500 tracking-widest">{h.chips}</span>
                  </span>
                </button>
                {e.picked === h.key && <Burst burstKey={e.burst} />}
              </div>
            );
          })}
        </div>
      </Stage>
    </div>
  );
}
