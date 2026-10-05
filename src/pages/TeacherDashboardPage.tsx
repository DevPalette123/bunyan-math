import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logoMark from "../assets/logo/logo-mark.png";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { toArabicDigits } from "../utils/arabicNumerals";
import { initiatives } from "../data/initiatives";
import {
  BadgeAwardIcon,
  CheckCircleIcon,
  ClipboardCheckIcon,
  ClockIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  LogOutIcon,
  PencilIcon,
  PlusIcon,
  SparkleIcon,
  StarIcon,
  TrashIcon,
  TrophyIcon,
  UsersIcon,
} from "../components/icons/Glyphs";
import AddStudentModal from "../components/teacher/AddStudentModal";
import CreateTaskModal from "../components/teacher/CreateTaskModal";
import StudentProgressModal from "../components/teacher/StudentProgressModal";
import TeacherHero from "../components/teacher/TeacherHero";
import Avatar from "../components/teacher/Avatar";
import ProgressBar from "../components/teacher/ProgressBar";
import ConfirmDialog from "../components/teacher/ConfirmDialog";
import PlacementSection from "../components/teacher/PlacementSection";
import BrandFooter from "../components/BrandFooter";
import SchoolLogo from "../components/SchoolLogo";
import QuizSection from "../components/teacher/QuizSection";
import GamesSection from "../components/teacher/GamesSection";
import StarBoardSection from "../components/teacher/StarBoardSection";
import CompetitionsSection from "../components/teacher/CompetitionsSection";
import { EmptyState, SectionHeader, TONE_SOFT } from "../components/teacher/TeacherUI";

interface RosterStudent {
  id: string;
  full_name: string;
  login_code: string | null;
  stars: number;
  completedTasks: number;
  badgesCount: number;
  /** ids of initiatives (see data/initiatives.ts) this student really completed. */
  initiativeIds: string[];
}

interface WeeklyTask {
  id: string;
  title: string;
  task_type: string;
  points: number;
  due_date: string | null;
  assignedCount: number;
  completedCount: number;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  general: "عام",
  lesson: "درس",
  practice: "تدريب",
  quiz: "اختبار قصير",
};

const TASK_TYPE_STYLE: Record<string, string> = {
  general: "bg-slate-100 text-slate-600",
  lesson: "bg-teach-50 text-teach-600",
  practice: "bg-mint-50 text-mint-600",
  quiz: "bg-lilac-50 text-lilac-500",
};

type TabId = "overview" | "students" | "tasks" | "stars" | "results" | "competitions";
type ResultsTab = "discover" | "quiz" | "games";

const TABS: { id: TabId; label: string; Icon: (p: { className?: string }) => JSX.Element }[] = [
  { id: "overview", label: "نظرة عامة", Icon: SparkleIcon },
  { id: "students", label: "طلابي", Icon: UsersIcon },
  { id: "tasks", label: "المهام", Icon: ClipboardCheckIcon },
  { id: "stars", label: "لوحة النجوم", Icon: StarIcon },
  { id: "results", label: "النتائج", Icon: TrophyIcon },
  { id: "competitions", label: "🏆 المسابقات", Icon: TrophyIcon },
];

const RESULT_TABS: { id: ResultsTab; label: string }[] = [
  { id: "discover", label: "تحديد المستوى (اكتشف)" },
  { id: "quiz", label: "اختبر" },
  { id: "games", label: "الألعاب" },
];

