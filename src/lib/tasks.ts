import { supabase } from "./supabaseClient";

/**
 * Marks a task assignment as completed via the existing SECURITY DEFINER
 * function — never touches students.stars directly. Safe to call more than
 * once for the same assignment: the database function itself is idempotent
 * (a second call is a no-op, no duplicate points).
 */
export async function completeTaskAssignment(assignmentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("complete_task_assignment", {
    target_assignment_id: assignmentId,
  });
  return { error: error?.message ?? null };
}
