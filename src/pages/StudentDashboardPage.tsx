import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentShell from "../components/StudentShell";
import TopBar from "../components/TopBar";
import HeroSection from "../components/HeroSection";
import MainSections from "../components/MainSections";
import WeeklyTasksCard from "../components/WeeklyTasksCard";
import BadgesCard from "../components/BadgesCard";
import LevelCard from "../components/LevelCard";
import RecentActivityCard from "../components/RecentActivityCard";
import { toArabicDigits } from "../utils/arabicNumerals";
import StarBoardCard from "../components/StarBoardCard";
import { fetchMyStarCount } from "../lib/starBoard";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { formatRelativeArabicTime } from "../utils/relativeTime";
import { mainSections, motivationalLine } from "../data/mockStudent";
import { lessons } from "../data/lessons";
import { practiceLessons } from "../data/practiceLessons";
import { initiatives } from "../data/initiatives";
import { fetchLatestCompletedAttemptSummary, skillShortLabel } from "../lib/discover";
import { fetchLatestQuizSummary } from "../lib/quiz";
import { fetchLatestGamesSummary } from "../lib/games";
import { GAME_THEMES } from "../data/playGameThemes";
import { completeTaskAssignment } from "../lib/tasks";
import type {
  ActivityItem,
  Badge,
  BadgeKind,
  MainSection,
  SkillLevel,
  StudentProfile,
  TaskStatus,
  WeeklyTask,
} from "../data/types";

// Presentational-only mapping of a real badge's code to one of the 3 badge
// shapes — every badge rendered from this map is one the student actually
// earned; nothing here invents which badges exist.
const BADGE_KIND: Record<string, BadgeKind> = {
  first_completion: "sprout",
  persistent: "medal",
  lesson_starter: "sprout",
  lesson_master: "medal",
  discover_complete: "star",
  quiz_starter: "sprout",
  quiz_perfect: "medal",
  game_starter: "sprout",
  game_master: "medal",
  practice_starter: "sprout",
  practice_master: "medal",
  initiative_starter: "star",
  initiative_master: "medal",
};

const SKILL_BAR_COLOR = ["bg-berry-500", "bg-palm-500", "bg-sun-500", "bg-rose-400"];

const DB_STATUS_TO_UI: Record<string, TaskStatus> = {
  not_started: "not-started",
  in_progress: "in-progress",
  completed: "done",
};

