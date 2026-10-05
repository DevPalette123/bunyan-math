import { useState } from "react";
import { competitionUrl, isLocalBase, type ThemeId } from "../../lib/competitions";
import { CopyIcon, CheckCircleIcon } from "../icons/Glyphs";
import { getTheme, themeVars } from "./themes";
import Buddy from "./Buddy";

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}

function shareText(title: string): string {
  return `🏆 ${title}\nشاركوا في المسابقة الآن 👇`;
}

export async function shareCompetition(title: string, slug: string): Promise<void> {
  const url = competitionUrl(slug);
  if (navigator.share) {
    try { await navigator.share({ title, text: shareText(title), url }); return; } catch (e: any) { if (e?.name === "AbortError") return; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText(title)}\n${url}`)}`, "_blank", "noopener,noreferrer");
}

function prettyUrl(url: string): { host: string; path: string } {
  try {
    const u = new URL(url);
    return { host: u.host, path: u.pathname };
  } catch { return { host: url, path: "" }; }
}

/**
 * بطاقة مشاركة المسابقة: شكل المسابقة (اللون والشخصية والعنوان والنبذة) + الرابط في زر أنيق
 * + نسخ ومشاركة وفتح. إن كان الرابط محليًا (localhost) تظهر تنبيهًا لأنه لن يعمل عند غيرك.
 */
export default function ShareLink({
  title, slug, theme = "sky", description, success = false,
}: { title: string; slug: string; theme?: ThemeId; description?: string | null; success?: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = competitionUrl(slug);
  const t = getTheme(theme);
  const { host, path } = prettyUrl(url);
  const local = isLocalBase();

  async function onCopy() {
    if (await copyText(url)) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  return (
    <div className="flex flex-col gap-3">
      {success && (
        <p className="text-base font-extrabold text-mint-600 flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5" />تم نشر المسابقة بنجاح
        </p>
      )}

      {/* معاينة بطاقة المسابقة كما تبدو للمشاركين */}
      <div dir="rtl" style={themeVars(t)} className="rounded-3xl border border-[color:var(--c-border)] overflow-hidden [box-shadow:var(--c-shadow)]">
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <Buddy theme={t.id} className="w-20 h-24 shrink-0" float={false} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold text-[color:var(--c-muted)]">🏆 مسابقة</p>
            <p className="text-lg font-extrabold leading-snug break-words text-[color:var(--c-text)]">{title}</p>
            {description && <p className="text-sm font-medium text-[color:var(--c-muted)] leading-relaxed line-clamp-2 mt-0.5">{description}</p>}
          </div>
        </div>
        <button
          type="button" onClick={onCopy} aria-label="نسخ رابط المسابقة"
          className="w-full flex items-center gap-3 bg-white/80 hover:bg-white border-t border-[color:var(--c-border)] px-4 py-3 text-start transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-[color:var(--c-soft)] flex items-center justify-center shrink-0" aria-hidden="true">🔗</span>
          <span dir="ltr" className="flex-1 min-w-0 text-start leading-tight">
            <span className="block text-[11px] font-bold text-[color:var(--c-muted)] truncate">{host}</span>
            <span className="block text-sm font-extrabold text-[color:var(--c-text)] truncate">{path}</span>
          </span>
          <span className="text-xs font-extrabold text-[color:var(--c-primary)] shrink-0">{copied ? "تم النسخ ✓" : "نسخ"}</span>
        </button>
      </div>

      {local && (
        <p role="note" className="text-xs font-bold text-amber-700 bg-amber-50 rounded-2xl px-4 py-3 leading-relaxed">
          ⚠️ هذا رابط محلي ({host}) ولن يفتح عند أي شخص آخر. انشر الموقع على الإنترنت، واضبط
          <span dir="ltr" className="mx-1 font-extrabold">VITE_PUBLIC_SITE_URL</span>
          بعنوانه، ثم أعد نسخ الرابط.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onCopy} className="flex items-center gap-1.5 text-sm font-extrabold text-white bg-teach-500 hover:bg-teach-600 rounded-xl px-4 py-2.5 transition-colors">
          {copied ? <CheckCircleIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
          {copied ? "تم النسخ ✓" : "نسخ الرابط"}
        </button>
        <button type="button" onClick={() => shareCompetition(title, slug)} className="text-sm font-extrabold text-teach-600 bg-white hover:bg-teach-50 border border-teach-100 rounded-xl px-4 py-2.5 transition-colors">📤 مشاركة</button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl px-4 py-2.5 transition-colors">فتح المسابقة ↗</a>
      </div>
      <p className="text-[11px] font-bold text-slate-400">أي شخص يملك الرابط يستطيع المشاركة بدون حساب.</p>
    </div>
  );
}
