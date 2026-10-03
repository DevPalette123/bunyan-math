-- ============================================================================
-- المرحلة العاشرة — «وضع التدشين / التجربة»
--
-- الفكرة: لا نسخة Demo من بنيان. حسابات Supabase Auth حقيقية (معلمة + ست طالبات
-- لكل «Slot») تعمل على نفس الجداول والدوال وRLS الحالية، وعزلها يأتي من الملكية
-- (المعلمة تملك صفها فقط). هذا الملف لا يغيّر أي جدول أو دالة أو سياسة موجودة،
-- ولا يضيف أعمدة لأي جدول قائم.
--
-- ما يضيفه:
--   * demo_settings / demo_slots / demo_accounts / demo_rate_limits  (مغلقة على المتصفح كليًا)
--   * demo_status()  : تُظهر زر التجربة في صفحة الدخول (true/false فقط) — عامة.
--   * demo_touch()   : نبضة نشاط من حساب تجريبي — للمصادَقين.
--   * is_demo_user() : هل هذا المستخدم تجريبي؟
--   * دوال للخادم فقط (service_role): claim / rate / seed / retire-list.
--
-- التعبئة التجريبية تتم باستدعاء دوال النظام الحقيقية نفسها (complete_lesson،
-- start/record/complete للاختبارات والألعاب، ...) بهوية الطالبة التجريبية، فتخرج
-- النجوم والشارات والنتائج بمنطق المنصة الفعلي دون إدخال صفوف يدوية أو أعمدة جديدة.
--
-- آمن لإعادة التشغيل. الوضع الافتراضي: معطّل (enabled = false) حتى تفعّليه بنفسك:
--     update public.demo_settings set enabled = true;
-- ============================================================================

-- 1) الإعدادات ----------------------------------------------------------------
create table if not exists public.demo_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  max_slots integer not null default 200 check (max_slots between 1 and 2000),
  idle_minutes integer not null default 90 check (idle_minutes between 5 and 1440),
  max_age_hours integer not null default 12 check (max_age_hours between 1 and 168),
  warm_target integer not null default 3 check (warm_target between 0 and 50)
);
insert into public.demo_settings (id) values (true) on conflict (id) do nothing;

-- 2) الـSlots والحسابات -----------------------------------------------------
create table if not exists public.demo_slots (
  id uuid primary key default gen_random_uuid(),
  state text not null default 'provisioning' check (state in ('provisioning', 'ready', 'active')),
  token_hash text unique,
  teacher_id uuid,
  class_id uuid,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_activity_at timestamptz not null default now()
);
create index if not exists demo_slots_state_idx on public.demo_slots (state, last_activity_at);

create table if not exists public.demo_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slot_id uuid not null references public.demo_slots (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  seed_key text not null
);
create index if not exists demo_accounts_slot_idx on public.demo_accounts (slot_id);

-- تحديد معدل الطلبات على دالة الدخول العامة (مفتاح = بصمة IP، لا نخزّن IP نفسه)
create table if not exists public.demo_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

-- إغلاق كامل على المتصفح: لا سياسات، لا صلاحيات. service_role فقط (يتجاوز RLS).
alter table public.demo_settings    enable row level security;
alter table public.demo_slots       enable row level security;
alter table public.demo_accounts    enable row level security;
alter table public.demo_rate_limits enable row level security;
revoke all on public.demo_settings, public.demo_slots, public.demo_accounts, public.demo_rate_limits
  from anon, authenticated;

-- 3) دوال يستدعيها المتصفح (محدودة جدًا) ------------------------------------------
create or replace function public.demo_status()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select enabled from public.demo_settings where id), false);
$$;
revoke execute on function public.demo_status() from public;
grant execute on function public.demo_status() to anon, authenticated;

create or replace function public.is_demo_user(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.demo_accounts where user_id = p_user);
$$;
revoke execute on function public.is_demo_user(uuid) from public, anon;
grant execute on function public.is_demo_user(uuid) to authenticated;

-- نبضة نشاط: تحدّث آخر نشاط للـSlot الذي يخص المستخدم الحالي فقط.
create or replace function public.demo_touch()
returns void
language sql
security definer
set search_path = public
as $$
  update public.demo_slots s
  set last_activity_at = now()
  where s.id = (select a.slot_id from public.demo_accounts a where a.user_id = auth.uid());
