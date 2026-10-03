-- ============================================================================
-- المرحلة التاسعة — «المسابقات»
-- نظام مستقل تمامًا عن الطلاب والنجوم والشارات: المسابقة تُنشأ وتُنشر من المعلمة،
-- ويشارك فيها أي شخص يملك الرابط (اسم + صف فقط) دون حساب.
--
-- شغّليه مرة واحدة في SQL Editor. آمن للتشغيل أكثر من مرة، ولا يلمس أي جدول
-- أو دالة أو سياسة موجودة سابقًا (كل الأسماء الجديدة تبدأ بـ competition_).
--
-- مبدأ الأمان:
--   * الجداول كلها مقفلة على المتصفح: المعلمة (مالكة المسابقة) فقط تقرأ/تكتب.
--   * الزائر لا يصل لأي جدول مباشرة. يقرأ المسابقة عبر get_public_competition
--     (لا تُرجع أي إجابة صحيحة) ويُرسل عبر submit_competition (التصحيح يتم داخل
--     قاعدة البيانات، والزائر لا يقرأ شيئًا من مشاركات غيره).
--   * ملفات الوسائط في Storage خاصة؛ تُقرأ فقط إذا كانت تخص مسابقة «منشورة».
-- ============================================================================

-- 0) دالة مساعدة: هل المستخدم الحالي معلمة؟ ---------------------------------
create or replace function public.is_teacher_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  );
$$;

-- 1) المسابقات ---------------------------------------------------------------
create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  -- معرّف الرابط العام: 12 خانة عشوائية قوية (من gen_random_uuid) — غير قابل للتخمين.
  slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  title text not null check (char_length(title) between 1 and 150),
  description text check (description is null or char_length(description) <= 2000),
  target_grade text check (target_grade is null or char_length(target_grade) <= 60),
  theme text not null default 'sky' check (theme in ('sky', 'mint', 'lilac', 'peach', 'sun')),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 600),
  show_score boolean not null default true,
  allow_retake boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists competitions_teacher_idx
  on public.competitions (teacher_id, created_at desc);

-- 2) الصفحات / المراحل -------------------------------------------------------
create table if not exists public.competition_pages (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  position integer not null default 0,
  title text check (title is null or char_length(title) <= 150)
);

create index if not exists competition_pages_comp_idx
  on public.competition_pages (competition_id, position);

-- 3) عناصر الصفحة (عنوان، نص، صورة، فيديو، PDF، رابط، سؤال، ...) -------------
--    data: محتوى العنصر غير السرّي فقط (نص/رابط/مسار ملف). لا إجابات صحيحة هنا أبدًا.
create table if not exists public.competition_items (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  page_id uuid not null references public.competition_pages (id) on delete cascade,
  position integer not null default 0,
  kind text not null check (
    kind in ('heading', 'text', 'instructions', 'image', 'video', 'pdf', 'link', 'divider', 'button', 'question')
  ),
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 20000)
);

create index if not exists competition_items_page_idx
  on public.competition_items (page_id, position);
create index if not exists competition_items_comp_idx
  on public.competition_items (competition_id);
create index if not exists competition_items_path_idx
  on public.competition_items ((data ->> 'path'))
  where data ? 'path';

-- 4) الأسئلة (صف واحد لكل عنصر من نوع question) — هنا تُحفظ الإجابات الصحيحة ----
create table if not exists public.competition_questions (
  id uuid primary key references public.competition_items (id) on delete cascade,
  competition_id uuid not null references public.competitions (id) on delete cascade,
  qtype text not null check (qtype in ('mcq', 'true_false', 'number', 'text')),
  prompt text not null check (char_length(prompt) between 1 and 2000),
  points integer not null default 1 check (points between 0 and 100),
  tf_answer boolean,
  number_answer numeric,
  number_tolerance numeric not null default 0 check (number_tolerance >= 0),
  text_answers text[] not null default '{}'
);

create index if not exists competition_questions_comp_idx
  on public.competition_questions (competition_id);

-- 5) خيارات الاختيار من متعدد ------------------------------------------------
create table if not exists public.competition_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.competition_questions (id) on delete cascade,
  competition_id uuid not null references public.competitions (id) on delete cascade,
  position integer not null default 0,
  label text not null check (char_length(label) between 1 and 500),
  is_correct boolean not null default false
);

