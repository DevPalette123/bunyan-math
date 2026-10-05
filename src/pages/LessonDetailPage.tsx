import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StudentShell from "../components/StudentShell";
import { getLessonById } from "../data/lessons";
import LessonVideoPlayer from "../components/lessons/LessonVideoPlayer";
import { ChevronIcon, CheckCircleIcon } from "../components/icons/Glyphs";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { completeLesson, fetchCompletedLessonIds } from "../lib/lessonProgress";

export default function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const lesson = getLessonById(lessonId);

  const [completed, setCompleted] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Real completion state, fetched once per visit — never assumed.
  useEffect(() => {
    if (!isSupabaseConfigured || !profile || !lesson) return;
    let isMounted = true;
    fetchCompletedLessonIds(profile.id).then((ids) => {
      if (isMounted) setCompleted(ids.has(lesson.id));
    });
    return () => {
      isMounted = false;
    };
  }, [profile, lesson]);

  // Separated from the video-ended event itself so the "إعادة المحاولة"
  // button below can call the exact same save path directly — the video
  // player only ever fires "ended" once per mount, so relying on rewatching
  // to retry a failed save would not work.
  async function saveCompletion() {
    if (!lesson || completed || savingCompletion) return;
    setSavingCompletion(true);
    setCompletionError(null);
    const { error } = await completeLesson(lesson.id);
    setSavingCompletion(false);

    if (error) {
      // Not saved — completed/justCompleted stay false, so the badge still
      // honestly reads "غير مكتمل" and the celebratory line never shows.
      setCompletionError("حدث خطأ أثناء حفظ إنجاز هذا الدرس. اضغط «إعادة المحاولة».");
      return;
    }

    setCompleted(true);
    setJustCompleted(true);
  }

  function handleVideoEnded() {
    saveCompletion();
  }

  if (!lesson) {
    return (
      <StudentShell activeId="learn">
        <main className="max-w-2xl mx-auto px-4 py-10 text-center flex flex-col items-center gap-4">
          <p className="text-base font-bold text-ink-700">هذا الدرس غير موجود.</p>
          <button
            onClick={() => navigate("/learn")}
            className="text-sm font-extrabold text-berry-600 hover:bg-berry-50 px-4 py-2 rounded-xl transition-colors"
          >
            العودة إلى تعلّم
          </button>
        </main>
      </StudentShell>
    );
  }

  return (
    <StudentShell activeId="learn">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center text-center gap-5">
        <button
          onClick={() => navigate("/learn")}
          className="self-start flex items-center gap-1 text-xs font-bold text-ink-500 hover:text-ink-700 transition-colors"
        >
          <ChevronIcon className="w-3.5 h-3.5 rotate-180" />
          تعلّم
        </button>

        <img src={lesson.icon} alt="" className="w-24 h-24 sm:w-28 sm:h-28 object-contain animate-pop-in" />

        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900">{lesson.title}</h1>

        <span
          className={`flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full transition-colors ${
            completed ? "bg-palm-50 text-palm-600" : "bg-sand-100 text-ink-500"
          }`}
        >
          {completed && <CheckCircleIcon className="w-3.5 h-3.5" />}
          {completed ? "مكتمل" : savingCompletion ? "جارٍ الحفظ..." : "غير مكتمل"}
        </span>

        <LessonVideoPlayer video={lesson.video} title={lesson.title} onEnded={handleVideoEnded} />

        {completionError && (
          <div className="flex flex-col items-center gap-2 animate-rise-in">
            <p className="text-xs font-bold text-rose-500">{completionError}</p>
            <button
              onClick={saveCompletion}
              disabled={savingCompletion}
              className="text-xs font-extrabold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-60 transition-colors px-4 py-2 rounded-xl"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {justCompleted && (
          <p className="text-sm font-extrabold text-palm-600 animate-pop-in">
            أحسنت! أكملت هذا الدرس وحصلت على نقاطك. ⭐
          </p>
        )}

        <button
          onClick={() => navigate("/learn")}
          className="mt-2 bg-berry-500 hover:bg-berry-600 text-white font-extrabold text-sm rounded-2xl px-8 py-3.5 transition-colors"
        >
          العودة إلى تعلّم
        </button>
      </main>
    </StudentShell>
  );
}