$$;
revoke execute on function public.demo_touch() from public, anon;
grant execute on function public.demo_touch() to authenticated;

-- 4) دوال للخادم فقط (Edge Functions بمفتاح service_role) -------------------------
-- (أ) حجز Slot: إما الـSlot النشط لنفس المتصفح (بصمة token)، أو أول Slot جاهز.
create or replace function public.demo_claim_slot(p_existing_hash text, p_new_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.demo_slots;
  cfg public.demo_settings;
begin
  select * into cfg from public.demo_settings where id;

  if p_existing_hash is not null then
    select * into s from public.demo_slots
    where token_hash = p_existing_hash and state = 'active'
      and last_activity_at > now() - make_interval(mins => cfg.idle_minutes)
      and created_at > now() - make_interval(hours => cfg.max_age_hours)
    for update;
    if found then
      update public.demo_slots set last_activity_at = now() where id = s.id;
      return jsonb_build_object('slot_id', s.id, 'token_hash', s.token_hash, 'reused', true);
    end if;
  end if;

  select * into s from public.demo_slots
  where state = 'ready'
  order by created_at
  limit 1
  for update skip locked;
  if not found then
    return null;
  end if;

  update public.demo_slots
  set state = 'active', token_hash = p_new_hash, claimed_at = now(), last_activity_at = now()
  where id = s.id;
  return jsonb_build_object('slot_id', s.id, 'token_hash', p_new_hash, 'reused', false);
end;
$$;

-- (ب) تحديد المعدل: يرجع true إن كان الطلب مسموحًا.
create or replace function public.demo_rate_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.demo_rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
        hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into v_hits;
  -- تنظيف خفيف للمفاتيح القديمة
  delete from public.demo_rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_limit;
end;
$$;

-- (ج) Slots قابلة للإنهاء: خاملة، أو تجاوزت أقصى عمر، أو عالقة في التجهيز.
create or replace function public.demo_slots_to_retire()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select s.id
  from public.demo_slots s, public.demo_settings cfg
  where cfg.id
    and (
      (s.state = 'active' and s.last_activity_at < now() - make_interval(mins => cfg.idle_minutes))
      or s.created_at < now() - make_interval(hours => cfg.max_age_hours)
      or (s.state = 'provisioning' and s.created_at < now() - interval '15 minutes')
    );
$$;

-- (د) عدد الـSlots الحالية وعدد الجاهزة (لسقف الأمان وتجديد المخزون الدافئ).
create or replace function public.demo_slot_counts()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.demo_slots),
    'ready', (select count(*) from public.demo_slots where state = 'ready'),
    'max_slots', cfg.max_slots,
    'warm_target', cfg.warm_target,
    'enabled', cfg.enabled
  ) from public.demo_settings cfg where cfg.id;
$$;

