// supabase/functions/demo-sweep/index.ts
//
// تنظيف وصيانة الـSlots التجريبية. للخادم فقط: يتطلب Authorization: Bearer <SERVICE_ROLE_KEY>.
//   POST {}                       -> صيانة عادية (إنهاء الخاملة + تجديد المخزون الدافئ)
//   POST { "action": "teardown_all" } -> حذف كل الـSlots التجريبية (بعد انتهاء التدشين)
//
// جدولتها (اختياري، يلزم pg_cron + pg_net): كل ١٥ دقيقة بـ net.http_post بنفس الترويسة.
// بدون جدولة تبقى الصيانة الكسولة التي تجري عند كل «تجربة».
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin, maintenance, teardownSlot } from "../_shared/demo.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key || req.headers.get("Authorization") !== `Bearer ${key}`) return json({ error: "غير مصرَّح." }, 401);

  const admin = makeAdmin();
  const body = await req.json().catch(() => ({}));

  if (body?.action === "teardown_all") {
    const { data: slots } = await admin.from("demo_slots").select("id");
    for (const s of slots ?? []) await teardownSlot(admin, s.id as string).catch(() => {});
    return json({ torn_down: (slots ?? []).length });
  }
  return json(await maintenance(admin, 3));
});
