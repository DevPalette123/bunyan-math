// أيقونات خاصة بـ«اختبر» — بنفس أسلوب Glyphs.tsx (SVG بلا مكتبات).

interface IconProps {
  className?: string;
}

/** لهب — سلسلة الإجابات الصحيحة المتتالية. */
export function FlameIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12.4 2.2c.5 3-1.2 4.6-2.8 6.4C8 10.4 6.5 12.2 6.5 14.9a5.5 5.5 0 0 0 11 0c0-2.2-1-3.8-2.2-5.1-.3 1.1-.9 1.8-1.7 2.1.6-3.7-.1-7.2-1.2-9.7Z"
        fill="currentColor"
      />
      <path
        d="M12 21.5a3 3 0 0 1-3-3c0-1.6 1-2.6 2-3.6.4 1 1 1.5 1.6 1.7.9.8 1.4 1.7 1.4 2.5a3 3 0 0 1-2 2.4Z"
        fill="#FFF3C4"
      />
    </svg>
  );
}

/** مكبّر صوت يعمل. */
export function SoundOnIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 9.5v5h3.5l4.5 3.8V5.7L7.5 9.5H4Z" fill="currentColor" />
      <path
        d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** مكبّر صوت مكتوم. */
export function SoundOffIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 9.5v5h3.5l4.5 3.8V5.7L7.5 9.5H4Z" fill="currentColor" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** سهم دائري — إعادة الاختبار بأرقام جديدة. */
export function RedoIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M19.8 3.8v4.4h-4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