export default function TeacherDashboardPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [editingClassName, setEditingClassName] = useState(false);
  const [classNameDraft, setClassNameDraft] = useState("");

  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [totalCompletedTasks, setTotalCompletedTasks] = useState(0);
  const [totalBadges, setTotalBadges] = useState(0);

  const [tab, setTab] = useState<TabId>("overview");
  const [resultsTab, setResultsTab] = useState<ResultsTab>("discover");

  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [progressStudent, setProgressStudent] = useState<RosterStudent | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingTaskDeleteId, setConfirmingTaskDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Set only on a genuine load failure (never on "zero rows found" — that is
  // a normal, valid result and stays represented by the empty states below).
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---------------------------------------------------------------------
  // Data layer. Every query below checks its own `error` explicitly — a
  // failed request is never allowed to fall through `?? []`/`?? null` and
  // be mistaken for "this teacher genuinely has no data yet". In
  // particular, the auto-create-a-class step only ever runs after the
  // lookup query has *succeeded* and *confirmed* zero rows — a failed
  // lookup returns immediately with loadError set, never creating anything.
  // ---------------------------------------------------------------------
  const loadDashboard = useCallback(async () => {
    if (!isSupabaseConfigured || !profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("id, name")
      .eq("teacher_id", profile.id)
      .limit(1)
      .maybeSingle();

    if (classError) {
      setLoadError("تعذّر تحميل بيانات صفك. تحقق من اتصالك وحاول مرة أخرى.");
      setLoading(false);
      return;
    }

    let activeClass = classRow;

    // Reached only when the lookup itself succeeded and genuinely returned
    // no row — a real "this teacher has no class yet" case, not a guess.
    if (!activeClass) {
      const { data: created, error: createError } = await supabase
        .from("classes")
        .insert({ teacher_id: profile.id, name: "صفي" })
        .select("id, name")
        .single();

      if (createError || !created) {
        setLoadError("تعذّر إنشاء صف جديد لك. حاول مرة أخرى.");
        setLoading(false);
        return;
      }
      activeClass = created;
    }

    setClassId(activeClass.id);
    setClassName(activeClass.name);

    const { data: studentRows, error: studentsError } = await supabase
      .from("students")
      .select("id, login_code, stars, profiles(full_name)")
      .eq("class_id", activeClass.id);

    if (studentsError) {
      setLoadError("تعذّر تحميل قائمة الطلاب. حاول مرة أخرى.");
      setLoading(false);
      return;
    }

    const studentIds = (studentRows ?? []).map((row: any) => row.id as string);

    const { data: taskRows, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title, task_type, points, due_date")
      .eq("class_id", activeClass.id)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (tasksError) {
      setLoadError("تعذّر تحميل المهام. حاول مرة أخرى.");
      setLoading(false);
      return;
    }

    const taskIds = (taskRows ?? []).map((row: any) => row.id as string);

    const [assignmentsResult, badgesResult, initiativesResult] = await Promise.all([
      taskIds.length > 0
        ? supabase.from("task_assignments").select("task_id, student_id, status").in("task_id", taskIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      studentIds.length > 0
        ? supabase.from("student_badges").select("student_id").in("student_id", studentIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      studentIds.length > 0
        ? supabase.from("initiative_completions").select("student_id, initiative_id").in("student_id", studentIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (assignmentsResult.error || badgesResult.error || initiativesResult.error) {
      setLoadError("تعذّر تحميل بيانات التقدم. حاول مرة أخرى.");
      setLoading(false);
      return;
    }

    const assignmentRows = assignmentsResult.data;
    const badgeRows = badgesResult.data;
    const initiativeRows = initiativesResult.data;

    const initiativesByStudent = new Map<string, string[]>();
    for (const row of initiativeRows ?? []) {
      const list = initiativesByStudent.get(row.student_id) ?? [];
      list.push(row.initiative_id as string);
      initiativesByStudent.set(row.student_id, list);
    }

    const completedByStudent = new Map<string, number>();
    const badgesByStudent = new Map<string, number>();
    let totalCompleted = 0;

    for (const row of assignmentRows ?? []) {
      if (row.status === "completed") {
        completedByStudent.set(row.student_id, (completedByStudent.get(row.student_id) ?? 0) + 1);
        totalCompleted += 1;
      }
    }
    for (const row of badgeRows ?? []) {
      badgesByStudent.set(row.student_id, (badgesByStudent.get(row.student_id) ?? 0) + 1);
    }

    setStudents(
      (studentRows ?? []).map((row: any) => ({
        id: row.id,
        full_name: row.profiles?.full_name ?? "بدون اسم",
        login_code: row.login_code,
        stars: row.stars,
        completedTasks: completedByStudent.get(row.id) ?? 0,
        badgesCount: badgesByStudent.get(row.id) ?? 0,
        initiativeIds: initiativesByStudent.get(row.id) ?? [],
      }))
    );

    setTasks(
      (taskRows ?? []).map((row: any) => {
        const rowsForTask = (assignmentRows ?? []).filter((a: any) => a.task_id === row.id);
        return {
          id: row.id,
          title: row.title,
          task_type: row.task_type,
          points: row.points,
          due_date: row.due_date,
          assignedCount: rowsForTask.length,
          completedCount: rowsForTask.filter((a: any) => a.status === "completed").length,
        };
      })
    );

    setTotalCompletedTasks(totalCompleted);
    setTotalBadges((badgeRows ?? []).length);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // تحديث هادئ للنجوم والشارات والمبادرات عند عودة المعلم للتبويب — حتى ترى
  // ما أنجزته الطلاب للتو دون إعادة تحميل الصفحة (ودون وميض شاشة التحميل).
  const refreshProgressQuietly = useCallback(async () => {
    if (!isSupabaseConfigured || !classId) return;
    const { data: rows } = await supabase.from("students").select("id, stars").eq("class_id", classId);
    if (!rows || rows.length === 0) return;
    const ids = rows.map((r: any) => r.id as string);
    const [badges, inits] = await Promise.all([
      supabase.from("student_badges").select("student_id").in("student_id", ids),
      supabase.from("initiative_completions").select("student_id, initiative_id").in("student_id", ids),
    ]);
    if (badges.error || inits.error) return;
    const starsById = new Map<string, number>(rows.map((r: any) => [r.id as string, r.stars as number]));
    const badgeCount = new Map<string, number>();
    for (const b of badges.data ?? []) badgeCount.set(b.student_id, (badgeCount.get(b.student_id) ?? 0) + 1);
    const initMap = new Map<string, string[]>();
    for (const i of inits.data ?? []) initMap.set(i.student_id, [...(initMap.get(i.student_id) ?? []), i.initiative_id as string]);
    setStudents((prev) =>
      prev
        ? prev.map((s) => ({
            ...s,
            stars: starsById.get(s.id) ?? s.stars,
            badgesCount: badgeCount.get(s.id) ?? 0,
            initiativeIds: initMap.get(s.id) ?? [],
          }))
        : prev
    );
    setTotalBadges((badges.data ?? []).length);
  }, [classId]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") refreshProgressQuietly();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshProgressQuietly]);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  function startEditingClassName() {
    setClassNameDraft(className);
    setEditingClassName(true);
  }

  async function saveClassName() {
    const trimmed = classNameDraft.trim();
    if (!trimmed || !classId) {
      setEditingClassName(false);
      return;
    }
    setEditingClassName(false);
    const previous = className;
    setClassName(trimmed); // optimistic
    const { error } = await supabase.from("classes").update({ name: trimmed }).eq("id", classId);
    if (error) {
      setClassName(previous);
      setActionError("تعذّر تحديث اسم الصف.");
    }
  }

  function toggleRevealed(id: string) {
    setRevealedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCopy(id: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Soft failure — the code is still visible on screen either way.
    }
  }

  async function handleDeleteStudent(id: string) {
    setDeletingId(id);
    setActionError(null);
    const { error } = await supabase.functions.invoke("delete-student", {
      body: { student_id: id },
    });
    setDeletingId(null);
    setConfirmingDeleteId(null);
    if (error) {
      setActionError("تعذّر حذف الطالب. حاول مرة أخرى.");
      return;
    }
    loadDashboard();
  }

  async function handleDeleteTask(id: string) {
    setActionError(null);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    setConfirmingTaskDeleteId(null);
    if (error) {
      setActionError("تعذّر حذف المهمة.");
      return;
    }
    loadDashboard();
  }

  const activeInitiatives = initiatives.filter((i) => i.kind !== "coming-soon");
  const totalStars = students?.reduce((sum, s) => sum + s.stars, 0) ?? 0;
  const rosterOptions = (students ?? []).map((s) => ({ id: s.id, full_name: s.full_name }));
  const studentBeingDeleted = students?.find((s) => s.id === confirmingDeleteId) ?? null;
  const taskBeingDeleted = tasks.find((t) => t.id === confirmingTaskDeleteId) ?? null;
  const topStudents = [...(students ?? [])].sort((a, b) => b.stars - a.stars).slice(0, 5);
  const hasStudents = !loading && !loadError && !!students && students.length > 0;

  const statCards = [
    { label: "عدد الطلاب", value: students?.length ?? 0, Icon: UsersIcon, grad: "from-teach-400 to-teach-600" },
    { label: "إجمالي النقاط", value: totalStars, Icon: StarIcon, grad: "from-sun-400 to-sun-600" },
    { label: "المهام المكتملة", value: totalCompletedTasks, Icon: ClipboardCheckIcon, grad: "from-mint-400 to-mint-600" },
    { label: "الشارات المكتسبة", value: totalBadges, Icon: BadgeAwardIcon, grad: "from-lilac-400 to-lilac-500" },
  ];

  const classChip = classId ? (
    <div className="inline-flex items-center gap-2 rounded-2xl bg-sand-100 ring-1 ring-sand-200 px-3.5 py-2.5">
      {editingClassName ? (
        <>
          <input
            autoFocus
            value={classNameDraft}
            onChange={(e) => setClassNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveClassName()}
            className="rounded-lg bg-white px-2.5 py-1 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-mint-400 w-36"
          />
          <button
            onClick={saveClassName}
            className="text-xs font-extrabold text-slate-900 bg-mint-100 hover:bg-mint-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            حفظ
          </button>
        </>
      ) : (
        <>
          <UsersIcon className="w-4 h-4 text-teach-400" />
          <span className="text-sm font-extrabold text-ink-900">الصف: {className}</span>
          <button
            onClick={startEditingClassName}
            aria-label="تعديل اسم الصف"
            className="text-ink-400 hover:text-teach-600 transition-colors"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  ) : null;

  const heroActions = hasStudents ? (
    <>
      <button
        onClick={() => setShowAddTask(true)}
        className="flex items-center gap-1.5 text-sm font-extrabold text-white bg-palm-500 hover:bg-palm-600 px-5 py-2.5 rounded-2xl shadow-soft transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        مهمة جديدة
      </button>
      <button
        onClick={() => setShowAddStudent(true)}
        className="flex items-center gap-1.5 text-sm font-extrabold text-teach-700 bg-white hover:bg-teach-50 ring-1 ring-teach-100 px-5 py-2.5 rounded-2xl transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        إضافة طالب
      </button>
    </>
  ) : null;

  function renderTaskCard(t: WeeklyTask) {
    const percent = t.assignedCount > 0 ? Math.round((t.completedCount / t.assignedCount) * 100) : 0;
    const done = t.assignedCount > 0 && t.completedCount === t.assignedCount;
    return (
      <li
        key={t.id}
        className="relative flex flex-col gap-3.5 bg-white rounded-3xl border border-slate-100 shadow-soft p-5 hover:shadow-card transition-shadow"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-2">
            <span
              className={`self-start text-[11px] font-extrabold px-2.5 py-1 rounded-full ${
                TASK_TYPE_STYLE[t.task_type] ?? TASK_TYPE_STYLE.general
              }`}
            >
              {TASK_TYPE_LABELS[t.task_type] ?? t.task_type}
            </span>
            <p className="text-base font-extrabold text-slate-900 leading-snug break-words">{t.title}</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingTaskDeleteId(t.id)}
            aria-label="حذف المهمة"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
          <span className="flex items-center gap-1 bg-sun-50 text-sun-600 rounded-full px-2.5 py-1">
            <StarIcon className="w-3.5 h-3.5" />
            {toArabicDigits(t.points)} نقاط
          </span>
          <span className="flex items-center gap-1 bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
            <UsersIcon className="w-3.5 h-3.5" />
            {toArabicDigits(t.assignedCount)} طالبًا
          </span>
          {t.due_date && (
            <span className="flex items-center gap-1 bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
              <ClockIcon className="w-3.5 h-3.5" />
              {t.due_date}
            </span>
          )}
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
            <span className={`flex items-center gap-1 ${done ? "text-mint-600" : "text-slate-500"}`}>
              {done && <CheckCircleIcon className="w-3.5 h-3.5" />}
              {toArabicDigits(t.completedCount)} من {toArabicDigits(t.assignedCount)} أكملوا
            </span>
            <span className="text-slate-700 font-extrabold">{toArabicDigits(percent)}٪</span>
          </div>
          <ProgressBar percent={percent} />
        </div>
      </li>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-teach-50 via-slate-50 to-slate-50">
      <header className="bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-3">
          <img src={logoMark} alt="بنيان الرياضيات" className="w-10 h-10 object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-extrabold text-slate-900 truncate">بنيان الرياضيات</h1>
            <p className="text-[11px] font-bold text-slate-500">لوحة المعلم</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-500 bg-rose-50/60 hover:bg-rose-50 px-3.5 py-2 rounded-xl transition-colors shrink-0"
          >
            <LogOutIcon className="w-4 h-4" />
            <span className="hidden sm:inline">تسجيل الخروج</span>
          </button>
        </div>
      </header>

      <SchoolLogo className="pt-4 pb-0" />

      <main className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-7 flex flex-col gap-6">
        <TeacherHero teacherName={profile?.full_name ?? ""} classSlot={classChip} actions={heroActions} />

        {!isSupabaseConfigured && (
          <section className="bg-sun-50 rounded-3xl p-6 text-sm font-bold text-slate-700 leading-relaxed">
            لوحة المعلم غير متصلة بمصدر بيانات حاليًا، لذلك لا يمكن عرض طلاب حقيقيين هنا.
          </section>
        )}

        {actionError && (
          <p role="alert" className="text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2.5">
            {actionError}
          </p>
        )}

        {loading && (
          <section className="bg-white rounded-3xl shadow-soft p-10 flex flex-col items-center gap-3">
            <span className="w-9 h-9 rounded-full border-4 border-teach-100 border-t-teach-500 animate-spin" />
            <p className="text-sm font-bold text-slate-500">جارٍ التحميل...</p>
          </section>
        )}

        {/* Real load failure — distinct from every empty state below. */}
        {!loading && loadError && (
          <section className="bg-white rounded-3xl shadow-soft p-6 sm:p-10 flex flex-col items-center text-center gap-4">
            <p className="text-sm font-bold text-rose-500">{loadError}</p>
            <button
              onClick={() => loadDashboard()}
              className="text-sm font-extrabold text-white bg-teach-500 hover:bg-teach-600 px-5 py-2.5 rounded-xl transition-colors"
            >
              إعادة المحاولة
            </button>
          </section>
        )}

        {!loading && !loadError && !classId && isSupabaseConfigured && (
          <section className="bg-white rounded-3xl shadow-soft p-6 sm:p-10 flex flex-col items-center text-center gap-3">
            <h3 className="text-lg font-extrabold text-slate-900">مرحبًا بك في بنيان الرياضيات 👋</h3>
            <p className="text-sm text-slate-500">ابدأ بإدارة صفك وإضافة طلابك.</p>
          </section>
        )}

        {/* Empty state: class exists, no students yet */}
        {!loading && !loadError && students && students.length === 0 && (
          <section className="bg-white rounded-3xl shadow-soft p-6 sm:p-10">
            <EmptyState
              icon={<UsersIcon className="w-7 h-7" />}
              title="صفك جاهز 🎉"
              hint="أضف طلابك للبدء، وستظهر هنا مهامهم ونجومهم ونتائجهم."
              action={
                <button
                  onClick={() => setShowAddStudent(true)}
                  className="flex items-center gap-2 bg-teach-500 hover:bg-teach-600 text-white font-extrabold text-sm rounded-2xl px-6 py-3 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  إضافة طالب
                </button>
              }
            />
          </section>
        )}

        {/* المسابقات مستقلة عن الطلاب: تبقى متاحة حتى قبل إضافة أي طالب. */}
        {!loading && !loadError && students && students.length === 0 && <CompetitionsSection />}

        {hasStudents && students && (
          <>
            {/* شريط التبويبات — يبقى ظاهرًا أثناء التمرير */}
            <nav
              aria-label="أقسام لوحة المعلم"
              className="sticky top-0 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-gradient-to-b from-teach-50/95 to-teach-50/80 backdrop-blur"
            >
              <div
                role="tablist"
                className="flex gap-1.5 overflow-x-auto rounded-3xl bg-white shadow-soft p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {TABS.map(({ id, label, Icon }) => {
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(id)}
                      className={`flex-1 min-w-fit flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-all ${
                        active
                          ? "bg-teach-500 text-white shadow-soft"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* ===================== نظرة عامة ===================== */}
            {tab === "overview" && (
              <div className="flex flex-col gap-6 animate-rise-in">
                <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                  {statCards.map(({ label, value, Icon, grad }) => (
                    <div
                      key={label}
                      className={`relative overflow-hidden rounded-3xl shadow-card p-5 sm:p-6 bg-gradient-to-br ${grad} text-white`}
                    >
                      <Icon className="absolute -bottom-4 -start-3 w-24 h-24 text-white/15" />
                      <div className="relative flex items-center gap-4">
                        <span className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                          <Icon className="w-6 h-6" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-3xl sm:text-4xl font-extrabold leading-none tabular-nums">
                            {toArabicDigits(value)}
                          </p>
                          <p className="text-sm font-bold text-white/85 mt-2">{label}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* المبادرات */}
                  <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
                    <SectionHeader
                      icon={<TrophyIcon className="w-5 h-5" />}
                      tone="lilac"
                      title="المبادرات"
                      subtitle="كم طالبًا أكمل كل مبادرة"
                    />
                    <ul className="flex flex-col gap-3 list-none">
                      {activeInitiatives.map((init) => {
                        const done = students.filter((st) => st.initiativeIds.includes(init.id)).length;
                        const percent = students.length > 0 ? Math.round((done / students.length) * 100) : 0;
                        return (
                          <li key={init.id} className="flex items-center gap-3.5 bg-slate-50 rounded-2xl p-3.5">
                            <img src={init.icon} alt="" className="w-12 h-12 object-contain shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-sm font-extrabold text-slate-900 truncate">{init.title}</p>
                                <span className="text-[11px] font-extrabold text-lilac-500 bg-lilac-50 rounded-full px-2.5 py-0.5 shrink-0">
                                  {toArabicDigits(done)}/{toArabicDigits(students.length)}
                                </span>
                              </div>
                              <ProgressBar percent={percent} barClassName="bg-gradient-to-l from-lilac-400 to-lilac-500" />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  {/* الأوائل */}
                  <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
                    <SectionHeader
                      icon={<StarIcon className="w-5 h-5" />}
                      tone="sun"
                      title="الأكثر نجومًا"
                      subtitle="ترتيب الطلاب حسب نجوم الإنجاز"
                      action={
                        <button
                          onClick={() => setTab("students")}
                          className="text-xs font-extrabold text-teach-600 hover:bg-teach-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          عرض الكل
                        </button>
                      }
                    />
                    <ol className="flex flex-col gap-2 list-none">
                      {topStudents.map((s, i) => (
                        <li key={s.id} className="flex items-center gap-3 bg-slate-50 rounded-2xl px-3.5 py-2.5">
                          <span
                            className={`w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${
                              i === 0
                                ? "bg-sun-400 text-slate-900"
                                : i === 1
                                ? "bg-slate-300 text-slate-800"
                                : i === 2
                                ? "bg-clay-400 text-white"
                                : "bg-white text-slate-500"
                            }`}
                          >
                            {toArabicDigits(i + 1)}
                          </span>
                          <Avatar name={s.full_name} className="w-9 h-9 text-sm" />
                          <p className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{s.full_name}</p>
                          <span className="flex items-center gap-1 text-sm font-extrabold text-sun-600">
                            <StarIcon className="w-4 h-4" />
                            {toArabicDigits(s.stars)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                </div>

                {/* آخر المهام */}
                <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
                  <SectionHeader
                    icon={<ClipboardCheckIcon className="w-5 h-5" />}
                    tone="mint"
                    title="آخر المهام"
                    subtitle="أحدث ما أضفته لطلابك"
                    action={
                      <button
                        onClick={() => setTab("tasks")}
                        className="text-xs font-extrabold text-teach-600 hover:bg-teach-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        كل المهام
                      </button>
                    }
                  />
                  {tasks.length === 0 ? (
                    <EmptyState
                      icon={<ClipboardCheckIcon className="w-7 h-7" />}
                      title="لم تضف أي مهمة بعد."
                      hint="ابدأ بمهمة صغيرة واجعل طلابك ينطلقون."
                      action={
                        <button
                          onClick={() => setShowAddTask(true)}
                          className="flex items-center gap-1.5 text-sm font-extrabold text-white bg-teach-500 hover:bg-teach-600 px-5 py-2.5 rounded-2xl transition-colors"
                        >
                          <PlusIcon className="w-4 h-4" />
                          إضافة مهمة
                        </button>
                      }
                    />
                  ) : (
                    <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 list-none">
                      {tasks.slice(0, 3).map(renderTaskCard)}
                    </ul>
                  )}
                </section>
              </div>
            )}

            {/* ===================== الطلاب ===================== */}
            {tab === "students" && (
              <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6 animate-rise-in">
                <SectionHeader
                  icon={<UsersIcon className="w-5 h-5" />}
                  tone="teach"
                  title="طلابي"
                  subtitle={`${toArabicDigits(students.length)} طالب في صفك`}
                  action={
                    <button
                      onClick={() => setShowAddStudent(true)}
                      className="flex items-center gap-1.5 text-sm font-extrabold text-white bg-teach-500 hover:bg-teach-600 px-4 py-2.5 rounded-xl transition-colors shrink-0"
                    >
                      <PlusIcon className="w-4 h-4" />
                      إضافة طالب
                    </button>
                  }
                />

                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 list-none">
                  {students.map((s) => {
                    const revealed = revealedCodes.has(s.id);
                    return (
                      <li
                        key={s.id}
                        className="flex flex-col gap-4 bg-slate-50/70 border border-slate-100 rounded-3xl p-4 hover:shadow-card hover:bg-white transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={s.full_name} className="w-12 h-12 text-lg" />
                          <p className="flex-1 min-w-0 text-base font-extrabold text-slate-900 leading-tight break-words">
                            {s.full_name}
                          </p>
                          <span className="flex items-center gap-1 bg-sun-50 text-sun-600 text-sm font-extrabold rounded-full px-3 py-1.5 shrink-0">
                            <StarIcon className="w-4 h-4" />
                            {toArabicDigits(s.stars)}
                          </span>
                        </div>

                        {/* رمز الدخول */}
                        <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-100 px-3.5 py-2.5">
                          <span className="text-[11px] font-bold text-slate-400 shrink-0">رمز الدخول</span>
                          <span
                            dir="ltr"
                            className="flex-1 min-w-0 text-center text-sm font-extrabold tracking-widest text-slate-700 truncate"
                          >
                            {s.login_code ? (revealed ? s.login_code : "•••••••••") : "—"}
                          </span>
                          {s.login_code && (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleRevealed(s.id)}
                                aria-label={revealed ? "إخفاء الرمز" : "عرض الرمز"}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
                              >
                                {revealed ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(s.id, s.login_code!)}
                                aria-label="نسخ الرمز"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
                              >
                                {copiedId === s.id ? (
                                  <CheckCircleIcon className="w-4 h-4 text-mint-600" />
                                ) : (
                                  <CopyIcon className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                        {copiedId === s.id && (
                          <p className="-mt-2.5 text-[11px] font-bold text-mint-600 text-center">تم النسخ ✓</p>
                        )}

                        {/* إحصاءات صغيرة */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className={`rounded-2xl py-2.5 ${TONE_SOFT.mint}`}>
                            <p className="text-lg font-extrabold leading-none">{toArabicDigits(s.completedTasks)}</p>
                            <p className="text-[10.5px] font-bold text-slate-500 mt-1">مهام مكتملة</p>
                          </div>
                          <div className={`rounded-2xl py-2.5 ${TONE_SOFT.lilac}`}>
                            <p className="text-lg font-extrabold leading-none">{toArabicDigits(s.badgesCount)}</p>
                            <p className="text-[10.5px] font-bold text-slate-500 mt-1">شارات</p>
                          </div>
                          <div className={`rounded-2xl py-2.5 ${TONE_SOFT.teach}`}>
                            <p className="text-lg font-extrabold leading-none">
                              {toArabicDigits(s.initiativeIds.length)}/{toArabicDigits(activeInitiatives.length)}
                            </p>
                            <p className="text-[10.5px] font-bold text-slate-500 mt-1">مبادرات</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-auto">
                          <button
                            type="button"
                            onClick={() => setProgressStudent(s)}
                            className="flex-1 text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-xl py-2.5 transition-colors"
                          >
                            عرض التقدم
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(s.id)}
                            aria-label="حذف الطالب"
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* ===================== المهام ===================== */}
            {tab === "tasks" && (
              <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6 animate-rise-in">
                <SectionHeader
                  icon={<ClipboardCheckIcon className="w-5 h-5" />}
                  tone="mint"
                  title="مهام هذا الأسبوع"
                  subtitle={`${toArabicDigits(tasks.length)} مهمة منشورة`}
                  action={
                    <button
                      onClick={() => setShowAddTask(true)}
                      className="flex items-center gap-1.5 text-sm font-extrabold text-white bg-teach-500 hover:bg-teach-600 px-4 py-2.5 rounded-xl transition-colors shrink-0"
                    >
                      <PlusIcon className="w-4 h-4" />
                      إضافة مهمة
                    </button>
                  }
                />
                {tasks.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardCheckIcon className="w-7 h-7" />}
                    title="لم تضف أي مهمة لهذا الأسبوع بعد."
                    hint="ابدأ بمهمة صغيرة واجعل طلابك ينطلقون."
                  />
                ) : (
                  <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 list-none">{tasks.map(renderTaskCard)}</ul>
                )}
              </section>
            )}

            {/* ===================== لوحة النجوم ===================== */}
            {tab === "stars" && classId && (
              <div className="animate-rise-in">
                <StarBoardSection classId={classId} students={rosterOptions} />
              </div>
            )}

            {/* ===================== المسابقات ===================== */}
            {tab === "competitions" && (
              <div className="animate-rise-in">
                <CompetitionsSection />
              </div>
            )}

            {/* ===================== النتائج ===================== */}
            {tab === "results" && (
              <div className="flex flex-col gap-4 animate-rise-in">
                <div role="tablist" className="flex flex-wrap gap-2">
                  {RESULT_TABS.map((r) => {
                    const active = resultsTab === r.id;
                    return (
                      <button
                        key={r.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setResultsTab(r.id)}
                        className={`text-sm font-extrabold px-4 py-2 rounded-full transition-colors ${
                          active
                            ? "bg-slate-900 text-white shadow-soft"
                            : "bg-white text-slate-600 hover:bg-slate-100 shadow-soft"
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
                {resultsTab === "discover" && <PlacementSection students={rosterOptions} />}
                {resultsTab === "quiz" && <QuizSection students={rosterOptions} />}
                {resultsTab === "games" && <GamesSection students={rosterOptions} />}
              </div>
            )}
          </>
        )}
      </main>

      {showAddStudent && (
        <AddStudentModal
          onClose={() => setShowAddStudent(false)}
          onAdded={() => {
            setShowAddStudent(false);
            loadDashboard();
          }}
        />
      )}

      {showAddTask && classId && profile && (
        <CreateTaskModal
          classId={classId}
          teacherId={profile.id}
          students={rosterOptions}
          onClose={() => setShowAddTask(false)}
          onCreated={() => {
            setShowAddTask(false);
            loadDashboard();
          }}
        />
      )}

      {progressStudent && (
        <StudentProgressModal
          studentId={progressStudent.id}
          studentName={progressStudent.full_name}
          stars={progressStudent.stars}
          onClose={() => setProgressStudent(null)}
        />
      )}

      {studentBeingDeleted && (
        <ConfirmDialog
          title="هل أنت متأكد من حذف هذا الطالب؟"
          description="سيتم إزالة الطالب من صفك."
          confirmLabel="حذف الطالب"
          loading={deletingId === studentBeingDeleted.id}
          onConfirm={() => handleDeleteStudent(studentBeingDeleted.id)}
          onCancel={() => setConfirmingDeleteId(null)}
        />
      )}

      {taskBeingDeleted && (
        <ConfirmDialog
          title="هل أنت متأكد من حذف هذه المهمة؟"
          description="سيتم إلغاء تعيينها عن جميع الطلاب."
          confirmLabel="حذف المهمة"
          onConfirm={() => handleDeleteTask(taskBeingDeleted.id)}
          onCancel={() => setConfirmingTaskDeleteId(null)}
        />
      )}
      <BrandFooter className="mt-10 mb-8 px-4" />
    </div>
  );
}
