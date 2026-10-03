import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import StudentShell from "../components/StudentShell";
import BrickTower, { type BrickState } from "../components/quiz/BrickTower";
import QuizQuestionView, { AnswerText } from "../components/quiz/QuizQuestion";
import QuizResult from "../components/quiz/QuizResult";
import { FlameIcon, SoundOffIcon, SoundOnIcon } from "../components/quiz/QuizIcons";
import { CheckCircleIcon, ChevronIcon } from "../components/icons/Glyphs";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import {
  QUIZ_TOTAL,
  completeQuizAttempt,
  fetchQuizResult,
  getInProgressQuizAttempt,
  recordQuizAnswer,
  startQuizAttempt,
  type ActiveQuizAttempt,
  type QuizQuestion,
  type QuizResultData,
  type QuizReviewItem,
} from "../lib/quiz";
import {
  isSoundMuted,
  playBrickLaidSound,
  playNextTickSound,
  playQuizFinishSound,
  playQuizStartSound,
  playQuizWrongSound,
  primeAudioForInteraction,
  setSoundMuted,
} from "../lib/sound";
import { toArabicDigits } from "../utils/arabicNumerals";

// «اختبر» — عشر أسئلة بنفس مهارات ومستوى «اكتشف» لكن بأرقام جديدة في كل مرة،
// بلا رفع في الجمع ولا استلاف في الطرح. على نفس نظام «اكتشف»: الأسئلة
// والإجابات الصحيحة والنتيجة والنجوم والشارات كلها تُحسب في قاعدة البيانات،
// والنتيجة تظهر لمعلمتك في لوحتها (انظر supabase/phase2-quiz-and-stars.sql).
//
// فكرة التصميم: «بنيان» هو اسم المنصة، فكل إجابة صحيحة تضع طوبة في برج
// يكبر أمام الطالبة. الخلفية أخضر النخيل العميق مع نقش نجمة ثمانية خافت،
// والأرقام بخط كوفي (Reem Kufi) ليختلف الإحساس عن باقي المنصة الفاتح.

type Phase = "loading" | "intro" | "playing" | "submitting" | "result" | "error" | "unavailable";

// نجمة ثمانية الرؤوس (مربعان متداخلان) — نقش هندسي إسلامي بخط رفيع جدًا.
const STAR_PATTERN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64' fill='none' stroke='#F3DFC1' stroke-width='1.1'>" +
    "<rect x='14' y='14' width='36' height='36'/>" +
    "<polygon points='32,5 59,32 32,59 5,32'/>" +
    "</svg>"
)}")`;

/** عدد الإجابات الصحيحة المتتالية المنتهية عند آخر سؤال أُجيب عنه. */
function currentStreak(questions: QuizQuestion[]): number {
  let run = 0;
  for (const q of questions) {
    if (q.isCorrect === true) run += 1;
    else if (q.isCorrect === false) run = 0;
    else break;
  }
  return run;
}

function firstUnansweredIndex(questions: QuizQuestion[]): number {
  const i = questions.findIndex((q) => q.selectedAnswer === null);
  return i === -1 ? questions.length - 1 : i;
}

