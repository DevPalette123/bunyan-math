-- ============================================================================
-- بنيان الرياضيات — قاعدة البيانات الأولية (معلمة واحدة + طلابها)
-- ============================================================================
-- طريقة الاستخدام:
-- 1. افتح مشروعك في supabase.com
-- 2. من القائمة الجانبية: SQL Editor -> New query
-- 3. الصق هذا الملف كاملًا واضغط Run
-- هذا الملف قابل لإعادة التشغيل بأمان (IF NOT EXISTS في كل مكان ممكن).
-- ============================================================================

-- 1) جدول profiles: صف واحد لكل مستخدم مسجَّل في Supabase Auth
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  full_name text not null,
  created_at timestamptz not null default now()
);

-- 2) جدول classes: كل صف/مجموعة تابعة لمعلمة واحدة
--    (تصميم يسمح مستقبلًا بأكثر من صف لكل معلمة، وأكثر من معلمة لاحقًا)
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- 3) جدول teachers: بيانات إضافية خاصة بحساب المعلمة (اختياري التوسّع لاحقًا)
-- ----------------------------------------------------------------------------
create table if not exists public.teachers (
  id uuid primary key references public.profiles (id) on delete cascade,
  bio text
);

-- 4) جدول students: بيانات إضافية خاصة بحساب الطالب + ربطه بصف
-- ----------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  grade_label text,
  stars integer not null default 0,
  login_code text unique
);

-- عمود قديم قد يكون غير موجودًا إذا كان هذا الجدول أُنشئ بنسخة أقدم من هذا
-- الملف — إضافته الآن بأمان لمن يعيد تشغيل schema.sql على مشروع قائم.
alter table public.students add column if not exists login_code text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_login_code_key'
  ) then
    alter table public.students add constraint students_login_code_key unique (login_code);
  end if;
end
$$;

-- 5) جدول tasks: مهام الأسبوع التي تنشئها المعلمة لصفها
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  task_type text not null default 'general',
  points integer not null default 0 check (points >= 0),
  start_date date,
  due_date date,
  status text not null default 'published' check (status in ('published', 'cancelled')),
  created_at timestamptz not null default now()
);

-- 6) جدول task_assignments: ربط مهمة بكل طالب مُكلَّف بها + حالة تقدمه الحقيقية
--    (لا يوجد عمود "points" أو "badge" هنا — هذه القيم تُحسب/تُمنح فقط عبر
--    الدالة الآمنة public.complete_task_assignment أدناه، وليس من الواجهة)
-- ----------------------------------------------------------------------------
create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  unique (task_id, student_id)
);

-- 7) جدول badges: كتالوج ثابت لتعريف الشارات (بيانات حقيقية في قاعدة البيانات،
--    وليست مصفوفة ثابتة داخل كود الواجهة) — شرط منحها آلي وقابل للتوسعة.
-- ----------------------------------------------------------------------------
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  condition_type text not null,
  condition_value integer
);

insert into public.badges (code, name, description, condition_type, condition_value) values
  ('first_completion', 'البداية', 'يُمنح عند إكمال أول مهمة', 'tasks_completed_count', 1),
  ('persistent', 'المثابر', 'يُمنح عند إكمال 5 مهام', 'tasks_completed_count', 5)
on conflict (code) do nothing;

-- 8) جدول student_badges: الشارات التي حصل عليها الطالب فعليًا — لا يوجد أي
--    مسار INSERT/UPDATE/DELETE من العميل على هذا الجدول إطلاقًا (انظر السياسات
--    أدناه)؛ الصف الوحيد الذي يُدخله هو public.evaluate_and_award_badges()
--    التي تعمل بصلاحية SECURITY DEFINER.
-- ----------------------------------------------------------------------------
create table if not exists public.student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (student_id, badge_id)
);

alter table public.tasks            enable row level security;
alter table public.task_assignments enable row level security;
alter table public.badges           enable row level security;
alter table public.student_badges   enable row level security;

-- ============================================================================
-- تفعيل Row Level Security على كل الجداول — إلزامي، بدونه أي مستخدم مسجّل
-- دخول يمكنه قراءة/تعديل كل شيء.
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.classes  enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;

-- ============================================================================
-- دوال مساعدة (SECURITY DEFINER) لكسر التكرار اللانهائي بين سياسات الجداول
-- ============================================================================
-- classes وstudents تحتاج كل واحدة أن "تسأل" عن الأخرى ضمن سياساتها (مثلًا:
-- "هل أنا معلمة هذا الصف؟" تحتاج قراءة classes من داخل سياسة students، والعكس).
-- لو كتبنا هذا كـ subquery عادي، فإن Postgres يعيد كتابة (rewrite) كل استعلام
-- على الجدول الآخر ليشمل سياساته هو أيضًا، وبما أن كل جدول يشير للآخر، تتكرر
-- إعادة الكتابة إلى ما لا نهاية وتفشل بخطأ:
--   "infinite recursion detected in policy for relation ..."
-- الحل الصحيح والمعتمد من Supabase: دالة SECURITY DEFINER تُنفَّذ بصلاحية
-- مالك الدالة (وليس المستخدم المستدعي)، فلا تُطبَّق عليها سياسات RLS للجدول
-- الذي تقرأ منه، وبالتالي تكسر حلقة التكرار دون أي تعطيل لـ RLS نفسه.
create or replace function public.is_teacher_of_class(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.classes c
    where c.id = target_class_id
      and c.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_student_in_class(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.students s
    where s.class_id = target_class_id
      and s.id = auth.uid()
  );
$$;

create or replace function public.is_teacher_of_student(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = target_student_id
      and c.teacher_id = auth.uid()
  );
$$;

-- tasks و task_assignments تحتاج نفس الحماية من التكرار اللانهائي بينهما
-- (مهمة تسأل "من المُكلَّف بي؟"، وتكليف يسأل "هل معلمتي تملك هذه المهمة؟").
create or replace function public.is_teacher_of_task(target_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = target_task_id
      and t.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_student_assigned_to_task(target_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.task_assignments ta
    where ta.task_id = target_task_id
      and ta.student_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- سياسات profiles
-- ----------------------------------------------------------------------------
-- كل مستخدم يرى صف حسابه الخاص فقط
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

-- المعلمة ترى أيضًا بروفايلات طلابها (عبر جدول students/classes)
drop policy if exists "profiles_select_teacher_view_students" on public.profiles;
create policy "profiles_select_teacher_view_students"
  on public.profiles for select
  using (public.is_teacher_of_student(public.profiles.id));

-- كل مستخدم يمكنه تحديث اسمه الخاص فقط (وليس دوره — role لا يُعدَّل من الواجهة)
drop policy if exists "profiles_update_own_name" on public.profiles;
create policy "profiles_update_own_name"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ⚠️ الحماية أعلاه وحدها غير كافية: RLS تتحقق من "أي صف" (id = auth.uid())
-- وليس "أي عمود" — بدون ما يلي، يستطيع أي مستخدم إرسال
--   update profiles set role = 'teacher' where id = auth.uid()
-- وينجح لأن الصف صفّه فعلًا. الحماية الحقيقية من تصعيد الصلاحيات
-- (role escalation) تأتي من صلاحيات الأعمدة (column-level privileges) التي
-- يفرضها Postgres نفسه بغض النظر عن شكل الاستعلام — هذا اكتُشف واختُبر فعليًا
-- (انظر ملاحظات RLS في التقرير)، وليس افتراضًا نظريًا.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- سياسات classes
-- ----------------------------------------------------------------------------
-- المعلمة ترى صفوفها فقط
drop policy if exists "classes_select_own_teacher" on public.classes;
create policy "classes_select_own_teacher"
  on public.classes for select
  using (teacher_id = auth.uid());

-- الطالب يرى صفه الذي هو مسجَّل فيه فقط
drop policy if exists "classes_select_own_student" on public.classes;
create policy "classes_select_own_student"
  on public.classes for select
  using (public.is_student_in_class(public.classes.id));

-- المعلمة تنشئ/تعدّل صفوفها فقط
drop policy if exists "classes_insert_own_teacher" on public.classes;
create policy "classes_insert_own_teacher"
  on public.classes for insert
  with check (teacher_id = auth.uid());

drop policy if exists "classes_update_own_teacher" on public.classes;
create policy "classes_update_own_teacher"
  on public.classes for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- ----------------------------------------------------------------------------
-- سياسات teachers
-- ----------------------------------------------------------------------------
drop policy if exists "teachers_select_own" on public.teachers;
create policy "teachers_select_own"
  on public.teachers for select
  using (id = auth.uid());

drop policy if exists "teachers_update_own" on public.teachers;
create policy "teachers_update_own"
  on public.teachers for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- سياسات students — الأهم أمنيًا: طالب لا يرى طالبًا آخر إطلاقًا
-- ----------------------------------------------------------------------------
-- الطالب يرى صفّه الخاص فقط
drop policy if exists "students_select_own" on public.students;
create policy "students_select_own"
  on public.students for select
  using (id = auth.uid());

-- المعلمة ترى فقط طلاب صفوفها هي
drop policy if exists "students_select_teacher_roster" on public.students;
create policy "students_select_teacher_roster"
  on public.students for select
  using (public.is_teacher_of_class(public.students.class_id));

-- المعلمة يمكنها تحديث بيانات طلاب صفوفها فقط (مثل النقاط لاحقًا)
drop policy if exists "students_update_teacher_roster" on public.students;
create policy "students_update_teacher_roster"
  on public.students for update
  using (public.is_teacher_of_class(public.students.class_id))
  with check (public.is_teacher_of_class(public.students.class_id));

-- ----------------------------------------------------------------------------
-- سياسات tasks — المعلمة تُنشئ/تُدير مهام صفها فقط؛ الطالب يرى فقط المهام
-- المُكلَّف بها (عبر جدول task_assignments)، ولا يستطيع إنشاء أو تعديل أي مهمة.
-- ----------------------------------------------------------------------------
drop policy if exists "tasks_select_own_teacher" on public.tasks;
create policy "tasks_select_own_teacher"
  on public.tasks for select
  using (teacher_id = auth.uid());

drop policy if exists "tasks_select_assigned_student" on public.tasks;
create policy "tasks_select_assigned_student"
  on public.tasks for select
  using (public.is_student_assigned_to_task(public.tasks.id));

drop policy if exists "tasks_insert_own_teacher" on public.tasks;
create policy "tasks_insert_own_teacher"
  on public.tasks for insert
  with check (teacher_id = auth.uid() and public.is_teacher_of_class(class_id));

drop policy if exists "tasks_update_own_teacher" on public.tasks;
create policy "tasks_update_own_teacher"
  on public.tasks for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "tasks_delete_own_teacher" on public.tasks;
create policy "tasks_delete_own_teacher"
  on public.tasks for delete
  using (teacher_id = auth.uid());

-- ----------------------------------------------------------------------------
-- سياسات task_assignments — المعلمة تُكلِّف/تُلغي تكليف طلاب صفها فقط، وترى
-- تقدمهم. الطالب يرى فقط تكليفاته الخاصة. لا توجد أي سياسة UPDATE للطالب هنا
-- عن قصد: تحديث الحالة/النقاط لا يمر إلا عبر public.complete_task_assignment
-- (SECURITY DEFINER) أدناه — لا يمكن لأي طالب أن يكتب status='completed' أو
-- points مباشرة من المتصفح.
-- ----------------------------------------------------------------------------
drop policy if exists "task_assignments_select_own_teacher" on public.task_assignments;
create policy "task_assignments_select_own_teacher"
  on public.task_assignments for select
  using (public.is_teacher_of_task(task_id));

drop policy if exists "task_assignments_select_own_student" on public.task_assignments;
create policy "task_assignments_select_own_student"
  on public.task_assignments for select
  using (student_id = auth.uid());

drop policy if exists "task_assignments_insert_own_teacher" on public.task_assignments;
create policy "task_assignments_insert_own_teacher"
  on public.task_assignments for insert
  with check (
    public.is_teacher_of_task(task_id)
    and public.is_teacher_of_student(student_id)
  );

drop policy if exists "task_assignments_delete_own_teacher" on public.task_assignments;
create policy "task_assignments_delete_own_teacher"
  on public.task_assignments for delete
  using (public.is_teacher_of_task(task_id));

-- ----------------------------------------------------------------------------
-- سياسات badges — كتالوج تعريفي عام (اسم/شرط الشارة)، لا بيانات شخصية بداخله،
-- فيُسمح لأي مستخدم مسجَّل دخول بقراءته فقط. لا INSERT/UPDATE/DELETE من العميل.
-- ----------------------------------------------------------------------------
drop policy if exists "badges_select_all" on public.badges;
create policy "badges_select_all"
  on public.badges for select
  using (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- سياسات student_badges — القراءة فقط، لصاحب الشارة أو معلمته. عمدًا: لا توجد
-- أي سياسة INSERT/UPDATE/DELETE — المسار الوحيد هو
-- public.evaluate_and_award_badges (SECURITY DEFINER) أدناه.
-- ----------------------------------------------------------------------------
drop policy if exists "student_badges_select_own_student" on public.student_badges;
create policy "student_badges_select_own_student"
  on public.student_badges for select
  using (student_id = auth.uid());

drop policy if exists "student_badges_select_own_teacher" on public.student_badges;
create policy "student_badges_select_own_teacher"
  on public.student_badges for select
  using (public.is_teacher_of_student(student_id));

-- ============================================================================
-- دوال آمنة (SECURITY DEFINER) لمنح النقاط والشارات — هذه هي الطريقة الوحيدة
-- المسموحة لتغيير stars أو student_badges. لا الطالب ولا الواجهة الأمامية
-- يستطيعان إرسال "points = 1000" أو "badge = true" مباشرة والحصول عليها.
-- مستخدمة الآن: الواجهة تستدعي complete_task_assignment (إكمال مهمة) مباشرة،
-- أما evaluate_and_award_badges فتُستدعى من داخل الدوال الأخرى
-- (complete_task_assignment وcomplete_lesson وcomplete_placement_attempt).
-- ============================================================================
create or replace function public.evaluate_and_award_badges(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed_count integer;
begin
  select count(*) into v_completed_count
  from public.task_assignments
  where student_id = target_student_id and status = 'completed';

  insert into public.student_badges (student_id, badge_id)
  select target_student_id, b.id
  from public.badges b
  where b.condition_type = 'tasks_completed_count'
    and v_completed_count >= b.condition_value
  on conflict (student_id, badge_id) do nothing;
end;
$$;

create or replace function public.complete_task_assignment(target_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_task_id uuid;
  v_points integer;
begin
  select student_id, task_id into v_student_id, v_task_id
  from public.task_assignments
  where id = target_assignment_id;

  if v_student_id is null then
    raise exception 'التكليف غير موجود';
  end if;

  -- فقط الطالب صاحب هذا التكليف يستطيع استدعاء هذه الدالة لإكماله.
  if v_student_id <> auth.uid() then
    raise exception 'غير مصرَّح';
  end if;

  update public.task_assignments
  set status = 'completed', completed_at = now()
  where id = target_assignment_id and status <> 'completed';

  if found then
    select points into v_points from public.tasks where id = v_task_id;
    if v_points is not null and v_points > 0 then
      update public.students set stars = stars + v_points where id = v_student_id;
    end if;

    perform public.evaluate_and_award_badges(v_student_id);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- ملاحظة: سياسات "الطلاب غير المرتبطين" (claim/unassigned) من نسخة سابقة من
-- هذا الملف أُزيلت بالكامل — لم تعد هناك خطوة "إضافة طالب موجود مسبقًا لصف"،
-- فكل طالب يُنشأ ويُربط بصف معلمته مباشرة وذريًا عبر Edge Function (انظر
-- supabase/functions/create-student). إن كانت هذه السياسات موجودة من نسخة
-- سابقة على مشروعك، فهذا يحذفها بأمان:
drop policy if exists "students_select_unassigned" on public.students;
drop policy if exists "profiles_select_unassigned_students" on public.profiles;
drop policy if exists "students_claim_unassigned_by_teacher" on public.students;

-- ============================================================================
-- تلقائيًا: إنشاء صف profiles عند إنشاء مستخدم جديد في Supabase Auth
-- ============================================================================
-- هذا الـtrigger يقرأ role و full_name من user_metadata التي تُمرَّر عند إنشاء
-- المستخدم (سواء من Supabase Dashboard -> Authentication -> Add user، أو من
-- Edge Function عبر supabase.auth.admin.createUser). إن لم تُمرَّر role، يُفترض
-- "student" افتراضيًا فقط كحماية، لكن يُستحسن دائمًا تمريرها صراحة.
--
-- كل معلمة تحصل تلقائيًا على "صف" واحد فقط عند إنشاء حسابها (لا يوجد أي زر أو
-- خطوة "إنشاء صف" في الواجهة إطلاقًا) — هذا الصف موجود فقط داخليًا لإعادة
-- استخدام سياسات RLS المُختبَرة بين classes/students، والمعلمة لا "ترى" مفهوم
-- الصف في واجهتها بتاتًا، فقط "طلابي".
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    user_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;

  if user_role = 'teacher' then
    insert into public.teachers (id) values (new.id) on conflict (id) do nothing;

    -- صفها الوحيد، يُنشأ تلقائيًا معها ولا تراه أبدًا كخطوة منفصلة.
    insert into public.classes (teacher_id, name)
    select new.id, 'صفي'
    where not exists (select 1 from public.classes c where c.teacher_id = new.id);
  else
    insert into public.students (id) values (new.id) on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- إضافة لاحقة: «اكتشف» (اختبار تحديد المستوى) + إكمال دروس «تعلّم»
-- كل ما يلي قابل لإعادة التشغيل بأمان تمامًا مثل بقية هذا الملف، ولا يمس أي
-- جدول أو دالة أو سياسة موجودة مسبقًا (باستثناء استبدال دالة واحدة أدناه
-- بنسخة متوافقة تمامًا مع القديمة + شروط جديدة فقط — انظر التعليق هناك).
-- ============================================================================

-- 9) جدول placement_questions: بنك أسئلة حقيقي وقابل للتوسّع لاختبار «اكتشف»
-- ----------------------------------------------------------------------------
create table if not exists public.placement_questions (
  id uuid primary key default gen_random_uuid(),
  skill text not null check (skill in (
    'addition_no_carry', 'subtraction_no_borrow', 'rounding', 'doubling',
    'ascending_order', 'descending_order', 'comparison', 'even_odd'
  )),
  question text not null,
  options jsonb not null,
  correct_answer text not null,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamptz not null default now()
);

-- 10) جدول placement_attempts: محاولة اختبار واحدة لطالب — الوقت والنتيجة
--     والتحليل كلها تُكتب فقط من الدوال الآمنة أدناه، لا سياسة INSERT/UPDATE
--     للعميل إطلاقًا على هذا الجدول.
-- ----------------------------------------------------------------------------
create table if not exists public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  total_questions integer not null default 10,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  unanswered integer not null default 0,
  percentage numeric,
  level text,
  points_awarded integer not null default 0,
  weak_skills text[] not null default '{}',
  strong_skills text[] not null default '{}',
  recommended_skill text
);

-- 11) جدول placement_attempt_questions: الأسئلة الفعلية التي اختيرت لمحاولة
--     معيّنة + إجابة الطالب. عمود correct_answer يبقى NULL طوال فترة تأدية
--     الاختبار ولا تملؤه إلا public.complete_placement_attempt بعد الانتهاء —
--     هذا هو ما يمنع الطالب من رؤية الإجابة الصحيحة أثناء الاختبار حتى لو
--     فحص الشبكة مباشرة (بالإضافة إلى إخفاء العمود في جدول الأسئلة نفسه،
--     انظر صلاحيات الأعمدة أدناه).
-- ----------------------------------------------------------------------------
create table if not exists public.placement_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.placement_attempts (id) on delete cascade,
  question_id uuid not null references public.placement_questions (id),
  skill text not null,
  question_order integer not null,
  -- نسخة من خيارات هذا السؤال بترتيب عشوائي خاص بهذه المحاولة تحديدًا —
  -- يُملأ مرة واحدة في start_placement_attempt ولا يتغيّر بعدها (يبقى نفس
  -- الترتيب عند إعادة تحميل الصفحة أو عند المراجعة بعد الانتهاء). هذا هو ما
  -- يمنع أن تكون الإجابة الصحيحة دائمًا الخيار الأول كما كان يحدث سابقًا.
  options_snapshot jsonb,
  selected_answer text,
  correct_answer text,
  is_correct boolean,
  answered_at timestamptz,
  unique (attempt_id, question_id)
);

-- لمن سبق وشغّلت النسخة الأولى من هذا الملف على قاعدة بيانات موجودة: هذا
-- السطر يضيف العمود الجديد بأمان دون التأثير على أي بيانات قديمة.
alter table public.placement_attempt_questions
  add column if not exists options_snapshot jsonb;

-- 12) جدول lesson_completions: إكمال درس فعلي من دروس «تعلّم» الثمانية —
--     unique(student_id, lesson_id) يمنع تسجيل نفس الدرس مرتين ومنح نقاطه
--     أكثر من مرة، حتى لو أُعيد تحميل الصفحة أو استُدعيت الدالة عدة مرات.
-- ----------------------------------------------------------------------------
create table if not exists public.lesson_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  lesson_id text not null,
  points_awarded integer not null default 0,
  completed_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

-- بنك أسئلة أولي: 4 أسئلة لكل مهارة من المهارات الثمانية (32 سؤالًا)، يُدرج
-- مرة واحدة فقط (لا مفتاح طبيعي فريد لكل سؤال بخلاف id العشوائي، فالحماية من
-- التكرار عند إعادة تشغيل هذا الملف تكون بفحص وجود أي صف أولًا).
-- الأرقام مخزَّنة بترقيم إنجليزي عاديًا (تحويلها لأرقام عربية-هندية يحدث فقط
-- عند العرض في الواجهة عبر toArabicDigits، تمامًا كبقية المشروع).
do $$
begin
  if not exists (select 1 from public.placement_questions limit 1) then
    insert into public.placement_questions (skill, question, options, correct_answer, difficulty) values
      ('addition_no_carry', 'أوجد ناتج الجمع التالي: 45 + 38 = ؟', '["82","83","93","73"]', '83', 'medium'),
      ('addition_no_carry', 'أوجد ناتج الجمع التالي: 23 + 45 = ؟', '["68","58","78","67"]', '68', 'easy'),
      ('addition_no_carry', 'أوجد ناتج الجمع التالي: 34 + 52 = ؟', '["86","76","96","87"]', '86', 'easy'),
      ('addition_no_carry', 'أوجد ناتج الجمع التالي: 12 + 63 = ؟', '["75","65","85","74"]', '75', 'easy'),

      ('subtraction_no_borrow', 'أوجد ناتج الطرح التالي: 58 - 23 = ؟', '["35","45","33","25"]', '35', 'easy'),
      ('subtraction_no_borrow', 'أوجد ناتج الطرح التالي: 96 - 54 = ؟', '["42","52","32","41"]', '42', 'easy'),
      ('subtraction_no_borrow', 'أوجد ناتج الطرح التالي: 87 - 25 = ؟', '["62","72","52","61"]', '62', 'medium'),
      ('subtraction_no_borrow', 'أوجد ناتج الطرح التالي: 78 - 43 = ؟', '["35","45","25","33"]', '35', 'medium'),

      ('rounding', 'قرّب العدد 43 لأقرب عشرة.', '["40","50","30","45"]', '40', 'easy'),
      ('rounding', 'قرّب العدد 76 لأقرب عشرة.', '["80","70","90","75"]', '80', 'easy'),
      ('rounding', 'قرّب العدد 24 لأقرب عشرة.', '["20","30","25","10"]', '20', 'medium'),
      ('rounding', 'قرّب العدد 65 لأقرب عشرة.', '["70","60","65","50"]', '70', 'medium'),

      ('doubling', 'ضعف العدد 7 = ؟', '["14","12","16","21"]', '14', 'easy'),
      ('doubling', 'ضعف العدد 12 = ؟', '["24","22","26","20"]', '24', 'easy'),
      ('doubling', 'ضعف العدد 9 = ؟', '["18","16","20","17"]', '18', 'medium'),
      ('doubling', 'ضعف العدد 15 = ؟', '["30","25","35","20"]', '30', 'medium'),

      ('ascending_order', 'رتّب الأعداد التالية تصاعديًا: 5, 2, 8, 1', '["1, 2, 5, 8","8, 5, 2, 1","2, 1, 5, 8","1, 5, 2, 8"]', '1, 2, 5, 8', 'medium'),
      ('ascending_order', 'رتّب الأعداد التالية تصاعديًا: 12, 4, 9, 7', '["4, 7, 9, 12","12, 9, 7, 4","4, 9, 7, 12","7, 4, 9, 12"]', '4, 7, 9, 12', 'medium'),
      ('ascending_order', 'رتّب الأعداد التالية تصاعديًا: 30, 10, 25, 15', '["10, 15, 25, 30","30, 25, 15, 10","10, 25, 15, 30","15, 10, 25, 30"]', '10, 15, 25, 30', 'medium'),
      ('ascending_order', 'رتّب الأعداد التالية تصاعديًا: 6, 3, 9, 1', '["1, 3, 6, 9","9, 6, 3, 1","3, 1, 6, 9","1, 6, 3, 9"]', '1, 3, 6, 9', 'easy'),

      ('descending_order', 'رتّب الأعداد التالية تنازليًا: 5, 2, 8, 1', '["8, 5, 2, 1","1, 2, 5, 8","2, 8, 5, 1","8, 2, 5, 1"]', '8, 5, 2, 1', 'medium'),
      ('descending_order', 'رتّب الأعداد التالية تنازليًا: 12, 4, 9, 7', '["12, 9, 7, 4","4, 7, 9, 12","9, 12, 7, 4","12, 7, 9, 4"]', '12, 9, 7, 4', 'medium'),
      ('descending_order', 'رتّب الأعداد التالية تنازليًا: 30, 10, 25, 15', '["30, 25, 15, 10","10, 15, 25, 30","25, 30, 15, 10","30, 15, 25, 10"]', '30, 25, 15, 10', 'medium'),
      ('descending_order', 'رتّب الأعداد التالية تنازليًا: 6, 3, 9, 1', '["9, 6, 3, 1","1, 3, 6, 9","6, 9, 3, 1","9, 3, 6, 1"]', '9, 6, 3, 1', 'easy'),

      ('comparison', 'أي العلامات تجعل المقارنة صحيحة؟ 45 ⬜ 54', '["<",">","=","لا يمكن المقارنة"]', '<', 'easy'),
      ('comparison', 'أي العلامات تجعل المقارنة صحيحة؟ 78 ⬜ 56', '["<",">","=","لا يمكن المقارنة"]', '>', 'easy'),
      ('comparison', 'أي العلامات تجعل المقارنة صحيحة؟ 32 ⬜ 32', '["<",">","=","لا يمكن المقارنة"]', '=', 'medium'),
      ('comparison', 'أي العلامات تجعل المقارنة صحيحة؟ 91 ⬜ 19', '["<",">","=","لا يمكن المقارنة"]', '>', 'medium'),

      ('even_odd', 'العدد 14 هو عدد؟', '["زوجي","فردي"]', 'زوجي', 'easy'),
      ('even_odd', 'العدد 27 هو عدد؟', '["زوجي","فردي"]', 'فردي', 'easy'),
      ('even_odd', 'العدد 40 هو عدد؟', '["زوجي","فردي"]', 'زوجي', 'medium'),
      ('even_odd', 'العدد 51 هو عدد؟', '["زوجي","فردي"]', 'فردي', 'medium');
  end if;
end
$$;

-- شارات جديدة تُضاف إلى نفس الكتالوج الموجود (بدون إنشاء نظام شارات مواز):
-- شارتان لإكمال الدروس، وشارة لإكمال أول اختبار تحديد مستوى.
insert into public.badges (code, name, description, condition_type, condition_value) values
  ('lesson_starter', 'أول خطوة', 'يُمنح عند إكمال أول درس في تعلّم', 'lessons_completed_count', 1),
  ('lesson_master', 'نجم الدروس', 'يُمنح عند إكمال الدروس الثمانية كاملة', 'lessons_completed_count', 8),
  ('discover_complete', 'مكتشف المستوى', 'يُمنح عند إكمال أول اختبار تحديد مستوى', 'placement_completed_count', 1)
on conflict (code) do nothing;

alter table public.placement_questions        enable row level security;
alter table public.placement_attempts         enable row level security;
alter table public.placement_attempt_questions enable row level security;
alter table public.lesson_completions          enable row level security;

-- دوال مساعدة إضافية (SECURITY DEFINER) بنفس أسلوب is_teacher_of_class /
-- is_teacher_of_student أعلاه، لتفادي أي تكرار لانهائي بين السياسات.
create or replace function public.is_owner_of_attempt(target_attempt_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.placement_attempts a
    where a.id = target_attempt_id and a.student_id = auth.uid()
  );
$$;

create or replace function public.is_teacher_of_attempt(target_attempt_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.placement_attempts a
    where a.id = target_attempt_id and public.is_teacher_of_student(a.student_id)
  );
$$;

-- ----------------------------------------------------------------------------
-- سياسات placement_questions — قراءة فقط لأي مستخدم مسجَّل دخول، ولا
-- INSERT/UPDATE/DELETE من العميل مطلقًا. الأهم: صلاحيات الأعمدة أدناه تمنع
-- عمود correct_answer عن أي استعلام مباشر من الطالب من المتصفح (نفس أسلوب
-- حماية profiles.role الموجود مسبقًا في هذا الملف) — الدوال الآمنة وحدها
-- (SECURITY DEFINER) تستطيع قراءته.
-- ----------------------------------------------------------------------------
drop policy if exists "placement_questions_select_all" on public.placement_questions;
create policy "placement_questions_select_all"
  on public.placement_questions for select
  using (auth.uid() is not null);

revoke select on public.placement_questions from authenticated;
grant select (id, skill, question, options, difficulty) on public.placement_questions to authenticated;

-- ----------------------------------------------------------------------------
-- سياسات placement_attempts — الطالب يرى محاولاته فقط، معلمته ترى محاولات
-- طلابها فقط. عمدًا: لا توجد أي سياسة INSERT/UPDATE/DELETE — المسار الوحيد
-- لإنشاء/تحديث محاولة هو start_placement_attempt/complete_placement_attempt
-- (SECURITY DEFINER) أدناه.
-- ----------------------------------------------------------------------------
drop policy if exists "placement_attempts_select_own_student" on public.placement_attempts;
create policy "placement_attempts_select_own_student"
  on public.placement_attempts for select
  using (student_id = auth.uid());

drop policy if exists "placement_attempts_select_own_teacher" on public.placement_attempts;
create policy "placement_attempts_select_own_teacher"
  on public.placement_attempts for select
  using (public.is_teacher_of_student(student_id));

-- ----------------------------------------------------------------------------
-- سياسات placement_attempt_questions — نفس المبدأ: قراءة فقط، لا تعديل من
-- العميل إطلاقًا.
-- ----------------------------------------------------------------------------
drop policy if exists "placement_attempt_questions_select_own_student" on public.placement_attempt_questions;
create policy "placement_attempt_questions_select_own_student"
  on public.placement_attempt_questions for select
  using (public.is_owner_of_attempt(attempt_id));

drop policy if exists "placement_attempt_questions_select_own_teacher" on public.placement_attempt_questions;
create policy "placement_attempt_questions_select_own_teacher"
  on public.placement_attempt_questions for select
  using (public.is_teacher_of_attempt(attempt_id));

-- ----------------------------------------------------------------------------
-- سياسات lesson_completions — قراءة فقط للطالب صاحب السجل ومعلمته، ولا مسار
-- INSERT/UPDATE/DELETE من العميل إطلاقًا؛ الوحيد هو public.complete_lesson.
-- ----------------------------------------------------------------------------
drop policy if exists "lesson_completions_select_own_student" on public.lesson_completions;
create policy "lesson_completions_select_own_student"
  on public.lesson_completions for select
  using (student_id = auth.uid());

drop policy if exists "lesson_completions_select_own_teacher" on public.lesson_completions;
create policy "lesson_completions_select_own_teacher"
  on public.lesson_completions for select
  using (public.is_teacher_of_student(student_id));