create index if not exists competition_options_q_idx
  on public.competition_options (question_id, position);

-- 6) المشاركات (مشاركة = اسم + صف + نتيجة؛ ليست حساب طالب ولا مرتبطة بجدول students)
create table if not exists public.competition_submissions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  participant_name text not null check (char_length(participant_name) between 2 and 80),
  grade_label text not null check (char_length(grade_label) between 1 and 40),
  name_key text not null,
  client_token text check (client_token is null or char_length(client_token) <= 80),
  score integer not null default 0,
  max_score integer not null default 0,
  correct_count integer not null default 0,
  question_count integer not null default 0,
  started_at timestamptz,
  submitted_at timestamptz not null default now(),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  timed_out boolean not null default false
);

create index if not exists competition_submissions_comp_idx
  on public.competition_submissions (competition_id, submitted_at desc);
create index if not exists competition_submissions_key_idx
  on public.competition_submissions (competition_id, name_key);

-- 7) إجابات كل مشاركة. تحمل لقطة (snapshot) من نص السؤال والإجابة الصحيحة وقت
--    الإرسال، حتى لا تتغير نتائج قديمة ولا تضيع إن عدّلت المعلمة المسابقة لاحقًا.
create table if not exists public.competition_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.competition_submissions (id) on delete cascade,
  question_id uuid references public.competition_questions (id) on delete set null,
  position integer not null default 0,
  qtype text not null,
  prompt_snapshot text not null,
  answer_text text,
  correct_text text,
  is_correct boolean not null default false,
  points_awarded integer not null default 0,
  points_possible integer not null default 0
);

create index if not exists competition_answers_sub_idx
  on public.competition_answers (submission_id, position);

-- 8) محفّزات: تحديث updated_at، وتسجيل وقت أول نشر ----------------------------
create or replace function public.competition_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    if tg_op = 'INSERT' then
      new.published_at := now();
    elsif old.status is distinct from 'published' then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists competitions_before_write on public.competitions;
create trigger competitions_before_write
  before insert or update on public.competitions
  for each row execute function public.competition_before_write();

-- 9) دوال الملكية (SECURITY DEFINER لتجنب تكرار سياسات RLS) ------------------
create or replace function public.owns_competition(target_competition_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.competitions c
    where c.id = target_competition_id
      and c.teacher_id = auth.uid()
  ) and public.is_teacher_user();
$$;

create or replace function public.owns_competition_submission(target_submission_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.competition_submissions s
    join public.competitions c on c.id = s.competition_id
    where s.id = target_submission_id
      and c.teacher_id = auth.uid()
  ) and public.is_teacher_user();
$$;

-- 10) تفعيل RLS + سحب كل الصلاحيات الافتراضية ثم منح الضروري فقط -------------
alter table public.competitions            enable row level security;
alter table public.competition_pages       enable row level security;
alter table public.competition_items       enable row level security;
alter table public.competition_questions   enable row level security;
alter table public.competition_options     enable row level security;
alter table public.competition_submissions enable row level security;
alter table public.competition_answers     enable row level security;

revoke all on public.competitions            from anon, authenticated;
revoke all on public.competition_pages       from anon, authenticated;
revoke all on public.competition_items       from anon, authenticated;
revoke all on public.competition_questions   from anon, authenticated;
revoke all on public.competition_options     from anon, authenticated;
revoke all on public.competition_submissions from anon, authenticated;
revoke all on public.competition_answers     from anon, authenticated;

grant select, insert, update, delete on public.competitions          to authenticated;
grant select, insert, update, delete on public.competition_pages     to authenticated;
grant select, insert, update, delete on public.competition_items     to authenticated;
grant select, insert, update, delete on public.competition_questions to authenticated;
grant select, insert, update, delete on public.competition_options   to authenticated;
-- المشاركات والإجابات: المعلمة تقرأ فقط (والحذف للمشاركة). لا إدخال من المتصفح إطلاقًا.
grant select, delete on public.competition_submissions to authenticated;
grant select         on public.competition_answers     to authenticated;

-- سياسات competitions
drop policy if exists "competitions_owner_select" on public.competitions;
create policy "competitions_owner_select" on public.competitions for select
  using (teacher_id = auth.uid() and public.is_teacher_user());

