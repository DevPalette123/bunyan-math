import { supabase } from "./supabaseClient";
import { toArabicDigits } from "../utils/arabicNumerals";

export type SkillCode =
  | "addition_no_carry"
  | "subtraction_no_borrow"
  | "rounding"
  | "doubling"
  | "ascending_order"
  | "descending_order"
  | "comparison"
  | "even_odd";

export const SKILLS: { id: SkillCode; label: string }[] = [
  { id: "addition_no_carry", label: "الجمع بدون رفع" },
  { id: "subtraction_no_borrow", label: "الطرح بدون استلاف" },
  { id: "rounding", label: "التقريب" },
  { id: "doubling", label: "الضعف" },
  { id: "ascending_order", label: "الترتيب التصاعدي" },
  { id: "descending_order", label: "الترتيب التنازلي" },
  { id: "comparison", label: "المقارنة" },
  { id: "even_odd", label: "الأعداد الزوجية والفردية" },
];

export function skillLabel(skill: string): string {
  return SKILLS.find((s) => s.id === skill)?.label ?? skill;
}

const SKILL_SHORT_LABEL: Record<SkillCode, string> = {
  addition_no_carry: "الجمع",
  subtraction_no_borrow: "الطرح",
  rounding: "التقريب",
  doubling: "الضعف",
  ascending_order: "تصاعدي",
  descending_order: "تنازلي",
  comparison: "المقارنة",
  even_odd: "زوجي/فردي",
};

export function skillShortLabel(skill: string): string {
  return SKILL_SHORT_LABEL[skill as SkillCode] ?? skill;
}

/** Numbers stored in English digits (internal), commas as separators for
 * ordering questions — converted to Arabic-Indic digits + Arabic comma only
 * at display time, exactly like the rest of the project. */
export function formatArabicText(value: string): string {
  return toArabicDigits(value.replace(/,\s*/g, "، "));
}

export const OPTION_LETTERS = ["أ", "ب", "ج", "د"];

export type PlacementLevel = "يحتاج إلى تأسيس" | "في طور التقدم" | "جيد" | "متقن";

export interface AttemptQuestion {
  id: string; // placement_attempt_questions.id
  questionId: string;
  skill: SkillCode;
  order: number;
  question: string;
  options: string[];
  selectedAnswer: string | null;
  isCorrect: boolean | null;
}

export interface ActiveAttempt {
  attemptId: string;
  startedAt: string;
  expiresAt: string;
  totalQuestions: number;
  questions: AttemptQuestion[];
}

export interface AttemptResult {
  attemptId: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  percentage: number;
  level: PlacementLevel;
  pointsAwarded: number;
  weakSkills: SkillCode[];
  strongSkills: SkillCode[];
  recommendedSkill: SkillCode | null;
  completedAt: string;
}