-- 5) تعبئة البيانات التجريبية عبر دوال النظام الحقيقية -------------------------------
-- تضبط هوية الجلسة داخل المعاملة الحالية فقط لتُرى بواسطة auth.uid().
create or replace function public.demo_impersonate(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
end;
$$;

create or replace function public.demo_play_quiz(p_correct integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt uuid;
  q record;
  n integer := 0;
begin
  v_attempt := public.start_quiz_attempt();
  for q in
    select id, options, answer_key from public.quiz_attempt_questions
    where attempt_id = v_attempt order by question_order
  loop
    n := n + 1;
    perform public.record_quiz_answer(
      v_attempt, q.id,
      case when n <= p_correct then q.answer_key
           else (select o from jsonb_array_elements_text(q.options) o where o <> q.answer_key limit 1) end
    );
  end loop;
  perform public.complete_quiz_attempt(v_attempt);
end;
$$;

create or replace function public.demo_play_game(p_game text, p_correct integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt uuid;
  q record;
  n integer := 0;
begin
  v_attempt := public.start_game_attempt(p_game);
  for q in
    select id, options, answer_key from public.game_attempt_questions
    where attempt_id = v_attempt order by question_order
  loop
    n := n + 1;
    perform public.record_game_answer(
      v_attempt, q.id,
      case when n <= p_correct then q.answer_key
           else (select o from jsonb_array_elements_text(q.options) o where o <> q.answer_key limit 1) end
    );
  end loop;
  perform public.complete_game_attempt(v_attempt);
end;
$$;

create or replace function public.demo_play_placement(p_correct integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt uuid;
  q record;
  n integer := 0;
begin
  v_attempt := public.start_placement_attempt();
  for q in
    select paq.question_id, pq.correct_answer, paq.options_snapshot
    from public.placement_attempt_questions paq
    join public.placement_questions pq on pq.id = paq.question_id
    where paq.attempt_id = v_attempt
    order by paq.question_order
  loop
    n := n + 1;
    perform public.record_placement_answer(
      v_attempt, q.question_id,
      case when n <= p_correct then q.correct_answer
           else (select o from jsonb_array_elements_text(q.options_snapshot) o where o <> q.correct_answer limit 1) end
    );
  end loop;
  perform public.complete_placement_attempt(v_attempt);
end;
$$;

revoke execute on function public.demo_impersonate(uuid) from public, anon, authenticated;
revoke execute on function public.demo_play_quiz(integer) from public, anon, authenticated;
revoke execute on function public.demo_play_game(text, integer) from public, anon, authenticated;
revoke execute on function public.demo_play_placement(integer) from public, anon, authenticated;

-- p_students: [{"id": "<uuid>", "key": "sara"}, ...] — المفاتيح: sara, nour, jana, layan, maryam, shahd
create or replace function public.demo_seed_slot(p_teacher uuid, p_class uuid, p_students jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids jsonb := '{}'::jsonb;
  s record;
  v_uid uuid;
  v_task1 uuid;
  v_task2 uuid;
  v_ass uuid;
  v_lessons text[] := array['addition','subtraction','rounding','doubling','ascending-order','descending-order','comparison','even-odd'];
  v_games text[] := array['addition','subtraction','rounding','doubling'];
  v_i integer;
  v_name text;
begin
  for s in select * from jsonb_to_recordset(p_students) as x(id uuid, key text) loop
    v_ids := v_ids || jsonb_build_object(s.key, s.id);
  end loop;

  -- ---- سارة: متقدمة --------------------------------------------------------
  v_uid := (v_ids ->> 'sara')::uuid;
  perform public.demo_impersonate(v_uid);
  foreach v_name in array v_lessons loop perform public.complete_lesson(v_name); end loop;
  foreach v_name in array v_lessons loop perform public.complete_practice(v_name); end loop;
  foreach v_name in array array['identity-homeland','digital-leader','skills-growth'] loop
    perform public.complete_initiative(v_name);
  end loop;
  perform public.demo_play_placement(9);
  perform public.demo_play_game('addition', 10);
  perform public.demo_play_game('subtraction', 9);
  perform public.demo_play_game('rounding', 8);
  perform public.demo_play_quiz(9);
  perform public.record_fun_game_result('addition', 3, 0, 48);
  perform public.record_fun_game_result('doubling', 3, 1, 61);
  perform public.record_fun_game_result('comparison', 2, 2, 75);

  -- ---- نور: متوسطة -----------------------------------------------------------
  v_uid := (v_ids ->> 'nour')::uuid;
  perform public.demo_impersonate(v_uid);
  for v_i in 1..4 loop perform public.complete_lesson(v_lessons[v_i]); end loop;
  for v_i in 1..2 loop perform public.complete_practice(v_lessons[v_i]); end loop;
  perform public.complete_initiative('identity-homeland');
  perform public.demo_play_placement(7);
  perform public.demo_play_game('addition', 7);
  perform public.demo_play_quiz(7);
  perform public.record_fun_game_result('subtraction', 2, 3, 80);

  -- ---- جنى: بدأت حديثًا ------------------------------------------------------
  v_uid := (v_ids ->> 'jana')::uuid;
  perform public.demo_impersonate(v_uid);
  perform public.complete_lesson('addition');

  -- ---- ليان: جرّبت الألعاب ----------------------------------------------------
  v_uid := (v_ids ->> 'layan')::uuid;
  perform public.demo_impersonate(v_uid);
  perform public.complete_lesson('addition');
  perform public.complete_lesson('subtraction');
  perform public.demo_play_game('addition', 8);
  perform public.demo_play_game('subtraction', 6);
  perform public.demo_play_game('rounding', 7);
  perform public.demo_play_game('doubling', 9);
  perform public.record_fun_game_result('addition', 3, 0, 52);
  perform public.record_fun_game_result('subtraction', 2, 2, 70);
  perform public.record_fun_game_result('rounding', 2, 3, 85);
  perform public.record_fun_game_result('doubling', 3, 1, 66);
  perform public.record_fun_game_result('even-odd', 3, 0, 58);

  -- ---- مريم: نتائج «اختبر» ----------------------------------------------------
  v_uid := (v_ids ->> 'maryam')::uuid;
  perform public.demo_impersonate(v_uid);
  perform public.complete_lesson('rounding');
  perform public.demo_play_placement(6);
  perform public.demo_play_quiz(8);

  -- ---- شهد: تقدم مختلط ---------------------------------------------------------
  v_uid := (v_ids ->> 'shahd')::uuid;
  perform public.demo_impersonate(v_uid);
  for v_i in 1..3 loop perform public.complete_lesson(v_lessons[v_i]); end loop;
  perform public.complete_practice('addition');
  perform public.complete_initiative('digital-leader');
  perform public.demo_play_game('addition', 7);
  perform public.record_fun_game_result('ascending-order', 2, 2, 90);

  -- ---- مهام الصف + تكليفاتها (نفس الجدولين اللذين تكتب فيهما واجهة المعلمة) --------
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into public.tasks (class_id, teacher_id, title, description, task_type, points, due_date)
  values (p_class, p_teacher, 'أكملي درس الجمع', 'ادخلي إلى «تعلّم» وأكملي درس الجمع حتى النهاية.', 'general', 5, (current_date + 3))
  returning id into v_task1;
  insert into public.tasks (class_id, teacher_id, title, description, task_type, points, due_date)
  values (p_class, p_teacher, 'تدريب هذا الأسبوع', 'حلّي ورقة عمل واحدة على الأقل من «تدرّب».', 'general', 3, (current_date + 6))
  returning id into v_task2;

  insert into public.task_assignments (task_id, student_id)
  select t.id, (e.value)::uuid
  from (values (v_task1), (v_task2)) as t(id), jsonb_each_text(v_ids) e;

  -- سارة ونور تُكملان المهمة الأولى، وسارة الثانية أيضًا؛ البقية لم تبدأ بعد.
  foreach v_name in array array['sara', 'nour'] loop
    v_uid := (v_ids ->> v_name)::uuid;
    perform public.demo_impersonate(v_uid);
    select id into v_ass from public.task_assignments where task_id = v_task1 and student_id = v_uid;
    perform public.complete_task_assignment(v_ass);
  end loop;
  v_uid := (v_ids ->> 'sara')::uuid;
  perform public.demo_impersonate(v_uid);
  select id into v_ass from public.task_assignments where task_id = v_task2 and student_id = v_uid;
  perform public.complete_task_assignment(v_ass);

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  -- ---- لوحة نجوم الحصة (تديرها المعلمة يدويًا، منفصلة عن رصيد الطالبة) -----------------
  insert into public.star_board_entries (class_id, student_id, display_name, stars)
  select p_class, st.id, pr.full_name,
    case (select x.key from jsonb_each_text(v_ids) x where (x.value)::uuid = st.id)
      when 'sara' then 14 when 'nour' then 9 when 'layan' then 7
      when 'maryam' then 6 when 'shahd' then 4 else 2 end
  from public.students st join public.profiles pr on pr.id = st.id
  where st.id in (select (value)::uuid from jsonb_each_text(v_ids));
end;
$$;
revoke execute on function public.demo_seed_slot(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.demo_claim_slot(text, text) from public, anon, authenticated;
revoke execute on function public.demo_rate_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.demo_slots_to_retire() from public, anon, authenticated;
revoke execute on function public.demo_slot_counts() from public, anon, authenticated;
grant execute on function public.demo_seed_slot(uuid, uuid, jsonb) to service_role;
grant execute on function public.demo_claim_slot(text, text) to service_role;
grant execute on function public.demo_rate_hit(text, integer, integer) to service_role;
grant execute on function public.demo_slots_to_retire() to service_role;
grant execute on function public.demo_slot_counts() to service_role;
