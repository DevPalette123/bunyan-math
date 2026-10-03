import { supabase } from "./supabaseClient";

// ملاحظة مهمة: star_board_entries جدول مستقل تمامًا عن students.stars (النجوم
// الحقيقية المكتسبة من تعلّم/اكتشف/اختبر/العب/المهام). هذا رقم يدوي بالكامل
// بيد المعلمة فقط (عبر أزرار +/- هنا)، لا تُغذّيه أي محاولة أو إنجاز فعلي —
// أداة تحفيز صفّية منفصلة، وليست انعكاسًا لتقدّم الطالبة.

export interface StarBoardEntry {
  id: string;
  studentId: string | null;
  displayName: string;
  stars: number;
}

export async function fetchStarBoard(classId: string): Promise<StarBoardEntry[]> {
  const { data } = await supabase
    .from("star_board_entries")
    .select("id, student_id, display_name, stars")
    .eq("class_id", classId)
    .order("stars", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    displayName: row.display_name,
    stars: row.stars,
  }));
}

/** The student's own count only — null means she has no entry on the board
 * yet, which is a real, honest state (not zero). */
export async function fetchMyStarCount(studentId: string): Promise<number | null> {
  const { data } = await supabase
    .from("star_board_entries")
    .select("stars")
    .eq("student_id", studentId)
    .maybeSingle();
  return data ? data.stars : null;
}

export async function addStarBoardEntry(
  classId: string,
  studentId: string,
  displayName: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("star_board_entries")
    .insert({ class_id: classId, student_id: studentId, display_name: displayName, stars: 0 });
  return { error: error?.message ?? null };
}

/** إضافة عدة طالبات دفعة واحدة (زر «إضافة الكل»). الفهرس الفريد في القاعدة
 *  يمنع تكرار طالبة على نفس اللوحة، فإن كانت إحداهن موجودة تفشل العملية كلها. */
export async function addStarBoardEntries(
  classId: string,
  students: { id: string; full_name: string }[]
): Promise<{ error: string | null }> {
  if (students.length === 0) return { error: null };
  const { error } = await supabase
    .from("star_board_entries")
    .insert(
      students.map((s) => ({ class_id: classId, student_id: s.id, display_name: s.full_name, stars: 0 }))
    );
  return { error: error?.message ?? null };
}

/**
 * زيادة/إنقاص النجوم بشكل ذرّي داخل قاعدة البيانات (لا تنزل تحت الصفر)، وتُرجع
 * الرقم الحقيقي بعد التعديل. نقرتان سريعتان أو جهازان مفتوحان لا يُضيّعان نجمة —
 * بخلاف حساب الرقم في المتصفح ثم كتابته.
 */
export async function adjustStarBoardStars(
  id: string,
  delta: number
): Promise<{ stars: number } | { error: string }> {
  const { data, error } = await supabase.rpc("adjust_star_board_stars", {
    p_entry_id: id,
    p_delta: delta,
  });
  if (error || typeof data !== "number") return { error: error?.message ?? "تعذّر حفظ التغيير." };
  return { stars: data };
}

export async function deleteStarBoardEntry(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("star_board_entries").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteAllStarBoardEntries(classId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("star_board_entries").delete().eq("class_id", classId);
  return { error: error?.message ?? null };
}
