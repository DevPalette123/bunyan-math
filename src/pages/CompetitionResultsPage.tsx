// نتائج مسابقة — للمعلمة فقط: /teacher/competitions/:id/results
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  deleteSubmission, loadAnswers, loadCompetitionHeader, loadSubmissions,
  type AnswerRow, type SubmissionRow,
} from "../lib/competitions";
import { toArabicDigits } from "../utils/arabicNumerals";
import { TrashIcon, UsersIcon } from "../components/icons/Glyphs";
import { EmptyState, StatTile } from "../components/teacher/TeacherUI";
import ConfirmDialog from "../components/teacher/ConfirmDialog";

const fmtDuration = (s: number | null) =>
  s == null ? "—" : `${toArabicDigits(Math.floor(s / 60))}:${toArabicDigits(String(s % 60).padStart(2, "0"))}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("ar-OM", { dateStyle: "medium", timeStyle: "short" });

export default function CompetitionResultsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<SubmissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerRow[] | null>(null);
  const [answersError, setAnswersError] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [h, s] = await Promise.all([loadCompetitionHeader(id), loadSubmissions(id)]);
      if (!h) { setError("المسابقة غير موجودة."); return; }
      setTitle(h.title);
      setRows(s);
    } catch { setError("تعذّر تحميل النتائج. حاولي مرة أخرى."); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function open(sid: string) {
    if (openId === sid) { setOpenId(null); return; }
    setOpenId(sid); setAnswers(null); setAnswersError(false);
    try { setAnswers(await loadAnswers(sid)); } catch { setAnswersError(true); }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try { await deleteSubmission(deleteId); setDeleteId(null); if (openId === deleteId) setOpenId(null); load(); }
    catch { setDeleteId(null); setError("تعذّر حذف المشاركة."); }
  }

  const avg = rows && rows.length > 0 && rows.every((r) => r.max_score > 0)
    ? Math.round(rows.reduce((a, r) => a + (r.score / r.max_score) * 100, 0) / rows.length) : null;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-teach-50 via-slate-50 to-slate-50 pb-16">
      <header className="bg-white/95 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/teacher")} className="text-sm font-extrabold text-slate-500 hover:bg-slate-100 rounded-xl px-3 py-2">→ رجوع</button>
          <h1 className="flex-1 min-w-0 text-base font-extrabold text-slate-900 truncate">🏆 نتائج: {title}</h1>
          <button onClick={() => navigate(`/teacher/competitions/${id}/edit`)} className="text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-xl px-4 py-2.5">تعديل</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
        {error && (
          <div className="bg-white rounded-3xl shadow-soft p-6 text-center flex flex-col gap-3 items-center">
            <p className="text-sm font-bold text-rose-500">{error}</p>
            <button onClick={load} className="text-sm font-extrabold text-white bg-teach-500 rounded-xl px-5 py-2.5">إعادة المحاولة</button>
          </div>
        )}
        {!error && rows === null && <p className="text-center text-sm font-bold text-slate-500 py-10">جارٍ التحميل...</p>}

        {rows && (
          <>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <StatTile tone="teach" value={toArabicDigits(rows.length)} label="👥 عدد المشاركين" />
              <StatTile tone="mint" value={avg === null ? "—" : `${toArabicDigits(avg)}٪`} label="متوسط الدرجات" />
            </div>

            <section className="bg-white rounded-3xl shadow-soft p-4 sm:p-6">
              {rows.length === 0 ? (
                <EmptyState icon={<UsersIcon className="w-7 h-7" />} title="لا توجد مشاركات بعد." hint="ستظهر هنا مشاركات من يفتحون رابط المسابقة ويرسلون إجاباتهم." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-xs font-extrabold text-slate-400 text-start">
                        <th className="text-start py-2 px-3">الاسم</th><th className="text-start py-2 px-3">الصف</th>
                        <th className="text-start py-2 px-3">الدرجة</th><th className="text-start py-2 px-3">وقت المشاركة</th>
                        <th className="text-start py-2 px-3">المدة</th><th className="w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <FragmentRow key={r.id} r={r} open={openId === r.id} onOpen={() => open(r.id)} onDelete={() => setDeleteId(r.id)}
                          answers={openId === r.id ? answers : null} answersError={openId === r.id && answersError} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {deleteId && (
        <ConfirmDialog title="حذف هذه المشاركة؟" description="ستُحذف المشاركة وإجاباتها نهائيًا." confirmLabel="حذف المشاركة"
          onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}

function FragmentRow({
  r, open, onOpen, onDelete, answers, answersError,
}: { r: SubmissionRow; open: boolean; onOpen: () => void; onDelete: () => void; answers: AnswerRow[] | null; answersError: boolean }) {
  return (
    <>
      <tr onClick={onOpen} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${open ? "bg-slate-50" : ""}`}>
        <td className="py-3 px-3 font-extrabold text-slate-900">{r.participant_name}{r.timed_out && <span className="ms-2 text-[10px] font-extrabold text-sun-600 bg-sun-50 rounded-full px-2 py-0.5">تجاوز الوقت</span>}</td>
        <td className="py-3 px-3 font-bold text-slate-600">{r.grade_label}</td>
        <td className="py-3 px-3 font-extrabold text-teach-600">{toArabicDigits(r.score)}/{toArabicDigits(r.max_score)}</td>
        <td className="py-3 px-3 font-bold text-slate-500">{fmtDate(r.submitted_at)}</td>
        <td className="py-3 px-3 font-bold text-slate-500">{fmtDuration(r.duration_seconds)}</td>
        <td className="py-3 px-1">
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label="حذف المشاركة" className="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center"><TrashIcon className="w-4 h-4" /></button>
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-3 pb-4">
            {answersError ? <p className="text-sm font-bold text-rose-500 py-3">تعذّر تحميل الإجابات.</p>
              : !answers ? <p className="text-sm font-bold text-slate-400 py-3">جارٍ التحميل...</p>
              : answers.length === 0 ? <p className="text-sm font-bold text-slate-400 py-3">لا توجد أسئلة في هذه المسابقة.</p>
              : (
                <ol className="flex flex-col gap-2 list-none">
                  {answers.map((a) => (
                    <li key={a.id} className={`rounded-2xl bg-white border-s-4 p-4 flex flex-col gap-1.5 ${a.is_correct ? "border-mint-500" : "border-rose-400"}`}>
                      <p className="text-sm font-extrabold text-slate-900"><span className="text-slate-400 me-1.5">{toArabicDigits(a.position)}.</span>{a.prompt_snapshot}</p>
                      <p className="text-sm font-bold text-slate-700">إجابته: <span className={a.is_correct ? "text-mint-600" : "text-rose-500"}>{a.answer_text || "لم يُجب"}</span></p>
                      {!a.is_correct && a.correct_text && <p className="text-xs font-bold text-slate-500">الصحيحة: {a.correct_text}</p>}
                      <p className="text-[11px] font-extrabold text-slate-400">{a.is_correct ? "✓ صحيحة" : "✗ غير صحيحة"} — {toArabicDigits(a.points_awarded)}/{toArabicDigits(a.points_possible)}</p>
                    </li>
                  ))}
                </ol>
              )}
          </td>
        </tr>
      )}
    </>
  );
}
