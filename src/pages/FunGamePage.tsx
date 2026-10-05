import { useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StudentShell from "../components/StudentShell";
import FunStyles from "../components/play/fun/FunStyles";
import BalloonPop from "../components/play/fun/BalloonPop";
import MemoryMatch from "../components/play/fun/MemoryMatch";
import SortTrain from "../components/play/fun/SortTrain";
import FrogJump from "../components/play/fun/FrogJump";
import SubtractBasket from "../components/play/fun/SubtractBasket";
import RoundHill from "../components/play/fun/RoundHill";
import InsertSlot from "../components/play/fun/InsertSlot";
import BalanceScale from "../components/play/fun/BalanceScale";
import type { FunGameProps, FunLevel } from "../components/play/fun/types";
import { FUN_LEVELS, LEVEL_EXAMPLES, findFunGame, hasLevels, type FunGameId } from "../data/funGames";
import { playGameFinishSound, playGameWelcomeSound } from "../lib/playSounds";
import { recordFunGameResult } from "../lib/funGames";
import { primeAudioForInteraction } from "../lib/sound";
import { ChevronIcon } from "../components/icons/Glyphs";

const GAMES: Record<FunGameId, (p: FunGameProps) => ReactNode> = {
  addition: (p) => <FrogJump {...p} />,
  subtraction: (p) => <SubtractBasket {...p} />,
  rounding: (p) => <RoundHill {...p} />,
  doubling: (p) => <MemoryMatch {...p} />,
  "ascending-order": (p) => <SortTrain {...p} />,
  "descending-order": (p) => <InsertSlot {...p} />,
  comparison: (p) => <BalanceScale {...p} />,
  "even-odd": (p) => <BalloonPop {...p} />,
};

const MESSAGES: Record<1 | 2 | 3, string> = {
  3: "رائع! أنت عبقري الرياضيات 🌟",
  2: "أحسنت! قريبة جدًا من ثلاث نجوم",
  1: "أكملت اللعبة! حاول مرة أخرى لتجمع نجومًا أكثر",
};

export default function FunGamePage() {
  const { funId } = useParams<{ funId: string }>();
  const navigate = useNavigate();
  const game = findFunGame(funId);
  const leveled = hasLevels(game?.id);
  // null = لم تختر الطالب المستوى بعد (الألعاب ذات المستويات تبدأ بشاشة اختيار).
  const [level, setLevel] = useState<FunLevel | null>(null);
  const [runId, setRunId] = useState(0);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [points, setPoints] = useState(0);
  const startedAt = useRef(Date.now());
  const last = useRef<{ stars: number; mistakes: number; seconds: number } | null>(null);

  if (!game) {
    return (
      <StudentShell activeId="play">
        <main className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-sm font-bold text-ink-500">هذه اللعبة غير موجودة.</p>
          <button onClick={() => navigate("/play")} className="mt-4 text-sm font-extrabold text-teach-600">
            العودة إلى الألعاب
          </button>
        </main>
      </StudentShell>
    );
  }

  async function persist() {
    if (!last.current || !game) return;
    setSave("saving");
    const res = await recordFunGameResult(game.id, last.current.stars, last.current.mistakes, last.current.seconds);
    if ("error" in res) {
      setSave("error");
    } else {
      setPoints(res.points);
      setSave("saved");
    }
  }

  function handleDone(s: 1 | 2 | 3, mistakes: number) {
    last.current = { stars: s, mistakes, seconds: (Date.now() - startedAt.current) / 1000 };
    setStars(s);
    playGameFinishSound(s >= 2);
    window.scrollTo({ top: 0 });
    void persist();
  }

  function chooseLevel(l: FunLevel) {
    primeAudioForInteraction();
    setLevel(l);
    setStars(null);
    setSave("idle");
    setPoints(0);
    startedAt.current = Date.now();
    setRunId((n) => n + 1);
    playGameWelcomeSound();
    window.scrollTo({ top: 0 });
  }

  function changeLevel() {
    setStars(null);
    setSave("idle");
    setPoints(0);
    setLevel(null);
    window.scrollTo({ top: 0 });
  }

  function restart() {
    primeAudioForInteraction();
    setStars(null);
    setSave("idle");
    setPoints(0);
    startedAt.current = Date.now();
    setRunId((n) => n + 1);
    playGameWelcomeSound();
  }

  return (
    <StudentShell activeId="play">
      <FunStyles />
      <main
        className="min-h-screen pb-28 lg:pb-14"
        style={{ background: `linear-gradient(180deg, ${game.from}, #FBF8F3 60%, ${game.to})` }}
        onPointerDownCapture={primeAudioForInteraction}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 flex flex-col items-center gap-5">
          <div className="w-full flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate("/play")}
              aria-label="العودة إلى الألعاب"
              className="w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-soft"
            >
              <ChevronIcon className="w-4 h-4" />
            </button>
            <h1 className="font-extrabold text-lg sm:text-xl" style={{ color: game.accentDark }}>
              <span aria-hidden="true">{game.emoji} </span>
              {game.title}
            </h1>
            <span className="w-10" aria-hidden="true" />
          </div>

          {leveled && level === null ? (
            <div className="w-full flex flex-col items-center gap-4 pt-2 fun-bounce-in">
              <p className="text-sm sm:text-base font-extrabold text-ink-700 text-center">{game.tagline}</p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-ink-900">اختر المستوى</h2>
              <div className="w-full flex flex-col gap-3">
                {FUN_LEVELS.map((lv) => (
                  <button
                    key={lv.id}
                    type="button"
                    onClick={() => chooseLevel(lv.id)}
                    style={{ borderColor: game.accent }}
                    className="w-full flex items-center gap-4 rounded-3xl bg-white border-2 border-b-[6px] active:translate-y-[3px] active:border-b-[3px] px-5 py-4 text-start shadow-soft transition-transform"
                  >
                    <span className="text-4xl shrink-0" aria-hidden="true">
                      {lv.emoji}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-lg font-extrabold" style={{ color: game.accentDark }}>
                        {lv.label}
                      </span>
                      <span className="text-xs font-bold text-ink-500">{lv.hint}</span>
                    </span>
                    {LEVEL_EXAMPLES[game.id] && (
                      <span
                        className="shrink-0 rounded-2xl px-3 py-1.5 text-sm font-extrabold"
                        style={{ backgroundColor: `${game.accent}1A`, color: game.accentDark }}
                      >
                        {LEVEL_EXAMPLES[game.id]![lv.id - 1]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : stars === null ? (
            <div key={runId} className="w-full flex flex-col gap-4">
              {leveled && level !== null && (
                <p className="self-center rounded-full bg-white/80 px-4 py-1 text-xs font-extrabold" style={{ color: game.accentDark }}>
                  المستوى: {FUN_LEVELS[level - 1].label}
                </p>
              )}
              {GAMES[game.id]({ accent: game.accent, accentDark: game.accentDark, level: level ?? 2, onDone: handleDone })}
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-5 pt-8 fun-bounce-in text-center">
              <div className="flex gap-2 text-5xl" role="img" aria-label={`${stars} من ٣ نجوم`}>
                {[1, 2, 3].map((n) => (
                  <span key={n} className={n <= stars ? "" : "opacity-20 grayscale"}>
                    ⭐
                  </span>
                ))}
              </div>
              <p className="text-lg font-extrabold text-ink-900 leading-relaxed">{MESSAGES[stars]}</p>
              <p className="text-xs font-extrabold min-h-[1.25rem]" aria-live="polite">
                {save === "saving" && <span className="text-ink-500">جارٍ حفظ نتيجتك...</span>}
                {save === "saved" && (
                  <span className="text-palm-600">
                    {points > 0 ? `تمّ الحفظ ✓ وأُضيفت ${points} نجوم لرصيدك` : "تمّ حفظ النتيجة ✓ (النجوم تُضاف لأول لعبة في اليوم)"}
                  </span>
                )}
                {save === "error" && (
                  <span className="text-rose-500">
                    تعذّر حفظ النتيجة.{" "}
                    <button type="button" onClick={() => void persist()} className="underline">
                      إعادة المحاولة
                    </button>
                  </span>
                )}
              </p>
              <div className="w-full max-w-xs flex flex-col gap-3">
                {leveled && level !== null && (
                  <p className="text-xs font-extrabold text-ink-500">المستوى: {FUN_LEVELS[level - 1].label}</p>
                )}
                <button
                  type="button"
                  onClick={restart}
                  style={{ backgroundColor: game.accent, borderColor: game.accentDark }}
                  className="rounded-2xl border-b-[6px] active:translate-y-[3px] active:border-b-[3px] text-white font-extrabold text-base px-8 py-3.5 transition-transform"
                >
                  العب مرة أخرى
                </button>
                {leveled && (
                  <button
                    type="button"
                    onClick={changeLevel}
                    className="rounded-2xl bg-white border-2 text-sm font-extrabold px-8 py-3"
                    style={{ borderColor: game.accent, color: game.accentDark }}
                  >
                    تغيير المستوى
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/play")}
                  className="rounded-2xl bg-white border-2 border-sand-200 text-ink-700 font-extrabold text-sm px-8 py-3"
                >
                  العودة إلى الألعاب
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </StudentShell>
  );
}
