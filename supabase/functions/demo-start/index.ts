// supabase/functions/demo-start/index.ts
//
// «تجربة المعلم / تجربة الطالب» من صفحة الدخول. تُستدعى بلا تسجيل دخول.
// تقبل فقط { role: "teacher" | "student", token?: string } — لا بريدًا ولا معرّف مستخدم،
// وتختار الحساب من جدول demo_accounts فقط، فلا يمكنها إصدار جلسة لحساب حقيقي أبدًا.
//
// تُرجع رمز تحقق لحظيًا (hashed_token من auth.admin.generateLink) ليحوّله المتصفح إلى
// جلسة Supabase حقيقية عبر supabase.auth.verifyOtp. لا كلمات مرور ولا مفاتيح تصل للمتصفح.
//
// النشر (مهم: --no-verify-jwt):
//   supabase functions deploy demo-start --no-verify-jwt
// الدالة عامة بالتصميم (تُستدعى من صفحة الدخول بلا جلسة) وتتحقق بنفسها؛ ومفاتيح المشاريع
// الجديدة (sb_publishable_…) ليست JWT فترفضها البوابة إن بقي التحقق مفعّلًا (401).
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin, maintenance, provisionSlot, randomToken, runInBackground, sha256Hex } from "../_shared/demo.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// رسالة الخطأ التقنية تُرجع للمتصفح فقط إذا كان الطلب من localhost (أثناء التطوير)،
// وفي كل الحالات تُسجَّل كاملة في Logs الدالة. لا نكشف تفاصيل داخلية للعامة.
const isLocalOrigin = (req: Request) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.get("origin") ?? "");
class StepError extends Error {
  constructor(public step: string, message: string, public status = 500) { super(message); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "طريقة غير مدعومة." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const role = body?.role;
    if (role !== "teacher" && role !== "student") return json({ error: "طلب غير صالح." }, 400);
    const clientToken = typeof body?.token === "string" && /^[0-9a-f]{64}$/.test(body.token) ? body.token : null;

    const admin = makeAdmin();

    const { data: counts, error: cntErr } = await admin.rpc("demo_slot_counts");
    if (cntErr || !counts) throw new StepError("settings", `demo_slot_counts: ${cntErr?.message ?? "no data"}`, 503);
    if (!counts.enabled) return json({ error: "التجربة غير متاحة حاليًا." }, 403);

    // تحديد المعدل لكل IP (حدّ سخي لأن شبكة المدرسة قد تشترك في عنوان واحد).
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const { data: allowed } = await admin.rpc("demo_rate_hit", {
      p_key: "start:" + (await sha256Hex(ip)), p_limit: 60, p_window_seconds: 600,
    });
    if (allowed === false) return json({ error: "محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة." }, 429);

    const newToken = randomToken(32);
    const claim = async () => {
      const { data } = await admin.rpc("demo_claim_slot", {
        p_existing_hash: clientToken ? await sha256Hex(clientToken) : null,
        p_new_hash: await sha256Hex(newToken),
      });
      return data as { slot_id: string; reused: boolean } | null;
    };

    let claimed = await claim();
    if (!claimed) {
      if (Number(counts.total) >= Number(counts.max_slots)) {
        return json({ error: "التجربة مزدحمة الآن، حاول بعد دقائق قليلة." }, 503);
      }
      try {
        await provisionSlot(admin);
      } catch (e) {
        throw new StepError("provision", e instanceof Error ? e.message : String(e), 500);
      }
      claimed = await claim();
      if (!claimed) return json({ error: "تعذّر تجهيز التجربة، حاول مرة أخرى." }, 503);
    }

    const { data: account } = await admin
      .from("demo_accounts").select("user_id, role")
      .eq("slot_id", claimed.slot_id)
      .eq("seed_key", role === "teacher" ? "teacher" : "sara")
      .single();
    if (!account) throw new StepError("account", "لا يوجد حساب تجريبي لهذا الدور في الـSlot.");
    if (account.role !== role) throw new StepError("account", `demo_accounts.role=${account.role} لا يطابق الدور المطلوب ${role}.`);

    // ضمان أن profiles.role يطابق الدور المطلوب قبل إصدار الجلسة (الواجهة توجّه بحسب profiles.role فقط،
    // وأي قيمة غير "teacher" تُرسل إلى /student). يعالج Slots أُنشئت سابقًا بدور خاطئ دون حذف شيء.
    // الحساب أتى من demo_accounts حصرًا، فلا يمكن أن يكون حسابًا حقيقيًا.
    const { data: prof, error: profErr } = await admin
      .from("profiles").select("role").eq("id", account.user_id).maybeSingle();
    if (profErr) throw new StepError("account", `profiles lookup: ${profErr.message}`);
    if (!prof || prof.role !== role) {
      console.error(`[demo-start] تصحيح profiles.role: الحالي=${prof?.role ?? "لا صف"} المطلوب=${role} user=${account.user_id}`);
      const { error: fixErr } = await admin.from("profiles").upsert(
        { id: account.user_id, role, full_name: role === "teacher" ? "معلم تجريبي" : "سارة أحمد" },
        { onConflict: "id" },
      );
      if (fixErr) throw new StepError("account", `profiles fix: ${fixErr.message}`);
      if (role === "teacher") {
        const { error: tErr } = await admin.from("teachers").upsert({ id: account.user_id }, { onConflict: "id", ignoreDuplicates: true });
        if (tErr) throw new StepError("account", `teachers fix: ${tErr.message}`);
      }
    }

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(account.user_id);
    const email = userRes?.user?.email;
    if (userErr || !email) throw new StepError("account", `getUserById: ${userErr?.message ?? "no email"}`);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) throw new StepError("link", `generateLink: ${linkErr?.message ?? "no hashed_token"}`);

    // صيانة في الخلفية: إنهاء الخاملة وتجديد المخزون الدافئ.
    runInBackground(maintenance(admin, 1));

    return json({
      token_hash: tokenHash,
      type: "magiclink",
      demo_token: claimed.reused && clientToken ? clientToken : newToken,
      role,
    });
  } catch (err) {
    const step = err instanceof StepError ? err.step : "unexpected";
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[demo-start] step=${step}:`, message);
    return json(
      {
        error: step === "provision" ? "تعذّر تجهيز حسابات التجربة على الخادم." : "تعذّر بدء التجربة على الخادم.",
        step,
        ...(isLocalOrigin(req) ? { detail: message.slice(0, 300) } : {}),
      },
      err instanceof StepError ? err.status : 500
    );
  }
});