-- ============================================================================
-- تحديث دالة منح الشارات (استبدال، وليس نظامًا جديدًا) — تبقى شرط المهام
-- القديم كما هو تمامًا (لا كسر لأي سلوك حالي)، وتُضاف شروط الدروس وتحديد
-- المستوى الجديدة إلى نفس المنطق الموحّد.
-- ============================================================================
create or replace function public.evaluate_and_award_badges(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tasks_completed integer;
  v_lessons_completed integer;
  v_placements_completed integer;
begin
  select count(*) into v_tasks_completed
  from public.task_assignments
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_lessons_completed
  from public.lesson_completions
  where student_id = target_student_id;

  select count(*) into v_placements_completed
  from public.placement_attempts
  where student_id = target_student_id and status = 'completed';

  insert into public.student_badges (student_id, badge_id)
  select target_student_id, b.id
  from public.badges b
  where (b.condition_type = 'tasks_completed_count' and v_tasks_completed >= b.condition_value)
     or (b.condition_type = 'lessons_completed_count' and v_lessons_completed >= b.condition_value)
     or (b.condition_type = 'placement_completed_count' and v_placements_completed >= b.condition_value)
  on conflict (student_id, badge_id) do nothing;
end;
$$;

-- ============================================================================
-- إكمال درس من «تعلّم» — نفس فلسفة complete_task_assignment تمامًا: نقاط
-- وشارات من جهة آمنة فقط. unique(student_id, lesson_id) + "if found" يمنعان
-- منح النقاط مرتين لنفس الدرس حتى مع تكرار الاستدعاء (مثلًا بسبب Refresh).
-- ============================================================================
create or replace function public.complete_lesson(p_lesson_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points constant integer := 5;
begin
  insert into public.lesson_completions (student_id, lesson_id, points_awarded)
  values (auth.uid(), p_lesson_id, v_points)
  on conflict (student_id, lesson_id) do nothing;

  if found then
    update public.students set stars = stars + v_points where id = auth.uid();
    perform public.evaluate_and_award_badges(auth.uid());
  end if;
end;
$$;

-- ============================================================================
-- بدء محاولة «اكتشف» جديدة — يختار سؤالًا واحدًا عشوائيًا من كل مهارة من
-- المهارات الثماني (يضمن التوزيع المطلوب)، ثم يكمل حتى 10 أسئلة بأسئلة
-- عشوائية إضافية دون تكرار، ويُنشئ صف المحاولة وأسئلتها ذريًا.
-- ============================================================================
-- دالة مساعدة صغيرة: ترتيب عشوائي لعناصر مصفوفة jsonb — تُستخدم لإعطاء كل
-- محاولة اختبار ترتيب خيارات مختلفًا، بدل أن تكون الإجابة الصحيحة دائمًا
-- الخيار الأول كما هي مخزّنة في بنك الأسئلة.
create or replace function public.shuffle_jsonb_array(arr jsonb)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(elem order by random()), arr)
  from jsonb_array_elements(arr) as elem;
$$;

create or replace function public.start_placement_attempt()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
  v_skills text[] := array['addition_no_carry','subtraction_no_borrow','rounding','doubling',
                            'ascending_order','descending_order','comparison','even_odd'];
  v_skill text;
  v_question_id uuid;
  v_options jsonb;
  v_order integer := 0;
  v_chosen uuid[] := '{}';
  v_extra record;
begin
  insert into public.placement_attempts (student_id, started_at, expires_at, total_questions)
  values (auth.uid(), now(), now() + interval '10 minutes', 10)
  returning id into v_attempt_id;

  foreach v_skill in array v_skills loop
    select id, options into v_question_id, v_options
    from public.placement_questions
    where skill = v_skill
    order by random()
    limit 1;

    if v_question_id is not null then
      v_order := v_order + 1;
      insert into public.placement_attempt_questions
        (attempt_id, question_id, skill, question_order, options_snapshot)
      values
        (v_attempt_id, v_question_id, v_skill, v_order, public.shuffle_jsonb_array(v_options));
      v_chosen := array_append(v_chosen, v_question_id);
    end if;
  end loop;

  for v_extra in
    select id, skill, options from public.placement_questions
    where not (id = any(v_chosen))
    order by random()
    limit greatest(0, 10 - v_order)
  loop
    v_order := v_order + 1;
    insert into public.placement_attempt_questions
      (attempt_id, question_id, skill, question_order, options_snapshot)
    values
      (v_attempt_id, v_extra.id, v_extra.skill, v_order, public.shuffle_jsonb_array(v_extra.options));
  end loop;

  update public.placement_attempts set total_questions = v_order where id = v_attempt_id;

  return v_attempt_id;
end;
$$;

-- ============================================================================
-- تسجيل إجابة سؤال واحد أثناء تأدية الاختبار. التحقق من انتهاء الوقت يتم هنا
-- من جهة آمنة (خادم قاعدة البيانات عبر expires_at المحفوظ وقت البدء)، وليس
-- بالاعتماد على مؤقت JavaScript فقط.
--
-- تُعيد true/false لصحة الإجابة فقط (لتغذية عدّاد ✓/✕ الحي في الواجهة)، دون
-- أن تكشف أبدًا نص الإجابة الصحيحة نفسه — عمود placement_questions.correct_
-- answer يبقى غير قابل للقراءة من العميل بصلاحيات الأعمدة أعلاه، وهذه الدالة
-- تقرأه داخليًا فقط بصفتها SECURITY DEFINER دون كشفه في أي مخرج.
-- ============================================================================
create or replace function public.record_placement_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_answer text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_expires_at timestamptz;
  v_status text;
  v_correct_answer text;
  v_is_correct boolean;
begin
  select student_id, expires_at, status into v_student_id, v_expires_at, v_status
  from public.placement_attempts where id = p_attempt_id;

  if v_student_id is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_student_id <> auth.uid() then
    raise exception 'غير مصرَّح';
  end if;
  if v_status = 'completed' then
    raise exception 'انتهت هذه المحاولة بالفعل';
  end if;
  if now() > v_expires_at then
    raise exception 'انتهى وقت الاختبار';
  end if;

  select correct_answer into v_correct_answer
  from public.placement_questions where id = p_question_id;

  v_is_correct := (v_correct_answer is not null and p_selected_answer = v_correct_answer);

  update public.placement_attempt_questions
  set selected_answer = p_selected_answer, is_correct = v_is_correct, answered_at = now()
  where attempt_id = p_attempt_id and question_id = p_question_id;

  return v_is_correct;
end;
$$;

-- ============================================================================
-- إنهاء محاولة «اكتشف» — يحتسب النتيجة فقط من الإجابات المسجَّلة فعليًا عبر
-- record_placement_answer أعلاه (وبالتالي ما بعد انتهاء الوقت لا يُحتسب إذ لم
-- يكن قد سُجِّل أصلًا)، يملأ الإجابة الصحيحة لكل سؤال الآن فقط (لغرض مراجعة
-- الأخطاء بعد الانتهاء)، يحسب النسبة والمستوى وتحليل المهارات الثماني ونقاط
-- القوة/الضعف والمهارة الموصى بها، يمنح النقاط عبر students.stars مرة واحدة
-- فقط (return مبكرة إن كانت المحاولة completed أصلًا — يحمي من تكرار النقاط
-- بسبب Refresh أو نقر مزدوج)، ثم يشغّل نظام الشارات الموجود دون أي تكرار له.
-- ============================================================================
create or replace function public.complete_placement_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_status text;
  v_total integer;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_unanswered integer := 0;
  v_percentage numeric;
  v_level text;
  v_points integer;
  v_weak text[] := '{}';
  v_strong text[] := '{}';
  v_recommended text;
  v_skill record;
begin
  select student_id, status, total_questions into v_student_id, v_status, v_total
  from public.placement_attempts where id = p_attempt_id;

  if v_student_id is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_student_id <> auth.uid() then
    raise exception 'غير مصرَّح';
  end if;
  if v_status = 'completed' then
    return; -- مكتملة مسبقًا: لا إعادة احتساب ولا تكرار للنقاط.
  end if;

  update public.placement_attempt_questions aq
  set correct_answer = q.correct_answer,
      is_correct = (aq.selected_answer is not null and aq.selected_answer = q.correct_answer)
  from public.placement_questions q
  where aq.attempt_id = p_attempt_id and aq.question_id = q.id;

  select
    count(*) filter (where is_correct),
    count(*) filter (where selected_answer is not null and not is_correct),
    count(*) filter (where selected_answer is null)
  into v_correct, v_wrong, v_unanswered
  from public.placement_attempt_questions
  where attempt_id = p_attempt_id;

  v_percentage := round((v_correct::numeric / greatest(v_total, 1)) * 100);
  v_level := case
    when v_percentage >= 85 then 'متقن'
    when v_percentage >= 70 then 'جيد'
    when v_percentage >= 50 then 'في طور التقدم'
    else 'يحتاج إلى تأسيس'
  end;
  v_points := v_correct;

  for v_skill in
    select skill,
           count(*) as total,
           count(*) filter (where is_correct) as correct
    from public.placement_attempt_questions
    where attempt_id = p_attempt_id
    group by skill
  loop
    if (v_skill.correct::numeric / v_skill.total) * 100 >= 85 then
      v_strong := array_append(v_strong, v_skill.skill);
    elsif (v_skill.correct::numeric / v_skill.total) * 100 < 50 then
      v_weak := array_append(v_weak, v_skill.skill);
    end if;
  end loop;

  if array_length(v_weak, 1) > 0 then
    v_recommended := v_weak[1];
  end if;

  update public.placement_attempts
  set completed_at = now(),
      status = 'completed',
      correct_answers = v_correct,
      wrong_answers = v_wrong,
      unanswered = v_unanswered,
      percentage = v_percentage,
      level = v_level,
      points_awarded = v_points,
      weak_skills = v_weak,
      strong_skills = v_strong,
      recommended_skill = v_recommended
  where id = p_attempt_id;

  if v_points > 0 then
    update public.students set stars = stars + v_points where id = v_student_id;
  end if;

  perform public.evaluate_and_award_badges(v_student_id);
end;
$$;

-- ============================================================================
-- إضافة لاحقة: «لوحة النجوم المرحة» (تعزيز الطلاب)
-- جدول مستقل تمامًا عن students.stars ونظام النقاط/الشارات الموجود — أداة
-- "نجوم مكافأة" حيّة تديرها المعلمة يدويًا أثناء الحصة (تشبه لوحة ملصقات
-- ورقية)، ولا تُحتسب ضمن نقاط الطالب الرسمية ولا تُفعِّل أي شارة. الأسماء
-- حرة (كما في الأداة الأصلية التي أرسلتها المعلمة) وليست مرتبطة إلزاميًا
-- بحساب طالب حقيقي، لإتاحة إضافة أي اسم أثناء الحصة بمرونة.
-- ============================================================================
create table if not exists public.star_board_entries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  display_name text not null,
  stars integer not null default 0 check (stars >= 0),
  created_at timestamptz not null default now()
);

-- لمن سبق وشغّلت النسخة الأولى من هذا الجدول: يضيف الربط بالطالب الحقيقي
-- بأمان دون التأثير على الصفوف القديمة (تبقى student_id فارغة لها).
alter table public.star_board_entries add column if not exists student_id uuid references public.students (id) on delete cascade;

-- طالب واحد = صف واحد فقط في لوحة كل صف (تمنع تكرار نفس الطالب في اللوحة).
drop index if exists star_board_entries_class_student_unique;
create unique index star_board_entries_class_student_unique
  on public.star_board_entries (class_id, student_id)
  where student_id is not null;

alter table public.star_board_entries enable row level security;

-- المعلمة تدير لوحة صفها هي فقط (قراءة/إضافة/تعديل/حذف).
drop policy if exists "star_board_select_own_teacher" on public.star_board_entries;
create policy "star_board_select_own_teacher"
  on public.star_board_entries for select
  using (public.is_teacher_of_class(class_id));

drop policy if exists "star_board_insert_own_teacher" on public.star_board_entries;
create policy "star_board_insert_own_teacher"
  on public.star_board_entries for insert
  with check (public.is_teacher_of_class(class_id));

drop policy if exists "star_board_update_own_teacher" on public.star_board_entries;
create policy "star_board_update_own_teacher"
  on public.star_board_entries for update
  using (public.is_teacher_of_class(class_id));

drop policy if exists "star_board_delete_own_teacher" on public.star_board_entries;
create policy "star_board_delete_own_teacher"
  on public.star_board_entries for delete
  using (public.is_teacher_of_class(class_id));

-- الطالب يرى فقط سطره الخاص هو (نجومه هو فقط) — وليس بقية لوحة الصف.
drop policy if exists "star_board_select_own_student" on public.star_board_entries;
create policy "star_board_select_own_student"
  on public.star_board_entries for select
  using (student_id = auth.uid());


-- PHASE2-BEGIN ================================================================
-- ============================================================================
-- المرحلة الثانية — «اختبر» على الخادم + إضافة النجوم الآمنة + تحصين «اكتشف»
--
-- هذا القسم مكتوب بحيث يمكن تشغيله أكثر من مرة دون ضرر (create ... if not exists /
-- create or replace / on conflict do nothing). وهو موجود أيضًا في نهاية
-- schema.sql بنص مطابق تمامًا — شغّلي أحدهما فقط: إمّا schema.sql كاملًا، أو هذا
-- الملف وحده على قاعدة بيانات تعمل فيها المرحلة الأولى بالفعل.
--
-- الفلسفة: نفس نظام «اكتشف» تمامًا — الأسئلة والإجابات الصحيحة والنتيجة والنجوم
-- والشارات كلها تُحسب في قاعدة البيانات عبر دوال SECURITY DEFINER، ولا يستطيع
-- المتصفح أن يكتب نتيجة أو يقرأ الإجابة الصحيحة قبل أن تجيب الطالبة.
-- الفرق الوحيد: أسئلة «اختبر» تُولَّد بأرقام جديدة في كل محاولة بدل بنك ثابت.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) تحصين «اكتشف»: record_placement_answer كانت تسمح بأمرين لا يجوز أن
--     يحدثا في اختبار:
--       أ) إعادة الإجابة على نفس السؤال مرات (تجريب كل الخيارات حتى تُرجع true)،
--       ب) سؤال أي رقم سؤال من البنك — حتى لو لم يكن في المحاولة — ومعرفة هل
--          الخيار صحيح، فيمكن استخراج الإجابات الصحيحة كلها للبنك الثابت.
--     الآن: السؤال يجب أن ينتمي لهذه المحاولة، وتُقبل إجابة واحدة فقط لكل سؤال
--     (النداء المكرر يُرجع نتيجة الإجابة الأولى نفسها دون تغيير).
-- ----------------------------------------------------------------------------
create or replace function public.record_placement_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_answer text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_expires_at timestamptz;
  v_status text;
  v_correct_answer text;
  v_is_correct boolean;
  v_prev_answer text;
  v_prev_correct boolean;
begin
  select student_id, expires_at, status into v_student_id, v_expires_at, v_status
  from public.placement_attempts where id = p_attempt_id;

  if v_student_id is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_student_id <> auth.uid() then
    raise exception 'غير مصرَّح';
  end if;
  if v_status = 'completed' then
    raise exception 'انتهت هذه المحاولة بالفعل';
  end if;
  if now() > v_expires_at then
    raise exception 'انتهى وقت الاختبار';
  end if;

  select selected_answer, is_correct into v_prev_answer, v_prev_correct
  from public.placement_attempt_questions
  where attempt_id = p_attempt_id and question_id = p_question_id;

  if not found then
    raise exception 'السؤال غير موجود في هذه المحاولة';
  end if;
  if v_prev_answer is not null then
    return coalesce(v_prev_correct, false);
  end if;

  select correct_answer into v_correct_answer
  from public.placement_questions where id = p_question_id;

  v_is_correct := (v_correct_answer is not null and p_selected_answer = v_correct_answer);

  update public.placement_attempt_questions
  set selected_answer = p_selected_answer, is_correct = v_is_correct, answered_at = now()
  where attempt_id = p_attempt_id and question_id = p_question_id;

  return v_is_correct;
end;
$$;


-- ----------------------------------------------------------------------------
-- (2) جداول «اختبر»
--     quiz_attempts: محاولة واحدة لطالبة. quiz_attempt_questions: أسئلتها الفعلية.
--     العمود answer_key (الإجابة الصحيحة) محجوب عن المتصفح تمامًا بصلاحيات
--     الأعمدة أدناه؛ لا يظهر شيء منه إلا في العمود correct_answer، وبعد إجابة
--     الطالبة على ذلك السؤال فقط (أو عند إنهاء المحاولة).
--     ⚠️ لأن الصلاحيات على مستوى الأعمدة: لا تستعملي select("*") على
--     quiz_attempt_questions من الواجهة — اذكري الأعمدة صراحةً.
-- ----------------------------------------------------------------------------
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- مهلة أمان طويلة (٣ ساعات) لا تظهر للطالبة: تمنع بقاء محاولة مفتوحة إلى الأبد.
  expires_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  total_questions integer not null default 10,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  unanswered integer not null default 0,
  percentage numeric,
  level text,
  points_awarded integer not null default 0,
  best_streak integer not null default 0,
  weak_skills text[] not null default '{}',
  strong_skills text[] not null default '{}'
);

create index if not exists quiz_attempts_student_idx
  on public.quiz_attempts (student_id, status, completed_at desc);

create table if not exists public.quiz_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  skill text not null check (skill in (
    'addition_no_carry', 'subtraction_no_borrow', 'rounding', 'doubling',
    'ascending_order', 'descending_order', 'comparison', 'even_odd'
  )),
  question_order integer not null,
  prompt text not null,
  visual jsonb not null,
  question_text text not null,
  options jsonb not null,
  answer_key text not null,
  selected_answer text,
  correct_answer text,
  is_correct boolean,
  answered_at timestamptz,
  unique (attempt_id, question_order)
);

alter table public.quiz_attempts          enable row level security;
alter table public.quiz_attempt_questions enable row level security;

-- دالتان مساعدتان (SECURITY DEFINER) بنفس أسلوب is_owner_of_attempt / is_teacher_of_attempt.
create or replace function public.is_owner_of_quiz_attempt(target_attempt_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.quiz_attempts a
    where a.id = target_attempt_id and a.student_id = auth.uid()
  );
$$;

create or replace function public.is_teacher_of_quiz_attempt(target_attempt_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.quiz_attempts a
    where a.id = target_attempt_id and public.is_teacher_of_student(a.student_id)
  );
$$;

-- قراءة فقط: الطالبة ترى محاولاتها، والمعلمة ترى محاولات طالباتها. لا INSERT/UPDATE/DELETE
-- من العميل إطلاقًا — الدوال الآمنة أدناه هي المسار الوحيد.
drop policy if exists "quiz_attempts_select_own_student" on public.quiz_attempts;
create policy "quiz_attempts_select_own_student"
  on public.quiz_attempts for select
  using (student_id = auth.uid());

drop policy if exists "quiz_attempts_select_own_teacher" on public.quiz_attempts;
create policy "quiz_attempts_select_own_teacher"
  on public.quiz_attempts for select
  using (public.is_teacher_of_student(student_id));

drop policy if exists "quiz_attempt_questions_select_own_student" on public.quiz_attempt_questions;
create policy "quiz_attempt_questions_select_own_student"
  on public.quiz_attempt_questions for select
  using (public.is_owner_of_quiz_attempt(attempt_id));

drop policy if exists "quiz_attempt_questions_select_own_teacher" on public.quiz_attempt_questions;
create policy "quiz_attempt_questions_select_own_teacher"
  on public.quiz_attempt_questions for select
  using (public.is_teacher_of_quiz_attempt(attempt_id));

revoke all on public.quiz_attempts from anon, authenticated;
grant select on public.quiz_attempts to authenticated;

-- كل الأعمدة قابلة للقراءة ما عدا answer_key.
revoke all on public.quiz_attempt_questions from anon, authenticated;
grant select (
  id, attempt_id, skill, question_order, prompt, visual, question_text, options,
  selected_answer, correct_answer, is_correct, answered_at
) on public.quiz_attempt_questions to authenticated;


-- ----------------------------------------------------------------------------
-- (3) مولّد الأسئلة (داخلي — لا يُستدعى من المتصفح إطلاقًا)
--     نفس المهارات الثماني ونفس مستوى «اكتشف»، وبلا رفع في الجمع ولا استلاف في
--     الطرح: نختار الآحاد والعشرات كلًّا على حدة بحيث يبقى مجموع كل خانة ≤ ٩ في
--     الجمع، وتبقى كل خانة في المطروح منه ≥ نظيرتها في المطروح.
--     ⚠️ هذه الدوال تُرجع الإجابة الصحيحة، لذلك تُسحب عنها صلاحية التنفيذ من
--     كل الأدوار أدناه؛ تستدعيها start_quiz_attempt فقط (SECURITY DEFINER).
-- ----------------------------------------------------------------------------
create or replace function public.quiz_rand_int(p_min integer, p_max integer)
returns integer
language sql
volatile
as $$
  select p_min + floor(random() * (p_max - p_min + 1))::integer;
$$;

create or replace function public.quiz_shuffle_ints(p_values integer[])
returns integer[]
language sql
volatile
as $$
  select coalesce(array_agg(v order by random()), '{}'::integer[])
  from unnest(p_values) as v;
$$;

-- أربعة خيارات عددية: الصحيح + أول ثلاثة مرشّحين موجبين ومختلفين، ثم تكملة بأعداد
-- قريبة إن لزم، بترتيب عشوائي.
create or replace function public.quiz_numeric_options(p_correct integer, p_candidates integer[])
returns jsonb
language plpgsql
volatile
as $$
declare
  v_chosen integer[] := array[p_correct];
  v_c integer;
  v_step integer := 1;
begin
  if p_candidates is not null then
    foreach v_c in array p_candidates loop
      exit when array_length(v_chosen, 1) >= 4;
      if v_c > 0 and not (v_c = any(v_chosen)) then
        v_chosen := array_append(v_chosen, v_c);
      end if;
    end loop;
  end if;

  while array_length(v_chosen, 1) < 4 loop
    if array_length(v_chosen, 1) < 4
       and (p_correct + v_step) > 0
       and not ((p_correct + v_step) = any(v_chosen)) then
      v_chosen := array_append(v_chosen, p_correct + v_step);
    end if;
    if array_length(v_chosen, 1) < 4
       and (p_correct - v_step) > 0
       and not ((p_correct - v_step) = any(v_chosen)) then
      v_chosen := array_append(v_chosen, p_correct - v_step);
    end if;
    v_step := v_step + 1;
  end loop;

  return (
    select jsonb_agg(to_jsonb(v::text) order by random())
    from unnest(v_chosen) as v
  );
end;
$$;

create or replace function public.quiz_options_from_texts(p_values text[])
returns jsonb
language sql
volatile
as $$
  select jsonb_agg(to_jsonb(v) order by random()) from unnest(p_values) as v;
$$;

create or replace function public.quiz_expression_visual(p_a integer, p_symbol text, p_b integer)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'kind', 'expression',
    'tokens', jsonb_build_array(
      jsonb_build_object('kind', 'num', 'value', p_a),
      jsonb_build_object('kind', 'op', 'symbol', p_symbol),
      jsonb_build_object('kind', 'num', 'value', p_b),
      jsonb_build_object('kind', 'op', 'symbol', '='),
      jsonb_build_object('kind', 'blank')
    )
  );
$$;

create or replace function public.quiz_make_question(
  p_skill text,
  out o_prompt text,
  out o_visual jsonb,
  out o_text text,
  out o_options jsonb,
  out o_answer text
)
language plpgsql
volatile
as $$
declare
  v_a integer;
  v_b integer;
  v_ans integer;
  v_t1 integer;
  v_t2 integer;
  v_u1 integer;
  v_u2 integer;
  v_n integer;
  v_down integer;
  v_up integer;
  v_correct integer;
  v_other integer;
  v_shown integer[];
  v_asc integer[];
  v_desc integer[];
  v_target integer[];
  v_variants text[];
  v_roll double precision;
  v_is_even boolean;
  v_sign text;
begin
  if p_skill = 'addition_no_carry' then
    -- عشرات: t1 + t2 ≤ ٩ ، آحاد: u1 + u2 ≤ ٩  => لا رفع أبدًا.
    v_t1 := public.quiz_rand_int(1, 7);
    v_t2 := public.quiz_rand_int(1, 9 - v_t1);
    v_u1 := public.quiz_rand_int(1, 8);
    v_u2 := public.quiz_rand_int(1, 9 - v_u1);
    v_a := v_t1 * 10 + v_u1;
    v_b := v_t2 * 10 + v_u2;
    v_ans := v_a + v_b;
    o_prompt := 'أوجد ناتج الجمع التالي';
    o_visual := public.quiz_expression_visual(v_a, '+', v_b);
    o_text := 'أوجد ناتج الجمع التالي: ' || v_a::text || ' + ' || v_b::text || ' = ؟';
    o_options := public.quiz_numeric_options(
      v_ans, public.quiz_shuffle_ints(array[v_ans - 10, v_ans + 10, v_ans - 1, v_ans + 1])
    );
    o_answer := v_ans::text;

  elsif p_skill = 'subtraction_no_borrow' then
    -- كل خانة في المطروح منه أكبر من نظيرتها في المطروح => لا استلاف أبدًا.
    v_t1 := public.quiz_rand_int(3, 9);
    v_t2 := public.quiz_rand_int(1, v_t1 - 1);
    v_u1 := public.quiz_rand_int(2, 9);
    v_u2 := public.quiz_rand_int(1, v_u1 - 1);
    v_a := v_t1 * 10 + v_u1;
    v_b := v_t2 * 10 + v_u2;
    v_ans := v_a - v_b;
    o_prompt := 'أوجد ناتج الطرح التالي';
    o_visual := public.quiz_expression_visual(v_a, '−', v_b);
    o_text := 'أوجد ناتج الطرح التالي: ' || v_a::text || ' - ' || v_b::text || ' = ؟';
    o_options := public.quiz_numeric_options(
      v_ans, public.quiz_shuffle_ints(array[v_ans - 10, v_ans + 10, v_ans - 1, v_ans + 1])
    );
    o_answer := v_ans::text;

  elsif p_skill = 'rounding' then
    v_n := public.quiz_rand_int(21, 98);
    while v_n % 10 = 0 loop
      v_n := public.quiz_rand_int(21, 98);
    end loop;
    v_down := (v_n / 10) * 10;
    v_up := v_down + 10;
    if v_n - v_down >= 5 then
      v_correct := v_up;
      v_other := v_down;
    else
      v_correct := v_down;
      v_other := v_up;
    end if;
    o_prompt := 'قرّب العدد إلى أقرب عشرة';
    o_visual := jsonb_build_object('kind', 'number', 'value', v_n);
    o_text := 'قرّب العدد ' || v_n::text || ' لأقرب عشرة.';
    -- أخطاء شائعة: التقريب للاتجاه الآخر، أو ترك العدد كما هو.
    o_options := public.quiz_numeric_options(
      v_correct,
      array[v_other, v_n, v_correct + case when random() < 0.5 then -10 else 10 end]
    );
    o_answer := v_correct::text;

  elsif p_skill = 'doubling' then
    v_n := public.quiz_rand_int(6, 15);
    v_correct := v_n * 2;
    o_prompt := 'أوجد ضعف العدد';
    o_visual := jsonb_build_object('kind', 'number', 'value', v_n);
    o_text := 'ضعف العدد ' || v_n::text || ' = ؟';
    o_options := public.quiz_numeric_options(v_correct, array[v_correct - 2, v_correct + 2, v_n * 3]);
    o_answer := v_correct::text;

  elsif p_skill in ('ascending_order', 'descending_order') then
    -- أربعة أعداد مختلفة من ١ إلى ٣٠ لا تأتي مرتبة أصلًا (لا تصاعديًا ولا تنازليًا).
    loop
      select array_agg(x order by rn) into v_shown
      from (
        select x, row_number() over (order by random()) as rn
        from generate_series(1, 30) as x
      ) s
      where rn <= 4;
      select array_agg(x order by x) into v_asc from unnest(v_shown) as x;
      select array_agg(x order by x desc) into v_desc from unnest(v_shown) as x;
      exit when v_shown <> v_asc and v_shown <> v_desc;
    end loop;

    if p_skill = 'ascending_order' then
      v_target := v_asc;
    else
      v_target := v_desc;
    end if;

    -- الترتيب الصحيح + عكسه + تبديل أول عنصرين + تبديل الأوسطين (كلها مختلفة).
    v_variants := array[
      array_to_string(v_target, ', '),
      array_to_string(array[v_target[4], v_target[3], v_target[2], v_target[1]], ', '),
      array_to_string(array[v_target[2], v_target[1], v_target[3], v_target[4]], ', '),
      array_to_string(array[v_target[1], v_target[3], v_target[2], v_target[4]], ', ')
    ];
    o_prompt := case when p_skill = 'ascending_order' then 'رتّب الأعداد تصاعديًا' else 'رتّب الأعداد تنازليًا' end;
    o_visual := jsonb_build_object('kind', 'chips', 'numbers', to_jsonb(v_shown));
    o_text := (case when p_skill = 'ascending_order'
                    then 'رتّب الأعداد التالية تصاعديًا: '
                    else 'رتّب الأعداد التالية تنازليًا: ' end)
              || array_to_string(v_shown, ', ');
    o_options := public.quiz_options_from_texts(v_variants);
    o_answer := v_variants[1];

  elsif p_skill = 'comparison' then
    v_roll := random();
    v_a := public.quiz_rand_int(10, 99);
    v_b := public.quiz_rand_int(10, 99);
    if v_roll < 0.35 then
      -- أرقام معكوسة (٤٥ و٥٤): خانتان مختلفتان فقط تعطيان عددين مختلفين.
      v_t1 := public.quiz_rand_int(1, 9);
      v_u1 := public.quiz_rand_int(1, 9);
      while v_u1 = v_t1 loop
        v_u1 := public.quiz_rand_int(1, 9);
      end loop;
      v_a := v_t1 * 10 + v_u1;
      v_b := v_u1 * 10 + v_t1;
    elsif v_roll < 0.55 then
      v_b := v_a;
    else
      while v_b = v_a loop
        v_b := public.quiz_rand_int(10, 99);
      end loop;
    end if;
    if v_a < v_b then
      v_sign := '<';
    elsif v_a > v_b then
      v_sign := '>';
    else
      v_sign := '=';
    end if;
    o_prompt := 'أي علامة تجعل المقارنة صحيحة؟';
    o_visual := jsonb_build_object('kind', 'compare', 'first', v_a, 'second', v_b);
    o_text := 'أي العلامات تجعل المقارنة صحيحة؟ ' || v_a::text || ' ⬜ ' || v_b::text;
    o_options := public.quiz_options_from_texts(array['<', '>', '=', 'لا يمكن المقارنة']);
    o_answer := v_sign;

  elsif p_skill = 'even_odd' then
    v_is_even := random() < 0.5;
    v_n := public.quiz_rand_int(5, 49) * 2 + case when v_is_even then 0 else 1 end;
    o_prompt := 'هذا العدد هو عدد؟';
    o_visual := jsonb_build_object('kind', 'number', 'value', v_n);
    o_text := 'العدد ' || v_n::text || ' هو عدد؟';
    o_options := public.quiz_options_from_texts(array['زوجي', 'فردي']);
    o_answer := case when v_is_even then 'زوجي' else 'فردي' end;

  else
    raise exception 'مهارة غير معروفة: %', p_skill;
  end if;
end;
$$;

-- الدوال الداخلية لا يستدعيها المتصفح أبدًا (تكشف الإجابة الصحيحة).
revoke all on function public.quiz_rand_int(integer, integer) from public, anon, authenticated;
revoke all on function public.quiz_shuffle_ints(integer[]) from public, anon, authenticated;
revoke all on function public.quiz_numeric_options(integer, integer[]) from public, anon, authenticated;
revoke all on function public.quiz_options_from_texts(text[]) from public, anon, authenticated;
revoke all on function public.quiz_expression_visual(integer, text, integer) from public, anon, authenticated;
revoke all on function public.quiz_make_question(text) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- (4) بدء محاولة «اختبر»
--     • إن كان لدى الطالبة محاولة مفتوحة لم تنتهِ مهلتها تُستأنف (يتحمّل Refresh).
--     • المحاولات المفتوحة المنتهية المهلة تُغلق أولًا من إجاباتها المسجّلة.
--     • عشرة أسئلة: واحد من كل مهارة من الثماني بنفس ترتيب «اكتشف»، ثم سؤالان
--       إضافيان من مهارتين مختلفتين، ولا يتكرر نص سؤال داخل المحاولة.
-- ----------------------------------------------------------------------------
create or replace function public.start_quiz_attempt()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_existing uuid;
  v_stale record;
  v_attempt_id uuid;
  v_skills text[] := array[
    'addition_no_carry', 'subtraction_no_borrow', 'rounding', 'doubling',
    'ascending_order', 'descending_order', 'comparison', 'even_odd'
  ];
  v_extra text[];
  v_skill text;
  v_q record;
  v_used text[] := '{}';
  v_order integer := 0;
  v_tries integer;
begin
  if v_student is null or not exists (select 1 from public.students where id = v_student) then
    raise exception 'هذه الميزة للطالبات فقط';
  end if;

  select id into v_existing
  from public.quiz_attempts
  where student_id = v_student and status = 'in_progress' and expires_at > now()
  order by started_at desc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  for v_stale in
    select id from public.quiz_attempts
    where student_id = v_student and status = 'in_progress'
  loop
    perform public.complete_quiz_attempt(v_stale.id);
  end loop;

  insert into public.quiz_attempts (student_id, started_at, expires_at, total_questions)
  values (v_student, now(), now() + interval '3 hours', 10)
  returning id into v_attempt_id;

  select array_agg(s) into v_extra
  from (select s from unnest(v_skills) as s order by random() limit 2) t;

  foreach v_skill in array (v_skills || v_extra) loop
    v_tries := 0;
    loop
      select * into v_q from public.quiz_make_question(v_skill);
      exit when not (v_q.o_text = any(v_used)) or v_tries >= 30;
      v_tries := v_tries + 1;
    end loop;

    v_used := array_append(v_used, v_q.o_text);
    v_order := v_order + 1;

    insert into public.quiz_attempt_questions
      (attempt_id, skill, question_order, prompt, visual, question_text, options, answer_key)
    values
      (v_attempt_id, v_skill, v_order, v_q.o_prompt, v_q.o_visual, v_q.o_text, v_q.o_options, v_q.o_answer);
  end loop;

  update public.quiz_attempts set total_questions = v_order where id = v_attempt_id;

  return v_attempt_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- (5) تسجيل إجابة سؤال واحد
