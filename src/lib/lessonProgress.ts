import { supabase } from "./supabaseClient";

/** Real completion state only — an empty set means "none completed yet",
 * never a fabricated default. */
export async function fetchCompletedLessonIds(studentId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("lesson_completions")
    .select("lesson_id")
    .eq("student_id", studentId);
  return new Set((data ?? []).map((row) => row.lesson_id as string));
}

/** Idempotent on the server: calling this more than once for the same
 * (student, lesson) never re-awards points (see public.complete_lesson). */
export async function completeLesson(lessonId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("complete_lesson", { p_lesson_id: lessonId });
  return { error: error?.message ?? null };
}
