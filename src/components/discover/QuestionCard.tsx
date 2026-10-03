import { formatArabicText, OPTION_LETTERS } from "../../lib/discover";
import { CheckCircleIcon, XCircleIcon } from "../icons/Glyphs";

interface QuestionCardProps {
  question: string;
  options: string[];
  selectedAnswer: string | null;
  /** null until the student has answered this question. */
  isCorrect: boolean | null;
  disabled: boolean;
  onSelect: (option: string) => void;
}

export default function QuestionCard({
  question,
  options,
  selectedAnswer,
  isCorrect,
  disabled,
  onSelect,
}: QuestionCardProps) {
  return (
    <div className="w-full bg-white rounded-3xl shadow-soft p-6 sm:p-7 flex flex-col gap-5 animate-pop-in">
      <p className="text-lg sm:text-xl font-extrabold text-ink-900 text-center leading-relaxed">
        {formatArabicText(question)}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option, index) => {
          const isSelected = selectedAnswer === option;
          const showFeedback = isSelected && isCorrect !== null;

          let stateClass =
            "border-sand-200 bg-sand-50 hover:bg-sand-100 hover:-translate-y-0.5 text-ink-900";
          if (showFeedback) {
            stateClass = isCorrect
              ? "border-palm-500 bg-palm-50 text-palm-700"
              : "border-rose-400 bg-rose-50 text-rose-600";
          } else if (isSelected) {
            stateClass = "border-berry-400 bg-berry-50 text-berry-700";
          }

          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option)}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-start font-extrabold text-sm sm:text-base transition-all duration-200 disabled:cursor-default ${stateClass}`}
            >
              <span className="w-8 h-8 rounded-xl bg-white/80 flex items-center justify-center shrink-0 text-xs font-extrabold text-ink-500">
                {OPTION_LETTERS[index] ?? index + 1}
              </span>
              <span className="flex-1">{formatArabicText(option)}</span>
              {showFeedback &&
                (isCorrect ? (
                  <CheckCircleIcon className="w-5 h-5 text-palm-600 shrink-0" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-rose-500 shrink-0" />
                ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
