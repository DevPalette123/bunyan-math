#!/usr/bin/env node
// تشخيص «تجربة المعلمة/الطالبة» من جهازكِ: node scripts/diagnose-demo.mjs
// يقرأ VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY من ملف .env (المفتاح العام فقط — لا service-role)
// ويفحص بالترتيب: demo_status، ثم وجود دالة demo-start وردّها الفعلي، ويشرح السبب بالعربية.
// تنبيه: الفحص الأخير يستدعي demo-start فعلًا؛ إن كانت تعمل فسيُجهَّز Slot تجريبي (لا يمس أي بيانات حقيقية).
import { readFileSync } from "node:fs";

function readEnv() {
  const out = {};
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* لا .env */ }
  return out;
}
const env = readEnv();
const url = (env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
if (!url || !key) { console.error("✗ لم أجد VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY في .env"); process.exit(1); }

const isJwt = key.startsWith("eyJ");
console.log(`• نوع المفتاح العام: ${isJwt ? "JWT قديم (eyJ…)" : key.startsWith("sb_publishable_") ? "مفتاح جديد sb_publishable_… (ليس JWT)" : "غير معروف"}`);

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const show = (b) => (typeof b === "string" ? b : JSON.stringify(b)).slice(0, 400);
async function call(path, init = {}) {
  const res = await fetch(url + path, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const text = await res.text();
  let body = text; try { body = JSON.parse(text); } catch { /* نص */ }
  return { status: res.status, body };
}

// 1) demo_status
const st = await call("/rest/v1/rpc/demo_status", { method: "POST", body: "{}" });
console.log(`\n1) demo_status → HTTP ${st.status}: ${show(st.body)}`);
if (st.status === 404) console.log("   ✗ الدالة غير موجودة: لم يُشغَّل supabase/phase10-demo-mode.sql.");
else if (st.body === true) console.log("   ✓ التجربة مفعّلة في قاعدة البيانات.");
else if (st.body === false) console.log("   ✗ معطّلة: شغّلي  update public.demo_settings set enabled = true;");

// 2) demo-start
const ds = await call("/functions/v1/demo-start", { method: "POST", body: JSON.stringify({ role: "teacher" }) });
console.log(`\n2) demo-start → HTTP ${ds.status}: ${show(ds.body)}`);
const msg = typeof ds.body === "string" ? ds.body : `${ds.body?.code ?? ""} ${ds.body?.message ?? ""} ${ds.body?.error ?? ""}`;
if (ds.status === 200 && ds.body?.token_hash) {
  console.log("   ✓ الدالة منشورة وتعمل وأعادت رمز دخول. المشكلة (إن بقيت) في المتصفح: افتحي Console وانظري [demo].");
} else if (ds.status === 404 || /NOT_FOUND|not found/i.test(msg)) {
  console.log("   ✗ الدالة غير منشورة. نفّذي:  supabase functions deploy demo-start --no-verify-jwt");
} else if (ds.status === 401 || /jwt/i.test(msg)) {
  console.log("   ✗ البوابة رفضت الطلب (JWT). أعيدي النشر بهذا الخيار:  supabase functions deploy demo-start --no-verify-jwt");
} else if (ds.status === 403) {
  console.log("   ✗ التجربة معطّلة داخل الدالة (demo_settings.enabled = false).");
} else if (ds.status >= 500 || ds.status === 503) {
  console.log(`   ✗ خطأ داخل الدالة (الخطوة: ${ds.body?.step ?? "؟"}). افتحي Supabase ← Edge Functions ← demo-start ← Logs وأرسلي لي آخر خطأ.`);
  console.log("     (الأخطاء المتوقعة هنا: فشل demo_seed_slot، أو إنشاء مستخدم، أو generateLink.)");
} else {
  console.log("   ؟ ردّ غير متوقع — أرسلي لي المخرجات كاملة.");
}