--     • السؤال يجب أن ينتمي لهذه المحاولة، وتُقبل إجابة واحدة فقط لكل سؤال
--       (النداء المكرر يُرجع النتيجة الأولى دون تغيير) — فلا يمكن تجريب الخيارات.
--     • الإجابة يجب أن تكون أحد خيارات السؤال.
--     • تُرجع صحة الإجابة والإجابة الصحيحة (بعد أن أُغلق باب تغيير الإجابة)، لتعرضها
--       الواجهة فورًا للتعلّم، وتُخزَّن في correct_answer لتظهر عند الاستئناف.
-- ----------------------------------------------------------------------------
create or replace function public.record_quiz_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_answer text
)
returns table (was_correct boolean, right_answer text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_q public.quiz_attempt_questions%rowtype;
  v_ok boolean;
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id;
  if not found then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_attempt.student_id <> auth.uid() then
    raise exception 'غير مصرَّح';
  end if;
  if v_attempt.status = 'completed' then
    raise exception 'انتهت هذه المحاولة بالفعل';
  end if;
  if now() > v_attempt.expires_at then
    raise exception 'انتهت مهلة الاختبار';
  end if;

  select * into v_q
  from public.quiz_attempt_questions
  where id = p_question_id and attempt_id = p_attempt_id
  for update;
  if not found then
    raise exception 'السؤال غير موجود في هذه المحاولة';
  end if;

  if v_q.selected_answer is not null then
    was_correct := coalesce(v_q.is_correct, false);
    right_answer := v_q.correct_answer;
    return next;
    return;
  end if;

  if not (v_q.options ? p_selected_answer) then
    raise exception 'إجابة غير صالحة';
  end if;

  v_ok := (p_selected_answer = v_q.answer_key);

  update public.quiz_attempt_questions
  set selected_answer = p_selected_answer,
      is_correct = v_ok,
      correct_answer = v_q.answer_key,
      answered_at = now()
  where id = p_question_id;

  was_correct := v_ok;
  right_answer := v_q.answer_key;
  return next;
  return;
end;
$$;


-- ----------------------------------------------------------------------------
-- (6) إنهاء محاولة «اختبر»
--     نفس منطق complete_placement_attempt: النتيجة من الإجابات المسجَّلة فقط، نفس
--     حدود المستويات (٨٥ / ٧٠ / ٥٠) ونفس تحليل المهارات، ثم النجوم والشارات.
--     النجوم = عدد الإجابات الصحيحة، لكن لأول محاولة مكتملة في اليوم فقط
--     (بتوقيت مسقط) حتى لا تتحول إعادة الاختبار إلى تجميع نجوم بلا نهاية.
--     غيّري v_daily_star_attempts لتغيير الحد؛ النتيجة تُسجَّل دائمًا مهما كان الحد.
--     نداء ثانٍ على محاولة مكتملة لا يفعل شيئًا (يحمي من Refresh أو النقر المزدوج).
-- ----------------------------------------------------------------------------
create or replace function public.complete_quiz_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_star_attempts constant integer := 1;
  v_student_id uuid;
  v_status text;
  v_total integer;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_unanswered integer := 0;
  v_percentage numeric;
  v_level text;
  v_points integer;
  v_done_today integer;
  v_weak text[] := '{}';
  v_strong text[] := '{}';
  v_skill record;
  v_row record;
  v_run integer := 0;
  v_best integer := 0;
begin
  select student_id, status, total_questions into v_student_id, v_status, v_total
  from public.quiz_attempts where id = p_attempt_id;

  if v_student_id is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_student_id <> auth.uid() then
    raise exception 'غير مصرَّح';
  end if;
  if v_status = 'completed' then
    return;
  end if;

  update public.quiz_attempt_questions
  set correct_answer = answer_key,
      is_correct = coalesce(is_correct, false)
  where attempt_id = p_attempt_id;

  select
    count(*) filter (where is_correct),
    count(*) filter (where selected_answer is not null and not is_correct),
    count(*) filter (where selected_answer is null)
  into v_correct, v_wrong, v_unanswered
  from public.quiz_attempt_questions
  where attempt_id = p_attempt_id;

  v_percentage := round((v_correct::numeric / greatest(v_total, 1)) * 100);
  v_level := case
    when v_percentage >= 85 then 'متقن'
    when v_percentage >= 70 then 'جيد'
    when v_percentage >= 50 then 'في طور التقدم'
    else 'يحتاج إلى تأسيس'
  end;

  for v_skill in
    select skill, count(*) as total, count(*) filter (where is_correct) as correct
    from public.quiz_attempt_questions
    where attempt_id = p_attempt_id
    group by skill
  loop
    if (v_skill.correct::numeric / v_skill.total) * 100 >= 85 then
      v_strong := array_append(v_strong, v_skill.skill);
    elsif (v_skill.correct::numeric / v_skill.total) * 100 < 50 then
      v_weak := array_append(v_weak, v_skill.skill);
    end if;
  end loop;

  -- أطول سلسلة إجابات صحيحة متتالية (بترتيب الأسئلة).
  for v_row in
    select is_correct from public.quiz_attempt_questions
    where attempt_id = p_attempt_id
    order by question_order
  loop
    if v_row.is_correct then
      v_run := v_run + 1;
      v_best := greatest(v_best, v_run);
    else
      v_run := 0;
    end if;
  end loop;

  select count(*) into v_done_today
  from public.quiz_attempts
  where student_id = v_student_id
    and status = 'completed'
    and id <> p_attempt_id
    and (completed_at at time zone 'Asia/Muscat')::date = (now() at time zone 'Asia/Muscat')::date;

  v_points := case when v_done_today < v_daily_star_attempts then v_correct else 0 end;

  update public.quiz_attempts
  set completed_at = now(),
      status = 'completed',
      correct_answers = v_correct,
      wrong_answers = v_wrong,
      unanswered = v_unanswered,
      percentage = v_percentage,
      level = v_level,
      points_awarded = v_points,
      best_streak = v_best,
      weak_skills = v_weak,
      strong_skills = v_strong
  where id = p_attempt_id;

  if v_points > 0 then
    update public.students set stars = stars + v_points where id = v_student_id;
  end if;

  perform public.evaluate_and_award_badges(v_student_id);
end;
$$;

grant execute on function public.start_quiz_attempt() to authenticated;
grant execute on function public.record_quiz_answer(uuid, uuid, text) to authenticated;
grant execute on function public.complete_quiz_attempt(uuid) to authenticated;
revoke execute on function public.start_quiz_attempt() from public, anon;
revoke execute on function public.record_quiz_answer(uuid, uuid, text) from public, anon;
revoke execute on function public.complete_quiz_attempt(uuid) from public, anon;


-- ----------------------------------------------------------------------------
-- (7) شارتان جديدتان في نفس كتالوج الشارات + توسيع evaluate_and_award_badges
--     (النسخة الأخيرة من الدالة مع شرطين جديدين؛ الشروط القديمة كما هي).
-- ----------------------------------------------------------------------------
create or replace function public.evaluate_and_award_badges(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tasks_completed integer;
  v_lessons_completed integer;
  v_placements_completed integer;
  v_quiz_completed integer;
  v_quiz_perfect integer;
begin
  select count(*) into v_tasks_completed
  from public.task_assignments
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_lessons_completed
  from public.lesson_completions
  where student_id = target_student_id;

  select count(*) into v_placements_completed
  from public.placement_attempts
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_quiz_completed
  from public.quiz_attempts
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_quiz_perfect
  from public.quiz_attempts
  where student_id = target_student_id and status = 'completed'
    and total_questions > 0 and correct_answers = total_questions;

  insert into public.student_badges (student_id, badge_id)
  select target_student_id, b.id
  from public.badges b
  where (b.condition_type = 'tasks_completed_count' and v_tasks_completed >= b.condition_value)
     or (b.condition_type = 'lessons_completed_count' and v_lessons_completed >= b.condition_value)
     or (b.condition_type = 'placement_completed_count' and v_placements_completed >= b.condition_value)
     or (b.condition_type = 'quiz_completed_count' and v_quiz_completed >= b.condition_value)
     or (b.condition_type = 'quiz_perfect_count' and v_quiz_perfect >= b.condition_value)
  on conflict (student_id, badge_id) do nothing;
end;
$$;

insert into public.badges (code, name, description, condition_type, condition_value) values
  ('quiz_starter', 'بنّاءة البرج', 'يُمنح عند إكمال أول اختبار في «اختبر»', 'quiz_completed_count', 1),
  ('quiz_perfect', 'برج كامل', 'يُمنح عند الحصول على العلامة الكاملة في «اختبر»', 'quiz_perfect_count', 1)
on conflict (code) do nothing;


-- ----------------------------------------------------------------------------
-- (8) لوحة النجوم المرحة: تعديل النجوم بشكل ذرّي.
--     الواجهة كانت تحسب الرقم الجديد في المتصفح ثم تكتبه (last write wins)، فإذا
--     نقرت المعلمة بسرعة أو فتحت اللوحة على جهازين قد تضيع نجمة. الدالة الآن تزيد
--     أو تُنقص داخل قاعدة البيانات في خطوة واحدة (لا تنزل تحت الصفر) وتُرجع الرقم
--     الحقيقي. تعمل بصلاحيات المستدعية نفسها (SECURITY INVOKER)، فسياسة
--     star_board_update_own_teacher هي التي تضمن أن المعلمة تعدّل لوحة صفها فقط.
-- ----------------------------------------------------------------------------
create or replace function public.adjust_star_board_stars(p_entry_id uuid, p_delta integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new integer;
begin
  if p_delta is null or p_delta = 0 or p_delta < -100 or p_delta > 100 then
    raise exception 'قيمة غير صالحة';
  end if;

  update public.star_board_entries
  set stars = greatest(0, stars + p_delta)
  where id = p_entry_id
  returning stars into v_new;

  if not found then
    raise exception 'السجل غير موجود أو غير مصرَّح';
  end if;

  return v_new;
end;
$$;

grant execute on function public.adjust_star_board_stars(uuid, integer) to authenticated;
revoke execute on function public.adjust_star_board_stars(uuid, integer) from public, anon;
-- PHASE2-END ==================================================================


-- PHASE3-BEGIN ================================================================
-- ============================================================================
-- المرحلة الثالثة — ألعاب قسم «ألعب» (الجمع، الطرح، التقريب، الضعف)
-- يتضمن هذا الملف أيضًا (منذ التعديل الثاني) توسيع بنك الأسئلة ليشمل التقريب
-- والضعف، وتغيير نظام المكافأة إلى «مرة واحدة طوال العمر» بدل «يوميًا». إن كنتِ
-- شغّلتِ نسخة أقدم من هذا الملف سابقًا فتشغيله مرة أخرى آمن ويُحدِّث كل شيء
-- تلقائيًا (ALTER/CREATE OR REPLACE، بلا حذف بيانات).
--
-- آمن للتشغيل أكثر من مرة، ولا يحذف ولا يعدّل أي بيانات موجودة. موجود أيضًا في
-- نهاية schema.sql بنص مطابق — شغّلي أحد أمرين فقط:
--   • schema.sql كاملًا،  أو
--   • هذا الملف ثم supabase/game_bank.sql (بهذا الترتيب) على قاعدة تعمل فيها
--     المرحلتان السابقتان.
--
-- (يعيد استخدام public.shuffle_jsonb_array المعرَّفة في قسم «اكتشف» أعلى schema.sql؛
-- إن شغّلتِ هذا الملف وحده فلا بد أن تكون المرحلة الأولى قد نُفِّذت مسبقًا، وهو
-- شرط أصلي هنا بما أن الجداول أدناه تشير إلى public.students و public.is_teacher_of_student.)
--
-- نفس فلسفة «اكتشف» و«اختبر»: المحاولة والإجابات والنتيجة كلها في قاعدة البيانات
-- عبر دوال SECURITY DEFINER، ولا يستطيع المتصفح كتابة نتيجة ولا قراءة الإجابة
-- الصحيحة قبل أن تجيب الطالبة. الجداول الجديدة مستقلة تمامًا عن «اختبر»
-- و«اكتشف» ولا تلمسهما، ولا تلمس لوحة النجوم المرحة.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) كتالوج الألعاب — صف لكل لعبة. إضافة لعبة لاحقًا = صف جديد هنا + بنك أسئلتها.
--     المكافأة لكل لعبة مستقلة عن غيرها:
--       reward_enabled         هل تُمنح نجوم في هذه اللعبة؟
--       reward_min_percentage  أقل نسبة نجاح للحصول على أي نجوم (٠ = بلا حد أدنى)
--     وتُمنح **مرة واحدة فقط طوال عمر الطالبة في هذه اللعبة** — أول محاولة
--     مكتملة فقط، مهما كانت نتيجتها؛ أي محاولة ثانية أو ثالثة لا تمنح نجومًا
--     أبدًا حتى لو كانت النتيجة أفضل (بخلاف «اختبر» الذي يمنح نجومًا يوميًا).
--     عدد النجوم = عدد الإجابات الصحيحة في تلك المحاولة الأولى (من ٠ إلى ١٠).
--     لتعطيل لعبة لاحقًا: update public.play_games set reward_enabled = false
--     where id = 'addition';
-- ----------------------------------------------------------------------------
create table if not exists public.play_games (
  id text primary key,
  title text not null,
  skill text not null,
  reward_enabled boolean not null default true,
  reward_min_percentage integer not null default 0 check (reward_min_percentage between 0 and 100),
  enabled boolean not null default true
);

-- ترقية جدول أُنشئ بنسخة سابقة من هذا الملف (كانت المكافأة عمودًا رقميًا
-- reward_stars يُحسب يوميًا) إلى النظام الجديد أعلاه — آمن التكرار.
alter table public.play_games add column if not exists reward_enabled boolean not null default true;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'play_games' and column_name = 'reward_stars'
  ) then
    update public.play_games set reward_enabled = (reward_stars > 0);
    alter table public.play_games drop column reward_stars;
  end if;
end $$;
alter table public.play_games alter column reward_min_percentage set default 0;

insert into public.play_games (id, title, skill) values
  ('addition', 'مغامرة الجمع', 'addition_no_carry'),
  ('subtraction', 'مغامرة الطرح', 'subtraction_no_borrow'),
  ('rounding', 'مغامرة التقريب', 'rounding'),
  ('doubling', 'مغامرة الضعف', 'doubling')
on conflict (id) do nothing;

alter table public.play_games enable row level security;

drop policy if exists "play_games_select_authenticated" on public.play_games;
create policy "play_games_select_authenticated"
  on public.play_games for select
  using (auth.uid() is not null);

revoke all on public.play_games from anon, authenticated;
grant select on public.play_games to authenticated;


-- ----------------------------------------------------------------------------
-- (2) بنك الأسئلة. لا يقرؤه المتصفح إطلاقًا (لا سياسات + سحب كل الصلاحيات)؛ تقرؤه
--     start_game_attempt فقط. والقيد game_questions_math_ok يجعل قاعدة البيانات
--     نفسها ترفض أي سؤال فيه حمل (جمع) أو استلاف (طرح) أو إجابة خاطئة — فلا يمكن
--     أن يدخل البنك سؤال سيئ حتى لو أُضيف يدويًا لاحقًا.
-- ----------------------------------------------------------------------------
create table if not exists public.game_questions (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.play_games (id) on delete cascade,
  skill text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_text text not null,
  operand_a integer not null check (operand_a between 1 and 999),
  -- null للضعف (مُعامل واحد فقط)؛ وحدة التقريب (١٠ أو ١٠٠) في التقريب.
  operand_b integer check (operand_b is null or operand_b between 1 and 999),
  operator text not null check (operator in ('+', '-', 'round', 'double')),
  correct_answer text not null,
  options jsonb not null,
  visual jsonb not null,
  created_at timestamptz not null default now(),
  unique (game_id, question_text),
  constraint game_questions_options_ok check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4 and options ? correct_answer
  ),
  constraint game_questions_math_ok check (
    (operator = '+'
       and operand_b is not null
       and (operand_a % 10) + (operand_b % 10) <= 9
       and (operand_a / 10) + (operand_b / 10) <= 9
       and correct_answer = (operand_a + operand_b)::text)
    or
    (operator = '-'
       and operand_b is not null
       and (operand_a % 10) >= (operand_b % 10)
       and (operand_a / 10) >= (operand_b / 10)
       and operand_a > operand_b
       and correct_answer = (operand_a - operand_b)::text)
    or
    -- التقريب: operand_b هو وحدة التقريب (١٠ أو ١٠٠)؛ العدد ليس مضاعفًا لها
    -- أصلًا (وإلا كان السؤال بلا معنى)، والإجابة هي التقريب الصحيح (نصفها فأكثر
    -- للأعلى) محسوبة داخل القيد نفسه فلا يمكن إدخال إجابة خاطئة إطلاقًا.
    (operator = 'round'
       and operand_b in (10, 100)
       and operand_a % operand_b <> 0
       and correct_answer = (
             case when operand_a % operand_b >= operand_b / 2
                  then (operand_a / operand_b + 1) * operand_b
                  else (operand_a / operand_b) * operand_b
             end
           )::text)
    or
    -- الضعف: مُعامل واحد فقط (operand_b غير مستخدم)، والإجابة ضعف العدد بالضبط.
    (operator = 'double'
       and operand_b is null
       and correct_answer = (operand_a * 2)::text)
  )
);

-- ترقية جدول أُنشئ بنسخة سابقة من هذا الملف (كانت فيها لعبتا الجمع والطرح فقط،
-- بنطاق أرقام ١–٩٩، وoperand_b إلزاميًا، وoperator يقبل '+'/'-' فقط) إلى النطاق
-- الأوسع الذي تحتاجه التقريب والضعف أدناه. "create table if not exists" أعلاه
-- لا يلمس جدولًا موجودًا بالفعل، فهذه الأسطر ضرورية لترقيته فعليًا — آمنة
-- للتكرار وعلى جدول حديث الإنشاء أيضًا (تعيد إنشاء القيد نفسه بلا تغيير).
alter table public.game_questions alter column operand_b drop not null;

alter table public.game_questions drop constraint if exists game_questions_operand_a_check;
alter table public.game_questions add constraint game_questions_operand_a_check
  check (operand_a between 1 and 999);

alter table public.game_questions drop constraint if exists game_questions_operand_b_check;
alter table public.game_questions add constraint game_questions_operand_b_check
  check (operand_b is null or operand_b between 1 and 999);

-- ملاحظة: القيود الوسيطة أدناه (حتى توسيعها لاحقًا في هذا الملف) أُضيفت NOT VALID كي لا تفشل إعادة تشغيل الملف على قاعدة فيها صفوف الألعاب الجديدة (order_asc/compare/even_odd). تبقى مفروضة على أي إدراج جديد، والقيد النهائي (الأوسع) يُتحقَّق منه على كل الصفوف.
alter table public.game_questions drop constraint if exists game_questions_operator_check;
alter table public.game_questions add constraint game_questions_operator_check
  check (operator in ('+', '-', 'round', 'double')) not valid;

alter table public.game_questions drop constraint if exists game_questions_math_ok;
alter table public.game_questions add constraint game_questions_math_ok check (
    (operator = '+'
       and operand_b is not null
       and (operand_a % 10) + (operand_b % 10) <= 9
       and (operand_a / 10) + (operand_b / 10) <= 9
       and correct_answer = (operand_a + operand_b)::text)
    or
    (operator = '-'
       and operand_b is not null
       and (operand_a % 10) >= (operand_b % 10)
       and (operand_a / 10) >= (operand_b / 10)
       and operand_a > operand_b
       and correct_answer = (operand_a - operand_b)::text)
    or
    (operator = 'round'
       and operand_b in (10, 100)
       and operand_a % operand_b <> 0
       and correct_answer = (
             case when operand_a % operand_b >= operand_b / 2
                  then (operand_a / operand_b + 1) * operand_b
                  else (operand_a / operand_b) * operand_b
             end
           )::text)
    or
    (operator = 'double'
       and operand_b is null
       and correct_answer = (operand_a * 2)::text)
  ) not valid;

alter table public.game_questions enable row level security;
revoke all on public.game_questions from anon, authenticated;


-- ----------------------------------------------------------------------------
-- (3) المحاولات وأسئلتها
--     game_attempts: محاولة واحدة لطالبة في لعبة. status: in_progress / completed /
--     abandoned (بدأتها ولم تكملها، ولا تُحتسب في النتائج).
--     game_attempt_questions: الأسئلة الفعلية للمحاولة + إجابات الطالبة (تبقى للمعلمة
--     لمعرفة مستوى الطالبة). answer_key محجوب عن المتصفح بصلاحيات الأعمدة.
-- ----------------------------------------------------------------------------
create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  game_id text not null references public.play_games (id),
  skill text not null,
  attempt_number integer not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  total_questions integer not null default 10,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  percentage numeric,
  duration_seconds integer,
  points_awarded integer not null default 0
);

create index if not exists game_attempts_student_game_idx
  on public.game_attempts (student_id, game_id, status, completed_at desc);

create table if not exists public.game_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.game_attempts (id) on delete cascade,
  bank_question_id uuid references public.game_questions (id) on delete set null,
  skill text not null,
  difficulty text not null,
  question_order integer not null,
  question_text text not null,
  operand_a integer not null,
  operand_b integer,
  operator text not null,
  visual jsonb not null,
  options jsonb not null,
  answer_key text not null,
  selected_answer text,
  correct_answer text,
  is_correct boolean,
  answered_at timestamptz,
  unique (attempt_id, question_order)
);

alter table public.game_attempts          enable row level security;
-- نفس الترقية أعلاه، لكن لجدول أسئلة المحاولات (يلزم بعد إنشاء الجدول مباشرة
-- لا قبله): كانت نسخة سابقة تفرض operand_b NOT NULL، وهو ما يمنع تخزين أسئلة
-- الضعف (لا مُعامل ثانيًا لها).
alter table public.game_attempt_questions alter column operand_b drop not null;

alter table public.game_attempt_questions enable row level security;

create or replace function public.is_owner_of_game_attempt(target_attempt_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.game_attempts a
    where a.id = target_attempt_id and a.student_id = auth.uid()
  );
$$;

create or replace function public.is_teacher_of_game_attempt(target_attempt_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.game_attempts a
    where a.id = target_attempt_id and public.is_teacher_of_student(a.student_id)
  );
$$;

-- قراءة فقط: الطالبة ترى محاولاتها، والمعلمة ترى محاولات طالباتها. لا INSERT/UPDATE/
-- DELETE من العميل إطلاقًا — الدوال الآمنة أدناه هي المسار الوحيد.
drop policy if exists "game_attempts_select_own_student" on public.game_attempts;
create policy "game_attempts_select_own_student"
  on public.game_attempts for select
  using (student_id = auth.uid());

drop policy if exists "game_attempts_select_own_teacher" on public.game_attempts;
create policy "game_attempts_select_own_teacher"
  on public.game_attempts for select
  using (public.is_teacher_of_student(student_id));

drop policy if exists "game_attempt_questions_select_own_student" on public.game_attempt_questions;
create policy "game_attempt_questions_select_own_student"
  on public.game_attempt_questions for select
  using (public.is_owner_of_game_attempt(attempt_id));

drop policy if exists "game_attempt_questions_select_own_teacher" on public.game_attempt_questions;
create policy "game_attempt_questions_select_own_teacher"
  on public.game_attempt_questions for select
  using (public.is_teacher_of_game_attempt(attempt_id));

revoke all on public.game_attempts from anon, authenticated;
grant select on public.game_attempts to authenticated;

-- كل الأعمدة قابلة للقراءة ما عدا answer_key.
-- ⚠️ لا تستعملي select("*") على game_attempt_questions من الواجهة — اذكري الأعمدة صراحةً.
revoke all on public.game_attempt_questions from anon, authenticated;
grant select (
  id, attempt_id, bank_question_id, skill, difficulty, question_order, question_text,
  operand_a, operand_b, operator, visual, options,
  selected_answer, correct_answer, is_correct, answered_at
) on public.game_attempt_questions to authenticated;


