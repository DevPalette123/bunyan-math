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
--     (لا يوجد ما يثبت أن الطالب فعلًا حلّت الورقة، فقط أنها فتحتها).
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
  ('game_master', 'بطل الألعاب الثمان', 'يُمنح عند إكمال الألعاب الثماني كلها مرة واحدة على الأقل', 'games_completed_count', 8),
  ('practice_starter', 'أول تدريب', 'يُمنح عند فتح أول ورقة عمل في «تدرّب»', 'practice_completed_count', 1),
  ('practice_master', 'بطل التدريبات', 'يُمنح عند إتمام التدريبات الثمانية كلها', 'practice_completed_count', 8)
on conflict (code) do nothing;


-- ----------------------------------------------------------------------------
-- (4) تحديث evaluate_and_award_badges (استبدال، وليس نظامًا جديدًا) — يبقى كل
--     شرط قديم كما هو تمامًا، ويُضاف شرطا الألعاب والتدريبات إلى نفس المنطق
--     الموحّد. games_completed_count = عدد الألعاب (game_id) المختلفة التي
--     أكملتها الطالب ولو مرة واحدة، لا عدد محاولاتها الكلي.
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
    raise exception 'أكمل كل الأسئلة أولًا';
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
