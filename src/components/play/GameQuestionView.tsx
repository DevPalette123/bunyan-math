import type { CSSProperties, ReactNode } from "react";
import type { GameQuestion } from "../../lib/games";
import type { GameTheme } from "../../data/playGameThemes";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { formatArabicText } from "../../lib/discover";
import { isSign, signGlyph } from "../quiz/QuizQuestion";
import { CheckCircleIcon, XCircleIcon } from "../icons/Glyphs";
import NumberLineVisual from "./NumberLineVisual";
import DoublingVisual from "./DoublingVisual";

/** خيارات الترتيب (أربعة أعداد مفصولة بفاصلة) أطول من خيار رقم واحد — خط أصغر
 * لتتّسع الفقاعة، بنفس فكرة optionTextSize في QuizQuestion.tsx. */
function optionTextSize(option: string): string {
  return option.length > 6 ? "text-lg sm:text-2xl" : "text-3xl sm:text-4xl";
}

interface GameQuestionViewProps {
  question: GameQuestion;
  theme: GameTheme;
  selectedAnswer: string | null;
  pendingAnswer: string | null;
  onSelect: (option: string) => void;
}

/**
 * فقاعات إجابة ملوّنة بدل شبكة أزرار «اختبر» الرمادية-المتناسقة — كل خيار
 * بلون مختلف من ثيم اللعبة، ليقرأها الطفل كلعبة لا كامتحان.
 */
