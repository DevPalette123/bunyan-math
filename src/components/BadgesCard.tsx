import type { Badge, BadgeKind } from "../data/types";
import { toArabicDigits } from "../utils/arabicNumerals";
import { MedalBadgeIcon, SproutBadgeIcon, StarBadgeIcon } from "./icons/BadgeGlyphs";
import { ChevronIcon } from "./icons/Glyphs";

interface BadgesCardProps {
  badges: Badge[];
  totalEarned: number;
  onViewAll: () => void;
}

const BADGE_ICON: Record<BadgeKind, typeof MedalBadgeIcon> = {
  medal: MedalBadgeIcon,
  sprout: SproutBadgeIcon,
  star: StarBadgeIcon,
};

export default function BadgesCard({ badges, totalEarned, onViewAll }: BadgesCardProps) {
  return (
    <div className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-extrabold text-ink-900">شاراتي</h3>
        {badges.length > 0 && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs font-bold text-palm-600 hover:underline"
          >
            عرض كل شاراتي
            <ChevronIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {badges.length === 0 ? (
        <button
          onClick={onViewAll}
          className="w-full flex flex-col items-center text-center gap-2 py-6 hover:opacity-80 transition-opacity"
        >
          <StarBadgeIcon className="w-10 h-10 opacity-60" />
          <p className="text-sm font-bold text-ink-700">رحلتك نحو أول شارة تبدأ الآن ✨</p>
        </button>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {badges.map((badge) => {
              const BadgeGlyph = BADGE_ICON[badge.kind];
              return (
                <div
                  key={badge.id}
                  className="flex flex-col items-center gap-2 bg-sun-50 rounded-2xl py-4 px-2 hover:-translate-y-0.5 transition-transform duration-200"
                >
                  <BadgeGlyph className="w-9 h-9" />
                  <span className="text-[11px] font-extrabold text-ink-700 text-center leading-tight">
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-rose-50 rounded-2xl px-4 py-3 text-xs font-bold text-ink-700 text-center">
            لديك {toArabicDigits(totalEarned)} شارة حتى الآن
          </div>
        </>
      )}
    </div>
  );
}
