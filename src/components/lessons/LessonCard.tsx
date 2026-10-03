import type { LessonStatus } from "../../data/types";
import type { Lesson as LessonData } from "../../data/lessons";
import { CheckCircleIcon, ClockIcon, CircleOutlineIcon } from "../icons/Glyphs";

interface LessonCardProps {
  lesson: LessonData;
  status?: LessonStatus;
  onOpen: (lesson: LessonData) => void;
}

const STATUS_CONFIG: Record<LessonStatus, { label: string; className: string; Icon: typeof CheckCircleIcon }> = {
  "not-started": { label: "لم تبدأ بعد", className: "text-ink-500", Icon: CircleOutlineIcon },
  "in-progress": { label: "قيد التعلّم", className: "text-sun-500", Icon: ClockIcon },
  completed: { label: "مكتمل ✓", className: "text-palm-600", Icon: CheckCircleIcon },
};

export default function LessonCard({ lesson, status = "not-started", onOpen }: LessonCardProps) {
  const { label, className, Icon } = STATUS_CONFIG[status];

  return (
    <button
      onClick={() => onOpen(lesson)}
      className="group flex flex-col items-center text-center gap-3 rounded-3xl bg-white p-5 sm:p-6 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300 animate-pop-in"
    >
      <img
        src={lesson.icon}
        alt=""
        className="w-20 h-20 sm:w-24 sm:h-24 object-contain group-hover:scale-105 transition-transform duration-300"
      />
      <h3 className="text-sm sm:text-base font-extrabold text-ink-900">{lesson.title}</h3>
      <span className={`flex items-center gap-1.5 text-xs font-bold ${className}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
    </button>
  );
}
