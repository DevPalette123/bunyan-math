import type { ReactNode } from "react";
import type { QuizQuestion as QuizQuestionData, QuizToken } from "../../lib/quiz";
import { formatArabicText, OPTION_LETTERS } from "../../lib/discover";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { CheckCircleIcon, XCircleIcon } from "../icons/Glyphs";

interface QuizQuestionProps {
  question: QuizQuestionData;
  /** null حتى تجيب الطالبة على هذا السؤال وتُحفظ إجابتها. */
  selectedAnswer: string | null;
  /** الخيار الذي أُرسل للحفظ ولم يعد جوابه بعد (لحظة الانتظار القصيرة). */
  pendingAnswer?: string | null;
  onSelect: (option: string) => void;
}

/**
 * علامات المقارنة تُرسم هنا بشكل صريح (اتجاه LTR ثابت) بدل الاعتماد على
 * انعكاس الرموز التلقائي في النص العربي.
 *
 * في السؤال يظهر العدد الأول على اليمين والثاني على اليسار (اتجاه القراءة).
 * فإذا كان الأول أصغر (القيمة "<") فالأكبر على اليسار، وفم العلامة يجب أن
 * يفتح نحو الأكبر — أي نحو اليسار — فيكون الشكل المرسوم ">" . والعكس صحيح.
 * هذا يطابق ما يعرضه «اكتشف» للطالبة.
 */
export function signGlyph(value: string): string {
  if (value === "<") return ">";
  if (value === ">") return "<";
  return value;
}

/** أعداد مفردة كبيرة؛ قوائم الترتيب والعبارات أصغر لتتّسع في عمودين على الجوال. */
function optionTextSize(option: string): string {
  return option.length > 9 ? "text-[17px] sm:text-2xl" : "text-2xl sm:text-3xl";
}

export const isSign = (value: string) => value === "<" || value === ">" || value === "=";

/** نص إجابة داخل جملة (مراجعة الأخطاء، رسالة التصحيح) — العلامات تُرسم بنفس قاعدة الاتجاه. */
export function AnswerText({ value }: { value: string }) {
  if (isSign(value)) {
    return (
      <span dir="ltr" className="font-kufi font-bold text-lg align-middle">
        {signGlyph(value)}
      </span>
    );
  }
  return <>{formatArabicText(value)}</>;
}

