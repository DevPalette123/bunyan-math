import iconDiscover from "../assets/icons/icon-discover.png";
import iconLessons from "../assets/icons/icon-lessons.png";
import iconPractice from "../assets/icons/icon-practice.png";
import iconPlay from "../assets/icons/icon-play.png";
import iconQuiz from "../assets/icons/icon-quiz.png";
import type { MainSection } from "./types";

export const motivationalLine = "كل خطوة صغيرة تصنع فرقًا كبيرًا!";

export const mainSections: MainSection[] = [
  {
    id: "discover",
    icon: iconDiscover,
    title: "اكتشف",
    description: "اكتشف مهاراتك واهتماماتك الرياضية",
    bgClass: "bg-sky-50",
    accentClass: "text-sky-500",
  },
  {
    id: "learn",
    icon: iconLessons,
    title: "تعلّم",
    description: "افهم كل درس خطوة بخطوة",
    bgClass: "bg-berry-50",
    accentClass: "text-berry-500",
  },
  {
    id: "practice",
    icon: iconPractice,
    title: "تدرّب",
    description: "حل التمارين وطوّر مهاراتك",
    bgClass: "bg-sun-50",
    accentClass: "text-sun-500",
  },
  {
    id: "play",
    icon: iconPlay,
    title: "العب",
    description: "ألعاب وتحديات رياضية ممتعة",
    bgClass: "bg-palm-50",
    accentClass: "text-palm-500",
  },
  {
    id: "quiz",
    icon: iconQuiz,
    title: "اختبر",
    description: "اختبر مهاراتك ومستواك",
    bgClass: "bg-rose-50",
    accentClass: "text-rose-500",
  },
];
