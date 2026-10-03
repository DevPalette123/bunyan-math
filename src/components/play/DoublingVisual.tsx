import type { GameVisual } from "../../lib/games";
import type { GameTheme } from "../../data/playGameThemes";
import { toArabicDigits } from "../../utils/arabicNumerals";

interface DoublingVisualProps {
  visual: Extract<GameVisual, { kind: "doublingPods" }>;
  theme: GameTheme;
  revealed: boolean;
  correctAnswer: string | null;
}

/**
 * سؤال الضعف: جراب واحد فيه العدد، ثم ينقسم إلى جرابين متطابقين — تمثيل بصري
 * لمعنى «الضعف» (نسختان متماثلتان)، مختلف تمامًا عن شكل معادلة الجمع/الطرح.
 */
export default function DoublingVisual({ visual, theme, revealed, correctAnswer }: DoublingVisualProps) {
  const { value } = visual;

  const Pod = ({ big = false }: { big?: boolean }) => (
    <div
      className={`${
        big ? "w-20 h-24 sm:w-24 sm:h-28 text-3xl sm:text-4xl" : "w-14 h-16 sm:w-16 sm:h-20 text-xl sm:text-2xl"
      } rounded-[45%_45%_45%_45%/55%_55%_45%_45%] flex items-center justify-center font-extrabold text-white tabular-nums shadow-md animate-gem-pop`}
      style={{ backgroundColor: theme.scene.accent }}
    >
      {toArabicDigits(value)}
    </div>
  );

  return (
    <div dir="rtl" className="w-full flex flex-col items-center gap-4">
      <p className="text-sm sm:text-base font-extrabold text-ink-500">أوجدي ضعف العدد</p>
      <div className="flex items-center gap-3 sm:gap-4">
        <Pod big />
        <span className="font-extrabold text-2xl sm:text-3xl text-ink-300">←</span>
        <div className="flex items-center gap-1.5">
          <Pod />
          <Pod />
        </div>
        <span className="font-extrabold text-2xl sm:text-3xl text-ink-300">=</span>
        {revealed ? (
          <span
            className="min-w-[1.6em] text-center font-extrabold text-3xl sm:text-4xl tabular-nums"
            style={{ color: theme.scene.accentDark }}
          >
            {toArabicDigits(correctAnswer ?? "")}
          </span>
        ) : (
          <span className="min-w-[1.2em] text-center font-extrabold text-3xl sm:text-4xl text-sun-500">؟</span>
        )}
      </div>
    </div>
  );
}
