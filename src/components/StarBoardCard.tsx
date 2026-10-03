import { useEffect, useState } from "react";
import { toArabicDigits } from "../utils/arabicNumerals";

// بطاقة «لوحة النجوم المرحة» في رئيسية الطالبة: تعرض عدد النجوم التي منحتها
// المعلمة لها على اللوحة الصفّية. الرقم هنا هو نفسه الرقم الحقيقي القادم من
// star_board_entries (fetchMyStarCount) — لا نُنشئ أي رقم من عندنا.

interface StarBoardCardProps {
  count: number;
}

const STAR_PATH = "M0 -30 L9 -10 L30 -8 L14 6 L19 28 L0 16 L-19 28 L-14 6 L-30 -8 L-9 -10 Z";
const SLOTS = 10;

function pluralWord(n: number): string {
  if (n === 1) return "نجمة";
  if (n === 2) return "نجمتان";
  if (n >= 3 && n <= 10) return "نجوم";
  return "نجمة";
}

function messageFor(n: number): string {
  if (n === 0) return "لم تصلكِ نجمة بعد. شاركي وتعاوني مع زميلاتكِ، وستضيء معلمتكِ أول نجومكِ!";
  if (n < 5) return "بداية جميلة! كل نجمة تعني أنكِ تميّزتِ في الصف.";
  if (n < 10) return "ما شاء الله! نجومكِ تزداد يومًا بعد يوم.";
  return "أنتِ من نجمات الصف اللامعات، استمري!";
}

/** عدّاد يصعد من ٠ إلى الرقم الحقيقي مرة واحدة عند ظهور البطاقة. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = Math.min(1400, 350 + target * 70);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export default function StarBoardCard({ count }: StarBoardCardProps) {
  const shown = useCountUp(count);
  const lit = Math.min(count, SLOTS);
  const extra = count - SLOTS;

  return (
    <section
      aria-label={`لديكِ ${count} ${pluralWord(count)} على لوحة النجوم المرحة`}
      className="relative overflow-hidden rounded-3xl shadow-soft animate-pop-in [animation-delay:420ms]"
      style={{ background: "linear-gradient(120deg,#FFF3CF 0%,#FFF9E8 55%,#FFFFFF 100%)" }}
    >
      <style>{`
        @keyframes sbc-bob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-6px) rotate(3deg)}}
        @keyframes sbc-glow{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.75;transform:scale(1.12)}}
        @keyframes sbc-twinkle{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes sbc-pop{0%{opacity:0;transform:scale(.2) rotate(-40deg)}70%{transform:scale(1.25) rotate(8deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
        .sbc-bob{animation:sbc-bob 3.2s ease-in-out infinite}
        .sbc-glow{animation:sbc-glow 2.6s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
        .sbc-twinkle{animation:sbc-twinkle 2s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
        .sbc-pop{animation:sbc-pop .55s cubic-bezier(.16,1,.3,1) both}
      `}</style>

      {/* نقاط ضوء خفيفة في الخلفية */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 400 120">
        <g fill="#F0B94A">
          <circle className="sbc-twinkle" cx="120" cy="26" r="3" />
          <circle className="sbc-twinkle" style={{ animationDelay: ".7s" }} cx="210" cy="96" r="2.5" />
          <circle className="sbc-twinkle" style={{ animationDelay: "1.3s" }} cx="330" cy="30" r="3" />
          <circle className="sbc-twinkle" style={{ animationDelay: "1.9s" }} cx="378" cy="88" r="2" />
        </g>
      </svg>

      <div className="relative flex items-center gap-4 sm:gap-6 p-4 sm:p-6">
        {/* النجمة الكبيرة المبتسمة */}
        <div className="sbc-bob shrink-0 w-24 h-24 sm:w-28 sm:h-28">
          <svg viewBox="-50 -50 100 100" className="w-full h-full overflow-visible" aria-hidden="true">
            <circle className="sbc-glow" r="42" fill="#F0B94A" opacity="0.35" />
            <path d={STAR_PATH} transform="scale(1.32)" fill="#F0B94A" stroke="#E3A422" strokeWidth="5" strokeLinejoin="round" />
            <path d="M-12 -22 L-4 -30" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.65" transform="scale(1.32)" />
            <g fill="#1F2A24">
              <ellipse cx="-9" cy="-2" rx="3.2" ry="4.2" />
              <ellipse cx="9" cy="-2" rx="3.2" ry="4.2" />
            </g>
            <circle cx="-8" cy="-3.6" r="1.1" fill="#fff" />
            <circle cx="10" cy="-3.6" r="1.1" fill="#fff" />
            <ellipse cx="-17" cy="7" rx="4.5" ry="3" fill="#E86E8F" opacity="0.6" />
            <ellipse cx="17" cy="7" rx="4.5" ry="3" fill="#E86E8F" opacity="0.6" />
            <path d="M-6 8 Q0 15 6 8" stroke="#1F2A24" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h3 className="text-sm sm:text-base font-extrabold text-sun-600">لوحة النجوم المرحة</h3>

          <div className="flex items-baseline gap-2">
            <span className="font-kufi text-5xl sm:text-6xl font-extrabold text-ink-900 leading-none tabular-nums">
              {toArabicDigits(shown)}
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-sun-600">{pluralWord(count)}</span>
          </div>

          <p className="text-xs sm:text-sm font-bold text-ink-500 leading-relaxed max-w-md">{messageFor(count)}</p>

          {/* شريط النجوم: تضيء بعدد نجوم الطالبة (حتى ١٠) */}
          <div className="flex items-center gap-1 sm:gap-1.5 mt-1" aria-hidden="true">
            {Array.from({ length: SLOTS }).map((_, i) => {
              const on = i < lit;
              return (
                <svg
                  key={i}
                  viewBox="-34 -34 68 68"
                  className={`w-5 h-5 sm:w-6 sm:h-6 ${on ? "sbc-pop" : ""}`}
                  style={on ? { animationDelay: `${500 + i * 90}ms` } : undefined}
                >
                  <path
                    d={STAR_PATH}
                    fill={on ? "#F0B94A" : "#EDE3D0"}
                    stroke={on ? "#E3A422" : "#E2D6BE"}
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                </svg>
              );
            })}
            {extra > 0 && (
              <span className="text-xs font-extrabold text-sun-600 ms-1">+{toArabicDigits(extra)}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
