import { useState } from "react";
import type { TaskStatus, WeeklyTask } from "../data/types";
import { toArabicDigits } from "../utils/arabicNumerals";
import { CheckCircleIcon, ChevronIcon, CircleOutlineIcon, ProgressRingIcon } from "./icons/Glyphs";

interface WeeklyTasksCardProps {
  tasks: WeeklyTask[];
  /** Resolves to whether the completion actually succeeded — the card uses
   * this to know when to stop showing "جارٍ الحفظ..." and whether to show
   * an honest failure message instead of silently closing. */
  onComplete: (task: WeeklyTask) => Promise<boolean>;
  /** Omitted entirely when there is nothing more to show beyond this list
   * (no pagination exists), so the button simply isn't rendered rather
   * than linking to a page that doesn't exist. */
  onViewAll?: () => void;
}

const STATUS_META: Record<
  TaskStatus,
  { label: string; badgeClass: string; iconClass: string; Icon: typeof CheckCircleIcon }
> = {
  "in-progress": {
    label: "قيد الإنجاز",
    badgeClass: "bg-sun-50 text-sun-500",
    iconClass: "text-sun-500",
    Icon: ProgressRingIcon,
  },
  done: {
    label: "تم الإنجاز",
    badgeClass: "bg-palm-50 text-palm-600",
    iconClass: "text-palm-500",
    Icon: CheckCircleIcon,
  },
  "not-started": {
    label: "لم يبدأ بعد",
    badgeClass: "bg-sand-100 text-ink-500",
    iconClass: "text-ink-500",
    Icon: CircleOutlineIcon,
  },
};

const STATUS_BAR_COLOR: Record<TaskStatus, string> = {
  "in-progress": "bg-sun-400",
  done: "bg-palm-500",
  "not-started": "bg-sand-200",
};

export default function WeeklyTasksCard({ tasks, onComplete, onViewAll }: WeeklyTasksCardProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  async function handleConfirm(task: WeeklyTask) {
    setSubmittingId(task.id);
    setFailedId(null);
    const succeeded = await onComplete(task);
    setSubmittingId(null);
    if (succeeded) {
      setConfirmingId(null);
    } else {
      // Keep the confirm row open so the student can retry — closing it
      // silently would look identical to a successful completion.
      setFailedId(task.id);
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-soft p-5 sm:p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-extrabold text-ink-900">مهام هذا الأسبوع</h3>
        {tasks.length > 0 && onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs font-bold text-palm-600 hover:underline"
          >
            عرض الكل
            <ChevronIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
          <p className="text-sm font-bold text-ink-700">لا توجد مهام هذا الأسبوع 🌟</p>
          <p className="text-xs text-ink-500">
            عندما تعيّن لك معلمك مهمة جديدة، ستظهر هنا فورًا.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => {
            const meta = STATUS_META[task.status];
            const StatusIcon = meta.Icon;
            const isConfirming = confirmingId === task.id;
            const isSubmitting = submittingId === task.id;

            return (
              <div key={task.id} className="rounded-2xl border border-sand-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-bold text-ink-900 text-sm leading-snug">{task.title}</p>
                  <span
                    className={`shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.badgeClass}`}
                  >
                    <StatusIcon className={`w-3.5 h-3.5 ${meta.iconClass}`} />
                    {meta.label}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-sand-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STATUS_BAR_COLOR[task.status]} transition-all duration-700`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-ink-500 w-10 text-end">
                    {toArabicDigits(task.progress)}٪
                  </span>
                </div>

                {task.status !== "done" &&
                  (isConfirming ? (
                    <div className="mt-3 flex flex-col gap-2 animate-rise-in">
                      <p className="text-xs font-bold text-ink-700">هل أنجزت هذه المهمة فعلًا؟</p>
                      {failedId === task.id && (
                        <p className="text-xs font-bold text-rose-500">
                          حدث خطأ ولم يتم الحفظ. حاول مرة أخرى.
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleConfirm(task)}
                          disabled={isSubmitting}
                          className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-palm-500 hover:bg-palm-600 disabled:opacity-60 transition-colors px-4 py-2 rounded-xl"
                        >
                          {isSubmitting ? "جارٍ الحفظ..." : "نعم، أنجزتها"}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmingId(null);
                            setFailedId(null);
                          }}
                          disabled={isSubmitting}
                          className="text-xs font-bold text-ink-500 hover:bg-sand-100 disabled:opacity-60 transition-colors px-4 py-2 rounded-xl"
                        >
                          تراجع
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(task.id)}
                      className="mt-3 text-xs font-extrabold text-white bg-palm-500 hover:bg-palm-600 transition-colors px-4 py-2 rounded-xl"
                    >
                      {task.actionLabel}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
