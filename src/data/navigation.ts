import iconHome from "../assets/icons/icon-home.png";
import iconLessons from "../assets/icons/icon-lessons.png";
import iconDiscover from "../assets/icons/icon-discover.png";
import iconPractice from "../assets/icons/icon-practice.png";
import iconPlay from "../assets/icons/icon-play.png";
import iconQuiz from "../assets/icons/icon-quiz.png";
import iconBadges from "../assets/icons/icon-badges.png";
import iconSettings from "../assets/icons/icon-settings.png";
import iconIdentityHomeland from "../assets/icons/icon-identity-homeland.png";
import iconDigitalLeader from "../assets/icons/icon-digital-leader.png";
import iconSkillsGrowth from "../assets/icons/icon-skills-growth.png";

export interface NavItem {
  id: string;
  icon: string;
  label: string;
}

export const navItems: NavItem[] = [
  { id: "home", icon: iconHome, label: "الرئيسية" },
  { id: "learn", icon: iconLessons, label: "تعلّم" },
  { id: "discover", icon: iconDiscover, label: "اكتشف" },
  { id: "practice", icon: iconPractice, label: "تدرّب" },
  { id: "play", icon: iconPlay, label: "العب" },
  { id: "quiz", icon: iconQuiz, label: "اختبر" },
  { id: "badges", icon: iconBadges, label: "شاراتي" },
  { id: "identity-homeland", icon: iconIdentityHomeland, label: "هويتي ووطني" },
  { id: "digital-leader", icon: iconDigitalLeader, label: "مبادرة القائد الرقمي" },
  { id: "skills-growth", icon: iconSkillsGrowth, label: "تنمية المهارات النمائية" },
];

export const settingsNavItem: NavItem = {
  id: "settings",
  icon: iconSettings,
  label: "الإعدادات",
};

// Single source of truth for "not built yet" sections — read by the home
// page cards (MainSections) and both nav components (Sidebar, MobileNav) so
// all three stay in sync without duplicating this list.
export const COMING_SOON_IDS: string[] = [];
