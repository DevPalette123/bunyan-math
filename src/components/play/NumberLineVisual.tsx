import type { GameVisual } from "../../lib/games";
import type { GameTheme } from "../../data/playGameThemes";
import { toArabicDigits } from "../../utils/arabicNumerals";

interface NumberLineVisualProps {
  visual: Extract<GameVisual, { kind: "numberLine" }>;
  theme: GameTheme;
  revealed: boolean;
  correctAnswer: string | null;
}

/**
 * سؤال التقريب: خط أعداد بين الحدّين الأقرب (أصغر وأكبر)، مع منطاد يحمل العدد
 * فوق موضعه الحقيقي على الخط — بصريًا مختلف تمامًا عن معادلة الجمع/الطرح.
 * الاتجاه عربي: الحد الأصغر يمين الخط والأكبر يساره (خط أعداد RTL).
 */
export default function NumberLineVisual({ visual, theme, revealed, correctAnswer }: NumberLineVisualProps) {
  const { value, lower, upper, unit } = visual;
  // موضع العدد على الخط بنسبة مئوية من اليمين (الأصغر) إلى اليسار (الأكبر).
  const percentFromLower = ((value - lower) / (upper - lower)) * 100;

  return (
    <div dir="rtl" className="w-full flex flex-col items-center gap-5">
      <p className="text-sm sm:text-base font-extrabold text-ink-500">
        قرّبي العدد <span style={{ color: theme.scene.accentDark }}>{toArabicDigits(value)}</span> لأقرب{" "}
        {unit === 10 ? "عشرة" : "مئة"}
      </p>

      <div className="relative w-full max-w-sm h-24 sm:h-28">
        {/* الخط والحدّان */}
        <div className="absolute inset-x-3 top-14 h-1.5 rounded-full bg-sand-200" />
        <div
          className="absolute top-14 w-3 h-3 rounded-full -translate-y-1/2"
          style={{ right: "4px", backgroundColor: theme.scene.accentDark }}
        />
        <div
          className="absolute top-14 w-3 h-3 rounded-full -translate-y-1/2"
          style={{ left: "4px", backgroundColor: theme.scene.accentDark }}
        />
        <span className="absolute top-[74px] right-0 text-lg sm:text-xl font-extrabold text-ink-700 tabular-nums">
          {toArabicDigits(lower)}
        </span>
        <span className="absolute top-[74px] left-0 text-lg sm:text-xl font-extrabold text-ink-700 tabular-nums">
          {toArabicDigits(upper)}
        </span>

        {/* المنطاد فوق موضع العدد */}
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center animate-mascot-float"
          style={{ right: `calc(${percentFromLower}% - 0px)`, transform: "translateX(50%)" }}
        >
          <div
            className="w-11 h-14 sm:w-12 sm:h-16 rounded-[45%_45%_45%_45%/60%_60%_40%_40%] flex items-center justify-center shadow-md tabular-nums font-extrabold text-white text-sm sm:text-base"
            style={{ backgroundColor: theme.scene.accent }}
          >
            {toArabicDigits(value)}
          </div>
          <svg width="6" height="18" className="-mt-0.5">
            <line x1="3" y1="0" x2="3" y2="18" stroke={theme.scene.accentDark} strokeWidth="2" />
          </svg>
        </div>
      </div>

      {revealed && (
        <p className="text-sm font-extrabold" style={{ color: theme.scene.accentDark }}>
          الإجابة الصحيحة: {toArabicDigits(correctAnswer ?? "")}
        </p>
      )}
    </div>
  );
}
