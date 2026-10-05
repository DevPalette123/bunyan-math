import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import { CloseIcon } from "../icons/Glyphs";

interface AddStudentModalProps {
  onClose: () => void;
  onAdded: () => void;
}

type Step = "form" | "success";

export default function AddStudentModal({ onClose, onAdded }: AddStudentModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState("");
  const [createdName, setCreatedName] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (!trimmed) {
      setError("الرجاء إدخال اسم الطالب.");
      return;
    }
    setSubmitting(true);
    setError(null);

    // Real account creation happens server-side (service-role key never
    // touches the browser) — see supabase/functions/create-student.
    const { data, error: invokeError } = await supabase.functions.invoke("create-student", {
      body: { full_name: trimmed },
    });

    setSubmitting(false);
    if (invokeError || !data?.login_code) {
      setError("تعذّر إضافة الطالب. حاول مرة أخرى.");
      return;
    }
    setCreatedCode(data.login_code as string);
    setCreatedName(data.full_name as string);
    setStep("success");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — the code
      // stays visible on screen either way, so this is a soft failure.
    }
  }

  function handleDone() {
    onAdded();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lift p-6 sm:p-7 animate-pop-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            {step === "form" ? "إضافة طالب" : "تمت الإضافة"}
          </h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <CloseIcon className="w-4.5 h-4.5" />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-start">
              <span className="text-xs font-bold text-slate-700">اسم الطالب</span>
              <input
                type="text"
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teach-500 text-end"
                placeholder="مثال: محمد أحمد"
              />
            </label>

            {error && (
              <p className="text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 bg-teach-500 hover:bg-teach-600 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl py-3 transition-colors"
            >
              {submitting ? "جارٍ الإضافة..." : "إضافة الطالب"}
            </button>
          </form>
        )}

        {step === "success" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-700">
              تمت إضافة <span className="font-extrabold">{createdName}</span>. هذا رمز دخوله —
              شاركيه معه، ويمكنك عرضه لاحقًا من قائمة الطلاب:
            </p>

            <div className="flex items-center justify-between gap-3 bg-teach-50 rounded-2xl px-4 py-3">
              <span dir="ltr" className="text-xl font-extrabold tracking-widest text-teach-700">
                {createdCode}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-bold text-teach-600 hover:bg-white px-3 py-1.5 rounded-xl transition-colors shrink-0"
              >
                {copied ? "تم النسخ ✓" : "نسخ الرمز"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleDone}
              className="bg-teach-500 hover:bg-teach-600 text-white font-extrabold text-sm rounded-2xl py-3 transition-colors"
            >
              تم
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
