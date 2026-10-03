import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../lib/database.types";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: ReactNode;
}

/**
 * Wrap any page that must only be reachable by a specific role.
 * - Not logged in -> redirect to /login
 * - Logged in but the profile could not be loaded (missing row, blocked by RLS,
 *   or a network failure) -> show a short message with retry / sign-out,
 *   never redirect (a redirect would land on another ProtectedRoute and loop)
 * - Logged in but wrong role (e.g. a student typing /teacher in the URL bar)
 *   -> redirect to that user's OWN dashboard, never render the protected content
 * - This check happens on every render, using the live Supabase session/profile
 *   from AuthContext — it is not a one-time check that can be bypassed by
 *   client-side navigation, and it does not rely on hiding UI elements.
 */
export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { session, profile, loading, initialized, signOut } = useAuth();

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <p className="text-ink-500 font-bold text-sm">جارٍ التحقق من الحساب...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    // A session exists but its profile row is not available. Redirecting to a
    // dashboard here would hit another ProtectedRoute with the same missing
    // profile and bounce forever, so stop and let the user retry or sign out.
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-sand-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-card p-6 flex flex-col items-center text-center gap-4">
          <p className="text-sm font-extrabold text-ink-900">
            {session.user.app_metadata?.demo === true ? "انتهت جلسة التجربة." : "تعذّر تحميل بيانات الحساب."}
          </p>
          <p className="text-xs text-ink-500 leading-relaxed">
            {session.user.app_metadata?.demo === true
              ? "تُنظَّف التجارب الخاملة تلقائيًا. سجّلي الخروج وابدئي تجربة جديدة من صفحة الدخول."
              : "تحقّقي من الاتصال ثم أعيدي المحاولة، أو سجّلي الخروج وادخلي من جديد."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full bg-palm-500 hover:bg-palm-600 text-white font-extrabold text-sm rounded-2xl py-3 transition-colors"
          >
            إعادة المحاولة
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-xs font-extrabold text-rose-500 hover:bg-rose-50 rounded-xl px-4 py-2 transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(profile.role)) {
    // Logged in, but not authorized for this route — send them to their own
    // dashboard rather than showing this page or an error.
    const fallback = profile.role === "teacher" ? "/teacher" : "/student";
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
