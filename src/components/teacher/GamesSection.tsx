import { useEffect, useMemo, useState } from "react";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { formatRelativeArabicTime } from "../../utils/relativeTime";
import { fetchClassFunOverview, type TeacherFunRow } from "../../lib/funGames";
import { funGames, type FunGameId } from "../../data/funGames";
import { playGames } from "../../data/playGames";
import { formatDuration } from "../../data/playGameThemes";
import { PlayGameIcon } from "../icons/Glyphs";
import Avatar from "./Avatar";
import FunGameDetailModal from "./FunGameDetailModal";
import { EmptyState, SectionHeader } from "./TeacherUI";

interface RosterStudent {
  id: string;
  full_name: string;
}

interface GamesSectionProps {
  students: RosterStudent[];
}

const skillName = (id: string) => playGames.find((g) => g.id === id)?.title ?? id;

// نتائج ألعاب «ألعب» للمعلم — قراءة فقط. لكل مهارة لعبة بفكرة مختلفة (data/funGames.ts)،
// والنتائج حقيقية من جدول fun_game_results (نجوم ١–٣، أخطاء، مدة)؛ لا شيء للطلاب الذين لم يلعبوا.
export default function GamesSection({ students }: GamesSectionProps) {
  const [overview, setOverview] = useState<Map<string, Partial<Record<FunGameId, TeacherFunRow>>> | null>(null);
  const [activeGame, setActiveGame] = useState<FunGameId>(funGames[0].id);
  const [selected, setSelected] = useState<{ student: RosterStudent; gameId: FunGameId } | null>(null);

  const idsKey = students.map((s) => s.id).join(",");

  useEffect(() => {
    let isMounted = true;
    fetchClassFunOverview(students.map((s) => s.id)).then((data) => {
      if (isMounted) setOverview(data);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const rows = useMemo(
    () =>
      students
        .map((s) => ({ student: s, row: overview?.get(s.id)?.[activeGame] ?? null }))
        .filter((r) => r.row !== null) as { student: RosterStudent; row: TeacherFunRow }[],
    [students, overview, activeGame]
  );

  const notPlayed = useMemo(
    () => (overview ? students.filter((s) => !overview.get(s.id)?.[activeGame]) : []),
    [students, overview, activeGame]
  );

  const game = funGames.find((g) => g.id === activeGame)!;

  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
      <SectionHeader
        icon={<PlayGameIcon className="w-5 h-5" />}
        tone="lilac"
        title="نتائج الألعاب"
        subtitle="متابعة للنتائج فقط — المعلم لا تبدأ اللعبة"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {funGames.map((g) => (
          <button
            key={g.id}
            onClick={() => setActiveGame(g.id)}
            className={`text-xs sm:text-sm font-extrabold px-4 py-2 rounded-full transition-colors ${
              activeGame === g.id
                ? "bg-lilac-500 text-white shadow-soft"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {skillName(g.id)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-lilac-50 rounded-2xl px-4 py-3 mb-5">
        <span className="text-2xl leading-none">{game.emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 truncate">{game.title}</p>
          <p className="text-[11px] font-bold text-slate-500">المهارة: {skillName(activeGame)}</p>
        </div>
      </div>

      {overview === null ? (
        <p className="text-sm text-slate-500">جارٍ التحميل...</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PlayGameIcon className="w-7 h-7" />}
          title={`لم يلعب أي طالب «${game.title}» بعد.`}
          hint="ستظهر هنا النتائج فور لعب الطلاب."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none">
            {rows.map(({ student, row }) => (
              <li
                key={student.id}
                className="flex flex-col gap-3.5 bg-slate-50/70 border border-slate-100 rounded-3xl p-4 hover:shadow-card hover:bg-white transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={student.full_name} className="w-11 h-11 text-base" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-slate-900 truncate">{student.full_name}</p>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                      {formatRelativeArabicTime(row.lastPlayedAt)} · {toArabicDigits(row.attemptsCount)} مرات لعب
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-sun-50 py-2.5 px-1">
                    <p className="text-sm leading-none h-4">{"⭐".repeat(row.lastStars) || "—"}</p>
                    <p className="text-[10.5px] font-bold text-slate-500 mt-1.5">آخر مرة</p>
                  </div>
                  <div className="rounded-2xl bg-rose-50 py-2.5 px-1">
                    <p className="text-sm font-extrabold text-rose-500 leading-none h-4">{toArabicDigits(row.lastMistakes)}</p>
                    <p className="text-[10.5px] font-bold text-slate-500 mt-1.5">أخطاء</p>
                  </div>
                  <div className="rounded-2xl bg-teach-50 py-2.5 px-1">
                    <p className="text-xs font-extrabold text-teach-600 leading-none h-4 pt-0.5">
                      {formatDuration(row.lastDurationSeconds)}
                    </p>
                    <p className="text-[10.5px] font-bold text-slate-500 mt-1.5">المدة</p>
                  </div>
                </div>

                <p className="text-[11px] font-bold text-slate-500">
                  أفضل نتيجة: <span className="text-sm">{"⭐".repeat(row.bestStars) || "—"}</span>
                </p>

                <button
                  type="button"
                  onClick={() => setSelected({ student, gameId: activeGame })}
                  className="text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-xl py-2.5 transition-colors"
                >
                  التفاصيل
                </button>
              </li>
            ))}
          </ul>

          {notPlayed.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4">
              <h4 className="text-xs font-extrabold text-slate-500 mb-2.5">لم يلعبن هذه اللعبة بعد</h4>
              <div className="flex flex-wrap gap-1.5">
                {notPlayed.map((s) => (
                  <span key={s.id} className="text-[11px] font-bold text-slate-600 bg-white rounded-full px-3 py-1">
                    {s.full_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <FunGameDetailModal
          studentId={selected.student.id}
          studentName={selected.student.full_name}
          gameId={selected.gameId}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
