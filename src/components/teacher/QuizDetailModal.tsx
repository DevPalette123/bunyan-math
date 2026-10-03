import { useEffect, useState } from "react";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { formatRelativeArabicTime } from "../../utils/relativeTime";
import { fetchStudentQuizDetail, type TeacherQuizDetail } from "../../lib/quiz";
import { formatArabicText, skillLabel } from "../../lib/discover";
import { CloseIcon, StarIcon, TimerIcon } from "../icons/Glyphs";
import Avatar from "./Avatar";

interface QuizDetailModalProps {
  studentId: string;
  studentName: string;
  onClose: () => void;
}

const SKILL_LEVEL_CLASS: Record<string, string> = {
  "متقن": "bg-mint-50 text-mint-600",
  "جيد": "bg-sun-50 text-sun-600",
  "يحتاج تدريب": "bg-rose-50 text-rose-500",
};

function durationLabel(startedAt: string, completedAt: string): string {
  const seconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${toArabicDigits(minutes)} د ${toArabicDigits(rest)} ث`;
}

// علامات المقارنة داخل جملة عربية تُعرض باتجاه ثابت (LTR) حتى لا تنعكس.
function AnswerText({ value }: { value: string }) {
  if (value === "<" || value === ">" || value === "=") {
    return (
      <span dir="ltr" className="font-bold">
        {value}
      </span>
    );
  }
  return <>{formatArabicText(value)}</>;
}

export default function QuizDetailModal({ studentId, studentName, onClose }: QuizDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TeacherQuizDetail | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchStudentQuizDetail(studentId).then((data) => {
      if (isMounted) {
        setDetail(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lift p-6 sm:p-7 animate-pop-in max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Avatar name={studentName} className="w-11 h-11 text-base" />
            <div>
              <p className="text-[11px] font-bold text-slate-400">اختبر — آخر محاولة</p>
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
          <p className="text-sm text-slate-500">لم تُجرِ هذه الطالبة اختبار «اختبر» بعد.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-teach-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">الدرجة</p>
                <p className="text-xl font-extrabold text-teach-600">
                  {toArabicDigits(detail.correctAnswers)} / {toArabicDigits(detail.totalQuestions)}
                </p>
              </div>
              <div className="bg-mint-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-500 mb-1">النسبة والمستوى</p>
                <p className="text-xl font-extrabold text-mint-600">{toArabicDigits(detail.percentage)}٪</p>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">{detail.level}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-xl p-2.5">
                <p className="text-sm font-extrabold text-mint-600">{toArabicDigits(detail.correctAnswers)}</p>
                <p className="text-[10.5px] font-bold text-slate-500">صحيحة</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <p className="text-sm font-extrabold text-rose-500">{toArabicDigits(detail.wrongAnswers)}</p>
                <p className="text-[10.5px] font-bold text-slate-500">خاطئة</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <p className="text-sm font-extrabold text-sun-600">{toArabicDigits(detail.bestStreak)}</p>
                <p className="text-[10.5px] font-bold text-slate-500">أطول سلسلة</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <StarIcon className="w-3.5 h-3.5 text-sun-500" />
                {toArabicDigits(detail.pointsAwarded)} نجوم مكتسبة
              </span>
              <span className="flex items-center gap-1.5">
                <TimerIcon className="w-3.5 h-3.5" />
                {durationLabel(detail.startedAt, detail.completedAt)}
              </span>
              <span>{formatRelativeArabicTime(detail.completedAt)}</span>
            </div>

            {detail.history.length > 1 && (
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
                          className={`block h-full rounded-full ${i === 0 ? "bg-teach-500" : "bg-teach-300"}`}
                          style={{ width: `${h.percentage}%` }}
                        />
                      </span>
                      <span className="w-9 shrink-0 text-end text-[11px] font-extrabold text-slate-600">
                        {toArabicDigits(h.percentage)}٪
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="text-sm font-extrabold text-slate-900 mb-2">تحليل المهارات</h3>
              <ul className="flex flex-col gap-2 list-none">
                {detail.skills.map((s) => (
                  <li key={s.skill} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">{skillLabel(s.skill)}</span>
                    <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${SKILL_LEVEL_CLASS[s.level]}`}>
                      {s.level}
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
                      <p className="text-[11px] font-bold text-slate-400 mb-0.5">{skillLabel(m.skill)}</p>
                      <p className="text-xs font-extrabold text-slate-800 mb-1.5">{formatArabicText(m.text)}</p>
                      <p className="text-[11px] font-bold text-rose-500">
                        إجابتها: {m.selectedAnswer ? <AnswerText value={m.selectedAnswer} /> : "لم تُجب"}
                      </p>
                      <p className="text-[11px] font-bold text-mint-600">
                        الصحيحة: <AnswerText value={m.correctAnswer} />
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
