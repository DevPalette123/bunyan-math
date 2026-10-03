import { useEffect, useState } from "react";
import StudentShell from "../components/StudentShell";
import PracticeCard from "../components/practice/PracticeCard";
import { practiceLessons } from "../data/practiceLessons";
import iconPractice from "../assets/icons/icon-practice.png";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { fetchCompletedPracticeIds } from "../lib/practiceProgress";

export default function PracticePage() {
  const { profile } = useAuth();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isSupabaseConfigured || !profile) return;
    let isMounted = true;
    fetchCompletedPracticeIds(profile.id).then((ids) => {
      if (isMounted) setCompletedIds(ids);
    });
    return () => {
      isMounted = false;
    };
  }, [profile]);

  return (
    <StudentShell activeId="practice">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex flex-col gap-6 sm:gap-7 pb-24 lg:pb-10">
        <section className="flex flex-col items-center text-center gap-2 animate-rise-in">
          <span className="w-16 h-16 rounded-3xl bg-sun-50 flex items-center justify-center">
            <img src={iconPractice} alt="" className="w-11 h-11 object-contain" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900">تدرّب</h1>
          <p className="text-sm sm:text-base font-bold text-ink-500">
            اختاري مهارة وابدئي بحل تمارينها
          </p>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          {practiceLessons.map((lesson) => (
            <PracticeCard key={lesson.id} lesson={lesson} completed={completedIds.has(lesson.id)} />
          ))}
        </div>
      </main>
    </StudentShell>
  );
}
