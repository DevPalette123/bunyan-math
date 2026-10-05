import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { getAudioContext, playTone } from "../../lib/sound";
import { playGameCorrectSound, playGameNextSound, playGameWrongSound } from "../../lib/playSounds";

// ---------------------------------------------------------------------------
// أدوات مشتركة لألعاب «تنمية المهارات النمائية»
// كل لعبة تستقبل: onDone(عدد الأخطاء) عند انتهائها، و onFeedback(صحيح؟) ليتفاعل «نُمو».
// لا رسوب: الخطأ يُحسب فقط في عدد النجوم (١–٣) ولا يمنع التقدّم.
// ---------------------------------------------------------------------------

export const COLORS = {
  red: "#D6486E",
  blue: "#3A8FC4",
  green: "#3E9C6B",
  sun: "#F0B94A",
  berry: "#8C55AD",
  clay: "#D06A4A",
};

export type ShapeKind = "circle" | "square" | "triangle" | "star" | "diamond" | "hexagon";

export function Shape({ kind, color, className = "w-10 h-10" }: { kind: ShapeKind; color: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      {kind === "circle" && <circle cx="60" cy="60" r="46" fill={color} />}
      {kind === "square" && <rect x="16" y="16" width="88" height="88" rx="14" fill={color} />}
      {kind === "triangle" && (
        <polygon points="60,14 108,100 12,100" fill={color} stroke={color} strokeWidth="8" strokeLinejoin="round" />
      )}
      {kind === "diamond" && (
        <polygon points="60,10 108,60 60,110 12,60" fill={color} stroke={color} strokeWidth="6" strokeLinejoin="round" />
      )}
      {kind === "hexagon" && (
        <polygon points="60,10 103,35 103,85 60,110 17,85 17,35" fill={color} stroke={color} strokeWidth="6" strokeLinejoin="round" />
      )}
      {kind === "star" && (
        <path
          d="M60 12 L73 45 L108 48 L81 70 L90 104 L60 85 L30 104 L39 70 L12 48 L47 45 Z"
          fill={color}
          stroke={color}
          strokeWidth="6"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface LevelProps {
  onDone: (mistakes: number) => void;
  onFeedback: (good: boolean) => void;
}

/** مؤقّتات تُلغى تلقائيًا عند مغادرة اللعبة. */
function useTimers() {
  const ref = useRef<number[]>([]);
  useEffect(() => () => ref.current.forEach((t) => window.clearTimeout(t)), []);
  return {
    later(fn: () => void, ms: number) {
      ref.current.push(window.setTimeout(fn, ms));
    },
    clear() {
      ref.current.forEach((t) => window.clearTimeout(t));
      ref.current = [];
    },
  };
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-center text-sm sm:text-base font-bold text-ink-700 text-balance leading-relaxed">{children}</p>;
}

function Dots({ total, done, color }: { total: number; done: number; color: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: i === done ? 22 : 8, backgroundColor: i < done ? color : i === done ? color : "#EDE3D0", opacity: i === done ? 0.6 : 1 }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ١) تسلسل الأضواء — الانتباه والذاكرة
// ---------------------------------------------------------------------------

const PADS = [
  { color: COLORS.red, hz: 523.25 },
  { color: COLORS.blue, hz: 659.25 },
  { color: COLORS.green, hz: 783.99 },
  { color: COLORS.sun, hz: 1046.5 },
];
const ROUND_LENGTHS = [2, 3, 4];

function padSound(i: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    playTone(ctx, PADS[i].hz, 0, 0.32, "triangle", 0.18);
  } catch {
    // الصوت إضافة لطيفة فقط.
  }
}

export function SimonLevel({ onDone, onFeedback }: LevelProps) {
  const [round, setRound] = useState(0);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<"watch" | "repeat" | "wait">("watch");
  const [lit, setLit] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const seqRef = useRef<number[]>([]);
  const timers = useTimers();

  useEffect(() => {
    seqRef.current = Array.from({ length: ROUND_LENGTHS[round] }, () => Math.floor(Math.random() * PADS.length));
    setRun((r) => r + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => {
    if (run === 0) return;
    timers.clear();
    setPhase("watch");
    setPos(0);
    setLit(null);
    seqRef.current.forEach((p, i) => {
      timers.later(() => {
        setLit(p);
        padSound(p);
      }, 900 + i * 780);
      timers.later(() => setLit(null), 900 + i * 780 + 520);
    });
    timers.later(() => setPhase("repeat"), 900 + seqRef.current.length * 780);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  function tap(p: number) {
    if (phase !== "repeat") return;
    setLit(p);
    padSound(p);
    timers.later(() => setLit(null), 260);
    const seq = seqRef.current;
    if (p === seq[pos]) {
      const np = pos + 1;
      setPos(np);
      if (np === seq.length) {
        setPhase("wait");
        playGameCorrectSound(1);
        onFeedback(true);
        timers.later(() => (round === ROUND_LENGTHS.length - 1 ? onDone(mistakes) : setRound(round + 1)), 950);
      }
    } else {
      setPhase("wait");
      setMistakes((m) => m + 1);
      playGameWrongSound();
      onFeedback(false);
      timers.later(() => setRun((r) => r + 1), 1100);
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <Hint>
        {phase === "watch" ? "شاهد الأضواء جيدًا وتذكّر ترتيبها 👀" : phase === "repeat" ? "دورك! المس الأضواء بنفس الترتيب ✋" : "\u00A0"}
      </Hint>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-xs">
        {PADS.map((pad, i) => {
          const on = lit === i;
          return (
            <button
              key={i}
              onClick={() => tap(i)}
              disabled={phase !== "repeat"}
              aria-label={`ضوء ${toArabicDigits(i + 1)}`}
              className="aspect-square rounded-[28px] transition-all duration-150 active:scale-95 disabled:cursor-default"
              style={{
                backgroundColor: pad.color,
                opacity: on ? 1 : 0.5,
                transform: on ? "scale(1.06)" : undefined,
                boxShadow: on ? `0 0 0 6px #fff, 0 0 34px 8px ${pad.color}` : "0 8px 18px -8px rgba(31,42,36,.25)",
              }}
            />
          );
        })}
      </div>
      <Dots total={ROUND_LENGTHS.length} done={round} color="#8C55AD" />
      <p className="text-xs font-bold text-ink-500">
        الجولة {toArabicDigits(round + 1)} من {toArabicDigits(ROUND_LENGTHS.length)} — عدد الأضواء: {toArabicDigits(ROUND_LENGTHS[round])}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ٢) الشكل المختلف — التفكير والانتباه للتفاصيل
// ---------------------------------------------------------------------------

interface OddRound {
  base: { kind: ShapeKind; color: string };
  odd: { kind: ShapeKind; color: string };
}
const ODD_ROUNDS: OddRound[] = [
  { base: { kind: "circle", color: COLORS.red }, odd: { kind: "circle", color: COLORS.blue } },
  { base: { kind: "square", color: COLORS.green }, odd: { kind: "triangle", color: COLORS.green } },
  { base: { kind: "star", color: COLORS.sun }, odd: { kind: "diamond", color: COLORS.sun } },
  { base: { kind: "hexagon", color: COLORS.blue }, odd: { kind: "hexagon", color: COLORS.berry } },
];

export function OddOneLevel({ onDone, onFeedback }: LevelProps) {
  const [ri, setRi] = useState(0);
  const oddAt = useMemo(() => ODD_ROUNDS.map(() => Math.floor(Math.random() * 9)), []);
  const [wrong, setWrong] = useState<number[]>([]);
  const [found, setFound] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const timers = useTimers();
  const round = ODD_ROUNDS[ri];

  function pick(i: number) {
    if (found || wrong.includes(i)) return;
    if (i === oddAt[ri]) {
      setFound(true);
      playGameCorrectSound(ri + 1);
      onFeedback(true);
      timers.later(() => {
        if (ri === ODD_ROUNDS.length - 1) {
          onDone(mistakes);
        } else {
          playGameNextSound();
          setRi(ri + 1);
          setWrong([]);
          setFound(false);
        }
      }, 950);
    } else {
      playGameWrongSound();
      onFeedback(false);
      setMistakes((m) => m + 1);
      setWrong((w) => [...w, i]);
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-4" key={ri}>
      <Hint>ابحث عن الشكل المختلف عن البقية 🔍</Hint>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-xs rounded-[28px] bg-white shadow-soft p-3 sm:p-4 animate-pop-in">
        {Array.from({ length: 9 }).map((_, i) => {
          const isOdd = i === oddAt[ri];
          const shape = isOdd ? round.odd : round.base;
          const isWrong = wrong.includes(i);
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              aria-label="شكل"
              className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${
                found && isOdd ? "bg-palm-50 ring-4 ring-palm-400 scale-105" : isWrong ? "bg-rose-50 opacity-50" : "bg-sand-50 hover:bg-sand-100 active:scale-95"
              }`}
              style={isWrong ? { animation: "sg-shake 0.35s" } : undefined}
            >
              <Shape kind={shape.kind} color={shape.color} className="w-3/4 h-3/4" />
            </button>
          );
        })}
      </div>
      <Dots total={ODD_ROUNDS.length} done={ri} color="#E3A422" />
      {found && <p className="text-sm font-extrabold text-palm-600 animate-rise-in">وجدته! عين ذكية 🌟</p>}
      {wrong.length > 0 && !found && <p className="text-sm font-bold text-rose-500 animate-rise-in">قارن الأشكال جيدًا وجرّب مرة أخرى.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ٣) وجوه المشاعر — التعرّف على الانفعالات
// ---------------------------------------------------------------------------

type Emotion = "happy" | "sad" | "angry" | "scared" | "surprised";

const EMOTIONS: { id: Emotion; label: string; tip: string }[] = [
  { id: "happy", label: "سعيد", tip: "عندما أفرح أشارك فرحتي مع من أحب." },
  { id: "sad", label: "حزين", tip: "عندما أحزن أتحدث مع شخص أثق به، وأشعر بتحسّن." },
  { id: "angry", label: "غاضب", tip: "عندما أغضب آخذ نفسًا عميقًا وأعدّ إلى عشرة." },
  { id: "scared", label: "خائف", tip: "عندما أخاف أتنفّس ببطء وأطلب المساعدة." },
  { id: "surprised", label: "متفاجئ", tip: "المفاجأة شعور سريع، ثم أهدأ وأفهم ما حدث." },
];

function Face({ emotion, className = "w-28 h-28" }: { emotion: Emotion; className?: string }) {
  const skin = emotion === "angry" ? "#F7A48B" : "#FFD86B";
  const edge = emotion === "angry" ? "#E5785A" : "#F0B94A";
  const ink = "#3A2A1C";
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill={skin} stroke={edge} strokeWidth="3" />
      {emotion === "happy" && (
        <>
          <path d="M28 44 Q36 34 44 44" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M56 44 Q64 34 72 44" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M28 60 Q50 88 72 60 Z" fill={ink} />
          <ellipse cx="50" cy="72" rx="8" ry="4" fill="#FF8FAE" />
        </>
      )}
      {emotion === "sad" && (
        <>
          <ellipse cx="36" cy="46" rx="4.5" ry="6" fill={ink} />
          <ellipse cx="64" cy="46" rx="4.5" ry="6" fill={ink} />
          <path d="M26 34 L44 40" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M74 34 L56 40" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M34 74 Q50 60 66 74" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M30 56 Q26 66 30 68 Q35 66 30 56 Z" fill="#6EC1F0" />
        </>
      )}
      {emotion === "angry" && (
        <>
          <ellipse cx="36" cy="48" rx="4.5" ry="5.5" fill={ink} />
          <ellipse cx="64" cy="48" rx="4.5" ry="5.5" fill={ink} />
          <path d="M24 34 L44 44" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M76 34 L56 44" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M36 72 Q50 62 64 72" stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </>
      )}
      {emotion === "scared" && (
        <>
          <circle cx="36" cy="46" r="9" fill="#fff" stroke={ink} strokeWidth="2" />
          <circle cx="64" cy="46" r="9" fill="#fff" stroke={ink} strokeWidth="2" />
          <circle cx="36" cy="47" r="3.2" fill={ink} />
          <circle cx="64" cy="47" r="3.2" fill={ink} />
          <path d="M26 30 Q36 24 44 32" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M74 30 Q64 24 56 32" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
          <ellipse cx="50" cy="72" rx="7" ry="9" fill={ink} />
          <path d="M82 30 Q86 38 82 42 Q78 38 82 30 Z" fill="#6EC1F0" />
        </>
      )}
      {emotion === "surprised" && (
        <>
          <circle cx="36" cy="44" r="6" fill={ink} />
          <circle cx="64" cy="44" r="6" fill={ink} />
          <circle cx="38" cy="42" r="2" fill="#fff" />
          <circle cx="66" cy="42" r="2" fill="#fff" />
          <path d="M26 28 Q36 20 46 28" stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M54 28 Q64 20 74 28" stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <ellipse cx="50" cy="70" rx="8" ry="10" fill={ink} />
        </>
      )}
    </svg>
  );
}

export function FacesLevel({ onDone, onFeedback }: LevelProps) {
  const rounds = useMemo(
    () =>
      shuffle(EMOTIONS)
        .slice(0, 4)
        .map((e) => ({ answer: e, options: shuffle([e, ...shuffle(EMOTIONS.filter((x) => x.id !== e.id)).slice(0, 2)]) })),
    []
  );
  const [ri, setRi] = useState(0);
  const [wrong, setWrong] = useState<Emotion[]>([]);
  const [right, setRight] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const streak = useRef(0);
  const r = rounds[ri];

  function pick(e: Emotion) {
    if (right || wrong.includes(e)) return;
    if (e === r.answer.id) {
      streak.current += 1;
      playGameCorrectSound(streak.current);
      onFeedback(true);
      setRight(true);
    } else {
      streak.current = 0;
      playGameWrongSound();
      onFeedback(false);
      setMistakes((m) => m + 1);
      setWrong((w) => [...w, e]);
    }
  }

  function next() {
    playGameNextSound();
    if (ri === rounds.length - 1) {
      onDone(mistakes);
      return;
    }
    setRi(ri + 1);
    setWrong([]);
    setRight(false);
  }

  return (
    <div className="w-full flex flex-col items-center gap-4" key={ri}>
      <Hint>ما شعور صاحب هذا الوجه؟</Hint>
      <div className="rounded-[32px] bg-white shadow-soft p-5 animate-pop-in">
        <div className={right ? "animate-mascot-hop" : ""}>
          <Face emotion={r.answer.id} className="w-32 h-32 sm:w-36 sm:h-36" />
        </div>
      </div>
      <div className="w-full grid grid-cols-3 gap-2.5">
        {r.options.map((o) => {
          const isWrong = wrong.includes(o.id);
          const isRight = right && o.id === r.answer.id;
          return (
            <button
              key={o.id}
              onClick={() => pick(o.id)}
              disabled={right || isWrong}
              className={`rounded-2xl border-2 py-3 text-sm sm:text-base font-extrabold transition-all ${
                isRight
                  ? "bg-palm-50 border-palm-500 text-palm-600 scale-105"
                  : isWrong
                    ? "bg-rose-50 border-rose-400 text-rose-500 opacity-70"
                    : "bg-white border-sand-200 text-ink-900 hover:border-rose-400 active:scale-95"
              }`}
              style={isWrong ? { animation: "sg-shake 0.35s" } : undefined}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {right && (
        <div className="w-full flex flex-col items-center gap-3 animate-rise-in">
          <p className="text-sm sm:text-base font-extrabold text-palm-600 text-center text-balance">{r.answer.tip}</p>
          <button onClick={next} className="text-white font-extrabold text-sm rounded-2xl px-6 py-2.5 hover:opacity-90" style={{ backgroundColor: COLORS.red }}>
            {ri === rounds.length - 1 ? "أنهيتُ النشاط" : "التالي"}
          </button>
        </div>
      )}
      <Dots total={rounds.length} done={ri} color={COLORS.red} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ٤) فقاعة الهدوء — التحكم في الانفعال بالتنفس
// ---------------------------------------------------------------------------

const BREATHS = 3;
const BREATH_MS = 4000;

export function BreathLevel({ onDone, onFeedback }: LevelProps) {
  const [step, setStep] = useState<"ready" | "in" | "out" | "done">("ready");
  const [count, setCount] = useState(0);
  const timers = useTimers();

  function cycle(n: number) {
    setCount(n);
    setStep("in");
    timers.later(() => {
      setStep("out");
      timers.later(() => {
        onFeedback(true);
        if (n + 1 >= BREATHS) {
          playGameCorrectSound(1);
          setCount(n + 1);
          setStep("done");
        } else {
          cycle(n + 1);
        }
      }, BREATH_MS);
    }, BREATH_MS);
  }

  const big = step === "in";
  const label = step === "ready" ? "جاهزة؟" : step === "in" ? "شهيق…" : step === "out" ? "زفير…" : "أحسنت!";
  const sub =
    step === "ready"
      ? "سنتنفّس معًا ثلاث مرات ببطء لنهدأ."
      : step === "in"
        ? "املأ صدرك بالهواء من أنفك ببطء"
        : step === "out"
          ? "أخرج الهواء من فمك بهدوء"
          : "شعرت بالهدوء؟ هذه طريقتك السحرية عند الغضب أو الخوف.";

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <Hint>{sub}</Hint>

      <div className="relative w-56 h-56 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 30%, #ffffff 0%, #BFE6F7 45%, #7CC4E8 100%)",
            transform: `scale(${big || step === "done" ? 1 : 0.55})`,
            transition: `transform ${BREATH_MS}ms ease-in-out`,
            boxShadow: "0 0 40px 6px rgba(124,196,232,.45), inset 0 -10px 24px rgba(58,143,196,.25)",
          }}
        />
        <div className="absolute top-[16%] start-[22%] w-8 h-4 rounded-full bg-white/70 rotate-[-30deg] pointer-events-none" />
        <span className="relative text-2xl font-extrabold text-sky-500 drop-shadow-sm">{label}</span>
      </div>

      <div className="flex items-center gap-2" aria-label="عدد الأنفاس">
        {Array.from({ length: BREATHS }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full transition-colors ${i < count ? "bg-sky-400" : "bg-sand-200"}`}
          />
        ))}
      </div>

      {step === "ready" && (
        <button
          onClick={() => cycle(0)}
          className="text-white font-extrabold text-base rounded-2xl px-8 py-3 hover:opacity-90"
          style={{ backgroundColor: COLORS.red }}
        >
          ابدأ التنفّس
        </button>
      )}
      {step === "done" && (
        <button
          onClick={() => onDone(0)}
          className="text-white font-extrabold text-base rounded-2xl px-8 py-3 hover:opacity-90 animate-rise-in"
          style={{ backgroundColor: COLORS.red }}
        >
          أنهيتُ النشاط
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ٥) صندوق اللطف — المهارات الاجتماعية
// ---------------------------------------------------------------------------

const KIND_WORDS = [
  "شكرًا لك يا صديقي",
  "تفضّلي، هذا دورُك",
  "أنا آسفة، لم أقصد ذلك",
  "هل تحبّ اللعب معنا؟",
  "ما شاء الله، رسمك جميل",
  "سأساعدك في حمل الكتب",
];
const UNKIND_WORDS = [
  "أنت لا تعرف شيئًا!",
  "ابتعد عني، لا أريدك",
  "رسمك قبيح جدًا",
  "هذا لي! أعطني إياه الآن",
  "لن ألعب معك أبدًا",
  "أنت بطيء، أسرع!",
];

export function KindnessLevel({ onDone, onFeedback }: LevelProps) {
  const cards = useMemo(
    () =>
      shuffle([
        ...shuffle(KIND_WORDS).slice(0, 3).map((t) => ({ t, kind: true })),
        ...shuffle(UNKIND_WORDS).slice(0, 3).map((t) => ({ t, kind: false })),
      ]),
    []
  );
  const [i, setI] = useState(0);
  const [result, setResult] = useState<null | "right" | "wrong">(null);
  const [hearts, setHearts] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const streak = useRef(0);
  const timers = useTimers();
  const card = cards[i];

  function answer(kind: boolean) {
    if (result) return;
    const ok = kind === card.kind;
    let m = mistakes;
    if (ok) {
      streak.current += 1;
      playGameCorrectSound(streak.current);
      setHearts((h) => h + 1);
    } else {
      streak.current = 0;
      playGameWrongSound();
      m = mistakes + 1;
      setMistakes(m);
    }
    onFeedback(ok);
    setResult(ok ? "right" : "wrong");
    timers.later(
      () => {
        if (i === cards.length - 1) {
          onDone(m);
        } else {
          playGameNextSound();
          setI(i + 1);
          setResult(null);
        }
      },
      ok ? 1000 : 1700
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <Hint>اقرأ العبارة، ثم قرّر: هل هي كلمة لطيفة أم غير لطيفة؟</Hint>

      <div
        key={i}
        className={`w-full rounded-[28px] shadow-soft p-6 min-h-[120px] flex flex-col items-center justify-center gap-2 text-center animate-pop-in transition-colors ${
          result === "right" ? "bg-palm-50" : result === "wrong" ? "bg-rose-50" : "bg-white"
        }`}
      >
        <span className="text-3xl" aria-hidden="true">💬</span>
        <p className="text-lg sm:text-xl font-extrabold text-ink-900 text-balance leading-relaxed">«{card.t}»</p>
        {result && (
          <p className={`text-sm font-extrabold ${result === "right" ? "text-palm-600" : "text-rose-500"}`}>
            {result === "right" ? "أحسنت!" : card.kind ? "هذه كلمة لطيفة تُفرح القلب." : "هذه كلمة غير لطيفة تؤذي المشاعر."}
          </p>
        )}
      </div>

      <div className="w-full grid grid-cols-2 gap-3">
        <button
          onClick={() => answer(true)}
          disabled={!!result}
          className="rounded-2xl bg-palm-500 hover:bg-palm-600 disabled:opacity-60 text-white font-extrabold text-sm sm:text-base py-3.5 transition-all active:scale-95"
        >
          💚 كلمة لطيفة
        </button>
        <button
          onClick={() => answer(false)}
          disabled={!!result}
          className="rounded-2xl bg-rose-500 hover:opacity-90 disabled:opacity-60 text-white font-extrabold text-sm sm:text-base py-3.5 transition-all active:scale-95"
        >
          🚫 غير لطيفة
        </button>
      </div>

      <div className="flex items-center gap-1.5" aria-label={`قلوب اللطف: ${hearts}`}>
        {cards.map((_, k) => (
          <span key={k} className={`text-xl transition-all ${k < hearts ? "scale-110" : "grayscale opacity-30"}`} aria-hidden="true">
            💚
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ٦) جهّز حقيبتك — الاعتماد على النفس
// ---------------------------------------------------------------------------

const BAG_ITEMS: { id: string; icon: string; label: string; need: boolean }[] = [
  { id: "book", icon: "📘", label: "كتاب الرياضيات", need: true },
  { id: "notebook", icon: "📓", label: "دفتر الواجب", need: true },
  { id: "pencil", icon: "✏️", label: "قلم رصاص", need: true },
  { id: "water", icon: "💧", label: "زجاجة ماء", need: true },
  { id: "apple", icon: "🍎", label: "وجبة صحية", need: true },
  { id: "teddy", icon: "🧸", label: "دمية كبيرة", need: false },
  { id: "game", icon: "🎮", label: "لعبة فيديو", need: false },
  { id: "candy", icon: "🍭", label: "حلوى كثيرة", need: false },
];

export function BagLevel({ onDone, onFeedback }: LevelProps) {
  const items = useMemo(() => shuffle(BAG_ITEMS), []);
  const [picked, setPicked] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const mistakes = useMemo(
    () => items.filter((it) => (picked.includes(it.id) ? !it.need : it.need)).length,
    [items, picked]
  );

  function toggle(id: string) {
    if (checked) return;
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function check() {
    setChecked(true);
    if (mistakes === 0) {
      playGameCorrectSound(3);
      onFeedback(true);
    } else {
      playGameWrongSound();
      onFeedback(false);
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <Hint>غدًا يومٌ دراسي! اختر ما تحتاجينه فقط ليدخل حقيبتك 🎒</Hint>

      <div className="flex items-center gap-2 rounded-full bg-white shadow-soft px-4 py-2">
        <span className={`text-2xl ${picked.length ? "animate-mascot-hop" : ""}`} key={picked.length} aria-hidden="true">🎒</span>
        <span className="text-sm font-extrabold text-ink-900">في الحقيبة: {toArabicDigits(picked.length)}</span>
      </div>

      <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {items.map((it) => {
          const on = picked.includes(it.id);
          const correct = checked ? (on ? it.need : !it.need) : null;
          return (
            <button
              key={it.id}
              onClick={() => toggle(it.id)}
              aria-pressed={on}
              className={`rounded-2xl border-2 py-3 px-2 flex flex-col items-center gap-1 transition-all ${
                checked
                  ? correct
                    ? "bg-palm-50 border-palm-400"
                    : "bg-rose-50 border-rose-400"
                  : on
                    ? "bg-sun-50 border-sun-400 scale-105 shadow-soft"
                    : "bg-white border-sand-200 hover:border-sun-400 active:scale-95"
              }`}
            >
              <span className="text-3xl" aria-hidden="true">{it.icon}</span>
              <span className="text-[12px] font-extrabold text-ink-900 text-center leading-tight">{it.label}</span>
              {checked && (
                <span className={`text-[10px] font-extrabold ${correct ? "text-palm-600" : "text-rose-500"}`}>
                  {correct ? "✓" : it.need ? "كانت مطلوبة" : "ليست للمدرسة"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!checked ? (
        <button
          onClick={check}
          disabled={picked.length === 0}
          className="text-white font-extrabold text-base rounded-2xl px-8 py-3 disabled:opacity-40 hover:opacity-90"
          style={{ backgroundColor: COLORS.berry }}
        >
          الحقيبة جاهزة ✓
        </button>
      ) : (
        <div className="w-full flex flex-col items-center gap-3 animate-rise-in">
          <p className={`text-sm sm:text-base font-extrabold text-center text-balance ${mistakes === 0 ? "text-palm-600" : "text-ink-700"}`}>
            {mistakes === 0
              ? "حقيبة مثالية! المسؤولة تجهّز أغراضها بنفسها."
              : "لا بأس! الكتب والدفتر والقلم والماء والوجبة هي ما نحتاجه للمدرسة، أما الألعاب فتبقى في البيت."}
          </p>
          <button
            onClick={() => onDone(mistakes)}
            className="text-white font-extrabold text-sm rounded-2xl px-6 py-2.5 hover:opacity-90"
            style={{ backgroundColor: COLORS.berry }}
          >
            أنهيتُ النشاط
          </button>
        </div>
      )}
    </div>
  );
}
