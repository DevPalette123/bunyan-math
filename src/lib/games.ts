// «ألعب» — الجانب البرمجي المشترك لكل الألعاب. الأسئلة والإجابات الصحيحة والنتيجة
// تُحسب كلها في قاعدة البيانات (انظر supabase/phase3-play-games.sql) بنفس أسلوب
// «اختبر»؛ هذا الملف لا يولّد سؤالًا ولا يحسب درجة، ولا يرى الإجابة الصحيحة لأي
// سؤال قبل أن تجيب عنه الطالبة. إضافة لعبة جديدة لاحقًا لا تغيّر شيئًا هنا: صف في
// كتالوج play_games + بنك أسئلتها + إعداد عرضها في data/playGameThemes.ts.
//
// ⚠️ الاستعلامات على game_attempt_questions تذكر الأعمدة صراحةً: عمود answer_key
// محجوب عن المتصفح بصلاحيات الأعمدة، وأي select("*") سيفشل.

import { supabase } from "./supabaseClient";
import type { SkillCode } from "./discover";

/** معرّفات الألعاب المفعّلة حاليًا (نفس معرّفات play_games وdata/playGames.ts). */
export type GameId =
  | "addition"
  | "subtraction"
  | "rounding"
  | "doubling"
  | "ascending-order"
  | "descending-order"
  | "comparison"
  | "even-odd";

export const GAME_QUESTION_COUNT = 10;

export type GameToken =
  | { kind: "num"; value: number }
  | { kind: "op"; symbol: string }
  | { kind: "blank" };

export type GameVisual =
  | { kind: "expression"; tokens: GameToken[] }
  // مغامرة التقريب: خط أعداد بين حدّين (أقرب عشرة/مئة أصغر وأكبر) والعدد المطلوب
  // تقريبه بينهما.
  | { kind: "numberLine"; value: number; lower: number; upper: number; unit: 10 | 100 }
  // مغامرة الضعف: العدد الأصلي ثم نسختان متطابقتان منه (تمثيل بصري للضعف).
  | { kind: "doublingPods"; value: number }
  // مغامرتا الترتيب: الأعداد الأربعة كما ستُعرض للطالبة (بترتيبها الأصلي غير
  // المرتّب) — نفس شكل «chips» في اختبر/اكتشف.
  | { kind: "chips"; numbers: number[] }
  // مغامرة الزوجي والفردي: عدد واحد كبير تصنّفه الطالبة.
  | { kind: "number"; value: number }
  // مغامرة المقارنة: عددان وعلامة تُكشف بعد الإجابة — نفس شكل «compare» في اختبر.
  | { kind: "compare"; first: number; second: number };

export type GameDifficulty = "easy" | "medium" | "hard";

export interface GameQuestion {
  id: string; // game_attempt_questions.id
  skill: SkillCode;
  difficulty: GameDifficulty;
  order: number;
  text: string;
  operandA: number;
  /** null للمهارات ذات المُعامل الواحد (التقريب: وحدة التقريب هنا؛ الضعف: null). */
  operandB: number | null;
  operator: "+" | "-" | "round" | "double" | "order_asc" | "order_desc" | "compare" | "even_odd";
  visual: GameVisual;
  options: string[];
  selectedAnswer: string | null;
  /** null حتى تجيب الطالبة على هذا السؤال. */
  correctAnswer: string | null;
  isCorrect: boolean | null;
}

export interface ActiveGameAttempt {
  attemptId: string;
  gameId: GameId;
  startedAt: string;
  attemptNumber: number;
  questions: GameQuestion[];
}

export interface GameResultData {
  attemptId: string;
  gameId: GameId;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  percentage: number;
  durationSeconds: number | null;
  pointsAwarded: number;
  completedAt: string;
}

export interface GameReviewItem {
  text: string;
  difficulty: GameDifficulty;
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
}

// ---------------------------------------------------------------------------
// تحويل صفوف قاعدة البيانات
// ---------------------------------------------------------------------------

const QUESTION_COLUMNS =
  "id, skill, difficulty, question_order, question_text, operand_a, operand_b, operator, visual, options, selected_answer, correct_answer, is_correct";

const EMPTY_VISUAL: GameVisual = { kind: "expression", tokens: [] };

function parseVisual(value: unknown): GameVisual {
  if (value && typeof value === "object" && "kind" in value) {
    const kind = (value as { kind: unknown }).kind;
    if (kind === "expression" || kind === "numberLine" || kind === "doublingPods" || kind === "chips" || kind === "number" || kind === "compare") {
      return value as GameVisual;
    }
  }
  return EMPTY_VISUAL;
}

function parseOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

async function loadQuestions(attemptId: string): Promise<GameQuestion[]> {
  const { data: rows } = await supabase
    .from("game_attempt_questions")
    .select(QUESTION_COLUMNS)
    .eq("attempt_id", attemptId)
    .order("question_order", { ascending: true });

  return (rows ?? []).map((row) => ({
    id: row.id,
    skill: row.skill,
    difficulty: row.difficulty as GameDifficulty,
    order: row.question_order,
    text: row.question_text,
    operandA: row.operand_a,
    operandB: row.operand_b,
    operator: row.operator as GameQuestion["operator"],
    visual: parseVisual(row.visual),
    options: parseOptions(row.options),
    selectedAnswer: row.selected_answer,
    correctAnswer: row.correct_answer,
    isCorrect: row.is_correct,
  }));
}

