// supabase/functions/create-student/index.ts
//
// Called from the teacher's authenticated browser session via
// supabase.functions.invoke("create-student", { body: { full_name } }).
//
// Why this has to be an Edge Function and not a client-side call:
// creating a real Supabase Auth user (auth.admin.createUser) requires the
// service-role key, which must never be shipped to the browser. This
// function holds that key server-side only, verifies the caller is really
// an authenticated teacher (via their own JWT — never trusted blindly),
// then creates one real student account and links it to that teacher's
// class.
//
// NOTE: written and reasoned through carefully, but NOT deployed or
// invoked against a live Supabase project from the sandbox this was built
// in (no network path to supabase.co there). Deploy with:
//   supabase functions deploy create-student
// and test it for real before relying on it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { generateStudentCode, studentCodeToEmail } from "../_shared/studentCode.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "غير مصرَّح." }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Scoped to the CALLER's own JWT — used only to find out who is calling
    // and to confirm (via real RLS, not a manual role check we invent here)
    // that they are a teacher with a class of their own.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "جلسة غير صالحة." }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const { data: profile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!profile || profile.role !== "teacher") {
      return new Response(JSON.stringify({ error: "هذا الإجراء مخصص للمعلمة فقط." }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    // RLS (classes_select_own_teacher) guarantees this can only ever be
    // this caller's own class.
    const { data: classRow } = await callerClient
      .from("classes")
      .select("id")
      .eq("teacher_id", userData.user.id)
      .limit(1)
      .maybeSingle();

    if (!classRow) {
      return new Response(
        JSON.stringify({ error: "تعذّر العثور على صف هذه المعلمة." }),
        { status: 500, headers: jsonHeaders }
      );
    }

    // وضع التدشين: معلمة التجربة تضيف طلابًا كأي معلمة، لكن بسقف صغير لحماية الموارد.
    // (التعريف من app_metadata التي لا يستطيع المستخدم تعديلها؛ هذا سقف موارد لا آلية حماية بيانات.)
    const isDemoCaller = userData.user.app_metadata?.demo === true;
    if (isDemoCaller) {
      const { count } = await callerClient
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classRow.id);
      if ((count ?? 0) >= 10) {
        return new Response(
          JSON.stringify({ error: "وصلتِ للحد الأقصى لعدد الطلاب في وضع التجربة (١٠)." }),
          { status: 400, headers: jsonHeaders }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    if (!fullName) {
      return new Response(JSON.stringify({ error: "اسم الطالب مطلوب." }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    // Service-role client — only ever used here, server-side, never exposed
    // to the browser. This is what actually creates the real Auth account.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    let createdUserId: string | null = null;
    let finalCode = "";

    // Codes are short and random — collisions are rare but possible, so
    // retry with a fresh code a few times rather than failing outright.
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateStudentCode();
      const email = studentCodeToEmail(code);

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: code,
        email_confirm: true,
        user_metadata: { role: "student", full_name: fullName },
        // طالب أضافته معلمة تجريبية يبقى تجريبيًا (شارة الواجهة فقط).
        ...(isDemoCaller ? { app_metadata: { demo: true } } : {}),
      });

      if (!createError && created.user) {
        createdUserId = created.user.id;
        finalCode = code;
        break;
      }

      const isCollision = (createError?.message ?? "").toLowerCase().includes("already");
      if (!isCollision) {
        return new Response(
          JSON.stringify({ error: createError?.message ?? "تعذّر إنشاء حساب الطالب." }),
          { status: 500, headers: jsonHeaders }
        );
      }
      // else: loop and try a new random code
    }

    if (!createdUserId) {
      return new Response(
        JSON.stringify({ error: "تعذّر توليد رمز دخول فريد، حاولي مرة أخرى." }),
        { status: 500, headers: jsonHeaders }
      );
    }

    // The on_auth_user_created trigger already inserted profiles + a bare
    // students row (class_id null) synchronously as part of createUser().
    // Now link that student to this teacher's class and store their code.
    const { error: updateError } = await adminClient
      .from("students")
      .update({ class_id: classRow.id, login_code: finalCode })
      .eq("id", createdUserId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "تعذّر ربط الطالب بالصف." }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    return new Response(
      JSON.stringify({ full_name: fullName, login_code: finalCode }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "خطأ غير متوقع." }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
