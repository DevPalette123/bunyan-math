-- ============================================================================
-- Migration: اختبار «اكتشف» لتحديد المستوى + إكمال دروس «تعلّم»
-- انسخي هذا الملف بالكامل وشغّليه مرة واحدة في Supabase SQL Editor.
-- هذا المحتوى نفسه ملحق الآن أيضًا بنهاية supabase/schema.sql (لا حاجة
-- لتشغيله مرتين إن كنتِ ستشغّلين schema.sql كاملًا من جديد).
-- قابل لإعادة التشغيل بأمان (كل الأوامر IF NOT EXISTS / CREATE OR REPLACE).
-- يتضمن إصلاح: ترتيب الخيارات كان يضع الإجابة الصحيحة دائمًا أولًا.
-- ============================================================================


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
