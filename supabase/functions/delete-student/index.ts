// supabase/functions/delete-student/index.ts
//
// Called from the teacher's authenticated browser session via
// supabase.functions.invoke("delete-student", { body: { student_id } }).
//
// Deleting a student's real Auth account (auth.admin.deleteUser) requires
// the service-role key — same reasoning as create-student. The
// authorization check below deliberately reuses the SAME, already-tested
// RLS policy the rest of the app relies on (students_select_teacher_roster)
// rather than re-implementing an ownership check by hand: if the caller's
// own session can't SELECT this student, they can't delete them either.
//
// NOTE: written and reasoned through carefully, but NOT deployed or
// invoked against a live Supabase project from the sandbox this was built
// in (no network path to supabase.co there). Deploy with:
//   supabase functions deploy delete-student
// and test it for real before relying on it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

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

    const body = await req.json().catch(() => ({}));
    const studentId = typeof body.student_id === "string" ? body.student_id : "";
    if (!studentId) {
      return new Response(JSON.stringify({ error: "معرّف الطالب مطلوب." }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    // Authorization check: can the CALLER's own session see this student?
    // This runs under RLS as the caller (not the service role), so it can
    // only ever return a row if students_select_teacher_roster allows it —
    // i.e. the caller is the teacher who owns this student's class.
    const { data: ownedStudent } = await callerClient
      .from("students")
      .select("id")
      .eq("id", studentId)
      .maybeSingle();

    if (!ownedStudent) {
      return new Response(
        JSON.stringify({ error: "غير مصرَّح بحذف هذا الطالب." }),
        { status: 403, headers: jsonHeaders }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    // Deletes auth.users row; profiles and students cascade automatically
    // via their own "on delete cascade" foreign keys in schema.sql.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(studentId);

    if (deleteError) {
      return new Response(JSON.stringify({ error: "تعذّر حذف الطالب." }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "خطأ غير متوقع." }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