drop policy if exists "competitions_owner_insert" on public.competitions;
create policy "competitions_owner_insert" on public.competitions for insert
  with check (teacher_id = auth.uid() and public.is_teacher_user());

drop policy if exists "competitions_owner_update" on public.competitions;
create policy "competitions_owner_update" on public.competitions for update
  using (teacher_id = auth.uid() and public.is_teacher_user())
  with check (teacher_id = auth.uid() and public.is_teacher_user());

drop policy if exists "competitions_owner_delete" on public.competitions;
create policy "competitions_owner_delete" on public.competitions for delete
  using (teacher_id = auth.uid() and public.is_teacher_user());

-- سياسات الجداول الفرعية: المالكة فقط
drop policy if exists "competition_pages_owner_all" on public.competition_pages;
create policy "competition_pages_owner_all" on public.competition_pages for all
  using (public.owns_competition(competition_id))
  with check (public.owns_competition(competition_id));

drop policy if exists "competition_items_owner_all" on public.competition_items;
create policy "competition_items_owner_all" on public.competition_items for all
  using (public.owns_competition(competition_id))
  with check (public.owns_competition(competition_id));

drop policy if exists "competition_questions_owner_all" on public.competition_questions;
create policy "competition_questions_owner_all" on public.competition_questions for all
  using (public.owns_competition(competition_id))
  with check (public.owns_competition(competition_id));

drop policy if exists "competition_options_owner_all" on public.competition_options;
create policy "competition_options_owner_all" on public.competition_options for all
  using (public.owns_competition(competition_id))
  with check (public.owns_competition(competition_id));

-- المشاركات والإجابات: قراءة المالكة فقط
drop policy if exists "competition_submissions_owner_select" on public.competition_submissions;
create policy "competition_submissions_owner_select" on public.competition_submissions for select
  using (public.owns_competition(competition_id));

drop policy if exists "competition_submissions_owner_delete" on public.competition_submissions;
create policy "competition_submissions_owner_delete" on public.competition_submissions for delete
  using (public.owns_competition(competition_id));

drop policy if exists "competition_answers_owner_select" on public.competition_answers;
create policy "competition_answers_owner_select" on public.competition_answers for select
  using (public.owns_competition_submission(submission_id));

