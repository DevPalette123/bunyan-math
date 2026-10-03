// «اختبر» — الجانب البرمجي للواجهة. الأسئلة والإجابات الصحيحة والنتيجة والنجوم
// كلها تُحسب في قاعدة البيانات (انظر supabase/phase2-quiz-and-stars.sql) تمامًا
// كما في «اكتشف»؛ هذا الملف لا يولّد سؤالًا ولا يحسب درجة، ولا يرى الإجابة
// الصحيحة لأي سؤال قبل أن تجيب عنه الطالبة.
//
// ⚠️ الاستعلامات على quiz_attempt_questions تذكر الأعمدة صراحةً: عمود
// answer_key محجوب عن المتصفح بصلاحيات الأعمدة، وأي select("*") سيفشل.

import { supabase } from "./supabaseClient";
import {
  computeSkillBreakdown,
  type PlacementLevel,
  type SkillBreakdownItem,
  type SkillCode,
} from "./discover";

export const QUIZ_TOTAL = 10;

// ---------------------------------------------------------------------------
// أنواع الأسئلة (تطابق ما يكتبه المولّد في عمود visual)
// ---------------------------------------------------------------------------

export type QuizToken =
  | { kind: "num"; value: number }
  | { kind: "op"; symbol: string }
  | { kind: "blank" };

export type QuizVisual =
  | { kind: "expression"; tokens: QuizToken[] }
  | { kind: "number"; value: number }
  | { kind: "chips"; numbers: number[] }
  | { kind: "compare"; first: number; second: number };

export interface QuizQuestion {
  id: string; // quiz_attempt_questions.id
  skill: SkillCode;
  order: number;
  /** سطر التعليمات فوق الرقم الكبير. */
  prompt: string;
  visual: QuizVisual;
  /** الصيغة النصية الكاملة — للمراجعة فقط. */
  text: string;
  options: string[];
  selectedAnswer: string | null;
  /** null حتى تجيب الطالبة على هذا السؤال (أو تنتهي المحاولة). */
  correctAnswer: string | null;
  isCorrect: boolean | null;
}

export interface ActiveQuizAttempt {
  attemptId: string;
  questions: QuizQuestion[];
}

export interface QuizResultData {
  attemptId: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  percentage: number;
  level: PlacementLevel;
  pointsAwarded: number;
  bestStreak: number;
  weakSkills: SkillCode[];
  strongSkills: SkillCode[];
  completedAt: string;
}

export interface QuizReviewItem {
  skill: SkillCode;
  text: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
}

// ---------------------------------------------------------------------------
// تحويل صفوف قاعدة البيانات
// ---------------------------------------------------------------------------

const QUESTION_COLUMNS =
  "id, skill, question_order, prompt, visual, question_text, options, selected_answer, correct_answer, is_correct";

const EMPTY_VISUAL: QuizVisual = { kind: "expression", tokens: [] };

function parseVisual(value: unknown): QuizVisual {
  if (value && typeof value === "object" && "kind" in value) {
    const kind = (value as { kind: unknown }).kind;
    if (kind === "expression" || kind === "number" || kind === "chips" || kind === "compare") {
      return value as QuizVisual;
    }
  }
  return EMPTY_VISUAL;
}

function parseOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

async function loadQuestions(attemptId: string): Promise<QuizQuestion[]> {
  const { data: rows } = await supabase
    .from("quiz_attempt_questions")
    .select(QUESTION_COLUMNS)
    .eq("attempt_id", attemptId)
    .order("question_order", { ascending: true });

  return (rows ?? []).map((row) => ({
    id: row.id,
    skill: row.skill,
    order: row.question_order,
    prompt: row.prompt,
    visual: parseVisual(row.visual),
    text: row.question_text,
    options: parseOptions(row.options),
    selectedAnswer: row.selected_answer,
    correctAnswer: row.correct_answer,
    isCorrect: row.is_correct,
  }));
}

// ---------------------------------------------------------------------------
// مسار الطالبة
// ---------------------------------------------------------------------------

