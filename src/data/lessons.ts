import iconAddition from "../assets/icons/lessons/addition.png";
import iconSubtraction from "../assets/icons/lessons/subtraction.png";
import iconRounding from "../assets/icons/lessons/rounding.png";
import iconDoubling from "../assets/icons/lessons/doubling.png";
import iconAscending from "../assets/icons/lessons/ascending-order.png";
import iconDescending from "../assets/icons/lessons/descending-order.png";
import iconComparison from "../assets/icons/lessons/comparison.png";
import iconEvenOdd from "../assets/icons/lessons/even-odd.png";

export type LessonVideo =
  | { type: "youtube"; youtubeId: string }
  | { type: "local"; src: string };

export interface Lesson {
  /** Also the route segment: /learn/:id */
  id: string;
  title: string;
  icon: string;
  description: string;
  video: LessonVideo;
}

// Exactly 8 lessons, on purpose — multiplication/tens-pairs/hundreds-pairs
// were removed entirely (data, icon imports, and their routes) in an
// earlier pass and must stay out.
export const lessons: Lesson[] = [
  {
    id: "addition",
    title: "الجمع",
    icon: iconAddition,
    description: "اجمع الأعداد خطوة بخطوة",
    video: { type: "youtube", youtubeId: "PFtAhUBhKeU" },
  },
  {
    id: "subtraction",
    title: "الطرح",
    icon: iconSubtraction,
    description: "تعلّم طرح الأعداد بسهولة",
    video: { type: "youtube", youtubeId: "Ow9AD5hM1vc" },
  },
  {
    id: "rounding",
    title: "التقريب",
    icon: iconRounding,
    description: "قرّب الأعداد لأقرب عشرة أو مئة",
    // Local file the teacher/owner adds themselves — see public/videos/README.md
    video: { type: "local", src: "/videos/rounding.mp4" },
  },
  {
    id: "doubling",
    title: "الضعف",
    icon: iconDoubling,
    description: "تعرّف على ضعف الأعداد",
    video: { type: "youtube", youtubeId: "PR1v-P8pi-g" },
  },
  {
    id: "ascending-order",
    title: "الترتيب التصاعدي",
    icon: iconAscending,
    description: "رتّب الأعداد من الأصغر إلى الأكبر",
    video: { type: "local", src: "/videos/ascending-order.mp4" },
  },
  {
    id: "descending-order",
    title: "الترتيب التنازلي",
    icon: iconDescending,
    description: "رتّب الأعداد من الأكبر إلى الأصغر",
    video: { type: "local", src: "/videos/descending-order.mp4" },
  },
  {
    id: "comparison",
    title: "المقارنة",
    icon: iconComparison,
    description: "قارن بين الأعداد بسهولة",
    video: { type: "local", src: "/videos/comparison.mp4" },
  },
  {
    id: "even-odd",
    title: "العدد الزوجي والفردي",
    icon: iconEvenOdd,
    description: "فرّق بين الأعداد الزوجية والفردية",
    video: { type: "youtube", youtubeId: "-e-JneRlcDQ" },
  },
];

export function getLessonById(id: string | undefined): Lesson | undefined {
  return lessons.find((lesson) => lesson.id === id);
}