-- 11) حفظ المسابقة كاملة بعملية واحدة (ذرّية) --------------------------------
--     يستقبل JSON فيه الإعدادات + الصفحات + العناصر + الأسئلة + الخيارات.
--     المعرفات تُولَّد من الواجهة، والحفظ upsert حتى تبقى معرفات الأسئلة ثابتة
--     (فلا تضيع روابط الإجابات القديمة عند تعديل مسابقة منشورة).
create or replace function public.save_competition(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_owner uuid;
  v_theme text;
  v_page jsonb;
  v_item jsonb;
  v_opt jsonb;
  v_q jsonb;
  v_pi integer;
  v_ii integer;
  v_oi integer;
  v_item_id uuid;
  v_page_id uuid;
  v_page_ids uuid[] := '{}';
  v_item_ids uuid[] := '{}';
  v_question_ids uuid[] := '{}';
  v_option_ids uuid[] := '{}';
  v_item_count integer := 0;
  v_url text;
begin
  if v_uid is null or not public.is_teacher_user() then
    raise exception 'forbidden';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_payload';
  end if;

  v_id := nullif(p_payload ->> 'id', '')::uuid;
  if v_id is null then
    raise exception 'missing_id';
  end if;

  if jsonb_array_length(coalesce(p_payload -> 'pages', '[]'::jsonb)) > 30 then
    raise exception 'too_many_pages';
  end if;

  v_theme := coalesce(nullif(p_payload ->> 'theme', ''), 'sky');

  select teacher_id into v_owner from public.competitions where id = v_id;
  if not found then
    insert into public.competitions (
      id, teacher_id, title, description, target_grade, theme,
      starts_at, ends_at, duration_minutes, show_score, allow_retake
    ) values (
      v_id, v_uid,
      btrim(coalesce(p_payload ->> 'title', '')),
      nullif(btrim(coalesce(p_payload ->> 'description', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'target_grade', '')), ''),
      v_theme,
      nullif(p_payload ->> 'starts_at', '')::timestamptz,
      nullif(p_payload ->> 'ends_at', '')::timestamptz,
      nullif(p_payload ->> 'duration_minutes', '')::integer,
      coalesce((p_payload ->> 'show_score')::boolean, true),
      coalesce((p_payload ->> 'allow_retake')::boolean, false)
    );
  else
    if v_owner <> v_uid then
      raise exception 'forbidden';
    end if;
    update public.competitions set
      title = btrim(coalesce(p_payload ->> 'title', '')),
      description = nullif(btrim(coalesce(p_payload ->> 'description', '')), ''),
      target_grade = nullif(btrim(coalesce(p_payload ->> 'target_grade', '')), ''),
      theme = v_theme,
      starts_at = nullif(p_payload ->> 'starts_at', '')::timestamptz,
      ends_at = nullif(p_payload ->> 'ends_at', '')::timestamptz,
      duration_minutes = nullif(p_payload ->> 'duration_minutes', '')::integer,
      show_score = coalesce((p_payload ->> 'show_score')::boolean, true),
      allow_retake = coalesce((p_payload ->> 'allow_retake')::boolean, false)
    where id = v_id;
  end if;

  -- (أ) الصفحات
  v_pi := 0;
  for v_page in select * from jsonb_array_elements(coalesce(p_payload -> 'pages', '[]'::jsonb)) loop
    v_page_id := (v_page ->> 'id')::uuid;
    v_page_ids := v_page_ids || v_page_id;
    insert into public.competition_pages (id, competition_id, position, title)
    values (v_page_id, v_id, v_pi, nullif(btrim(coalesce(v_page ->> 'title', '')), ''))
    on conflict (id) do update
      set position = excluded.position, title = excluded.title
      where public.competition_pages.competition_id = v_id;
    v_pi := v_pi + 1;
  end loop;

  -- (ب) العناصر + الأسئلة + الخيارات
  v_pi := 0;
  for v_page in select * from jsonb_array_elements(coalesce(p_payload -> 'pages', '[]'::jsonb)) loop
    v_page_id := (v_page ->> 'id')::uuid;
    v_ii := 0;
    for v_item in select * from jsonb_array_elements(coalesce(v_page -> 'items', '[]'::jsonb)) loop
      v_item_count := v_item_count + 1;
      if v_item_count > 300 then
        raise exception 'too_many_items';
      end if;

      v_item_id := (v_item ->> 'id')::uuid;
      v_item_ids := v_item_ids || v_item_id;

      -- أي رابط خارجي يجب أن يكون http(s) فقط (منع javascript: وما شابه).
      v_url := v_item -> 'data' ->> 'url';
      if v_url is not null and v_url !~* '^https?://' then
        raise exception 'invalid_url';
      end if;

      insert into public.competition_items (id, competition_id, page_id, position, kind, data)
      values (
        v_item_id, v_id, v_page_id, v_ii,
        v_item ->> 'kind',
        coalesce(v_item -> 'data', '{}'::jsonb)
      )
      on conflict (id) do update
        set page_id = excluded.page_id,
            position = excluded.position,
            kind = excluded.kind,
            data = excluded.data
        where public.competition_items.competition_id = v_id;

      if v_item ->> 'kind' = 'question' then
        v_q := v_item -> 'question';
        if v_q is null or jsonb_typeof(v_q) <> 'object' then
          raise exception 'missing_question';
        end if;
        v_question_ids := v_question_ids || v_item_id;

        insert into public.competition_questions (
          id, competition_id, qtype, prompt, points,
          tf_answer, number_answer, number_tolerance, text_answers
        ) values (
          v_item_id, v_id,
          v_q ->> 'qtype',
          btrim(coalesce(v_q ->> 'prompt', '')),
          coalesce(nullif(v_q ->> 'points', '')::integer, 1),
          nullif(v_q ->> 'tf_answer', '')::boolean,
          nullif(v_q ->> 'number_answer', '')::numeric,
          coalesce(nullif(v_q ->> 'number_tolerance', '')::numeric, 0),
          coalesce(
            (select array_agg(btrim(t)) from jsonb_array_elements_text(coalesce(v_q -> 'text_answers', '[]'::jsonb)) t
              where btrim(t) <> ''),
            '{}'::text[]
          )
        )
        on conflict (id) do update
          set qtype = excluded.qtype,
              prompt = excluded.prompt,
              points = excluded.points,
              tf_answer = excluded.tf_answer,
              number_answer = excluded.number_answer,
              number_tolerance = excluded.number_tolerance,
              text_answers = excluded.text_answers
          where public.competition_questions.competition_id = v_id;

        v_oi := 0;
        if v_q ->> 'qtype' = 'mcq' then
          for v_opt in select * from jsonb_array_elements(coalesce(v_q -> 'options', '[]'::jsonb)) loop
            v_option_ids := v_option_ids || (v_opt ->> 'id')::uuid;
            insert into public.competition_options (id, question_id, competition_id, position, label, is_correct)
            values (
              (v_opt ->> 'id')::uuid, v_item_id, v_id, v_oi,
              btrim(coalesce(v_opt ->> 'label', '')),
              coalesce((v_opt ->> 'is_correct')::boolean, false)
            )
            on conflict (id) do update
              set question_id = excluded.question_id,
                  position = excluded.position,
                  label = excluded.label,
                  is_correct = excluded.is_correct
              where public.competition_options.competition_id = v_id;
            v_oi := v_oi + 1;
          end loop;
        end if;
      end if;

      v_ii := v_ii + 1;
    end loop;
    v_pi := v_pi + 1;
  end loop;

  -- (ج) حذف ما أُزيل من الواجهة (الترتيب مهم: العناصر أولًا ثم الصفحات)
  delete from public.competition_options
    where competition_id = v_id and not (id = any (v_option_ids));
  delete from public.competition_questions
    where competition_id = v_id and not (id = any (v_question_ids));
  delete from public.competition_items
    where competition_id = v_id and not (id = any (v_item_ids));
  delete from public.competition_pages
    where competition_id = v_id and not (id = any (v_page_ids));

  return v_id;
end;
$$;

revoke execute on function public.save_competition(jsonb) from public, anon;
grant execute on function public.save_competition(jsonb) to authenticated;

-- 12) القراءة العامة للمسابقة المنشورة — بلا أي إجابة صحيحة ---------------------
create or replace function public.get_public_competition(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c public.competitions;
  v_state text;
  v_header jsonb;
  v_pages jsonb;
begin
  select * into c from public.competitions where slug = p_slug;
  -- المسودات لا تظهر للعامة إطلاقًا (تبدو كأنها غير موجودة).
  if not found or c.status = 'draft' then
    return jsonb_build_object('state', 'not_found');
  end if;

  v_state := case
    when c.status = 'closed' then 'closed'
    when c.starts_at is not null and now() < c.starts_at then 'not_started'
    when c.ends_at is not null and now() > c.ends_at then 'ended'
    else 'open'
  end;

  v_header := jsonb_build_object(
    'state', v_state,
    'title', c.title,
    'description', c.description,
    'theme', c.theme,
    'target_grade', c.target_grade,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'duration_minutes', c.duration_minutes,
    'show_score', c.show_score
  );

  if v_state <> 'open' then
    return v_header;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'items', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'kind', i.kind,
            'data', i.data,
            'question', case
              when q.id is null then null
              else jsonb_build_object(
                'qtype', q.qtype,
                'prompt', q.prompt,
                'points', q.points,
                'options', case
                  when q.qtype = 'mcq' then (
                    select coalesce(jsonb_agg(
                      jsonb_build_object('id', o.id, 'label', o.label) order by o.position
                    ), '[]'::jsonb)
                    from public.competition_options o
                    where o.question_id = q.id
                  )
                  else null
                end
              )
            end
          ) order by i.position
        ), '[]'::jsonb)
        from public.competition_items i
        left join public.competition_questions q on q.id = i.id
        where i.page_id = p.id
      )
    ) order by p.position
  ), '[]'::jsonb)
  into v_pages
  from public.competition_pages p
  where p.competition_id = c.id;

  return v_header || jsonb_build_object('pages', v_pages);