/** يبدأ محاولة جديدة (أو يستأنف المفتوحة إن وُجدت — الخادم يقرر). */
export async function startQuizAttempt(): Promise<ActiveQuizAttempt> {
  const { data: attemptId, error } = await supabase.rpc("start_quiz_attempt");
  if (error || !attemptId) throw new Error(error?.message ?? "تعذّر بدء الاختبار.");

  const questions = await loadQuestions(attemptId as string);
  if (questions.length === 0) throw new Error("تعذّر تحميل أسئلة الاختبار.");
  return { attemptId: attemptId as string, questions };
}

/** محاولة مفتوحة لم تنتهِ مهلتها (تتحمّل تحديث الصفحة)، وإلا null. */
export async function getInProgressQuizAttempt(studentId: string): Promise<ActiveQuizAttempt | null> {
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, expires_at")
    .eq("student_id", studentId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) return null;

  // انتهت مهلتها دون إنهاء (تبويب أُغلق مثلًا): نغلقها من إجاباتها المسجّلة.
  if (new Date(attempt.expires_at).getTime() <= Date.now()) {
    await supabase.rpc("complete_quiz_attempt", { p_attempt_id: attempt.id });
    return null;
  }

  const questions = await loadQuestions(attempt.id);
  return questions.length > 0 ? { attemptId: attempt.id, questions } : null;
}

export async function recordQuizAnswer(
  attemptId: string,
  questionId: string,
  selectedAnswer: string
): Promise<{ isCorrect: boolean; correctAnswer: string } | { error: string }> {
  const { data, error } = await supabase.rpc("record_quiz_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_answer: selectedAnswer,
  });
  const row = data?.[0];
  if (error || !row) return { error: error?.message ?? "تعذّر حفظ الإجابة." };
  return { isCorrect: row.was_correct, correctAnswer: row.right_answer };
}

export async function completeQuizAttempt(attemptId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("complete_quiz_attempt", { p_attempt_id: attemptId });
  return { error: error?.message ?? null };
}

export async function fetchQuizResult(
  attemptId: string
): Promise<{ result: QuizResultData; review: QuizReviewItem[] } | null> {
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select(
      "id, total_questions, correct_answers, wrong_answers, unanswered, percentage, level, points_awarded, best_streak, weak_skills, strong_skills, completed_at, status"
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt || attempt.status !== "completed") return null;

  const { data: rows } = await supabase
    .from("quiz_attempt_questions")
    .select("skill, question_text, selected_answer, correct_answer, is_correct, question_order")
    .eq("attempt_id", attemptId)
    .order("question_order", { ascending: true });

  const review: QuizReviewItem[] = (rows ?? []).map((row) => ({
    skill: row.skill,
    text: row.question_text,
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
      percentage: Math.round(Number(attempt.percentage ?? 0)),
      level: (attempt.level ?? "يحتاج إلى تأسيس") as PlacementLevel,
      pointsAwarded: attempt.points_awarded,
      bestStreak: attempt.best_streak,
      weakSkills: (attempt.weak_skills ?? []) as SkillCode[],
      strongSkills: (attempt.strong_skills ?? []) as SkillCode[],
      completedAt: attempt.completed_at as string, // غير null: مُرشَّح على status = completed
    },
    review,
  };
}

/** لبطاقة «النشاط الأخير» في رئيسية الطالبة: آخر محاولة مكتملة فقط، بلا اختلاق. */
export async function fetchLatestQuizSummary(
  studentId: string
): Promise<{ attemptId: string; completedAt: string; percentage: number } | null> {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("id, percentage, completed_at")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    attemptId: data.id,
    completedAt: data.completed_at as string,
    percentage: Math.round(Number(data.percentage ?? 0)),
  };
}

// ---------------------------------------------------------------------------
// مسار المعلمة
// ---------------------------------------------------------------------------

export interface TeacherQuizRow {
  studentId: string;
  attemptId: string;
  percentage: number;
  level: PlacementLevel;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string;
  weakSkills: SkillCode[];
  /** كل المحاولات المكتملة لهذه الطالبة (وليس آخرها فقط). */
  attemptsCount: number;
  bestPercentage: number;
  averagePercentage: number;
}

