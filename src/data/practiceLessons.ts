import iconAddition from "../assets/icons/practice/addition.png";
import iconSubtraction from "../assets/icons/practice/subtraction.png";
import iconRounding from "../assets/icons/practice/rounding.png";
import iconDoubling from "../assets/icons/practice/doubling.png";
import iconAscending from "../assets/icons/practice/ascending-order.png";
import iconDescending from "../assets/icons/practice/descending-order.png";
import iconComparison from "../assets/icons/practice/comparison.png";
import iconEvenOdd from "../assets/icons/practice/even-odd.png";

export interface PracticeLesson {
  /** Same id used across the project for this skill (lessons.ts, discover.ts). */
  id: string;
  title: string;
  icon: string;
  /** Served from /public/worksheets — see that folder's README.md for the
   * exact filename each card expects. Swapping the physical file later
   * requires no code change at all. */
  pdfUrl: string;
}

// Exactly the same 8 skills as "تعلّم" and "اكتشف", same order, same ids —
// on purpose, so the three sections always refer to the same 8 things.
export const practiceLessons: PracticeLesson[] = [
  { id: "addition", title: "الجمع", icon: iconAddition, pdfUrl: "/worksheets/addition.pdf" },
  { id: "subtraction", title: "الطرح", icon: iconSubtraction, pdfUrl: "/worksheets/subtraction.pdf" },
  { id: "rounding", title: "التقريب", icon: iconRounding, pdfUrl: "/worksheets/rounding.pdf" },
  { id: "doubling", title: "الضعف", icon: iconDoubling, pdfUrl: "/worksheets/doubling.pdf" },
  {
    id: "ascending-order",
    title: "الترتيب التصاعدي",
    icon: iconAscending,
    pdfUrl: "/worksheets/ascending-order.pdf",
  },
  {
    id: "descending-order",
    title: "الترتيب التنازلي",
    icon: iconDescending,
    pdfUrl: "/worksheets/descending-order.pdf",
  },
  { id: "comparison", title: "المقارنة", icon: iconComparison, pdfUrl: "/worksheets/comparison.pdf" },
  { id: "even-odd", title: "العدد الزوجي والفردي", icon: iconEvenOdd, pdfUrl: "/worksheets/even-odd.pdf" },
];
