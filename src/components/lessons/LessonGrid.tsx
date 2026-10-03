import type { Lesson } from "../../data/lessons";
import LessonCard from "./LessonCard";

interface LessonGridProps {
  lessons: Lesson[];
  /** Set of lesson ids the student has actually completed. */
  statuses?: Set<string>;
  onOpen: (lesson: Lesson) => void;
}

export default function LessonGrid({ lessons, statuses, onOpen }: LessonGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
      {lessons.map((lesson) => (
        <LessonCard
          key={lesson.id}
          lesson={lesson}
          status={statuses?.has(lesson.id) ? "completed" : "not-started"}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
