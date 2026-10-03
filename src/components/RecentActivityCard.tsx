import iconPractice from "../assets/icons/icon-practice.png";
import iconLessons from "../assets/icons/icon-lessons.png";
import iconBadges from "../assets/icons/icon-badges.png";
import iconDiscover from "../assets/icons/icon-discover.png";
import iconQuiz from "../assets/icons/icon-quiz.png";
import iconPlay from "../assets/icons/icon-play.png";
import iconIdentityHomeland from "../assets/icons/icon-identity-homeland.png";
import type { ActivityIconKey, ActivityItem } from "../data/types";
import { ClockIcon } from "./icons/Glyphs";

interface RecentActivityCardProps {
  items: ActivityItem[];
}

const ACTIVITY_ICON: Record<ActivityIconKey, string> = {
  practice: iconPractice,
  lessons: iconLessons,
  badges: iconBadges,
  discover: iconDiscover,
  quiz: iconQuiz,
  play: iconPlay,
  initiatives: iconIdentityHomeland,
};

export default function RecentActivityCard({ items }: RecentActivityCardProps) {
  return (
    <div className="bg-white rounded-3xl shadow-soft p-5 sm:p-6 flex flex-col h-full">
      <h3 className="text-lg font-extrabold text-ink-900 mb-4">آخر نشاط</h3>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
          <ClockIcon className="w-8 h-8 text-ink-300" />
          <p className="text-sm font-bold text-ink-700">ستظهر أنشطتك هنا عندما تبدأ رحلتك.</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {items.map((item, index) => (
            <li key={item.id}>
              <div className="w-full flex items-center gap-3 py-2.5">
                <span className="w-10 h-10 rounded-2xl bg-sand-100 flex items-center justify-center shrink-0">
                  <img src={ACTIVITY_ICON[item.iconKey]} alt="" className="w-6 h-6 object-contain" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-ink-900 truncate">{item.title}</span>
                  <span className="flex items-center gap-1 text-[11px] text-ink-500 mt-0.5">
                    <ClockIcon className="w-3 h-3" />
                    {item.timeAgo}
                  </span>
                </span>
              </div>
              {index < items.length - 1 && <div className="h-px bg-sand-100" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