async function loadAttempt(attemptId: string, gameId: GameId): Promise<ActiveGameAttempt | null> {
  const { data: attempt } = await supabase
    .from("game_attempts")
    .select("id, started_at, attempt_number")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return null;

  const questions = await loadQuestions(attemptId);
  if (questions.length === 0) return null;
  return {
    attemptId,
    gameId,
    startedAt: attempt.started_at,
    attemptNumber: attempt.attempt_number,
    questions,
  };
}

// ---------------------------------------------------------------------------
// مسار الطالبة
// ---------------------------------------------------------------------------

/** يبدأ محاولة جديدة في اللعبة (أو يستأنف المفتوحة إن وُجدت — الخادم يقرر). */
export async function startGameAttempt(gameId: GameId): Promise<ActiveGameAttempt> {
  const { data: attemptId, error } = await supabase.rpc("start_game_attempt", { p_game_id: gameId });
  if (error || !attemptId) throw new Error(error?.message ?? "تعذّر بدء اللعبة.");

  const attempt = await loadAttempt(attemptId as string, gameId);
  if (!attempt) throw new Error("تعذّر تحميل أسئلة اللعبة.");
  return attempt;
}

/** محاولة مفتوحة لم تنتهِ مهلتها لهذه اللعبة (تتحمّل تحديث الصفحة)، وإلا null. */
export async function getInProgressGameAttempt(
  studentId: string,
  gameId: GameId
): Promise<ActiveGameAttempt | null> {
  const { data: attempt } = await supabase
    .from("game_attempts")
    .select("id, expires_at")
    .eq("student_id", studentId)
    .eq("game_id", gameId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) return null;
  if (new Date(attempt.expires_at).getTime() <= Date.now()) return null; // start_game_attempt يوسمها abandoned
  return loadAttempt(attempt.id, gameId);
}

export async function recordGameAnswer(
  attemptId: string,
  questionId: string,
  selectedAnswer: string
): Promise<{ isCorrect: boolean; correctAnswer: string } | { error: string }> {
  const { data, error } = await supabase.rpc("record_game_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_answer: selectedAnswer,
  });
  const row = data?.[0];
  if (error || !row) return { error: error?.message ?? "تعذّر حفظ الإجابة." };
  return { isCorrect: row.was_correct, correctAnswer: row.right_answer };
}

export async function completeGameAttempt(attemptId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("complete_game_attempt", { p_attempt_id: attemptId });
  return { error: error?.message ?? null };
}

export async function fetchGameResult(
  attemptId: string
): Promise<{ result: GameResultData; review: GameReviewItem[] } | null> {
  const { data: attempt } = await supabase
    .from("game_attempts")
    .select(
      "id, game_id, total_questions, correct_answers, wrong_answers, percentage, duration_seconds, points_awarded, completed_at, status"
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt || attempt.status !== "completed") return null;

  const { data: rows } = await supabase
    .from("game_attempt_questions")
    .select("question_text, difficulty, selected_answer, correct_answer, is_correct, question_order")
    .eq("attempt_id", attemptId)
    .order("question_order", { ascending: true });

  return {
    result: {
      attemptId: attempt.id,
      gameId: attempt.game_id as GameId,
      totalQuestions: attempt.total_questions,
      correctAnswers: attempt.correct_answers,
      wrongAnswers: attempt.wrong_answers,
      percentage: Math.round(Number(attempt.percentage ?? 0)),
      durationSeconds: attempt.duration_seconds,
      pointsAwarded: attempt.points_awarded,
      completedAt: attempt.completed_at as string, // غير null: مُرشَّح على status = completed
    },
    review: (rows ?? []).map((row) => ({
      text: row.question_text,
      difficulty: row.difficulty as GameDifficulty,
      selectedAnswer: row.selected_answer,
      correctAnswer: row.correct_answer ?? "",
      isCorrect: Boolean(row.is_correct),
    })),
  };
}

