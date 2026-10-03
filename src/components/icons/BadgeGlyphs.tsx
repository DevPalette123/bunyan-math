interface BadgeIconProps {
  className?: string;
}

/** "متميز" — distinguished/excellence medal. */
export function MedalBadgeIcon({ className = "w-8 h-8" }: BadgeIconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <path d="M14 4h12l5 9-11 15L9 13z" fill="#F0B94A" opacity="0.55" />
      <circle cx="20" cy="24" r="11" fill="#F5C765" />
      <circle cx="20" cy="24" r="7.5" fill="#FBE3AE" />
      <path
        d="M20 19.5l1.5 3.2 3.5.4-2.6 2.4.7 3.5-3.1-1.8-3.1 1.8.7-3.5-2.6-2.4 3.5-.4z"
        fill="#E3A422"
      />
    </svg>
  );
}

/** "بداية قوية" — strong start sprout. */
export function SproutBadgeIcon({ className = "w-8 h-8" }: BadgeIconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <ellipse cx="20" cy="33" rx="11" ry="3" fill="#CFE9D8" />
      <path d="M20 33V19" stroke="#3E9C6B" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M20 22c0-5.5-4.5-8-9-7.5C11.3 19.3 14.6 22.6 20 22z"
        fill="#3E9C6B"
      />
      <path
        d="M20 19c0-6 5-9 10-8.5C29.4 16 25.7 19.6 20 19z"
        fill="#1F7A4D"
      />
    </svg>
  );
}

/** "نجم الأسبوع" — star of the week. */
export function StarBadgeIcon({ className = "w-8 h-8" }: BadgeIconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <circle cx="20" cy="20" r="15" fill="#FBE3AE" opacity="0.6" />
      <path
        d="M20 7l3.6 8 8.4.9-6.3 5.9 1.7 8.3L20 26l-7.4 4.1 1.7-8.3-6.3-5.9 8.4-.9z"
        fill="#E3A422"
      />
    </svg>
  );
}

/** "لاعبة ماهرة" — skilled player, for العب badges. */
export function RocketBadgeIcon({ className = "w-8 h-8" }: BadgeIconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <circle cx="20" cy="20" r="15" fill="#D7E8F5" opacity="0.6" />
      <path d="M20 6c5 3 6.5 9 6.5 15.5 0 3-1.2 5.7-3 7.7l-3.5 2.3-3.5-2.3c-1.8-2-3-4.7-3-7.7C13.5 15 15 9 20 6z" fill="#5BA9D6" />
      <circle cx="20" cy="18.5" r="3.4" fill="#EAF6FB" />
      <path d="M14 26l-3.5 6 6.2-2.8z" fill="#1F5F86" />
      <path d="M26 26l3.5 6-6.2-2.8z" fill="#1F5F86" />
      <path d="M18 31.5l2 5 2-5z" fill="#F0B94A" />
    </svg>
  );
}

/** "منظّمة التدريب" — diligent worksheet practice, for تدرّب badges. */
export function PencilBadgeIcon({ className = "w-8 h-8" }: BadgeIconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <circle cx="20" cy="20" r="15" fill="#F3EBF7" opacity="0.6" />
      <path d="M15 29l1-6.5L25.5 12l5.5 5.5L20.5 28z" fill="#A570C2" />
      <path d="M25.5 12l3-3a3 3 0 0 1 4.2 4.2l-1.7 1.8z" fill="#6F428A" />
      <path d="M15 29l-3.5 1 1-3.5z" fill="#E3A422" />
    </svg>
  );
}
