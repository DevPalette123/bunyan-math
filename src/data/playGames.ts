import iconAddition from "../assets/icons/play/addition.png";
import iconSubtraction from "../assets/icons/play/subtraction.png";
import iconRounding from "../assets/icons/play/rounding.png";
import iconDoubling from "../assets/icons/play/doubling.png";
import iconAscending from "../assets/icons/play/ascending-order.png";
import iconDescending from "../assets/icons/play/descending-order.png";
import iconComparison from "../assets/icons/play/comparison.png";
import iconEvenOdd from "../assets/icons/play/even-odd.png";

export interface PlayGame {
  /** Same id used across the project for this skill (lessons.ts, discover.ts,
   * practiceLessons.ts). */
  id: string;
  title: string;
  icon: string;
  /** Served from /public/games — see that folder's README.md for the exact
   * filename each card expects. Swapping the file later, or pointing this
   * at an external game URL instead, requires no other code change. */
  gameUrl: string;
}

// Same 8 skills, same order, same ids as تعلّم/تدرّب/اكتشف — on purpose, so
// all four sections always refer to the same 8 things.
export const playGames: PlayGame[] = [
  { id: "addition", title: "الجمع", icon: iconAddition, gameUrl: "/games/addition.html" },
  { id: "subtraction", title: "الطرح", icon: iconSubtraction, gameUrl: "/games/subtraction.html" },
  { id: "rounding", title: "التقريب", icon: iconRounding, gameUrl: "/games/rounding.html" },
  { id: "doubling", title: "الضعف", icon: iconDoubling, gameUrl: "/games/doubling.html" },
  {
    id: "ascending-order",
    title: "الترتيب التصاعدي",
    icon: iconAscending,
    gameUrl: "/games/ascending-order.html",
  },
  {
    id: "descending-order",
    title: "الترتيب التنازلي",
    icon: iconDescending,
    gameUrl: "/games/descending-order.html",
  },
  { id: "comparison", title: "المقارنة", icon: iconComparison, gameUrl: "/games/comparison.html" },
  { id: "even-odd", title: "العدد الزوجي والفردي", icon: iconEvenOdd, gameUrl: "/games/even-odd.html" },
];
