interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xs bg-white rounded-3xl shadow-lift p-6 animate-pop-in text-center">
        <h3 className="text-base font-extrabold text-slate-900 mb-1.5">{title}</h3>
        <p className="text-sm text-slate-500 mb-5">{description}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl py-3 transition-colors"
          >
            {loading ? "جارٍ الحذف..." : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-500 hover:bg-slate-100 font-bold text-sm rounded-2xl py-3 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
