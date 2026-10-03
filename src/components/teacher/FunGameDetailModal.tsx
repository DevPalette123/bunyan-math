import { useEffect, useState } from "react";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { formatRelativeArabicTime } from "../../utils/relativeTime";
import { fetchStudentFunHistory, type FunHistoryItem } from "../../lib/funGames";
import { findFunGame, type FunGameId } from "../../data/funGames";
import { formatDuration } from "../../data/playGameThemes";
import { playGames } from "../../data/playGames";
import { CloseIcon } from "../icons/Glyphs";
import Avatar from "./Avatar";

interface FunGameDetailModalProps {
  studentId: string;
  studentName: string;
  gameId: FunGameId;
  onClose: () => void;
}

const stars = (n: number) => "⭐".repeat(n) + "☆".repeat(3 - n);

export default function FunGameDetailModal({ studentId, studentName, gameId, onClose }: FunGameDetailModalProps) {
  const [history, setHistory] = useState<FunHistoryItem[] | null>(null);
  const game = findFunGame(gameId);
  const skill = playGames.find((g) => g.id === gameId)?.title ?? "";

  useEffect(() => {
    let isMounted = true;
    fetchStudentFunHistory(studentId, gameId).then((rows) => {
      if (isMounted) setHistory(rows);
    });
    return () => {
      isMounted = false;
    };
  }, [studentId, gameId]);

  const best = history?.length ? Math.max(...history.map((h) => h.stars)) : 0;
  const totalMistakes = history?.reduce((n, h) => n + h.mistakes, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lift p-6 sm:p-7 animate-pop-in max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Avatar name={studentName} className="w-11 h-11 text-base" />
            <div>
              <p className="text-[11px] font-bold text-slate-400">
                {skill} — {game?.emoji} {game?.title}
              </p>
              <h2 className="text-lg font-extrabold text-slate-900 leading-tight">{studentName}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors shrink-0"
          >
            <CloseIcon className="w-4.5 h-4.5" />
          </button>
        </div>

        {history === null ? (
          <p className="text-sm text-slate-500">جارٍ التحميل...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">لم تلعب هذه الطالبة «{game?.title}» بعد.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-teach-50 rounded-2xl p-3.5">
                <p className="text-[11px] font-bold text-slate-500 mb-1">أفضل نتيجة</p>
                <p className="text-sm font-extrabold">{stars(best)}</p>
              </div>
              <div className="bg-mint-50 rounded-2xl p-3.5">
                <p className="text-[11px] font-bold text-slate-500 mb-1">مرات اللعب</p>
                <p className="text-xl font-extrabold text-mint-600">{toArabicDigits(history.length)}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3.5">
                <p className="text-[11px] font-bold text-slate-500 mb-1">مجموع الأخطاء</p>
                <p className="text-xl font-extrabold text-rose-500">{toArabicDigits(totalMistakes)}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-slate-900 mb-2">آخر المحاولات</h3>
              <ul className="flex flex-col gap-1.5 list-none">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-2.5 text-[11px] font-bold">
                    <span className="w-20 shrink-0 text-slate-400">{formatRelativeArabicTime(h.playedAt)}</span>
                    <span className="flex-1 text-sm">{stars(h.stars)}</span>
                    <span className="shrink-0 text-rose-500">{toArabicDigits(h.mistakes)} أخطاء</span>
                    <span className="w-16 shrink-0 text-end text-slate-400">{formatDuration(h.durationSeconds)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
