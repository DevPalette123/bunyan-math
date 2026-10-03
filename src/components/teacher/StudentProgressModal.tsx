import { useEffect, useState } from "react";
import type React from "react";
import { supabase } from "../../lib/supabaseClient";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { formatRelativeArabicTime } from "../../utils/relativeTime";
import { lessons } from "../../data/lessons";
import { practiceLessons } from "../../data/practiceLessons";
import { initiatives } from "../../data/initiatives";
import { fetchStudentPlacementDetail, type TeacherPlacementDetail } from "../../lib/discover";
import { fetchStudentQuizDetail, type TeacherQuizDetail } from "../../lib/quiz";
import { fetchClassGameOverview, type GameId, type TeacherGameRow } from "../../lib/games";
import { GAME_THEMES } from "../../data/playGameThemes";
import {
  BadgeAwardIcon,
  BookIcon,
  CheckCircleIcon,
  CircleOutlineIcon,
  ClipboardCheckIcon,
  ClockIcon,
  CloseIcon,
  PencilIcon,
  PlayGameIcon,
  SparkleIcon,
  StarIcon,
  TrophyIcon,
} from "../icons/Glyphs";
import Avatar from "./Avatar";
import ProgressBar from "./ProgressBar";
import { LEVEL_CLASS } from "./ResultCard";
import { PercentRing, levelColor } from "./TeacherUI";

interface StudentProgressModalProps {
  studentId: string;
  studentName: string;
  stars: number;
  onClose: () => void;
}

interface TaskProgressRow {
  id: string;
  status: "not_started" | "in_progress" | "completed";
  task_title: string;
}

interface EarnedBadge {
  id: string;
  name: string;
  description: string | null;
  earned_at: string;
}