end;
$$;

revoke execute on function public.get_public_competition(text) from public;
grant execute on function public.get_public_competition(text) to anon, authenticated;

-- 13) تطبيع النص العربي للمقارنة (تشكيل، تطويل، همزات، ياء/ألف مقصورة، تاء مربوطة، أرقام)
create or replace function public.competition_norm_text(t text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
    translate(
      lower(regexp_replace(coalesce(t, ''), '[\u064B-\u0652\u0640]', '', 'g')),
      'أإآىة٠١٢٣٤٥٦٧٨٩',
      'ااايه0123456789'
    ),
    '\s+', ' ', 'g'
  ));
$$;

-- يحوّل نص رقمي (أرقام عربية/لاتينية، فاصلة عشرية، أو كسر a/b) إلى numeric أو NULL.
create or replace function public.competition_parse_number(t text)
returns numeric
language plpgsql
immutable
as $$
declare
  s text;
  a text;
  b text;
begin
  if t is null then
    return null;
  end if;
  s := translate(btrim(t), '٠١٢٣٤٥٦٧٨٩٫,', '0123456789..');
  s := regexp_replace(s, '[\s٬]', '', 'g');
  if s ~ '^-?[0-9]{1,15}(\.[0-9]{1,10})?$' then
    return s::numeric;
  end if;
  if s ~ '^-?[0-9]{1,15}/[0-9]{1,15}$' then
    a := split_part(s, '/', 1);
    b := split_part(s, '/', 2);
    if b::numeric = 0 then
      return null;
    end if;
    return a::numeric / b::numeric;
  end if;
  return null;
