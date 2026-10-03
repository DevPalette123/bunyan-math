export interface StudentProfile {
  name: string;
  avatarInitial: string;
  stars: number;
}

export type TaskStatus = "in-progress" | "done" | "not-started";

export interface WeeklyTask {
  id: string;
  title: string;
  status: TaskStatus;
  progress: number; // 0-100, only meaningful for in-progress/done
  actionLabel: string;
}

export type BadgeKind = "medal" | "sprout" | "star";

export interface Badge {
  id: string;
  kind: BadgeKind;
  label: string;
}

export interface SkillLevel {
  label: string;
  percent: number;
  colorClass: string;
}

export type ActivityIconKey = "practice" | "lessons" | "badges" | "discover" | "quiz" | "play" | "initiatives";

export interface ActivityItem {
  id: string;
  iconKey: ActivityIconKey;
  title: string;
  timeAgo: string;
}

export interface MainSection {
  id: string;
  icon: string; // imported image asset
  title: string;
  description: string;
  bgClass: string;
  accentClass: string;
}

export type LessonStatus = "not-started" | "in-progress" | "completed";
