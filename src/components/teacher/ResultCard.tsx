import type { ReactNode } from "react";
import { toArabicDigits } from "../../utils/arabicNumerals";
import Avatar from "./Avatar";
import { PercentRing, levelColor } from "./TeacherUI";

export const LEVEL_CLASS: Record<string, string> = {
  "متقن": "bg-mint-50 text-mint-600",
  "جيد": "bg-sun-50 text-sun-600",
  "في طور التقدم": "bg-teach-50 text-teach-600",
  "يحتاج إلى تأسيس": "bg-rose-50 text-rose-500",
};

/** بطاقة نتيجة طالب: حلقة نسبة + اسم + مستوى + زر التفاصيل. */
export default function ResultCard({
  name,
  meta,
  percent,
  score,
  level,
  onDetails,
}: {
  name: string;
  meta?: ReactNode;
  percent: number;
  score: string;
  level: string;
  onDetails: () => void;
}) {
  return (
    <li className="flex flex-col gap-3.5 bg-slate-50/70 border border-slate-100 rounded-3xl p-4 hover:shadow-card hover:bg-white transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={name} className="w-11 h-11 text-base" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-900 truncate">{name}</p>
          {meta && <div className="text-[11px] font-bold text-slate-400 mt-0.5">{meta}</div>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14 shrink-0">
          <PercentRing percent={percent} size={56} color={levelColor(level)} />
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-slate-800">
            {toArabicDigits(percent)}٪
          </span>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <span
            className={`self-start text-[11px] font-extrabold px-2.5 py-1 rounded-full ${LEVEL_CLASS[level] ?? "bg-slate-100 text-slate-600"}`}
          >
            {level}
          </span>
          <span className="text-xs font-bold text-slate-500">الإجابات الصحيحة: {score}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onDetails}
        className="text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-xl py-2.5 transition-colors"
      >
        التفاصيل
      </button>
    </li>
  );
}