export default function QuizPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState<ActiveQuizAttempt | null>(null);
  const [index, setIndex] = useState(0);
  const [justPlaced, setJustPlaced] = useState<number | null>(null);

  // الخيار الذي أُرسل للحفظ ولم يُجَب بعد. لا تُعدّ الإجابة مسجّلة إلا بعد
  // أن ينجح record_quiz_answer فعلًا — كما في «اكتشف».
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const [finished, setFinished] = useState<{ result: QuizResultData; review: QuizReviewItem[] } | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const finishingRef = useRef(false);

  const [muted, setMuted] = useState(isSoundMuted());
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  const question = attempt?.questions[index];
  const selected = question?.selectedAnswer ?? null;

  useEffect(() => {
    setAnswerError(null);
  }, [index]);

  // ------------------------------------------------------------------
  // الإقلاع: استئناف محاولة مفتوحة (تتحمّل تحديث الصفحة) أو عرض المقدمة.
  // ------------------------------------------------------------------
  // يعتمد على رقم الطالبة (نص ثابت) لا على كائن profile نفسه: لو أعاد AuthContext
  // إنشاء الكائن (تجديد الجلسة مثلًا) فلا يجوز أن يُعاد الإقلاع وتُرمى الطالبة
  // من منتصف الاختبار أو من شاشة النتيجة إلى المقدمة.
  const studentId = profile?.id;

  useEffect(() => {
    if (!isSupabaseConfigured || !studentId) {
      setPhase("unavailable");
      return;
    }
    let isMounted = true;
    getInProgressQuizAttempt(studentId).then((active) => {
      if (!isMounted) return;
      if (active) {
        setAttempt(active);
        setIndex(firstUnansweredIndex(active.questions));
        setPhase("playing");
      } else {
        setPhase("intro");
      }
    });
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  // على الشاشات القصيرة قد يقع زر «التالي» تحت الحافة: نُظهره بعد كل إجابة.
  useEffect(() => {
    if (selected !== null) {
      nextButtonRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

  function scrollTop() {
    window.scrollTo({ top: 0 });
  }

  async function handleStart() {
    // قبل أي await: المتصفحات على الجوال تفتح الصوت فقط من داخل لمسة حقيقية.
    primeAudioForInteraction();
    setStarting(true);
    setStartError(null);
    try {
      const active = await startQuizAttempt();
      finishingRef.current = false;
      setFinished(null);
      setAttempt(active);
      setIndex(firstUnansweredIndex(active.questions));
      setJustPlaced(null);
      setPhase("playing");
      playQuizStartSound();
      scrollTop();
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "تعذّر بدء الاختبار.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSelect(option: string) {
    if (!attempt || !question || pendingAnswer !== null || question.selectedAnswer !== null) return;
    primeAudioForInteraction();

    setPendingAnswer(option);
    setAnswerError(null);
    const saved = await recordQuizAnswer(attempt.attemptId, question.id, option);
    setPendingAnswer(null);

    if ("error" in saved) {
      // لم تُحفظ: تبقى الخيارات قابلة للنقر ولا يُشغَّل أي صوت (لا نتيجة حقيقية بعد).
      setAnswerError("حدث خطأ أثناء حفظ إجابتك. اضغطي على الإجابة مرة أخرى للمحاولة من جديد.");
      return;
    }

    const updated = attempt.questions.map((q, i) =>
      i === index
        ? { ...q, selectedAnswer: option, correctAnswer: saved.correctAnswer, isCorrect: saved.isCorrect }
        : q
    );
    setAttempt({ ...attempt, questions: updated });

    if (saved.isCorrect) {
      setJustPlaced(index);
      playBrickLaidSound(currentStreak(updated));
    } else {
      setJustPlaced(null);
      playQuizWrongSound();
    }
  }

  async function finishAttempt(attemptId: string) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishError(null);
    setPhase("submitting");

    const { error } = await completeQuizAttempt(attemptId);
    const data = error ? null : await fetchQuizResult(attemptId);
    if (!data) {
      // لا نترك الطالبة أمام شاشة فارغة: النداء آمن للتكرار (الخادم يتجاهل
      // إنهاء محاولة مكتملة)، فنسمح لها بإعادة المحاولة.
      finishingRef.current = false;
      setFinishError("تعذّر حفظ نتيجتك. تأكدي من الاتصال بالإنترنت ثم حاولي مرة أخرى.");
      setPhase("error");
      return;
    }

    setFinished(data);
    setPhase("result");
    playQuizFinishSound(data.result.percentage >= 70);
    scrollTop();
  }

  function handleNext() {
    if (!attempt || selected === null) return;
    playNextTickSound();
    setJustPlaced(null);
    if (index < attempt.questions.length - 1) {
      setIndex((i) => i + 1);
    } else {
      void finishAttempt(attempt.attemptId);
    }
  }

  function toggleMute() {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
    if (!next) {
      primeAudioForInteraction();
      playNextTickSound();
    }
  }

  const soundButton = (
    <button
      type="button"
      onClick={toggleMute}
      aria-pressed={muted}
      aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
      className="w-10 h-10 rounded-full bg-mortar/10 hover:bg-mortar/20 text-mortar flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sun-400"
    >
      {muted ? <SoundOffIcon className="w-5 h-5" /> : <SoundOnIcon className="w-5 h-5" />}
    </button>
  );

  const backdrop = (children: ReactNode) => (
    <StudentShell activeId="quiz">
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-oasis-900 via-oasis-800 to-oasis-700 pb-28 lg:pb-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: STAR_PATTERN, backgroundSize: "64px 64px" }}
          aria-hidden="true"
        />
        <div className="relative max-w-xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 flex flex-col items-center gap-5">
          {children}
        </div>
      </main>
    </StudentShell>
  );

  if (phase === "loading" || phase === "submitting") {
    return backdrop(<p className="pt-32 text-sm font-bold text-mortar/80">جارٍ التحميل...</p>);
  }

  if (phase === "unavailable") {
    return backdrop(
      <p className="pt-32 text-sm font-bold text-mortar/80 text-center">
        هذا القسم غير متاح حاليًا لأن المشروع غير متصل بمصدر بيانات.
      </p>
    );
  }

  if (phase === "error") {
    return backdrop(
      <div className="pt-24 flex flex-col items-center gap-4 text-center">
        <p className="text-sm font-bold text-mortar leading-relaxed max-w-xs">{finishError}</p>
        <button
          type="button"
          onClick={() => attempt && void finishAttempt(attempt.attemptId)}
          className="rounded-2xl bg-sun-400 hover:bg-sun-500 border-b-[6px] border-sun-600 active:translate-y-[3px] active:border-b-[3px] text-ink-900 font-extrabold text-base px-8 py-3 transition-[transform,background-color]"
        >
          حاولي مرة أخرى
        </button>
      </div>
    );
  }

  if (phase === "result" && finished) {
    return backdrop(
      <QuizResult
        result={finished.result}
        review={finished.review}
        retrying={starting}
        onRetry={handleStart}
        onPractice={() => navigate("/practice")}
        onHome={() => navigate("/student")}
      />
    );
  }

  if (phase === "intro") {
    return backdrop(
      <>
        <div className="w-full flex justify-start">{soundButton}</div>

        <div className="flex flex-col items-center gap-6 text-center pt-2 animate-pop-in">
          <BrickTower
            states={Array<BrickState>(QUIZ_TOTAL).fill("pending")}
            flag="dim"
            className="w-full max-w-[300px] h-auto"
            label="برج فارغ ينتظر عشر طوبات"
          />
          <div className="flex flex-col gap-2.5">
            <h1 className="font-kufi font-bold text-3xl sm:text-4xl text-mortar leading-snug text-balance">
              ابني برجك طوبة بعد طوبة
            </h1>
            <p className="text-sm sm:text-base font-medium text-mortar/80 leading-relaxed max-w-sm mx-auto">
              كل إجابة صحيحة تضع طوبة جديدة في برجك. عشرة أسئلة من ثماني مهارات، وأرقامها جديدة في كل مرة.
            </p>
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-2 list-none">
            {[`${toArabicDigits(QUIZ_TOTAL)} أسئلة`, `${toArabicDigits(8)} مهارات`, "بدون وقت محدد"].map((text) => (
              <li
                key={text}
                className="rounded-full bg-mortar/10 border border-mortar/20 text-mortar text-xs font-bold px-3.5 py-1.5"
              >
                {text}
              </li>
            ))}
          </ul>

          {startError && (
            <p className="text-xs font-bold text-rose-400 bg-rose-500/10 rounded-xl px-3 py-2.5 max-w-xs">
              {startError}
            </p>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="w-full max-w-xs flex items-center justify-center gap-2 rounded-2xl bg-sun-400 hover:bg-sun-500 border-b-[6px] border-sun-600 active:translate-y-[3px] active:border-b-[3px] disabled:opacity-60 disabled:pointer-events-none text-ink-900 font-extrabold text-lg px-8 py-4 transition-[transform,background-color] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-mortar focus-visible:outline-offset-2"
          >
            {starting ? "جارٍ تجهيز الأسئلة..." : "ابدئي الاختبار"}
            {!starting && <ChevronIcon className="w-5 h-5 rotate-180" />}
          </button>
        </div>
      </>
    );
  }

  if (phase === "playing" && attempt && question) {
    const streak = currentStreak(attempt.questions);
    const towerStates: BrickState[] = attempt.questions.map((q) =>
      q.isCorrect === null ? "pending" : q.isCorrect ? "correct" : "wrong"
    );
    const correctSoFar = attempt.questions.filter((q) => q.isCorrect === true).length;
    const total = attempt.questions.length;

    return backdrop(
      <>
        <div className="w-full flex items-center justify-between gap-3">
          {soundButton}
          <p className="font-kufi font-bold text-base text-mortar">
            السؤال {toArabicDigits(index + 1)} من {toArabicDigits(total)}
          </p>
          <div className="w-16 flex justify-end">
            {streak >= 2 && (
              <span
                key={streak}
                className="inline-flex items-center gap-1 rounded-full bg-sun-400 text-ink-900 font-kufi font-bold text-sm px-2.5 py-1 animate-streak-pop"
                aria-label={`${streak} إجابات صحيحة متتالية`}
              >
                <FlameIcon className="w-4 h-4 text-brick-600" />×{toArabicDigits(streak)}
              </span>
            )}
          </div>
        </div>

        <BrickTower
          states={towerStates}
          currentIndex={selected === null ? index : null}
          justPlacedIndex={justPlaced}
          flag="dim"
          className="w-full max-w-[210px] sm:max-w-[240px] h-auto"
          label={`بنيتِ ${toArabicDigits(correctSoFar)} طوبات من ${toArabicDigits(total)}`}
        />

        {/* key: تُعاد الحركة والحالة كاملة مع كل سؤال جديد */}
        <QuizQuestionView
          key={question.id}
          question={question}
          selectedAnswer={selected}
          pendingAnswer={pendingAnswer}
          onSelect={handleSelect}
        />

        <div className="w-full min-h-[44px] flex items-center justify-center text-center" aria-live="polite">
          {answerError ? (
            <p className="text-xs font-bold text-rose-300 bg-rose-500/10 rounded-xl px-3 py-2.5 animate-rise-in">
              {answerError}
            </p>
          ) : (
            selected !== null &&
            (question.isCorrect ? (
              <p className="flex items-center gap-2 text-sm font-extrabold text-palm-100 animate-rise-in">
                <CheckCircleIcon className="w-5 h-5 text-palm-400" />
                أحسنتِ! وُضعت طوبة جديدة في برجك
              </p>
            ) : (
              <p className="text-sm font-extrabold text-rose-400 animate-rise-in">
                ليس تمامًا. الإجابة الصحيحة:{" "}
                <span className="text-mortar">
                  <AnswerText value={question.correctAnswer ?? ""} />
                </span>
              </p>
            ))
          )}
        </div>

        <button
          type="button"
          ref={nextButtonRef}
          onClick={handleNext}
          disabled={selected === null}
          className="scroll-mb-24 w-full max-w-xs flex items-center justify-center gap-2 rounded-2xl bg-sun-400 hover:bg-sun-500 border-b-[6px] border-sun-600 active:translate-y-[3px] active:border-b-[3px] disabled:opacity-35 disabled:pointer-events-none text-ink-900 font-extrabold text-base px-8 py-3.5 transition-[transform,background-color,opacity] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-mortar focus-visible:outline-offset-2"
        >
          {index < total - 1 ? "التالي" : "إنهاء الاختبار"}
          <ChevronIcon className="w-4 h-4 rotate-180" />
        </button>
      </>
    );
  }

  return null;
}
