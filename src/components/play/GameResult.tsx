import type { ReactNode } from "react";
import type { GameResultData, GameReviewItem } from "../../lib/games";
import type { GameTheme } from "../../data/playGameThemes";
import { resultMessage, formatDuration } from "../../data/playGameThemes";
import { formatArabicText } from "../../lib/discover";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { AnswerText } from "../quiz/QuizQuestion";
import { CheckCircleIcon, ChevronIcon, StarIcon, TimerIcon, XCircleIcon } from "../icons/Glyphs";
import Mascot from "./Mascot";

interface GameResultProps {
  theme: GameTheme;
  result: GameResultData;
  review: GameReviewItem[];
  retrying?: boolean;
  onRetry: () => void;
  onBackToGames: () => void;
}

export default function GameResult({ theme, result, review, retrying = false, onRetry, onBackToGames }: GameResultProps) {
  const { correctAnswers, wrongAnswers, totalQuestions, percentage, durationSeconds, pointsAwarded } = result;
  const celebrate = percentage >= 70;
  const mistakes = review.filter((r) => !r.isCorrect);

  return (
    <div className="w-full flex flex-col items-center gap-6 animate-game-in">
      <Mascot theme={theme} mood={celebrate ? "cheer" : "idle"} className="w-32 h-32 sm:w-36 sm:h-36" />

      <div className="text-center flex flex-col gap-2">
        <h1 className="font-extrabold text-2xl sm:text-3xl text-ink-900 text-balance">
          {resultMessage(theme, percentage)}
        </h1>
        <p className="font-extrabold text-6xl sm:text-7xl" style={{ color: theme.scene.accentDark }}>
          {toArabicDigits(correctAnswers)}
          <span className="text-ink-300 text-4xl sm:text-5xl"> / {toArabicDigits(totalQuestions)}</span>
        </p>
        <span
          className="self-center inline-flex items-center gap-2 rounded-full font-extrabold text-sm px-4 py-1.5"
          style={{ backgroundColor: theme.scene.from, color: theme.scene.accentDark }}
        >
          {toArabicDigits(percentage)}٪ إجابات صحيحة
        </span>
      </div>

      <section className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="صحيحة" value={toArabicDigits(correctAnswers)} tone="text-palm-600 bg-palm-50" icon={<CheckCircleIcon className="w-5 h-5" />} />
        <StatTile label="خاطئة" value={toArabicDigits(wrongAnswers)} tone="text-rose-500 bg-rose-50" icon={<XCircleIcon className="w-5 h-5" />} />
        <StatTile label="الوقت" value={formatDuration(durationSeconds)} tone="text-sky-500 bg-sky-50" icon={<TimerIcon className="w-5 h-5" />} />
        <StatTile label="نجوم مكتسبة" value={toArabicDigits(pointsAwarded)} tone="text-sun-600 bg-sun-50" icon={<StarIcon className="w-5 h-5" />} />
      </section>

      {mistakes.length > 0 && (
        <details className="w-full rounded-[28px] bg-white p-5 sm:p-6 shadow-soft group">
          <summary className="flex items-center justify-between cursor-pointer list-none text-base font-extrabold text-ink-900 [&::-webkit-details-marker]:hidden">
            راجع المسائل التي أخطأت فيها
            <ChevronIcon className="w-4 h-4 transition-transform rotate-180 group-open:-rotate-90" />
          </summary>
          <div className="mt-4 flex flex-col gap-3">
            {mistakes.map((m, i) => (
              <div key={i} className="rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <p className="text-sm font-extrabold text-ink-900 mb-1.5" dir="ltr">
                  <span dir="rtl">{formatArabicText(m.text)}</span>
                </p>
                <p className="text-xs font-bold text-rose-500">
                  إجابتك: {m.selectedAnswer ? <AnswerText value={m.selectedAnswer} /> : "لم تتم الإجابة"}
                </p>
                <p className="text-xs font-bold text-palm-600">
                  الإجابة الصحيحة: <AnswerText value={m.correctAnswer} />
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="w-full flex flex-col gap-3 pt-1">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          style={{ backgroundColor: theme.scene.accent, borderColor: theme.scene.accentDark }}
          className="rounded-2xl border-b-[6px] active:translate-y-[3px] active:border-b-[3px] disabled:opacity-60 disabled:pointer-events-none text-white font-extrabold text-base px-8 py-3.5 transition-[transform,background-color]"
        >
          {retrying ? "جارٍ تجهيز اللعبة..." : "العب مرة أخرى"}
        </button>
        <button
          type="button"
          onClick={onBackToGames}
          className="rounded-2xl text-ink-500 hover:text-ink-900 font-extrabold text-sm px-8 py-2.5 transition-colors"
        >
          العودة إلى الألعاب
        </button>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: ReactNode }) {
  return (
    <div className="rounded-3xl bg-white shadow-soft p-3 flex flex-col items-center gap-1.5 text-center">
      <span className={`w-9 h-9 rounded-2xl flex items-center justify-center ${tone}`}>{icon}</span>
      <p className="font-extrabold text-2xl leading-none text-ink-900">{value}</p>
      <p className="text-[10.5px] font-bold text-ink-500 leading-tight">{label}</p>
    </div>
  );
}
