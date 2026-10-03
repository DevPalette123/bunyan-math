interface GemTrailProps {
  total: number;
  /** true = صحيحة، false = خاطئة، undefined = لم تُجب بعد. */
  results: (boolean | undefined)[];
  currentIndex: number;
  color: string;
  label: string;
}

/**
 * شريط عشر جواهر أفقي — بديل «ألعب» عن برج «اختبر»: نفس فكرة التقدّم المرئي
 * (شيء يتراكم مع كل إجابة صحيحة) لكن بصورة مختلفة تمامًا حتى لا تبدو اللعبة
 * كأنها «اختبر» بثوب آخر.
 */
export default function GemTrail({ total, results, currentIndex, color, label }: GemTrailProps) {
  return (
    <div className="w-full flex items-center justify-center gap-1.5 sm:gap-2" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => {
        const state = results[i];
        const isCurrent = i === currentIndex && state === undefined;
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 transition-transform ${
              state === true ? "animate-gem-pop" : ""
            } ${isCurrent ? "scale-110" : ""}`}
          >
            <path
              d="M12 2.5l4.6 3.2H19l3 5-10 10.8L2 10.7l3-5h2.4L12 2.5z"
              fill={state === true ? color : state === false ? "#F3D9DE" : "#E7E4DC"}
              stroke={isCurrent ? color : "transparent"}
              strokeWidth="1.6"
              opacity={state === false ? 0.7 : 1}
            />
            {state === false && (
              <path d="M9 9l6 6M15 9l-6 6" stroke="#D6486E" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        );
      })}
    </div>
  );
}
