// تجربة المشارك — تُستخدم في الصفحة العامة /competition/:slug وفي «المعاينة» للمعلم.
// مستقلة بصريًا ووظيفيًا عن واجهة الطالب: لا شريط تنقل، لا نجوم، لا شارات.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  submitCompetition, signedMediaUrl, toEmbedUrl, isHttpUrl,
  type PublicCompetition, type PublicItem, type PublicQuestion, type SubmitResult,
} from "../../lib/competitions";
import { toArabicDigits } from "../../utils/arabicNumerals";
import { getTheme, themeVars } from "./themes";
import Buddy from "./Buddy";
import logoMark from "../../assets/logo/logo-mark.png";

const GRADE_SUGGESTIONS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];

type Phase = "intro" | "play" | "done";

const card = "rounded-[28px] bg-[color:var(--c-card)] border border-[color:var(--c-border)] [box-shadow:var(--c-shadow)]";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--c-primary)] hover:bg-[color:var(--c-primary-hover)] text-[color:var(--c-on-primary)] font-extrabold text-base px-7 py-3.5 transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed [box-shadow:var(--c-shadow)]";
const btnSoft =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--c-soft)] hover:brightness-95 text-[color:var(--c-text)] font-extrabold text-base px-6 py-3.5 transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed";
const inputCls =
  "w-full rounded-2xl border-2 border-[color:var(--c-border)] bg-[color:var(--c-softer)] px-4 py-3 text-base font-bold text-[color:var(--c-text)] placeholder:text-[color:var(--c-muted)]/60 focus:outline-none focus:border-[color:var(--c-primary)] focus:bg-white transition-colors";

function useMediaSrc(data: Record<string, any>): { src: string | null; loading: boolean } {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    if (data.source === "upload" && data.path) {
      setLoading(true);
      signedMediaUrl(data.path).then((u) => { if (alive) { setSrc(u); setLoading(false); } });
    } else if (data.source === "url" && isHttpUrl(data.url ?? "")) {
      setSrc(data.url);
    } else setSrc(null);
    return () => { alive = false; };
  }, [data.source, data.path, data.url]);
  return { src, loading };
}

function MediaFallback({ loading, label }: { loading: boolean; label: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--c-softer)] border border-dashed border-[color:var(--c-border)] py-10 text-center text-sm font-bold text-[color:var(--c-muted)]">
      {loading ? "جارٍ التحميل..." : `تعذّر عرض ${label}`}
    </div>
  );
}

function ImageBlock({ data }: { data: Record<string, any> }) {
  const { src, loading } = useMediaSrc(data);
  return (
    <figure className="flex flex-col items-center gap-2">
      {src ? (
        <img src={src} alt={data.caption || ""} loading="lazy" referrerPolicy="no-referrer"
          className="max-h-[420px] max-w-full rounded-2xl object-contain bg-[color:var(--c-softer)]" />
      ) : <MediaFallback loading={loading} label="الصورة" />}
      {data.caption && <figcaption className="text-sm font-bold text-[color:var(--c-muted)] text-center">{data.caption}</figcaption>}
    </figure>
  );
}

function VideoBlock({ data }: { data: Record<string, any> }) {
  const { src, loading } = useMediaSrc(data);
  const embed = data.source === "url" && src ? toEmbedUrl(src) : null;
  return (
    <figure className="flex flex-col gap-2">
      {!src || (data.source === "url" && !embed) ? (
        <MediaFallback loading={loading} label="الفيديو" />
      ) : embed?.kind === "embed" ? (
        <div className="relative w-full overflow-hidden rounded-2xl bg-black/5 aspect-video">
          <iframe src={embed.src} title={data.caption || "فيديو"} loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 w-full h-full border-0" />
        </div>
      ) : (
        <video src={embed?.src ?? src} controls playsInline preload="metadata" className="w-full max-h-[460px] rounded-2xl bg-black/5" />
      )}
      {data.caption && <figcaption className="text-sm font-bold text-[color:var(--c-muted)] text-center">{data.caption}</figcaption>}
    </figure>
  );
}

