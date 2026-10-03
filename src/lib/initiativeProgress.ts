import { supabase } from "./supabaseClient";

/** Real completion state only — an empty set means "none completed yet",
 * never a fabricated default. */
export async function fetchCompletedInitiativeIds(studentId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("initiative_completions")
    .select("initiative_id")
    .eq("student_id", studentId);
  return new Set((data ?? []).map((row) => row.initiative_id as string));
}

/** Idempotent on the server: calling this more than once for the same
 * (student, initiative) never re-awards points (see public.complete_initiative). */
export async function completeInitiative(initiativeId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("complete_initiative", { p_initiative_id: initiativeId });
  return { error: error?.message ?? null };
}
