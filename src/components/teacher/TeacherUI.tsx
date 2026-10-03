import type { ReactNode } from "react";

/** ترويسة موحّدة لكل قسم: أيقونة ملوّنة + عنوان + وصف قصير + إجراء اختياري. */
export function SectionHeader({
  icon,
  tone = "teach",
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  tone?: "teach" | "mint" | "sun" | "lilac" | "rose";
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${TONE_SOFT[tone]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs font-bold text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export const TONE_SOFT = {
  teach: "bg-teach-50 text-teach-500",
  mint: "bg-mint-50 text-mint-600",
  sun: "bg-sun-50 text-sun-500",
  lilac: "bg-lilac-50 text-lilac-500",
  rose: "bg-rose-50 text-rose-500",
} as const;

/** بطاقة إحصاء صغيرة: رقم كبير + عنوان. */
export function StatTile({
  tone,
  value,
  label,
  suffix,
  small = false,
}: {
  tone: "teach" | "mint" | "sun" | "lilac" | "rose";
  value: ReactNode;
  label: string;
  suffix?: ReactNode;
  small?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 text-center ${TONE_SOFT[tone]}`}>
      <p className={`${small ? "text-sm sm:text-base" : "text-2xl"} font-extrabold leading-tight truncate`}>
        {value}
        {suffix}
      </p>
      <p className="text-[11px] font-bold text-slate-500 mt-1">{label}</p>
    </div>
  );
}

/** حالة فارغة لطيفة بدل سطر نصّي مجرّد. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-10 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60">
      <span className="w-14 h-14 rounded-3xl bg-white shadow-soft text-teach-400 flex items-center justify-center">
        {icon}
      </span>
      <div>
        <p className="text-sm font-extrabold text-slate-700">{title}</p>
        {hint && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** دائرة نسبة مئوية صغيرة (SVG) للنتائج. */
export function PercentRing({
  percent,
  size = 56,
  stroke = 6,
  color = "#3E9C82",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * clamped) / 100}
        style={{ transition: "stroke-dashoffset 600ms ease-out" }}
      />
    </svg>
  );
}

/** لون الحلقة حسب المستوى. */
export function levelColor(level: string): string {
  switch (level) {
    case "متقن":
      return "#3E9C82";
    case "جيد":
      return "#E3A422";
    case "في طور التقدم":
      return "#3E6478";
    default:
      return "#D6486E";
  }
}
