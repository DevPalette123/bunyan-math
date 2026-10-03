import { supabase } from "./supabaseClient";

/** Real completion state only — an empty set means "none completed yet",
 * never a fabricated default. */
export async function fetchCompletedPracticeIds(studentId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("practice_completions")
    .select("practice_id")
    .eq("student_id", studentId);
  return new Set((data ?? []).map((row) => row.practice_id as string));
}

/** Idempotent on the server: calling this more than once for the same
 * (student, practice sheet) never re-awards points (see public.complete_practice). */
export async function completePractice(practiceId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("complete_practice", { p_practice_id: practiceId });
  return { error: error?.message ?? null };
}
