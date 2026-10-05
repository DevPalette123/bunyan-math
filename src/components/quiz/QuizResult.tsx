import { useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { QuizResultData, QuizReviewItem } from "../../lib/quiz";
import { computeSkillBreakdown, formatArabicText, skillLabel, type SkillBreakdownItem } from "../../lib/discover";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { CheckCircleIcon, ChevronIcon, StarIcon, XCircleIcon } from "../icons/Glyphs";
import BrickTower, { type BrickState } from "./BrickTower";
import { FlameIcon, RedoIcon } from "./QuizIcons";
import { AnswerText } from "./QuizQuestion";

interface QuizResultProps {
  /** النتيجة كما حسبتها قاعدة البيانات (وليس المتصفح). */
  result: QuizResultData;
  review: QuizReviewItem[];
  /** true أثناء تجهيز محاولة جديدة. */
  retrying?: boolean;
  onRetry: () => void;
  onPractice: () => void;
  onHome: () => void;
}

const HEADLINE: Record<string, string> = {
  "متقن": "أحسنت! اكتمل برجك بإتقان",
  "جيد": "أداء جيد جدًا، وبرجك قوي",
  "في طور التقدم": "برجك يكبر، وأنت في طور التقدم",
  "يحتاج إلى تأسيس": "بداية طيبة، نبني معًا طوبة بعد طوبة",
};

const SKILL_PILL: Record<SkillBreakdownItem["level"], string> = {
  "متقن": "bg-palm-50 text-palm-600",
  "جيد": "bg-sun-50 text-sun-600",
  "يحتاج تدريب": "bg-rose-50 text-rose-500",
};

export default function QuizResult({ result, review, retrying = false, onRetry, onPractice, onHome }: QuizResultProps) {
  const { correctAnswers, wrongAnswers, unanswered, percentage, level, pointsAwarded, bestStreak } = result;
  const celebrate = percentage >= 70;

  const towerStates: BrickState[] = review.map((r) => (r.isCorrect ? "correct" : "wrong"));
  const skills = computeSkillBreakdown(review.map((r) => ({ skill: r.skill, is_correct: r.isCorrect })));
  const weakSkills = skills.filter((s) => s.level === "يحتاج تدريب");
  const mistakes = review.filter((r) => !r.isCorrect);

  return (
    <div className="relative flex flex-col items-center gap-6">
      {celebrate && <Confetti />}

      <section className="flex flex-col items-center gap-4 text-center animate-pop-in">
        <BrickTower
          states={towerStates}
          flag="raised"
          wrongStyle="empty"
          flagColor={celebrate ? "#F0B94A" : "#F3DFC1"}
          className="w-full max-w-[250px] h-auto"
          label={`بنيت ${toArabicDigits(correctAnswers)} طوبات من ${toArabicDigits(result.totalQuestions)}`}
        />
        <h1 className="font-kufi font-bold text-2xl sm:text-3xl text-mortar leading-snug text-balance">
          {HEADLINE[level] ?? level}
        </h1>
        <p className="font-kufi font-bold text-6xl sm:text-7xl leading-none text-sun-400" aria-label={`${correctAnswers} من ${result.totalQuestions}`}>
          {toArabicDigits(correctAnswers)}
          <span className="text-mortar/50 text-4xl sm:text-5xl"> / {toArabicDigits(result.totalQuestions)}</span>
        </p>
        <span className="inline-flex items-center gap-2 rounded-full bg-mortar/15 text-mortar font-extrabold text-sm px-4 py-1.5">
          المستوى: {level}
          <span className="text-mortar/60">{toArabicDigits(percentage)}٪</span>
        </span>
      </section>

      <section className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="إجابات صحيحة" value={correctAnswers} tone="text-palm-600 bg-palm-50" icon={<CheckCircleIcon className="w-5 h-5" />} />
        <StatTile
          label={unanswered > 0 ? "خاطئة أو غير مجابة" : "إجابات خاطئة"}
          value={wrongAnswers + unanswered}
          tone="text-rose-500 bg-rose-50"
          icon={<XCircleIcon className="w-5 h-5" />}
        />
        <StatTile label="أطول سلسلة صحيحة" value={bestStreak} tone="text-sun-600 bg-sun-50" icon={<FlameIcon className="w-5 h-5" />} />
        <StatTile label="نجوم مكتسبة" value={pointsAwarded} tone="text-sun-600 bg-sun-50" icon={<StarIcon className="w-5 h-5" />} />
      </section>
      {pointsAwarded === 0 && correctAnswers > 0 && (
        <p className="-mt-3 text-center text-xs font-bold text-mortar/70">
          النجوم تُمنح لأول اختبار في كل يوم. نتيجة هذه المحاولة محفوظة وتظهر لمعلمك.
        </p>
      )}

      <section className="w-full rounded-[28px] bg-sand-50 p-5 sm:p-6 border-b-[6px] border-mortar">
        <h2 className="text-base font-extrabold text-ink-900 mb-4">مهاراتك في هذا الاختبار</h2>
        <ul className="flex flex-col gap-2.5 list-none">
          {skills.map((s) => (
            <li key={s.skill} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-bold text-ink-700">{skillLabel(s.skill)}</span>
              <span className="text-xs font-extrabold text-ink-400 w-10 text-end">
                {toArabicDigits(s.correct)}/{toArabicDigits(s.total)}
              </span>
              <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${SKILL_PILL[s.level]}`}>
                {s.level}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <details className="w-full rounded-[28px] bg-sand-50 p-5 sm:p-6 border-b-[6px] border-mortar group">
        <summary className="flex items-center justify-between cursor-pointer list-none text-base font-extrabold text-ink-900 [&::-webkit-details-marker]:hidden">
          راجع إجاباتك
          <ChevronIcon className="w-4 h-4 transition-transform rotate-180 group-open:-rotate-90" />
        </summary>
        <div className="mt-4 flex flex-col gap-3">
          {mistakes.length === 0 ? (
            <p className="text-sm font-bold text-palm-600">لا توجد أخطاء — كل إجاباتك صحيحة!</p>
          ) : (
            mistakes.map((m, i) => (
              <div key={i} className="rounded-2xl border border-mortar bg-white p-4">
                <p className="text-[11px] font-bold text-ink-400 mb-1">{skillLabel(m.skill)}</p>
                <p className="text-sm font-extrabold text-ink-900 mb-2">{formatArabicText(m.text)}</p>
                <p className="text-xs font-bold text-rose-500">
                  إجابتك: {m.selectedAnswer ? <AnswerText value={m.selectedAnswer} /> : "لم تتم الإجابة"}
                </p>
                <p className="text-xs font-bold text-palm-600">
                  الإجابة الصحيحة: <AnswerText value={m.correctAnswer} />
                </p>
              </div>
            ))
          )}
        </div>
      </details>

      <div className="w-full flex flex-col gap-3 pt-1">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="flex items-center justify-center gap-2 rounded-2xl bg-sun-400 hover:bg-sun-500 border-b-[6px] border-sun-600 active:translate-y-[3px] active:border-b-[3px] disabled:opacity-60 disabled:pointer-events-none text-ink-900 font-extrabold text-base px-8 py-3.5 transition-[transform,background-color]"
        >
          <RedoIcon className="w-5 h-5" />
          {retrying ? "جارٍ تجهيز الأسئلة..." : "أعد الاختبار بأرقام جديدة"}
        </button>
        {weakSkills.length > 0 && (
          <button
            type="button"
            onClick={onPractice}
            className="rounded-2xl bg-white/10 hover:bg-white/15 border border-mortar/30 text-mortar font-extrabold text-sm px-8 py-3 transition-colors"
          >
            تدرّبي على المهارات التي تحتاج تقوية
          </button>
        )}
        <button
          type="button"
          onClick={onHome}
          className="rounded-2xl text-mortar/80 hover:text-mortar font-extrabold text-sm px-8 py-2.5 transition-colors"
        >
          العودة إلى الرئيسية
        </button>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-sand-50 border-b-[5px] border-mortar p-3 flex flex-col items-center gap-1.5 text-center">
      <span className={`w-9 h-9 rounded-2xl flex items-center justify-center ${tone}`}>{icon}</span>
      <p className="font-kufi font-bold text-2xl leading-none text-ink-900">{toArabicDigits(value)}</p>
      <p className="text-[10.5px] font-bold text-ink-500 leading-tight">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// قصاصات احتفال — تسقط مرة واحدة فقط عند ظهور النتيجة (٧٠٪ فأكثر)
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ["#F0B94A", "#DC7F5C", "#3E9C6B", "#5BA9D6", "#E86E8F", "#F3DFC1"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 7 + Math.random() * 7,
        round: Math.random() < 0.35,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: Math.round((Math.random() - 0.5) * 140),
        duration: 2.8 + Math.random() * 2.2,
        delay: Math.random() * 0.9,
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute -top-4 block animate-confetti-fall"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.7,
              borderRadius: p.round ? "9999px" : "2px",
              backgroundColor: p.color,
              "--drift": `${p.drift}px`,
              "--dur": `${p.duration}s`,
              "--delay": `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
