import { useEffect, useMemo, useState } from "react";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { formatRelativeArabicTime } from "../../utils/relativeTime";
import {
  fetchClassPlacementOverview,
  skillLabel,
  type SkillCode,
  type TeacherPlacementRow,
} from "../../lib/discover";
import { ClipboardCheckIcon, TrophyIcon, UsersIcon } from "../icons/Glyphs";
import PlacementDetailModal from "./PlacementDetailModal";
import ResultCard from "./ResultCard";
import { EmptyState, SectionHeader, StatTile } from "./TeacherUI";

interface RosterStudent {
  id: string;
  full_name: string;
}

interface PlacementSectionProps {
  students: RosterStudent[];
}

export default function PlacementSection({ students }: PlacementSectionProps) {
  const [overview, setOverview] = useState<Map<string, TeacherPlacementRow> | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<RosterStudent | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<SkillCode | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchClassPlacementOverview(students.map((s) => s.id)).then((data) => {
      if (isMounted) setOverview(data);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.map((s) => s.id).join(",")]);

  const rows = useMemo(
    () =>
      students
        .map((s) => ({ student: s, attempt: overview?.get(s.id) ?? null }))
        .filter((r) => r.attempt !== null) as { student: RosterStudent; attempt: TeacherPlacementRow }[],
    [students, overview]
  );

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const averagePercent = Math.round(
      rows.reduce((sum, r) => sum + r.attempt.percentage, 0) / rows.length
    );
    const needFoundation = rows.filter((r) => r.attempt.level === "يحتاج إلى تأسيس").length;

    const skillCounts = new Map<SkillCode, string[]>();
    for (const r of rows) {
      for (const skill of r.attempt.weakSkills) {
        const list = skillCounts.get(skill) ?? [];
        list.push(r.student.full_name);
        skillCounts.set(skill, list);
      }
    }
    const sortedSkills = [...skillCounts.entries()].sort((a, b) => b[1].length - a[1].length);

    return {
      completedCount: rows.length,
      averagePercent,
      needFoundation,
      topWeakSkill: sortedSkills[0] ?? null,
      needsSupport: sortedSkills,
    };
  }, [rows]);

  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
      <SectionHeader
        icon={<ClipboardCheckIcon className="w-5 h-5" />}
        tone="teach"
        title="تحديد المستوى (اكتشف)"
        subtitle="نتائج اختبار تحديد المستوى لكل طالب"
      />

      {overview === null ? (
        <p className="text-sm text-slate-500">جارٍ التحميل...</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheckIcon className="w-7 h-7" />}
          title="لم يجرِ أي طالب تحديد المستوى بعد."
          hint="ستظهر هنا النتائج فور إكمال الطلاب للاختبار."
        />
      ) : (
        <div className="flex flex-col gap-7">
          {/* إحصاءات — أرقام حقيقية فقط */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile tone="teach" value={toArabicDigits(stats!.completedCount)} label="أكملوا التحديد" />
            <StatTile tone="mint" value={`${toArabicDigits(stats!.averagePercent)}٪`} label="متوسط النتيجة" />
            <StatTile tone="rose" value={toArabicDigits(stats!.needFoundation)} label="يحتاجون إلى تأسيس" />
            <StatTile
              tone="lilac"
              small
              value={stats!.topWeakSkill ? skillLabel(stats!.topWeakSkill[0]) : "لا يوجد"}
              label="الأكثر ضعفًا"
            />
          </div>

          {/* بطاقات النتائج */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none">
            {rows.map(({ student, attempt }) => (
              <ResultCard
                key={student.id}
                name={student.full_name}
                meta={formatRelativeArabicTime(attempt.completedAt)}
                percent={attempt.percentage}
                score={`${toArabicDigits(attempt.correctAnswers)}/${toArabicDigits(attempt.totalQuestions)}`}
                level={attempt.level}
                onDetails={() => setSelectedStudent(student)}
              />
            ))}
          </ul>

          {/* يحتاجون إلى دعم */}
          <div>
            <h4 className="flex items-center gap-2 text-base font-extrabold text-slate-900 mb-3">
              <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                <TrophyIcon className="w-4 h-4" />
              </span>
              يحتاجون إلى دعم
            </h4>
            {!stats || stats.needsSupport.length === 0 ? (
              <p className="text-xs font-bold text-slate-500 bg-slate-50 rounded-2xl px-4 py-3">
                لا توجد مهارة ضعيفة مشتركة بين طلابك حاليًا.
              </p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none">
                {stats.needsSupport.map(([skill, names]) => (
                  <li key={skill} className="rounded-2xl bg-slate-50 border border-slate-100">
                    <button
                      type="button"
                      onClick={() => setExpandedSkill((cur) => (cur === skill ? null : skill))}
                      aria-expanded={expandedSkill === skill}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3.5"
                    >
                      <span className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                        <ClipboardCheckIcon className="w-4 h-4 text-slate-400" />
                        {skillLabel(skill)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-extrabold text-rose-500 bg-rose-50 rounded-full px-2.5 py-1 shrink-0">
                        <UsersIcon className="w-3.5 h-3.5" />
                        {toArabicDigits(names.length)} طالب{names.length > 1 ? "ًا" : ""}
                      </span>
                    </button>
                    {expandedSkill === skill && (
                      <div className="px-4 pb-3.5 flex flex-wrap gap-1.5">
                        {names.map((name, i) => (
                          <span key={i} className="text-[11px] font-bold text-slate-600 bg-white rounded-full px-2.5 py-1">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {selectedStudent && (
        <PlacementDetailModal
          studentId={selectedStudent.id}
          studentName={selectedStudent.full_name}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </section>
  );
}
