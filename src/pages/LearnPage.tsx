import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentShell from "../components/StudentShell";
import LessonGrid from "../components/lessons/LessonGrid";
import { lessons, type Lesson } from "../data/lessons";
import iconLearn from "../assets/icons/icon-lessons.png";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { fetchCompletedLessonIds } from "../lib/lessonProgress";

export default function LearnPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isSupabaseConfigured || !profile) return;
    let isMounted = true;
    fetchCompletedLessonIds(profile.id).then((ids) => {
      if (isMounted) setCompletedIds(ids);
    });
    return () => {
      isMounted = false;
    };
  }, [profile]);

  function handleOpen(lesson: Lesson) {
    navigate(`/learn/${lesson.id}`);
  }

  return (
    <StudentShell activeId="learn">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex flex-col gap-6 sm:gap-7 pb-24 lg:pb-10">
        <section className="flex flex-col items-center text-center gap-2 animate-rise-in">
          {/* Same icon asset used in the sidebar's "تعلّم" entry — not a
              different generic glyph — so the identity stays consistent
              between the nav and this page's own header. */}
          <span className="w-16 h-16 rounded-3xl bg-berry-50 flex items-center justify-center">
            <img src={iconLearn} alt="" className="w-11 h-11 object-contain" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900">تعلّم</h1>
          <p className="text-sm sm:text-base font-bold text-ink-500">افهم، ثم انطلق!</p>
        </section>

        <LessonGrid
          lessons={lessons}
          statuses={completedIds}
          onOpen={handleOpen}
        />
      </main>
    </StudentShell>
  );
}
