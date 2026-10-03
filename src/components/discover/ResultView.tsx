import { useState } from "react";
import { toArabicDigits } from "../../utils/arabicNumerals";
import {
  formatArabicText,
  skillLabel,
  type AttemptResult,
  type ReviewQuestion,
  type SkillBreakdownItem,
} from "../../lib/discover";
import {
  BadgeAwardIcon,
  CheckCircleIcon,
  ChevronIcon,
  StarIcon,
  TrophyIcon,
  XCircleIcon,
} from "../icons/Glyphs";

interface ResultViewProps {
  result: AttemptResult;
  skills: SkillBreakdownItem[];
  review: ReviewQuestion[];
  onDone: () => void;
}

const LEVEL_HEADLINE: Record<string, string> = {
  "متقن": "أحسنت! أداء متقن",
  "جيد": "أداء جيد جدًا",
  "في طور التقدم": "أنتِ في طور التقدم",
  "يحتاج إلى تأسيس": "بداية طيبة، ونواصل التأسيس معًا",
};

const SKILL_LEVEL_CLASS: Record<SkillBreakdownItem["level"], string> = {
  "متقن": "bg-palm-50 text-palm-600",
  "جيد": "bg-sun-50 text-sun-600",
  "يحتاج تدريب": "bg-rose-50 text-rose-500",
};

export default function ResultView({ result, skills, review, onDone }: ResultViewProps) {
  const [showReview, setShowReview] = useState(false);
  const strong = skills.filter((s) => s.level === "متقن");
  const weak = skills.filter((s) => s.level === "يحتاج تدريب");
  const mistakes = review.filter((r) => !r.isCorrect);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6 pb-16">
      <section className="flex flex-col items-center text-center gap-2 animate-pop-in">
        <span className="w-16 h-16 rounded-4xl bg-sun-50 flex items-center justify-center">
          <TrophyIcon className="w-9 h-9 text-sun-500" />
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900">
          {LEVEL_HEADLINE[result.level] ?? result.level}
        </h1>
        <p className="text-sm font-bold text-ink-500">
          نتيجتك: {toArabicDigits(result.correctAnswers)} / {toArabicDigits(result.totalQuestions)} —{" "}
          {toArabicDigits(result.percentage)}٪
        </p>
        <span className="mt-1 inline-flex items-center gap-1.5 bg-berry-50 text-berry-600 font-extrabold text-sm px-4 py-1.5 rounded-full">
          المستوى: {result.level}
        </span>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-rise-in [animation-delay:60ms]">
        <StatCard label="الإجابات الصحيحة" value={result.correctAnswers} colorClass="bg-palm-50 text-palm-600" Icon={CheckCircleIcon} />
        <StatCard label="الإجابات الخاطئة" value={result.wrongAnswers} colorClass="bg-rose-50 text-rose-500" Icon={XCircleIcon} />
        <StatCard label="غير المجابة" value={result.unanswered} colorClass="bg-sand-100 text-ink-500" Icon={ChevronIcon} />
        <StatCard label="النقاط المكتسبة" value={result.pointsAwarded} colorClass="bg-sun-50 text-sun-500" Icon={StarIcon} />
      </section>

      <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6 animate-rise-in [animation-delay:100ms]">
        <h2 className="text-base font-extrabold text-ink-900 mb-4">تحليل مهاراتك</h2>
        <div className="flex flex-col gap-2.5">
          {skills.map((s) => (
            <div key={s.skill} className="flex items-center gap-3">
              <span className="flex-1 text-xs sm:text-sm font-bold text-ink-700">{skillLabel(s.skill)}</span>
              <span className="text-[11px] font-extrabold text-ink-400 w-10 text-end">
                {toArabicDigits(s.correct)}/{toArabicDigits(s.total)}
              </span>
              <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${SKILL_LEVEL_CLASS[s.level]}`}>
                {s.level}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-rise-in [animation-delay:140ms]">
        <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-ink-900 mb-3">
            <BadgeAwardIcon className="w-4 h-4 text-palm-500" />
            نقاط قوتك
          </h3>
          {strong.length === 0 ? (
            <p className="text-xs text-ink-500">لا توجد بعد مهارة وصلت إلى مستوى "متقن" — واصلي التدريب!</p>
          ) : (
            <ul className="flex flex-col gap-1.5 list-none">
              {strong.map((s) => (
                <li key={s.skill} className="text-xs font-bold text-palm-700 bg-palm-50 rounded-xl px-3 py-2">
                  {skillLabel(s.skill)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-ink-900 mb-3">
            <TrophyIcon className="w-4 h-4 text-rose-500" />
            مهارات تحتاج إلى تدريب
          </h3>
          {weak.length === 0 ? (
            <p className="text-xs text-ink-500">لا توجد مهارة ضعيفة حاليًا — أداء متوازن!</p>
          ) : (
            <ul className="flex flex-col gap-1.5 list-none">
              {weak.map((s) => (
                <li key={s.skill} className="text-xs font-bold text-rose-600 bg-rose-50 rounded-xl px-3 py-2">
                  {skillLabel(s.skill)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6 animate-rise-in [animation-delay:180ms]">
        <button
          onClick={() => setShowReview((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-extrabold text-ink-900"
        >
          راجع إجاباتك
          <ChevronIcon className={`w-4 h-4 transition-transform ${showReview ? "-rotate-90" : "rotate-180"}`} />
        </button>

        {showReview && (
          <div className="mt-4 flex flex-col gap-3">
            {mistakes.length === 0 ? (
              <p className="text-xs text-ink-500">لا توجد أخطاء — إجابات ممتازة على كل الأسئلة!</p>
            ) : (
              mistakes.map((q, i) => (
                <div key={i} className="rounded-2xl border border-sand-200 p-4">
                  <p className="text-[11px] font-bold text-ink-400 mb-1">{skillLabel(q.skill)}</p>
                  <p className="text-sm font-extrabold text-ink-900 mb-2">{formatArabicText(q.question)}</p>
                  <p className="text-xs font-bold text-rose-500">
                    إجابتك: {q.selectedAnswer ? formatArabicText(q.selectedAnswer) : "لم تتم الإجابة"}
                  </p>
                  <p className="text-xs font-bold text-palm-600">
                    الإجابة الصحيحة: {formatArabicText(q.correctAnswer)}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <button
        onClick={onDone}
        className="bg-berry-500 hover:bg-berry-600 text-white font-extrabold text-sm rounded-2xl px-8 py-3.5 transition-colors self-center"
      >
        العودة إلى الرئيسية
      </button>
    </main>
  );
}

function StatCard({
  label,
  value,
  colorClass,
  Icon,
}: {
  label: string;
  value: number;
  colorClass: string;
  Icon: typeof CheckCircleIcon;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-soft p-4 flex flex-col items-center gap-1.5 text-center">
      <span className={`w-9 h-9 rounded-2xl flex items-center justify-center ${colorClass}`}>
        <Icon className="w-4.5 h-4.5" />
      </span>
      <p className="text-lg font-extrabold text-ink-900">{toArabicDigits(value)}</p>
      <p className="text-[10.5px] font-bold text-ink-500 leading-tight">{label}</p>
    </div>
  );
}
