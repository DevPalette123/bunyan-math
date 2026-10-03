import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StudentShell from "../components/StudentShell";
import Mascot, { type MascotMood } from "../components/play/Mascot";
import GemTrail from "../components/play/GemTrail";
import GameQuestionView from "../components/play/GameQuestionView";
import GameResult from "../components/play/GameResult";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { isGameId, GAME_THEMES } from "../data/playGameThemes";
import {
  GAME_QUESTION_COUNT,
  completeGameAttempt,
  fetchGameResult,
  getInProgressGameAttempt,
  recordGameAnswer,
  startGameAttempt,
  type ActiveGameAttempt,
  type GameId,
  type GameResultData,
  type GameReviewItem,
} from "../lib/games";
import {
  playGameCorrectSound,
  playGameFinishSound,
  playGameNextSound,
  playGameWelcomeSound,
  playGameWrongSound,
} from "../lib/playSounds";
import { isSoundMuted, primeAudioForInteraction, setSoundMuted } from "../lib/sound";
import { SoundOffIcon, SoundOnIcon } from "../components/quiz/QuizIcons";
import { ChevronIcon } from "../components/icons/Glyphs";
import { toArabicDigits } from "../utils/arabicNumerals";

// «ألعب» — محرّك عام تشترك فيه كل ألعاب المهارة الواحدة (الثماني مهارات كاملة
// الآن: الجمع، الطرح، التقريب، الضعف، الترتيب التصاعدي والتنازلي، المقارنة،
// والزوجي والفردي — نفس مهارات «اختبر»/«اكتشف»). ما يخص لعبة بعينها (العنوان،
// الألوان، الشخصية، العبارات) يأتي من data/playGameThemes.ts عبر gameId في
// الرابط؛ هذا الملف لا يعرف شيئًا عن أي مهارة بعينها. إضافة لعبة جديدة لاحقًا
// (بنفس شكل «سؤال واحد فأربع خيارات») لا تحتاج صفحة جديدة، فقط ثيمًا جديدًا
// وصفًا في play_games وبنك أسئلة.
//
// على عكس «اختبر» (تقييم رسمي، تصميم هادئ، لا نجوم إلا لأول محاولة يوميًا)، هذه
// لعبة تدريب حرة: شخصية متحركة، فقاعات ملوّنة، وأصوات أكثر مرحًا — ويمكن إعادة
// لعبها بلا حدود. النقاط والنجوم من كتالوج play_games مستقلة تمامًا عن نظام
// «اختبر» ولوحة النجوم المرحة (انظر lib/games.ts).

type Phase = "loading" | "playing" | "submitting" | "result" | "error" | "unavailable" | "not-found";

function currentStreak(questions: ActiveGameAttempt["questions"]): number {
  let run = 0;
  for (const q of questions) {
    if (q.isCorrect === true) run += 1;
    else if (q.isCorrect === false) run = 0;
    else break;
  }
  return run;
}

function firstUnansweredIndex(questions: ActiveGameAttempt["questions"]): number {
  const i = questions.findIndex((q) => q.selectedAnswer === null);
  return i === -1 ? questions.length - 1 : i;
}

