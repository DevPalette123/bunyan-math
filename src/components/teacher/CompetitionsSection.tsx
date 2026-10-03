// قسم «🏆 المسابقات» في لوحة المعلمة — قائمة مسابقاتها بأعداد مشاركين حقيقية.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteCompetition, listMyCompetitions, setCompetitionStatus, type CompetitionStatus, type CompetitionSummary,
} from "../../lib/competitions";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { PlusIcon, TrophyIcon, UsersIcon, TrashIcon } from "../icons/Glyphs";
import { EmptyState, SectionHeader } from "./TeacherUI";
import ConfirmDialog from "./ConfirmDialog";
import ShareLink from "../competitions/ShareLink";

const STATUS: Record<CompetitionStatus, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-slate-100 text-slate-600" },
  published: { label: "منشورة", cls: "bg-mint-50 text-mint-600" },
  closed: { label: "مغلقة", cls: "bg-rose-50 text-rose-500" },
};

export default function CompetitionsSection() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CompetitionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CompetitionSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setItems(await listMyCompetitions()); } catch { setError("تعذّر تحميل المسابقات. حاولي مرة أخرى."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function changeStatus(c: CompetitionSummary, status: CompetitionStatus) {
    setActionError(null);
    try { await setCompetitionStatus(c.id, status); load(); } catch { setActionError("تعذّر تغيير حالة المسابقة."); }
  }
  async function confirmDelete() {
    if (!deleting) return;
    try { await deleteCompetition(deleting.id); setDeleting(null); load(); }
    catch { setDeleting(null); setActionError("تعذّر حذف المسابقة."); }
  }

  const newBtn = (
    <button onClick={() => navigate("/teacher/competitions/new")}
      className="flex items-center gap-1.5 text-sm font-extrabold text-white bg-teach-500 hover:bg-teach-600 px-4 py-2.5 rounded-xl transition-colors shrink-0">
      <PlusIcon className="w-4 h-4" />إنشاء مسابقة
    </button>
  );

  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6">
      <SectionHeader icon={<TrophyIcon className="w-5 h-5" />} tone="sun" title="🏆 المسابقات"
        subtitle="مسابقات مفتوحة لأي شخص يملك الرابط — مستقلة عن نجوم الطلاب وشاراتهم" action={newBtn} />

      {actionError && <p role="alert" className="mb-4 text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2.5">{actionError}</p>}
      {error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm font-bold text-rose-500">{error}</p>
          <button onClick={load} className="text-sm font-extrabold text-white bg-teach-500 rounded-xl px-5 py-2.5">إعادة المحاولة</button>
        </div>
      )}
      {!error && items === null && <p className="text-center text-sm font-bold text-slate-500 py-8">جارٍ التحميل...</p>}
      {items && items.length === 0 && (
        <EmptyState icon={<TrophyIcon className="w-7 h-7" />} title="لم تنشئي أي مسابقة بعد."
          hint="أنشئي مسابقة، انشريها، ثم شاركي رابطها مع أي شخص."
          action={newBtn} />
      )}

      {items && items.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 list-none">
          {items.map((c) => (
            <li key={c.id} className="flex flex-col gap-3.5 bg-slate-50/70 border border-slate-100 rounded-3xl p-5 hover:bg-white hover:shadow-card transition-all">
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-extrabold text-slate-900 leading-snug break-words min-w-0">🏆 {c.title}</p>
                <button onClick={() => setDeleting(c)} aria-label="حذف المسابقة" className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 shrink-0"><TrashIcon className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px] font-extrabold">
                <span className={`rounded-full px-2.5 py-1 ${STATUS[c.status].cls}`}>الحالة: {STATUS[c.status].label}</span>
                <span className="flex items-center gap-1 bg-teach-50 text-teach-600 rounded-full px-2.5 py-1"><UsersIcon className="w-3.5 h-3.5" />👥 المشاركون: {toArabicDigits(c.participants)}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-auto">
                {c.status === "published" && (
                  <a href={`/competition/${c.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-extrabold text-white bg-teach-500 hover:bg-teach-600 rounded-xl px-3.5 py-2">فتح</a>
                )}
                <button onClick={() => navigate(`/teacher/competitions/${c.id}/results`)} className="text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-xl px-3.5 py-2">النتائج</button>
                {c.status !== "draft" && <button onClick={() => setShareId(shareId === c.id ? null : c.id)} className="text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-xl px-3.5 py-2">مشاركة</button>}
                <button onClick={() => navigate(`/teacher/competitions/${c.id}/edit`)} className="text-sm font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl px-3.5 py-2">تعديل</button>
                {c.status === "published" && <button onClick={() => changeStatus(c, "closed")} className="text-sm font-extrabold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl px-3.5 py-2">إغلاق</button>}
                {c.status === "closed" && <button onClick={() => changeStatus(c, "published")} className="text-sm font-extrabold text-mint-600 bg-mint-50 hover:bg-mint-100 rounded-xl px-3.5 py-2">إعادة فتح</button>}
              </div>
              {shareId === c.id && c.status !== "draft" && <ShareLink title={c.title} slug={c.slug} theme={c.theme} description={c.description} />}
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <ConfirmDialog title="حذف هذه المسابقة؟" description={`ستُحذف «${deleting.title}» وكل مشاركاتها ونتائجها نهائيًا، ولن يعمل رابطها بعد ذلك.`}
          confirmLabel="حذف المسابقة" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      )}
    </section>
  );
}
