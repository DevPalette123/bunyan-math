import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import logoMark from "../assets/logo/logo-mark.png";
import BrandFooter from "../components/BrandFooter";
import InstallAppButton from "../components/InstallAppButton";
import SchoolLogo from "../components/SchoolLogo";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { getDemoStatus, startDemo, type DemoStatus } from "../lib/demo";

type LoginTab = "teacher" | "student";

export default function LoginPage() {
  const { session, profile, initialized, loading, signIn, signInWithStudentCode, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<LoginTab>("teacher");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // وضع التدشين: تظهر أزرار التجربة فقط إذا فعّلتها الإدارة (demo_status).
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const demoAvailable = demoStatus === "on";
  const [demoBusy, setDemoBusy] = useState<"teacher" | "student" | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getDemoStatus().then((st) => alive && setDemoStatus(st));
    return () => {
      alive = false;
    };
  }, []);

  // الدور الذي طلبته الزائرة في التجربة. نتحقق منه بعد تحميل البروفايل الفعلي قبل أي انتقال:
  // إن لم يطابق (حساب/Slot بدور خاطئ) لا نُدخلها لصفحة الدور الآخر بصمت، بل نُنهي الجلسة ونُظهر السبب.
  const [pendingDemoRole, setPendingDemoRole] = useState<"teacher" | "student" | null>(null);

  async function handleDemo(role: "teacher" | "student") {
    setDemoError(null);
    setDemoBusy(role);
    const result = await startDemo(role);
    if (result.error) {
      setDemoBusy(null);
      setDemoError(result.error);
      return;
    }
    // نجحت الجلسة: ننتظر تحميل البروفايل ثم يتولّى الـeffect أدناه التوجيه بحسب الدور المطلوب.
    setPendingDemoRole(role);
  }

  useEffect(() => {
    if (!pendingDemoRole || !initialized || loading || !session) return;
    if (!profile) {
      setDemoBusy(null);
      setPendingDemoRole(null);
      setDemoError("تعذّر تحميل حساب التجربة. حاولي مرة أخرى بعد قليل.");
      void signOut();
      return;
    }
    const wanted = pendingDemoRole;
    setPendingDemoRole(null);
    setDemoBusy(null);
    if (profile.role !== wanted) {
      // eslint-disable-next-line no-console
      console.error(`[demo] دور الحساب (${profile.role}) لا يطابق الدور المطلوب (${wanted}).`);
      setDemoError(
        wanted === "teacher"
          ? "حساب «تجربة المعلمة» خرج بدور طالبة. أعيدي نشر دالتي demo-start و demo-sweep ثم جرّبي مرة أخرى."
          : "حساب «تجربة الطالبة» خرج بدور معلمة. أعيدي نشر دالتي demo-start و demo-sweep ثم جرّبي مرة أخرى."
      );
      void signOut();
      return;
    }
    navigate(wanted === "teacher" ? "/teacher" : "/student", { replace: true });
  }, [pendingDemoRole, initialized, loading, session, profile, signOut, navigate]);

  // Already logged in — send straight to the right dashboard instead of
  // showing the login form again. (أثناء انتظار تجربة نتولّى التوجيه بأنفسنا في الـeffect أعلاه.)
  if (!pendingDemoRole && initialized && !loading && session && profile) {
    return <Navigate to={profile.role === "teacher" ? "/teacher" : "/student"} replace />;
  }

  function switchTab(next: LoginTab) {
    setTab(next);
    setError(null);
  }

  async function handleTeacherSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  async function handleStudentSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signInWithStudentCode(code);
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-sand-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <SchoolLogo size="h-24" className="pb-3" />
        <div className="flex flex-col items-center gap-2 mb-8">
          <img src={logoMark} alt="بنيان الرياضيات" className="w-16 h-16 object-contain" />
          <h1 className="text-xl font-extrabold text-ink-900">بنيان الرياضيات</h1>
          <p className="text-xs text-ink-500 text-center leading-relaxed">
            بالعلم نبني وطنًا
            <br />
            وبالرياضيات نبني مهاراتنا
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-card p-6 sm:p-7">
          {/* Explicit teacher/student choice, always visible up top */}
          <div className="grid grid-cols-2 gap-2 mb-6 bg-sand-100 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => switchTab("teacher")}
              className={`rounded-xl py-2.5 text-sm font-extrabold transition-colors ${
                tab === "teacher" ? "bg-white text-palm-600 shadow-soft" : "text-ink-500"
              }`}
            >
              دخول المعلمة
            </button>
            <button
              type="button"
              onClick={() => switchTab("student")}
              className={`rounded-xl py-2.5 text-sm font-extrabold transition-colors ${
                tab === "student" ? "bg-white text-palm-600 shadow-soft" : "text-ink-500"
              }`}
            >
              دخول الطالب
            </button>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-2xl bg-sun-50 text-ink-700 text-xs font-bold px-4 py-3 leading-relaxed">
              تسجيل الدخول غير متاح حاليًا. الرجاء المحاولة لاحقًا أو التواصل مع إدارة النظام.
            </div>
          )}

          {tab === "teacher" ? (
            <form onSubmit={handleTeacherSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-start">
                <span className="text-xs font-bold text-ink-700">البريد الإلكتروني</span>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl border border-sand-200 px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-palm-500 text-end"
                  placeholder="name@example.com"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-start">
                <span className="text-xs font-bold text-ink-700">كلمة المرور</span>
                <input
                  type="password"
                  required
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-2xl border border-sand-200 px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-palm-500 text-end"
                  placeholder="••••••••"
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
                className="mt-1 bg-palm-500 hover:bg-palm-600 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl py-3 transition-colors"
              >
                {submitting ? "جارٍ الدخول..." : "دخول"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStudentSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-start">
                <span className="text-xs font-bold text-ink-700">رمز الدخول</span>
                <input
                  type="text"
                  required
                  dir="ltr"
                  autoCapitalize="characters"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="rounded-2xl border border-sand-200 px-4 py-3 text-lg font-extrabold tracking-widest text-ink-900 text-center focus:outline-none focus:ring-2 focus:ring-palm-500"
                  placeholder="BNY-XXXXX"
                />
                <span className="text-[11px] text-ink-500">
                  اطلبي رمزكِ من معلمتكِ — لا حاجة لبريد إلكتروني أو كلمة مرور.
                </span>
              </label>

              {error && (
                <p className="text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 bg-palm-500 hover:bg-palm-600 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl py-3 transition-colors"
              >
                {submitting ? "جارٍ الدخول..." : "دخول"}
              </button>
            </form>
          )}
        </div>

        {/* أثناء التطوير المحلي فقط: إن لم تكن التجربة مفعّلة نُظهر السبب بدل إخفاء المنطقة بصمت. */}
        {import.meta.env.DEV && demoStatus !== null && !demoAvailable && (
          <div role="note" className="mt-5 rounded-3xl border-2 border-dashed border-sun-400 bg-sun-50 p-4 text-start">
            <p className="text-xs font-extrabold text-ink-900">🧪 أزرار «تجربة المعلمة/الطالبة» مخفية (تظهر لك هذه الملاحظة في وضع التطوير فقط)</p>
            <p className="text-[11px] text-ink-700 mt-1.5 leading-relaxed">
              {demoStatus === "not_installed" &&
                "السبب: لم يُشغَّل ملف supabase/phase10-demo-mode.sql في قاعدة البيانات بعد."}
              {demoStatus === "off" && (
                <>السبب: التجربة معطّلة. شغّلي في SQL Editor: <span dir="ltr" className="font-extrabold">update public.demo_settings set enabled = true;</span></>
              )}
              {demoStatus === "unreachable" &&
                "السبب: تعذّر الاتصال بقاعدة البيانات (تحقّقي من VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env ثم أعيدي تشغيل npm run dev)."}
            </p>
          </div>
        )}

        {demoAvailable && (
          <div className="mt-5 bg-white rounded-3xl shadow-soft p-5 text-center">
            <p className="text-sm font-extrabold text-ink-900">اكتشفي بنيان</p>
            <p className="text-[11px] text-ink-500 mt-1 leading-relaxed">
              جرّبي المنصة كمعلمة أو طالبة بحساب وبيانات تجريبية — بدون بريد أو رمز.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                disabled={demoBusy !== null}
                onClick={() => handleDemo("teacher")}
                className="rounded-2xl bg-palm-50 hover:bg-palm-100 text-palm-600 disabled:opacity-60 font-extrabold text-sm py-3 transition-colors"
              >
                {demoBusy === "teacher" ? "جارٍ التجهيز..." : "👩‍🏫 تجربة المعلمة"}
              </button>
              <button
                type="button"
                disabled={demoBusy !== null}
                onClick={() => handleDemo("student")}
                className="rounded-2xl bg-palm-50 hover:bg-palm-100 text-palm-600 disabled:opacity-60 font-extrabold text-sm py-3 transition-colors"
              >
                {demoBusy === "student" ? "جارٍ التجهيز..." : "👧 تجربة الطالبة"}
              </button>
            </div>
            {demoBusy && <p className="text-[11px] text-ink-500 mt-3">جارٍ تجهيز تجربتك… قد يستغرق ذلك بضع ثوانٍ.</p>}
            {demoError && (
              <p role="alert" className="mt-3 text-xs font-bold text-rose-500 bg-rose-50 rounded-xl px-3 py-2">
                {demoError}
              </p>
            )}
          </div>
        )}

        <p className="text-[11px] text-ink-500 text-center mt-5 leading-relaxed">
          {tab === "teacher"
            ? "لا تملكين حسابًا؟ تواصلي مع إدارة المدرسة لإنشاء حساب لك."
            : "فقدتِ رمزكِ؟ اطلبي من معلمتكِ عرضه لكِ من جديد."}
        </p>

        <InstallAppButton className="mt-5" />

        <BrandFooter className="mt-8 px-0" />
      </div>
    </div>
  );
}