/** لبطاقة «النشاط الأخير» في رئيسية الطالبة: آخر محاولة مكتملة لكل لعبة. */
export async function fetchLatestGamesSummary(
  studentId: string
): Promise<{ gameId: GameId; attemptId: string; completedAt: string; percentage: number }[]> {
  const { data } = await supabase
    .from("game_attempts")
    .select("id, game_id, percentage, completed_at")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  const seen = new Set<GameId>();
  const out: { gameId: GameId; attemptId: string; completedAt: string; percentage: number }[] = [];
  for (const row of data ?? []) {
    const gameId = row.game_id as GameId;
    if (seen.has(gameId)) continue;
    seen.add(gameId);
    out.push({
      gameId,
      attemptId: row.id,
      completedAt: row.completed_at as string,
      percentage: Math.round(Number(row.percentage ?? 0)),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// مسار المعلمة (قراءة فقط — المعلمة لا تبدأ الألعاب)
// ---------------------------------------------------------------------------

export interface TeacherGameRow {
  studentId: string;
  gameId: GameId;
  skill: string;
  /** عدد المحاولات المكتملة. */
  attemptsCount: number;
  lastAttemptId: string;
  lastCorrect: number;
  lastWrong: number;
  lastTotal: number;
  lastPercentage: number;
  lastDurationSeconds: number | null;
  lastPlayedAt: string;
  bestPercentage: number;
  bestCorrect: number;
}

/** لكل طالبة ولكل لعبة: عدد المحاولات وآخر نتيجة وأفضل نتيجة — صفوف حقيقية فقط،
 *  لا شيء للطالبات اللواتي لم يلعبن. مفتاح الخريطة: studentId ثم gameId. */
export async function fetchClassGameOverview(
  studentIds: string[]
): Promise<Map<string, Partial<Record<GameId, TeacherGameRow>>>> {
  const overview = new Map<string, Partial<Record<GameId, TeacherGameRow>>>();
  if (studentIds.length === 0) return overview;

  const { data: rows } = await supabase
    .from("game_attempts")
    .select(
      "id, student_id, game_id, skill, total_questions, correct_answers, wrong_answers, percentage, duration_seconds, completed_at"
    )
    .in("student_id", studentIds)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  for (const row of rows ?? []) {
    const gameId = row.game_id as GameId;
    const percentage = Math.round(Number(row.percentage ?? 0));
    const perStudent = overview.get(row.student_id) ?? {};
    const existing = perStudent[gameId];

    if (!existing) {
      // الصفوف مرتّبة من الأحدث، فأول صف نصادفه هو آخر محاولة.
      perStudent[gameId] = {
        studentId: row.student_id,
        gameId,
        skill: row.skill,
        attemptsCount: 1,
        lastAttemptId: row.id,
        lastCorrect: row.correct_answers,
        lastWrong: row.wrong_answers,
        lastTotal: row.total_questions,
        lastPercentage: percentage,
        lastDurationSeconds: row.duration_seconds,
        lastPlayedAt: row.completed_at as string,
        bestPercentage: percentage,
        bestCorrect: row.correct_answers,
      };
    } else {
      existing.attemptsCount += 1;
      if (percentage > existing.bestPercentage) {
        existing.bestPercentage = percentage;
        existing.bestCorrect = row.correct_answers;
      }
    }
    overview.set(row.student_id, perStudent);
  }
  return overview;
}

export interface TeacherGameDetail {
  skill: string;
  attemptsCount: number;
  bestPercentage: number;
  /** آخر المحاولات المكتملة (الأحدث أولًا). */
  history: {
    attemptId: string;
    attemptNumber: number;
    completedAt: string;
    correct: number;
    total: number;
    percentage: number;
    durationSeconds: number | null;
  }[];
  /** أخطاء آخر محاولة، بنص المسألة والإجابتين. */
  mistakes: GameReviewItem[];
  /** دقة الطالبة حسب مستوى الصعوبة في آخر محاولة. */
  byDifficulty: { difficulty: GameDifficulty; correct: number; total: number }[];
}

export async function fetchStudentGameDetail(
  studentId: string,
  gameId: GameId
): Promise<TeacherGameDetail | null> {
  const { data: attempts } = await supabase
    .from("game_attempts")
    .select(
      "id, skill, attempt_number, total_questions, correct_answers, percentage, duration_seconds, completed_at"
    )
    .eq("student_id", studentId)
    .eq("game_id", gameId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(30);

  const list = attempts ?? [];
  const latest = list[0];
  if (!latest) return null;

  const { data: rows } = await supabase
    .from("game_attempt_questions")
    .select("question_text, difficulty, selected_answer, correct_answer, is_correct, question_order")
    .eq("attempt_id", latest.id)
    .order("question_order", { ascending: true });

  const review: GameReviewItem[] = (rows ?? []).map((row) => ({
    text: row.question_text,
    difficulty: row.difficulty as GameDifficulty,
    selectedAnswer: row.selected_answer,
    correctAnswer: row.correct_answer ?? "",
    isCorrect: Boolean(row.is_correct),
  }));

  const byDifficulty = (["easy", "medium", "hard"] as GameDifficulty[])
    .map((difficulty) => {
      const group = review.filter((r) => r.difficulty === difficulty);
      return { difficulty, total: group.length, correct: group.filter((r) => r.isCorrect).length };
    })
    .filter((g) => g.total > 0);

  return {
    skill: latest.skill,
    attemptsCount: list.length,
    bestPercentage: Math.max(...list.map((a) => Math.round(Number(a.percentage ?? 0)))),
    history: list.slice(0, 8).map((a) => ({
      attemptId: a.id,
      attemptNumber: a.attempt_number,
      completedAt: a.completed_at as string,
      correct: a.correct_answers,
      total: a.total_questions,
      percentage: Math.round(Number(a.percentage ?? 0)),
      durationSeconds: a.duration_seconds,
    })),
    mistakes: review.filter((r) => !r.isCorrect),
    byDifficulty,
  };
}