end;
$$;

-- 14) الإرسال والتصحيح داخل قاعدة البيانات ------------------------------------
--     p_answers: كائن { "<question_id>": "<القيمة>" } — القيمة: معرّف الخيار (mcq)،
--     "true"/"false" (صح/خطأ)، أو النص المكتوب (رقمي/نصي).
create or replace function public.submit_competition(
  p_slug text,
  p_name text,
  p_grade text,
  p_answers jsonb,
  p_started_at timestamptz default null,
  p_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.competitions;
  q record;
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_grade text := regexp_replace(btrim(coalesce(p_grade, '')), '\s+', ' ', 'g');
  v_key text;
  v_sub uuid := gen_random_uuid();
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_score integer := 0;
  v_max integer := 0;
  v_correct integer := 0;
  v_qcount integer := 0;
  v_duration integer;
  v_timed_out boolean := false;
  v_pos integer := 0;
  v_raw text;
  v_ok boolean;
  v_pts integer;
  v_disp text;
  v_corr text;
  v_num numeric;
  v_token text := nullif(btrim(coalesce(p_token, '')), '');
begin
  select * into c from public.competitions where slug = p_slug;
  if not found or c.status <> 'published' then
    raise exception 'competition_unavailable';
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    raise exception 'competition_not_started';
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    raise exception 'competition_ended';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'invalid_name';
  end if;
  if char_length(v_grade) < 1 or char_length(v_grade) > 40 then
    raise exception 'invalid_grade';
  end if;
  if jsonb_typeof(v_answers) <> 'object' then
    raise exception 'invalid_answers';
  end if;

  v_key := lower(v_name) || '|' || lower(v_grade);

  if not c.allow_retake and exists (
    select 1 from public.competition_submissions s
    where s.competition_id = c.id
      and (s.name_key = v_key or (v_token is not null and s.client_token = v_token))
  ) then
    raise exception 'already_submitted';
  end if;

  if (select count(*) from public.competition_submissions where competition_id = c.id) >= 5000 then
    raise exception 'competition_full';
  end if;

  if p_started_at is not null then
    v_duration := greatest(0, least(86400, extract(epoch from (now() - p_started_at))::integer));
    if c.duration_minutes is not null and v_duration > c.duration_minutes * 60 + 30 then
      v_timed_out := true;
    end if;
  end if;

  insert into public.competition_submissions (
    id, competition_id, participant_name, grade_label, name_key, client_token,
    started_at, duration_seconds, timed_out
  ) values (
    v_sub, c.id, v_name, v_grade, v_key, left(v_token, 80),
    case when p_started_at is null then null else least(p_started_at, now()) end,
    v_duration, v_timed_out
  );

  for q in
    select qq.*
    from public.competition_questions qq
    join public.competition_items i on i.id = qq.id
    join public.competition_pages pg on pg.id = i.page_id
    where qq.competition_id = c.id
    order by pg.position, i.position
  loop
    v_pos := v_pos + 1;
    v_qcount := v_qcount + 1;
    v_max := v_max + q.points;
    v_raw := left(nullif(btrim(coalesce(v_answers ->> q.id::text, '')), ''), 500);
    v_ok := false;
    v_disp := null;
    v_corr := null;

    if q.qtype = 'mcq' then
      select o.label, o.is_correct into v_disp, v_ok
      from public.competition_options o
      where o.question_id = q.id and o.id::text = v_raw;
      v_ok := coalesce(v_ok, false);
      select string_agg(o.label, ' / ' order by o.position) into v_corr
      from public.competition_options o
      where o.question_id = q.id and o.is_correct;

    elsif q.qtype = 'true_false' then
      v_disp := case v_raw when 'true' then 'صح' when 'false' then 'خطأ' else null end;
      v_ok := coalesce(v_raw in ('true', 'false') and q.tf_answer is not null and ((v_raw = 'true') = q.tf_answer), false);
      v_corr := case q.tf_answer when true then 'صح' when false then 'خطأ' else null end;

    elsif q.qtype = 'number' then
      v_disp := v_raw;
      v_num := public.competition_parse_number(v_raw);
      v_ok := coalesce(v_num is not null and q.number_answer is not null
                       and abs(v_num - q.number_answer) <= q.number_tolerance, false);
      v_corr := case when q.number_answer is null then null else trim_scale(q.number_answer)::text end;

    else -- text
      v_disp := v_raw;
      v_ok := coalesce(
        v_raw is not null
        and public.competition_norm_text(v_raw) <> ''
        and exists (
          select 1 from unnest(q.text_answers) a
          where public.competition_norm_text(a) = public.competition_norm_text(v_raw)
        ), false);
      v_corr := array_to_string(q.text_answers, ' / ');
    end if;

    v_pts := case when v_ok then q.points else 0 end;
    v_score := v_score + v_pts;
    if v_ok then
      v_correct := v_correct + 1;
    end if;

    insert into public.competition_answers (
      submission_id, question_id, position, qtype, prompt_snapshot,
      answer_text, correct_text, is_correct, points_awarded, points_possible
    ) values (
      v_sub, q.id, v_pos, q.qtype, q.prompt,
      v_disp, v_corr, v_ok, v_pts, q.points
    );
  end loop;

  update public.competition_submissions
    set score = v_score, max_score = v_max, correct_count = v_correct, question_count = v_qcount
    where id = v_sub;

  if c.show_score then
    return jsonb_build_object('ok', true, 'show_score', true, 'score', v_score, 'max_score', v_max,
                              'correct_count', v_correct, 'question_count', v_qcount);
  end if;
  return jsonb_build_object('ok', true, 'show_score', false);
end;
$$;

revoke execute on function public.submit_competition(text, text, text, jsonb, timestamptz, text) from public;
grant execute on function public.submit_competition(text, text, text, jsonb, timestamptz, text) to anon, authenticated;

-- 15) ملفات الوسائط (صور / فيديو / PDF) في Storage ------------------------------
--     الحاوية خاصة. المسار: <teacher_id>/<competition_id>/<uuid>.<ext>
--     * المعلمة ترفع/تقرأ/تحذف داخل مجلدها فقط.
--     * الزائر يقرأ (عبر رابط موقّع قصير العمر) فقط ملفًا مرتبطًا بمسابقة «منشورة».
--     SVG غير مسموح (يمكن أن يحمل سكربتات). الحد الأقصى 50 م.ب للملف.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'competition-media', 'competition-media', false, 52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.competition_media_is_public(p_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.competition_items i
    join public.competitions c on c.id = i.competition_id
    where c.status = 'published'
      and i.data ->> 'path' = p_path
  );
$$;

drop policy if exists "competition_media_teacher_insert" on storage.objects;
create policy "competition_media_teacher_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'competition-media'
    and public.is_teacher_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "competition_media_teacher_select" on storage.objects;
create policy "competition_media_teacher_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'competition-media'
    and public.is_teacher_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "competition_media_teacher_update" on storage.objects;
create policy "competition_media_teacher_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'competition-media'
    and public.is_teacher_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'competition-media'
    and public.is_teacher_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "competition_media_teacher_delete" on storage.objects;
create policy "competition_media_teacher_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'competition-media'
    and public.is_teacher_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "competition_media_public_published" on storage.objects;
create policy "competition_media_public_published" on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'competition-media'
    and public.competition_media_is_public(name)
  );