-- ----------------------------------------------------------------------------
-- (4) بدء محاولة
--     • تستأنف المحاولة المفتوحة (لم تنتهِ مهلتها) لنفس اللعبة — تتحمل تحديث الصفحة.
--     • المحاولات المفتوحة المنتهية المهلة تُوسَم abandoned.
--     • عشرة أسئلة تتصاعد صعوبتها: ٣ سهلة ثم ٤ متوسطة ثم ٣ صعبة، من بنك اللعبة.
--     • ترتيب الخيارات عشوائي لكل محاولة، فلا تكون الإجابة الصحيحة دائمًا في مكان واحد.
-- ----------------------------------------------------------------------------
create or replace function public.start_game_attempt(p_game_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_game public.play_games%rowtype;
  v_existing uuid;
  v_attempt_id uuid;
  v_number integer;
  v_tiers text[] := array['easy', 'medium', 'hard'];
  v_takes integer[] := array[3, 4, 3];
  v_i integer;
  v_order integer := 0;
  v_row record;
begin
  if v_student is null or not exists (select 1 from public.students where id = v_student) then
    raise exception 'هذه الميزة للطالبات فقط';
  end if;

  select * into v_game from public.play_games where id = p_game_id and enabled;
  if not found then
    raise exception 'هذه اللعبة غير متاحة';
  end if;

  select id into v_existing
  from public.game_attempts
  where student_id = v_student and game_id = p_game_id
    and status = 'in_progress' and expires_at > now()
  order by started_at desc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  update public.game_attempts
  set status = 'abandoned'
  where student_id = v_student and game_id = p_game_id and status = 'in_progress';

  select count(*) + 1 into v_number
  from public.game_attempts
  where student_id = v_student and game_id = p_game_id;

  insert into public.game_attempts (student_id, game_id, skill, attempt_number, started_at, expires_at, total_questions)
  values (v_student, p_game_id, v_game.skill, v_number, now(), now() + interval '3 hours', 10)
  returning id into v_attempt_id;

  for v_i in 1..array_length(v_tiers, 1) loop
    for v_row in
      select id, skill, difficulty, question_text, operand_a, operand_b, operator, visual, options, correct_answer
      from public.game_questions
      where game_id = p_game_id and difficulty = v_tiers[v_i]
      order by random()
      limit v_takes[v_i]
    loop
      v_order := v_order + 1;
      insert into public.game_attempt_questions
        (attempt_id, bank_question_id, skill, difficulty, question_order, question_text,
         operand_a, operand_b, operator, visual, options, answer_key)
      values
        (v_attempt_id, v_row.id, v_row.skill, v_row.difficulty, v_order, v_row.question_text,
         v_row.operand_a, v_row.operand_b, v_row.operator, v_row.visual,
         public.shuffle_jsonb_array(v_row.options), v_row.correct_answer);
    end loop;
  end loop;

  if v_order = 0 then
    raise exception 'لا توجد أسئلة لهذه اللعبة بعد';
  end if;

  update public.game_attempts set total_questions = v_order where id = v_attempt_id;

  return v_attempt_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- (5) تسجيل إجابة سؤال واحد — نفس قواعد record_quiz_answer:
--     السؤال من هذه المحاولة، إجابة واحدة فقط لكل سؤال (النداء المكرر يُرجع النتيجة
--     الأولى دون تغيير فلا يمكن تجريب الخيارات)، والإجابة أحد الخيارات. تُرجع صحة
--     الإجابة والإجابة الصحيحة بعد أن أُغلق باب تغييرها (للتغذية الراجعة التعليمية).
-- ----------------------------------------------------------------------------
create or replace function public.record_game_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_answer text
)
returns table (was_correct boolean, right_answer text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.game_attempts%rowtype;
  v_q public.game_attempt_questions%rowtype;
  v_ok boolean;
begin
  select * into v_attempt from public.game_attempts where id = p_attempt_id;
  if not found then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_attempt.student_id <> auth.uid() then
    raise exception 'غير مصرَّح';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'هذه المحاولة لم تعد مفتوحة';
  end if;
  if now() > v_attempt.expires_at then
    raise exception 'انتهت مهلة اللعبة';
  end if;

  select * into v_q
  from public.game_attempt_questions
  where id = p_question_id and attempt_id = p_attempt_id
  for update;
  if not found then
    raise exception 'السؤال غير موجود في هذه المحاولة';
  end if;

  if v_q.selected_answer is not null then
    was_correct := coalesce(v_q.is_correct, false);
    right_answer := v_q.correct_answer;
    return next;
    return;
  end if;

  if not (v_q.options ? p_selected_answer) then
    raise exception 'إجابة غير صالحة';
  end if;

  v_ok := (p_selected_answer = v_q.answer_key);

  update public.game_attempt_questions
  set selected_answer = p_selected_answer,
      is_correct = v_ok,
      correct_answer = v_q.answer_key,
      answered_at = now()
  where id = p_question_id;

  was_correct := v_ok;
  right_answer := v_q.answer_key;
  return next;
  return;
end;
$$;


-- ----------------------------------------------------------------------------
-- (6) إنهاء المحاولة
--     لا تكتمل إلا إذا أُجيب على كل الأسئلة. النتيجة تُحسب هنا من الإجابات المسجَّلة،
--     والمدة من بدء المحاولة إلى آخر إجابة (بحد أقصى ساعة).
--
--     المكافأة — مستقلة تمامًا عن «اختبر» ولوحة النجوم المرحة — تُمنح **مرة واحدة
--     فقط طوال عمر الطالبة في هذه اللعبة**: إذا لم يسبق لها أي محاولة مكتملة أخرى
--     لهذه اللعبة (بصرف النظر عن نتيجتها)، فهذه هي محاولتها الأولى، وتُمنح نجومًا
--     بعدد إجاباتها الصحيحة (٠ إلى ١٠) إن بلغت الحد الأدنى `reward_min_percentage`
--     (=٠ افتراضيًا، أي بلا شرط). أي محاولة لاحقة — ثانية أو عاشرة، ومهما كانت
--     نتيجتها — لا تمنح نجومًا أبدًا. نداء ثانٍ على محاولة مكتملة لا يفعل شيئًا.
-- ----------------------------------------------------------------------------
create or replace function public.complete_game_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a public.game_attempts%rowtype;
  v_total integer;
  v_correct integer;
  v_wrong integer;
  v_pct numeric;
  v_duration integer;
  v_reward_enabled boolean;
  v_reward_min integer;
  v_points integer := 0;
  v_prior_completed integer;
begin
  select * into v_a from public.game_attempts where id = p_attempt_id;
  if not found then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_a.student_id <> auth.uid() then
    raise exception 'غير مصرَّح';
  end if;
  if v_a.status = 'completed' then
    return;
  end if;
  if v_a.status <> 'in_progress' then
    raise exception 'هذه المحاولة لم تعد مفتوحة';
  end if;

  if exists (
    select 1 from public.game_attempt_questions
    where attempt_id = p_attempt_id and selected_answer is null
  ) then
    raise exception 'أكملي كل الأسئلة أولًا';
  end if;

  select
    count(*),
    count(*) filter (where is_correct),
    count(*) filter (where not is_correct),
    least(3600, greatest(0, extract(epoch from (max(answered_at) - v_a.started_at))::integer))
  into v_total, v_correct, v_wrong, v_duration
  from public.game_attempt_questions
  where attempt_id = p_attempt_id;

  v_pct := round((v_correct::numeric / greatest(v_total, 1)) * 100);

  select reward_enabled, reward_min_percentage into v_reward_enabled, v_reward_min
  from public.play_games where id = v_a.game_id;

  select count(*) into v_prior_completed
  from public.game_attempts
  where student_id = v_a.student_id and game_id = v_a.game_id and status = 'completed';

  if coalesce(v_reward_enabled, false) and v_prior_completed = 0 and v_pct >= coalesce(v_reward_min, 0) then
    v_points := v_correct;
  end if;

  update public.game_attempts
  set status = 'completed',
      completed_at = now(),
      total_questions = v_total,
      correct_answers = v_correct,
      wrong_answers = v_wrong,
      percentage = v_pct,
      duration_seconds = v_duration,
      points_awarded = v_points
  where id = p_attempt_id;

  if v_points > 0 then
    update public.students set stars = stars + v_points where id = v_a.student_id;
  end if;
end;
$$;

grant execute on function public.start_game_attempt(text) to authenticated;
grant execute on function public.record_game_answer(uuid, uuid, text) to authenticated;
grant execute on function public.complete_game_attempt(uuid) to authenticated;
revoke execute on function public.start_game_attempt(text) from public, anon;
revoke execute on function public.record_game_answer(uuid, uuid, text) from public, anon;
revoke execute on function public.complete_game_attempt(uuid) from public, anon;

-- ============================================================================
-- بنك أسئلة «ألعب» — مغامرة الجمع ومغامرة الطرح
-- ملف مُولَّد آليًا: node scripts/generate-game-bank.mjs  (لا تعدّليه يدويًا)
-- 493 سؤالًا؛ الجمع بدون حمل والطرح بدون استلاف مضمونان بالبناء ومفحوصان
-- بـ scripts/verify-game-bank.mjs ثم بـ supabase/game_smoke_test.sql على قاعدتك.
-- آمن للتشغيل أكثر من مرة (on conflict do nothing).
-- ============================================================================
insert into public.game_questions
  (game_id, skill, difficulty, question_text, operand_a, operand_b, operator, correct_answer, options, visual)
values
  ('addition', 'addition_no_carry', 'easy', '1 + 1 = ؟', 1, 1, '+', '2', '["2","1","4","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":1},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '1 + 2 = ؟', 1, 2, '+', '3', '["3","1","2","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":1},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '1 + 3 = ؟', 1, 3, '+', '4', '["4","5","2","6"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":1},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '1 + 4 = ؟', 1, 4, '+', '5', '["5","3","4","8"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":1},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '1 + 5 = ؟', 1, 5, '+', '6', '["6","4","7","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":1},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '1 + 6 = ؟', 1, 6, '+', '7', '["7","10","9","6"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":1},{"kind":"op","symbol":"+"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '1 + 7 = ؟', 1, 7, '+', '8', '["8","9","11","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":1},{"kind":"op","symbol":"+"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '1 + 8 = ؟', 1, 8, '+', '9', '["9","10","12","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":1},{"kind":"op","symbol":"+"},{"kind":"num","value":8},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '2 + 1 = ؟', 2, 1, '+', '3', '["3","6","2","4"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":2},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '2 + 2 = ؟', 2, 2, '+', '4', '["4","7","2","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":2},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '2 + 3 = ؟', 2, 3, '+', '5', '["5","7","8","6"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":2},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '2 + 4 = ؟', 2, 4, '+', '6', '["6","7","4","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":2},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '2 + 5 = ؟', 2, 5, '+', '7', '["7","10","8","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":2},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '2 + 6 = ؟', 2, 6, '+', '8', '["8","10","9","11"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":2},{"kind":"op","symbol":"+"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '2 + 7 = ؟', 2, 7, '+', '9', '["9","10","11","12"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":2},{"kind":"op","symbol":"+"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '3 + 1 = ؟', 3, 1, '+', '4', '["4","2","3","6"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":3},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '3 + 2 = ؟', 3, 2, '+', '5', '["5","6","4","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":3},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '3 + 3 = ؟', 3, 3, '+', '6', '["6","8","9","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":3},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '3 + 4 = ؟', 3, 4, '+', '7', '["7","6","9","8"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":3},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '3 + 5 = ؟', 3, 5, '+', '8', '["8","11","6","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":3},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '3 + 6 = ؟', 3, 6, '+', '9', '["9","8","11","10"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":3},{"kind":"op","symbol":"+"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '4 + 1 = ؟', 4, 1, '+', '5', '["5","3","7","4"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":4},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '4 + 2 = ؟', 4, 2, '+', '6', '["6","8","9","4"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":4},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '4 + 3 = ؟', 4, 3, '+', '7', '["7","9","8","6"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":4},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '4 + 4 = ؟', 4, 4, '+', '8', '["8","6","7","10"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":4},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '4 + 5 = ؟', 4, 5, '+', '9', '["9","11","10","12"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":4},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '5 + 1 = ؟', 5, 1, '+', '6', '["6","9","7","8"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":5},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '5 + 2 = ؟', 5, 2, '+', '7', '["7","6","10","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":5},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '5 + 3 = ؟', 5, 3, '+', '8', '["8","9","11","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":5},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '5 + 4 = ؟', 5, 4, '+', '9', '["9","11","12","10"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":5},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '6 + 1 = ؟', 6, 1, '+', '7', '["7","10","5","8"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":6},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '6 + 2 = ؟', 6, 2, '+', '8', '["8","9","10","6"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":6},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '6 + 3 = ؟', 6, 3, '+', '9', '["9","12","10","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":6},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '7 + 1 = ؟', 7, 1, '+', '8', '["8","6","11","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":7},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '7 + 2 = ؟', 7, 2, '+', '9', '["9","7","11","8"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":7},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'easy', '8 + 1 = ؟', 8, 1, '+', '9', '["9","8","10","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":8},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '11 + 7 = ؟', 11, 7, '+', '18', '["18","17","8","4"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":11},{"kind":"op","symbol":"+"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '11 + 8 = ؟', 11, 8, '+', '19', '["19","18","9","3"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":11},{"kind":"op","symbol":"+"},{"kind":"num","value":8},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '12 + 2 = ؟', 12, 2, '+', '14', '["14","15","24","10"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":12},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '12 + 3 = ؟', 12, 3, '+', '15', '["15","16","25","9"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":12},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '12 + 4 = ؟', 12, 4, '+', '16', '["16","17","6","8"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":12},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '12 + 6 = ؟', 12, 6, '+', '18', '["18","17","8","6"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":12},{"kind":"op","symbol":"+"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '13 + 4 = ؟', 13, 4, '+', '17', '["17","18","7","9"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":13},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '13 + 6 = ؟', 13, 6, '+', '19', '["19","18","9","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":13},{"kind":"op","symbol":"+"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '14 + 5 = ؟', 14, 5, '+', '19', '["19","20","29","9"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":14},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '15 + 2 = ؟', 15, 2, '+', '17', '["17","18","7","13"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":15},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '16 + 1 = ؟', 16, 1, '+', '17', '["17","18","7","15"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":16},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '21 + 4 = ؟', 21, 4, '+', '25', '["25","24","15","17"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":21},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '21 + 6 = ؟', 21, 6, '+', '27', '["27","28","37","15"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":21},{"kind":"op","symbol":"+"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '23 + 5 = ؟', 23, 5, '+', '28', '["28","29","18","30"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":23},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '27 + 2 = ؟', 27, 2, '+', '29', '["29","30","39","25"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":27},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '28 + 1 = ؟', 28, 1, '+', '29', '["29","30","19","27"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":28},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '31 + 1 = ؟', 31, 1, '+', '32', '["32","33","22","30"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":31},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '34 + 1 = ؟', 34, 1, '+', '35', '["35","36","45","33"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":34},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '35 + 2 = ؟', 35, 2, '+', '37', '["37","38","27","33"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":35},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '41 + 4 = ؟', 41, 4, '+', '45', '["45","46","35","37"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":41},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '41 + 5 = ؟', 41, 5, '+', '46', '["46","45","56","36"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":41},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '42 + 1 = ؟', 42, 1, '+', '43', '["43","42","53","41"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":42},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '42 + 6 = ؟', 42, 6, '+', '48', '["48","49","58","36"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":42},{"kind":"op","symbol":"+"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '43 + 2 = ؟', 43, 2, '+', '45', '["45","44","35","41"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":43},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '44 + 5 = ؟', 44, 5, '+', '49', '["49","50","39","38"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":44},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '46 + 3 = ؟', 46, 3, '+', '49', '["49","48","39","43"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":46},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '51 + 1 = ؟', 51, 1, '+', '52', '["52","51","42","50"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":51},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '51 + 4 = ؟', 51, 4, '+', '55', '["55","54","45","47"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":51},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '52 + 3 = ؟', 52, 3, '+', '55', '["55","54","65","49"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":52},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '54 + 3 = ؟', 54, 3, '+', '57', '["57","56","67","51"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":54},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '54 + 5 = ؟', 54, 5, '+', '59', '["59","60","49","48"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":54},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '56 + 1 = ؟', 56, 1, '+', '57', '["57","58","67","55"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":56},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '61 + 6 = ؟', 61, 6, '+', '67', '["67","68","57","55"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":61},{"kind":"op","symbol":"+"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '62 + 5 = ؟', 62, 5, '+', '67', '["67","68","57","47"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":62},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '64 + 2 = ؟', 64, 2, '+', '66', '["66","65","56","62"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":64},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '66 + 2 = ؟', 66, 2, '+', '68', '["68","69","78","64"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":66},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '71 + 4 = ؟', 71, 4, '+', '75', '["75","76","65","67"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":71},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '72 + 6 = ؟', 72, 6, '+', '78', '["78","79","68","66"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":72},{"kind":"op","symbol":"+"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '73 + 3 = ؟', 73, 3, '+', '76', '["76","77","66","70"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":73},{"kind":"op","symbol":"+"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '73 + 5 = ؟', 73, 5, '+', '78', '["78","79","88","68"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":73},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '74 + 1 = ؟', 74, 1, '+', '75', '["75","76","85","73"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":74},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '75 + 1 = ؟', 75, 1, '+', '76', '["76","77","66","74"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":75},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '76 + 1 = ؟', 76, 1, '+', '77', '["77","78","87","75"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":76},{"kind":"op","symbol":"+"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '77 + 2 = ؟', 77, 2, '+', '79', '["79","78","89","75"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":77},{"kind":"op","symbol":"+"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '81 + 4 = ؟', 81, 4, '+', '85', '["85","84","75","77"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":81},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '81 + 5 = ؟', 81, 5, '+', '86', '["86","87","96","76"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":81},{"kind":"op","symbol":"+"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '81 + 7 = ؟', 81, 7, '+', '88', '["88","89","98","74"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":81},{"kind":"op","symbol":"+"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'medium', '82 + 4 = ؟', 82, 4, '+', '86', '["86","87","76","78"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":82},{"kind":"op","symbol":"+"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '11 + 16 = ؟', 11, 16, '+', '27', '["27","28","17","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":11},{"kind":"op","symbol":"+"},{"kind":"num","value":16},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '11 + 31 = ؟', 11, 31, '+', '42', '["42","43","32","20"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":11},{"kind":"op","symbol":"+"},{"kind":"num","value":31},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '11 + 35 = ؟', 11, 35, '+', '46', '["46","47","36","24"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":11},{"kind":"op","symbol":"+"},{"kind":"num","value":35},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '11 + 62 = ؟', 11, 62, '+', '73', '["73","74","63","51"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":11},{"kind":"op","symbol":"+"},{"kind":"num","value":62},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '12 + 24 = ؟', 12, 24, '+', '36', '["36","37","26","12"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":12},{"kind":"op","symbol":"+"},{"kind":"num","value":24},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '12 + 43 = ؟', 12, 43, '+', '55', '["55","54","45","31"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":12},{"kind":"op","symbol":"+"},{"kind":"num","value":43},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '12 + 66 = ؟', 12, 66, '+', '78', '["78","79","68","54"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":12},{"kind":"op","symbol":"+"},{"kind":"num","value":66},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '13 + 11 = ؟', 13, 11, '+', '24', '["24","25","34","2"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":13},{"kind":"op","symbol":"+"},{"kind":"num","value":11},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '14 + 32 = ؟', 14, 32, '+', '46', '["46","45","56","18"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":14},{"kind":"op","symbol":"+"},{"kind":"num","value":32},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '14 + 52 = ؟', 14, 52, '+', '66', '["66","67","56","38"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":14},{"kind":"op","symbol":"+"},{"kind":"num","value":52},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '14 + 53 = ؟', 14, 53, '+', '67', '["67","66","57","39"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":14},{"kind":"op","symbol":"+"},{"kind":"num","value":53},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '15 + 51 = ؟', 15, 51, '+', '66', '["66","67","76","36"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":15},{"kind":"op","symbol":"+"},{"kind":"num","value":51},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '16 + 23 = ؟', 16, 23, '+', '39', '["39","40","29","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":16},{"kind":"op","symbol":"+"},{"kind":"num","value":23},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '16 + 52 = ؟', 16, 52, '+', '68', '["68","69","78","36"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":16},{"kind":"op","symbol":"+"},{"kind":"num","value":52},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '16 + 83 = ؟', 16, 83, '+', '99', '["99","100","89","67"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":16},{"kind":"op","symbol":"+"},{"kind":"num","value":83},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '21 + 63 = ؟', 21, 63, '+', '84', '["84","83","74","42"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":21},{"kind":"op","symbol":"+"},{"kind":"num","value":63},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '24 + 42 = ؟', 24, 42, '+', '66', '["66","65","56","18"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":24},{"kind":"op","symbol":"+"},{"kind":"num","value":42},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '24 + 65 = ؟', 24, 65, '+', '89', '["89","90","79","41"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":24},{"kind":"op","symbol":"+"},{"kind":"num","value":65},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '25 + 51 = ؟', 25, 51, '+', '76', '["76","75","86","26"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":25},{"kind":"op","symbol":"+"},{"kind":"num","value":51},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '26 + 21 = ؟', 26, 21, '+', '47', '["47","48","37","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":26},{"kind":"op","symbol":"+"},{"kind":"num","value":21},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '31 + 33 = ؟', 31, 33, '+', '64', '["64","63","74","2"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":31},{"kind":"op","symbol":"+"},{"kind":"num","value":33},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '32 + 21 = ؟', 32, 21, '+', '53', '["53","52","43","11"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":32},{"kind":"op","symbol":"+"},{"kind":"num","value":21},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '32 + 27 = ؟', 32, 27, '+', '59', '["59","58","69","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":32},{"kind":"op","symbol":"+"},{"kind":"num","value":27},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '33 + 56 = ؟', 33, 56, '+', '89', '["89","88","79","23"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":33},{"kind":"op","symbol":"+"},{"kind":"num","value":56},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '35 + 22 = ؟', 35, 22, '+', '57', '["57","56","47","13"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":35},{"kind":"op","symbol":"+"},{"kind":"num","value":22},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '35 + 23 = ؟', 35, 23, '+', '58', '["58","59","48","12"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":35},{"kind":"op","symbol":"+"},{"kind":"num","value":23},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '35 + 51 = ؟', 35, 51, '+', '86', '["86","87","96","16"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":35},{"kind":"op","symbol":"+"},{"kind":"num","value":51},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '41 + 32 = ؟', 41, 32, '+', '73', '["73","72","63","9"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":41},{"kind":"op","symbol":"+"},{"kind":"num","value":32},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '41 + 56 = ؟', 41, 56, '+', '97', '["97","98","87","15"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":41},{"kind":"op","symbol":"+"},{"kind":"num","value":56},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '42 + 42 = ؟', 42, 42, '+', '84', '["84","83","74","104"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":42},{"kind":"op","symbol":"+"},{"kind":"num","value":42},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '43 + 14 = ؟', 43, 14, '+', '57', '["57","56","67","29"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":43},{"kind":"op","symbol":"+"},{"kind":"num","value":14},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '44 + 33 = ؟', 44, 33, '+', '77', '["77","76","87","11"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":44},{"kind":"op","symbol":"+"},{"kind":"num","value":33},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '46 + 21 = ؟', 46, 21, '+', '67', '["67","68","77","25"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":46},{"kind":"op","symbol":"+"},{"kind":"num","value":21},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '46 + 41 = ؟', 46, 41, '+', '87', '["87","86","77","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":46},{"kind":"op","symbol":"+"},{"kind":"num","value":41},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '46 + 51 = ؟', 46, 51, '+', '97', '["97","96","87","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":46},{"kind":"op","symbol":"+"},{"kind":"num","value":51},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '52 + 31 = ؟', 52, 31, '+', '83', '["83","82","93","21"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":52},{"kind":"op","symbol":"+"},{"kind":"num","value":31},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '52 + 44 = ؟', 52, 44, '+', '96', '["96","95","106","8"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":52},{"kind":"op","symbol":"+"},{"kind":"num","value":44},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '53 + 35 = ؟', 53, 35, '+', '88', '["88","87","98","18"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":53},{"kind":"op","symbol":"+"},{"kind":"num","value":35},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '53 + 44 = ؟', 53, 44, '+', '97', '["97","96","87","9"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":53},{"kind":"op","symbol":"+"},{"kind":"num","value":44},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '57 + 42 = ؟', 57, 42, '+', '99', '["99","98","109","15"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":57},{"kind":"op","symbol":"+"},{"kind":"num","value":42},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '62 + 36 = ؟', 62, 36, '+', '98', '["98","97","88","26"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":62},{"kind":"op","symbol":"+"},{"kind":"num","value":36},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '63 + 35 = ؟', 63, 35, '+', '98', '["98","99","108","28"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":63},{"kind":"op","symbol":"+"},{"kind":"num","value":35},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '65 + 11 = ؟', 65, 11, '+', '76', '["76","75","86","54"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":65},{"kind":"op","symbol":"+"},{"kind":"num","value":11},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '65 + 12 = ؟', 65, 12, '+', '77', '["77","76","87","53"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":65},{"kind":"op","symbol":"+"},{"kind":"num","value":12},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '65 + 21 = ؟', 65, 21, '+', '86', '["86","87","76","44"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":65},{"kind":"op","symbol":"+"},{"kind":"num","value":21},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '65 + 33 = ؟', 65, 33, '+', '98', '["98","97","108","32"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":65},{"kind":"op","symbol":"+"},{"kind":"num","value":33},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '71 + 27 = ؟', 71, 27, '+', '98', '["98","99","88","44"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":71},{"kind":"op","symbol":"+"},{"kind":"num","value":27},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('addition', 'addition_no_carry', 'hard', '73 + 25 = ؟', 73, 25, '+', '98', '["98","97","88","48"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":73},{"kind":"op","symbol":"+"},{"kind":"num","value":25},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '2 - 1 = ؟', 2, 1, '-', '1', '["1","4","3","2"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":2},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '3 - 1 = ؟', 3, 1, '-', '2', '["2","4","1","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":3},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '3 - 2 = ؟', 3, 2, '-', '1', '["1","3","2","4"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":3},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '4 - 1 = ؟', 4, 1, '-', '3', '["3","2","4","1"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":4},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '4 - 2 = ؟', 4, 2, '-', '2', '["2","1","4","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":4},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '4 - 3 = ؟', 4, 3, '-', '1', '["1","4","2","3"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":4},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '5 - 1 = ؟', 5, 1, '-', '4', '["4","5","7","3"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":5},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '5 - 2 = ؟', 5, 2, '-', '3', '["3","4","2","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":5},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '5 - 3 = ؟', 5, 3, '-', '2', '["2","5","1","3"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":5},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '5 - 4 = ؟', 5, 4, '-', '1', '["1","2","3","4"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":5},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '6 - 1 = ؟', 6, 1, '-', '5', '["5","8","4","6"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":6},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '6 - 2 = ؟', 6, 2, '-', '4', '["4","7","6","3"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":6},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '6 - 3 = ؟', 6, 3, '-', '3', '["3","1","4","6"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":6},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '6 - 4 = ؟', 6, 4, '-', '2', '["2","3","4","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":6},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '6 - 5 = ؟', 6, 5, '-', '1', '["1","2","4","3"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":6},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '7 - 1 = ؟', 7, 1, '-', '6', '["6","7","4","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":7},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '7 - 2 = ؟', 7, 2, '-', '5', '["5","3","4","8"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":7},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '7 - 3 = ؟', 7, 3, '-', '4', '["4","6","3","2"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":7},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '7 - 4 = ؟', 7, 4, '-', '3', '["3","4","2","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":7},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '7 - 5 = ؟', 7, 5, '-', '2', '["2","4","1","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":7},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '7 - 6 = ؟', 7, 6, '-', '1', '["1","3","2","4"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":7},{"kind":"op","symbol":"−"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '8 - 1 = ؟', 8, 1, '-', '7', '["7","9","6","8"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":8},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '8 - 2 = ؟', 8, 2, '-', '6', '["6","9","4","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":8},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '8 - 3 = ؟', 8, 3, '-', '5', '["5","3","7","4"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":8},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '8 - 4 = ؟', 8, 4, '-', '4', '["4","5","7","3"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":8},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '8 - 5 = ؟', 8, 5, '-', '3', '["3","6","1","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":8},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '8 - 6 = ؟', 8, 6, '-', '2', '["2","4","3","1"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":8},{"kind":"op","symbol":"−"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '8 - 7 = ؟', 8, 7, '-', '1', '["1","4","2","3"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":8},{"kind":"op","symbol":"−"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '9 - 1 = ؟', 9, 1, '-', '8', '["8","6","11","9"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":9},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '9 - 2 = ؟', 9, 2, '-', '7', '["7","10","9","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":9},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '9 - 3 = ؟', 9, 3, '-', '6', '["6","4","8","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":9},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '9 - 4 = ؟', 9, 4, '-', '5', '["5","3","4","7"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":9},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '9 - 5 = ؟', 9, 5, '-', '4', '["4","3","7","2"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":9},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '9 - 6 = ؟', 9, 6, '-', '3', '["3","2","1","5"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":9},{"kind":"op","symbol":"−"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '9 - 7 = ؟', 9, 7, '-', '2', '["2","5","3","1"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":9},{"kind":"op","symbol":"−"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'easy', '9 - 8 = ؟', 9, 8, '-', '1', '["1","2","3","4"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":9},{"kind":"op","symbol":"−"},{"kind":"num","value":8},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '15 - 4 = ؟', 15, 4, '-', '11', '["11","12","21","19"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":15},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '17 - 1 = ؟', 17, 1, '-', '16', '["16","17","26","18"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":17},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '17 - 3 = ؟', 17, 3, '-', '14', '["14","15","24","20"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":17},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '18 - 3 = ؟', 18, 3, '-', '15', '["15","14","5","21"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":18},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '19 - 3 = ؟', 19, 3, '-', '16', '["16","15","26","22"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":19},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '19 - 6 = ؟', 19, 6, '-', '13', '["13","14","3","25"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":19},{"kind":"op","symbol":"−"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '19 - 7 = ؟', 19, 7, '-', '12', '["12","11","2","26"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":19},{"kind":"op","symbol":"−"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '23 - 1 = ؟', 23, 1, '-', '22', '["22","21","12","24"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":23},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '26 - 5 = ؟', 26, 5, '-', '21', '["21","20","31","19"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":26},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '27 - 5 = ؟', 27, 5, '-', '22', '["22","23","12","32"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":27},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '28 - 4 = ؟', 28, 4, '-', '24', '["24","25","14","32"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":28},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '28 - 6 = ؟', 28, 6, '-', '22', '["22","23","12","34"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":28},{"kind":"op","symbol":"−"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '29 - 3 = ؟', 29, 3, '-', '26', '["26","25","16","32"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":29},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '33 - 2 = ؟', 33, 2, '-', '31', '["31","32","41","35"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":33},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '37 - 4 = ؟', 37, 4, '-', '33', '["33","34","23","41"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":37},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '37 - 6 = ؟', 37, 6, '-', '31', '["31","32","21","43"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":37},{"kind":"op","symbol":"−"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '38 - 4 = ؟', 38, 4, '-', '34', '["34","35","44","42"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":38},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '39 - 2 = ؟', 39, 2, '-', '37', '["37","38","47","41"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":39},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '48 - 1 = ؟', 48, 1, '-', '47', '["47","48","57","49"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":48},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '49 - 4 = ؟', 49, 4, '-', '45', '["45","46","35","53"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":49},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '49 - 7 = ؟', 49, 7, '-', '42', '["42","43","32","56"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":49},{"kind":"op","symbol":"−"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '58 - 2 = ؟', 58, 2, '-', '56', '["56","57","46","60"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":58},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '64 - 3 = ؟', 64, 3, '-', '61', '["61","62","51","67"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":64},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '67 - 5 = ؟', 67, 5, '-', '62', '["62","61","72","60"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":67},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '68 - 1 = ؟', 68, 1, '-', '67', '["67","68","77","69"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":68},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '69 - 6 = ؟', 69, 6, '-', '63', '["63","62","53","75"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":69},{"kind":"op","symbol":"−"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '69 - 8 = ؟', 69, 8, '-', '61', '["61","60","71","77"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":69},{"kind":"op","symbol":"−"},{"kind":"num","value":8},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '73 - 1 = ؟', 73, 1, '-', '72', '["72","71","62","74"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":73},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '76 - 3 = ؟', 76, 3, '-', '73', '["73","74","63","79"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":76},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '77 - 6 = ؟', 77, 6, '-', '71', '["71","70","81","83"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":77},{"kind":"op","symbol":"−"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '78 - 1 = ؟', 78, 1, '-', '77', '["77","76","87","79"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":78},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '78 - 4 = ؟', 78, 4, '-', '74', '["74","75","64","82"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":78},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '79 - 5 = ؟', 79, 5, '-', '74', '["74","73","64","84"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":79},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '85 - 2 = ؟', 85, 2, '-', '83', '["83","82","93","87"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":85},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '86 - 2 = ؟', 86, 2, '-', '84', '["84","83","94","88"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":86},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '87 - 4 = ؟', 87, 4, '-', '83', '["83","82","93","91"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":87},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '89 - 1 = ؟', 89, 1, '-', '88', '["88","87","78","90"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":89},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '89 - 5 = ؟', 89, 5, '-', '84', '["84","83","94","95"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":89},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '89 - 7 = ؟', 89, 7, '-', '82', '["82","83","92","96"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":89},{"kind":"op","symbol":"−"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '92 - 1 = ؟', 92, 1, '-', '91', '["91","90","81","93"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":92},{"kind":"op","symbol":"−"},{"kind":"num","value":1},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '94 - 2 = ؟', 94, 2, '-', '92', '["92","91","82","96"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":94},{"kind":"op","symbol":"−"},{"kind":"num","value":2},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '94 - 3 = ؟', 94, 3, '-', '91', '["91","92","101","97"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":94},{"kind":"op","symbol":"−"},{"kind":"num","value":3},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '96 - 4 = ؟', 96, 4, '-', '92', '["92","93","102","100"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":96},{"kind":"op","symbol":"−"},{"kind":"num","value":4},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '97 - 5 = ؟', 97, 5, '-', '92', '["92","91","82","102"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":97},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '98 - 5 = ؟', 98, 5, '-', '93', '["93","92","103","104"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":98},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '98 - 6 = ؟', 98, 6, '-', '92', '["92","91","82","104"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":98},{"kind":"op","symbol":"−"},{"kind":"num","value":6},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '98 - 7 = ؟', 98, 7, '-', '91', '["91","92","101","105"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":98},{"kind":"op","symbol":"−"},{"kind":"num","value":7},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'medium', '99 - 5 = ؟', 99, 5, '-', '94', '["94","93","84","104"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":99},{"kind":"op","symbol":"−"},{"kind":"num","value":5},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '36 - 12 = ؟', 36, 12, '-', '24', '["24","25","34","48"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":36},{"kind":"op","symbol":"−"},{"kind":"num","value":12},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '38 - 26 = ؟', 38, 26, '-', '12', '["12","11","2","64"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":38},{"kind":"op","symbol":"−"},{"kind":"num","value":26},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '39 - 28 = ؟', 39, 28, '-', '11', '["11","12","1","67"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":39},{"kind":"op","symbol":"−"},{"kind":"num","value":28},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '44 - 32 = ؟', 44, 32, '-', '12', '["12","11","2","76"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":44},{"kind":"op","symbol":"−"},{"kind":"num","value":32},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '48 - 37 = ؟', 48, 37, '-', '11', '["11","10","1","85"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":48},{"kind":"op","symbol":"−"},{"kind":"num","value":37},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '49 - 12 = ؟', 49, 12, '-', '37', '["37","38","47","61"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":49},{"kind":"op","symbol":"−"},{"kind":"num","value":12},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '49 - 18 = ؟', 49, 18, '-', '31', '["31","30","21","67"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":49},{"kind":"op","symbol":"−"},{"kind":"num","value":18},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '49 - 34 = ؟', 49, 34, '-', '15', '["15","16","25","83"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":49},{"kind":"op","symbol":"−"},{"kind":"num","value":34},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '53 - 41 = ؟', 53, 41, '-', '12', '["12","13","2","94"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":53},{"kind":"op","symbol":"−"},{"kind":"num","value":41},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '55 - 12 = ؟', 55, 12, '-', '43', '["43","44","53","67"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":55},{"kind":"op","symbol":"−"},{"kind":"num","value":12},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '57 - 13 = ؟', 57, 13, '-', '44', '["44","43","34","70"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":57},{"kind":"op","symbol":"−"},{"kind":"num","value":13},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '57 - 42 = ؟', 57, 42, '-', '15', '["15","14","5","99"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":57},{"kind":"op","symbol":"−"},{"kind":"num","value":42},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '58 - 17 = ؟', 58, 17, '-', '41', '["41","42","51","75"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":58},{"kind":"op","symbol":"−"},{"kind":"num","value":17},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '59 - 23 = ؟', 59, 23, '-', '36', '["36","37","26","82"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":59},{"kind":"op","symbol":"−"},{"kind":"num","value":23},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '59 - 34 = ؟', 59, 34, '-', '25', '["25","24","15","93"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":59},{"kind":"op","symbol":"−"},{"kind":"num","value":34},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '63 - 11 = ؟', 63, 11, '-', '52', '["52","53","42","74"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":63},{"kind":"op","symbol":"−"},{"kind":"num","value":11},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '65 - 12 = ؟', 65, 12, '-', '53', '["53","52","63","77"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":65},{"kind":"op","symbol":"−"},{"kind":"num","value":12},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '66 - 54 = ؟', 66, 54, '-', '12', '["12","13","22","120"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":66},{"kind":"op","symbol":"−"},{"kind":"num","value":54},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '68 - 11 = ؟', 68, 11, '-', '57', '["57","56","47","79"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":68},{"kind":"op","symbol":"−"},{"kind":"num","value":11},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '68 - 14 = ؟', 68, 14, '-', '54', '["54","53","44","82"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":68},{"kind":"op","symbol":"−"},{"kind":"num","value":14},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '68 - 26 = ؟', 68, 26, '-', '42', '["42","43","32","94"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":68},{"kind":"op","symbol":"−"},{"kind":"num","value":26},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '68 - 44 = ؟', 68, 44, '-', '24', '["24","23","14","112"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":68},{"kind":"op","symbol":"−"},{"kind":"num","value":44},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '75 - 13 = ؟', 75, 13, '-', '62', '["62","63","72","88"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":75},{"kind":"op","symbol":"−"},{"kind":"num","value":13},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '75 - 63 = ؟', 75, 63, '-', '12', '["12","13","2","138"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":75},{"kind":"op","symbol":"−"},{"kind":"num","value":63},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '77 - 52 = ؟', 77, 52, '-', '25', '["25","24","35","129"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":77},{"kind":"op","symbol":"−"},{"kind":"num","value":52},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '78 - 11 = ؟', 78, 11, '-', '67', '["67","66","77","89"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":78},{"kind":"op","symbol":"−"},{"kind":"num","value":11},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '78 - 42 = ؟', 78, 42, '-', '36', '["36","35","46","120"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":78},{"kind":"op","symbol":"−"},{"kind":"num","value":42},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '78 - 46 = ؟', 78, 46, '-', '32', '["32","33","42","124"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":78},{"kind":"op","symbol":"−"},{"kind":"num","value":46},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '79 - 16 = ؟', 79, 16, '-', '63', '["63","62","53","95"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":79},{"kind":"op","symbol":"−"},{"kind":"num","value":16},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '79 - 23 = ؟', 79, 23, '-', '56', '["56","57","66","102"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":79},{"kind":"op","symbol":"−"},{"kind":"num","value":23},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '85 - 23 = ؟', 85, 23, '-', '62', '["62","61","72","108"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":85},{"kind":"op","symbol":"−"},{"kind":"num","value":23},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '85 - 24 = ؟', 85, 24, '-', '61', '["61","62","71","109"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":85},{"kind":"op","symbol":"−"},{"kind":"num","value":24},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '86 - 23 = ؟', 86, 23, '-', '63', '["63","62","53","109"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":86},{"kind":"op","symbol":"−"},{"kind":"num","value":23},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '86 - 33 = ؟', 86, 33, '-', '53', '["53","52","63","119"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":86},{"kind":"op","symbol":"−"},{"kind":"num","value":33},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '86 - 35 = ؟', 86, 35, '-', '51', '["51","50","41","121"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":86},{"kind":"op","symbol":"−"},{"kind":"num","value":35},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '86 - 64 = ؟', 86, 64, '-', '22', '["22","23","32","150"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":86},{"kind":"op","symbol":"−"},{"kind":"num","value":64},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '86 - 74 = ؟', 86, 74, '-', '12', '["12","11","22","160"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":86},{"kind":"op","symbol":"−"},{"kind":"num","value":74},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '87 - 22 = ؟', 87, 22, '-', '65', '["65","64","55","109"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":87},{"kind":"op","symbol":"−"},{"kind":"num","value":22},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '87 - 44 = ؟', 87, 44, '-', '43', '["43","44","33","131"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":87},{"kind":"op","symbol":"−"},{"kind":"num","value":44},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '88 - 46 = ؟', 88, 46, '-', '42', '["42","43","32","134"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":88},{"kind":"op","symbol":"−"},{"kind":"num","value":46},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '88 - 77 = ؟', 88, 77, '-', '11', '["11","10","1","165"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":88},{"kind":"op","symbol":"−"},{"kind":"num","value":77},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '93 - 11 = ؟', 93, 11, '-', '82', '["82","83","72","104"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":93},{"kind":"op","symbol":"−"},{"kind":"num","value":11},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '94 - 83 = ؟', 94, 83, '-', '11', '["11","12","1","177"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":94},{"kind":"op","symbol":"−"},{"kind":"num","value":83},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '96 - 12 = ؟', 96, 12, '-', '84', '["84","83","74","108"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":96},{"kind":"op","symbol":"−"},{"kind":"num","value":12},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '96 - 22 = ؟', 96, 22, '-', '74', '["74","73","64","118"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":96},{"kind":"op","symbol":"−"},{"kind":"num","value":22},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '96 - 34 = ؟', 96, 34, '-', '62', '["62","61","72","130"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":96},{"kind":"op","symbol":"−"},{"kind":"num","value":34},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '96 - 44 = ؟', 96, 44, '-', '52', '["52","53","42","140"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":96},{"kind":"op","symbol":"−"},{"kind":"num","value":44},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('subtraction', 'subtraction_no_borrow', 'hard', '98 - 67 = ؟', 98, 67, '-', '31', '["31","32","21","165"]'::jsonb, '{"kind":"expression","tokens":[{"kind":"num","value":98},{"kind":"op","symbol":"−"},{"kind":"num","value":67},{"kind":"op","symbol":"="},{"kind":"blank"}]}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 12 لأقرب عشرة', 12, 10, 'round', '10', '["20","12","8","10"]'::jsonb, '{"kind":"numberLine","value":12,"lower":10,"upper":20,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 17 لأقرب عشرة', 17, 10, 'round', '20', '["23","18","20","10"]'::jsonb, '{"kind":"numberLine","value":17,"lower":10,"upper":20,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 18 لأقرب عشرة', 18, 10, 'round', '20', '["22","20","10","21"]'::jsonb, '{"kind":"numberLine","value":18,"lower":10,"upper":20,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 19 لأقرب عشرة', 19, 10, 'round', '20', '["23","10","20","19"]'::jsonb, '{"kind":"numberLine","value":19,"lower":10,"upper":20,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 21 لأقرب عشرة', 21, 10, 'round', '20', '["23","18","20","30"]'::jsonb, '{"kind":"numberLine","value":21,"lower":20,"upper":30,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 24 لأقرب عشرة', 24, 10, 'round', '20', '["20","18","21","30"]'::jsonb, '{"kind":"numberLine","value":24,"lower":20,"upper":30,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 25 لأقرب عشرة', 25, 10, 'round', '30', '["31","30","28","20"]'::jsonb, '{"kind":"numberLine","value":25,"lower":20,"upper":30,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 29 لأقرب عشرة', 29, 10, 'round', '30', '["20","31","32","30"]'::jsonb, '{"kind":"numberLine","value":29,"lower":20,"upper":30,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 32 لأقرب عشرة', 32, 10, 'round', '30', '["40","30","32","28"]'::jsonb, '{"kind":"numberLine","value":32,"lower":30,"upper":40,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 33 لأقرب عشرة', 33, 10, 'round', '30', '["29","30","32","40"]'::jsonb, '{"kind":"numberLine","value":33,"lower":30,"upper":40,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 36 لأقرب عشرة', 36, 10, 'round', '40', '["30","43","42","40"]'::jsonb, '{"kind":"numberLine","value":36,"lower":30,"upper":40,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 37 لأقرب عشرة', 37, 10, 'round', '40', '["30","39","41","40"]'::jsonb, '{"kind":"numberLine","value":37,"lower":30,"upper":40,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 39 لأقرب عشرة', 39, 10, 'round', '40', '["43","30","38","40"]'::jsonb, '{"kind":"numberLine","value":39,"lower":30,"upper":40,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 42 لأقرب عشرة', 42, 10, 'round', '40', '["50","40","41","39"]'::jsonb, '{"kind":"numberLine","value":42,"lower":40,"upper":50,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 43 لأقرب عشرة', 43, 10, 'round', '40', '["41","40","50","38"]'::jsonb, '{"kind":"numberLine","value":43,"lower":40,"upper":50,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 44 لأقرب عشرة', 44, 10, 'round', '40', '["39","50","42","40"]'::jsonb, '{"kind":"numberLine","value":44,"lower":40,"upper":50,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 46 لأقرب عشرة', 46, 10, 'round', '50', '["49","40","50","52"]'::jsonb, '{"kind":"numberLine","value":46,"lower":40,"upper":50,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 48 لأقرب عشرة', 48, 10, 'round', '50', '["52","48","50","40"]'::jsonb, '{"kind":"numberLine","value":48,"lower":40,"upper":50,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 49 لأقرب عشرة', 49, 10, 'round', '50', '["40","48","50","49"]'::jsonb, '{"kind":"numberLine","value":49,"lower":40,"upper":50,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 52 لأقرب عشرة', 52, 10, 'round', '50', '["51","60","50","53"]'::jsonb, '{"kind":"numberLine","value":52,"lower":50,"upper":60,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 59 لأقرب عشرة', 59, 10, 'round', '60', '["50","60","63","62"]'::jsonb, '{"kind":"numberLine","value":59,"lower":50,"upper":60,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 63 لأقرب عشرة', 63, 10, 'round', '60', '["62","60","70","58"]'::jsonb, '{"kind":"numberLine","value":63,"lower":60,"upper":70,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 65 لأقرب عشرة', 65, 10, 'round', '70', '["69","60","71","70"]'::jsonb, '{"kind":"numberLine","value":65,"lower":60,"upper":70,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 67 لأقرب عشرة', 67, 10, 'round', '70', '["69","70","60","71"]'::jsonb, '{"kind":"numberLine","value":67,"lower":60,"upper":70,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 68 لأقرب عشرة', 68, 10, 'round', '70', '["70","68","60","69"]'::jsonb, '{"kind":"numberLine","value":68,"lower":60,"upper":70,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 73 لأقرب عشرة', 73, 10, 'round', '70', '["72","73","70","80"]'::jsonb, '{"kind":"numberLine","value":73,"lower":70,"upper":80,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 75 لأقرب عشرة', 75, 10, 'round', '80', '["81","80","70","82"]'::jsonb, '{"kind":"numberLine","value":75,"lower":70,"upper":80,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 81 لأقرب عشرة', 81, 10, 'round', '80', '["79","80","82","90"]'::jsonb, '{"kind":"numberLine","value":81,"lower":80,"upper":90,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 85 لأقرب عشرة', 85, 10, 'round', '90', '["92","90","80","89"]'::jsonb, '{"kind":"numberLine","value":85,"lower":80,"upper":90,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 86 لأقرب عشرة', 86, 10, 'round', '90', '["90","88","91","80"]'::jsonb, '{"kind":"numberLine","value":86,"lower":80,"upper":90,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 89 لأقرب عشرة', 89, 10, 'round', '90', '["80","92","90","88"]'::jsonb, '{"kind":"numberLine","value":89,"lower":80,"upper":90,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 95 لأقرب عشرة', 95, 10, 'round', '100', '["98","102","100","90"]'::jsonb, '{"kind":"numberLine","value":95,"lower":90,"upper":100,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 96 لأقرب عشرة', 96, 10, 'round', '100', '["90","98","102","100"]'::jsonb, '{"kind":"numberLine","value":96,"lower":90,"upper":100,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 97 لأقرب عشرة', 97, 10, 'round', '100', '["100","98","90","103"]'::jsonb, '{"kind":"numberLine","value":97,"lower":90,"upper":100,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 98 لأقرب عشرة', 98, 10, 'round', '100', '["103","101","90","100"]'::jsonb, '{"kind":"numberLine","value":98,"lower":90,"upper":100,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'easy', 'قرّبي العدد 99 لأقرب عشرة', 99, 10, 'round', '100', '["100","102","99","90"]'::jsonb, '{"kind":"numberLine","value":99,"lower":90,"upper":100,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 103 لأقرب عشرة', 103, 10, 'round', '100', '["100","80","99","110"]'::jsonb, '{"kind":"numberLine","value":103,"lower":100,"upper":110,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 139 لأقرب عشرة', 139, 10, 'round', '140', '["140","139","130","150"]'::jsonb, '{"kind":"numberLine","value":139,"lower":130,"upper":140,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 153 لأقرب عشرة', 153, 10, 'round', '150', '["160","151","140","150"]'::jsonb, '{"kind":"numberLine","value":153,"lower":150,"upper":160,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 161 لأقرب عشرة', 161, 10, 'round', '160', '["170","160","161","150"]'::jsonb, '{"kind":"numberLine","value":161,"lower":160,"upper":170,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 166 لأقرب عشرة', 166, 10, 'round', '170', '["169","160","180","170"]'::jsonb, '{"kind":"numberLine","value":166,"lower":160,"upper":170,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 188 لأقرب عشرة', 188, 10, 'round', '190', '["191","200","190","180"]'::jsonb, '{"kind":"numberLine","value":188,"lower":180,"upper":190,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 205 لأقرب عشرة', 205, 10, 'round', '210', '["209","200","190","210"]'::jsonb, '{"kind":"numberLine","value":205,"lower":200,"upper":210,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 214 لأقرب عشرة', 214, 10, 'round', '210', '["190","210","220","209"]'::jsonb, '{"kind":"numberLine","value":214,"lower":210,"upper":220,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 221 لأقرب عشرة', 221, 10, 'round', '220', '["221","220","230","200"]'::jsonb, '{"kind":"numberLine","value":221,"lower":220,"upper":230,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 224 لأقرب عشرة', 224, 10, 'round', '220', '["221","220","230","200"]'::jsonb, '{"kind":"numberLine","value":224,"lower":220,"upper":230,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 246 لأقرب عشرة', 246, 10, 'round', '250', '["240","250","251","260"]'::jsonb, '{"kind":"numberLine","value":246,"lower":240,"upper":250,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 264 لأقرب عشرة', 264, 10, 'round', '260', '["259","260","270","240"]'::jsonb, '{"kind":"numberLine","value":264,"lower":260,"upper":270,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 277 لأقرب عشرة', 277, 10, 'round', '280', '["290","280","270","279"]'::jsonb, '{"kind":"numberLine","value":277,"lower":270,"upper":280,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 291 لأقرب عشرة', 291, 10, 'round', '290', '["300","290","270","289"]'::jsonb, '{"kind":"numberLine","value":291,"lower":290,"upper":300,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 322 لأقرب عشرة', 322, 10, 'round', '320', '["321","330","320","310"]'::jsonb, '{"kind":"numberLine","value":322,"lower":320,"upper":330,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 325 لأقرب عشرة', 325, 10, 'round', '330', '["340","330","320","329"]'::jsonb, '{"kind":"numberLine","value":325,"lower":320,"upper":330,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 338 لأقرب عشرة', 338, 10, 'round', '340', '["320","340","341","330"]'::jsonb, '{"kind":"numberLine","value":338,"lower":330,"upper":340,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 384 لأقرب عشرة', 384, 10, 'round', '380', '["381","390","370","380"]'::jsonb, '{"kind":"numberLine","value":384,"lower":380,"upper":390,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 385 لأقرب عشرة', 385, 10, 'round', '390', '["390","391","380","370"]'::jsonb, '{"kind":"numberLine","value":385,"lower":380,"upper":390,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 432 لأقرب عشرة', 432, 10, 'round', '430', '["431","430","420","440"]'::jsonb, '{"kind":"numberLine","value":432,"lower":430,"upper":440,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 445 لأقرب عشرة', 445, 10, 'round', '450', '["430","450","451","440"]'::jsonb, '{"kind":"numberLine","value":445,"lower":440,"upper":450,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 527 لأقرب عشرة', 527, 10, 'round', '530', '["531","520","530","540"]'::jsonb, '{"kind":"numberLine","value":527,"lower":520,"upper":530,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 545 لأقرب عشرة', 545, 10, 'round', '550', '["540","530","550","549"]'::jsonb, '{"kind":"numberLine","value":545,"lower":540,"upper":550,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 549 لأقرب عشرة', 549, 10, 'round', '550', '["560","549","550","540"]'::jsonb, '{"kind":"numberLine","value":549,"lower":540,"upper":550,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 577 لأقرب عشرة', 577, 10, 'round', '580', '["570","580","581","590"]'::jsonb, '{"kind":"numberLine","value":577,"lower":570,"upper":580,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 585 لأقرب عشرة', 585, 10, 'round', '590', '["600","580","590","589"]'::jsonb, '{"kind":"numberLine","value":585,"lower":580,"upper":590,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 589 لأقرب عشرة', 589, 10, 'round', '590', '["600","591","580","590"]'::jsonb, '{"kind":"numberLine","value":589,"lower":580,"upper":590,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 605 لأقرب عشرة', 605, 10, 'round', '610', '["590","600","610","609"]'::jsonb, '{"kind":"numberLine","value":605,"lower":600,"upper":610,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 623 لأقرب عشرة', 623, 10, 'round', '620', '["620","610","619","630"]'::jsonb, '{"kind":"numberLine","value":623,"lower":620,"upper":630,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 636 لأقرب عشرة', 636, 10, 'round', '640', '["630","641","650","640"]'::jsonb, '{"kind":"numberLine","value":636,"lower":630,"upper":640,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 658 لأقرب عشرة', 658, 10, 'round', '660', '["659","670","660","650"]'::jsonb, '{"kind":"numberLine","value":658,"lower":650,"upper":660,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 679 لأقرب عشرة', 679, 10, 'round', '680', '["670","680","690","681"]'::jsonb, '{"kind":"numberLine","value":679,"lower":670,"upper":680,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 702 لأقرب عشرة', 702, 10, 'round', '700', '["680","710","699","700"]'::jsonb, '{"kind":"numberLine","value":702,"lower":700,"upper":710,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 742 لأقرب عشرة', 742, 10, 'round', '740', '["720","740","739","750"]'::jsonb, '{"kind":"numberLine","value":742,"lower":740,"upper":750,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 778 لأقرب عشرة', 778, 10, 'round', '780', '["770","781","780","790"]'::jsonb, '{"kind":"numberLine","value":778,"lower":770,"upper":780,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 789 لأقرب عشرة', 789, 10, 'round', '790', '["790","770","780","791"]'::jsonb, '{"kind":"numberLine","value":789,"lower":780,"upper":790,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 797 لأقرب عشرة', 797, 10, 'round', '800', '["780","801","800","790"]'::jsonb, '{"kind":"numberLine","value":797,"lower":790,"upper":800,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 801 لأقرب عشرة', 801, 10, 'round', '800', '["801","780","800","810"]'::jsonb, '{"kind":"numberLine","value":801,"lower":800,"upper":810,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 814 لأقرب عشرة', 814, 10, 'round', '810', '["809","820","810","800"]'::jsonb, '{"kind":"numberLine","value":814,"lower":810,"upper":820,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 818 لأقرب عشرة', 818, 10, 'round', '820', '["810","821","830","820"]'::jsonb, '{"kind":"numberLine","value":818,"lower":810,"upper":820,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 822 لأقرب عشرة', 822, 10, 'round', '820', '["821","830","800","820"]'::jsonb, '{"kind":"numberLine","value":822,"lower":820,"upper":830,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 823 لأقرب عشرة', 823, 10, 'round', '820', '["820","800","830","819"]'::jsonb, '{"kind":"numberLine","value":823,"lower":820,"upper":830,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 837 لأقرب عشرة', 837, 10, 'round', '840', '["830","840","839","820"]'::jsonb, '{"kind":"numberLine","value":837,"lower":830,"upper":840,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 865 لأقرب عشرة', 865, 10, 'round', '870', '["880","860","870","869"]'::jsonb, '{"kind":"numberLine","value":865,"lower":860,"upper":870,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 889 لأقرب عشرة', 889, 10, 'round', '890', '["890","870","891","880"]'::jsonb, '{"kind":"numberLine","value":889,"lower":880,"upper":890,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 902 لأقرب عشرة', 902, 10, 'round', '900', '["901","910","900","890"]'::jsonb, '{"kind":"numberLine","value":902,"lower":900,"upper":910,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 961 لأقرب عشرة', 961, 10, 'round', '960', '["970","961","960","950"]'::jsonb, '{"kind":"numberLine","value":961,"lower":960,"upper":970,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'medium', 'قرّبي العدد 989 لأقرب عشرة', 989, 10, 'round', '990', '["980","990","1000","989"]'::jsonb, '{"kind":"numberLine","value":989,"lower":980,"upper":990,"unit":10}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 112 لأقرب مئة', 112, 100, 'round', '100', '["200","101","110","100"]'::jsonb, '{"kind":"numberLine","value":112,"lower":100,"upper":200,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 125 لأقرب مئة', 125, 100, 'round', '100', '["90","99","200","100"]'::jsonb, '{"kind":"numberLine","value":125,"lower":100,"upper":200,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 153 لأقرب مئة', 153, 100, 'round', '200', '["210","200","100","201"]'::jsonb, '{"kind":"numberLine","value":153,"lower":100,"upper":200,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 186 لأقرب مئة', 186, 100, 'round', '200', '["190","100","201","200"]'::jsonb, '{"kind":"numberLine","value":186,"lower":100,"upper":200,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 197 لأقرب مئة', 197, 100, 'round', '200', '["100","200","210","199"]'::jsonb, '{"kind":"numberLine","value":197,"lower":100,"upper":200,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 198 لأقرب مئة', 198, 100, 'round', '200', '["200","100","199","190"]'::jsonb, '{"kind":"numberLine","value":198,"lower":100,"upper":200,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 213 لأقرب مئة', 213, 100, 'round', '200', '["300","199","210","200"]'::jsonb, '{"kind":"numberLine","value":213,"lower":200,"upper":300,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 221 لأقرب مئة', 221, 100, 'round', '200', '["300","200","199","190"]'::jsonb, '{"kind":"numberLine","value":221,"lower":200,"upper":300,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 223 لأقرب مئة', 223, 100, 'round', '200', '["300","190","199","200"]'::jsonb, '{"kind":"numberLine","value":223,"lower":200,"upper":300,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 240 لأقرب مئة', 240, 100, 'round', '200', '["201","200","300","210"]'::jsonb, '{"kind":"numberLine","value":240,"lower":200,"upper":300,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 271 لأقرب مئة', 271, 100, 'round', '300', '["300","310","299","200"]'::jsonb, '{"kind":"numberLine","value":271,"lower":200,"upper":300,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 287 لأقرب مئة', 287, 100, 'round', '300', '["299","200","300","290"]'::jsonb, '{"kind":"numberLine","value":287,"lower":200,"upper":300,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 293 لأقرب مئة', 293, 100, 'round', '300', '["310","299","300","200"]'::jsonb, '{"kind":"numberLine","value":293,"lower":200,"upper":300,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 301 لأقرب مئة', 301, 100, 'round', '300', '["299","400","310","300"]'::jsonb, '{"kind":"numberLine","value":301,"lower":300,"upper":400,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 323 لأقرب مئة', 323, 100, 'round', '300', '["400","300","299","290"]'::jsonb, '{"kind":"numberLine","value":323,"lower":300,"upper":400,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 332 لأقرب مئة', 332, 100, 'round', '300', '["310","300","400","299"]'::jsonb, '{"kind":"numberLine","value":332,"lower":300,"upper":400,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 359 لأقرب مئة', 359, 100, 'round', '400', '["300","401","400","410"]'::jsonb, '{"kind":"numberLine","value":359,"lower":300,"upper":400,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 439 لأقرب مئة', 439, 100, 'round', '400', '["410","500","400","401"]'::jsonb, '{"kind":"numberLine","value":439,"lower":400,"upper":500,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 451 لأقرب مئة', 451, 100, 'round', '500', '["400","500","499","490"]'::jsonb, '{"kind":"numberLine","value":451,"lower":400,"upper":500,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 483 لأقرب مئة', 483, 100, 'round', '500', '["499","490","400","500"]'::jsonb, '{"kind":"numberLine","value":483,"lower":400,"upper":500,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 485 لأقرب مئة', 485, 100, 'round', '500', '["501","500","490","400"]'::jsonb, '{"kind":"numberLine","value":485,"lower":400,"upper":500,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 495 لأقرب مئة', 495, 100, 'round', '500', '["500","400","501","490"]'::jsonb, '{"kind":"numberLine","value":495,"lower":400,"upper":500,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 519 لأقرب مئة', 519, 100, 'round', '500', '["500","499","510","600"]'::jsonb, '{"kind":"numberLine","value":519,"lower":500,"upper":600,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 520 لأقرب مئة', 520, 100, 'round', '500', '["600","500","490","501"]'::jsonb, '{"kind":"numberLine","value":520,"lower":500,"upper":600,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 542 لأقرب مئة', 542, 100, 'round', '500', '["510","600","501","500"]'::jsonb, '{"kind":"numberLine","value":542,"lower":500,"upper":600,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 558 لأقرب مئة', 558, 100, 'round', '600', '["500","599","600","590"]'::jsonb, '{"kind":"numberLine","value":558,"lower":500,"upper":600,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 589 لأقرب مئة', 589, 100, 'round', '600', '["590","600","601","500"]'::jsonb, '{"kind":"numberLine","value":589,"lower":500,"upper":600,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 622 لأقرب مئة', 622, 100, 'round', '600', '["600","601","590","700"]'::jsonb, '{"kind":"numberLine","value":622,"lower":600,"upper":700,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 649 لأقرب مئة', 649, 100, 'round', '600', '["600","700","599","590"]'::jsonb, '{"kind":"numberLine","value":649,"lower":600,"upper":700,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 714 لأقرب مئة', 714, 100, 'round', '700', '["700","800","710","699"]'::jsonb, '{"kind":"numberLine","value":714,"lower":700,"upper":800,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 736 لأقرب مئة', 736, 100, 'round', '700', '["700","800","701","690"]'::jsonb, '{"kind":"numberLine","value":736,"lower":700,"upper":800,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 741 لأقرب مئة', 741, 100, 'round', '700', '["700","800","699","710"]'::jsonb, '{"kind":"numberLine","value":741,"lower":700,"upper":800,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 753 لأقرب مئة', 753, 100, 'round', '800', '["799","700","790","800"]'::jsonb, '{"kind":"numberLine","value":753,"lower":700,"upper":800,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 756 لأقرب مئة', 756, 100, 'round', '800', '["800","810","799","700"]'::jsonb, '{"kind":"numberLine","value":756,"lower":700,"upper":800,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 764 لأقرب مئة', 764, 100, 'round', '800', '["801","800","790","700"]'::jsonb, '{"kind":"numberLine","value":764,"lower":700,"upper":800,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 801 لأقرب مئة', 801, 100, 'round', '800', '["900","800","790","801"]'::jsonb, '{"kind":"numberLine","value":801,"lower":800,"upper":900,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 823 لأقرب مئة', 823, 100, 'round', '800', '["799","800","790","900"]'::jsonb, '{"kind":"numberLine","value":823,"lower":800,"upper":900,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 832 لأقرب مئة', 832, 100, 'round', '800', '["800","810","900","801"]'::jsonb, '{"kind":"numberLine","value":832,"lower":800,"upper":900,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 862 لأقرب مئة', 862, 100, 'round', '900', '["900","800","901","910"]'::jsonb, '{"kind":"numberLine","value":862,"lower":800,"upper":900,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 865 لأقرب مئة', 865, 100, 'round', '900', '["890","899","900","800"]'::jsonb, '{"kind":"numberLine","value":865,"lower":800,"upper":900,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 874 لأقرب مئة', 874, 100, 'round', '900', '["890","900","800","901"]'::jsonb, '{"kind":"numberLine","value":874,"lower":800,"upper":900,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 876 لأقرب مئة', 876, 100, 'round', '900', '["910","901","800","900"]'::jsonb, '{"kind":"numberLine","value":876,"lower":800,"upper":900,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 890 لأقرب مئة', 890, 100, 'round', '900', '["890","900","800","901"]'::jsonb, '{"kind":"numberLine","value":890,"lower":800,"upper":900,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 891 لأقرب مئة', 891, 100, 'round', '900', '["900","890","899","800"]'::jsonb, '{"kind":"numberLine","value":891,"lower":800,"upper":900,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 902 لأقرب مئة', 902, 100, 'round', '900', '["900","1000","890","899"]'::jsonb, '{"kind":"numberLine","value":902,"lower":900,"upper":1000,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 923 لأقرب مئة', 923, 100, 'round', '900', '["910","900","899","1000"]'::jsonb, '{"kind":"numberLine","value":923,"lower":900,"upper":1000,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 936 لأقرب مئة', 936, 100, 'round', '900', '["910","900","901","1000"]'::jsonb, '{"kind":"numberLine","value":936,"lower":900,"upper":1000,"unit":100}'::jsonb),
  ('rounding', 'rounding', 'hard', 'قرّبي العدد 977 لأقرب مئة', 977, 100, 'round', '1000', '["900","1001","1000","1010"]'::jsonb, '{"kind":"numberLine","value":977,"lower":900,"upper":1000,"unit":100}'::jsonb),
  ('doubling', 'doubling', 'easy', 'ضعف العدد 1 = ؟', 1, null, 'double', '2', '["2","1","3","4"]'::jsonb, '{"kind":"doublingPods","value":1}'::jsonb),
  ('doubling', 'doubling', 'easy', 'ضعف العدد 2 = ؟', 2, null, 'double', '4', '["6","4","14","2"]'::jsonb, '{"kind":"doublingPods","value":2}'::jsonb),
  ('doubling', 'doubling', 'easy', 'ضعف العدد 3 = ؟', 3, null, 'double', '6', '["4","6","3","8"]'::jsonb, '{"kind":"doublingPods","value":3}'::jsonb),
  ('doubling', 'doubling', 'easy', 'ضعف العدد 4 = ؟', 4, null, 'double', '8', '["10","4","6","8"]'::jsonb, '{"kind":"doublingPods","value":4}'::jsonb),
  ('doubling', 'doubling', 'easy', 'ضعف العدد 5 = ؟', 5, null, 'double', '10', '["10","5","8","12"]'::jsonb, '{"kind":"doublingPods","value":5}'::jsonb),
  ('doubling', 'doubling', 'easy', 'ضعف العدد 6 = ؟', 6, null, 'double', '12', '["10","6","12","14"]'::jsonb, '{"kind":"doublingPods","value":6}'::jsonb),
  ('doubling', 'doubling', 'easy', 'ضعف العدد 7 = ؟', 7, null, 'double', '14', '["12","16","7","14"]'::jsonb, '{"kind":"doublingPods","value":7}'::jsonb),
  ('doubling', 'doubling', 'easy', 'ضعف العدد 8 = ؟', 8, null, 'double', '16', '["18","16","8","14"]'::jsonb, '{"kind":"doublingPods","value":8}'::jsonb),
  ('doubling', 'doubling', 'easy', 'ضعف العدد 9 = ؟', 9, null, 'double', '18', '["16","9","18","20"]'::jsonb, '{"kind":"doublingPods","value":9}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 10 = ؟', 10, null, 'double', '20', '["22","18","10","20"]'::jsonb, '{"kind":"doublingPods","value":10}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 11 = ؟', 11, null, 'double', '22', '["20","22","11","24"]'::jsonb, '{"kind":"doublingPods","value":11}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 12 = ؟', 12, null, 'double', '24', '["12","26","22","24"]'::jsonb, '{"kind":"doublingPods","value":12}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 13 = ؟', 13, null, 'double', '26', '["28","13","26","24"]'::jsonb, '{"kind":"doublingPods","value":13}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 14 = ؟', 14, null, 'double', '28', '["26","28","14","30"]'::jsonb, '{"kind":"doublingPods","value":14}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 15 = ؟', 15, null, 'double', '30', '["15","32","28","30"]'::jsonb, '{"kind":"doublingPods","value":15}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 16 = ؟', 16, null, 'double', '32', '["16","34","30","32"]'::jsonb, '{"kind":"doublingPods","value":16}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 17 = ؟', 17, null, 'double', '34', '["32","36","17","34"]'::jsonb, '{"kind":"doublingPods","value":17}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 18 = ؟', 18, null, 'double', '36', '["36","18","38","34"]'::jsonb, '{"kind":"doublingPods","value":18}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 19 = ؟', 19, null, 'double', '38', '["19","38","36","40"]'::jsonb, '{"kind":"doublingPods","value":19}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 20 = ؟', 20, null, 'double', '40', '["40","38","20","42"]'::jsonb, '{"kind":"doublingPods","value":20}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 21 = ؟', 21, null, 'double', '42', '["21","44","42","40"]'::jsonb, '{"kind":"doublingPods","value":21}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 22 = ؟', 22, null, 'double', '44', '["22","44","42","46"]'::jsonb, '{"kind":"doublingPods","value":22}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 23 = ؟', 23, null, 'double', '46', '["46","23","48","44"]'::jsonb, '{"kind":"doublingPods","value":23}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 24 = ؟', 24, null, 'double', '48', '["46","24","50","48"]'::jsonb, '{"kind":"doublingPods","value":24}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 25 = ؟', 25, null, 'double', '50', '["48","25","52","50"]'::jsonb, '{"kind":"doublingPods","value":25}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 26 = ؟', 26, null, 'double', '52', '["52","54","26","50"]'::jsonb, '{"kind":"doublingPods","value":26}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 27 = ؟', 27, null, 'double', '54', '["56","27","52","54"]'::jsonb, '{"kind":"doublingPods","value":27}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 28 = ؟', 28, null, 'double', '56', '["28","54","56","58"]'::jsonb, '{"kind":"doublingPods","value":28}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 29 = ؟', 29, null, 'double', '58', '["60","29","56","58"]'::jsonb, '{"kind":"doublingPods","value":29}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 30 = ؟', 30, null, 'double', '60', '["58","62","60","30"]'::jsonb, '{"kind":"doublingPods","value":30}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 31 = ؟', 31, null, 'double', '62', '["62","64","60","31"]'::jsonb, '{"kind":"doublingPods","value":31}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 32 = ؟', 32, null, 'double', '64', '["62","32","64","66"]'::jsonb, '{"kind":"doublingPods","value":32}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 33 = ؟', 33, null, 'double', '66', '["64","66","68","33"]'::jsonb, '{"kind":"doublingPods","value":33}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 34 = ؟', 34, null, 'double', '68', '["68","70","34","66"]'::jsonb, '{"kind":"doublingPods","value":34}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 35 = ؟', 35, null, 'double', '70', '["70","72","68","35"]'::jsonb, '{"kind":"doublingPods","value":35}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 36 = ؟', 36, null, 'double', '72', '["72","74","70","36"]'::jsonb, '{"kind":"doublingPods","value":36}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 37 = ؟', 37, null, 'double', '74', '["74","76","72","37"]'::jsonb, '{"kind":"doublingPods","value":37}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 38 = ؟', 38, null, 'double', '76', '["74","38","76","78"]'::jsonb, '{"kind":"doublingPods","value":38}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 39 = ؟', 39, null, 'double', '78', '["78","80","76","39"]'::jsonb, '{"kind":"doublingPods","value":39}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 40 = ؟', 40, null, 'double', '80', '["80","78","40","82"]'::jsonb, '{"kind":"doublingPods","value":40}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 41 = ؟', 41, null, 'double', '82', '["80","82","84","41"]'::jsonb, '{"kind":"doublingPods","value":41}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 42 = ؟', 42, null, 'double', '84', '["86","42","84","82"]'::jsonb, '{"kind":"doublingPods","value":42}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 43 = ؟', 43, null, 'double', '86', '["86","88","43","84"]'::jsonb, '{"kind":"doublingPods","value":43}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 44 = ؟', 44, null, 'double', '88', '["88","90","86","44"]'::jsonb, '{"kind":"doublingPods","value":44}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 45 = ؟', 45, null, 'double', '90', '["88","92","45","90"]'::jsonb, '{"kind":"doublingPods","value":45}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 46 = ؟', 46, null, 'double', '92', '["46","94","92","90"]'::jsonb, '{"kind":"doublingPods","value":46}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 47 = ؟', 47, null, 'double', '94', '["47","96","92","94"]'::jsonb, '{"kind":"doublingPods","value":47}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 48 = ؟', 48, null, 'double', '96', '["48","98","96","94"]'::jsonb, '{"kind":"doublingPods","value":48}'::jsonb),
  ('doubling', 'doubling', 'medium', 'ضعف العدد 49 = ؟', 49, null, 'double', '98', '["100","96","49","98"]'::jsonb, '{"kind":"doublingPods","value":49}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 120 = ؟', 120, null, 'double', '240', '["238","240","242","120"]'::jsonb, '{"kind":"doublingPods","value":120}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 131 = ؟', 131, null, 'double', '262', '["262","131","260","264"]'::jsonb, '{"kind":"doublingPods","value":131}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 146 = ؟', 146, null, 'double', '292', '["290","292","294","146"]'::jsonb, '{"kind":"doublingPods","value":146}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 147 = ؟', 147, null, 'double', '294', '["296","294","292","147"]'::jsonb, '{"kind":"doublingPods","value":147}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 163 = ؟', 163, null, 'double', '326', '["163","326","328","324"]'::jsonb, '{"kind":"doublingPods","value":163}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 168 = ؟', 168, null, 'double', '336', '["168","334","338","336"]'::jsonb, '{"kind":"doublingPods","value":168}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 203 = ؟', 203, null, 'double', '406', '["203","406","404","408"]'::jsonb, '{"kind":"doublingPods","value":203}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 204 = ؟', 204, null, 'double', '408', '["204","408","406","410"]'::jsonb, '{"kind":"doublingPods","value":204}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 210 = ؟', 210, null, 'double', '420', '["420","418","422","210"]'::jsonb, '{"kind":"doublingPods","value":210}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 225 = ؟', 225, null, 'double', '450', '["450","225","452","448"]'::jsonb, '{"kind":"doublingPods","value":225}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 229 = ؟', 229, null, 'double', '458', '["458","229","460","456"]'::jsonb, '{"kind":"doublingPods","value":229}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 230 = ؟', 230, null, 'double', '460', '["460","458","462","230"]'::jsonb, '{"kind":"doublingPods","value":230}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 238 = ؟', 238, null, 'double', '476', '["238","476","474","478"]'::jsonb, '{"kind":"doublingPods","value":238}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 240 = ؟', 240, null, 'double', '480', '["478","480","482","240"]'::jsonb, '{"kind":"doublingPods","value":240}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 243 = ؟', 243, null, 'double', '486', '["243","486","488","484"]'::jsonb, '{"kind":"doublingPods","value":243}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 244 = ؟', 244, null, 'double', '488', '["244","488","490","486"]'::jsonb, '{"kind":"doublingPods","value":244}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 247 = ؟', 247, null, 'double', '494', '["494","496","247","492"]'::jsonb, '{"kind":"doublingPods","value":247}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 253 = ؟', 253, null, 'double', '506', '["508","506","253","504"]'::jsonb, '{"kind":"doublingPods","value":253}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 274 = ؟', 274, null, 'double', '548', '["546","274","548","550"]'::jsonb, '{"kind":"doublingPods","value":274}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 277 = ؟', 277, null, 'double', '554', '["277","554","556","552"]'::jsonb, '{"kind":"doublingPods","value":277}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 278 = ؟', 278, null, 'double', '556', '["558","556","554","278"]'::jsonb, '{"kind":"doublingPods","value":278}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 281 = ؟', 281, null, 'double', '562', '["281","560","564","562"]'::jsonb, '{"kind":"doublingPods","value":281}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 283 = ؟', 283, null, 'double', '566', '["564","566","283","568"]'::jsonb, '{"kind":"doublingPods","value":283}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 324 = ؟', 324, null, 'double', '648', '["646","324","650","648"]'::jsonb, '{"kind":"doublingPods","value":324}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 333 = ؟', 333, null, 'double', '666', '["666","333","664","668"]'::jsonb, '{"kind":"doublingPods","value":333}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 345 = ؟', 345, null, 'double', '690', '["688","692","690","345"]'::jsonb, '{"kind":"doublingPods","value":345}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 347 = ؟', 347, null, 'double', '694', '["696","692","694","347"]'::jsonb, '{"kind":"doublingPods","value":347}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 351 = ؟', 351, null, 'double', '702', '["351","702","704","700"]'::jsonb, '{"kind":"doublingPods","value":351}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 353 = ؟', 353, null, 'double', '706', '["706","353","704","708"]'::jsonb, '{"kind":"doublingPods","value":353}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 355 = ؟', 355, null, 'double', '710', '["710","712","708","355"]'::jsonb, '{"kind":"doublingPods","value":355}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 372 = ؟', 372, null, 'double', '744', '["744","742","746","372"]'::jsonb, '{"kind":"doublingPods","value":372}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 378 = ؟', 378, null, 'double', '756', '["378","754","758","756"]'::jsonb, '{"kind":"doublingPods","value":378}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 386 = ؟', 386, null, 'double', '772', '["386","772","774","770"]'::jsonb, '{"kind":"doublingPods","value":386}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 390 = ؟', 390, null, 'double', '780', '["390","782","780","778"]'::jsonb, '{"kind":"doublingPods","value":390}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 391 = ؟', 391, null, 'double', '782', '["780","784","391","782"]'::jsonb, '{"kind":"doublingPods","value":391}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 407 = ؟', 407, null, 'double', '814', '["814","816","812","407"]'::jsonb, '{"kind":"doublingPods","value":407}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 426 = ؟', 426, null, 'double', '852', '["854","852","850","426"]'::jsonb, '{"kind":"doublingPods","value":426}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 436 = ؟', 436, null, 'double', '872', '["436","872","870","874"]'::jsonb, '{"kind":"doublingPods","value":436}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 438 = ؟', 438, null, 'double', '876', '["438","878","874","876"]'::jsonb, '{"kind":"doublingPods","value":438}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 440 = ؟', 440, null, 'double', '880', '["880","878","440","882"]'::jsonb, '{"kind":"doublingPods","value":440}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 450 = ؟', 450, null, 'double', '900', '["898","450","902","900"]'::jsonb, '{"kind":"doublingPods","value":450}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 455 = ؟', 455, null, 'double', '910', '["912","908","910","455"]'::jsonb, '{"kind":"doublingPods","value":455}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 465 = ؟', 465, null, 'double', '930', '["932","930","465","928"]'::jsonb, '{"kind":"doublingPods","value":465}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 470 = ؟', 470, null, 'double', '940', '["942","470","940","938"]'::jsonb, '{"kind":"doublingPods","value":470}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 483 = ؟', 483, null, 'double', '966', '["964","966","483","968"]'::jsonb, '{"kind":"doublingPods","value":483}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 485 = ؟', 485, null, 'double', '970', '["968","485","970","972"]'::jsonb, '{"kind":"doublingPods","value":485}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 492 = ؟', 492, null, 'double', '984', '["984","986","982","492"]'::jsonb, '{"kind":"doublingPods","value":492}'::jsonb),
  ('doubling', 'doubling', 'hard', 'ضعف العدد 493 = ؟', 493, null, 'double', '986', '["493","986","984","988"]'::jsonb, '{"kind":"doublingPods","value":493}'::jsonb)
on conflict (game_id, question_text) do nothing;
-- PHASE3-END ==================================================================


-- PHASE4-BEGIN ================================================================
-- ============================================================================
-- المرحلة الرابعة — إضافة «مغامرة الترتيب التصاعدي» و«مغامرة الترتيب التنازلي»
-- إلى قسم «ألعب»، بنفس محرّك الجمع/الطرح/التقريب/الضعف (GamePage.tsx عام، لا
-- يعرف شيئًا عن أي مهارة بعينها) وبنفس مستويات الخانات المستخدمة في «اختبر»
-- و«اكتشف»: سهل = رقم واحد (١–٩)، متوسط = رقمان (١٠–٩٩)، صعب = ثلاث أرقام
-- (١٠٠–٩٩٩).
--
-- شغّلي هذا الملف مرة واحدة على قاعدتك، ثم supabase/game_bank.sql (المُولَّد من
-- node scripts/generate-game-bank.mjs، ويتضمن الآن أسئلة الترتيب أيضًا).
-- آمن للتشغيل أكثر من مرة (create or replace / on conflict do nothing) ولا
-- يحذف ولا يعدّل أي بيانات موجودة.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) صفّا الكتالوج الجديدان — نفس فلسفة المكافأة (مرة واحدة طوال العمر، عدد
--     النجوم = عدد الإجابات الصحيحة في أول محاولة مكتملة).
-- ----------------------------------------------------------------------------
insert into public.play_games (id, title, skill) values
  ('ascending-order', 'مغامرة الترتيب التصاعدي', 'ascending_order'),
  ('descending-order', 'مغامرة الترتيب التنازلي', 'descending_order')
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- (2) دالة تحسب الترتيب الصحيح (تصاعديًا أو تنازليًا) لأربعة أعداد داخل visual،
--     ليُستخدَم قيد game_questions_math_ok أدناه في التحقق من صحة الإجابة —
--     فلا يمكن لسؤال ترتيب خاطئ الإجابة أن يدخل البنك حتى لو أُضيف يدويًا لاحقًا،
--     تمامًا كما تفعل بقية القيود للجمع/الطرح/التقريب/الضعف.
-- ----------------------------------------------------------------------------
create or replace function public.game_order_correct_answer(p_numbers jsonb, p_descending boolean)
returns text
language sql
immutable
as $$
  select string_agg(x, ', ' order by (x::numeric) * case when p_descending then -1 else 1 end)
  from jsonb_array_elements_text(p_numbers) as x;
$$;

revoke all on function public.game_order_correct_answer(jsonb, boolean) from public, anon, authenticated;

-- عدد العناصر المختلفة في مصفوفة jsonb نصية — دالة منفصلة لأن قيود CHECK في
-- PostgreSQL لا تقبل استعلامات فرعية (subquery) مباشرة داخلها، فقط استدعاء دالة.
create or replace function public.jsonb_text_array_distinct_count(p_arr jsonb)
returns integer
language sql
immutable
as $$
  select count(distinct x) from jsonb_array_elements_text(p_arr) as x;
$$;

revoke all on function public.jsonb_text_array_distinct_count(jsonb) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- (3) توسيع بنك الأسئلة: عمليتان جديدتان order_asc/order_desc، وتوسيع قيد
--     الصحة الرياضية ليشملهما — الإجابة الصحيحة يجب أن تطابق الترتيب الفعلي
--     للأعداد الأربعة المخزَّنة في visual->'numbers'، وإلا رفضت القاعدة الإدراج.
--     operand_b يبقى فارغًا هنا (كما في الضعف — لا مُعامل ثانيًا)، وoperand_a هو
--     أول عدد معروض فقط (بلا معنى حسابي، فقط لتحقيق NOT NULL على العمود).
-- ----------------------------------------------------------------------------
alter table public.game_questions drop constraint if exists game_questions_operator_check;
alter table public.game_questions add constraint game_questions_operator_check
  check (operator in ('+', '-', 'round', 'double', 'order_asc', 'order_desc')) not valid;

alter table public.game_questions drop constraint if exists game_questions_math_ok;
alter table public.game_questions add constraint game_questions_math_ok check (
    (operator = '+'
       and operand_b is not null
       and (operand_a % 10) + (operand_b % 10) <= 9
       and (operand_a / 10) + (operand_b / 10) <= 9
       and correct_answer = (operand_a + operand_b)::text)
    or
    (operator = '-'
       and operand_b is not null
       and (operand_a % 10) >= (operand_b % 10)
       and (operand_a / 10) >= (operand_b / 10)
       and operand_a > operand_b
       and correct_answer = (operand_a - operand_b)::text)
    or
    (operator = 'round'
       and operand_b in (10, 100)
       and operand_a % operand_b <> 0
       and correct_answer = (
             case when operand_a % operand_b >= operand_b / 2
                  then (operand_a / operand_b + 1) * operand_b
                  else (operand_a / operand_b) * operand_b
             end
           )::text)
    or
    (operator = 'double'
       and operand_b is null
       and correct_answer = (operand_a * 2)::text)
    or
    -- الترتيب: أربعة أعداد مختلفة في visual->'numbers'، والإجابة الصحيحة هي
    -- ترتيبها الفعلي (تصاعديًا أو تنازليًا حسب العملية) — محسوبة هنا لا مُدخَلة يدويًا.
    (operator in ('order_asc', 'order_desc')
       and operand_b is null
       and jsonb_typeof(visual -> 'numbers') = 'array'
       and jsonb_array_length(visual -> 'numbers') = 4
       and public.jsonb_text_array_distinct_count(visual -> 'numbers') = 4
       and correct_answer = public.game_order_correct_answer(visual -> 'numbers', operator = 'order_desc'))
  ) not valid;


-- ----------------------------------------------------------------------------
-- (4) لا شيء آخر يحتاج تعديلًا: start_game_attempt / record_game_answer /
--     complete_game_attempt عامّة بالفعل (لا تعرف شيئًا عن عملية بعينها)، وترتيب
--     الخيارات عشوائي لكل محاولة تلقائيًا (shuffle_jsonb_array) — فلا تكون
--     الإجابة الصحيحة دائمًا في نفس المكان، هنا كما في كل لعبة أخرى.
--     game_attempt_questions لا يفرض قائمة عمليات مسموحة (عمود operator نص حر)،
--     فلا حاجة لتعديله.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- بنك أسئلة مغامرتي الترتيب التصاعدي والتنازلي — مُستخرَج من game_bank.sql
-- (المُولَّد آليًا: node scripts/generate-game-bank.mjs). آمن للتشغيل أكثر من
-- مرة (on conflict do nothing).
-- ============================================================================
insert into public.game_questions
  (game_id, skill, difficulty, question_text, operand_a, operand_b, operator, correct_answer, options, visual)
values
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 4, 1, 8, 6', 4, null, 'order_asc', '1, 4, 6, 8', '["4, 1, 6, 8","8, 6, 4, 1","1, 6, 4, 8","1, 4, 6, 8"]'::jsonb, '{"kind":"chips","numbers":[4,1,8,6]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 6, 4, 5, 3', 6, null, 'order_asc', '3, 4, 5, 6', '["6, 5, 4, 3","3, 5, 4, 6","3, 4, 5, 6","4, 3, 5, 6"]'::jsonb, '{"kind":"chips","numbers":[6,4,5,3]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 1, 8, 5, 4', 1, null, 'order_asc', '1, 4, 5, 8', '["1, 5, 4, 8","4, 1, 5, 8","8, 5, 4, 1","1, 4, 5, 8"]'::jsonb, '{"kind":"chips","numbers":[1,8,5,4]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 4, 8, 7, 5', 4, null, 'order_asc', '4, 5, 7, 8', '["8, 7, 5, 4","4, 7, 5, 8","5, 4, 7, 8","4, 5, 7, 8"]'::jsonb, '{"kind":"chips","numbers":[4,8,7,5]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 9, 3, 6, 1', 9, null, 'order_asc', '1, 3, 6, 9', '["9, 6, 3, 1","1, 6, 3, 9","1, 3, 6, 9","3, 1, 6, 9"]'::jsonb, '{"kind":"chips","numbers":[9,3,6,1]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 7, 6, 3, 5', 7, null, 'order_asc', '3, 5, 6, 7', '["5, 3, 6, 7","7, 6, 5, 3","3, 6, 5, 7","3, 5, 6, 7"]'::jsonb, '{"kind":"chips","numbers":[7,6,3,5]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 4, 5, 2, 1', 4, null, 'order_asc', '1, 2, 4, 5', '["1, 4, 2, 5","1, 2, 4, 5","2, 1, 4, 5","5, 4, 2, 1"]'::jsonb, '{"kind":"chips","numbers":[4,5,2,1]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 5, 4, 1, 6', 5, null, 'order_asc', '1, 4, 5, 6', '["6, 5, 4, 1","1, 4, 5, 6","1, 5, 4, 6","4, 1, 5, 6"]'::jsonb, '{"kind":"chips","numbers":[5,4,1,6]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 8, 1, 7, 2', 8, null, 'order_asc', '1, 2, 7, 8', '["1, 7, 2, 8","1, 2, 7, 8","8, 7, 2, 1","2, 1, 7, 8"]'::jsonb, '{"kind":"chips","numbers":[8,1,7,2]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 8, 4, 9, 6', 8, null, 'order_asc', '4, 6, 8, 9', '["6, 4, 8, 9","4, 6, 8, 9","9, 8, 6, 4","4, 8, 6, 9"]'::jsonb, '{"kind":"chips","numbers":[8,4,9,6]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 7, 9, 1, 4', 7, null, 'order_asc', '1, 4, 7, 9', '["1, 7, 4, 9","4, 1, 7, 9","1, 4, 7, 9","9, 7, 4, 1"]'::jsonb, '{"kind":"chips","numbers":[7,9,1,4]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 8, 3, 5, 1', 8, null, 'order_asc', '1, 3, 5, 8', '["1, 3, 5, 8","3, 1, 5, 8","1, 5, 3, 8","8, 5, 3, 1"]'::jsonb, '{"kind":"chips","numbers":[8,3,5,1]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 5, 3, 8, 2', 5, null, 'order_asc', '2, 3, 5, 8', '["3, 2, 5, 8","2, 5, 3, 8","2, 3, 5, 8","8, 5, 3, 2"]'::jsonb, '{"kind":"chips","numbers":[5,3,8,2]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 6, 9, 7, 2', 6, null, 'order_asc', '2, 6, 7, 9', '["2, 7, 6, 9","9, 7, 6, 2","6, 2, 7, 9","2, 6, 7, 9"]'::jsonb, '{"kind":"chips","numbers":[6,9,7,2]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 2, 5, 3, 6', 2, null, 'order_asc', '2, 3, 5, 6', '["2, 3, 5, 6","6, 5, 3, 2","2, 5, 3, 6","3, 2, 5, 6"]'::jsonb, '{"kind":"chips","numbers":[2,5,3,6]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 9, 8, 4, 7', 9, null, 'order_asc', '4, 7, 8, 9', '["4, 8, 7, 9","9, 8, 7, 4","4, 7, 8, 9","7, 4, 8, 9"]'::jsonb, '{"kind":"chips","numbers":[9,8,4,7]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 4, 3, 1, 6', 4, null, 'order_asc', '1, 3, 4, 6', '["1, 3, 4, 6","6, 4, 3, 1","1, 4, 3, 6","3, 1, 4, 6"]'::jsonb, '{"kind":"chips","numbers":[4,3,1,6]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 9, 8, 2, 4', 9, null, 'order_asc', '2, 4, 8, 9', '["2, 8, 4, 9","9, 8, 4, 2","2, 4, 8, 9","4, 2, 8, 9"]'::jsonb, '{"kind":"chips","numbers":[9,8,2,4]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 2, 8, 7, 5', 2, null, 'order_asc', '2, 5, 7, 8', '["8, 7, 5, 2","2, 7, 5, 8","2, 5, 7, 8","5, 2, 7, 8"]'::jsonb, '{"kind":"chips","numbers":[2,8,7,5]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 7, 4, 1, 2', 7, null, 'order_asc', '1, 2, 4, 7', '["1, 2, 4, 7","2, 1, 4, 7","1, 4, 2, 7","7, 4, 2, 1"]'::jsonb, '{"kind":"chips","numbers":[7,4,1,2]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 9, 6, 7, 3', 9, null, 'order_asc', '3, 6, 7, 9', '["3, 7, 6, 9","9, 7, 6, 3","3, 6, 7, 9","6, 3, 7, 9"]'::jsonb, '{"kind":"chips","numbers":[9,6,7,3]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 4, 9, 8, 5', 4, null, 'order_asc', '4, 5, 8, 9', '["5, 4, 8, 9","4, 5, 8, 9","9, 8, 5, 4","4, 8, 5, 9"]'::jsonb, '{"kind":"chips","numbers":[4,9,8,5]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 8, 9, 1, 7', 8, null, 'order_asc', '1, 7, 8, 9', '["7, 1, 8, 9","9, 8, 7, 1","1, 8, 7, 9","1, 7, 8, 9"]'::jsonb, '{"kind":"chips","numbers":[8,9,1,7]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 9, 6, 7, 5', 9, null, 'order_asc', '5, 6, 7, 9', '["5, 6, 7, 9","9, 7, 6, 5","6, 5, 7, 9","5, 7, 6, 9"]'::jsonb, '{"kind":"chips","numbers":[9,6,7,5]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 7, 2, 3, 1', 7, null, 'order_asc', '1, 2, 3, 7', '["1, 3, 2, 7","1, 2, 3, 7","2, 1, 3, 7","7, 3, 2, 1"]'::jsonb, '{"kind":"chips","numbers":[7,2,3,1]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 5, 2, 9, 4', 5, null, 'order_asc', '2, 4, 5, 9', '["2, 5, 4, 9","2, 4, 5, 9","4, 2, 5, 9","9, 5, 4, 2"]'::jsonb, '{"kind":"chips","numbers":[5,2,9,4]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 4, 8, 7, 3', 4, null, 'order_asc', '3, 4, 7, 8', '["4, 3, 7, 8","3, 4, 7, 8","3, 7, 4, 8","8, 7, 4, 3"]'::jsonb, '{"kind":"chips","numbers":[4,8,7,3]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 3, 7, 1, 8', 3, null, 'order_asc', '1, 3, 7, 8', '["1, 7, 3, 8","3, 1, 7, 8","1, 3, 7, 8","8, 7, 3, 1"]'::jsonb, '{"kind":"chips","numbers":[3,7,1,8]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 3, 8, 1, 9', 3, null, 'order_asc', '1, 3, 8, 9', '["9, 8, 3, 1","1, 8, 3, 9","1, 3, 8, 9","3, 1, 8, 9"]'::jsonb, '{"kind":"chips","numbers":[3,8,1,9]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 5, 3, 1, 6', 5, null, 'order_asc', '1, 3, 5, 6', '["1, 3, 5, 6","6, 5, 3, 1","1, 5, 3, 6","3, 1, 5, 6"]'::jsonb, '{"kind":"chips","numbers":[5,3,1,6]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 5, 7, 8, 6', 5, null, 'order_asc', '5, 6, 7, 8', '["5, 7, 6, 8","8, 7, 6, 5","6, 5, 7, 8","5, 6, 7, 8"]'::jsonb, '{"kind":"chips","numbers":[5,7,8,6]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 7, 5, 1, 8', 7, null, 'order_asc', '1, 5, 7, 8', '["8, 7, 5, 1","1, 7, 5, 8","5, 1, 7, 8","1, 5, 7, 8"]'::jsonb, '{"kind":"chips","numbers":[7,5,1,8]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 2, 5, 8, 4', 2, null, 'order_asc', '2, 4, 5, 8', '["4, 2, 5, 8","2, 5, 4, 8","2, 4, 5, 8","8, 5, 4, 2"]'::jsonb, '{"kind":"chips","numbers":[2,5,8,4]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 4, 9, 1, 6', 4, null, 'order_asc', '1, 4, 6, 9', '["9, 6, 4, 1","4, 1, 6, 9","1, 6, 4, 9","1, 4, 6, 9"]'::jsonb, '{"kind":"chips","numbers":[4,9,1,6]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 4, 5, 3, 8', 4, null, 'order_asc', '3, 4, 5, 8', '["8, 5, 4, 3","3, 5, 4, 8","4, 3, 5, 8","3, 4, 5, 8"]'::jsonb, '{"kind":"chips","numbers":[4,5,3,8]}'::jsonb),
  ('ascending-order', 'ascending_order', 'easy', 'رتّبي الأعداد التالية تصاعديًا: 2, 1, 3, 8', 2, null, 'order_asc', '1, 2, 3, 8', '["1, 2, 3, 8","1, 3, 2, 8","8, 3, 2, 1","2, 1, 3, 8"]'::jsonb, '{"kind":"chips","numbers":[2,1,3,8]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 35, 30, 90, 57', 35, null, 'order_asc', '30, 35, 57, 90', '["90, 57, 35, 30","30, 35, 57, 90","30, 57, 35, 90","35, 30, 57, 90"]'::jsonb, '{"kind":"chips","numbers":[35,30,90,57]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 52, 66, 67, 56', 52, null, 'order_asc', '52, 56, 66, 67', '["67, 66, 56, 52","52, 56, 66, 67","56, 52, 66, 67","52, 66, 56, 67"]'::jsonb, '{"kind":"chips","numbers":[52,66,67,56]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 15, 48, 58, 30', 15, null, 'order_asc', '15, 30, 48, 58', '["58, 48, 30, 15","30, 15, 48, 58","15, 48, 30, 58","15, 30, 48, 58"]'::jsonb, '{"kind":"chips","numbers":[15,48,58,30]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 58, 44, 80, 52', 58, null, 'order_asc', '44, 52, 58, 80', '["80, 58, 52, 44","52, 44, 58, 80","44, 52, 58, 80","44, 58, 52, 80"]'::jsonb, '{"kind":"chips","numbers":[58,44,80,52]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 41, 84, 38, 44', 41, null, 'order_asc', '38, 41, 44, 84', '["41, 38, 44, 84","84, 44, 41, 38","38, 41, 44, 84","38, 44, 41, 84"]'::jsonb, '{"kind":"chips","numbers":[41,84,38,44]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 13, 22, 55, 24', 13, null, 'order_asc', '13, 22, 24, 55', '["13, 24, 22, 55","13, 22, 24, 55","55, 24, 22, 13","22, 13, 24, 55"]'::jsonb, '{"kind":"chips","numbers":[13,22,55,24]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 53, 35, 89, 25', 53, null, 'order_asc', '25, 35, 53, 89', '["89, 53, 35, 25","25, 35, 53, 89","35, 25, 53, 89","25, 53, 35, 89"]'::jsonb, '{"kind":"chips","numbers":[53,35,89,25]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 10, 88, 86, 51', 10, null, 'order_asc', '10, 51, 86, 88', '["10, 51, 86, 88","51, 10, 86, 88","10, 86, 51, 88","88, 86, 51, 10"]'::jsonb, '{"kind":"chips","numbers":[10,88,86,51]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 13, 71, 87, 28', 13, null, 'order_asc', '13, 28, 71, 87', '["13, 71, 28, 87","28, 13, 71, 87","87, 71, 28, 13","13, 28, 71, 87"]'::jsonb, '{"kind":"chips","numbers":[13,71,87,28]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 90, 73, 74, 83', 90, null, 'order_asc', '73, 74, 83, 90', '["73, 83, 74, 90","90, 83, 74, 73","74, 73, 83, 90","73, 74, 83, 90"]'::jsonb, '{"kind":"chips","numbers":[90,73,74,83]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 86, 42, 31, 91', 86, null, 'order_asc', '31, 42, 86, 91', '["31, 42, 86, 91","91, 86, 42, 31","42, 31, 86, 91","31, 86, 42, 91"]'::jsonb, '{"kind":"chips","numbers":[86,42,31,91]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 71, 42, 47, 79', 71, null, 'order_asc', '42, 47, 71, 79', '["79, 71, 47, 42","42, 47, 71, 79","42, 71, 47, 79","47, 42, 71, 79"]'::jsonb, '{"kind":"chips","numbers":[71,42,47,79]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 92, 10, 73, 24', 92, null, 'order_asc', '10, 24, 73, 92', '["10, 73, 24, 92","24, 10, 73, 92","92, 73, 24, 10","10, 24, 73, 92"]'::jsonb, '{"kind":"chips","numbers":[92,10,73,24]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 66, 88, 98, 92', 66, null, 'order_asc', '66, 88, 92, 98', '["66, 88, 92, 98","88, 66, 92, 98","66, 92, 88, 98","98, 92, 88, 66"]'::jsonb, '{"kind":"chips","numbers":[66,88,98,92]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 93, 17, 35, 81', 93, null, 'order_asc', '17, 35, 81, 93', '["93, 81, 35, 17","35, 17, 81, 93","17, 81, 35, 93","17, 35, 81, 93"]'::jsonb, '{"kind":"chips","numbers":[93,17,35,81]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 33, 71, 27, 58', 33, null, 'order_asc', '27, 33, 58, 71', '["71, 58, 33, 27","27, 33, 58, 71","27, 58, 33, 71","33, 27, 58, 71"]'::jsonb, '{"kind":"chips","numbers":[33,71,27,58]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 83, 18, 30, 29', 83, null, 'order_asc', '18, 29, 30, 83', '["18, 30, 29, 83","29, 18, 30, 83","83, 30, 29, 18","18, 29, 30, 83"]'::jsonb, '{"kind":"chips","numbers":[83,18,30,29]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 54, 37, 31, 94', 54, null, 'order_asc', '31, 37, 54, 94', '["31, 37, 54, 94","94, 54, 37, 31","31, 54, 37, 94","37, 31, 54, 94"]'::jsonb, '{"kind":"chips","numbers":[54,37,31,94]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 13, 68, 18, 73', 13, null, 'order_asc', '13, 18, 68, 73', '["18, 13, 68, 73","13, 68, 18, 73","13, 18, 68, 73","73, 68, 18, 13"]'::jsonb, '{"kind":"chips","numbers":[13,68,18,73]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 76, 40, 57, 35', 76, null, 'order_asc', '35, 40, 57, 76', '["35, 40, 57, 76","76, 57, 40, 35","35, 57, 40, 76","40, 35, 57, 76"]'::jsonb, '{"kind":"chips","numbers":[76,40,57,35]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 62, 98, 99, 45', 62, null, 'order_asc', '45, 62, 98, 99', '["62, 45, 98, 99","45, 98, 62, 99","99, 98, 62, 45","45, 62, 98, 99"]'::jsonb, '{"kind":"chips","numbers":[62,98,99,45]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 37, 65, 81, 13', 37, null, 'order_asc', '13, 37, 65, 81', '["13, 65, 37, 81","13, 37, 65, 81","37, 13, 65, 81","81, 65, 37, 13"]'::jsonb, '{"kind":"chips","numbers":[37,65,81,13]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 49, 63, 44, 39', 49, null, 'order_asc', '39, 44, 49, 63', '["39, 44, 49, 63","44, 39, 49, 63","63, 49, 44, 39","39, 49, 44, 63"]'::jsonb, '{"kind":"chips","numbers":[49,63,44,39]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 86, 10, 31, 88', 86, null, 'order_asc', '10, 31, 86, 88', '["10, 86, 31, 88","10, 31, 86, 88","31, 10, 86, 88","88, 86, 31, 10"]'::jsonb, '{"kind":"chips","numbers":[86,10,31,88]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 18, 43, 95, 72', 18, null, 'order_asc', '18, 43, 72, 95', '["43, 18, 72, 95","18, 72, 43, 95","95, 72, 43, 18","18, 43, 72, 95"]'::jsonb, '{"kind":"chips","numbers":[18,43,95,72]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 14, 38, 21, 22', 14, null, 'order_asc', '14, 21, 22, 38', '["21, 14, 22, 38","14, 21, 22, 38","14, 22, 21, 38","38, 22, 21, 14"]'::jsonb, '{"kind":"chips","numbers":[14,38,21,22]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 67, 58, 99, 81', 67, null, 'order_asc', '58, 67, 81, 99', '["58, 81, 67, 99","58, 67, 81, 99","67, 58, 81, 99","99, 81, 67, 58"]'::jsonb, '{"kind":"chips","numbers":[67,58,99,81]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 32, 54, 64, 35', 32, null, 'order_asc', '32, 35, 54, 64', '["64, 54, 35, 32","32, 54, 35, 64","35, 32, 54, 64","32, 35, 54, 64"]'::jsonb, '{"kind":"chips","numbers":[32,54,64,35]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 89, 50, 72, 58', 89, null, 'order_asc', '50, 58, 72, 89', '["50, 72, 58, 89","58, 50, 72, 89","50, 58, 72, 89","89, 72, 58, 50"]'::jsonb, '{"kind":"chips","numbers":[89,50,72,58]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 85, 46, 50, 84', 85, null, 'order_asc', '46, 50, 84, 85', '["46, 84, 50, 85","46, 50, 84, 85","50, 46, 84, 85","85, 84, 50, 46"]'::jsonb, '{"kind":"chips","numbers":[85,46,50,84]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 35, 12, 39, 42', 35, null, 'order_asc', '12, 35, 39, 42', '["35, 12, 39, 42","12, 35, 39, 42","42, 39, 35, 12","12, 39, 35, 42"]'::jsonb, '{"kind":"chips","numbers":[35,12,39,42]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 10, 62, 74, 50', 10, null, 'order_asc', '10, 50, 62, 74', '["10, 62, 50, 74","10, 50, 62, 74","74, 62, 50, 10","50, 10, 62, 74"]'::jsonb, '{"kind":"chips","numbers":[10,62,74,50]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 69, 93, 90, 17', 69, null, 'order_asc', '17, 69, 90, 93', '["17, 90, 69, 93","17, 69, 90, 93","93, 90, 69, 17","69, 17, 90, 93"]'::jsonb, '{"kind":"chips","numbers":[69,93,90,17]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 27, 67, 30, 21', 27, null, 'order_asc', '21, 27, 30, 67', '["27, 21, 30, 67","21, 30, 27, 67","21, 27, 30, 67","67, 30, 27, 21"]'::jsonb, '{"kind":"chips","numbers":[27,67,30,21]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 33, 14, 83, 39', 33, null, 'order_asc', '14, 33, 39, 83', '["14, 39, 33, 83","33, 14, 39, 83","14, 33, 39, 83","83, 39, 33, 14"]'::jsonb, '{"kind":"chips","numbers":[33,14,83,39]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 33, 52, 73, 46', 33, null, 'order_asc', '33, 46, 52, 73', '["33, 46, 52, 73","73, 52, 46, 33","46, 33, 52, 73","33, 52, 46, 73"]'::jsonb, '{"kind":"chips","numbers":[33,52,73,46]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 88, 87, 67, 83', 88, null, 'order_asc', '67, 83, 87, 88', '["88, 87, 83, 67","67, 87, 83, 88","67, 83, 87, 88","83, 67, 87, 88"]'::jsonb, '{"kind":"chips","numbers":[88,87,67,83]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 15, 68, 95, 13', 15, null, 'order_asc', '13, 15, 68, 95', '["13, 68, 15, 95","15, 13, 68, 95","95, 68, 15, 13","13, 15, 68, 95"]'::jsonb, '{"kind":"chips","numbers":[15,68,95,13]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 13, 50, 21, 38', 13, null, 'order_asc', '13, 21, 38, 50', '["13, 21, 38, 50","50, 38, 21, 13","21, 13, 38, 50","13, 38, 21, 50"]'::jsonb, '{"kind":"chips","numbers":[13,50,21,38]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 44, 42, 53, 92', 44, null, 'order_asc', '42, 44, 53, 92', '["92, 53, 44, 42","44, 42, 53, 92","42, 44, 53, 92","42, 53, 44, 92"]'::jsonb, '{"kind":"chips","numbers":[44,42,53,92]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 22, 26, 41, 40', 22, null, 'order_asc', '22, 26, 40, 41', '["22, 26, 40, 41","41, 40, 26, 22","22, 40, 26, 41","26, 22, 40, 41"]'::jsonb, '{"kind":"chips","numbers":[22,26,41,40]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 72, 66, 24, 87', 72, null, 'order_asc', '24, 66, 72, 87', '["87, 72, 66, 24","24, 66, 72, 87","24, 72, 66, 87","66, 24, 72, 87"]'::jsonb, '{"kind":"chips","numbers":[72,66,24,87]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 46, 12, 95, 60', 46, null, 'order_asc', '12, 46, 60, 95', '["12, 60, 46, 95","12, 46, 60, 95","46, 12, 60, 95","95, 60, 46, 12"]'::jsonb, '{"kind":"chips","numbers":[46,12,95,60]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 77, 61, 91, 28', 77, null, 'order_asc', '28, 61, 77, 91', '["61, 28, 77, 91","28, 77, 61, 91","91, 77, 61, 28","28, 61, 77, 91"]'::jsonb, '{"kind":"chips","numbers":[77,61,91,28]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 81, 65, 68, 58', 81, null, 'order_asc', '58, 65, 68, 81', '["58, 65, 68, 81","81, 68, 65, 58","65, 58, 68, 81","58, 68, 65, 81"]'::jsonb, '{"kind":"chips","numbers":[81,65,68,58]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 81, 96, 72, 23', 81, null, 'order_asc', '23, 72, 81, 96', '["23, 72, 81, 96","23, 81, 72, 96","72, 23, 81, 96","96, 81, 72, 23"]'::jsonb, '{"kind":"chips","numbers":[81,96,72,23]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 35, 21, 32, 28', 35, null, 'order_asc', '21, 28, 32, 35', '["35, 32, 28, 21","21, 32, 28, 35","28, 21, 32, 35","21, 28, 32, 35"]'::jsonb, '{"kind":"chips","numbers":[35,21,32,28]}'::jsonb),
  ('ascending-order', 'ascending_order', 'medium', 'رتّبي الأعداد التالية تصاعديًا: 69, 67, 17, 64', 69, null, 'order_asc', '17, 64, 67, 69', '["64, 17, 67, 69","17, 67, 64, 69","17, 64, 67, 69","69, 67, 64, 17"]'::jsonb, '{"kind":"chips","numbers":[69,67,17,64]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 269, 191, 795, 680', 269, null, 'order_asc', '191, 269, 680, 795', '["191, 680, 269, 795","795, 680, 269, 191","269, 191, 680, 795","191, 269, 680, 795"]'::jsonb, '{"kind":"chips","numbers":[269,191,795,680]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 550, 483, 471, 695', 550, null, 'order_asc', '471, 483, 550, 695', '["471, 483, 550, 695","483, 471, 550, 695","695, 550, 483, 471","471, 550, 483, 695"]'::jsonb, '{"kind":"chips","numbers":[550,483,471,695]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 622, 795, 467, 153', 622, null, 'order_asc', '153, 467, 622, 795', '["795, 622, 467, 153","153, 622, 467, 795","153, 467, 622, 795","467, 153, 622, 795"]'::jsonb, '{"kind":"chips","numbers":[622,795,467,153]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 998, 153, 126, 711', 998, null, 'order_asc', '126, 153, 711, 998', '["153, 126, 711, 998","126, 153, 711, 998","126, 711, 153, 998","998, 711, 153, 126"]'::jsonb, '{"kind":"chips","numbers":[998,153,126,711]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 432, 106, 196, 729', 432, null, 'order_asc', '106, 196, 432, 729', '["106, 196, 432, 729","106, 432, 196, 729","729, 432, 196, 106","196, 106, 432, 729"]'::jsonb, '{"kind":"chips","numbers":[432,106,196,729]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 519, 162, 140, 783', 519, null, 'order_asc', '140, 162, 519, 783', '["162, 140, 519, 783","140, 519, 162, 783","783, 519, 162, 140","140, 162, 519, 783"]'::jsonb, '{"kind":"chips","numbers":[519,162,140,783]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 216, 467, 167, 892', 216, null, 'order_asc', '167, 216, 467, 892', '["167, 216, 467, 892","216, 167, 467, 892","167, 467, 216, 892","892, 467, 216, 167"]'::jsonb, '{"kind":"chips","numbers":[216,467,167,892]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 625, 532, 889, 987', 625, null, 'order_asc', '532, 625, 889, 987', '["532, 625, 889, 987","625, 532, 889, 987","987, 889, 625, 532","532, 889, 625, 987"]'::jsonb, '{"kind":"chips","numbers":[625,532,889,987]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 809, 247, 537, 733', 809, null, 'order_asc', '247, 537, 733, 809', '["247, 733, 537, 809","537, 247, 733, 809","247, 537, 733, 809","809, 733, 537, 247"]'::jsonb, '{"kind":"chips","numbers":[809,247,537,733]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 308, 350, 483, 216', 308, null, 'order_asc', '216, 308, 350, 483', '["216, 350, 308, 483","483, 350, 308, 216","216, 308, 350, 483","308, 216, 350, 483"]'::jsonb, '{"kind":"chips","numbers":[308,350,483,216]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 270, 779, 646, 473', 270, null, 'order_asc', '270, 473, 646, 779', '["473, 270, 646, 779","270, 473, 646, 779","779, 646, 473, 270","270, 646, 473, 779"]'::jsonb, '{"kind":"chips","numbers":[270,779,646,473]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 501, 101, 265, 919', 501, null, 'order_asc', '101, 265, 501, 919', '["265, 101, 501, 919","101, 265, 501, 919","101, 501, 265, 919","919, 501, 265, 101"]'::jsonb, '{"kind":"chips","numbers":[501,101,265,919]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 261, 877, 946, 183', 261, null, 'order_asc', '183, 261, 877, 946', '["183, 261, 877, 946","183, 877, 261, 946","946, 877, 261, 183","261, 183, 877, 946"]'::jsonb, '{"kind":"chips","numbers":[261,877,946,183]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 423, 106, 127, 783', 423, null, 'order_asc', '106, 127, 423, 783', '["106, 423, 127, 783","127, 106, 423, 783","783, 423, 127, 106","106, 127, 423, 783"]'::jsonb, '{"kind":"chips","numbers":[423,106,127,783]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 121, 202, 510, 366', 121, null, 'order_asc', '121, 202, 366, 510', '["121, 202, 366, 510","202, 121, 366, 510","121, 366, 202, 510","510, 366, 202, 121"]'::jsonb, '{"kind":"chips","numbers":[121,202,510,366]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 210, 920, 403, 390', 210, null, 'order_asc', '210, 390, 403, 920', '["390, 210, 403, 920","210, 390, 403, 920","210, 403, 390, 920","920, 403, 390, 210"]'::jsonb, '{"kind":"chips","numbers":[210,920,403,390]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 365, 952, 495, 845', 365, null, 'order_asc', '365, 495, 845, 952', '["365, 845, 495, 952","495, 365, 845, 952","365, 495, 845, 952","952, 845, 495, 365"]'::jsonb, '{"kind":"chips","numbers":[365,952,495,845]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 117, 509, 228, 850', 117, null, 'order_asc', '117, 228, 509, 850', '["117, 509, 228, 850","117, 228, 509, 850","228, 117, 509, 850","850, 509, 228, 117"]'::jsonb, '{"kind":"chips","numbers":[117,509,228,850]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 424, 954, 479, 804', 424, null, 'order_asc', '424, 479, 804, 954', '["954, 804, 479, 424","424, 479, 804, 954","424, 804, 479, 954","479, 424, 804, 954"]'::jsonb, '{"kind":"chips","numbers":[424,954,479,804]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 255, 595, 512, 584', 255, null, 'order_asc', '255, 512, 584, 595', '["512, 255, 584, 595","255, 512, 584, 595","595, 584, 512, 255","255, 584, 512, 595"]'::jsonb, '{"kind":"chips","numbers":[255,595,512,584]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 369, 865, 161, 762', 369, null, 'order_asc', '161, 369, 762, 865', '["865, 762, 369, 161","369, 161, 762, 865","161, 369, 762, 865","161, 762, 369, 865"]'::jsonb, '{"kind":"chips","numbers":[369,865,161,762]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 351, 663, 810, 262', 351, null, 'order_asc', '262, 351, 663, 810', '["810, 663, 351, 262","262, 351, 663, 810","351, 262, 663, 810","262, 663, 351, 810"]'::jsonb, '{"kind":"chips","numbers":[351,663,810,262]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 465, 460, 418, 719', 465, null, 'order_asc', '418, 460, 465, 719', '["418, 460, 465, 719","460, 418, 465, 719","418, 465, 460, 719","719, 465, 460, 418"]'::jsonb, '{"kind":"chips","numbers":[465,460,418,719]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 754, 298, 628, 319', 754, null, 'order_asc', '298, 319, 628, 754', '["754, 628, 319, 298","298, 628, 319, 754","319, 298, 628, 754","298, 319, 628, 754"]'::jsonb, '{"kind":"chips","numbers":[754,298,628,319]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 110, 740, 520, 743', 110, null, 'order_asc', '110, 520, 740, 743', '["110, 520, 740, 743","743, 740, 520, 110","520, 110, 740, 743","110, 740, 520, 743"]'::jsonb, '{"kind":"chips","numbers":[110,740,520,743]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 478, 892, 411, 469', 478, null, 'order_asc', '411, 469, 478, 892', '["411, 478, 469, 892","892, 478, 469, 411","469, 411, 478, 892","411, 469, 478, 892"]'::jsonb, '{"kind":"chips","numbers":[478,892,411,469]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 434, 994, 910, 340', 434, null, 'order_asc', '340, 434, 910, 994', '["340, 434, 910, 994","340, 910, 434, 994","994, 910, 434, 340","434, 340, 910, 994"]'::jsonb, '{"kind":"chips","numbers":[434,994,910,340]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 542, 530, 169, 593', 542, null, 'order_asc', '169, 530, 542, 593', '["530, 169, 542, 593","169, 542, 530, 593","593, 542, 530, 169","169, 530, 542, 593"]'::jsonb, '{"kind":"chips","numbers":[542,530,169,593]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 337, 625, 559, 543', 337, null, 'order_asc', '337, 543, 559, 625', '["625, 559, 543, 337","337, 559, 543, 625","337, 543, 559, 625","543, 337, 559, 625"]'::jsonb, '{"kind":"chips","numbers":[337,625,559,543]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 401, 681, 743, 264', 401, null, 'order_asc', '264, 401, 681, 743', '["264, 681, 401, 743","743, 681, 401, 264","264, 401, 681, 743","401, 264, 681, 743"]'::jsonb, '{"kind":"chips","numbers":[401,681,743,264]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 538, 395, 409, 611', 538, null, 'order_asc', '395, 409, 538, 611', '["395, 409, 538, 611","395, 538, 409, 611","611, 538, 409, 395","409, 395, 538, 611"]'::jsonb, '{"kind":"chips","numbers":[538,395,409,611]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 384, 106, 548, 812', 384, null, 'order_asc', '106, 384, 548, 812', '["384, 106, 548, 812","812, 548, 384, 106","106, 384, 548, 812","106, 548, 384, 812"]'::jsonb, '{"kind":"chips","numbers":[384,106,548,812]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 408, 786, 728, 801', 408, null, 'order_asc', '408, 728, 786, 801', '["408, 786, 728, 801","728, 408, 786, 801","408, 728, 786, 801","801, 786, 728, 408"]'::jsonb, '{"kind":"chips","numbers":[408,786,728,801]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 316, 382, 282, 740', 316, null, 'order_asc', '282, 316, 382, 740', '["282, 382, 316, 740","740, 382, 316, 282","282, 316, 382, 740","316, 282, 382, 740"]'::jsonb, '{"kind":"chips","numbers":[316,382,282,740]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 167, 246, 990, 682', 167, null, 'order_asc', '167, 246, 682, 990', '["167, 682, 246, 990","990, 682, 246, 167","246, 167, 682, 990","167, 246, 682, 990"]'::jsonb, '{"kind":"chips","numbers":[167,246,990,682]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 832, 345, 813, 519', 832, null, 'order_asc', '345, 519, 813, 832', '["345, 519, 813, 832","519, 345, 813, 832","345, 813, 519, 832","832, 813, 519, 345"]'::jsonb, '{"kind":"chips","numbers":[832,345,813,519]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 793, 206, 631, 142', 793, null, 'order_asc', '142, 206, 631, 793', '["142, 206, 631, 793","142, 631, 206, 793","206, 142, 631, 793","793, 631, 206, 142"]'::jsonb, '{"kind":"chips","numbers":[793,206,631,142]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 531, 168, 228, 952', 531, null, 'order_asc', '168, 228, 531, 952', '["952, 531, 228, 168","168, 228, 531, 952","228, 168, 531, 952","168, 531, 228, 952"]'::jsonb, '{"kind":"chips","numbers":[531,168,228,952]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 402, 237, 977, 245', 402, null, 'order_asc', '237, 245, 402, 977', '["977, 402, 245, 237","245, 237, 402, 977","237, 245, 402, 977","237, 402, 245, 977"]'::jsonb, '{"kind":"chips","numbers":[402,237,977,245]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 335, 944, 220, 741', 335, null, 'order_asc', '220, 335, 741, 944', '["335, 220, 741, 944","220, 741, 335, 944","944, 741, 335, 220","220, 335, 741, 944"]'::jsonb, '{"kind":"chips","numbers":[335,944,220,741]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 877, 623, 610, 612', 877, null, 'order_asc', '610, 612, 623, 877', '["610, 612, 623, 877","610, 623, 612, 877","877, 623, 612, 610","612, 610, 623, 877"]'::jsonb, '{"kind":"chips","numbers":[877,623,610,612]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 981, 782, 172, 744', 981, null, 'order_asc', '172, 744, 782, 981', '["172, 744, 782, 981","172, 782, 744, 981","981, 782, 744, 172","744, 172, 782, 981"]'::jsonb, '{"kind":"chips","numbers":[981,782,172,744]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 740, 962, 574, 413', 740, null, 'order_asc', '413, 574, 740, 962', '["574, 413, 740, 962","962, 740, 574, 413","413, 574, 740, 962","413, 740, 574, 962"]'::jsonb, '{"kind":"chips","numbers":[740,962,574,413]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 751, 163, 504, 214', 751, null, 'order_asc', '163, 214, 504, 751', '["214, 163, 504, 751","163, 214, 504, 751","163, 504, 214, 751","751, 504, 214, 163"]'::jsonb, '{"kind":"chips","numbers":[751,163,504,214]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 521, 945, 395, 115', 521, null, 'order_asc', '115, 395, 521, 945', '["395, 115, 521, 945","945, 521, 395, 115","115, 395, 521, 945","115, 521, 395, 945"]'::jsonb, '{"kind":"chips","numbers":[521,945,395,115]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 956, 682, 352, 383', 956, null, 'order_asc', '352, 383, 682, 956', '["352, 682, 383, 956","956, 682, 383, 352","352, 383, 682, 956","383, 352, 682, 956"]'::jsonb, '{"kind":"chips","numbers":[956,682,352,383]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 596, 968, 135, 530', 596, null, 'order_asc', '135, 530, 596, 968', '["968, 596, 530, 135","135, 530, 596, 968","530, 135, 596, 968","135, 596, 530, 968"]'::jsonb, '{"kind":"chips","numbers":[596,968,135,530]}'::jsonb),
  ('ascending-order', 'ascending_order', 'hard', 'رتّبي الأعداد التالية تصاعديًا: 426, 278, 927, 464', 426, null, 'order_asc', '278, 426, 464, 927', '["426, 278, 464, 927","278, 426, 464, 927","278, 464, 426, 927","927, 464, 426, 278"]'::jsonb, '{"kind":"chips","numbers":[426,278,927,464]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 4, 1, 9, 8', 4, null, 'order_desc', '9, 8, 4, 1', '["9, 4, 8, 1","9, 8, 4, 1","1, 4, 8, 9","8, 9, 4, 1"]'::jsonb, '{"kind":"chips","numbers":[4,1,9,8]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 5, 8, 1, 4', 5, null, 'order_desc', '8, 5, 4, 1', '["8, 4, 5, 1","5, 8, 4, 1","1, 4, 5, 8","8, 5, 4, 1"]'::jsonb, '{"kind":"chips","numbers":[5,8,1,4]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 1, 9, 8, 6', 1, null, 'order_desc', '9, 8, 6, 1', '["8, 9, 6, 1","9, 6, 8, 1","9, 8, 6, 1","1, 6, 8, 9"]'::jsonb, '{"kind":"chips","numbers":[1,9,8,6]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 8, 7, 3, 4', 8, null, 'order_desc', '8, 7, 4, 3', '["8, 7, 4, 3","3, 4, 7, 8","8, 4, 7, 3","7, 8, 4, 3"]'::jsonb, '{"kind":"chips","numbers":[8,7,3,4]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 5, 8, 2, 4', 5, null, 'order_desc', '8, 5, 4, 2', '["8, 4, 5, 2","2, 4, 5, 8","5, 8, 4, 2","8, 5, 4, 2"]'::jsonb, '{"kind":"chips","numbers":[5,8,2,4]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 1, 5, 8, 3', 1, null, 'order_desc', '8, 5, 3, 1', '["8, 5, 3, 1","8, 3, 5, 1","1, 3, 5, 8","5, 8, 3, 1"]'::jsonb, '{"kind":"chips","numbers":[1,5,8,3]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 7, 8, 1, 2', 7, null, 'order_desc', '8, 7, 2, 1', '["8, 7, 2, 1","1, 2, 7, 8","8, 2, 7, 1","7, 8, 2, 1"]'::jsonb, '{"kind":"chips","numbers":[7,8,1,2]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 4, 7, 5, 1', 4, null, 'order_desc', '7, 5, 4, 1', '["5, 7, 4, 1","1, 4, 5, 7","7, 5, 4, 1","7, 4, 5, 1"]'::jsonb, '{"kind":"chips","numbers":[4,7,5,1]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 9, 1, 8, 7', 9, null, 'order_desc', '9, 8, 7, 1', '["9, 7, 8, 1","8, 9, 7, 1","9, 8, 7, 1","1, 7, 8, 9"]'::jsonb, '{"kind":"chips","numbers":[9,1,8,7]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 2, 5, 9, 6', 2, null, 'order_desc', '9, 6, 5, 2', '["9, 6, 5, 2","2, 5, 6, 9","9, 5, 6, 2","6, 9, 5, 2"]'::jsonb, '{"kind":"chips","numbers":[2,5,9,6]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 2, 4, 8, 1', 2, null, 'order_desc', '8, 4, 2, 1', '["8, 2, 4, 1","8, 4, 2, 1","1, 2, 4, 8","4, 8, 2, 1"]'::jsonb, '{"kind":"chips","numbers":[2,4,8,1]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 2, 1, 8, 9', 2, null, 'order_desc', '9, 8, 2, 1', '["9, 2, 8, 1","1, 2, 8, 9","8, 9, 2, 1","9, 8, 2, 1"]'::jsonb, '{"kind":"chips","numbers":[2,1,8,9]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 7, 5, 3, 6', 7, null, 'order_desc', '7, 6, 5, 3', '["7, 6, 5, 3","6, 7, 5, 3","3, 5, 6, 7","7, 5, 6, 3"]'::jsonb, '{"kind":"chips","numbers":[7,5,3,6]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 6, 5, 9, 3', 6, null, 'order_desc', '9, 6, 5, 3', '["9, 6, 5, 3","9, 5, 6, 3","6, 9, 5, 3","3, 5, 6, 9"]'::jsonb, '{"kind":"chips","numbers":[6,5,9,3]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 3, 8, 5, 4', 3, null, 'order_desc', '8, 5, 4, 3', '["8, 4, 5, 3","5, 8, 4, 3","3, 4, 5, 8","8, 5, 4, 3"]'::jsonb, '{"kind":"chips","numbers":[3,8,5,4]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 2, 5, 4, 6', 2, null, 'order_desc', '6, 5, 4, 2', '["5, 6, 4, 2","2, 4, 5, 6","6, 5, 4, 2","6, 4, 5, 2"]'::jsonb, '{"kind":"chips","numbers":[2,5,4,6]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 9, 3, 4, 7', 9, null, 'order_desc', '9, 7, 4, 3', '["9, 7, 4, 3","9, 4, 7, 3","3, 4, 7, 9","7, 9, 4, 3"]'::jsonb, '{"kind":"chips","numbers":[9,3,4,7]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 7, 1, 9, 2', 7, null, 'order_desc', '9, 7, 2, 1', '["9, 2, 7, 1","1, 2, 7, 9","7, 9, 2, 1","9, 7, 2, 1"]'::jsonb, '{"kind":"chips","numbers":[7,1,9,2]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 1, 7, 4, 3', 1, null, 'order_desc', '7, 4, 3, 1', '["1, 3, 4, 7","4, 7, 3, 1","7, 3, 4, 1","7, 4, 3, 1"]'::jsonb, '{"kind":"chips","numbers":[1,7,4,3]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 4, 2, 6, 7', 4, null, 'order_desc', '7, 6, 4, 2', '["7, 6, 4, 2","7, 4, 6, 2","2, 4, 6, 7","6, 7, 4, 2"]'::jsonb, '{"kind":"chips","numbers":[4,2,6,7]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 4, 6, 9, 3', 4, null, 'order_desc', '9, 6, 4, 3', '["9, 6, 4, 3","9, 4, 6, 3","6, 9, 4, 3","3, 4, 6, 9"]'::jsonb, '{"kind":"chips","numbers":[4,6,9,3]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 7, 8, 2, 9', 7, null, 'order_desc', '9, 8, 7, 2', '["9, 7, 8, 2","8, 9, 7, 2","2, 7, 8, 9","9, 8, 7, 2"]'::jsonb, '{"kind":"chips","numbers":[7,8,2,9]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 6, 1, 7, 9', 6, null, 'order_desc', '9, 7, 6, 1', '["7, 9, 6, 1","9, 7, 6, 1","1, 6, 7, 9","9, 6, 7, 1"]'::jsonb, '{"kind":"chips","numbers":[6,1,7,9]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 8, 7, 9, 4', 8, null, 'order_desc', '9, 8, 7, 4', '["8, 9, 7, 4","9, 8, 7, 4","9, 7, 8, 4","4, 7, 8, 9"]'::jsonb, '{"kind":"chips","numbers":[8,7,9,4]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 2, 6, 5, 1', 2, null, 'order_desc', '6, 5, 2, 1', '["6, 5, 2, 1","5, 6, 2, 1","1, 2, 5, 6","6, 2, 5, 1"]'::jsonb, '{"kind":"chips","numbers":[2,6,5,1]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 9, 5, 3, 8', 9, null, 'order_desc', '9, 8, 5, 3', '["3, 5, 8, 9","9, 5, 8, 3","9, 8, 5, 3","8, 9, 5, 3"]'::jsonb, '{"kind":"chips","numbers":[9,5,3,8]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 8, 7, 4, 6', 8, null, 'order_desc', '8, 7, 6, 4', '["8, 7, 6, 4","8, 6, 7, 4","4, 6, 7, 8","7, 8, 6, 4"]'::jsonb, '{"kind":"chips","numbers":[8,7,4,6]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 8, 2, 4, 6', 8, null, 'order_desc', '8, 6, 4, 2', '["8, 4, 6, 2","6, 8, 4, 2","8, 6, 4, 2","2, 4, 6, 8"]'::jsonb, '{"kind":"chips","numbers":[8,2,4,6]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 5, 9, 6, 1', 5, null, 'order_desc', '9, 6, 5, 1', '["9, 5, 6, 1","9, 6, 5, 1","1, 5, 6, 9","6, 9, 5, 1"]'::jsonb, '{"kind":"chips","numbers":[5,9,6,1]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 5, 9, 7, 4', 5, null, 'order_desc', '9, 7, 5, 4', '["7, 9, 5, 4","9, 7, 5, 4","4, 5, 7, 9","9, 5, 7, 4"]'::jsonb, '{"kind":"chips","numbers":[5,9,7,4]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 8, 6, 5, 9', 8, null, 'order_desc', '9, 8, 6, 5', '["9, 6, 8, 5","8, 9, 6, 5","5, 6, 8, 9","9, 8, 6, 5"]'::jsonb, '{"kind":"chips","numbers":[8,6,5,9]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 7, 3, 1, 5', 7, null, 'order_desc', '7, 5, 3, 1', '["7, 3, 5, 1","7, 5, 3, 1","5, 7, 3, 1","1, 3, 5, 7"]'::jsonb, '{"kind":"chips","numbers":[7,3,1,5]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 3, 4, 8, 6', 3, null, 'order_desc', '8, 6, 4, 3', '["8, 4, 6, 3","8, 6, 4, 3","3, 4, 6, 8","6, 8, 4, 3"]'::jsonb, '{"kind":"chips","numbers":[3,4,8,6]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 5, 3, 4, 6', 5, null, 'order_desc', '6, 5, 4, 3', '["5, 6, 4, 3","6, 5, 4, 3","3, 4, 5, 6","6, 4, 5, 3"]'::jsonb, '{"kind":"chips","numbers":[5,3,4,6]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 3, 9, 2, 7', 3, null, 'order_desc', '9, 7, 3, 2', '["2, 3, 7, 9","7, 9, 3, 2","9, 3, 7, 2","9, 7, 3, 2"]'::jsonb, '{"kind":"chips","numbers":[3,9,2,7]}'::jsonb),
  ('descending-order', 'descending_order', 'easy', 'رتّبي الأعداد التالية تنازليًا: 1, 4, 3, 2', 1, null, 'order_desc', '4, 3, 2, 1', '["4, 3, 2, 1","3, 4, 2, 1","1, 2, 3, 4","4, 2, 3, 1"]'::jsonb, '{"kind":"chips","numbers":[1,4,3,2]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 41, 81, 77, 31', 41, null, 'order_desc', '81, 77, 41, 31', '["31, 41, 77, 81","81, 77, 41, 31","77, 81, 41, 31","81, 41, 77, 31"]'::jsonb, '{"kind":"chips","numbers":[41,81,77,31]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 79, 34, 10, 46', 79, null, 'order_desc', '79, 46, 34, 10', '["79, 34, 46, 10","79, 46, 34, 10","46, 79, 34, 10","10, 34, 46, 79"]'::jsonb, '{"kind":"chips","numbers":[79,34,10,46]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 47, 97, 32, 39', 47, null, 'order_desc', '97, 47, 39, 32', '["32, 39, 47, 97","47, 97, 39, 32","97, 39, 47, 32","97, 47, 39, 32"]'::jsonb, '{"kind":"chips","numbers":[47,97,32,39]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 10, 58, 27, 31', 10, null, 'order_desc', '58, 31, 27, 10', '["58, 27, 31, 10","10, 27, 31, 58","58, 31, 27, 10","31, 58, 27, 10"]'::jsonb, '{"kind":"chips","numbers":[10,58,27,31]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 97, 15, 14, 65', 97, null, 'order_desc', '97, 65, 15, 14', '["97, 15, 65, 14","65, 97, 15, 14","97, 65, 15, 14","14, 15, 65, 97"]'::jsonb, '{"kind":"chips","numbers":[97,15,14,65]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 99, 54, 84, 17', 99, null, 'order_desc', '99, 84, 54, 17', '["84, 99, 54, 17","17, 54, 84, 99","99, 54, 84, 17","99, 84, 54, 17"]'::jsonb, '{"kind":"chips","numbers":[99,54,84,17]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 49, 76, 28, 85', 49, null, 'order_desc', '85, 76, 49, 28', '["28, 49, 76, 85","76, 85, 49, 28","85, 76, 49, 28","85, 49, 76, 28"]'::jsonb, '{"kind":"chips","numbers":[49,76,28,85]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 85, 63, 80, 91', 85, null, 'order_desc', '91, 85, 80, 63', '["91, 85, 80, 63","63, 80, 85, 91","85, 91, 80, 63","91, 80, 85, 63"]'::jsonb, '{"kind":"chips","numbers":[85,63,80,91]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 22, 16, 61, 58', 22, null, 'order_desc', '61, 58, 22, 16', '["16, 22, 58, 61","61, 58, 22, 16","61, 22, 58, 16","58, 61, 22, 16"]'::jsonb, '{"kind":"chips","numbers":[22,16,61,58]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 35, 73, 65, 36', 35, null, 'order_desc', '73, 65, 36, 35', '["73, 36, 65, 35","73, 65, 36, 35","65, 73, 36, 35","35, 36, 65, 73"]'::jsonb, '{"kind":"chips","numbers":[35,73,65,36]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 36, 18, 86, 37', 36, null, 'order_desc', '86, 37, 36, 18', '["86, 36, 37, 18","37, 86, 36, 18","18, 36, 37, 86","86, 37, 36, 18"]'::jsonb, '{"kind":"chips","numbers":[36,18,86,37]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 98, 49, 89, 71', 98, null, 'order_desc', '98, 89, 71, 49', '["49, 71, 89, 98","89, 98, 71, 49","98, 71, 89, 49","98, 89, 71, 49"]'::jsonb, '{"kind":"chips","numbers":[98,49,89,71]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 74, 39, 62, 61', 74, null, 'order_desc', '74, 62, 61, 39', '["74, 62, 61, 39","62, 74, 61, 39","39, 61, 62, 74","74, 61, 62, 39"]'::jsonb, '{"kind":"chips","numbers":[74,39,62,61]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 92, 91, 31, 32', 92, null, 'order_desc', '92, 91, 32, 31', '["91, 92, 32, 31","92, 91, 32, 31","31, 32, 91, 92","92, 32, 91, 31"]'::jsonb, '{"kind":"chips","numbers":[92,91,31,32]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 70, 43, 87, 50', 70, null, 'order_desc', '87, 70, 50, 43', '["87, 70, 50, 43","43, 50, 70, 87","87, 50, 70, 43","70, 87, 50, 43"]'::jsonb, '{"kind":"chips","numbers":[70,43,87,50]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 88, 60, 51, 70', 88, null, 'order_desc', '88, 70, 60, 51', '["88, 70, 60, 51","88, 60, 70, 51","51, 60, 70, 88","70, 88, 60, 51"]'::jsonb, '{"kind":"chips","numbers":[88,60,51,70]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 88, 60, 62, 95', 88, null, 'order_desc', '95, 88, 62, 60', '["95, 88, 62, 60","95, 62, 88, 60","60, 62, 88, 95","88, 95, 62, 60"]'::jsonb, '{"kind":"chips","numbers":[88,60,62,95]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 48, 61, 13, 93', 48, null, 'order_desc', '93, 61, 48, 13', '["93, 61, 48, 13","93, 48, 61, 13","61, 93, 48, 13","13, 48, 61, 93"]'::jsonb, '{"kind":"chips","numbers":[48,61,13,93]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 21, 60, 31, 82', 21, null, 'order_desc', '82, 60, 31, 21', '["21, 31, 60, 82","82, 31, 60, 21","82, 60, 31, 21","60, 82, 31, 21"]'::jsonb, '{"kind":"chips","numbers":[21,60,31,82]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 50, 61, 26, 96', 50, null, 'order_desc', '96, 61, 50, 26', '["26, 50, 61, 96","96, 50, 61, 26","61, 96, 50, 26","96, 61, 50, 26"]'::jsonb, '{"kind":"chips","numbers":[50,61,26,96]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 89, 32, 92, 28', 89, null, 'order_desc', '92, 89, 32, 28', '["28, 32, 89, 92","89, 92, 32, 28","92, 32, 89, 28","92, 89, 32, 28"]'::jsonb, '{"kind":"chips","numbers":[89,32,92,28]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 32, 21, 60, 50', 32, null, 'order_desc', '60, 50, 32, 21', '["60, 32, 50, 21","60, 50, 32, 21","50, 60, 32, 21","21, 32, 50, 60"]'::jsonb, '{"kind":"chips","numbers":[32,21,60,50]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 66, 38, 62, 69', 66, null, 'order_desc', '69, 66, 62, 38', '["69, 66, 62, 38","38, 62, 66, 69","69, 62, 66, 38","66, 69, 62, 38"]'::jsonb, '{"kind":"chips","numbers":[66,38,62,69]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 88, 33, 45, 10', 88, null, 'order_desc', '88, 45, 33, 10', '["88, 45, 33, 10","88, 33, 45, 10","45, 88, 33, 10","10, 33, 45, 88"]'::jsonb, '{"kind":"chips","numbers":[88,33,45,10]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 51, 62, 81, 49', 51, null, 'order_desc', '81, 62, 51, 49', '["81, 51, 62, 49","81, 62, 51, 49","49, 51, 62, 81","62, 81, 51, 49"]'::jsonb, '{"kind":"chips","numbers":[51,62,81,49]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 36, 62, 72, 55', 36, null, 'order_desc', '72, 62, 55, 36', '["72, 55, 62, 36","62, 72, 55, 36","72, 62, 55, 36","36, 55, 62, 72"]'::jsonb, '{"kind":"chips","numbers":[36,62,72,55]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 73, 99, 47, 32', 73, null, 'order_desc', '99, 73, 47, 32', '["99, 73, 47, 32","73, 99, 47, 32","99, 47, 73, 32","32, 47, 73, 99"]'::jsonb, '{"kind":"chips","numbers":[73,99,47,32]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 56, 85, 15, 99', 56, null, 'order_desc', '99, 85, 56, 15', '["99, 56, 85, 15","15, 56, 85, 99","85, 99, 56, 15","99, 85, 56, 15"]'::jsonb, '{"kind":"chips","numbers":[56,85,15,99]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 88, 26, 40, 11', 88, null, 'order_desc', '88, 40, 26, 11', '["88, 26, 40, 11","11, 26, 40, 88","88, 40, 26, 11","40, 88, 26, 11"]'::jsonb, '{"kind":"chips","numbers":[88,26,40,11]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 68, 46, 80, 92', 68, null, 'order_desc', '92, 80, 68, 46', '["80, 92, 68, 46","92, 80, 68, 46","92, 68, 80, 46","46, 68, 80, 92"]'::jsonb, '{"kind":"chips","numbers":[68,46,80,92]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 17, 97, 54, 68', 17, null, 'order_desc', '97, 68, 54, 17', '["97, 54, 68, 17","17, 54, 68, 97","68, 97, 54, 17","97, 68, 54, 17"]'::jsonb, '{"kind":"chips","numbers":[17,97,54,68]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 35, 55, 43, 29', 35, null, 'order_desc', '55, 43, 35, 29', '["55, 35, 43, 29","43, 55, 35, 29","55, 43, 35, 29","29, 35, 43, 55"]'::jsonb, '{"kind":"chips","numbers":[35,55,43,29]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 92, 38, 46, 96', 92, null, 'order_desc', '96, 92, 46, 38', '["96, 46, 92, 38","92, 96, 46, 38","38, 46, 92, 96","96, 92, 46, 38"]'::jsonb, '{"kind":"chips","numbers":[92,38,46,96]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 96, 68, 64, 86', 96, null, 'order_desc', '96, 86, 68, 64', '["64, 68, 86, 96","96, 86, 68, 64","96, 68, 86, 64","86, 96, 68, 64"]'::jsonb, '{"kind":"chips","numbers":[96,68,64,86]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 54, 33, 86, 41', 54, null, 'order_desc', '86, 54, 41, 33', '["86, 54, 41, 33","54, 86, 41, 33","86, 41, 54, 33","33, 41, 54, 86"]'::jsonb, '{"kind":"chips","numbers":[54,33,86,41]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 86, 33, 43, 72', 86, null, 'order_desc', '86, 72, 43, 33', '["72, 86, 43, 33","86, 72, 43, 33","86, 43, 72, 33","33, 43, 72, 86"]'::jsonb, '{"kind":"chips","numbers":[86,33,43,72]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 35, 74, 50, 34', 35, null, 'order_desc', '74, 50, 35, 34', '["74, 35, 50, 34","74, 50, 35, 34","34, 35, 50, 74","50, 74, 35, 34"]'::jsonb, '{"kind":"chips","numbers":[35,74,50,34]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 53, 22, 31, 93', 53, null, 'order_desc', '93, 53, 31, 22', '["93, 31, 53, 22","93, 53, 31, 22","53, 93, 31, 22","22, 31, 53, 93"]'::jsonb, '{"kind":"chips","numbers":[53,22,31,93]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 64, 21, 20, 60', 64, null, 'order_desc', '64, 60, 21, 20', '["20, 21, 60, 64","60, 64, 21, 20","64, 21, 60, 20","64, 60, 21, 20"]'::jsonb, '{"kind":"chips","numbers":[64,21,20,60]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 43, 75, 46, 24', 43, null, 'order_desc', '75, 46, 43, 24', '["75, 43, 46, 24","24, 43, 46, 75","46, 75, 43, 24","75, 46, 43, 24"]'::jsonb, '{"kind":"chips","numbers":[43,75,46,24]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 55, 88, 45, 54', 55, null, 'order_desc', '88, 55, 54, 45', '["88, 55, 54, 45","55, 88, 54, 45","45, 54, 55, 88","88, 54, 55, 45"]'::jsonb, '{"kind":"chips","numbers":[55,88,45,54]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 97, 26, 24, 60', 97, null, 'order_desc', '97, 60, 26, 24', '["60, 97, 26, 24","97, 60, 26, 24","24, 26, 60, 97","97, 26, 60, 24"]'::jsonb, '{"kind":"chips","numbers":[97,26,24,60]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 25, 57, 17, 64', 25, null, 'order_desc', '64, 57, 25, 17', '["64, 25, 57, 17","17, 25, 57, 64","57, 64, 25, 17","64, 57, 25, 17"]'::jsonb, '{"kind":"chips","numbers":[25,57,17,64]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 94, 77, 82, 88', 94, null, 'order_desc', '94, 88, 82, 77', '["77, 82, 88, 94","94, 88, 82, 77","88, 94, 82, 77","94, 82, 88, 77"]'::jsonb, '{"kind":"chips","numbers":[94,77,82,88]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 70, 16, 63, 77', 70, null, 'order_desc', '77, 70, 63, 16', '["77, 63, 70, 16","16, 63, 70, 77","77, 70, 63, 16","70, 77, 63, 16"]'::jsonb, '{"kind":"chips","numbers":[70,16,63,77]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 76, 90, 39, 32', 76, null, 'order_desc', '90, 76, 39, 32', '["32, 39, 76, 90","90, 76, 39, 32","76, 90, 39, 32","90, 39, 76, 32"]'::jsonb, '{"kind":"chips","numbers":[76,90,39,32]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 67, 15, 82, 41', 67, null, 'order_desc', '82, 67, 41, 15', '["82, 41, 67, 15","15, 41, 67, 82","82, 67, 41, 15","67, 82, 41, 15"]'::jsonb, '{"kind":"chips","numbers":[67,15,82,41]}'::jsonb),
  ('descending-order', 'descending_order', 'medium', 'رتّبي الأعداد التالية تنازليًا: 64, 48, 85, 71', 64, null, 'order_desc', '85, 71, 64, 48', '["71, 85, 64, 48","85, 71, 64, 48","48, 64, 71, 85","85, 64, 71, 48"]'::jsonb, '{"kind":"chips","numbers":[64,48,85,71]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 850, 352, 630, 659', 850, null, 'order_desc', '850, 659, 630, 352', '["850, 630, 659, 352","850, 659, 630, 352","352, 630, 659, 850","659, 850, 630, 352"]'::jsonb, '{"kind":"chips","numbers":[850,352,630,659]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 684, 215, 243, 166', 684, null, 'order_desc', '684, 243, 215, 166', '["684, 215, 243, 166","243, 684, 215, 166","166, 215, 243, 684","684, 243, 215, 166"]'::jsonb, '{"kind":"chips","numbers":[684,215,243,166]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 270, 853, 622, 916', 270, null, 'order_desc', '916, 853, 622, 270', '["270, 622, 853, 916","916, 853, 622, 270","916, 622, 853, 270","853, 916, 622, 270"]'::jsonb, '{"kind":"chips","numbers":[270,853,622,916]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 800, 974, 842, 909', 800, null, 'order_desc', '974, 909, 842, 800', '["974, 842, 909, 800","909, 974, 842, 800","800, 842, 909, 974","974, 909, 842, 800"]'::jsonb, '{"kind":"chips","numbers":[800,974,842,909]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 657, 303, 608, 994', 657, null, 'order_desc', '994, 657, 608, 303', '["657, 994, 608, 303","994, 608, 657, 303","994, 657, 608, 303","303, 608, 657, 994"]'::jsonb, '{"kind":"chips","numbers":[657,303,608,994]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 997, 203, 313, 181', 997, null, 'order_desc', '997, 313, 203, 181', '["997, 203, 313, 181","181, 203, 313, 997","997, 313, 203, 181","313, 997, 203, 181"]'::jsonb, '{"kind":"chips","numbers":[997,203,313,181]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 941, 788, 947, 656', 941, null, 'order_desc', '947, 941, 788, 656', '["941, 947, 788, 656","947, 941, 788, 656","947, 788, 941, 656","656, 788, 941, 947"]'::jsonb, '{"kind":"chips","numbers":[941,788,947,656]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 401, 706, 274, 447', 401, null, 'order_desc', '706, 447, 401, 274', '["274, 401, 447, 706","447, 706, 401, 274","706, 447, 401, 274","706, 401, 447, 274"]'::jsonb, '{"kind":"chips","numbers":[401,706,274,447]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 707, 517, 386, 981', 707, null, 'order_desc', '981, 707, 517, 386', '["981, 517, 707, 386","707, 981, 517, 386","981, 707, 517, 386","386, 517, 707, 981"]'::jsonb, '{"kind":"chips","numbers":[707,517,386,981]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 502, 286, 699, 677', 502, null, 'order_desc', '699, 677, 502, 286', '["699, 677, 502, 286","286, 502, 677, 699","699, 502, 677, 286","677, 699, 502, 286"]'::jsonb, '{"kind":"chips","numbers":[502,286,699,677]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 449, 967, 227, 824', 449, null, 'order_desc', '967, 824, 449, 227', '["824, 967, 449, 227","967, 449, 824, 227","227, 449, 824, 967","967, 824, 449, 227"]'::jsonb, '{"kind":"chips","numbers":[449,967,227,824]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 429, 260, 531, 491', 429, null, 'order_desc', '531, 491, 429, 260', '["260, 429, 491, 531","531, 429, 491, 260","491, 531, 429, 260","531, 491, 429, 260"]'::jsonb, '{"kind":"chips","numbers":[429,260,531,491]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 746, 586, 808, 547', 746, null, 'order_desc', '808, 746, 586, 547', '["808, 746, 586, 547","808, 586, 746, 547","746, 808, 586, 547","547, 586, 746, 808"]'::jsonb, '{"kind":"chips","numbers":[746,586,808,547]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 658, 864, 726, 653', 658, null, 'order_desc', '864, 726, 658, 653', '["653, 658, 726, 864","864, 658, 726, 653","864, 726, 658, 653","726, 864, 658, 653"]'::jsonb, '{"kind":"chips","numbers":[658,864,726,653]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 753, 204, 857, 332', 753, null, 'order_desc', '857, 753, 332, 204', '["857, 332, 753, 204","857, 753, 332, 204","204, 332, 753, 857","753, 857, 332, 204"]'::jsonb, '{"kind":"chips","numbers":[753,204,857,332]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 399, 584, 954, 185', 399, null, 'order_desc', '954, 584, 399, 185', '["954, 584, 399, 185","185, 399, 584, 954","954, 399, 584, 185","584, 954, 399, 185"]'::jsonb, '{"kind":"chips","numbers":[399,584,954,185]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 979, 188, 914, 311', 979, null, 'order_desc', '979, 914, 311, 188', '["914, 979, 311, 188","979, 914, 311, 188","188, 311, 914, 979","979, 311, 914, 188"]'::jsonb, '{"kind":"chips","numbers":[979,188,914,311]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 364, 631, 155, 673', 364, null, 'order_desc', '673, 631, 364, 155', '["155, 364, 631, 673","673, 364, 631, 155","631, 673, 364, 155","673, 631, 364, 155"]'::jsonb, '{"kind":"chips","numbers":[364,631,155,673]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 294, 890, 494, 187', 294, null, 'order_desc', '890, 494, 294, 187', '["187, 294, 494, 890","890, 494, 294, 187","494, 890, 294, 187","890, 294, 494, 187"]'::jsonb, '{"kind":"chips","numbers":[294,890,494,187]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 879, 777, 191, 538', 879, null, 'order_desc', '879, 777, 538, 191', '["879, 777, 538, 191","879, 538, 777, 191","777, 879, 538, 191","191, 538, 777, 879"]'::jsonb, '{"kind":"chips","numbers":[879,777,191,538]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 811, 108, 241, 206', 811, null, 'order_desc', '811, 241, 206, 108', '["811, 206, 241, 108","108, 206, 241, 811","811, 241, 206, 108","241, 811, 206, 108"]'::jsonb, '{"kind":"chips","numbers":[811,108,241,206]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 913, 211, 493, 357', 913, null, 'order_desc', '913, 493, 357, 211', '["913, 493, 357, 211","211, 357, 493, 913","493, 913, 357, 211","913, 357, 493, 211"]'::jsonb, '{"kind":"chips","numbers":[913,211,493,357]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 920, 552, 481, 725', 920, null, 'order_desc', '920, 725, 552, 481', '["725, 920, 552, 481","920, 725, 552, 481","481, 552, 725, 920","920, 552, 725, 481"]'::jsonb, '{"kind":"chips","numbers":[920,552,481,725]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 142, 717, 895, 595', 142, null, 'order_desc', '895, 717, 595, 142', '["717, 895, 595, 142","895, 595, 717, 142","142, 595, 717, 895","895, 717, 595, 142"]'::jsonb, '{"kind":"chips","numbers":[142,717,895,595]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 968, 371, 788, 583', 968, null, 'order_desc', '968, 788, 583, 371', '["968, 788, 583, 371","371, 583, 788, 968","788, 968, 583, 371","968, 583, 788, 371"]'::jsonb, '{"kind":"chips","numbers":[968,371,788,583]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 253, 504, 391, 764', 253, null, 'order_desc', '764, 504, 391, 253', '["504, 764, 391, 253","764, 504, 391, 253","764, 391, 504, 253","253, 391, 504, 764"]'::jsonb, '{"kind":"chips","numbers":[253,504,391,764]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 908, 257, 524, 286', 908, null, 'order_desc', '908, 524, 286, 257', '["524, 908, 286, 257","908, 286, 524, 257","257, 286, 524, 908","908, 524, 286, 257"]'::jsonb, '{"kind":"chips","numbers":[908,257,524,286]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 717, 551, 747, 739', 717, null, 'order_desc', '747, 739, 717, 551', '["747, 739, 717, 551","739, 747, 717, 551","747, 717, 739, 551","551, 717, 739, 747"]'::jsonb, '{"kind":"chips","numbers":[717,551,747,739]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 444, 114, 920, 605', 444, null, 'order_desc', '920, 605, 444, 114', '["605, 920, 444, 114","920, 605, 444, 114","920, 444, 605, 114","114, 444, 605, 920"]'::jsonb, '{"kind":"chips","numbers":[444,114,920,605]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 456, 567, 140, 734', 456, null, 'order_desc', '734, 567, 456, 140', '["567, 734, 456, 140","734, 456, 567, 140","140, 456, 567, 734","734, 567, 456, 140"]'::jsonb, '{"kind":"chips","numbers":[456,567,140,734]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 680, 322, 175, 489', 680, null, 'order_desc', '680, 489, 322, 175', '["680, 489, 322, 175","489, 680, 322, 175","680, 322, 489, 175","175, 322, 489, 680"]'::jsonb, '{"kind":"chips","numbers":[680,322,175,489]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 583, 102, 283, 894', 583, null, 'order_desc', '894, 583, 283, 102', '["894, 283, 583, 102","583, 894, 283, 102","894, 583, 283, 102","102, 283, 583, 894"]'::jsonb, '{"kind":"chips","numbers":[583,102,283,894]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 567, 119, 378, 150', 567, null, 'order_desc', '567, 378, 150, 119', '["119, 150, 378, 567","567, 150, 378, 119","378, 567, 150, 119","567, 378, 150, 119"]'::jsonb, '{"kind":"chips","numbers":[567,119,378,150]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 147, 650, 420, 471', 147, null, 'order_desc', '650, 471, 420, 147', '["650, 471, 420, 147","650, 420, 471, 147","147, 420, 471, 650","471, 650, 420, 147"]'::jsonb, '{"kind":"chips","numbers":[147,650,420,471]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 200, 810, 805, 412', 200, null, 'order_desc', '810, 805, 412, 200', '["810, 805, 412, 200","805, 810, 412, 200","200, 412, 805, 810","810, 412, 805, 200"]'::jsonb, '{"kind":"chips","numbers":[200,810,805,412]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 201, 119, 294, 910', 201, null, 'order_desc', '910, 294, 201, 119', '["910, 201, 294, 119","294, 910, 201, 119","119, 201, 294, 910","910, 294, 201, 119"]'::jsonb, '{"kind":"chips","numbers":[201,119,294,910]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 598, 552, 978, 201', 598, null, 'order_desc', '978, 598, 552, 201', '["978, 552, 598, 201","201, 552, 598, 978","598, 978, 552, 201","978, 598, 552, 201"]'::jsonb, '{"kind":"chips","numbers":[598,552,978,201]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 811, 227, 906, 390', 811, null, 'order_desc', '906, 811, 390, 227', '["227, 390, 811, 906","811, 906, 390, 227","906, 811, 390, 227","906, 390, 811, 227"]'::jsonb, '{"kind":"chips","numbers":[811,227,906,390]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 208, 736, 895, 688', 208, null, 'order_desc', '895, 736, 688, 208', '["736, 895, 688, 208","895, 688, 736, 208","895, 736, 688, 208","208, 688, 736, 895"]'::jsonb, '{"kind":"chips","numbers":[208,736,895,688]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 620, 681, 326, 236', 620, null, 'order_desc', '681, 620, 326, 236', '["620, 681, 326, 236","236, 326, 620, 681","681, 620, 326, 236","681, 326, 620, 236"]'::jsonb, '{"kind":"chips","numbers":[620,681,326,236]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 162, 135, 649, 661', 162, null, 'order_desc', '661, 649, 162, 135', '["661, 162, 649, 135","135, 162, 649, 661","661, 649, 162, 135","649, 661, 162, 135"]'::jsonb, '{"kind":"chips","numbers":[162,135,649,661]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 704, 447, 648, 439', 704, null, 'order_desc', '704, 648, 447, 439', '["648, 704, 447, 439","704, 447, 648, 439","439, 447, 648, 704","704, 648, 447, 439"]'::jsonb, '{"kind":"chips","numbers":[704,447,648,439]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 769, 415, 746, 503', 769, null, 'order_desc', '769, 746, 503, 415', '["415, 503, 746, 769","769, 503, 746, 415","746, 769, 503, 415","769, 746, 503, 415"]'::jsonb, '{"kind":"chips","numbers":[769,415,746,503]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 706, 235, 105, 475', 706, null, 'order_desc', '706, 475, 235, 105', '["105, 235, 475, 706","706, 475, 235, 105","706, 235, 475, 105","475, 706, 235, 105"]'::jsonb, '{"kind":"chips","numbers":[706,235,105,475]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 386, 493, 975, 723', 386, null, 'order_desc', '975, 723, 493, 386', '["975, 493, 723, 386","386, 493, 723, 975","723, 975, 493, 386","975, 723, 493, 386"]'::jsonb, '{"kind":"chips","numbers":[386,493,975,723]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 161, 507, 473, 777', 161, null, 'order_desc', '777, 507, 473, 161', '["161, 473, 507, 777","777, 473, 507, 161","507, 777, 473, 161","777, 507, 473, 161"]'::jsonb, '{"kind":"chips","numbers":[161,507,473,777]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 579, 115, 766, 651', 579, null, 'order_desc', '766, 651, 579, 115', '["766, 579, 651, 115","766, 651, 579, 115","651, 766, 579, 115","115, 579, 651, 766"]'::jsonb, '{"kind":"chips","numbers":[579,115,766,651]}'::jsonb),
  ('descending-order', 'descending_order', 'hard', 'رتّبي الأعداد التالية تنازليًا: 758, 125, 494, 266', 758, null, 'order_desc', '758, 494, 266, 125', '["758, 266, 494, 125","125, 266, 494, 758","494, 758, 266, 125","758, 494, 266, 125"]'::jsonb, '{"kind":"chips","numbers":[758,125,494,266]}'::jsonb)
on conflict (game_id, question_text) do nothing;
-- PHASE4-END ==================================================================


-- PHASE5-BEGIN ================================================================
-- ============================================================================
-- المرحلة الخامسة — إضافة «مغامرة المقارنة» و«مغامرة الزوجي والفردي» إلى قسم
-- «ألعب»، فتكتمل بذلك الثماني مهارات كلها (نفس مهارات «اختبر» و«اكتشف») داخل
-- محرّك واحد عام (GamePage.tsx لا يعرف شيئًا عن أي مهارة بعينها).
--
-- نفس مستويات بقية الألعاب بالخانات: سهل = رقم واحد (١–٩)، متوسط = رقمان
-- (١٠–٩٩)، صعب = ثلاث أرقام (١٠٠–٩٩٩).
--
-- شغّلي هذا الملف مرة واحدة على قاعدتك (بعد phase4-ordering-games.sql)، ثم
-- supabase/game_bank.sql المُحدَّث (المُولَّد من node scripts/generate-game-bank.mjs،
-- ويتضمن الآن أسئلة المقارنة والزوجي/الفردي أيضًا). آمن للتشغيل أكثر من مرة
-- (create or replace / on conflict do nothing) ولا يحذف أي بيانات موجودة.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) صفّا الكتالوج الجديدان.
-- ----------------------------------------------------------------------------
insert into public.play_games (id, title, skill) values
  ('comparison', 'مغامرة المقارنة', 'comparison'),
  ('even-odd', 'مغامرة الزوجي والفردي', 'even_odd')
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- (2) توسيع بنك الأسئلة: عمليتان جديدتان compare/even_odd، وتوسيع قيد الصحة
--     الرياضية ليشملهما.
--     • المقارنة: عددان (operand_a وoperand_b)، والإجابة الصحيحة > أو < أو =
--       بحسب مقارنتهما فعليًا. الخيارات الأربعة ثابتة: < > = ولا يمكن المقارنة.
--     • الزوجي والفردي: عدد واحد فقط (operand_b فارغ)، والإجابة "زوجي" إن كان
--       operand_a زوجيًا وإلا "فردي". خياران فقط، فلا بد من توسيع قيد "أربعة
--       خيارات دائمًا" ليسمح باثنين لهذه العملية تحديدًا.
-- ----------------------------------------------------------------------------
alter table public.game_questions drop constraint if exists game_questions_operator_check;
alter table public.game_questions add constraint game_questions_operator_check
  check (operator in ('+', '-', 'round', 'double', 'order_asc', 'order_desc', 'compare', 'even_odd'));

alter table public.game_questions drop constraint if exists game_questions_options_ok;
alter table public.game_questions add constraint game_questions_options_ok check (
  jsonb_typeof(options) = 'array'
  and jsonb_array_length(options) = (case when operator = 'even_odd' then 2 else 4 end)
  and options ? correct_answer
);

alter table public.game_questions drop constraint if exists game_questions_math_ok;
alter table public.game_questions add constraint game_questions_math_ok check (
    (operator = '+'
       and operand_b is not null
       and (operand_a % 10) + (operand_b % 10) <= 9
       and (operand_a / 10) + (operand_b / 10) <= 9
       and correct_answer = (operand_a + operand_b)::text)
    or
    (operator = '-'
       and operand_b is not null
       and (operand_a % 10) >= (operand_b % 10)
       and (operand_a / 10) >= (operand_b / 10)
       and operand_a > operand_b
       and correct_answer = (operand_a - operand_b)::text)
    or
    (operator = 'round'
       and operand_b in (10, 100)
       and operand_a % operand_b <> 0
       and correct_answer = (
             case when operand_a % operand_b >= operand_b / 2
                  then (operand_a / operand_b + 1) * operand_b
                  else (operand_a / operand_b) * operand_b
             end
           )::text)
    or
    (operator = 'double'
       and operand_b is null
       and correct_answer = (operand_a * 2)::text)
    or
    (operator in ('order_asc', 'order_desc')
       and operand_b is null
       and jsonb_typeof(visual -> 'numbers') = 'array'
       and jsonb_array_length(visual -> 'numbers') = 4
       and public.jsonb_text_array_distinct_count(visual -> 'numbers') = 4
       and correct_answer = public.game_order_correct_answer(visual -> 'numbers', operator = 'order_desc'))
    or
    -- المقارنة: عددان مختلفان أو متساويان، والإجابة علامة المقارنة الفعلية بينهما.
    (operator = 'compare'
       and operand_b is not null
       and correct_answer = (case when operand_a < operand_b then '<'
                                   when operand_a > operand_b then '>'
                                   else '=' end))
    or
    -- الزوجي والفردي: عدد واحد، والإجابة زوجيته الفعلية.
    (operator = 'even_odd'
       and operand_b is null
       and correct_answer = (case when operand_a % 2 = 0 then 'زوجي' else 'فردي' end))
  );


-- ----------------------------------------------------------------------------
-- (3) لا شيء آخر يحتاج تعديلًا: start_game_attempt / record_game_answer /
--     complete_game_attempt عامّة بالفعل، وترتيب الخيارات عشوائي لكل محاولة
--     تلقائيًا (shuffle_jsonb_array) — حتى مع خياري الزوجي/الفردي فقط.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- بنك أسئلة مغامرتي المقارنة والزوجي والفردي — مُستخرَج من game_bank.sql
-- (المُولَّد آليًا: node scripts/generate-game-bank.mjs). آمن للتشغيل أكثر من
-- مرة (on conflict do nothing).
-- ============================================================================
insert into public.game_questions
  (game_id, skill, difficulty, question_text, operand_a, operand_b, operator, correct_answer, options, visual)
values
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 9 ⬜ 2', 9, 2, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":9,"second":2}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 5 ⬜ 5', 5, 5, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":5,"second":5}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 2 ⬜ 2', 2, 2, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":2,"second":2}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 4 ⬜ 2', 4, 2, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":4,"second":2}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 7 ⬜ 7', 7, 7, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":7,"second":7}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 1 ⬜ 9', 1, 9, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":1,"second":9}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 3 ⬜ 3', 3, 3, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":3,"second":3}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 3 ⬜ 2', 3, 2, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":3,"second":2}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 8 ⬜ 8', 8, 8, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":8,"second":8}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 6 ⬜ 3', 6, 3, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":6,"second":3}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 3 ⬜ 8', 3, 8, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":3,"second":8}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 7 ⬜ 5', 7, 5, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":7,"second":5}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 6 ⬜ 4', 6, 4, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":6,"second":4}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 4 ⬜ 4', 4, 4, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":4,"second":4}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 9 ⬜ 9', 9, 9, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":9,"second":9}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 5 ⬜ 7', 5, 7, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":5,"second":7}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 6 ⬜ 6', 6, 6, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":6,"second":6}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 6 ⬜ 7', 6, 7, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":6,"second":7}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 2 ⬜ 9', 2, 9, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":2,"second":9}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 1 ⬜ 1', 1, 1, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":1,"second":1}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 1 ⬜ 3', 1, 3, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":1,"second":3}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 2 ⬜ 5', 2, 5, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":2,"second":5}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 7 ⬜ 1', 7, 1, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":7,"second":1}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 4 ⬜ 5', 4, 5, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":4,"second":5}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 4 ⬜ 3', 4, 3, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":4,"second":3}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 9 ⬜ 7', 9, 7, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":9,"second":7}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 8 ⬜ 4', 8, 4, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":8,"second":4}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 8 ⬜ 1', 8, 1, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":8,"second":1}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 2 ⬜ 3', 2, 3, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":2,"second":3}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 5 ⬜ 8', 5, 8, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":5,"second":8}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 8 ⬜ 3', 8, 3, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":8,"second":3}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 6 ⬜ 5', 6, 5, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":6,"second":5}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 7 ⬜ 2', 7, 2, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":7,"second":2}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 5 ⬜ 6', 5, 6, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":5,"second":6}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 8 ⬜ 9', 8, 9, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":8,"second":9}'::jsonb),
  ('comparison', 'comparison', 'easy', 'أي العلامات تجعل المقارنة صحيحة؟ 5 ⬜ 9', 5, 9, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":5,"second":9}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 39 ⬜ 33', 39, 33, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":39,"second":33}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 59 ⬜ 59', 59, 59, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":59,"second":59}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 39 ⬜ 93', 39, 93, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":39,"second":93}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 17 ⬜ 89', 17, 89, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":17,"second":89}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 86 ⬜ 68', 86, 68, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":86,"second":68}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 83 ⬜ 83', 83, 83, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":83,"second":83}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 63 ⬜ 36', 63, 36, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":63,"second":36}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 71 ⬜ 17', 71, 17, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":71,"second":17}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 81 ⬜ 18', 81, 18, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":81,"second":18}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 17 ⬜ 71', 17, 71, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":17,"second":71}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 61 ⬜ 12', 61, 12, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":61,"second":12}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 49 ⬜ 94', 49, 94, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":49,"second":94}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 22 ⬜ 82', 22, 82, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":22,"second":82}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 58 ⬜ 58', 58, 58, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":58,"second":58}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 76 ⬜ 60', 76, 60, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":76,"second":60}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 93 ⬜ 36', 93, 36, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":93,"second":36}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 30 ⬜ 30', 30, 30, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":30,"second":30}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 74 ⬜ 71', 74, 71, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":74,"second":71}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 31 ⬜ 13', 31, 13, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":31,"second":13}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 98 ⬜ 89', 98, 89, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":98,"second":89}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 47 ⬜ 64', 47, 64, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":47,"second":64}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 76 ⬜ 31', 76, 31, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":76,"second":31}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 95 ⬜ 59', 95, 59, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":95,"second":59}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 81 ⬜ 81', 81, 81, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":81,"second":81}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 26 ⬜ 26', 26, 26, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":26,"second":26}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 97 ⬜ 79', 97, 79, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":97,"second":79}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 29 ⬜ 29', 29, 29, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":29,"second":29}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 76 ⬜ 67', 76, 67, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":76,"second":67}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 88 ⬜ 46', 88, 46, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":88,"second":46}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 27 ⬜ 19', 27, 19, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":27,"second":19}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 43 ⬜ 15', 43, 15, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":43,"second":15}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 27 ⬜ 72', 27, 72, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":27,"second":72}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 65 ⬜ 49', 65, 49, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":65,"second":49}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 16 ⬜ 61', 16, 61, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":16,"second":61}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 91 ⬜ 39', 91, 39, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":91,"second":39}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 54 ⬜ 45', 54, 45, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":54,"second":45}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 64 ⬜ 51', 64, 51, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":64,"second":51}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 15 ⬜ 78', 15, 78, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":15,"second":78}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 20 ⬜ 20', 20, 20, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":20,"second":20}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 32 ⬜ 32', 32, 32, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":32,"second":32}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 88 ⬜ 45', 88, 45, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":88,"second":45}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 64 ⬜ 46', 64, 46, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":64,"second":46}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 70 ⬜ 13', 70, 13, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":70,"second":13}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 67 ⬜ 76', 67, 76, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":67,"second":76}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 93 ⬜ 39', 93, 39, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":93,"second":39}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 68 ⬜ 68', 68, 68, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":68,"second":68}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 95 ⬜ 40', 95, 40, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":95,"second":40}'::jsonb),
  ('comparison', 'comparison', 'medium', 'أي العلامات تجعل المقارنة صحيحة؟ 52 ⬜ 30', 52, 30, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":52,"second":30}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 480 ⬜ 208', 480, 208, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":480,"second":208}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 250 ⬜ 520', 250, 520, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":250,"second":520}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 245 ⬜ 264', 245, 264, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":245,"second":264}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 179 ⬜ 197', 179, 197, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":179,"second":197}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 542 ⬜ 542', 542, 542, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":542,"second":542}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 390 ⬜ 554', 390, 554, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":390,"second":554}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 418 ⬜ 418', 418, 418, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":418,"second":418}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 436 ⬜ 264', 436, 264, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":436,"second":264}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 789 ⬜ 124', 789, 124, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":789,"second":124}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 462 ⬜ 462', 462, 462, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":462,"second":462}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 170 ⬜ 544', 170, 544, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":170,"second":544}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 805 ⬜ 235', 805, 235, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":805,"second":235}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 494 ⬜ 944', 494, 944, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":494,"second":944}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 975 ⬜ 790', 975, 790, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":975,"second":790}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 811 ⬜ 811', 811, 811, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":811,"second":811}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 862 ⬜ 394', 862, 394, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":862,"second":394}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 680 ⬜ 680', 680, 680, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":680,"second":680}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 429 ⬜ 429', 429, 429, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":429,"second":429}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 291 ⬜ 921', 291, 921, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":291,"second":921}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 445 ⬜ 529', 445, 529, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":445,"second":529}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 158 ⬜ 185', 158, 185, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":158,"second":185}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 267 ⬜ 276', 267, 276, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":267,"second":276}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 933 ⬜ 342', 933, 342, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":933,"second":342}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 657 ⬜ 657', 657, 657, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":657,"second":657}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 569 ⬜ 569', 569, 569, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":569,"second":569}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 385 ⬜ 583', 385, 583, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":385,"second":583}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 538 ⬜ 538', 538, 538, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":538,"second":538}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 175 ⬜ 715', 175, 715, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":175,"second":715}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 383 ⬜ 383', 383, 383, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":383,"second":383}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 719 ⬜ 719', 719, 719, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":719,"second":719}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 489 ⬜ 253', 489, 253, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":489,"second":253}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 186 ⬜ 816', 186, 816, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":186,"second":816}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 300 ⬜ 747', 300, 747, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":300,"second":747}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 371 ⬜ 371', 371, 371, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":371,"second":371}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 754 ⬜ 574', 754, 574, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":754,"second":574}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 293 ⬜ 239', 293, 239, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":293,"second":239}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 498 ⬜ 501', 498, 501, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":498,"second":501}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 604 ⬜ 993', 604, 993, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":604,"second":993}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 448 ⬜ 707', 448, 707, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":448,"second":707}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 533 ⬜ 744', 533, 744, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":533,"second":744}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 236 ⬜ 612', 236, 612, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":236,"second":612}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 840 ⬜ 840', 840, 840, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":840,"second":840}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 829 ⬜ 928', 829, 928, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":829,"second":928}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 507 ⬜ 507', 507, 507, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":507,"second":507}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 768 ⬜ 678', 768, 678, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":768,"second":678}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 195 ⬜ 195', 195, 195, 'compare', '=', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":195,"second":195}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 858 ⬜ 588', 858, 588, 'compare', '>', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":858,"second":588}'::jsonb),
  ('comparison', 'comparison', 'hard', 'أي العلامات تجعل المقارنة صحيحة؟ 584 ⬜ 782', 584, 782, 'compare', '<', '["<",">","=","لا يمكن المقارنة"]'::jsonb, '{"kind":"compare","first":584,"second":782}'::jsonb),
  ('even-odd', 'even_odd', 'easy', 'العدد 1 هو عدد؟', 1, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":1}'::jsonb),
  ('even-odd', 'even_odd', 'easy', 'العدد 6 هو عدد؟', 6, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":6}'::jsonb),
  ('even-odd', 'even_odd', 'easy', 'العدد 9 هو عدد؟', 9, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":9}'::jsonb),
  ('even-odd', 'even_odd', 'easy', 'العدد 4 هو عدد؟', 4, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":4}'::jsonb),
  ('even-odd', 'even_odd', 'easy', 'العدد 2 هو عدد؟', 2, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":2}'::jsonb),
  ('even-odd', 'even_odd', 'easy', 'العدد 5 هو عدد؟', 5, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":5}'::jsonb),
  ('even-odd', 'even_odd', 'easy', 'العدد 3 هو عدد؟', 3, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":3}'::jsonb),
  ('even-odd', 'even_odd', 'easy', 'العدد 7 هو عدد؟', 7, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":7}'::jsonb),
  ('even-odd', 'even_odd', 'easy', 'العدد 8 هو عدد؟', 8, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":8}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 47 هو عدد؟', 47, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":47}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 33 هو عدد؟', 33, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":33}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 50 هو عدد؟', 50, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":50}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 14 هو عدد؟', 14, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":14}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 97 هو عدد؟', 97, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":97}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 62 هو عدد؟', 62, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":62}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 38 هو عدد؟', 38, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":38}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 87 هو عدد؟', 87, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":87}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 64 هو عدد؟', 64, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":64}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 26 هو عدد؟', 26, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":26}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 40 هو عدد؟', 40, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":40}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 46 هو عدد؟', 46, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":46}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 71 هو عدد؟', 71, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":71}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 21 هو عدد؟', 21, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":21}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 84 هو عدد؟', 84, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":84}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 23 هو عدد؟', 23, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":23}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 51 هو عدد؟', 51, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":51}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 45 هو عدد؟', 45, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":45}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 39 هو عدد؟', 39, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":39}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 28 هو عدد؟', 28, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":28}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 52 هو عدد؟', 52, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":52}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 79 هو عدد؟', 79, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":79}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 58 هو عدد؟', 58, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":58}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 24 هو عدد؟', 24, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":24}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 29 هو عدد؟', 29, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":29}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 35 هو عدد؟', 35, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":35}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 93 هو عدد؟', 93, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":93}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 77 هو عدد؟', 77, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":77}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 19 هو عدد؟', 19, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":19}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 41 هو عدد؟', 41, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":41}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 27 هو عدد؟', 27, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":27}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 12 هو عدد؟', 12, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":12}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 10 هو عدد؟', 10, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":10}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 31 هو عدد؟', 31, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":31}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 95 هو عدد؟', 95, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":95}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 65 هو عدد؟', 65, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":65}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 67 هو عدد؟', 67, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":67}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 17 هو عدد؟', 17, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":17}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 76 هو عدد؟', 76, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":76}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 75 هو عدد؟', 75, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":75}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 70 هو عدد؟', 70, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":70}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 88 هو عدد؟', 88, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":88}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 80 هو عدد؟', 80, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":80}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 56 هو عدد؟', 56, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":56}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 82 هو عدد؟', 82, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":82}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 53 هو عدد؟', 53, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":53}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 59 هو عدد؟', 59, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":59}'::jsonb),
  ('even-odd', 'even_odd', 'medium', 'العدد 49 هو عدد؟', 49, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":49}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 723 هو عدد؟', 723, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":723}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 674 هو عدد؟', 674, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":674}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 748 هو عدد؟', 748, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":748}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 870 هو عدد؟', 870, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":870}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 816 هو عدد؟', 816, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":816}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 421 هو عدد؟', 421, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":421}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 837 هو عدد؟', 837, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":837}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 263 هو عدد؟', 263, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":263}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 744 هو عدد؟', 744, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":744}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 936 هو عدد؟', 936, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":936}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 198 هو عدد؟', 198, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":198}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 422 هو عدد؟', 422, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":422}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 646 هو عدد؟', 646, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":646}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 644 هو عدد؟', 644, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":644}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 449 هو عدد؟', 449, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":449}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 553 هو عدد؟', 553, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":553}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 916 هو عدد؟', 916, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":916}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 354 هو عدد؟', 354, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":354}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 530 هو عدد؟', 530, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":530}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 241 هو عدد؟', 241, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":241}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 584 هو عدد؟', 584, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":584}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 970 هو عدد؟', 970, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":970}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 515 هو عدد؟', 515, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":515}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 247 هو عدد؟', 247, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":247}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 974 هو عدد؟', 974, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":974}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 474 هو عدد؟', 474, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":474}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 238 هو عدد؟', 238, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":238}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 279 هو عدد؟', 279, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":279}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 441 هو عدد؟', 441, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":441}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 628 هو عدد؟', 628, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":628}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 467 هو عدد؟', 467, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":467}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 383 هو عدد؟', 383, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":383}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 266 هو عدد؟', 266, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":266}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 412 هو عدد؟', 412, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":412}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 397 هو عدد؟', 397, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":397}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 665 هو عدد؟', 665, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":665}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 169 هو عدد؟', 169, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":169}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 772 هو عدد؟', 772, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":772}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 133 هو عدد؟', 133, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":133}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 394 هو عدد؟', 394, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":394}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 190 هو عدد؟', 190, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":190}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 661 هو عدد؟', 661, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":661}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 278 هو عدد؟', 278, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":278}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 788 هو عدد؟', 788, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":788}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 319 هو عدد؟', 319, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":319}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 796 هو عدد؟', 796, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":796}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 199 هو عدد؟', 199, null, 'even_odd', 'فردي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":199}'::jsonb),
  ('even-odd', 'even_odd', 'hard', 'العدد 714 هو عدد؟', 714, null, 'even_odd', 'زوجي', '["زوجي","فردي"]'::jsonb, '{"kind":"number","value":714}'::jsonb)
