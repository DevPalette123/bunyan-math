// شارة «وضع التجربة» + زر «الخروج من التجربة». تظهر فقط للجلسات التجريبية، وتُثبَّت أسفل
// الشاشة دون أن تغيّر تخطيط أي صفحة. تُرسل أيضًا نبضة نشاط كل ٥ دقائق أثناء ظهور الصفحة.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isDemoSession, demoTouch } from "../lib/demo";

export default function DemoBadge() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const demo = isDemoSession(session);

  useEffect(() => {
    if (!demo) return;
    demoTouch();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") demoTouch();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [demo]);

  // لا تظهر في صفحة المسابقة العامة (يراها مشاركون من الخارج) ولا في صفحة الدخول.
  if (!demo || pathname.startsWith("/competition/") || pathname === "/login") return null;

  async function exit() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-x-0 bottom-[5.5rem] md:bottom-4 z-40 flex justify-center pointer-events-none px-3"
    >
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 shadow-lift border border-sand-200 ps-3 pe-1 py-1">
        <span className="text-[11px] font-extrabold text-ink-700">🧪 وضع التجربة</span>
        <button
          type="button"
          onClick={exit}
          className="text-[11px] font-extrabold text-rose-500 hover:bg-rose-50 rounded-full px-3 py-1.5 transition-colors"
        >
          الخروج من التجربة
        </button>
      </div>
    </div>
  );
}
