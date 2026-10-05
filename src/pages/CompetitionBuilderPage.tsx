// منشئ المسابقة — صفحة كاملة للمعلم: /teacher/competitions/new و /teacher/competitions/:id/edit
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  KIND_LABEL, emptyCompetition, emptyPage, loadCompetitionForEdit, saveCompetition, setCompetitionStatus,
  validateForPublish, type DraftCompetition, type DraftItem, type ItemKind, type PublicCompetition, type QType,
} from "../lib/competitions";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { toArabicDigits } from "../utils/arabicNumerals";
import { PlusIcon, TrashIcon, EyeIcon } from "../components/icons/Glyphs";
import ItemEditor, { QTYPE_LABEL, makeItem } from "../components/competitions/ItemEditors";
import CompetitionPlayer from "../components/competitions/CompetitionPlayer";
import ShareLink from "../components/competitions/ShareLink";
import Buddy from "../components/competitions/Buddy";
import { THEMES, THEME_ORDER } from "../components/competitions/themes";
import ConfirmDialog from "../components/teacher/ConfirmDialog";

const field = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teach-300 focus:border-teach-300";
const lab = "text-xs font-extrabold text-slate-500 mb-1.5 block";

const ADD_OPTIONS: { kind: ItemKind; qtype?: QType; icon: string; title: string; group: "content" | "question" | "flow" }[] = [
  { kind: "heading", icon: "🔤", title: "عنوان", group: "content" },
  { kind: "text", icon: "📝", title: "نص", group: "content" },
  { kind: "instructions", icon: "💡", title: "تعليمات", group: "content" },
  { kind: "image", icon: "🖼️", title: "صورة", group: "content" },
  { kind: "video", icon: "🎬", title: "فيديو", group: "content" },
  { kind: "pdf", icon: "📄", title: "ملف PDF", group: "content" },
  { kind: "link", icon: "🔗", title: "رابط خارجي", group: "content" },
  { kind: "question", qtype: "mcq", icon: "🔘", title: "اختيار من متعدد", group: "question" },
  { kind: "question", qtype: "true_false", icon: "✅", title: "صح أو خطأ", group: "question" },
  { kind: "question", qtype: "number", icon: "🔢", title: "إجابة رقمية", group: "question" },
  { kind: "question", qtype: "text", icon: "✏️", title: "إجابة نصية", group: "question" },
  { kind: "divider", icon: "➖", title: "فاصل / قسم", group: "flow" },
  { kind: "button", icon: "⏭️", title: "زر انتقال", group: "flow" },
];
const GROUPS = { content: "محتوى", question: "أسئلة", flow: "تنظيم" } as const;