export default function StudentProgressModal({
  studentId,
  studentName,
  stars,
  onClose,
}: StudentProgressModalProps) {
  const [loading, setLoading] = useState(true);
  const [taskRows, setTaskRows] = useState<TaskProgressRow[]>([]);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [practiceCompleted, setPracticeCompleted] = useState(0);
  const [completedInitiativeIds, setCompletedInitiativeIds] = useState<string[]>([]);
  // undefined = still loading, null = checked and no attempt exists yet
  const [placementDetail, setPlacementDetail] = useState<TeacherPlacementDetail | null | undefined>(
    undefined
  );
  const [quizDetail, setQuizDetail] = useState<TeacherQuizDetail | null | undefined>(undefined);
  const [gameOverview, setGameOverview] = useState<Partial<Record<GameId, TeacherGameRow>> | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [{ data: assignments }, { data: earnedBadges }, { count: lessonCount }, { count: practiceCount }, { data: initiativeRows }, placement, quiz, games] =
        await Promise.all([
          supabase
            .from("task_assignments")
            .select("id, status, tasks(title)")
            .eq("student_id", studentId),
          supabase
            .from("student_badges")
            .select("id, earned_at, badges(name, description)")
            .eq("student_id", studentId),
          supabase
            .from("lesson_completions")
            .select("id", { count: "exact", head: true })
            .eq("student_id", studentId),
          supabase
            .from("practice_completions")
            .select("id", { count: "exact", head: true })
            .eq("student_id", studentId),
          supabase
            .from("initiative_completions")
            .select("initiative_id")
            .eq("student_id", studentId),
          fetchStudentPlacementDetail(studentId),
          fetchStudentQuizDetail(studentId),
          fetchClassGameOverview([studentId]).then((m) => m.get(studentId) ?? null),
        ]);

      if (!isMounted) return;

      setTaskRows(
        (assignments ?? []).map((row: any) => ({
          id: row.id,
          status: row.status,
          task_title: row.tasks?.title ?? "مهمة",
        }))
      );
      setBadges(
        (earnedBadges ?? []).map((row: any) => ({
          id: row.id,
          name: row.badges?.name ?? "شارة",
          description: row.badges?.description ?? null,
          earned_at: row.earned_at,
        }))
      );
      setLessonsCompleted(lessonCount ?? 0);
      setPracticeCompleted(practiceCount ?? 0);
      setCompletedInitiativeIds((initiativeRows ?? []).map((r: any) => r.initiative_id as string));
      setPlacementDetail(placement);
      setQuizDetail(quiz);
      setGameOverview(games);
      setLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const completedCount = taskRows.filter((t) => t.status === "completed").length;
  const activeInitiatives = initiatives.filter((i) => i.kind !== "coming-soon");
  const initiativesDone = activeInitiatives.filter((i) => completedInitiativeIds.includes(i.id)).length;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm sm:px-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-5xl bg-slate-50 rounded-t-4xl sm:rounded-4xl shadow-lift animate-pop-in max-h-[94vh] sm:max-h-[90vh] overflow-y-auto">
        {/* الترويسة */}
        <div
          className="relative overflow-hidden px-5 sm:px-8 py-5 sm:py-6 rounded-t-4xl"
          style={{ background: "linear-gradient(135deg, #233D4A 0%, #3E6478 60%, #5B7C8D 100%)" }}
        >
          <span className="pointer-events-none absolute -top-14 -start-10 w-48 h-48 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-4">
            <Avatar name={studentName} className="w-14 h-14 sm:w-16 sm:h-16 text-2xl !bg-white !text-teach-600 shadow-soft" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-teach-100">ملف تقدّم الطالب</p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-tight break-words">{studentName}</h2>
            </div>
            <span className="hidden sm:flex items-center gap-1.5 bg-white/15 text-white font-extrabold text-base rounded-2xl px-4 py-2.5 shrink-0">
              <StarIcon className="w-5 h-5 text-sun-400" />
              {toArabicDigits(stars)} نجمة
            </span>
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/15 text-white hover:bg-white/25 transition-colors shrink-0"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="w-9 h-9 rounded-full border-4 border-teach-100 border-t-teach-500 animate-spin" />
            <p className="text-sm font-bold text-slate-500">جارٍ التحميل...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:gap-5 p-4 sm:p-7">
            {/* ملخص سريع */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "النقاط", value: toArabicDigits(stars), Icon: StarIcon, grad: "from-sun-400 to-sun-600" },
                {
                  label: "المهام المكتملة",
                  value: `${toArabicDigits(completedCount)}/${toArabicDigits(taskRows.length)}`,
                  Icon: ClipboardCheckIcon,
                  grad: "from-mint-400 to-mint-600",
                },
                { label: "الشارات", value: toArabicDigits(badges.length), Icon: BadgeAwardIcon, grad: "from-lilac-400 to-lilac-500" },
                {
                  label: "المبادرات",
                  value: `${toArabicDigits(initiativesDone)}/${toArabicDigits(activeInitiatives.length)}`,
                  Icon: TrophyIcon,
                  grad: "from-teach-400 to-teach-600",
                },
              ].map(({ label, value, Icon, grad }) => (
                <div key={label} className="flex items-center gap-3 bg-white rounded-3xl shadow-soft p-4">
                  <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} text-white flex items-center justify-center shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold text-slate-900 leading-none tabular-nums">{value}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {/* التعلّم والتدريب */}
              <Card icon={<BookIcon className="w-5 h-5" />} tone="bg-teach-50 text-teach-500" title="التعلّم والتدريب">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <BookIcon className="w-4 h-4 text-teach-500" /> تعلّم — الدروس
                      </span>
                      <span className="text-slate-500">
                        {toArabicDigits(lessonsCompleted)} من {toArabicDigits(lessons.length)}
                      </span>
                    </div>
                    <ProgressBar
                      percent={pct(lessonsCompleted, lessons.length)}
                      barClassName="bg-gradient-to-l from-teach-400 to-teach-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <PencilIcon className="w-4 h-4 text-mint-600" /> تدرّب — التدريبات
                      </span>
                      <span className="text-slate-500">
                        {toArabicDigits(practiceCompleted)} من {toArabicDigits(practiceLessons.length)}
                      </span>
                    </div>
                    <ProgressBar percent={pct(practiceCompleted, practiceLessons.length)} />
                  </div>
                </div>
              </Card>

              {/* المبادرات */}
              <Card icon={<TrophyIcon className="w-5 h-5" />} tone="bg-lilac-50 text-lilac-500" title="المبادرات">
                <ul className="flex flex-col gap-2 list-none">
                  {activeInitiatives.map((i) => {
                    const done = completedInitiativeIds.includes(i.id);
                    return (
                      <li
                        key={i.id}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${done ? "bg-mint-50" : "bg-slate-50"}`}
                      >
                        <img src={i.icon} alt="" className={`w-9 h-9 object-contain shrink-0 ${done ? "" : "grayscale opacity-60"}`} />
                        <span className="flex-1 text-sm font-bold text-slate-800 truncate">{i.title}</span>
                        {done ? (
                          <span className="flex items-center gap-1 text-[11px] font-extrabold text-mint-600 shrink-0">
                            <CheckCircleIcon className="w-4 h-4" /> أكملتها
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-extrabold text-slate-400 shrink-0">
                            <CircleOutlineIcon className="w-4 h-4" /> لم تبدأ
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>

              {/* المهام */}
              <Card
                icon={<ClipboardCheckIcon className="w-5 h-5" />}
                tone="bg-mint-50 text-mint-600"
                title="المهام"
                aside={
                  taskRows.length > 0 && (
                    <span className="text-[11px] font-extrabold text-mint-600 bg-mint-50 rounded-full px-2.5 py-1">
                      {toArabicDigits(pct(completedCount, taskRows.length))}٪ إنجاز
                    </span>
                  )
                }
              >
                {taskRows.length === 0 ? (
                  <Empty text="لم تُعيَّن أي مهمة لهذا الطالب بعد." />
                ) : (
                  <ul className="flex flex-col gap-2 list-none">
                    {taskRows.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-2xl px-3.5 py-2.5">
                        <span className="text-sm font-bold text-slate-800 min-w-0 break-words">{t.task_title}</span>
                        {t.status === "completed" ? (
                          <span className="flex items-center gap-1 text-[11px] font-extrabold text-mint-600 bg-mint-50 rounded-full px-2.5 py-1 shrink-0">
                            <CheckCircleIcon className="w-3.5 h-3.5" /> مكتملة
                          </span>
                        ) : t.status === "in_progress" ? (
                          <span className="flex items-center gap-1 text-[11px] font-extrabold text-sun-600 bg-sun-50 rounded-full px-2.5 py-1 shrink-0">
                            <ClockIcon className="w-3.5 h-3.5" /> قيد الإنجاز
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-extrabold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1 shrink-0">
                            <CircleOutlineIcon className="w-3.5 h-3.5" /> لم تبدأ
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* الشارات */}
              <Card
                icon={<BadgeAwardIcon className="w-5 h-5" />}
                tone="bg-lilac-50 text-lilac-500"
                title="الشارات"
                aside={
                  badges.length > 0 && (
                    <span className="text-[11px] font-extrabold text-lilac-500 bg-lilac-50 rounded-full px-2.5 py-1">
                      {toArabicDigits(badges.length)}
                    </span>
                  )
                }
              >
                {badges.length === 0 ? (
                  <Empty text="لم يحصل الطالب على أي شارة بعد." />
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-none">
                    {badges.map((b) => (
                      <li key={b.id} className="flex items-center gap-2.5 bg-lilac-50 rounded-2xl px-3 py-2.5">
                        <span className="w-9 h-9 rounded-xl bg-white text-lilac-500 flex items-center justify-center shrink-0 shadow-soft">
                          <BadgeAwardIcon className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-extrabold text-slate-800 leading-snug">{b.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* اكتشف */}
              <Card icon={<SparkleIcon className="w-5 h-5" />} tone="bg-teach-50 text-teach-500" title="اكتشف — تحديد المستوى">
                {placementDetail === undefined ? (
                  <Empty text="جارٍ التحميل..." />
                ) : placementDetail === null ? (
                  <Empty text="لم يبدأ الطالب هذا القسم بعد." />
                ) : (
                  <ResultRow
                    percent={placementDetail.percentage}
                    level={placementDetail.level}
                    score={`${toArabicDigits(placementDetail.correctAnswers)}/${toArabicDigits(placementDetail.totalQuestions)}`}
                    when={formatRelativeArabicTime(placementDetail.completedAt)}
                  />
                )}
              </Card>

              {/* اختبر */}
              <Card icon={<ClipboardCheckIcon className="w-5 h-5" />} tone="bg-lilac-50 text-lilac-500" title="اختبر">
                {quizDetail === undefined ? (
                  <Empty text="جارٍ التحميل..." />
                ) : quizDetail === null ? (
                  <Empty text="لم تبدأ الطالبة هذا القسم بعد." />
                ) : (
                  <ResultRow
                    percent={quizDetail.percentage}
                    level={quizDetail.level}
                    score={`${toArabicDigits(quizDetail.correctAnswers)}/${toArabicDigits(quizDetail.totalQuestions)}`}
                    when={formatRelativeArabicTime(quizDetail.completedAt)}
                  />
                )}
              </Card>
            </div>

            {/* الألعاب */}
            <Card icon={<PlayGameIcon className="w-5 h-5" />} tone="bg-sun-50 text-sun-600" title="ألعب — الألعاب">
              {gameOverview === undefined ? (
                <Empty text="جارٍ التحميل..." />
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 list-none">
                  {(Object.keys(GAME_THEMES) as GameId[]).map((id) => {
                    const row = gameOverview?.[id];
                    return (
                      <li key={id} className="flex flex-col gap-2.5 bg-slate-50 rounded-2xl p-3.5">
                        <p className="text-sm font-extrabold text-slate-900 leading-snug">{GAME_THEMES[id].title}</p>
                        {row ? (
                          <>
                            <div className="flex items-end justify-between">
                              <p className="text-2xl font-extrabold text-teach-600 leading-none">
                                {toArabicDigits(row.lastPercentage)}٪
                              </p>
                              <p className="text-[11px] font-bold text-slate-500">
                                {toArabicDigits(row.lastCorrect)}/{toArabicDigits(row.lastTotal)}
                              </p>
                            </div>
                            <ProgressBar percent={row.lastPercentage} barClassName="bg-gradient-to-l from-teach-400 to-teach-500" />
                            <p className="text-[11px] font-bold text-slate-500">
                              {toArabicDigits(row.attemptsCount)} محاولات · أفضل {toArabicDigits(row.bestPercentage)}٪
                            </p>
                          </>
                        ) : (
                          <p className="text-xs font-bold text-slate-400 py-2">لم تلعب بعد</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  icon,
  tone,
  title,
  aside,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl shadow-soft p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="flex items-center gap-2.5 text-base font-extrabold text-slate-900">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}>{icon}</span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl px-4 py-4 text-center">{text}</p>;
}

function ResultRow({ percent, level, score, when }: { percent: number; level: string; score: string; when: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-16 h-16 shrink-0">
        <PercentRing percent={percent} size={64} stroke={7} color={levelColor(level)} />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-slate-800">
          {toArabicDigits(percent)}٪
        </span>
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className={`self-start text-[11px] font-extrabold px-2.5 py-1 rounded-full ${LEVEL_CLASS[level] ?? "bg-slate-100 text-slate-600"}`}>
          {level}
        </span>
        <span className="text-xs font-bold text-slate-600">الإجابات الصحيحة: {score}</span>
        <span className="text-[11px] font-bold text-slate-400">آخر محاولة {when}</span>
      </div>
    </div>
  );
}
