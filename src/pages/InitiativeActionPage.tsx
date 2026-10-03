import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StudentShell from "../components/StudentShell";
import { initiatives } from "../data/initiatives";
import { toArabicDigits } from "../utils/arabicNumerals";
import { ChevronIcon, CheckCircleIcon, ClipboardCheckIcon } from "../components/icons/Glyphs";
import SkillsGrowthGame from "../components/initiatives/SkillsGrowthGame";
import IdentityHomelandPresentation from "../components/initiatives/IdentityHomelandPresentation";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { completeInitiative, fetchCompletedInitiativeIds } from "../lib/initiativeProgress";

type PdfStatus = "checking" | "ready" | "missing";

export default function InitiativeActionPage() {
  const { initiativeId } = useParams<{ initiativeId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const item = initiatives.find((i) => i.id === initiativeId);

  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("checking");
  const [slideIndex, setSlideIndex] = useState(0);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  // Real data once loaded (see effect below) — starts false so we never
  // show "مكتمل" before we actually know that.
  const [completed, setCompleted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!item || item.kind !== "pdf" || !item.fileUrl) return;
    let isMounted = true;

    async function check() {
      try {
        const response = await fetch(item!.fileUrl!);
        const contentType = response.headers.get("content-type") ?? "";
        if (isMounted) setPdfStatus(response.ok && contentType.includes("pdf") ? "ready" : "missing");
      } catch {
        if (isMounted) setPdfStatus("missing");
      }
    }
    check();
    return () => {
      isMounted = false;
    };
  }, [item]);

  useEffect(() => {
    if (!item || item.kind === "coming-soon" || !isSupabaseConfigured || !profile) return;
    let isMounted = true;
    fetchCompletedInitiativeIds(profile.id).then((ids) => {
      if (isMounted && ids.has(item.id)) setCompleted(true);
    });
    return () => {
      isMounted = false;
    };
  }, [item, profile]);

  /** حفظ حقيقي للألعاب: ننتظر ردّ الخادم ولا نعرض النجاح إلا إن نجح فعلًا. */
  async function saveCompletion() {
    if (!item) return;
    setSaveStatus("saving");
    const { error } = await completeInitiative(item.id);
    if (error) {
      setSaveStatus("error");
      return;
    }
    setSaveStatus("saved");
    setCompleted(true);
  }

  function markCompleted() {
    if (!item || completed) return;
    setCompleted(true); // optimistic — server call is idempotent regardless
    completeInitiative(item.id);
  }

  // Edge case: a one-slide deck has no "next" click to trigger completion
  // on (the button starts disabled) — mark it complete on arrival instead.
  useEffect(() => {
    if (item?.kind === "slides" && (item.slideCount ?? 0) <= 1) markCompleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  if (!item) {
    return (
      <StudentShell activeId="home">
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className="text-sm font-bold text-ink-500">هذا المحتوى غير متاح حاليًا.</p>
        </main>
      </StudentShell>
    );
  }

  const backButton = (
    <button
      onClick={() => navigate("/student")}
      className="flex items-center gap-1 text-xs font-bold text-ink-500 hover:text-ink-700 transition-colors shrink-0"
    >
      <ChevronIcon className="w-3.5 h-3.5 rotate-180" />
      الرئيسية
    </button>
  );

  // -------------------------------------------------------------------
  // Coming soon
  // -------------------------------------------------------------------
  if (item.kind === "coming-soon") {
    return (
      <StudentShell activeId="home">
        <main className="max-w-lg mx-auto px-4 py-14 flex flex-col items-center text-center gap-5">
          {backButton}
          <img src={item.icon} alt="" className="w-20 h-20 object-contain" />
          <h1 className="text-xl font-extrabold text-ink-900">{item.title}</h1>
          <p className="text-sm font-bold text-ink-500 bg-sand-100 px-4 py-2.5 rounded-full">قريبًا</p>
        </main>
      </StudentShell>
    );
  }

  // -------------------------------------------------------------------
  // Game — تفاعلية داخل المنصة، تُفتح مباشرة عند الضغط على البطاقة
  // -------------------------------------------------------------------
  if (item.kind === "game") {
    return (
      <StudentShell activeId={item.id}>
        <SkillsGrowthGame
          alreadyCompleted={completed}
          onComplete={saveCompletion}
          saveStatus={saveStatus}
          onExit={() => navigate("/student")}
        />
      </StudentShell>
    );
  }

  // -------------------------------------------------------------------
  // Presentation — العرض التفاعلي (فيديوهات الولايات) يعمل داخل الصفحة.
  // يُسجَّل الإكمال عندما تنهي الطالبة فيديوهات الولايات الأربع إلى آخرها.
  // -------------------------------------------------------------------
  if (item.kind === "presentation") {
    const totalVideos = 4;
    function handleVideoEnded(id: string) {
      const next = new Set(watched);
      next.add(id);
      setWatched(next);
      if (next.size >= totalVideos) markCompleted();
    }
    return (
      <StudentShell activeId={item.id}>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {backButton}
            <h1 className="text-base sm:text-lg font-extrabold text-ink-900">{item.title}</h1>
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink-500 shrink-0">
              {completed ? (
                <>
                  <CheckCircleIcon className="w-3.5 h-3.5 text-palm-500" />
                  مكتمل
                </>
              ) : (
                <>{toArabicDigits(watched.size)} / {toArabicDigits(totalVideos)}</>
              )}
            </span>
          </div>
          <IdentityHomelandPresentation onVideoEnded={handleVideoEnded} />
        </main>
      </StudentShell>
    );
  }

  // -------------------------------------------------------------------
  // PDF — shown inline, inside the platform, via a native browser viewer
  // -------------------------------------------------------------------
  if (item.kind === "pdf") {
    return (
      <StudentShell activeId={item.id}>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4 h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)]">
          <div className="flex items-center justify-between shrink-0">
            {backButton}
            <h1 className="text-base sm:text-lg font-extrabold text-ink-900">{item.title}</h1>
            <span className="w-16" />
          </div>

          {pdfStatus === "checking" && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-bold text-ink-500">جارٍ التحقق من الملف...</p>
            </div>
          )}

          {pdfStatus === "missing" && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-bold text-rose-500">الملف غير متوفر حاليًا، سيتم إضافته قريبًا.</p>
            </div>
          )}

          {pdfStatus === "ready" && (
            <>
              <div className="flex-1 rounded-3xl overflow-hidden shadow-soft bg-white">
                <iframe src={item.fileUrl} title={item.title} className="w-full h-full border-0" />
              </div>
              <div className="shrink-0 flex justify-center">
                {completed ? (
                  <span className="flex items-center gap-1.5 text-sm font-extrabold text-palm-600">
                    <CheckCircleIcon className="w-4 h-4" />
                    أنهيتِ الاطلاع ✓
                  </span>
                ) : (
                  <button
                    onClick={markCompleted}
                    className="flex items-center gap-1.5 bg-palm-500 hover:bg-palm-600 text-white font-extrabold text-sm rounded-2xl px-5 py-2.5 transition-colors"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    أنهيتُ الاطلاع
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </StudentShell>
    );
  }

  // -------------------------------------------------------------------
  // Slides — real slide images rendered from the actual .pptx, shown in
  // a custom in-app viewer (browsers can't render .pptx natively at all).
  // -------------------------------------------------------------------
  const total = item.slideCount ?? 0;
  const src = `${item.slidesBasePath}${slideIndex + 1}.jpg`;

  function goToSlide(next: number) {
    const clamped = Math.max(0, Math.min(total - 1, next));
    setSlideIndex(clamped);
    if (clamped === total - 1) markCompleted(); // reaching the last slide = real completion signal, like a video's onEnded
  }

  return (
    <StudentShell activeId="home">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between shrink-0">
          {backButton}
          <h1 className="text-base sm:text-lg font-extrabold text-ink-900">{item.title}</h1>
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink-500 shrink-0">
            {completed && <CheckCircleIcon className="w-3.5 h-3.5 text-palm-500" />}
            {toArabicDigits(slideIndex + 1)} / {toArabicDigits(total)}
          </span>
        </div>

        <div className="rounded-3xl overflow-hidden shadow-soft bg-white">
          <img src={src} alt={`${item.title} — الشريحة ${toArabicDigits(slideIndex + 1)}`} className="w-full h-auto block" />
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => goToSlide(slideIndex - 1)}
            disabled={slideIndex === 0}
            className="flex items-center gap-1.5 bg-white shadow-soft disabled:opacity-40 text-ink-700 font-extrabold text-sm rounded-2xl px-5 py-2.5 transition-opacity"
          >
            <ChevronIcon className="w-4 h-4" />
            السابقة
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i === slideIndex ? "bg-berry-500" : "bg-sand-200"}`}
              />
            ))}
          </div>
          <button
            onClick={() => goToSlide(slideIndex + 1)}
            disabled={slideIndex >= total - 1}
            className="flex items-center gap-1.5 bg-berry-500 hover:bg-berry-600 disabled:opacity-40 text-white font-extrabold text-sm rounded-2xl px-5 py-2.5 transition-colors"
          >
            التالية
            <ChevronIcon className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {item.downloadUrl && (
          <a
            href={item.downloadUrl}
            download
            className="self-center flex items-center gap-1.5 text-xs font-bold text-ink-500 hover:text-ink-700 transition-colors"
          >
            <ClipboardCheckIcon className="w-3.5 h-3.5" />
            تنزيل العرض كملف PowerPoint
          </a>
        )}
      </main>
    </StudentShell>
  );
}