export default function GamePage() {
  const { gameId: gameIdParam } = useParams<{ gameId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const gameId: GameId | null = isGameId(gameIdParam) ? gameIdParam : null;
  const theme = gameId ? GAME_THEMES[gameId] : null;

  const [phase, setPhase] = useState<Phase>(gameId ? "loading" : "not-found");
  const [attempt, setAttempt] = useState<ActiveGameAttempt | null>(null);
  const [index, setIndex] = useState(0);

  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);

  const [finished, setFinished] = useState<{ result: GameResultData; review: GameReviewItem[] } | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const finishingRef = useRef(false);

  const [muted, setMuted] = useState(isSoundMuted());
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  const question = attempt?.questions[index];
  const selected = question?.selectedAnswer ?? null;
  const studentId = profile?.id;

  useEffect(() => {
    setAnswerError(null);
    setFeedback(null);
  }, [index]);

  // ------------------------------------------------------------------
  // الإقلاع: استئناف محاولة مفتوحة لهذه اللعبة (تتحمّل تحديث الصفحة) أو بدء جديدة.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!gameId) return;
    if (!isSupabaseConfigured || !studentId) {
      setPhase("unavailable");
      return;
    }
    let isMounted = true;
    setPhase("loading");
    setFinished(null);
    finishingRef.current = false;

    (async () => {
      const existing = await getInProgressGameAttempt(studentId, gameId);
      if (!isMounted) return;
      if (existing) {
        setAttempt(existing);
        setIndex(firstUnansweredIndex(existing.questions));
        setPhase("playing");
        return;
      }
      try {
        const created = await startGameAttempt(gameId);
        if (!isMounted) return;
        setAttempt(created);
        setIndex(0);
        setPhase("playing");
        playGameWelcomeSound();
      } catch (e) {
        if (isMounted) {
          setFinishError(e instanceof Error ? e.message : "تعذّر بدء اللعبة.");
          setPhase("error");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [gameId, studentId]);

  useEffect(() => {
    if (selected !== null) {
      nextButtonRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

  function scrollTop() {
    window.scrollTo({ top: 0 });
  }

  async function handleSelect(option: string) {
    if (!attempt || !gameId || !question || pendingAnswer !== null || question.selectedAnswer !== null) return;
    primeAudioForInteraction();

    setPendingAnswer(option);
    setAnswerError(null);
    const saved = await recordGameAnswer(attempt.attemptId, question.id, option);
    setPendingAnswer(null);

    if ("error" in saved) {
      setAnswerError("حدث خطأ أثناء حفظ إجابتك. اضغطي على الإجابة مرة أخرى للمحاولة من جديد.");
      return;
    }

    const updated = attempt.questions.map((q, i) =>
      i === index
        ? { ...q, selectedAnswer: option, correctAnswer: saved.correctAnswer, isCorrect: saved.isCorrect }
        : q
    );
    setAttempt({ ...attempt, questions: updated });

    const t = theme!;
    if (saved.isCorrect) {
      const streak = currentStreak(updated);
      const pool = streak >= 3 ? t.streakCheers : t.cheers;
      setFeedback({ correct: true, message: pool[Math.floor(Math.random() * pool.length)] });
      playGameCorrectSound(streak);
    } else {
      setFeedback({ correct: false, message: t.oops[Math.floor(Math.random() * t.oops.length)] });
      playGameWrongSound();
    }
  }

  async function finishAttempt(attemptId: string) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishError(null);
    setPhase("submitting");

    const { error } = await completeGameAttempt(attemptId);
    const data = error ? null : await fetchGameResult(attemptId);
    if (!data) {
      finishingRef.current = false;
      setFinishError("تعذّر حفظ نتيجتك. تأكدي من الاتصال بالإنترنت ثم حاولي مرة أخرى.");
      setPhase("error");
      return;
    }

    setFinished(data);
    setPhase("result");
    playGameFinishSound(data.result.percentage >= 70);
    scrollTop();
  }

  function handleNext() {
    if (!attempt || selected === null) return;
    playGameNextSound();
    if (index < attempt.questions.length - 1) {
      setIndex((i) => i + 1);
    } else {
      void finishAttempt(attempt.attemptId);
    }
  }

  async function handleRetry() {
    if (!gameId) return;
    primeAudioForInteraction();
    setRetrying(true);
    try {
      const created = await startGameAttempt(gameId);
      finishingRef.current = false;
      setFinished(null);
      setAttempt(created);
      setIndex(0);
      setPhase("playing");
      playGameWelcomeSound();
      scrollTop();
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : "تعذّر بدء اللعبة.");
      setPhase("error");
    } finally {
      setRetrying(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
  }

  if (!gameId || !theme) {
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

  const soundButton = (
    <button
      type="button"
      onClick={toggleMute}
      aria-pressed={muted}
      aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
      className="w-10 h-10 rounded-full bg-white/70 hover:bg-white text-ink-700 flex items-center justify-center transition-colors shadow-soft focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sky-400"
    >
      {muted ? <SoundOffIcon className="w-5 h-5" /> : <SoundOnIcon className="w-5 h-5" />}
    </button>
  );

  const backdrop = (children: ReactNode) => (
    <StudentShell activeId="play">
      <main
        className="relative min-h-screen overflow-hidden pb-28 lg:pb-14"
        style={{ background: `linear-gradient(180deg, ${theme.scene.from}, ${theme.scene.via} 45%, ${theme.scene.to})` }}
      >
        <div className="relative max-w-xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 flex flex-col items-center gap-5">
          {children}
        </div>
      </main>
    </StudentShell>
  );

  if (phase === "loading" || phase === "submitting") {
    return backdrop(
      <div className="pt-24 flex flex-col items-center gap-4">
        <Mascot theme={theme} mood="idle" className="w-20 h-20" />
        <p className="text-sm font-bold text-ink-500">
          {phase === "submitting" ? "جارٍ حفظ نتيجتك..." : "جارٍ التحميل..."}
        </p>
      </div>
    );
  }

  if (phase === "unavailable") {
    return backdrop(
      <p className="pt-32 text-sm font-bold text-ink-500 text-center">
        هذه اللعبة غير متاحة حاليًا لأن المشروع غير متصل بمصدر بيانات.
      </p>
    );
  }

  if (phase === "error") {
    return backdrop(
      <div className="pt-24 flex flex-col items-center gap-4 text-center">
        <Mascot theme={theme} mood="sad" className="w-20 h-20" />
        <p className="text-sm font-bold text-ink-700 leading-relaxed max-w-xs">{finishError}</p>
        <button
          type="button"
          onClick={() => (attempt ? void finishAttempt(attempt.attemptId) : void handleRetry())}
          style={{ backgroundColor: theme.scene.accent, borderColor: theme.scene.accentDark }}
          className="rounded-2xl border-b-[6px] active:translate-y-[3px] active:border-b-[3px] text-white font-extrabold text-base px-8 py-3 transition-[transform,background-color]"
        >
          حاولي مرة أخرى
        </button>
      </div>
    );
  }

  if (phase === "result" && finished) {
    return backdrop(
      <GameResult
        theme={theme}
        result={finished.result}
        review={finished.review}
        retrying={retrying}
        onRetry={handleRetry}
        onBackToGames={() => navigate("/play")}
      />
    );
  }

  if (phase === "playing" && attempt && question) {
    const total = attempt.questions.length || GAME_QUESTION_COUNT;
    const results = attempt.questions.map((q) => q.isCorrect ?? undefined);
    const mood: MascotMood = pendingAnswer !== null ? "idle" : feedback ? (feedback.correct ? "happy" : "sad") : "idle";

    return backdrop(
      <>
        <div className="w-full flex items-center justify-between gap-3">
          {soundButton}
          <h1 className="font-extrabold text-lg sm:text-xl" style={{ color: theme.scene.accentDark }}>
            {theme.title}
          </h1>
          <span className="w-10" aria-hidden="true" />
        </div>

        <p className="font-extrabold text-sm text-ink-500">
          السؤال {toArabicDigits(index + 1)} من {toArabicDigits(total)}
        </p>

        <GemTrail
          total={total}
          results={results}
          currentIndex={index}
          color={theme.scene.gem}
          label={`جمعتِ ${toArabicDigits(results.filter((r) => r === true).length)} جواهر من ${toArabicDigits(total)}`}
        />

        <Mascot theme={theme} mood={mood} className="w-24 h-24 sm:w-28 sm:h-28" />

        <GameQuestionView
          question={question}
          theme={theme}
          selectedAnswer={selected}
          pendingAnswer={pendingAnswer}
          onSelect={handleSelect}
        />

        <div className="w-full min-h-[48px] flex items-center justify-center text-center" aria-live="polite">
          {answerError ? (
            <p className="text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2.5 animate-rise-in">
              {answerError}
            </p>
          ) : (
            feedback && (
              <p
                className="text-sm font-extrabold animate-rise-in"
                style={{ color: feedback.correct ? theme.scene.accentDark : "#9C2E4D" }}
              >
                {feedback.message}
              </p>
            )
          )}
        </div>

        <button
          type="button"
          ref={nextButtonRef}
          onClick={handleNext}
          disabled={selected === null}
          style={{ backgroundColor: theme.scene.accent, borderColor: theme.scene.accentDark }}
          className="scroll-mb-24 w-full max-w-xs flex items-center justify-center gap-2 rounded-2xl border-b-[6px] active:translate-y-[3px] active:border-b-[3px] disabled:opacity-35 disabled:pointer-events-none text-white font-extrabold text-base px-8 py-3.5 transition-[transform,background-color,opacity] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sky-400 focus-visible:outline-offset-2"
        >
          {index < total - 1 ? "التالي" : "إنهاء اللعبة"}
          <ChevronIcon className="w-4 h-4 rotate-180" />
        </button>
      </>
    );
  }

  return null;
}