function PdfBlock({ data }: { data: Record<string, any> }) {
  const { src, loading } = useMediaSrc(data);
  const [inline, setInline] = useState(false);
  return (
    <div className="rounded-2xl bg-[color:var(--c-softer)] border border-[color:var(--c-border)] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-[color:var(--c-soft)] flex items-center justify-center text-xl shrink-0" aria-hidden="true">📄</span>
        <p className="flex-1 min-w-0 font-extrabold text-[color:var(--c-text)] break-words">{data.title || "ملف PDF"}</p>
        {src ? (
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={() => setInline((v) => !v)} className="hidden sm:inline text-sm font-extrabold text-[color:var(--c-primary)] px-3 py-2 rounded-xl hover:bg-[color:var(--c-soft)]">
              {inline ? "إخفاء" : "عرض هنا"}
            </button>
            <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm font-extrabold bg-[color:var(--c-primary)] text-[color:var(--c-on-primary)] px-4 py-2 rounded-xl">فتح الملف</a>
          </div>
        ) : <span className="text-xs font-bold text-[color:var(--c-muted)]">{loading ? "جارٍ التحميل..." : "غير متاح"}</span>}
      </div>
      {inline && src && <iframe src={src} title={data.title || "PDF"} className="w-full h-[520px] rounded-xl border border-[color:var(--c-border)] bg-white" />}
    </div>
  );
}

