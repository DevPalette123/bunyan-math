import { useState } from "react";
import type { PracticeLesson } from "../../data/practiceLessons";
import { ChevronIcon, CheckCircleIcon, CircleOutlineIcon, DownloadIcon } from "../icons/Glyphs";
import { completePractice } from "../../lib/practiceProgress";

interface PracticeCardProps {
  lesson: PracticeLesson;
  /** Whether this student has actually opened/downloaded this sheet before
   * (real data from practice_completions — see PracticePage). */
  completed?: boolean;
}

type Action = "open" | "download";
type CardState = "idle" | "missing";

/** A real fetch, not just window.open/an <a download> straight to pdfUrl —
 * this is what lets us tell a genuinely missing worksheet apart from an
 * existing one *before* a broken tab/empty download happens, and (via
 * content-type) apart from a static host that answers every unknown path
 * with index.html instead of a 404. Shared by both actions below. */
async function fetchWorksheet(pdfUrl: string): Promise<Blob | null> {
  const response = await fetch(pdfUrl);
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("pdf")) return null;
  return response.blob();
}

export default function PracticeCard({ lesson, completed = false }: PracticeCardProps) {
  const [state, setState] = useState<CardState>("idle");
  const [busy, setBusy] = useState<Action | null>(null);
  // Optimistic local flag: flips the badge the moment an open/download
  // actually succeeds, without waiting on a page-wide refetch. The prop
  // above is what's real on next load; this just avoids a stale badge
  // during this same visit.
  const [justCompleted, setJustCompleted] = useState(false);
  const isCompleted = completed || justCompleted;

  function markCompleted() {
    if (isCompleted) return; // already recorded — server call is idempotent anyway, but skip the noise
    setJustCompleted(true);
    completePractice(lesson.id); // fire-and-forget: never blocks or fails the open/download itself
  }

  async function handleOpen() {
    if (busy) return;
    setBusy("open");
    try {
      const blob = await fetchWorksheet(lesson.pdfUrl);
      if (!blob) {
        setState("missing");
        return;
      }
      window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
      setState("idle");
      markCompleted();
    } catch {
      setState("missing");
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    if (busy) return;
    setBusy("download");
    try {
      const blob = await fetchWorksheet(lesson.pdfUrl);
      if (!blob) {
        setState("missing");
        return;
      }
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `ورقة عمل - ${lesson.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      setState("idle");
      markCompleted();
    } catch {
      setState("missing");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-center text-center gap-3 rounded-3xl bg-white p-5 sm:p-6 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300 animate-pop-in">
      <button
        type="button"
        onClick={handleOpen}
        disabled={busy !== null}
        className="group flex flex-col items-center gap-3 disabled:cursor-wait"
      >
        {/* Height is fixed (responsive across breakpoints) and width is left
            auto so the browser derives it from the icon's real 3:4 ratio —
            this guarantees the illustration is never cropped on any side,
            regardless of its original aspect ratio, matching how lessons'
            icons are shown elsewhere in the platform (object-contain, no
            crop box). Same visual scale as LessonCard's h-20/h-24 icons. */}
        <span className="relative h-20 sm:h-24 flex items-center justify-center">
          <img
            src={lesson.icon}
            alt={lesson.title}
            className="h-full w-auto object-contain group-hover:scale-105 transition-transform duration-300"
          />
          {busy === "open" && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
              <span className="w-6 h-6 rounded-full border-2 border-berry-300 border-t-berry-600 animate-spin" />
            </span>
          )}
        </span>

        <h3 className="text-sm sm:text-base font-extrabold text-ink-900">{lesson.title}</h3>

        {state === "missing" ? (
          <span className="text-xs font-bold text-rose-500 leading-relaxed animate-rise-in">
            ملف التدريب غير متوفر حاليًا، سيتم إضافته قريبًا.
          </span>
        ) : isCompleted ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-palm-600">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            مكتمل ✓
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-bold text-ink-500">
            <CircleOutlineIcon className="w-3.5 h-3.5" />
            افتح التدريب
            <ChevronIcon className="w-3 h-3 rotate-180" />
          </span>
        )}
      </button>

      {state !== "missing" && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy !== null}
          className="flex items-center gap-1.5 text-xs font-bold text-berry-600 hover:text-berry-700 disabled:cursor-wait disabled:opacity-60 transition-colors"
        >
          {busy === "download" ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-berry-300 border-t-berry-600 animate-spin" />
          ) : (
            <DownloadIcon className="w-3.5 h-3.5" />
          )}
          تنزيل الملف
        </button>
      )}
    </div>
  );
}
