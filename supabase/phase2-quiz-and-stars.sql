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