export default function CompetitionBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftCompetition | null>(id ? null : emptyCompetition());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [picker, setPicker] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [confirmDeletePage, setConfirmDeletePage] = useState(false);
  const [published, setPublished] = useState(false);
  const exists = useRef(!!id); // هل المسابقة محفوظة في قاعدة البيانات؟

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    let alive = true;
    loadCompetitionForEdit(id)
      .then((d) => { if (!alive) return; if (!d) setLoadError("المسابقة غير موجودة."); else setDraft(d); })
      .catch(() => alive && setLoadError("تعذّر تحميل المسابقة."));
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const mutate = useCallback((fn: (d: DraftCompetition) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: DraftCompetition = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
    setDirty(true);
    setMsg(null);
  }, []);

  const page = draft?.pages[Math.min(pageIdx, (draft?.pages.length ?? 1) - 1)];
  const safeIdx = draft ? Math.min(pageIdx, draft.pages.length - 1) : 0;

  const previewData: PublicCompetition | null = useMemo(() => {
    if (!draft) return null;
    return {
      state: "open", title: draft.title || "عنوان المسابقة", description: draft.description || null, theme: draft.theme,
      target_grade: draft.target_grade || null,
      duration_minutes: draft.duration_minutes ? Number(draft.duration_minutes) : null, show_score: draft.show_score,
      pages: draft.pages.map((p) => ({
        id: p.id, title: p.title || null,
        items: p.items.map((i) => ({
          id: i.id, kind: i.kind, data: i.data,
          question: i.question ? {
            qtype: i.question.qtype, prompt: i.question.prompt, points: i.question.points,
            options: i.question.qtype === "mcq" ? i.question.options.filter((o) => o.label.trim()).map((o) => ({ id: o.id, label: o.label })) : null,
          } : null,
        })),
      })),
    };
  }, [draft]);

  async function persist(): Promise<boolean> {
    if (!draft) return false;
    if (!draft.title.trim()) { setMsg({ type: "err", text: "اكتب اسم المسابقة أولًا." }); return false; }
    setSaving(true);
    try {
      await saveCompetition(draft);
      if (!exists.current) {
        exists.current = true;
        navigate(`/teacher/competitions/${draft.id}/edit`, { replace: true });
      }
      setDirty(false);
      setSavedAt(new Date());
      return true;
    } catch (e: any) {
      setMsg({ type: "err", text: "تعذّر الحفظ. تحقق من الاتصال وحاول مرة أخرى." });
      // eslint-disable-next-line no-console
      console.error("save_competition failed:", e?.message ?? e);
      return false;
    } finally { setSaving(false); }
  }

  async function onSave() {
    if (await persist()) setMsg({ type: "ok", text: "تم حفظ المسابقة ✓" });
  }

  async function onPublish() {
    if (!draft) return;
    const issues = validateForPublish(draft);
    setProblems(issues);
    if (issues.length) { setMsg({ type: "err", text: "أكمل النقاط التالية قبل النشر." }); return; }
    if (!(await persist())) return;
    setSaving(true);
    try {
      await setCompetitionStatus(draft.id, "published");
      // نعيد قراءة المسابقة للحصول على الرابط (slug) الذي ولّدته قاعدة البيانات.
      const fresh = await loadCompetitionForEdit(draft.id);
      if (fresh) setDraft(fresh);
      setPublished(true);
      setMsg(null);
    } catch {
      setMsg({ type: "err", text: "تعذّر نشر المسابقة. حاول مرة أخرى." });
    } finally { setSaving(false); }
  }

  async function onUnpublish(status: "draft" | "closed") {
    if (!draft) return;
    try {
      await setCompetitionStatus(draft.id, status);
      mutate((d) => { d.status = status; });
      setDirty(false);
      setPublished(false);
      setMsg({ type: "ok", text: status === "closed" ? "تم إغلاق المسابقة." : "تم إلغاء النشر." });
    } catch { setMsg({ type: "err", text: "تعذّر تغيير حالة المسابقة." }); }
  }

  function leave() {
    if (dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد المغادرة؟")) return;
    navigate("/teacher");
  }

  // ---------- حالات التحميل ----------
  if (loadError) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-3xl shadow-soft p-8 text-center flex flex-col gap-4 max-w-sm">
          <p className="text-sm font-bold text-rose-500">{loadError}</p>
          <button onClick={() => navigate("/teacher")} className="text-sm font-extrabold text-white bg-teach-500 rounded-xl px-5 py-2.5">العودة للوحة المعلم</button>
        </div>
      </div>
    );
  }
  if (!draft || !page || !previewData) {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-sm font-bold text-slate-500">جارٍ التحميل...</p></div>;
  }

  if (previewing) {
    return <CompetitionPlayer competition={previewData} preview onExitPreview={() => setPreviewing(false)} />;
  }

  const isLive = draft.status === "published";
  const moveItem = (from: number, to: number) => mutate((d) => {
    const items = d.pages[safeIdx].items;
    if (to < 0 || to >= items.length) return;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
  });
  const movePage = (from: number, to: number) => mutate((d) => {
    if (to < 0 || to >= d.pages.length) return;
    const [p] = d.pages.splice(from, 1);
    d.pages.splice(to, 0, p);
    setPageIdx(to);
  });
  let qCounter = 0;
  draft.pages.slice(0, safeIdx).forEach((p) => p.items.forEach((i) => { if (i.kind === "question") qCounter++; }));

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-teach-50 via-slate-50 to-slate-50 pb-28">
      {/* الشريط العلوي */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 sm:gap-3 flex-wrap">
          <button onClick={leave} className="text-sm font-extrabold text-slate-500 hover:bg-slate-100 rounded-xl px-3 py-2">→ رجوع</button>
          <h1 className="flex-1 min-w-[8rem] text-base font-extrabold text-slate-900 truncate">🏆 {draft.title || "مسابقة جديدة"}</h1>
          <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
            {saving ? "جارٍ الحفظ..." : dirty ? "تغييرات غير محفوظة" : savedAt ? `حُفظت ${savedAt.toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
          <button onClick={onSave} disabled={saving} className="text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 disabled:opacity-60 rounded-xl px-4 py-2.5">💾 حفظ</button>
          <button onClick={() => setPreviewing(true)} className="flex items-center gap-1.5 text-sm font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl px-4 py-2.5"><EyeIcon className="w-4 h-4" />معاينة</button>
          {!isLive && <button onClick={onPublish} disabled={saving} className="text-sm font-extrabold text-white bg-mint-500 hover:bg-mint-600 disabled:opacity-60 rounded-xl px-4 py-2.5">🚀 نشر المسابقة</button>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
        {msg && <p role="alert" className={`text-sm font-bold rounded-xl px-4 py-3 ${msg.type === "ok" ? "bg-mint-50 text-mint-600" : "bg-rose-50 text-rose-500"}`}>{msg.text}</p>}
        {problems.length > 0 && (
          <ul className="bg-sun-50 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 list-disc ps-8 flex flex-col gap-1">
            {problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        )}

        {(isLive || published) && (
          <section className="bg-white rounded-3xl shadow-soft p-5 flex flex-col gap-4">
            <ShareLink title={draft.title} slug={draft.slug} theme={draft.theme} description={draft.description} success={published} />
            {isLive && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold text-slate-500 flex-1 min-w-[12rem]">المسابقة منشورة. أي تعديل تحفظينه يظهر فورًا للمشاركين الجدد.</p>
                <button onClick={() => onUnpublish("draft")} className="text-xs font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl px-3.5 py-2">إلغاء النشر</button>
                <button onClick={() => onUnpublish("closed")} className="text-xs font-extrabold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl px-3.5 py-2">إغلاق المسابقة</button>
                <button onClick={() => navigate(`/teacher/competitions/${draft.id}/results`)} className="text-xs font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-xl px-3.5 py-2">النتائج</button>
              </div>
            )}
          </section>
        )}
        {draft.status === "closed" && !isLive && (
          <p className="bg-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600">هذه المسابقة مغلقة. اضغط «نشر المسابقة» لإعادة فتحها.</p>
        )}

        {/* الإعدادات */}
        <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6 flex flex-col gap-5">
          <h2 className="text-base font-extrabold text-slate-900">إعدادات المسابقة</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={lab}>اسم المسابقة</label>
              <input value={draft.title} maxLength={150} onChange={(e) => mutate((d) => { d.title = e.target.value; })} placeholder="مثال: تحدي الرياضيات الممتع" className={field} />
            </div>
            <div>
              <label className={lab}>الصف المستهدف (للعرض فقط)</label>
              <input value={draft.target_grade} maxLength={60} onChange={(e) => mutate((d) => { d.target_grade = e.target.value; })} placeholder="مثال: الصفوف ٥–٧" className={field} />
            </div>
          </div>
          <div>
            <label className={lab}>وصف المسابقة</label>
            <textarea value={draft.description} maxLength={2000} rows={2} onChange={(e) => mutate((d) => { d.description = e.target.value; })} placeholder="جملة أو جملتان تشرحان فكرة المسابقة" className={`${field} resize-y`} />
          </div>

          <div>
            <label className={lab}>القالب البصري (ألوان وشخصية فقط — الوظائف نفسها)</label>
            <div role="radiogroup" className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {THEME_ORDER.map((tid) => {
                const t = THEMES[tid]; const on = draft.theme === tid;
                return (
                  <button key={tid} type="button" role="radio" aria-checked={on} onClick={() => mutate((d) => { d.theme = tid; })}
                    style={{ background: t.bg, borderColor: on ? t.primary : "transparent" }}
                    className={`rounded-2xl border-[3px] p-2 flex flex-col items-center gap-1 transition-all ${on ? "scale-[1.03] shadow-card" : "opacity-90 hover:opacity-100"}`}>
                    <Buddy theme={tid} className="w-16 h-18" float={false} />
                    <span className="text-xs font-extrabold" style={{ color: t.text }}>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={lab}>تاريخ البداية (اختياري)</label>
              <input type="datetime-local" value={draft.starts_at} onChange={(e) => mutate((d) => { d.starts_at = e.target.value; })} className={field} />
            </div>
            <div>
              <label className={lab}>تاريخ النهاية (اختياري)</label>
              <input type="datetime-local" value={draft.ends_at} onChange={(e) => mutate((d) => { d.ends_at = e.target.value; })} className={field} />
            </div>
            <div>
              <label className={lab}>مدة المسابقة بالدقائق (اختياري)</label>
              <input type="number" min={1} max={600} value={draft.duration_minutes} onChange={(e) => mutate((d) => { d.duration_minutes = e.target.value; })} placeholder="بدون مؤقت" className={field} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ["show_score", "إظهار الدرجة للمشارك بعد الإرسال"],
              ["allow_retake", "السماح بإعادة المشاركة"],
            ] as const).map(([key, text]) => (
              <label key={key} className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3 cursor-pointer">
                <input type="checkbox" checked={draft[key]} onChange={(e) => mutate((d) => { d[key] = e.target.checked; })} className="w-5 h-5 accent-teal-600" />
                <span className="text-sm font-bold text-slate-700">{text}</span>
              </label>
            ))}
          </div>
        </section>

        {/* الصفحات */}
        <section className="bg-white rounded-3xl shadow-soft p-5 sm:p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-extrabold text-slate-900">صفحات المسابقة</h2>
            <span className="text-xs font-bold text-slate-400">يتنقل المشارك بين الصفحات بزرّي «التالي» و«السابق»</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {draft.pages.map((p, i) => (
              <button key={p.id} onClick={() => setPageIdx(i)}
                className={`shrink-0 text-sm font-extrabold rounded-xl px-4 py-2.5 transition-colors ${i === safeIdx ? "bg-teach-500 text-white shadow-soft" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                صفحة {toArabicDigits(i + 1)}
              </button>
            ))}
            {draft.pages.length < 30 && (
              <button onClick={() => { mutate((d) => { d.pages.push(emptyPage()); }); setPageIdx(draft.pages.length); }}
                className="shrink-0 flex items-center gap-1.5 text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-xl px-4 py-2.5"><PlusIcon className="w-4 h-4" />صفحة</button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input value={page.title} maxLength={150} onChange={(e) => mutate((d) => { d.pages[safeIdx].title = e.target.value; })} placeholder="عنوان الصفحة (اختياري)" className={`${field} flex-1 min-w-[12rem]`} />
            <button disabled={safeIdx === 0} onClick={() => movePage(safeIdx, safeIdx - 1)} className="text-xs font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg px-3 py-2.5" aria-label="تقديم الصفحة">→ قبل</button>
            <button disabled={safeIdx === draft.pages.length - 1} onClick={() => movePage(safeIdx, safeIdx + 1)} className="text-xs font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg px-3 py-2.5" aria-label="تأخير الصفحة">بعد ←</button>
            {draft.pages.length > 1 && (
              <button onClick={() => setConfirmDeletePage(true)} aria-label="حذف الصفحة" className="w-9 h-9 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center"><TrashIcon className="w-4 h-4" /></button>
            )}
          </div>

          {/* العناصر */}
          <ul className="flex flex-col gap-3 list-none">
            {page.items.map((it, idx) => {
              if (it.kind === "question") qCounter++;
              return (
                <li key={it.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-teach-600 bg-teach-50 rounded-full px-3 py-1">
                      {it.kind === "question" && it.question ? `سؤال ${toArabicDigits(qCounter)} — ${QTYPE_LABEL[it.question.qtype]}` : KIND_LABEL[it.kind]}
                    </span>
                    <span className="flex-1" />
                    {draft.pages.length > 1 && (
                      <select aria-label="نقل إلى صفحة" value="" onChange={(e) => {
                        const to = Number(e.target.value); if (Number.isNaN(to)) return;
                        mutate((d) => { const [m] = d.pages[safeIdx].items.splice(idx, 1); d.pages[to].items.push(m); });
                      }} className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                        <option value="">نقل إلى…</option>
                        {draft.pages.map((_, i) => i !== safeIdx && <option key={i} value={i}>صفحة {toArabicDigits(i + 1)}</option>)}
                      </select>
                    )}
                    <button disabled={idx === 0} onClick={() => moveItem(idx, idx - 1)} aria-label="للأعلى" className="w-8 h-8 rounded-lg text-slate-500 hover:bg-white disabled:opacity-30">↑</button>
                    <button disabled={idx === page.items.length - 1} onClick={() => moveItem(idx, idx + 1)} aria-label="للأسفل" className="w-8 h-8 rounded-lg text-slate-500 hover:bg-white disabled:opacity-30">↓</button>
                    <button onClick={() => mutate((d) => { d.pages[safeIdx].items.splice(idx, 1); })} aria-label="حذف العنصر" className="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                  <ItemEditor item={it} competitionId={draft.id}
                    onChange={(next: DraftItem) => mutate((d) => { d.pages[safeIdx].items[idx] = next; })} />
                </li>
              );
            })}
          </ul>

          {page.items.length === 0 && !picker && (
            <p className="text-center text-sm font-bold text-slate-400 py-4">الصفحة فارغة — أضف أول عنصر.</p>
          )}

          {picker ? (
            <div className="rounded-2xl border-2 border-dashed border-teach-200 bg-white p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold text-slate-800">اختر نوع العنصر</p>
                <button onClick={() => setPicker(false)} className="text-xs font-extrabold text-slate-500 hover:bg-slate-100 rounded-lg px-3 py-1.5">إغلاق</button>
              </div>
              {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
                <div key={g} className="flex flex-col gap-2">
                  <p className="text-[11px] font-extrabold text-slate-400">{GROUPS[g]}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ADD_OPTIONS.filter((o) => o.group === g).map((o) => (
                      <button key={o.title} onClick={() => { mutate((d) => { d.pages[safeIdx].items.push(makeItem(o.kind, o.qtype)); }); setPicker(false); }}
                        className="flex items-center gap-2 rounded-xl bg-slate-50 hover:bg-teach-50 border border-slate-100 px-3 py-3 text-sm font-extrabold text-slate-700 transition-colors">
                        <span aria-hidden="true">{o.icon}</span>{o.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-extrabold text-slate-500">إضافة سريعة — نص وصور وفيديو وروابط وملفات وأسئلة:</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ["text", undefined, "📝 نص"], ["image", undefined, "🖼️ صورة"], ["video", undefined, "🎬 فيديو"],
                  ["link", undefined, "🔗 رابط"], ["pdf", undefined, "📄 PDF"], ["question", "mcq", "❓ سؤال"],
                ] as [ItemKind, QType | undefined, string][]).map(([kind, qtype, text]) => (
                  <button key={text} onClick={() => mutate((d) => { d.pages[safeIdx].items.push(makeItem(kind, qtype)); })}
                    className="text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-xl px-4 py-2.5 transition-colors">{text}</button>
                ))}
                <button onClick={() => setPicker(true)} className="flex items-center gap-1.5 text-sm font-extrabold text-white bg-teach-500 hover:bg-teach-600 rounded-xl px-4 py-2.5 transition-colors">
                  <PlusIcon className="w-4 h-4" />كل العناصر
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {confirmDeletePage && (
        <ConfirmDialog title="حذف هذه الصفحة؟" description="سيُحذف كل ما فيها من عناصر وأسئلة."
          confirmLabel="حذف الصفحة"
          onConfirm={() => { mutate((d) => { d.pages.splice(safeIdx, 1); }); setPageIdx(Math.max(0, safeIdx - 1)); setConfirmDeletePage(false); }}
          onCancel={() => setConfirmDeletePage(false)} />
      )}
    </div>
  );
}