on conflict (game_id, question_text) do nothing;
-- PHASE5-END ==================================================================


-- PHASE6-BEGIN ================================================================
-- ============================================================================
-- المرحلة السادسة — ثلاثة إصلاحات من مراجعة المنصة:
--   (١) تتبّع حقيقي لقسم «تدرّب» (لم يكن له أي أثر في قاعدة البيانات من قبل).
--   (٢) شارتان جديدتان لكل من «العب» و«تدرّب» (لم يكن لهما أي شارة رغم منحهما
--       نجومًا حقيقية) — بنفس فلسفة شارتَي الدروس تمامًا.
--   (٣) استدعاء تقييم الشارات من داخل complete_game_attempt (لم يكن يستدعيه
--       من قبل، فلم تُمنح شارات «العب» حتى بعد إضافتها لولا هذا التعديل).
--
-- شغّليه مرة واحدة على قاعدتك، بعد phase5-compare-evenodd-games.sql. آمن
-- للتشغيل أكثر من مرة (create or replace / on conflict do nothing) ولا يحذف
-- أي بيانات موجودة.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) جدول practice_completions — نفس بنية lesson_completions تمامًا:
--     unique(student_id, practice_id) يمنع منح نقاطه أكثر من مرة لنفس التدريب،
--     حتى لو أُعيد فتح الملف أو نُزِّل عدة مرات.
-- ----------------------------------------------------------------------------
create table if not exists public.practice_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  practice_id text not null,
  points_awarded integer not null default 0,
  completed_at timestamptz not null default now(),
  unique (student_id, practice_id)
);

