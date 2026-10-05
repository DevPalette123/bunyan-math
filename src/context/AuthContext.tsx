import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import type { ProfileRow } from "../lib/database.types";
import { normalizeStudentCode, studentCodePassword, studentCodeToEmail } from "../lib/studentAuth";

interface AuthContextValue {
  session: Session | null;
  profile: ProfileRow | null;
  loading: boolean;
  /** True once we've finished the very first session check. */
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Student sign-in: the code is the student's entire credential. */
  signInWithStudentCode: (code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // معرّف المستخدم الذي حُمّل بروفايله فعلًا، ورقم الطلب الأخير (لتجاهل ردود قديمة متأخرة).
  const loadedUserIdRef = useRef<string | null>(null);
  const requestRef = useRef(0);

  /** يجلب البروفايل؛ يعيد المحاولة مرتين لأن صفّه قد يتأخر لحظة بعد إنشاء الحساب. */
  async function fetchProfile(userId: string): Promise<ProfileRow | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (!error && data) return data as ProfileRow;
      // eslint-disable-next-line no-console
      console.error("تعذّر تحميل بيانات الحساب (profiles):", error?.message);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    return null;
  }

  /**
   * نقطة واحدة لمزامنة الجلسة مع البروفايل.
   * - نفس المستخدم الذي حُمّل بروفايله (مثل حدث SIGNED_IN الذي يصدر عند العودة للتبويب أو تجديد الرمز):
   *   نحدّث الجلسة فقط، بلا شاشة «جارٍ التحقق» ولا إعادة تحميل (كانت تُفرغ الصفحة وتصفّر ما تفعله المعلم).
   * - مستخدم مختلف: نمسح البروفايل القديم فورًا (فلا يُوجَّه حساب جديد بدور حساب سابق) ثم نحمّل الجديد.
   */
  async function syncSession(next: Session | null) {
    setSession(next);
    const userId = next?.user.id ?? null;

    if (!userId) {
      requestRef.current += 1;
      loadedUserIdRef.current = null;
      setProfile(null);
      setLoading(false);
      return;
    }

    if (loadedUserIdRef.current === userId) return;

    const myRequest = ++requestRef.current;
    loadedUserIdRef.current = null;
    setProfile(null);
    setLoading(true);
    const row = await fetchProfile(userId);
    if (myRequest !== requestRef.current) return; // وصل طلب أحدث؛ تجاهل هذا الرد
    loadedUserIdRef.current = row ? userId : null;
    setProfile(row);
    setLoading(false);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No Supabase project connected yet — stop the loading spinner so the
      // login page can show a clear setup notice instead of spinning forever.
      setLoading(false);
      setInitialized(true);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      await syncSession(data.session);
      if (isMounted) setInitialized(true);
    });

    // مهم: لا نُجري نداءات Supabase داخل دالة الاستماع نفسها مباشرةً (قد تتعطل بقفل المصادقة الداخلي)،
    // فنؤجّلها إلى الدورة التالية.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setTimeout(() => {
        if (isMounted) void syncSession(newSession);
      }, 0);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      return {
        error: "لم يتم ربط المشروع بـ Supabase بعد. راجع ملف .env.example وأضف القيم الصحيحة.",
      };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
    }
    return { error: null };
  }

  async function signInWithStudentCode(code: string) {
    if (!isSupabaseConfigured) {
      return {
        error: "لم يتم ربط المشروع بـ Supabase بعد. راجع ملف .env.example وأضف القيم الصحيحة.",
      };
    }
    const normalized = normalizeStudentCode(code);
    if (!normalized) {
      return { error: "الرجاء إدخال رمز الطالب." };
    }
    // Real Supabase Auth session underneath — the code deterministically maps
    // to the email and the password, never a mock login.
    const { error } = await supabase.auth.signInWithPassword({
      email: studentCodeToEmail(normalized),
      password: studentCodePassword(normalized),
    });
    if (error) {
      return { error: "رمز الدخول غير صحيح." };
    }
    return { error: null };
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, loading, initialized, signIn, signInWithStudentCode, signOut }),
    [session, profile, loading, initialized]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth يجب أن يُستخدم داخل AuthProvider");
  return ctx;
}
