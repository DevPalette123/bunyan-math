import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentShell from "../components/StudentShell";
import DiscoverIntro from "../components/discover/DiscoverIntro";
import QuestionCard from "../components/discover/QuestionCard";
import ResultView from "../components/discover/ResultView";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { toArabicDigits } from "../utils/arabicNumerals";
import {
  SKILLS,
  completePlacementAttempt,
  fetchAttemptResult,
  getInProgressAttempt,
  recordPlacementAnswer,
  startPlacementAttempt,
  type ActiveAttempt,
  type AttemptResult,
  type ReviewQuestion,
  type SkillBreakdownItem,
  computeSkillBreakdown,
} from "../lib/discover";
import { ChevronIcon, TimerIcon, XCircleIcon, CheckCircleIcon } from "../components/icons/Glyphs";
import { playCorrectAnswerSound, playWrongAnswerSound, primeAudioForInteraction } from "../lib/sound";

type Phase = "loading" | "intro" | "quiz" | "submitting" | "result" | "unavailable";

export default function DiscoverPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const finishingRef = useRef(false);

  const [result, setResult] = useState<AttemptResult | null>(null);
  const [skillBreakdown, setSkillBreakdown] = useState<SkillBreakdownItem[]>([]);
  const [review, setReview] = useState<ReviewQuestion[]>([]);

  // Tracks the in-flight save for the *current* question only — never
  // treated as answered until record_placement_answer actually succeeds.
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  useEffect(() => {
    setAnswerError(null);
  }, [currentIndex]);

  // ------------------------------------------------------------------
  // Bootstrap: resume an in-progress attempt (survives Refresh) or show
  // the intro screen. Never fabricates a state.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured || !profile) {
      setPhase("unavailable");
      return;
    }
    let isMounted = true;
    getInProgressAttempt(profile.id).then((active) => {
      if (!isMounted) return;
      if (active) {
        setAttempt(active);
        const firstUnanswered = active.questions.findIndex((q) => q.selectedAnswer === null);
        setCurrentIndex(firstUnanswered === -1 ? active.questions.length - 1 : firstUnanswered);
        setPhase("quiz");
      } else {
        setPhase("intro");
      }
    });
    return () => {
      isMounted = false;
    };
  }, [profile]);

  const finishAttempt = useCallback(
    async (attemptId: string) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setPhase("submitting");
      await completePlacementAttempt(attemptId);
      const data = await fetchAttemptResult(attemptId);
      if (data) {
        setResult(data.result);
        setReview(data.review);
        setSkillBreakdown(computeSkillBreakdown(data.review.map((r) => ({ skill: r.skill, is_correct: r.isCorrect }))));
      }
      setPhase("result");
    },
    []
  );

  // ------------------------------------------------------------------
  // Timer — purely a display of the server-issued expires_at. Real
  // enforcement happens in the database (record/complete functions).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "quiz" || !attempt) return;
    function tick() {
      const secondsLeft = Math.max(
        0,
        Math.round((new Date(attempt!.expiresAt).getTime() - Date.now()) / 1000)
      );
      setRemainingSeconds(secondsLeft);
      if (secondsLeft === 0) {
        finishAttempt(attempt!.attemptId);
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phase, attempt, finishAttempt]);

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    try {
      const active = await startPlacementAttempt();
      setAttempt(active);
      setCurrentIndex(0);
      setPhase("quiz");
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "تعذّر بدء الاختبار.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSelect(option: string) {
    if (!attempt || savingAnswer) return;
    const question = attempt.questions[currentIndex];
    if (question.selectedAnswer !== null) return; // one answer per question, no re-selection

    // Must happen synchronously, before the network await below, so mobile
    // browsers treat unlocking audio as tied to this real tap gesture.
    primeAudioForInteraction();

    setSavingAnswer(true);
    setAnswerError(null);
    const { isCorrect, error } = await recordPlacementAnswer(attempt.attemptId, question.questionId, option);
    setSavingAnswer(false);

    if (error) {
      // Not saved — selectedAnswer stays null, so the options remain
      // clickable and "التالي" stays disabled. No sound plays either,
      // since no real correct/wrong outcome was actually recorded.
      setAnswerError("حدث خطأ أثناء حفظ إجابتك. اضغط على الإجابة مرة أخرى للمحاولة من جديد.");
      return;
    }

    if (isCorrect) playCorrectAnswerSound();
    else playWrongAnswerSound();

    setAttempt((prev) => {
      if (!prev) return prev;
      const nextQuestions = [...prev.questions];
      nextQuestions[currentIndex] = { ...question, selectedAnswer: option, isCorrect };
      return { ...prev, questions: nextQuestions };
    });
  }

  function handleNext() {
    if (!attempt) return;
    if (currentIndex < attempt.questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      finishAttempt(attempt.attemptId);
    }
  }

  if (phase === "loading" || phase === "submitting") {
    return (
      <StudentShell activeId="discover">
        <main className="flex-1 flex items-center justify-center min-h-[60vh]">
          <p className="text-sm font-bold text-ink-500">جارٍ التحميل...</p>
        </main>
      </StudentShell>
    );
  }

  if (phase === "unavailable") {
    return (
      <StudentShell activeId="discover">
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className="text-sm font-bold text-ink-500">
            هذا القسم غير متاح حاليًا لأن المشروع غير متصل بمصدر بيانات.
          </p>
        </main>
      </StudentShell>
    );
  }

  if (phase === "intro") {
    return (
      <StudentShell activeId="discover">
        <DiscoverIntro
          totalQuestions={10}
          minutes={10}
          skillCount={SKILLS.length}
          onStart={handleStart}
          starting={starting}
          errorMessage={startError}
        />
      </StudentShell>
    );
  }

  if (phase === "result" && result) {
    return (
      <StudentShell activeId="discover">
        <ResultView
          result={result}
          skills={skillBreakdown}
          review={review}
          onDone={() => navigate("/student")}
        />
      </StudentShell>
    );
  }

  if (phase === "quiz" && attempt) {
    const question = attempt.questions[currentIndex];
    const total = attempt.questions.length;
    const correctCount = attempt.questions.filter((q) => q.isCorrect === true).length;
    const wrongCount = attempt.questions.filter((q) => q.isCorrect === false).length;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeLabel = `${toArabicDigits(String(minutes).padStart(2, "0"))}:${toArabicDigits(
      String(seconds).padStart(2, "0")
    )}`;

    return (
      <StudentShell activeId="discover">
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-5 pb-24">
          <div className="flex flex-col items-center text-center gap-1">
            <h1 className="text-lg sm:text-xl font-extrabold text-ink-900">اكتشف مستواك</h1>
            <p className="text-sm font-bold text-ink-500">
              السؤال {toArabicDigits(currentIndex + 1)} من {toArabicDigits(total)}
            </p>
          </div>

          <div className="h-2.5 rounded-full bg-sand-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-berry-500 transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 bg-palm-50 text-palm-600 font-extrabold text-sm px-3 py-1.5 rounded-full">
                <CheckCircleIcon className="w-4 h-4" />
                {toArabicDigits(correctCount)}
              </span>
              <span className="flex items-center gap-1 bg-rose-50 text-rose-500 font-extrabold text-sm px-3 py-1.5 rounded-full">
                <XCircleIcon className="w-4 h-4" />
                {toArabicDigits(wrongCount)}
              </span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10.5px] font-bold text-ink-400">الوقت المتبقي</span>
              <span className="flex items-center gap-1.5 font-extrabold text-base text-ink-900 tabular-nums">
                <TimerIcon className="w-4 h-4 text-sun-500" />
                {timeLabel}
              </span>
            </div>
          </div>

          <QuestionCard
            question={question.question}
            options={question.options}
            selectedAnswer={question.selectedAnswer}
            isCorrect={question.isCorrect}
            disabled={question.selectedAnswer !== null || savingAnswer}
            onSelect={handleSelect}
          />

          {answerError && (
            <p className="text-center text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2.5 animate-rise-in">
              {answerError}
            </p>
          )}

          <button
            onClick={handleNext}
            disabled={question.selectedAnswer === null}
            className="self-center flex items-center gap-1.5 bg-berry-500 hover:bg-berry-600 disabled:opacity-40 disabled:pointer-events-none text-white font-extrabold text-sm rounded-2xl px-8 py-3.5 transition-colors"
          >
            {currentIndex < total - 1 ? "التالي" : "إنهاء الاختبار"}
            <ChevronIcon className="w-4 h-4 rotate-180" />
          </button>
        </main>
      </StudentShell>
    );
  }

  return null;
}
