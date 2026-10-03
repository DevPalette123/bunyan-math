import { useEffect, useState } from "react";
import StudentShell from "../components/StudentShell";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { formatRelativeArabicTime } from "../utils/relativeTime";
import { MedalBadgeIcon, PencilBadgeIcon, RocketBadgeIcon, SproutBadgeIcon, StarBadgeIcon } from "../components/icons/BadgeGlyphs";

interface EarnedBadge {
  id: string;
  code: string;
  name: string;
  description: string | null;
  earnedAt: string;
}

// Purely a presentational choice of which shape represents which real badge
// code — not fabricated data, every entry rendered here is a badge the
// student actually earned.
const BADGE_GLYPH: Record<string, typeof MedalBadgeIcon> = {
  first_completion: SproutBadgeIcon,
  persistent: MedalBadgeIcon,
  lesson_starter: SproutBadgeIcon,
  lesson_master: MedalBadgeIcon,
  discover_complete: StarBadgeIcon,
  quiz_starter: StarBadgeIcon,
  quiz_perfect: MedalBadgeIcon,
  game_starter: RocketBadgeIcon,
  game_master: RocketBadgeIcon,
  practice_starter: PencilBadgeIcon,
  practice_master: PencilBadgeIcon,
  initiative_starter: StarBadgeIcon,
  initiative_master: MedalBadgeIcon,
};

export default function BadgesPage() {
  const { profile } = useAuth();
  const [badges, setBadges] = useState<EarnedBadge[] | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile) {
      setBadges([]);
      return;
    }
    supabase
      .from("student_badges")
      .select("id, earned_at, badges(code, name, description)")
      .eq("student_id", profile.id)
      .order("earned_at", { ascending: false })
      .then(({ data }) => {
        setBadges(
          (data ?? []).map((row: any) => ({
            id: row.id,
            code: row.badges?.code ?? "",
            name: row.badges?.name ?? "شارة",
            description: row.badges?.description ?? null,
            earnedAt: row.earned_at,
          }))
        );
      });
  }, [profile]);

  return (
    <StudentShell activeId="badges">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
        <section className="flex flex-col items-center text-center gap-2 animate-rise-in">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900">شاراتي</h1>
        </section>

        {badges === null && <p className="text-center text-sm text-ink-500">جارٍ التحميل...</p>}

        {badges !== null && badges.length === 0 && (
          <div className="bg-white rounded-3xl shadow-soft p-10 flex flex-col items-center text-center gap-3">
            <StarBadgeIcon className="w-14 h-14 opacity-60" />
            <p className="text-base font-bold text-ink-900">لم تحصل على شارة بعد، واصل التقدم!</p>
            <p className="text-sm text-ink-500">
              أكملي أول مهمة أو درس لتحصلي على شارتك الأولى تلقائيًا.
            </p>
          </div>
        )}

        {badges !== null && badges.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {badges.map((badge) => {
              const Glyph = BADGE_GLYPH[badge.code] ?? StarBadgeIcon;
              return (
                <div
                  key={badge.id}
                  className="bg-white rounded-3xl shadow-soft p-5 flex flex-col items-center text-center gap-2"
                >
                  <Glyph className="w-12 h-12" />
                  <p className="text-sm font-extrabold text-ink-900">{badge.name}</p>
                  {badge.description && (
                    <p className="text-xs text-ink-500 leading-relaxed">{badge.description}</p>
                  )}
                  <p className="text-[11px] font-bold text-ink-400">
                    {formatRelativeArabicTime(badge.earnedAt)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </StudentShell>
  );
}