function QuestionBlock({
  q, index, value, onChange,
}: { q: PublicQuestion; index: number; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-[color:var(--c-primary)] text-[color:var(--c-on-primary)] font-extrabold flex items-center justify-center shrink-0 text-sm">
          {toArabicDigits(index)}
        </span>
        <p className="flex-1 text-lg font-extrabold leading-relaxed text-[color:var(--c-text)] whitespace-pre-wrap break-words pt-0.5">{q.prompt}</p>
      </div>

      {q.qtype === "mcq" && (
        <div role="radiogroup" className="flex flex-col gap-2.5">
          {(q.options ?? []).map((o) => {
            const on = value === o.id;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)}
                className={`flex items-center gap-3 text-start rounded-2xl border-2 px-4 py-3.5 font-bold transition-all ${
                  on ? "border-[color:var(--c-primary)] bg-[color:var(--c-soft)]" : "border-[color:var(--c-border)] bg-white hover:bg-[color:var(--c-softer)]"
                }`}>
                <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? "border-[color:var(--c-primary)]" : "border-[color:var(--c-border)]"}`}>
                  {on && <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--c-primary)]" />}
                </span>
                <span className="flex-1 break-words">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {q.qtype === "true_false" && (
        <div role="radiogroup" className="grid grid-cols-2 gap-3">
          {[{ v: "true", l: "صح ✓" }, { v: "false", l: "خطأ ✗" }].map((o) => {
            const on = value === o.v;
            return (
              <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.v)}
                className={`rounded-2xl border-2 py-4 text-lg font-extrabold transition-all ${
                  on ? "border-[color:var(--c-primary)] bg-[color:var(--c-soft)]" : "border-[color:var(--c-border)] bg-white hover:bg-[color:var(--c-softer)]"
                }`}>{o.l}</button>
            );
          })}
        </div>
      )}

      {q.qtype === "number" && (
        <input dir="ltr" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="اكتب الرقم" aria-label="الإجابة الرقمية" maxLength={40} className={`${inputCls} text-center text-xl`} />
      )}
      {q.qtype === "text" && (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="اكتب إجابتك هنا"
          aria-label="الإجابة النصية" maxLength={300} className={inputCls} />
      )}
    </div>
  );
}

function ItemView({
  item, qIndex, answers, setAnswer, onNext, hasNext,
}: {
  item: PublicItem; qIndex: number; answers: Record<string, string>;
  setAnswer: (id: string, v: string) => void; onNext: () => void; hasNext: boolean;
}) {
  const d = item.data ?? {};
  switch (item.kind) {
    case "heading":
      return <h2 className="text-2xl sm:text-3xl font-extrabold leading-snug text-[color:var(--c-text)] break-words">{d.text}</h2>;
    case "text":
      return <p className="text-base sm:text-lg leading-loose font-medium text-[color:var(--c-text)] whitespace-pre-wrap break-words">{d.text}</p>;
    case "instructions":
      return (
        <div className="rounded-2xl bg-[color:var(--c-soft)] px-4 py-3.5 flex gap-3">
          <span aria-hidden="true">💡</span>
          <p className="flex-1 text-[15px] leading-relaxed font-bold text-[color:var(--c-text)] whitespace-pre-wrap break-words">{d.text}</p>
        </div>
      );
    case "image": return <ImageBlock data={d} />;
    case "video": return <VideoBlock data={d} />;
    case "pdf": return <PdfBlock data={d} />;
    case "link":
      return isHttpUrl(d.url ?? "") ? (
        <a href={d.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border-2 border-[color:var(--c-border)] bg-white hover:bg-[color:var(--c-softer)] px-4 py-3.5 font-extrabold text-[color:var(--c-text)] transition-colors">
          <span aria-hidden="true">🔗</span>
          <span className="flex-1 min-w-0 break-words">{d.label || d.url}</span>
          <span className="text-[color:var(--c-primary)] text-sm shrink-0">فتح ↗</span>
        </a>
      ) : null;
    case "divider":
      return (
        <div className="flex items-center gap-3 py-1" role="separator">
          <span className="flex-1 h-px bg-[color:var(--c-border)]" />
          {d.label && <span className="text-sm font-extrabold text-[color:var(--c-muted)]">{d.label}</span>}
          <span className="flex-1 h-px bg-[color:var(--c-border)]" />
        </div>
      );
    case "button":
      return hasNext ? (
        <div className="flex justify-center"><button type="button" onClick={onNext} className={btnPrimary}>{d.label || "التالي"} ←</button></div>
      ) : null;
    case "question": {
      if (!item.question) return null;
      const attachments: PublicItem[] = (Array.isArray(d.attachments) ? d.attachments : [])
        .filter((a: any) => a && ["image", "video", "pdf", "link"].includes(a.kind))
        .map((a: any) => ({ id: String(a.id ?? a.path ?? a.url ?? Math.random()), kind: a.kind, data: a, question: null }));
      return (
        <div className="flex flex-col gap-5">
          {attachments.map((a) => (
            <ItemView key={a.id} item={a} qIndex={0} answers={answers} setAnswer={setAnswer} onNext={onNext} hasNext={false} />
          ))}
          <QuestionBlock q={item.question} index={qIndex} value={answers[item.id] ?? ""} onChange={(v) => setAnswer(item.id, v)} />
        </div>
      );
    }
    default:
      return null;
  }
}

export default function CompetitionPlayer({
  competition, slug, preview = false, onExitPreview,
}: { competition: PublicCompetition; slug?: string; preview?: boolean; onExitPreview?: () => void }) {
  const theme = getTheme(competition.theme);
  const pages = competition.pages ?? [];
  const [phase, setPhase] = useState<Phase>("intro");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const startedAt = useRef<Date>(new Date());
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const submittedRef = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const questionNumbers = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    pages.forEach((p) => p.items.forEach((i) => { if (i.kind === "question") m.set(i.id, ++n); }));
    return m;
  }, [pages]);
  const totalQuestions = questionNumbers.size;
  const answeredCount = [...questionNumbers.keys()].filter((id) => (answers[id] ?? "").trim() !== "").length;

  useEffect(() => { topRef.current?.scrollIntoView({ block: "start" }); }, [pageIndex, phase]);

  useEffect(() => {
    if (deadline === null || phase !== "play") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline, phase]);

  const remaining = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));

  async function doSubmit(auto = false) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    setSubmitting(true);
    try {
      if (preview) {
        setResult({ ok: true, show_score: false });
      } else {
        const res = await submitCompetition(slug ?? "", name, grade, answers, startedAt.current);
        setResult(res);
      }
      setPhase("done");
    } catch (e: any) {
      submittedRef.current = false;
      setError(e?.message ?? "تعذّر إرسال مشاركتك.");
      if (auto) setPhase("play");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (remaining === 0 && phase === "play" && !submittedRef.current) doSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase]);

  function start() {
    if (name.trim().length < 2) return setError("الرجاء كتابة اسمك (حرفان على الأقل).");
    if (!grade.trim()) return setError("الرجاء كتابة صفك.");
    setError(null);
    startedAt.current = new Date();
    if (competition.duration_minutes) setDeadline(Date.now() + competition.duration_minutes * 60 * 1000);
    setNow(Date.now());
    setPageIndex(0);
    setPhase("play");
  }

  const fmt = (s: number) => `${toArabicDigits(Math.floor(s / 60))}:${toArabicDigits(String(s % 60).padStart(2, "0"))}`;

  const shell = (children: ReactNode) => (
    <div dir="rtl" style={themeVars(theme)} className="min-h-screen w-full font-sans flex flex-col">
      {preview && (
        <div className="sticky top-0 z-30 bg-slate-900/90 text-white text-xs sm:text-sm font-bold px-4 py-2.5 flex items-center justify-between gap-3">
          <span>👁 وضع المعاينة — هكذا سيرى المشارك المسابقة (لا تُحفظ أي مشاركة)</span>
          {onExitPreview && <button type="button" onClick={onExitPreview} className="bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 font-extrabold">العودة للتعديل</button>}
        </div>
      )}
      <div ref={topRef} />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-5">{children}</main>
      <footer className="py-5 flex items-center justify-center gap-1.5 opacity-60">
        <img src={logoMark} alt="" className="w-4 h-4 object-contain" />
        <span className="text-[11px] font-bold text-[color:var(--c-muted)]">بنيان الرياضيات</span>
      </footer>
      <style>{`
        @keyframes cp-in{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:none}}
        .cp-in{animation:cp-in .45s cubic-bezier(.16,1,.3,1) both}
        @media (prefers-reduced-motion: reduce){.cp-in{animation:none}}
      `}</style>
    </div>
  );

  // ---------------- مقدمة ----------------
  if (phase === "intro") {
    return shell(
      <section className={`${card} cp-in p-6 sm:p-9 flex flex-col items-center text-center gap-5`}>
        <Buddy theme={theme.id} className="w-36 h-40" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug break-words">{competition.title}</h1>
          {competition.description && <p className="text-base leading-relaxed font-medium text-[color:var(--c-muted)] whitespace-pre-wrap break-words">{competition.description}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold">
          {competition.target_grade && <span className="rounded-full bg-[color:var(--c-soft)] px-3 py-1.5">🎓 {competition.target_grade}</span>}
          {totalQuestions > 0 && <span className="rounded-full bg-[color:var(--c-soft)] px-3 py-1.5">❓ {toArabicDigits(totalQuestions)} سؤال</span>}
          {competition.duration_minutes && <span className="rounded-full bg-[color:var(--c-soft)] px-3 py-1.5">⏱ {toArabicDigits(competition.duration_minutes)} دقيقة</span>}
        </div>

        <div className="w-full flex flex-col gap-3 text-start">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold">الاسم</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="اكتب اسمك" autoComplete="name" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold">الصف</span>
            <input value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={40} list="cp-grades" placeholder="مثال: الخامس" className={inputCls} />
            <datalist id="cp-grades">{GRADE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
          </label>
          {error && <p role="alert" className="text-sm font-bold text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{error}</p>}
        </div>
        <button type="button" onClick={start} className={`${btnPrimary} w-full sm:w-auto sm:min-w-[220px]`}>ابدأ المسابقة</button>
      </section>
    );
  }

  // ---------------- النجاح ----------------
  if (phase === "done") {
    return shell(
      <section className={`${card} cp-in p-8 sm:p-12 flex flex-col items-center text-center gap-4`}>
        <Buddy theme={theme.id} mood="happy" className="w-36 h-40" />
        <h1 className="text-2xl sm:text-3xl font-extrabold">🎉 تم إرسال مشاركتك بنجاح!</h1>
        <p className="text-base font-medium text-[color:var(--c-muted)]">شكرًا لمشاركتك في المسابقة.</p>
        {result?.show_score && result.max_score !== undefined && (
          <div className="mt-2 rounded-2xl bg-[color:var(--c-soft)] px-8 py-5">
            <p className="text-sm font-extrabold text-[color:var(--c-muted)]">درجتك</p>
            <p className="text-4xl font-extrabold mt-1">{toArabicDigits(result.score ?? 0)} / {toArabicDigits(result.max_score)}</p>
          </div>
        )}
        {preview && <p className="text-xs font-bold text-[color:var(--c-muted)]">(معاينة — لم تُحفظ أي مشاركة)</p>}
        {preview && onExitPreview && <button type="button" onClick={onExitPreview} className={btnSoft}>العودة للتعديل</button>}
      </section>
    );
  }

  // ---------------- التشغيل ----------------
  const page = pages[pageIndex];
  const isLast = pageIndex >= pages.length - 1;
  const progress = pages.length > 0 ? ((pageIndex + 1) / pages.length) * 100 : 100;

  return shell(
    <>
      <header className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold truncate">{competition.title}</p>
          <div className="mt-2 h-2 rounded-full bg-[color:var(--c-soft)] overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[color:var(--c-primary)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <span className="text-xs font-extrabold text-[color:var(--c-muted)] shrink-0">{toArabicDigits(pageIndex + 1)} / {toArabicDigits(pages.length)}</span>
        {remaining !== null && (
          <span className={`text-sm font-extrabold rounded-full px-3 py-1.5 shrink-0 tabular-nums ${remaining <= 60 ? "bg-rose-100 text-rose-700" : "bg-[color:var(--c-soft)]"}`} aria-label="الوقت المتبقي">
            ⏱ {fmt(remaining)}
          </span>
        )}
      </header>

      <section key={page?.id} className={`${card} cp-in p-5 sm:p-8 flex flex-col gap-6`}>
        {page?.title && <h2 className="text-xl font-extrabold text-[color:var(--c-primary)]">{page.title}</h2>}
        {page?.items.map((it) => (
          <ItemView key={it.id} item={it} qIndex={questionNumbers.get(it.id) ?? 0} answers={answers}
            setAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
            onNext={() => setPageIndex((i) => Math.min(i + 1, pages.length - 1))} hasNext={!isLast} />
        ))}
        {(!page || page.items.length === 0) && <p className="text-center text-sm font-bold text-[color:var(--c-muted)]">هذه الصفحة فارغة.</p>}
      </section>

      {error && <p role="alert" className="text-sm font-bold text-rose-600 bg-rose-50 rounded-xl px-4 py-3">{error}</p>}
      {isLast && totalQuestions > 0 && answeredCount < totalQuestions && (
        <p className="text-sm font-bold text-center text-[color:var(--c-muted)]">
          أجبتَ عن {toArabicDigits(answeredCount)} من {toArabicDigits(totalQuestions)} سؤال. يمكنك الرجوع لإكمال الباقي قبل الإرسال.
        </p>
      )}

      <nav className="flex items-center justify-between gap-3" aria-label="التنقل بين صفحات المسابقة">
        <button type="button" onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0 || submitting} className={btnSoft}>→ السابق</button>
        {isLast ? (
          <button type="button" onClick={() => doSubmit(false)} disabled={submitting} className={btnPrimary}>{submitting ? "جارٍ الإرسال..." : "إرسال المشاركة ✓"}</button>
        ) : (
          <button type="button" onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))} className={btnPrimary}>التالي ←</button>
        )}
      </nav>
    </>
  );
}