alter table public.practice_completions enable row level security;

drop policy if exists "practice_completions_select_own_student" on public.practice_completions;
create policy "practice_completions_select_own_student"
  on public.practice_completions for select
  using (student_id = auth.uid());

drop policy if exists "practice_completions_select_own_teacher" on public.practice_completions;
create policy "practice_completions_select_own_teacher"
  on public.practice_completions for select
  using (public.is_teacher_of_student(student_id));


-- ----------------------------------------------------------------------------
-- (2) إكمال تدريب من «تدرّب» — نفس فلسفة complete_lesson تمامًا، بنقاط أقل (٣
--     بدل ٥) لأن فتح/تنزيل ملف PDF إشارة أضعف من مشاهدة فيديو كامل حتى النهاية
--     (لا يوجد ما يثبت أن الطالبة فعلًا حلّت الورقة، فقط أنها فتحتها).
-- ----------------------------------------------------------------------------
create or replace function public.complete_practice(p_practice_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points constant integer := 3;
begin
  insert into public.practice_completions (student_id, practice_id, points_awarded)
  values (auth.uid(), p_practice_id, v_points)
  on conflict (student_id, practice_id) do nothing;

  if found then
    update public.students set stars = stars + v_points where id = auth.uid();
    perform public.evaluate_and_award_badges(auth.uid());
  end if;
end;
$$;

grant execute on function public.complete_practice(text) to authenticated;
revoke execute on function public.complete_practice(text) from public, anon;


-- ----------------------------------------------------------------------------
-- (3) شارتان لـ«العب» (على عدد الألعاب الثماني المختلفة المكتملة مرة واحدة
--     فأكثر — وليس عدد المحاولات، فاللعبة تُلعب مرارًا) وشارتان لـ«تدرّب».
-- ----------------------------------------------------------------------------
insert into public.badges (code, name, description, condition_type, condition_value) values
  ('game_starter', 'أول لعبة', 'يُمنح عند إكمال أول لعبة في «العب»', 'games_completed_count', 1),
  ('game_master', 'بطلة الألعاب الثمان', 'يُمنح عند إكمال الألعاب الثماني كلها مرة واحدة على الأقل', 'games_completed_count', 8),
  ('practice_starter', 'أول تدريب', 'يُمنح عند فتح أول ورقة عمل في «تدرّب»', 'practice_completed_count', 1),
  ('practice_master', 'بطلة التدريبات', 'يُمنح عند إتمام التدريبات الثمانية كلها', 'practice_completed_count', 8)
on conflict (code) do nothing;


-- ----------------------------------------------------------------------------
-- (4) تحديث evaluate_and_award_badges (استبدال، وليس نظامًا جديدًا) — يبقى كل
--     شرط قديم كما هو تمامًا، ويُضاف شرطا الألعاب والتدريبات إلى نفس المنطق
--     الموحّد. games_completed_count = عدد الألعاب (game_id) المختلفة التي
--     أكملتها الطالبة ولو مرة واحدة، لا عدد محاولاتها الكلي.
-- ----------------------------------------------------------------------------
create or replace function public.evaluate_and_award_badges(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tasks_completed integer;
  v_lessons_completed integer;
  v_placements_completed integer;
  v_quiz_completed integer;
  v_quiz_perfect integer;
  v_games_completed integer;
  v_practice_completed integer;
begin
  select count(*) into v_tasks_completed
  from public.task_assignments
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_lessons_completed
  from public.lesson_completions
  where student_id = target_student_id;

  select count(*) into v_placements_completed
  from public.placement_attempts
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_quiz_completed
  from public.quiz_attempts
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_quiz_perfect
  from public.quiz_attempts
  where student_id = target_student_id and status = 'completed'
    and total_questions > 0 and correct_answers = total_questions;

  select count(distinct game_id) into v_games_completed
  from public.game_attempts
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_practice_completed
  from public.practice_completions
  where student_id = target_student_id;

  insert into public.student_badges (student_id, badge_id)
  select target_student_id, b.id
  from public.badges b
  where (b.condition_type = 'tasks_completed_count' and v_tasks_completed >= b.condition_value)
     or (b.condition_type = 'lessons_completed_count' and v_lessons_completed >= b.condition_value)
     or (b.condition_type = 'placement_completed_count' and v_placements_completed >= b.condition_value)
     or (b.condition_type = 'quiz_completed_count' and v_quiz_completed >= b.condition_value)
     or (b.condition_type = 'quiz_perfect_count' and v_quiz_perfect >= b.condition_value)
     or (b.condition_type = 'games_completed_count' and v_games_completed >= b.condition_value)
     or (b.condition_type = 'practice_completed_count' and v_practice_completed >= b.condition_value)
  on conflict (student_id, badge_id) do nothing;
end;
$$;


-- ----------------------------------------------------------------------------
-- (5) تحديث complete_game_attempt (استبدال، الجسم كما هو تمامًا) — الإضافة
--     الوحيدة هي استدعاء تقييم الشارات في النهاية، فتُمنح شارتا «العب» أعلاه
--     فعليًا (لم يكن هذا الاستدعاء موجودًا إطلاقًا من قبل).
-- ----------------------------------------------------------------------------
create or replace function public.complete_game_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a public.game_attempts%rowtype;
  v_total integer;
  v_correct integer;
  v_wrong integer;
  v_pct numeric;
  v_duration integer;
  v_reward_enabled boolean;
  v_reward_min integer;
  v_points integer := 0;
  v_prior_completed integer;
begin
  select * into v_a from public.game_attempts where id = p_attempt_id;
  if not found then
    raise exception 'المحاولة غير موجودة';
  end if;
  if v_a.student_id <> auth.uid() then
    raise exception 'غير مصرَّح';
  end if;
  if v_a.status = 'completed' then
    return;
  end if;
  if v_a.status <> 'in_progress' then
    raise exception 'هذه المحاولة لم تعد مفتوحة';
  end if;

  if exists (
    select 1 from public.game_attempt_questions
    where attempt_id = p_attempt_id and selected_answer is null
  ) then
    raise exception 'أكملي كل الأسئلة أولًا';
  end if;

  select
    count(*),
    count(*) filter (where is_correct),
    count(*) filter (where not is_correct),
    least(3600, greatest(0, extract(epoch from (max(answered_at) - v_a.started_at))::integer))
  into v_total, v_correct, v_wrong, v_duration
  from public.game_attempt_questions
  where attempt_id = p_attempt_id;

  v_pct := round((v_correct::numeric / greatest(v_total, 1)) * 100);

  select reward_enabled, reward_min_percentage into v_reward_enabled, v_reward_min
  from public.play_games where id = v_a.game_id;

  select count(*) into v_prior_completed
  from public.game_attempts
  where student_id = v_a.student_id and game_id = v_a.game_id and status = 'completed';

  if coalesce(v_reward_enabled, false) and v_prior_completed = 0 and v_pct >= coalesce(v_reward_min, 0) then
    v_points := v_correct;
  end if;

  update public.game_attempts
  set status = 'completed',
      completed_at = now(),
      total_questions = v_total,
      correct_answers = v_correct,
      wrong_answers = v_wrong,
      percentage = v_pct,
      duration_seconds = v_duration,
      points_awarded = v_points
  where id = p_attempt_id;

  if v_points > 0 then
    update public.students set stars = stars + v_points where id = v_a.student_id;
  end if;

  -- الإضافة الوحيدة عن النسخة السابقة: تُستدعى في كل مرة (لا فقط عند منح
  -- نقاط) لأن أول محاولة مكتملة للعبة تحديدًا هي ما يُحتسَب لشارة games_
  -- completed_count، حتى لو كانت نسبة النجاح دون الحد الأدنى فلم تُمنح نجوم.
  perform public.evaluate_and_award_badges(v_a.student_id);
end;
$$;

grant execute on function public.complete_game_attempt(uuid) to authenticated;
revoke execute on function public.complete_game_attempt(uuid) from public, anon;
-- PHASE6-END ==================================================================


-- PHASE7-BEGIN ================================================================
-- ============================================================================
-- المرحلة السابعة — تتبّع حقيقي + نجوم + شارتان لقسم "المبادرات" (هويتي ووطني،
-- مبادرة القائد الرقمي، وتنمية المهارات النمائية مستقبلًا) — لم يكن لهذا
-- القسم أي تتبّع أو نجوم أو ظهور في صفحة المعلمة من قبل، بنفس فلسفة
-- lesson_completions/practice_completions تمامًا.
--
-- "إكمال" مبادرة من نوع slides = الوصول لآخر شريحة فعليًا (نفس مبدأ onEnded
-- في الفيديو)؛ من نوع pdf = ضغط الطالبة زر "أنهيت الاطلاع" بنفسها (لا توجد
-- إشارة برمجية حقيقية داخل عارض PDF مضمّن، فهذا إقرار صريح منها، لا افتراض).
--
-- شغّليه مرة واحدة على قاعدتك، بعد phase6-badges-practice.sql. آمن للتشغيل
-- أكثر من مرة، ولا يحذف أي بيانات موجودة.
-- ============================================================================

create table if not exists public.initiative_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  initiative_id text not null,
  points_awarded integer not null default 0,
  completed_at timestamptz not null default now(),
  unique (student_id, initiative_id)
);

alter table public.initiative_completions enable row level security;

drop policy if exists "initiative_completions_select_own_student" on public.initiative_completions;
create policy "initiative_completions_select_own_student"
  on public.initiative_completions for select
  using (student_id = auth.uid());

drop policy if exists "initiative_completions_select_own_teacher" on public.initiative_completions;
create policy "initiative_completions_select_own_teacher"
  on public.initiative_completions for select
  using (public.is_teacher_of_student(student_id));

create or replace function public.complete_initiative(p_initiative_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points constant integer := 5;
begin
  insert into public.initiative_completions (student_id, initiative_id, points_awarded)
  values (auth.uid(), p_initiative_id, v_points)
  on conflict (student_id, initiative_id) do nothing;

  if found then
    update public.students set stars = stars + v_points where id = auth.uid();
    perform public.evaluate_and_award_badges(auth.uid());
  end if;
end;
$$;

grant execute on function public.complete_initiative(text) to authenticated;
revoke execute on function public.complete_initiative(text) from public, anon;

insert into public.badges (code, name, description, condition_type, condition_value) values
  ('initiative_starter', 'مستكشفة المبادرات', 'يُمنح عند إكمال أول مبادرة', 'initiatives_completed_count', 1),
  ('initiative_master', 'سفيرة المبادرات', 'يُمنح عند إكمال كل المبادرات الثلاث', 'initiatives_completed_count', 3)
on conflict (code) do nothing;

-- استبدال evaluate_and_award_badges — كل الشروط القديمة كما هي تمامًا، مع
-- إضافة شرط initiatives_completed_count فقط.
create or replace function public.evaluate_and_award_badges(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tasks_completed integer;
  v_lessons_completed integer;
  v_placements_completed integer;
  v_quiz_completed integer;
  v_quiz_perfect integer;
  v_games_completed integer;
  v_practice_completed integer;
  v_initiatives_completed integer;
begin
  select count(*) into v_tasks_completed
  from public.task_assignments
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_lessons_completed
  from public.lesson_completions
  where student_id = target_student_id;

  select count(*) into v_placements_completed
  from public.placement_attempts
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_quiz_completed
  from public.quiz_attempts
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_quiz_perfect
  from public.quiz_attempts
  where student_id = target_student_id and status = 'completed'
    and total_questions > 0 and correct_answers = total_questions;

  select count(distinct game_id) into v_games_completed
  from public.game_attempts
  where student_id = target_student_id and status = 'completed';

  select count(*) into v_practice_completed
  from public.practice_completions
  where student_id = target_student_id;

  select count(*) into v_initiatives_completed
  from public.initiative_completions
  where student_id = target_student_id;

  insert into public.student_badges (student_id, badge_id)
  select target_student_id, b.id
  from public.badges b
  where (b.condition_type = 'tasks_completed_count' and v_tasks_completed >= b.condition_value)
     or (b.condition_type = 'lessons_completed_count' and v_lessons_completed >= b.condition_value)
     or (b.condition_type = 'placement_completed_count' and v_placements_completed >= b.condition_value)
     or (b.condition_type = 'quiz_completed_count' and v_quiz_completed >= b.condition_value)
     or (b.condition_type = 'quiz_perfect_count' and v_quiz_perfect >= b.condition_value)
     or (b.condition_type = 'games_completed_count' and v_games_completed >= b.condition_value)
     or (b.condition_type = 'practice_completed_count' and v_practice_completed >= b.condition_value)
     or (b.condition_type = 'initiatives_completed_count' and v_initiatives_completed >= b.condition_value)
  on conflict (student_id, badge_id) do nothing;
end;
$$;
-- PHASE7-END ==================================================================