/** آخر محاولة مكتملة لكل طالبة + عدد المحاولات وأفضل نسبة ومتوسطها — صفوف
 *  حقيقية فقط، لا شيء للطالبات اللواتي لم يجرين الاختبار. */
export async function fetchClassQuizOverview(studentIds: string[]): Promise<Map<string, TeacherQuizRow>> {
  if (studentIds.length === 0) return new Map();

  const { data: rows } = await supabase
    .from("quiz_attempts")
    .select("id, student_id, percentage, level, correct_answers, total_questions, completed_at, weak_skills")
    .in("student_id", studentIds)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  const grouped = new Map<string, NonNullable<typeof rows>>();
  for (const row of rows ?? []) {
    const list = grouped.get(row.student_id) ?? [];
    list.push(row);
    grouped.set(row.student_id, list);
  }

  const overview = new Map<string, TeacherQuizRow>();
  for (const [studentId, attempts] of grouped) {
    const latest = attempts[0]; // مرتّبة من الأحدث
    const percentages = attempts.map((a) => Math.round(Number(a.percentage ?? 0)));
    overview.set(studentId, {
      studentId,
      attemptId: latest.id,
      percentage: percentages[0],
      level: (latest.level ?? "يحتاج إلى تأسيس") as PlacementLevel,
      correctAnswers: latest.correct_answers,
      totalQuestions: latest.total_questions,
      completedAt: latest.completed_at as string,
      weakSkills: (latest.weak_skills ?? []) as SkillCode[],
      attemptsCount: attempts.length,
      bestPercentage: Math.max(...percentages),
      averagePercentage: Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length),
    });
  }
  return overview;
}

export interface TeacherQuizDetail {
  percentage: number;
  level: PlacementLevel;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  totalQuestions: number;
  pointsAwarded: number;
  bestStreak: number;
  completedAt: string;
  startedAt: string;
  skills: SkillBreakdownItem[];
  /** أسئلة آخر محاولة التي أخطأت فيها الطالبة، بنص السؤال والإجابتين. */
  mistakes: QuizReviewItem[];
  /** آخر محاولات مكتملة (الأحدث أولًا) لرؤية التطور. */
  history: { attemptId: string; completedAt: string; percentage: number }[];
}

export async function fetchStudentQuizDetail(studentId: string): Promise<TeacherQuizDetail | null> {
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select(
      "id, percentage, level, correct_answers, wrong_answers, unanswered, total_questions, points_awarded, best_streak, completed_at, started_at"
    )
    .eq("student_id", studentId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(6);

  const latest = attempts?.[0];
  if (!latest) return null;

  const { data: rows } = await supabase
    .from("quiz_attempt_questions")
    .select("skill, question_text, selected_answer, correct_answer, is_correct, question_order")
    .eq("attempt_id", latest.id)
    .order("question_order", { ascending: true });

  const review: QuizReviewItem[] = (rows ?? []).map((row) => ({
    skill: row.skill,
    text: row.question_text,
    selectedAnswer: row.selected_answer,
    correctAnswer: row.correct_answer ?? "",
    isCorrect: Boolean(row.is_correct),
  }));

  return {
    percentage: Math.round(Number(latest.percentage ?? 0)),
    level: (latest.level ?? "يحتاج إلى تأسيس") as PlacementLevel,
    correctAnswers: latest.correct_answers,
    wrongAnswers: latest.wrong_answers,
    unanswered: latest.unanswered,
    totalQuestions: latest.total_questions,
    pointsAwarded: latest.points_awarded,
    bestStreak: latest.best_streak,
    completedAt: latest.completed_at as string,
    startedAt: latest.started_at,
    skills: computeSkillBreakdown(review.map((r) => ({ skill: r.skill, is_correct: r.isCorrect }))),
    mistakes: review.filter((r) => !r.isCorrect),
    history: (attempts ?? []).map((a) => ({
      attemptId: a.id,
      completedAt: a.completed_at as string,
      percentage: Math.round(Number(a.percentage ?? 0)),
    })),
  };
}
