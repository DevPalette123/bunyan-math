// أدوات وضع التدشين المشتركة بين demo-start و demo-sweep.
// تعمل بمفتاح service-role داخل Edge Function فقط — لا شيء من هذا يصل للمتصفح.
//
// ملاحظة: كُتب ودُقّق نظريًا، لكنه لم يُنشر ولم يُجرَّب على مشروع Supabase حي من بيئة
// الكتابة (لا اتصال شبكي). اختبريه بسكربت scripts/probe-demo-auth.mjs قبل الاعتماد عليه.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateStudentCode, studentCodeToEmail } from "./studentCode.ts";

export type Admin = SupabaseClient;

export function makeAdmin(): Admin {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const DEMO_DOMAIN = "demo.bunyan-math.app";
export const MEDIA_BUCKET = "competition-media";

export const DEMO_STUDENTS: { key: string; name: string }[] = [
  { key: "sara", name: "سارة أحمد" },
  { key: "nour", name: "نور محمد" },
  { key: "jana", name: "جنى خالد" },
  { key: "layan", name: "ليان علي" },
  { key: "maryam", name: "مريم سعيد" },
  { key: "shahd", name: "شهد عبدالله" },
];

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** إنشاء Slot كامل: معلمة + صفها + ٦ طالبات + بيانات، ثم يصبح «ready». */
export async function provisionSlot(admin: Admin): Promise<string> {
  const { data: slot, error: slotErr } = await admin
    .from("demo_slots").insert({ state: "provisioning" }).select("id").single();
  if (slotErr || !slot) throw new Error(`demo_slots insert: ${slotErr?.message ?? "no row"}`);
  const slotId = slot.id as string;
  // كل مستخدم يُنشأ هنا يُسجَّل فورًا لنحذفه إن فشل الإنشاء في منتصفه (وإلا بقي مستخدمون يتامى).
  const createdUserIds: string[] = [];

  try {
    const appMeta = { demo: true, demo_slot: slotId };

    // المعلمة: كلمة مرور عشوائية لا يعرفها أحد ولا تُستخدم (الدخول عبر generateLink فقط).
    const { data: t, error: tErr } = await admin.auth.admin.createUser({
      email: `t-${slotId.replace(/-/g, "").slice(0, 16)}@${DEMO_DOMAIN}`,
      password: randomToken(24),
      email_confirm: true,
      user_metadata: { role: "teacher", full_name: "معلمة تجريبية" },
      app_metadata: appMeta,
    });
    if (tErr || !t.user) throw new Error(`createUser(teacher): ${tErr?.message ?? "no user"}`);
    const teacherId = t.user.id;
    createdUserIds.push(teacherId);

    // الطالبات: نفس مخطط النظام (الرمز = كلمة المرور) كي يعمل الرمز الظاهر في لوحة المعلمة فعلًا.
    const students = await Promise.all(
      DEMO_STUDENTS.map(async (s) => {
        for (let attempt = 0; attempt < 8; attempt++) {
          const code = generateStudentCode();
          const { data, error } = await admin.auth.admin.createUser({
            email: studentCodeToEmail(code),
            password: code,
            email_confirm: true,
            user_metadata: { role: "student", full_name: s.name },
            app_metadata: appMeta,
          });
          if (!error && data.user) {
            createdUserIds.push(data.user.id);
            return { id: data.user.id, key: s.key, code, name: s.name };
          }
          if (!(error?.message ?? "").toLowerCase().includes("already")) throw new Error(`createUser(${s.key}): ${error?.message ?? "no user"}`);
        }
        throw new Error(`createUser(${s.key}): code collision`);
      })
    );

    // لا نفترض أن trigger handle_new_user في قاعدتكِ الحية يُنشئ كل الصفوف (نسخته قد تكون أقدم):
    // نتأكد من وجود profiles/teachers/students، وننشئ الصف إن لم يوجد — كما تفعل لوحة المعلمة
    // نفسها عند أول دخول (TeacherDashboardPage). كل ذلك «ignoreDuplicates» فلا يغيّر ما أنشأه الـtrigger.
    const ensure = async (table: string, rows: Record<string, unknown>[]) => {
      const { error } = await admin.from(table).upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(`ensure ${table}: ${error.message}`);
    };
    // profiles خاصة: الدور هنا هو مصدر الحقيقة الوحيد للتوجيه في الواجهة (ProtectedRoute/RootRedirect)،
    // فنفرضه صراحةً (upsert بلا ignoreDuplicates) حتى لو أنشأ trigger في قاعدتكِ الحية صفًّا بدور مختلف.
    // الحسابات هنا مُنشأة للتو في هذا الـSlot فقط، فلا يمس هذا أي حساب حقيقي.
    {
      const { error } = await admin.from("profiles").upsert(
        [
          { id: teacherId, role: "teacher", full_name: "معلمة تجريبية" },
          ...students.map((s) => ({ id: s.id, role: "student", full_name: s.name })),
        ],
        { onConflict: "id" },
      );
      if (error) throw new Error(`ensure profiles: ${error.message}`);
    }
    await ensure("teachers", [{ id: teacherId }]);

    let classId: string;
    const { data: existing, error: selErr } = await admin
      .from("classes").select("id").eq("teacher_id", teacherId).limit(1).maybeSingle();
    if (selErr) throw new Error(`classes lookup: ${selErr.message}`);
    if (existing) {
      classId = existing.id as string;
    } else {
      const { data: created, error: insErr } = await admin
        .from("classes").insert({ teacher_id: teacherId, name: "صفي" }).select("id").single();
      if (insErr || !created) throw new Error(`classes insert: ${insErr?.message ?? "no row"}`);
      classId = created.id as string;
    }

    await ensure("students", students.map((s) => ({ id: s.id })));
    for (const s of students) {
      const { error } = await admin.from("students").update({ class_id: classId, login_code: s.code }).eq("id", s.id);
      if (error) throw new Error(`students link(${s.key}): ${error.message}`);
    }

    const { error: accErr } = await admin.from("demo_accounts").insert([
      { user_id: teacherId, slot_id: slotId, role: "teacher", seed_key: "teacher" },
      ...students.map((s) => ({ user_id: s.id, slot_id: slotId, role: "student", seed_key: s.key })),
    ]);
    if (accErr) throw new Error(`demo_accounts insert: ${accErr.message}`);

    const { error: seedErr } = await admin.rpc("demo_seed_slot", {
      p_teacher: teacherId, p_class: classId, p_students: students.map((s) => ({ id: s.id, key: s.key })),
    });
    if (seedErr) throw new Error(`demo_seed_slot: ${seedErr.message}`);

    const { error: readyErr } = await admin.from("demo_slots")
      .update({ state: "ready", teacher_id: teacherId, class_id: classId }).eq("id", slotId);
    if (readyErr) throw new Error(`demo_slots ready: ${readyErr.message}`);
    return slotId;
  } catch (e) {
    // تنظيف كامل: المستخدمون المُنشَؤون (حتى لو لم يُسجَّلوا في demo_accounts بعد) ثم الـSlot.
    await Promise.all(createdUserIds.map((id) => admin.auth.admin.deleteUser(id).catch(() => {})));
    await teardownSlot(admin, slotId).catch(() => {});
    throw e;
  }
}

async function removeStorageFor(admin: Admin, teacherId: string) {
  const bucket = admin.storage.from(MEDIA_BUCKET);
  const { data: folders } = await bucket.list(teacherId, { limit: 1000 });
  for (const f of folders ?? []) {
    const { data: files } = await bucket.list(`${teacherId}/${f.name}`, { limit: 1000 });
    const paths = (files ?? []).map((x) => `${teacherId}/${f.name}/${x.name}`);
    if (paths.length) await bucket.remove(paths);
  }
}

/** حذف Slot كاملًا: ملفات التخزين ثم كل مستخدميه (الباقي يُحذف بالتتالي) ثم صفه. */
export async function teardownSlot(admin: Admin, slotId: string): Promise<void> {
  const { data: slot } = await admin.from("demo_slots").select("teacher_id, class_id").eq("id", slotId).maybeSingle();
  const { data: accounts } = await admin.from("demo_accounts").select("user_id, role").eq("slot_id", slotId);
  const known = new Set((accounts ?? []).map((a) => a.user_id as string));

  // طلاب أضافتهم معلمة التجربة بنفسها: class_id يُصفَّر عند حذف الصف ولا يُحذف الطالب،
  // فيجب حذفهم صراحةً قبل حذف المعلمة.
  const extras: string[] = [];
  if (slot?.class_id) {
    const { data: rows } = await admin.from("students").select("id").eq("class_id", slot.class_id);
    for (const r of rows ?? []) if (!known.has(r.id as string)) extras.push(r.id as string);
  }

  const teacherId = (slot?.teacher_id as string | null) ?? (accounts ?? []).find((a) => a.role === "teacher")?.user_id;
  if (teacherId) await removeStorageFor(admin, teacherId as string).catch(() => {});

  const ids = [...extras, ...(accounts ?? []).filter((a) => a.role === "student").map((a) => a.user_id as string)];
  if (teacherId) ids.push(teacherId as string);
  await Promise.all(ids.map((id) => admin.auth.admin.deleteUser(id).catch(() => {})));
  await admin.from("demo_slots").delete().eq("id", slotId);
}

/** صيانة: إنهاء الـSlots الخاملة وتجديد المخزون الدافئ (بحدّ أقصى صغير لكل نداء). */
export async function maintenance(admin: Admin, maxProvision = 2): Promise<{ retired: number; provisioned: number }> {
  let retired = 0;
  let provisioned = 0;
  const { data: stale } = await admin.rpc("demo_slots_to_retire");
  for (const id of (stale ?? []) as string[]) {
    await teardownSlot(admin, id).catch(() => {});
    retired++;
  }
  const { data: counts } = await admin.rpc("demo_slot_counts");
  if (counts?.enabled) {
    let ready = Number(counts.ready);
    let total = Number(counts.total);
    while (ready < Number(counts.warm_target) && total < Number(counts.max_slots) && provisioned < maxProvision) {
      try { await provisionSlot(admin); } catch { break; }
      provisioned++; ready++; total++;
    }
  }
  return { retired, provisioned };
}

export function runInBackground(p: Promise<unknown>) {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p.catch(() => {}));
  else p.catch(() => {});
}