export default function QuizQuestion({
  question,
  selectedAnswer,
  pendingAnswer = null,
  onSelect,
}: QuizQuestionProps) {
  const revealed = selectedAnswer !== null;
  // الإجابة الصحيحة لا تصل المتصفح إلا بعد أن تجيب الطالبة (من الخادم).
  const correctAnswer = question.correctAnswer;
  const saving = pendingAnswer !== null;
  const wasCorrect = revealed && selectedAnswer === correctAnswer;

  return (
    <div className="w-full flex flex-col gap-4">
      <section className="w-full rounded-[28px] bg-sand-50 px-4 sm:px-8 pt-5 pb-6 sm:pt-6 sm:pb-8 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)] border-b-[6px] border-mortar flex flex-col items-center gap-4">
        <h2 className="text-sm sm:text-base font-bold text-ink-500 text-center">{question.prompt}</h2>
        <QuestionVisual question={question} correctAnswer={correctAnswer} revealed={revealed} wasCorrect={wasCorrect} />
      </section>

      <div role="group" aria-label="الخيارات" className="grid grid-cols-2 gap-3">
        {question.options.map((option, index) => {
          const isChosen = selectedAnswer === option;
          const isRightOption = revealed && option === correctAnswer;
          const isPending = pendingAnswer === option;

          let tone = "bg-sand-50 border-mortar text-ink-900 hover:bg-white active:translate-y-[3px] active:border-b-[3px]";
          let icon: ReactNode = null;

          if (isPending) {
            tone = "bg-white border-sun-400 text-ink-900";
          } else if (revealed) {
            if (isChosen && isRightOption) {
              tone = "bg-palm-100 border-palm-500 text-palm-700";
              icon = <CheckCircleIcon className="w-6 h-6 text-palm-600" />;
            } else if (isChosen) {
              tone = "bg-rose-50 border-rose-400 text-rose-600 animate-shake";
              icon = <XCircleIcon className="w-6 h-6 text-rose-500" />;
            } else if (isRightOption) {
              // بعد الخطأ نُظهر الجواب الصحيح لتتعلّم الطالبة منه.
              tone = "bg-palm-50 border-palm-400 text-palm-700";
              icon = <CheckCircleIcon className="w-6 h-6 text-palm-500" />;
            } else {
              tone = "bg-white/5 border-mortar/15 text-mortar/40";
            }
          }

          return (
            <button
              key={option}
              type="button"
              disabled={revealed || saving}
              onClick={() => onSelect(option)}
              aria-label={isSign(option) ? `العلامة ${option === "=" ? "يساوي" : option === "<" ? "أصغر من" : "أكبر من"}` : undefined}
              className={`relative flex items-center justify-center gap-2 min-h-[68px] rounded-2xl border-2 border-b-[6px] px-2.5 py-3 select-none transition-[transform,background-color,border-color,opacity] duration-150 disabled:cursor-default focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sun-400 focus-visible:outline-offset-2 ${tone}`}
            >
              <span className="absolute top-1.5 start-2.5 text-[11px] font-bold text-ink-400" aria-hidden="true">
                {OPTION_LETTERS[index] ?? index + 1}
              </span>
              {isSign(option) ? (
                <span dir="ltr" className="font-kufi font-bold text-4xl leading-none">
                  {signGlyph(option)}
                </span>
              ) : (
                <span className={`font-kufi font-bold leading-snug text-center ${optionTextSize(option)}`}>
                  {formatArabicText(option)}
                </span>
              )}
              {icon && <span className="shrink-0">{icon}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// الجزء المرئي من السؤال
// ---------------------------------------------------------------------------

function QuestionVisual({
  question,
  correctAnswer,
  revealed,
  wasCorrect,
}: {
  question: QuizQuestionData;
  correctAnswer: string | null;
  revealed: boolean;
  wasCorrect: boolean;
}) {
  const visual = question.visual;

  if (visual.kind === "number") {
    return <Numeral value={visual.value} large />;
  }

  if (visual.kind === "chips") {
    return (
      <div dir="rtl" className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
        {visual.numbers.map((n) => (
          <span
            key={n}
            className="min-w-[58px] text-center rounded-xl bg-brick-500 border-b-[5px] border-brick-700 px-3 py-1.5 font-kufi font-bold text-3xl sm:text-4xl leading-tight text-white shadow-sm"
          >
            {toArabicDigits(n)}
          </span>
        ))}
      </div>
    );
  }

  if (visual.kind === "compare") {
    return (
      <div dir="rtl" className="flex items-center justify-center gap-2 sm:gap-4">
        <Numeral value={visual.first} />
        <BlankBox revealed={revealed} wasCorrect={wasCorrect}>
          <span dir="ltr">{signGlyph(correctAnswer ?? "")}</span>
        </BlankBox>
        <Numeral value={visual.second} />
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex items-center justify-center gap-2 sm:gap-4">
      {visual.tokens.map((token, i) => (
        <ExpressionToken
          key={i}
          token={token}
          revealed={revealed}
          wasCorrect={wasCorrect}
          answer={correctAnswer ?? ""}
        />
      ))}
    </div>
  );
}

function Numeral({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <span
      className={`font-kufi font-bold leading-none text-ink-900 ${
        large ? "text-7xl sm:text-8xl py-1" : "text-4xl sm:text-6xl"
      }`}
    >
      {toArabicDigits(value)}
    </span>
  );
}

function ExpressionToken({
  token,
  revealed,
  wasCorrect,
  answer,
}: {
  token: QuizToken;
  revealed: boolean;
  wasCorrect: boolean;
  answer: string;
}) {
  if (token.kind === "num") return <Numeral value={token.value} />;
  if (token.kind === "op") {
    return (
      <span className="font-kufi font-bold text-3xl sm:text-5xl leading-none text-brick-500" aria-hidden="true">
        {token.symbol}
      </span>
    );
  }
  return (
    <BlankBox revealed={revealed} wasCorrect={wasCorrect}>
      {toArabicDigits(answer)}
    </BlankBox>
  );
}

/** خانة الجواب: «؟» ذهبية متقطعة، ثم تمتلئ بالجواب الصحيح بعد الإجابة. */
function BlankBox({
  revealed,
  wasCorrect,
  children,
}: {
  revealed: boolean;
  wasCorrect: boolean;
  children: ReactNode;
}) {
  if (!revealed) {
    return (
      <span
        className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl border-2 border-dashed border-sun-500 bg-sun-50 flex items-center justify-center font-kufi font-bold text-3xl sm:text-5xl leading-none text-sun-600 animate-glow-pulse"
        aria-label="مكان الجواب"
      >
        ؟
      </span>
    );
  }
  return (
    <span
      className={`min-w-14 sm:min-w-20 h-14 sm:h-20 px-2 rounded-2xl border-2 flex items-center justify-center font-kufi font-bold text-3xl sm:text-5xl leading-none ${
        wasCorrect ? "border-palm-500 bg-palm-50 text-palm-600" : "border-palm-400 bg-palm-50/70 text-palm-700"
      }`}
    >
      {children}
    </span>
  );
}