export interface ReviewQuestion {
  skill: SkillCode;
  question: string;
  options: string[];
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface SkillBreakdownItem {
  skill: SkillCode;
  correct: number;
  total: number;
  percent: number;
  level: "متقن" | "جيد" | "يحتاج تدريب";
}

function classifySkill(correct: number, total: number): "متقن" | "جيد" | "يحتاج تدريب" {
  const percent = total > 0 ? (correct / total) * 100 : 0;
  if (percent >= 85) return "متقن";
  if (percent >= 50) return "جيد";
  return "يحتاج تدريب";
}

export function computeSkillBreakdown(
  rows: { skill: SkillCode; is_correct: boolean | null }[]
): SkillBreakdownItem[] {
  const bySkill = new Map<SkillCode, { correct: number; total: number }>();
  for (const row of rows) {
    const entry = bySkill.get(row.skill) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (row.is_correct) entry.correct += 1;
    bySkill.set(row.skill, entry);
  }
  return SKILLS.filter((s) => bySkill.has(s.id)).map((s) => {
    const { correct, total } = bySkill.get(s.id)!;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { skill: s.id, correct, total, percent, level: classifySkill(correct, total) };
  });
}

/** Fetches an in-progress attempt if one exists (handles refresh-mid-quiz),
 * otherwise null. Never fabricates an attempt. */
export async function getInProgressAttempt(studentId: string): Promise<ActiveAttempt | null> {
  const { data: attempt } = await supabase
    .from("placement_attempts")
    .select("id, started_at, expires_at, total_questions, status")
    .eq("student_id", studentId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) return null;

  // Expired but never finalized (e.g. tab closed) — finalize it now from
  // whatever was answered, then report there's nothing active to resume.
  if (new Date(attempt.expires_at).getTime() <= Date.now()) {
    await supabase.rpc("complete_placement_attempt", { p_attempt_id: attempt.id });
    return null;
  }

  return loadAttemptQuestions(attempt.id, attempt.started_at, attempt.expires_at, attempt.total_questions);
}

async function loadAttemptQuestions(
  attemptId: string,
  startedAt: string,
  expiresAt: string,
  totalQuestions: number
): Promise<ActiveAttempt> {
  const { data: rows } = await supabase
    .from("placement_attempt_questions")
    .select(
      "id, question_id, skill, question_order, selected_answer, is_correct, options_snapshot, placement_questions(question, options)"
    )
    .eq("attempt_id", attemptId)
    .order("question_order", { ascending: true });

  const questions: AttemptQuestion[] = (rows ?? []).map((row: any) => ({
    id: row.id,
    questionId: row.question_id,
    skill: row.skill,
    order: row.question_order,
    question: row.placement_questions?.question ?? "",
    // options_snapshot is the randomized, per-attempt order fixed at start
    // time — falling back to the bank's raw order only protects against a
    // pre-fix attempt row that has no snapshot yet.
    options: (row.options_snapshot ?? row.placement_questions?.options ?? []) as string[],
    selectedAnswer: row.selected_answer,
    isCorrect: row.is_correct,
  }));

  return { attemptId, startedAt, expiresAt, totalQuestions, questions };
}

export async function startPlacementAttempt(): Promise<ActiveAttempt> {
  const { data: attemptId, error } = await supabase.rpc("start_placement_attempt");
  if (error || !attemptId) throw new Error(error?.message ?? "تعذّر بدء الاختبار.");

  const { data: attempt } = await supabase
    .from("placement_attempts")
    .select("started_at, expires_at, total_questions")
    .eq("id", attemptId)
    .single();

  return loadAttemptQuestions(
    attemptId as string,
    attempt!.started_at,
    attempt!.expires_at,
    attempt!.total_questions
  );
}

export async function recordPlacementAnswer(
  attemptId: string,
  questionId: string,
  selectedAnswer: string
): Promise<{ isCorrect: boolean | null; error: string | null }> {
  const { data, error } = await supabase.rpc("record_placement_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_answer: selectedAnswer,
  });
  if (error) return { isCorrect: null, error: error.message };
  return { isCorrect: Boolean(data), error: null };
}

export async function completePlacementAttempt(attemptId: string): Promise<void> {
  await supabase.rpc("complete_placement_attempt", { p_attempt_id: attemptId });
}

export async function fetchAttemptResult(attemptId: string): Promise<{
  result: AttemptResult;
  review: ReviewQuestion[];
} | null> {
  const { data: attempt } = await supabase
    .from("placement_attempts")
    .select(
      "id, total_questions, correct_answers, wrong_answers, unanswered, percentage, level, points_awarded, weak_skills, strong_skills, recommended_skill, completed_at, status"
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt || attempt.status !== "completed") return null;

  const { data: rows } = await supabase
    .from("placement_attempt_questions")
    .select(
      "skill, selected_answer, correct_answer, is_correct, question_order, options_snapshot, placement_questions(question, options)"
    )
    .eq("attempt_id", attemptId)
    .order("question_order", { ascending: true });

  const review: ReviewQuestion[] = (rows ?? []).map((row: any) => ({
    skill: row.skill,
    question: row.placement_questions?.question ?? "",
    options: (row.options_snapshot ?? row.placement_questions?.options ?? []) as string[],
    selectedAnswer: row.selected_answer,
    correctAnswer: row.correct_answer ?? "",
    isCorrect: Boolean(row.is_correct),
  }));

  return {
    result: {
      attemptId: attempt.id,
      totalQuestions: attempt.total_questions,
      correctAnswers: attempt.correct_answers,
      wrongAnswers: attempt.wrong_answers,
      unanswered: attempt.unanswered,
      percentage: Number(attempt.percentage ?? 0),
      level: (attempt.level ?? "يحتاج إلى تأسيس") as PlacementLevel,
      pointsAwarded: attempt.points_awarded,
      weakSkills: (attempt.weak_skills ?? []) as SkillCode[],
      strongSkills: (attempt.strong_skills ?? []) as SkillCode[],
      recommendedSkill: (attempt.recommended_skill ?? null) as SkillCode | null,
      completedAt: attempt.completed_at as string, // non-null: filtered on status = "completed"
    },
    review,
  };
}

