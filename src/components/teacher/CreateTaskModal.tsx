import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { CloseIcon } from "../icons/Glyphs";

interface RosterStudentOption {
  id: string;
  full_name: string;
}

interface CreateTaskModalProps {
  classId: string;
  teacherId: string;
  students: RosterStudentOption[];
  onClose: () => void;
  onCreated: () => void;
}

const TASK_TYPES: { value: string; label: string }[] = [
  { value: "general", label: "عام" },
  { value: "lesson", label: "درس" },
  { value: "practice", label: "تدريب" },
  { value: "quiz", label: "اختبار قصير" },
];

export default function CreateTaskModal({
  classId,
  teacherId,
  students,
  onClose,
  onCreated,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [points, setPoints] = useState("5");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignAll, setAssignAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("الرجاء إدخال عنوان المهمة.");
      return;
    }
    const targetIds = assignAll ? students.map((s) => s.id) : selectedIds;
    if (targetIds.length === 0) {
      setError("اختر طالبًا واحدًا على الأقل، أو كل الطلاب.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data: taskRow, error: taskError } = await supabase
      .from("tasks")
      .insert({
        class_id: classId,
        teacher_id: teacherId,
        title: trimmedTitle,
        description: description.trim() || null,
        task_type: taskType,
        points: Number(points) || 0,
        start_date: startDate || null,
        due_date: dueDate || null,
      })
      .select("id")
      .single();

    if (taskError || !taskRow) {
      setSubmitting(false);
      setError("تعذّر إنشاء المهمة. حاول مرة أخرى.");
      return;
    }

    const { error: assignError } = await supabase
      .from("task_assignments")
      .insert(targetIds.map((studentId) => ({ task_id: taskRow.id, student_id: studentId })));

    setSubmitting(false);
    if (assignError) {
      setError("أُنشئت المهمة لكن تعذّر تعيينها لبعض الطلاب.");
      return;
    }
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lift p-6 sm:p-7 animate-pop-in max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-slate-900">إضافة مهمة</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <CloseIcon className="w-4.5 h-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-start">
            <span className="text-xs font-bold text-slate-700">عنوان المهمة</span>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teach-500 text-end"
              placeholder="مثال: حل 10 تمارين على الجمع"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-start">
            <span className="text-xs font-bold text-slate-700">وصف مختصر (اختياري)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teach-500 text-end resize-none"
              placeholder="تعليمات مختصرة للطالب"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-start">
              <span className="text-xs font-bold text-slate-700">النوع</span>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teach-500 text-end"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-start">
              <span className="text-xs font-bold text-slate-700">النقاط</span>
              <input
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teach-500 text-end"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-start">
              <span className="text-xs font-bold text-slate-700">تاريخ البداية</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teach-500"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-start">
              <span className="text-xs font-bold text-slate-700">موعد التسليم</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teach-500"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-700">تعيين المهمة إلى</span>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => setAssignAll(true)}
                className={`rounded-xl py-2 text-xs font-extrabold transition-colors ${
                  assignAll ? "bg-white text-teach-600 shadow-soft" : "text-slate-500"
                }`}
              >
                جميع الطلاب
              </button>
              <button
                type="button"
                onClick={() => setAssignAll(false)}
                className={`rounded-xl py-2 text-xs font-extrabold transition-colors ${
                  !assignAll ? "bg-white text-teach-600 shadow-soft" : "text-slate-500"
                }`}
              >
                طلاب محددون
              </button>
            </div>

            {!assignAll && (
              <ul className="flex flex-col gap-1.5 max-h-40 overflow-y-auto mt-1 list-none">
                {students.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => toggleSelected(s.id)}
                        className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-start text-sm font-bold transition-colors ${
                          checked ? "border-teach-500 bg-teach-50 text-teach-700" : "border-slate-200 text-slate-700"
                        }`}
                      >
                        {s.full_name}
                        <span
                          className={`w-4 h-4 rounded-md border-2 shrink-0 ${
                            checked ? "bg-teach-500 border-teach-500" : "border-slate-300"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 bg-teach-500 hover:bg-teach-600 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl py-3 transition-colors"
          >
            {submitting ? "جارٍ الإضافة..." : "إضافة المهمة"}
          </button>
        </form>
      </div>
    </div>
  );
}
