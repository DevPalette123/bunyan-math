// نتائج ألعاب «ألعب» الجديدة (data/funGames.ts): تُحفَظ عبر دالة الخادم
// record_fun_game_result (انظر supabase/phase8-fun-games.sql) وتُقرأ للمعلمة
// من جدول fun_game_results — قراءة فقط، والمعلمة لا تلعب.

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import type { FunGameId } from "../data/funGames";

/** يسجّل نتيجة لعبة مكتملة. يعيد عدد النجوم المضافة للرصيد (٠ إن سبق اللعب اليوم). */
export async function recordFunGameResult(
  gameId: FunGameId,
  stars: number,
  mistakes: number,
  durationSeconds: number
): Promise<{ points: number } | { error: string }> {
  if (!isSupabaseConfigured) return { error: "غير متصل بقاعدة البيانات." };
  const { data, error } = await supabase.rpc("record_fun_game_result", {
    p_game_id: gameId,
    p_stars: stars,
    p_mistakes: mistakes,
    p_duration_seconds: Math.round(durationSeconds),
  });
  if (error) return { error: error.message };
  return { points: Number(data ?? 0) };
}

/**
 * أفضل نتيجة (١–٣ نجوم) لكل لعبة للطالبة الحالية فقط، من جدول fun_game_results.
 * الألعاب التي لم تُلعب بعد لا تظهر في الناتج (أي أن أفضل نتيجة لها ٠).
 * يعيد null عند تعذّر الجلب، ليعرض المستدعي ٠ نجوم بدل أي قيمة قديمة.
 */
export async function fetchMyBestStars(studentId: string): Promise<Partial<Record<FunGameId, number>> | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("fun_game_results")
    .select("game_id, stars")
    .eq("student_id", studentId);
  if (error) return null;

  const best: Partial<Record<FunGameId, number>> = {};
  for (const row of data ?? []) {
    const gameId = row.game_id as FunGameId;
    const stars = Math.max(0, Math.min(3, Number(row.stars) || 0));
    if (stars > (best[gameId] ?? 0)) best[gameId] = stars;
  }
  return best;
}

export interface TeacherFunRow {
  studentId: string;
  gameId: FunGameId;
  attemptsCount: number;
  lastStars: number;
  lastMistakes: number;
  lastDurationSeconds: number | null;
  lastPlayedAt: string;
  bestStars: number;
}

/** لكل طالبة ولكل لعبة: عدد مرات اللعب وآخر نتيجة وأفضل نجوم — صفوف حقيقية فقط. */
export async function fetchClassFunOverview(
  studentIds: string[]
): Promise<Map<string, Partial<Record<FunGameId, TeacherFunRow>>>> {
  const overview = new Map<string, Partial<Record<FunGameId, TeacherFunRow>>>();
  if (studentIds.length === 0 || !isSupabaseConfigured) return overview;

  const { data: rows } = await supabase
    .from("fun_game_results")
    .select("student_id, game_id, stars, mistakes, duration_seconds, played_at")
    .in("student_id", studentIds)
    .order("played_at", { ascending: false });

  for (const row of rows ?? []) {
    const gameId = row.game_id as FunGameId;
    const perStudent = overview.get(row.student_id) ?? {};
    const existing = perStudent[gameId];
    if (!existing) {
      // مرتّبة من الأحدث: أول صف هو آخر لعبة.
      perStudent[gameId] = {
        studentId: row.student_id,
        gameId,
        attemptsCount: 1,
        lastStars: row.stars,
        lastMistakes: row.mistakes,
        lastDurationSeconds: row.duration_seconds,
        lastPlayedAt: row.played_at as string,
        bestStars: row.stars,
      };
    } else {
      existing.attemptsCount += 1;
      if (row.stars > existing.bestStars) existing.bestStars = row.stars;
    }
    overview.set(row.student_id, perStudent);
  }
  return overview;
}

export interface FunHistoryItem {
  id: string;
  stars: number;
  mistakes: number;
  durationSeconds: number | null;
  playedAt: string;
}

/** آخر ٢٠ لعبة لطالبة في لعبة واحدة (الأحدث أولًا). */
export async function fetchStudentFunHistory(studentId: string, gameId: FunGameId): Promise<FunHistoryItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("fun_game_results")
    .select("id, stars, mistakes, duration_seconds, played_at")
    .eq("student_id", studentId)
    .eq("game_id", gameId)
    .order("played_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({
    id: r.id,
    stars: r.stars,
    mistakes: r.mistakes,
    durationSeconds: r.duration_seconds,
    playedAt: r.played_at as string,
  }));
}