/** For the student home page's "مستواي" card: the latest completed attempt
 * only — never a fabricated or partial one. */
export async function fetchLatestCompletedAttemptSummary(
  studentId: string
): Promise<{ attemptId: string; completedAt: string; percentage: number; skills: SkillBreakdownItem[] } | null> {
  const { data: attempt } = await supabase
    .from("placement_attempts")
    .select("id, percentage, completed_at")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) return null;

  const { data: rows } = await supabase
    .from("placement_attempt_questions")
    .select("skill, is_correct")
    .eq("attempt_id", attempt.id);

  return {
    attemptId: attempt.id,
    completedAt: attempt.completed_at as string, // non-null: filtered on status = "completed"
    percentage: Math.round(Number(attempt.percentage ?? 0)),
    skills: computeSkillBreakdown((rows ?? []) as any),
  };
}

// ---------------------------------------------------------------------------
// Teacher-facing queries
// ---------------------------------------------------------------------------

export interface TeacherPlacementRow {
  attemptId: string;
  studentId: string;
  percentage: number;
  level: PlacementLevel;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string;
  weakSkills: SkillCode[];
}

/** Latest completed attempt per student in the given id list — real rows
 * only, never invented for students who haven't taken it yet. */
export async function fetchClassPlacementOverview(
  studentIds: string[]
): Promise<Map<string, TeacherPlacementRow>> {
  if (studentIds.length === 0) return new Map();

  const { data: rows } = await supabase
    .from("placement_attempts")
    .select("id, student_id, percentage, level, correct_answers, total_questions, completed_at, weak_skills")
    .in("student_id", studentIds)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  const latestByStudent = new Map<string, TeacherPlacementRow>();
  for (const row of rows ?? []) {
    if (latestByStudent.has(row.student_id)) continue; // already have the latest (rows sorted desc)
    latestByStudent.set(row.student_id, {
      attemptId: row.id,
      studentId: row.student_id,
      percentage: Math.round(Number(row.percentage ?? 0)),
      level: (row.level ?? "يحتاج إلى تأسيس") as PlacementLevel,
      correctAnswers: row.correct_answers,
      totalQuestions: row.total_questions,
      completedAt: row.completed_at as string, // non-null: filtered on status = "completed"
      weakSkills: (row.weak_skills ?? []) as SkillCode[],
    });
  }
  return latestByStudent;
}

export interface TeacherPlacementDetail {
  percentage: number;
  level: PlacementLevel;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  totalQuestions: number;
  pointsAwarded: number;
  completedAt: string;
  startedAt: string;
  skills: SkillBreakdownItem[];
}

export async function fetchStudentPlacementDetail(
  studentId: string
): Promise<TeacherPlacementDetail | null> {
  const { data: attempt } = await supabase
    .from("placement_attempts")
    .select(
      "id, percentage, level, correct_answers, wrong_answers, unanswered, total_questions, points_awarded, completed_at, started_at"
    )
    .eq("student_id", studentId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) return null;

  const { data: rows } = await supabase
    .from("placement_attempt_questions")
    .select("skill, is_correct")
    .eq("attempt_id", attempt.id);

  return {
    percentage: Math.round(Number(attempt.percentage ?? 0)),
    level: (attempt.level ?? "يحتاج إلى تأسيس") as PlacementLevel,
    correctAnswers: attempt.correct_answers,
    wrongAnswers: attempt.wrong_answers,
    unanswered: attempt.unanswered,
    totalQuestions: attempt.total_questions,
    pointsAwarded: attempt.points_awarded,
    completedAt: attempt.completed_at as string, // non-null: filtered on status = "completed"
    startedAt: attempt.started_at,
    skills: computeSkillBreakdown((rows ?? []) as any),
  };
}
