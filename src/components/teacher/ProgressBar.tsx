interface ProgressBarProps {
  percent: number;
  className?: string;
  /** لون الشريط (افتراضيًا أخضر هادئ). */
  barClassName?: string;
}

export default function ProgressBar({ percent, className = "", barClassName = "bg-gradient-to-l from-mint-400 to-mint-500" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`h-2.5 rounded-full bg-slate-100 overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${barClassName}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
