// وضع التدشين / التجربة — جانب المتصفح.
// لا كلمات مرور ولا مفاتيح هنا: الدالة السحابية demo-start تُسلّم رمزًا لحظيًا نحوّله
// إلى جلسة Supabase حقيقية، فتعمل المنصة بعدها بمنطقها الحقيقي كاملًا (RLS والملكية).
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

// جداول/دوال التجربة غير موجودة في database.types.ts (لا نريد تعديله) فنستخدم عميلًا غير مُنمَّط.
const db = supabase as unknown as SupabaseClient<any>;

const TOKEN_KEY = "bunyan-demo-token";

/** هل الجلسة الحالية تجريبية؟ للعرض فقط (شارة) — ليست آلية حماية. */
export function isDemoSession(session: Session | null): boolean {
  return session?.user?.app_metadata?.demo === true;
}

/** هل التجربة مفعّلة من الإدارة؟ (تظهر أزرارها في صفحة الدخول فقط عندها). */
export async function isDemoAvailable(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data, error } = await db.rpc("demo_status");
    return !error && data === true;
  } catch {
    return false;
  }
}

export type DemoStatus = "on" | "off" | "not_installed" | "unreachable";

/** حالة التجربة بالتفصيل (للتشخيص أثناء التطوير): مفعّلة / معطّلة / لم يُشغَّل phase10 / تعذّر الاتصال. */
export async function getDemoStatus(): Promise<DemoStatus> {
  if (!isSupabaseConfigured) return "unreachable";
  try {
    const { data, error } = await db.rpc("demo_status");
    if (error) {
      const m = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
      // PGRST202 / 42883: الدالة غير موجودة => لم يُشغَّل phase10-demo-mode.sql بعد.
      if (m.includes("pgrst202") || m.includes("42883") || m.includes("could not find") || m.includes("does not exist")) return "not_installed";
      return "unreachable";
    }
    return data === true ? "on" : "off";
  } catch {
    return "unreachable";
  }
}

function savedToken(): string | null {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && /^[0-9a-f]{64}$/.test(t) ? t : null;
  } catch {
    return null;
  }
}

type InvokeFailure = { status: number | null; body: any; kind: string; message: string };

/** يستخرج السبب الحقيقي من خطأ supabase.functions.invoke (الذي يُخفي الحالة والجسم عادةً). */
async function readInvokeFailure(error: unknown): Promise<InvokeFailure> {
  const e = error as { name?: string; message?: string; context?: unknown };
  let status: number | null = null;
  let body: any = null;
  const ctx = e?.context as Response | undefined;
  if (ctx && typeof (ctx as Response).status === "number") {
    status = ctx.status;
    try {
      const text = await ctx.clone().text();
      try { body = JSON.parse(text); } catch { body = text; }
    } catch { /* لا جسم */ }
  }
  return { status, body, kind: e?.name ?? "Error", message: e?.message ?? "" };
}

function explainFailure(f: InvokeFailure): string {
  const bodyMsg = typeof f.body === "string" ? f.body : String(f.body?.message ?? f.body?.msg ?? "");
  const bodyCode = String(f.body?.code ?? "");
  // 1) رد من دالتنا نفسها (رسالة عربية جاهزة).
  if (f.body && typeof f.body === "object" && typeof f.body.error === "string") {
    const detail = typeof f.body.detail === "string" && f.body.detail ? ` — التفاصيل: ${f.body.detail}` : "";
    const step = typeof f.body.step === "string" && import.meta.env.DEV ? ` [الخطوة: ${f.body.step}]` : "";
    return `${f.body.error}${step}${detail}`;
  }
  // 2) الدالة غير منشورة أصلًا.
  if (f.status === 404 || bodyCode === "NOT_FOUND" || /not found/i.test(bodyMsg)) {
    return "دالة demo-start غير منشورة في مشروع Supabase بعد. انشريها بالأمر: supabase functions deploy demo-start --no-verify-jwt";
  }
  // 3) بوابة Supabase رفضت المفتاح/الـJWT (شائع مع مفاتيح sb_publishable_ الجديدة).
  if (f.status === 401 || f.status === 403 || /jwt|unauthori[sz]ed/i.test(`${bodyCode} ${bodyMsg}`)) {
    return "رفضت بوابة Supabase الطلب (401): الدالة تتطلب JWT بينما مفتاح مشروعكِ من النوع الجديد. أعيدي نشرها بالأمر: supabase functions deploy demo-start --no-verify-jwt";
  }
  if (f.kind === "FunctionsFetchError") {
    return "تعذّر الوصول إلى دالة demo-start (شبكة أو CORS أو أنها غير منشورة). افتحي Console وNetwork لرؤية الطلب.";
  }
  if (f.status && f.status >= 500) {
    return `خطأ داخل دالة demo-start (${f.status}). راجعي Supabase ← Edge Functions ← demo-start ← Logs.${bodyMsg ? ` (${bodyMsg.slice(0, 160)})` : ""}`;
  }
  return "تعذّر بدء التجربة. حاولي مرة أخرى بعد قليل.";
}

export async function startDemo(role: "teacher" | "student"): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: "التجربة غير متاحة حاليًا." };
  try {
    const { data, error } = await supabase.functions.invoke("demo-start", {
      body: { role, token: savedToken() },
    });
    if (error) {
      const failure = await readInvokeFailure(error);
      // eslint-disable-next-line no-console
      console.error("[demo] demo-start فشلت:", failure);
      return { error: explainFailure(failure) };
    }
    if (!data?.token_hash) {
      // eslint-disable-next-line no-console
      console.error("[demo] ردّت الدالة بلا token_hash:", data);
      return { error: "ردّت دالة demo-start دون رمز دخول. راجعي سجلاتها (Logs) في Supabase." };
    }

    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: data.type ?? "magiclink",
    });
    if (otpError) {
      // eslint-disable-next-line no-console
      console.error("[demo] verifyOtp فشل:", otpError);
      return { error: `فشل تحويل رمز الدخول إلى جلسة: ${otpError.message}` };
    }

    try {
      if (typeof data.demo_token === "string") localStorage.setItem(TOKEN_KEY, data.demo_token);
    } catch {
      /* التخزين غير متاح: تعمل التجربة لكن دون العودة لنفس الـSlot بعد الخروج */
    }
    return { error: null };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[demo] استثناء غير متوقع:", e);
    return { error: `تعذّر بدء التجربة: ${e instanceof Error ? e.message : "خطأ غير معروف"}` };
  }
}

/** نبضة نشاط حتى لا يُنهى الـSlot أثناء الاستخدام. */
export async function demoTouch(): Promise<void> {
  try {
    await db.rpc("demo_touch");
  } catch {
    /* غير حرجة */
  }
}
