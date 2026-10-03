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

alter table public.game_questions drop constraint if exists game_questions_operator_check;
alter table public.game_questions add constraint game_questions_operator_check
  check (operator in ('+', '-', 'round', 'double'));

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
  );

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
