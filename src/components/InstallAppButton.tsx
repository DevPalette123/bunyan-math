import { useEffect, useState } from "react";

/**
 * زر «ثبّت بنيان كتطبيق» (PWA).
 * - Chrome/Edge/Android: يستخدم حدث beforeinstallprompt الأصلي ويُظهر نافذة التثبيت الأصلية للمتصفح.
 * - iPhone/iPad (لا يدعمان الحدث): يُظهر تعليمات قصيرة لإضافة المنصة إلى الشاشة الرئيسية.
 * - غير ذلك، أو إن كانت المنصة مثبّتة/مفتوحة كتطبيق: لا يظهر شيء ولا أخطاء.
 * يُعرَض في صفحة الدخول (الصفحة الرئيسية) فقط، ولا يُستخدم في صفحات المسابقات.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// نلتقط الحدث على مستوى الملف (عند تحميل التطبيق) كي لا يفوتنا إن أُطلق قبل ظهور الزر.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // نستبدل شريط التثبيت الافتراضي بزرّنا
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)")?.matches === true ||
    nav.standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) // iPadOS
  );
}

export default function InstallAppButton({ className = "" }: { className?: string }) {
  const [, rerender] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // مثبّتة بالفعل (أو مفتوحة كتطبيق): لا نُظهر الزر.
  if (installed || isStandalone()) return null;

  const canPrompt = deferredPrompt !== null;
  const ios = isIos();
  // متصفح لا يدعم التثبيت البرمجي وليس iOS: لا نُظهر شيئًا.
  if (!canPrompt && !ios) return null;

  async function handleClick() {
    const promptEvent = deferredPrompt;
    if (promptEvent) {
      deferredPrompt = null; // الحدث يُستعمل مرة واحدة فقط
      setBusy(true);
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") installed = true;
      } catch {
        // لا نُظهر أخطاء للمستخدم.
      }
      setBusy(false);
      notify();
      return;
    }
    setShowIosHelp((open) => !open);
  }

  return (
    <div className={`bg-white rounded-3xl shadow-soft p-5 text-center ${className}`}>
      <img
        src="/icons/icon-192.png"
        alt=""
        aria-hidden="true"
        className="w-12 h-12 rounded-2xl mx-auto object-contain"
      />
      <p className="text-[11px] text-ink-500 mt-2 leading-relaxed">
        تفتح المنصة من شاشة الهاتف مباشرة، كأي تطبيق.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="mt-3 w-full bg-palm-500 hover:bg-palm-600 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl py-3 transition-colors"
      >
        ثبّت بنيان كتطبيق
      </button>
      {!canPrompt && showIosHelp && (
        <p
          role="note"
          className="mt-3 text-[11px] font-bold text-ink-700 bg-palm-50 rounded-xl px-3 py-2 leading-relaxed text-start"
        >
          افتح الرابط في متصفح Safari، ثم اضغط زر المشاركة <span aria-hidden="true">⬆︎</span> واختر
          «إضافة إلى الشاشة الرئيسية».
        </p>
      )}
    </div>
  );
}
