import { useEffect, useState } from "react";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { formatRelativeArabicTime } from "../../utils/relativeTime";
import { fetchStudentGameDetail, type GameId, type TeacherGameDetail } from "../../lib/games";
import { GAME_THEMES, formatDuration } from "../../data/playGameThemes";
import { formatArabicText } from "../../lib/discover";
import { CloseIcon } from "../icons/Glyphs";
import Avatar from "./Avatar";

interface GameDetailModalProps {
  studentId: string;
  studentName: string;
  gameId: GameId;
  onClose: () => void;
}

const TIER_LABEL: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };

export default function GameDetailModal({ studentId, studentName, gameId, onClose }: GameDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TeacherGameDetail | null>(null);
  const theme = GAME_THEMES[gameId];

  useEffect(() => {
    let isMounted = true;
    fetchStudentGameDetail(studentId, gameId).then((data) => {
      if (isMounted) {
        setDetail(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [studentId, gameId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lift p-6 sm:p-7 animate-pop-in max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Avatar name={studentName} className="w-11 h-11 text-base" />
            <div>
              <p className="text-[11px] font-bold text-slate-400">{theme.title} — آخر محاولة</p>
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

        {loading ? (
          <p className="text-sm text-slate-500">جارٍ التحميل...</p>
        ) : !detail ? (
          <p className="text-sm text-slate-500">لم تلعب هذه الطالبة «{theme.title}» بعد.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-teach-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">أفضل نتيجة</p>
                <p className="text-xl font-extrabold text-teach-600">{toArabicDigits(detail.bestPercentage)}٪</p>
              </div>
              <div className="bg-mint-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">عدد المحاولات</p>
                <p className="text-xl font-extrabold text-mint-600">{toArabicDigits(detail.attemptsCount)}</p>
              </div>
            </div>

            {detail.byDifficulty.length > 0 && (
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-2">الدقة حسب مستوى الصعوبة (آخر محاولة)</h3>
                <ul className="flex flex-col gap-1.5 list-none">
                  {detail.byDifficulty.map((d) => (
                    <li key={d.difficulty} className="flex items-center gap-2.5">
                      <span className="w-14 shrink-0 text-[11px] font-bold text-slate-500">{TIER_LABEL[d.difficulty]}</span>
                      <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-teach-500"
                          style={{ width: `${(d.correct / Math.max(d.total, 1)) * 100}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-end text-[11px] font-extrabold text-slate-600">
                        {toArabicDigits(d.correct)}/{toArabicDigits(d.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="text-sm font-extrabold text-slate-900 mb-2">آخر المحاولات</h3>
              <ul className="flex flex-col gap-1.5 list-none">
                {detail.history.map((h, i) => (
                  <li key={h.attemptId} className="flex items-center gap-2.5">
                    <span className="w-20 shrink-0 text-[11px] font-bold text-slate-400">
                      {formatRelativeArabicTime(h.completedAt)}
                    </span>
                    <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <span
                        className={`block h-full rounded-full ${i === 0 ? "bg-berry-500" : "bg-berry-300"}`}
                        style={{ width: `${h.percentage}%` }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-end text-[11px] font-extrabold text-slate-600">
                      {toArabicDigits(h.percentage)}٪
                    </span>
                    <span className="w-14 shrink-0 text-end text-[11px] font-bold text-slate-400">
                      {formatDuration(h.durationSeconds)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-slate-900 mb-2">أخطاء آخر محاولة</h3>
              {detail.mistakes.length === 0 ? (
                <p className="text-xs font-bold text-mint-600">لا أخطاء — أجابت على كل الأسئلة إجابة صحيحة.</p>
              ) : (
                <ul className="flex flex-col gap-2 list-none">
                  {detail.mistakes.map((m, i) => (
                    <li key={i} className="rounded-2xl bg-slate-50 p-3.5">
                      <p className="text-[11px] font-bold text-slate-400 mb-0.5">{TIER_LABEL[m.difficulty]}</p>
                      <p className="text-xs font-extrabold text-slate-800 mb-1.5" dir="ltr">
                        <span dir="rtl">{formatArabicText(m.text)}</span>
                      </p>
                      <p className="text-[11px] font-bold text-rose-500">
                        إجابتها: {m.selectedAnswer ? toArabicDigits(m.selectedAnswer) : "لم تُجب"}
                      </p>
                      <p className="text-[11px] font-bold text-mint-600">
                        الصحيحة: {toArabicDigits(m.correctAnswer)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