export default function GameQuestionView({
  question,
  theme,
  selectedAnswer,
  pendingAnswer,
  onSelect,
}: GameQuestionViewProps) {
  const revealed = selectedAnswer !== null;
  const correctAnswer = question.correctAnswer;
  const saving = pendingAnswer !== null;

  return (
    <div className="w-full flex flex-col gap-5">
      <div
        key={question.id}
        className="w-full rounded-[32px] bg-white px-6 py-8 sm:py-10 shadow-[0_16px_36px_-14px_rgba(31,42,36,0.25)] flex items-center justify-center animate-game-in"
      >
        {question.visual.kind === "numberLine" ? (
          <NumberLineVisual visual={question.visual} theme={theme} revealed={revealed} correctAnswer={correctAnswer} />
        ) : question.visual.kind === "doublingPods" ? (
          <DoublingVisual visual={question.visual} theme={theme} revealed={revealed} correctAnswer={correctAnswer} />
        ) : question.visual.kind === "chips" ? (
          // مغامرتا الترتيب: الأعداد الأربعة كما وردت في السؤال (غير مرتّبة) —
          // نفس شكل «chips» في اختبر/اكتشف، بلون ثيم اللعبة بدل لون اختبر الثابت.
          <div dir="rtl" className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {question.visual.numbers.map((n, i) => (
              <span
                key={`${n}-${i}`}
                style={{ backgroundColor: theme.scene.accent, borderColor: theme.scene.accentDark }}
                className="min-w-[58px] text-center rounded-xl border-b-[5px] px-3 py-1.5 font-extrabold text-3xl sm:text-4xl leading-tight text-white shadow-sm tabular-nums"
              >
                {toArabicDigits(n)}
              </span>
            ))}
          </div>
        ) : question.visual.kind === "number" ? (
          // مغامرة الزوجي والفردي: عدد واحد كبير — التصنيف (زوجي/فردي) في الخيارات أسفله.
          <span className="font-extrabold text-6xl sm:text-8xl leading-none text-ink-900 tabular-nums">
            {toArabicDigits(question.visual.value)}
          </span>
        ) : question.visual.kind === "compare" ? (
          // مغامرة المقارنة: عددان وعلامة تُكشف بعد الإجابة — نفس منطق «compare» في
          // اختبر (بما فيه انعكاس < و> ليُقرأ الشكل صحيحًا في السياق العربي).
          <div dir="rtl" className="flex items-center justify-center gap-3 sm:gap-5">
            <span className="font-extrabold text-4xl sm:text-6xl text-ink-900 tabular-nums">
              {toArabicDigits(question.visual.first)}
            </span>
            {revealed ? (
              <span
                dir="ltr"
                className={`w-14 h-14 sm:w-20 sm:h-20 rounded-2xl border-[3px] flex items-center justify-center font-extrabold text-3xl sm:text-5xl leading-none ${
                  selectedAnswer === correctAnswer
                    ? "border-palm-500 bg-palm-50 text-palm-600"
                    : "border-palm-400 bg-palm-50/70 text-palm-700"
                }`}
              >
                {isSign(correctAnswer ?? "") ? signGlyph(correctAnswer ?? "") : correctAnswer}
              </span>
            ) : (
              <span
                className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl border-2 border-dashed flex items-center justify-center font-extrabold text-3xl sm:text-5xl leading-none animate-glow-pulse"
                style={{ borderColor: theme.scene.accent, color: theme.scene.accentDark }}
                aria-label="مكان العلامة"
              >
                ؟
              </span>
            )}
            <span className="font-extrabold text-4xl sm:text-6xl text-ink-900 tabular-nums">
              {toArabicDigits(question.visual.second)}
            </span>
          </div>
        ) : (
          // «تعبير حسابي» (الجمع/الطرح): يُقرأ بالاتجاه العربي — العدد الأول
          // يمينًا، فعلامة الاستفهام أو الجواب في أقصى اليسار (نهاية الجملة).
          <div dir="rtl" className="flex items-center justify-center gap-3 sm:gap-4">
            <span className="font-extrabold text-4xl sm:text-6xl text-ink-900 tabular-nums">
              {toArabicDigits(question.operandA)}
            </span>
            <span className="font-extrabold text-3xl sm:text-5xl" style={{ color: theme.scene.accentDark }}>
              {question.operator === "+" ? "+" : "−"}
            </span>
            <span className="font-extrabold text-4xl sm:text-6xl text-ink-900 tabular-nums">
              {toArabicDigits(question.operandB ?? 0)}
            </span>
            <span className="font-extrabold text-3xl sm:text-5xl text-ink-300">=</span>
            {revealed ? (
              <span
                className={`min-w-[1.6em] text-center font-extrabold text-4xl sm:text-6xl tabular-nums ${
                  selectedAnswer === correctAnswer ? "text-palm-600" : "text-clay-600"
                }`}
              >
                {toArabicDigits(correctAnswer ?? "")}
              </span>
            ) : (
              <span className="min-w-[1.2em] text-center font-extrabold text-4xl sm:text-6xl text-sun-500">؟</span>
            )}
          </div>
        )}
      </div>

      <div role="group" aria-label="الإجابات" className="grid grid-cols-2 gap-3 sm:gap-4">
        {question.options.map((option, i) => {
          const palette = theme.bubbles[i % theme.bubbles.length];
          const isChosen = selectedAnswer === option;
          const isRight = revealed && option === correctAnswer;
          const isPending = pendingAnswer === option;

          let style: CSSProperties = { backgroundColor: palette.bg, borderColor: palette.edge, color: palette.text };
          let icon: ReactNode = null;
          let extraClass = "hover:-translate-y-0.5 active:translate-y-0.5";

          if (isPending) {
            style = { backgroundColor: "#fff", borderColor: palette.edge, color: palette.text };
            extraClass = "";
          } else if (revealed) {
            extraClass = "";
            if (isChosen && isRight) {
              style = { backgroundColor: "#E3F3E9", borderColor: "#3E9C6B", color: "#146239" };
              icon = <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-palm-600" />;
            } else if (isChosen) {
              style = { backgroundColor: "#FBE7EA", borderColor: "#D6486E", color: "#9C2E4D" };
              icon = <XCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />;
              extraClass = "animate-shake";
            } else if (isRight) {
              style = { backgroundColor: "#EEF8F1", borderColor: "#9BCFAF", color: "#146239" };
              icon = <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-palm-500" />;
            } else {
              style = { backgroundColor: "#F4F2EC", borderColor: "#E3E0D6", color: "#9B978C" };
            }
          }

          return (
            <button
              key={option}
              type="button"
              disabled={revealed || saving}
              onClick={() => onSelect(option)}
              style={style}
              aria-label={isSign(option) ? `العلامة ${option === "=" ? "يساوي" : option === "<" ? "أصغر من" : "أكبر من"}` : undefined}
              className={`flex items-center justify-center gap-2 min-h-[76px] sm:min-h-[86px] rounded-3xl border-[3px] font-extrabold tabular-nums transition-[transform,background-color,border-color,opacity] duration-150 disabled:cursor-default focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sky-400 focus-visible:outline-offset-2 animate-bubble-pop ${extraClass} ${optionTextSize(option)}`}
            >
              {isSign(option) ? (
                <span dir="ltr">{signGlyph(option)}</span>
              ) : (
                formatArabicText(option)
              )}
              {icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