export default function StudentDashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  const [stars, setStars] = useState(0);
  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTask[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [levelPercent, setLevelPercent] = useState(0);
  const [levelSkills, setLevelSkills] = useState<SkillLevel[]>([]);
  const [myStarCount, setMyStarCount] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    if (!isSupabaseConfigured || !profile) {
      setLoaded(true);
      return;
    }
    loadDashboard();
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function loadDashboard() {
      const [
        { data: studentRow },
        { data: assignmentRows },
        { data: badgeRows },
        { data: lessonRows },
        { data: practiceRows },
        { data: initiativeRows },
        levelSummary,
        myStars,
        quizSummary,
        gamesSummary,
      ] = await Promise.all([
        supabase.from("students").select("stars").eq("id", profile!.id).maybeSingle(),
        supabase
          .from("task_assignments")
          .select("id, status, completed_at, tasks(title, points, due_date)")
          .eq("student_id", profile!.id),
        supabase
          .from("student_badges")
          .select("id, earned_at, badges(code, name)")
          .eq("student_id", profile!.id)
          .order("earned_at", { ascending: false }),
        supabase
          .from("lesson_completions")
          .select("id, lesson_id, completed_at")
          .eq("student_id", profile!.id),
        supabase
          .from("practice_completions")
          .select("id, practice_id, completed_at")
          .eq("student_id", profile!.id),
        supabase
          .from("initiative_completions")
          .select("id, initiative_id, completed_at")
          .eq("student_id", profile!.id),
        fetchLatestCompletedAttemptSummary(profile!.id),
        fetchMyStarCount(profile!.id),
        fetchLatestQuizSummary(profile!.id),
        fetchLatestGamesSummary(profile!.id),
      ]);

      if (!isMountedRef.current) return;

      setStars(studentRow?.stars ?? 0);
      setMyStarCount(myStars);

      setWeeklyTasks(
        (assignmentRows ?? []).map((row: any) => {
          const status = DB_STATUS_TO_UI[row.status] ?? "not-started";
          return {
            id: row.id,
            title: row.tasks?.title ?? "مهمة",
            status,
            // Real progress only exists at the two endpoints today (no
            // partial-progress tracking is built yet) — 50 is a neutral
            // placeholder for "in_progress" that no real task can reach
            // yet, since nothing in the app currently sets that status.
            progress: status === "done" ? 100 : status === "in-progress" ? 50 : 0,
            actionLabel: status === "in-progress" ? "متابعة" : "ابدأ الآن",
          } satisfies WeeklyTask;
        })
      );

      setBadges(
        (badgeRows ?? []).map((row: any) => ({
          id: row.id,
          kind: BADGE_KIND[row.badges?.code] ?? "star",
          label: row.badges?.name ?? "شارة",
        }))
      );

      const activityEvents: { id: string; iconKey: ActivityItem["iconKey"]; title: string; at: string }[] =
        [];
      for (const row of assignmentRows ?? []) {
        if (row.status === "completed" && row.completed_at) {
          activityEvents.push({
            id: `task-${row.id}`,
            iconKey: "practice",
            title: `أكملتِ مهمة: ${row.tasks?.title ?? ""}`,
            at: row.completed_at,
          });
        }
      }
      for (const row of badgeRows ?? []) {
        activityEvents.push({
          id: `badge-${row.id}`,
          iconKey: "badges",
          title: `حصلتِ على شارة ${row.badges?.name ?? ""}`,
          at: row.earned_at,
        });
      }
      for (const row of lessonRows ?? []) {
        const lessonTitle = lessons.find((l) => l.id === row.lesson_id)?.title ?? "درس";
        activityEvents.push({
          id: `lesson-${row.id}`,
          iconKey: "lessons",
          title: `أكملتِ درس: ${lessonTitle}`,
          at: row.completed_at,
        });
      }
      for (const row of practiceRows ?? []) {
        const practiceTitle = practiceLessons.find((p) => p.id === row.practice_id)?.title ?? "تدريب";
        activityEvents.push({
          id: `practice-${row.id}`,
          iconKey: "practice",
          title: `أكملتِ تدريب: ${practiceTitle}`,
          at: row.completed_at,
        });
      }
      for (const row of initiativeRows ?? []) {
        const initiativeTitle = initiatives.find((i) => i.id === row.initiative_id)?.title ?? "مبادرة";
        activityEvents.push({
          id: `initiative-${row.id}`,
          iconKey: "initiatives",
          title: `أكملتِ مبادرة: ${initiativeTitle}`,
          at: row.completed_at,
        });
      }
      if (levelSummary) {
        activityEvents.push({
          id: `discover-${levelSummary.attemptId}`,
          iconKey: "discover",
          title: `أكملتِ اختبار تحديد المستوى — ${levelSummary.percentage}٪`,
          at: levelSummary.completedAt,
        });
        setLevelPercent(levelSummary.percentage);
        setLevelSkills(
          levelSummary.skills.map((s, i) => ({
            label: skillShortLabel(s.skill),
            percent: s.percent,
            colorClass: SKILL_BAR_COLOR[i % SKILL_BAR_COLOR.length],
          }))
        );
      }

      if (quizSummary) {
        activityEvents.push({
          id: `quiz-${quizSummary.attemptId}`,
          iconKey: "quiz",
          title: `أكملتِ اختبار «اختبر» — ${toArabicDigits(quizSummary.percentage)}٪`,
          at: quizSummary.completedAt,
        });
      }

      for (const g of gamesSummary) {
        activityEvents.push({
          id: `game-${g.attemptId}`,
          iconKey: "play",
          title: `لعبتِ «${GAME_THEMES[g.gameId].title}» — ${toArabicDigits(g.percentage)}٪`,
          at: g.completedAt,
        });
      }

      activityEvents.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      setRecentActivity(
        activityEvents.slice(0, 5).map((e) => ({
          id: e.id,
          iconKey: e.iconKey,
          title: e.title,
          timeAgo: formatRelativeArabicTime(e.at),
        }))
      );

      setLoaded(true);
  }

  const activeStudent: StudentProfile = {
    name: profile?.full_name ?? "",
    avatarInitial: profile?.full_name?.trim().charAt(0) || "؟",
    stars,
  };

  // Real completion, not a placeholder: calls the existing secure RPC, then
  // reloads every card (stars/tasks/badges) from the same authoritative
  // source used on first load — so a newly-earned badge or the updated
  // point total show up immediately, without duplicating that logic here.
  async function handleCompleteTask(task: WeeklyTask): Promise<boolean> {
    const { error } = await completeTaskAssignment(task.id);
    if (error) return false;
    await loadDashboard();
    return true;
  }

  // "تعلّم" و"اكتشف" و"تدرّب" و"العب" و"اختبر" هي الأقسام المربوطة بصفحة
  // حقيقية حتى الآن. الأقسام غير المبنية تُعطَّل بصريًا عند مصدرها
  // (MainSections عبر COMING_SOON_IDS) فلا تصل onOpen إليها أصلًا.
  function handleOpenSection(section: MainSection) {
    if (section.id === "learn") {
      navigate("/learn");
      return;
    }
    if (section.id === "discover") {
      navigate("/discover");
      return;
    }
    if (section.id === "practice") {
      navigate("/practice");
      return;
    }
    if (section.id === "play") {
      navigate("/play");
      return;
    }
    if (section.id === "quiz") {
      navigate("/quiz");
      return;
    }
  }

  return (
    <StudentShell activeId="home">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex flex-col gap-5 sm:gap-6 pb-24 lg:pb-10">
        <TopBar student={activeStudent} />

        <HeroSection studentName={activeStudent.name} motivationalLine={motivationalLine} />

        <MainSections sections={mainSections} onOpen={handleOpenSection} />

        {myStarCount !== null && <StarBoardCard count={myStarCount} />}

        {!loaded ? (
          <p className="text-center text-sm text-ink-500 py-6">جارٍ التحميل...</p>
        ) : (
          <section className="flex flex-col gap-5 sm:gap-6">
            {/* Full width — this is the section the student should act on first */}
            <div className="animate-rise-in [animation-delay:160ms]">
              <WeeklyTasksCard tasks={weeklyTasks} onComplete={handleCompleteTask} />
            </div>

            {/* Three equal, single-card columns below — avoids one column
                stacking two cards while its neighbours only have one,
                which used to leave a jagged, unbalanced bottom edge. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 items-start">
              <div className="animate-rise-in [animation-delay:220ms]">
                <RecentActivityCard items={recentActivity} />
              </div>
              <div className="animate-rise-in [animation-delay:260ms]">
                <BadgesCard
                  badges={badges}
                  totalEarned={badges.length}
                  onViewAll={() => navigate("/badges")}
                />
              </div>
              <div className="animate-rise-in [animation-delay:300ms]">
                <LevelCard overallPercent={levelPercent} skills={levelSkills} />
              </div>
            </div>
          </section>
        )}
      </main>
    </StudentShell>
  );
}
