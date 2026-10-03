// محررات عناصر المسابقة (تظهر للمعلمة داخل المنشئ).
import { useRef, useState } from "react";
import {
  ACCEPT_BY_KIND, ATTACHMENT_KINDS, KIND_LABEL, MAX_ATTACHMENTS, MAX_UPLOAD_BYTES, emptyQuestion, getAttachments,
  isHttpUrl, newId, uploadMedia,
  type DraftAttachment, type DraftItem, type DraftQuestion, type QType,
} from "../../lib/competitions";
import { PlusIcon, TrashIcon, CheckCircleIcon } from "../icons/Glyphs";

const field = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teach-300 focus:border-teach-300";
const label = "text-xs font-extrabold text-slate-500 mb-1.5 block";

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[٫,]/g, ".");

export const QTYPE_LABEL: Record<QType, string> = {
  mcq: "اختيار من متعدد", true_false: "صح أو خطأ", number: "إجابة رقمية", text: "إجابة نصية",
};

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} maxLength={5000} className={`${field} resize-y leading-relaxed`} />;
}

/** منتقي المصدر: رفع ملف أو رابط خارجي (صورة / فيديو / PDF). */
function MediaEditor({
  kind, item, competitionId, onData,
}: { kind: "image" | "video" | "pdf"; item: DraftItem; competitionId: string; onData: (patch: Record<string, any>) => void }) {
  const d = item.data;
  const source: "upload" | "url" = d.source === "url" ? "url" : "upload";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(null);
    setBusy(true);
    try {
      const path = await uploadMedia(competitionId, kind, f);
      onData({ source: "upload", path, fileName: f.name, url: undefined });
    } catch (e: any) {
      setErr(e?.message ?? "تعذّر رفع الملف.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const titleKey = kind === "pdf" ? "title" : "caption";
  const urlHint = kind === "video" ? "رابط يوتيوب أو رابط مباشر لملف فيديو" : kind === "pdf" ? "رابط مباشر لملف PDF" : "رابط الصورة";

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex self-start rounded-xl bg-slate-100 p-1 text-xs font-extrabold" role="tablist">
        {(["upload", "url"] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={source === s} onClick={() => onData({ source: s })}
            className={`px-3.5 py-1.5 rounded-lg transition-colors ${source === s ? "bg-white shadow-soft text-teach-600" : "text-slate-500"}`}>
            {s === "upload" ? "رفع من الجهاز" : "رابط خارجي"}
          </button>
        ))}
      </div>

      {source === "upload" ? (
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept={ACCEPT_BY_KIND[kind]} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
              className="text-sm font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 disabled:opacity-60 rounded-xl px-4 py-2.5 transition-colors">
              {busy ? "جارٍ الرفع..." : d.path ? "استبدال الملف" : `اختيار ${KIND_LABEL[kind]}`}
            </button>
            {d.path && !busy && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-mint-600 min-w-0">
                <CheckCircleIcon className="w-4 h-4 shrink-0" />
                <span className="truncate" dir="ltr">{d.fileName || "تم رفع الملف"}</span>
              </span>
            )}
          </div>
          <p className="text-[11px] font-bold text-slate-400">الحد الأقصى {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجابايت. الملف خاص ولا يظهر إلا داخل مسابقة منشورة.</p>
        </div>
      ) : (
        <div>
          <label className={label}>{urlHint}</label>
          <input dir="ltr" value={d.url ?? ""} onChange={(e) => onData({ source: "url", url: e.target.value.trim(), path: undefined })} placeholder="https://" className={field} />
          {d.url && !isHttpUrl(d.url) && <p className="text-xs font-bold text-rose-500 mt-1.5">يجب أن يبدأ الرابط بـ https://</p>}
        </div>
      )}
      {err && <p role="alert" className="text-xs font-bold text-rose-500">{err}</p>}

      <div>
        <label className={label}>{kind === "pdf" ? "عنوان الملف (اختياري)" : "وصف قصير (اختياري)"}</label>
        <input value={d[titleKey] ?? ""} onChange={(e) => onData({ [titleKey]: e.target.value })} maxLength={150} className={field} />
      </div>
    </div>
  );
}

function QuestionEditor({ q, onChange }: { q: DraftQuestion; onChange: (q: DraftQuestion) => void }) {
  const set = (patch: Partial<DraftQuestion>) => onChange({ ...q, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={label}>نص السؤال</label>
        <TextArea value={q.prompt} onChange={(v) => set({ prompt: v })} placeholder="اكتبي السؤال هنا" rows={2} />
      </div>

      {q.qtype === "mcq" && (
        <div className="flex flex-col gap-2">
          <label className={label}>الخيارات — اضغطي الدائرة لتحديد الإجابة الصحيحة</label>
          {q.options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <button type="button" aria-label="الإجابة الصحيحة" aria-pressed={o.is_correct}
                onClick={() => set({ options: q.options.map((x) => ({ ...x, is_correct: x.id === o.id })) })}
                className={`w-7 h-7 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${o.is_correct ? "bg-mint-500 border-mint-500 text-white" : "border-slate-300 text-transparent hover:border-mint-400"}`}>
                ✓
              </button>
              <input value={o.label} maxLength={300} placeholder={`الخيار ${i + 1}`} className={field}
                onChange={(e) => set({ options: q.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })} />
              {q.options.length > 2 && (
                <button type="button" aria-label="حذف الخيار" onClick={() => set({ options: q.options.filter((x) => x.id !== o.id) })}
                  className="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center shrink-0"><TrashIcon className="w-4 h-4" /></button>
              )}
            </div>
          ))}
          {q.options.length < 8 && (
            <button type="button" onClick={() => set({ options: [...q.options, { id: newId(), label: "", is_correct: false }] })}
              className="self-start flex items-center gap-1.5 text-xs font-extrabold text-teach-600 hover:bg-teach-50 rounded-lg px-3 py-2"><PlusIcon className="w-3.5 h-3.5" />إضافة خيار</button>
          )}
        </div>
      )}

      {q.qtype === "true_false" && (
        <div>
          <label className={label}>الإجابة الصحيحة</label>
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            {[{ v: true, l: "صح ✓" }, { v: false, l: "خطأ ✗" }].map((o) => (
              <button key={String(o.v)} type="button" aria-pressed={q.tf_answer === o.v} onClick={() => set({ tf_answer: o.v })}
                className={`rounded-xl py-2.5 text-sm font-extrabold border-2 transition-colors ${q.tf_answer === o.v ? "border-mint-500 bg-mint-50 text-mint-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{o.l}</button>
            ))}
          </div>
        </div>
      )}

      {q.qtype === "number" && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div>
            <label className={label}>الإجابة الصحيحة</label>
            <input dir="ltr" inputMode="decimal" value={q.number_answer} onChange={(e) => set({ number_answer: toLatin(e.target.value) })} placeholder="مثال: 12.5" className={field} />
          </div>
          <div>
            <label className={label}>هامش السماح (±)</label>
            <input dir="ltr" inputMode="decimal" value={q.number_tolerance} onChange={(e) => set({ number_tolerance: toLatin(e.target.value) })} className={field} />
          </div>
        </div>
      )}

      {q.qtype === "text" && (
        <div className="flex flex-col gap-2">
          <label className={label}>الإجابات المقبولة (أي واحدة منها صحيحة؛ لا يهم التشكيل أو الهمزات)</label>
          {q.text_answers.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={a} maxLength={200} className={field} placeholder="إجابة صحيحة"
                onChange={(e) => set({ text_answers: q.text_answers.map((x, j) => (j === i ? e.target.value : x)) })} />
              {q.text_answers.length > 1 && (
                <button type="button" aria-label="حذف" onClick={() => set({ text_answers: q.text_answers.filter((_, j) => j !== i) })}
                  className="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center shrink-0"><TrashIcon className="w-4 h-4" /></button>
              )}
            </div>
          ))}
          {q.text_answers.length < 6 && (
            <button type="button" onClick={() => set({ text_answers: [...q.text_answers, ""] })}
              className="self-start flex items-center gap-1.5 text-xs font-extrabold text-teach-600 hover:bg-teach-50 rounded-lg px-3 py-2"><PlusIcon className="w-3.5 h-3.5" />إجابة بديلة</button>
          )}
        </div>
      )}

      <div className="max-w-[10rem]">
        <label className={label}>الدرجة</label>
        <input type="number" min={0} max={100} value={q.points} onChange={(e) => set({ points: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className={field} />
      </div>
    </div>
  );
}

/** موارد مرفقة بالسؤال: صورة/فيديو/PDF/رابط تظهر للمشارك داخل السؤال نفسه، فوق نص السؤال. */
function AttachmentsEditor({
  item, competitionId, onChange,
}: { item: DraftItem; competitionId: string; onChange: (item: DraftItem) => void }) {
  const list = getAttachments(item.data);
  const setList = (next: DraftAttachment[]) => onChange({ ...item, data: { ...item.data, attachments: next } });
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-extrabold text-slate-600">📎 موارد مرفقة بهذا السؤال (اختياري)</p>
        {list.length < MAX_ATTACHMENTS && (
          <div className="flex flex-wrap gap-1.5">
            {ATTACHMENT_KINDS.map((k) => (
              <button key={k.kind} type="button"
                onClick={() => setList([...list, { id: newId(), kind: k.kind, ...(k.kind === "link" ? {} : { source: "upload" }) }])}
                className="text-xs font-extrabold text-teach-600 bg-teach-50 hover:bg-teach-100 rounded-lg px-3 py-1.5 transition-colors">
                {k.icon} {k.title}
              </button>
            ))}
          </div>
        )}
      </div>
      {list.length === 0 && <p className="text-[11px] font-bold text-slate-400">أرفقي صورة أو فيديو أو ملف PDF أو رابطًا ليراه المشارك مع السؤال.</p>}
      {list.map((a, i) => (
        <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-teach-600">{KIND_LABEL[a.kind]}</span>
            <button type="button" aria-label="حذف المورد" onClick={() => setList(list.filter((x) => x.id !== a.id))}
              className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center"><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
          <ItemEditor item={{ id: a.id, kind: a.kind, data: a }} competitionId={competitionId}
            onChange={(next) => setList(list.map((x, j) => (j === i ? ({ ...next.data, id: a.id, kind: a.kind } as DraftAttachment) : x)))} />
        </div>
      ))}
    </div>
  );
}

export default function ItemEditor({
  item, competitionId, onChange,
}: { item: DraftItem; competitionId: string; onChange: (item: DraftItem) => void }) {
  const patchData = (patch: Record<string, any>) => onChange({ ...item, data: { ...item.data, ...patch } });

  switch (item.kind) {
    case "heading":
      return <input value={item.data.text ?? ""} onChange={(e) => patchData({ text: e.target.value })} maxLength={200} placeholder="اكتبي العنوان" className={`${field} text-base`} />;
    case "text":
      return <TextArea value={item.data.text ?? ""} onChange={(v) => patchData({ text: v })} placeholder="اكتبي النص هنا" rows={4} />;
    case "instructions":
      return <TextArea value={item.data.text ?? ""} onChange={(v) => patchData({ text: v })} placeholder="مثال: اقرئي السؤال جيدًا قبل الإجابة" rows={2} />;
    case "image":
    case "video":
    case "pdf":
      return <MediaEditor kind={item.kind} item={item} competitionId={competitionId} onData={patchData} />;
    case "link":
      return (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>الرابط</label>
            <input dir="ltr" value={item.data.url ?? ""} onChange={(e) => patchData({ url: e.target.value.trim() })} placeholder="https://" className={field} />
            {item.data.url && !isHttpUrl(item.data.url) && <p className="text-xs font-bold text-rose-500 mt-1.5">يجب أن يبدأ الرابط بـ https://</p>}
          </div>
          <div>
            <label className={label}>نص الرابط</label>
            <input value={item.data.label ?? ""} onChange={(e) => patchData({ label: e.target.value })} maxLength={120} placeholder="مثال: اقرئي المزيد" className={field} />
          </div>
        </div>
      );
    case "divider":
      return <input value={item.data.label ?? ""} onChange={(e) => patchData({ label: e.target.value })} maxLength={80} placeholder="عنوان القسم (اختياري)" className={field} />;
    case "button":
      return (
        <div className="max-w-xs">
          <label className={label}>نص الزر (ينقل المشارك للصفحة التالية)</label>
          <input value={item.data.label ?? ""} onChange={(e) => patchData({ label: e.target.value })} maxLength={40} placeholder="التالي" className={field} />
        </div>
      );
    case "question":
      return item.question ? (
        <div className="flex flex-col gap-4">
          <QuestionEditor q={item.question} onChange={(q) => onChange({ ...item, question: q })} />
          <AttachmentsEditor item={item} competitionId={competitionId} onChange={onChange} />
        </div>
      ) : null;
    default:
      return null;
  }
}

export function makeItem(kind: DraftItem["kind"], qtype?: QType): DraftItem {
  const base: DraftItem = { id: newId(), kind, data: {} };
  if (kind === "image" || kind === "video" || kind === "pdf") base.data = { source: "upload" };
  if (kind === "button") base.data = { label: "التالي" };
  if (kind === "question") base.question = emptyQuestion(qtype ?? "mcq");
  return base;
}
