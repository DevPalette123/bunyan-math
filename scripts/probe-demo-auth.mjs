#!/usr/bin/env node
// اختبار توافق «الدخول التجريبي» مع إعدادات Supabase الفعلية عندكِ — قبل نشر أي شيء.
//
//   SUPABASE_URL=...  SUPABASE_ANON_KEY=...  SUPABASE_SERVICE_ROLE_KEY=...  node scripts/probe-demo-auth.mjs
//
// يفعل هذا فقط:
//   1) ينشئ مستخدمًا مؤقتًا واحدًا بريده @demo.bunyan-math.app (معلمة، app_metadata.demo = true)
//   2) يولّد له رابط دخول بـ auth.admin.generateLink ثم يحوّله لجلسة بـ verifyOtp (نفس ما ستفعله التجربة)
//   3) يتحقق أن الجلسة صالحة، وأن app_metadata.demo ظاهرة فيها، وأن صف profiles الخاص به قابل للقراءة
//   4) يحذف المستخدم (ويتأكد أن الحذف أزال صفوفه بالتتالي)
// لا يلمس أي مستخدم أو بيانات حقيقية. مفتاح service-role يُستخدم من جهازكِ فقط ولا يُحفظ في أي ملف.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error("✗ عيّني المتغيرات SUPABASE_URL و SUPABASE_ANON_KEY و SUPABASE_SERVICE_ROLE_KEY ثم أعيدي التشغيل.");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
};

const email = `probe-${Math.random().toString(36).slice(2, 10)}@demo.bunyan-math.app`;
let userId = null;

try {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { role: "teacher", full_name: "اختبار تجريبي" },
    app_metadata: { demo: true },
  });
  check("إنشاء مستخدم تجريبي (service-role)", !createErr && !!created?.user, createErr?.message);
  userId = created?.user?.id ?? null;
  if (!userId) throw new Error("لا يمكن المتابعة بدون مستخدم.");

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = link?.properties?.hashed_token;
  check("auth.admin.generateLink يُرجع hashed_token", !linkErr && !!hashed, linkErr?.message);
  if (!hashed) throw new Error("generateLink لم يُرجع رمزًا — راجعي إعدادات مزوّد البريد في Auth.");

  const { data: verified, error: otpErr } = await anonClient.auth.verifyOtp({ token_hash: hashed, type: "magiclink" });
  check("verifyOtp يحوّل الرمز إلى جلسة", !otpErr && !!verified?.session, otpErr?.message);
  const session = verified?.session;
  if (!session) throw new Error("verifyOtp فشل — قد تكون حدود المعدل أو نوع الرمز. جرّبي type: 'email' وأخبريني.");

  check("app_metadata.demo ظاهرة في الجلسة", session.user.app_metadata?.demo === true);
  check("المستخدم نفسه هو المُنشأ", session.user.id === userId);

  const { data: prof, error: profErr } = await anonClient.from("profiles").select("id, role").eq("id", userId).single();
  check("trigger handle_new_user أنشأ profiles والجلسة تقرؤه عبر RLS", !profErr && prof?.role === "teacher", profErr?.message);

  const { data: cls } = await anonClient.from("classes").select("id").limit(5);
  check("المعلمة التجريبية ترى صفها فقط (صف واحد)", Array.isArray(cls) && cls.length === 1, `عدد الصفوف الظاهرة: ${cls?.length}`);

  const { data: students } = await anonClient.from("students").select("id").limit(50);
  check("لا ترى أي طالب (صفها جديد وفارغ)", Array.isArray(students) && students.length === 0, `عدد: ${students?.length}`);

  const { error: touchErr } = await anonClient.rpc("demo_touch");
  console.log(touchErr ? `• demo_touch غير موجودة بعد (طبيعي قبل تشغيل phase10): ${touchErr.message}` : "• demo_touch تعمل");
} catch (e) {
  check("إكمال الاختبار", false, e.message);
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    const { data: left } = await admin.from("profiles").select("id").eq("id", userId);
    check("الحذف أزال الملف بالتتالي", (left ?? []).length === 0);
  }
}

const allOk = results.every(Boolean);
console.log("\n" + (allOk ? "✅ النتيجة: الدخول التجريبي متوافق مع مشروعكِ." : "❌ النتيجة: هناك فحوص فشلت — أرسلي لي المخرجات كاملة قبل التشغيل الفعلي."));
console.log("تذكير: حدود معدل Auth (لكل IP) قد تُبطئ دخول عدة معلمات من شبكة واحدة؛ راجعيها في Auth → Rate Limits قبل التدشين.");
process.exit(allOk ? 0 : 1);
