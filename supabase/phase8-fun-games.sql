-- ============================================================================
-- المرحلة الثامنة — نتائج ألعاب «ألعب» الجديدة (ثماني ألعاب بفكرة مختلفة لكل مهارة)
-- تُحفَظ في جدول fun_game_results وتظهر للمعلمة في «نتائج الألعاب»، وتُمنح النجوم
-- في رصيد الطالبة (نجوم اللعبة = عدد نجوم النتيجة ١–٣، لأول لعبة في اليوم لكل لعبة
-- فقط حتى لا تُكرَّر اللعبة لجمع النجوم).
--
-- شغّليه مرة واحدة على قاعدتك (SQL Editor) بعد phase7-initiatives-tracking.sql.
-- آمن للتشغيل أكثر من مرة، ولا يحذف أي بيانات موجودة (جداول الألعاب القديمة
-- game_attempts وما يخصها تبقى كما هي).
-- ============================================================================

create table if not exists public.fun_game_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  game_id text not null check (
    game_id in ('addition','subtraction','rounding','doubling','ascending-order','descending-order','comparison','even-odd')
  ),
  stars smallint not null check (stars between 1 and 3),
  mistakes integer not null default 0 check (mistakes >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  points_awarded integer not null default 0,
  played_at timestamptz not null default now()
);

create index if not exists fun_game_results_student_game_idx
  on public.fun_game_results (student_id, game_id, played_at desc);

alter table public.fun_game_results enable row level security;

drop policy if exists "fun_game_results_select_own_student" on public.fun_game_results;
create policy "fun_game_results_select_own_student"
  on public.fun_game_results for select
  using (student_id = auth.uid());

drop policy if exists "fun_game_results_select_own_teacher" on public.fun_game_results;
create policy "fun_game_results_select_own_teacher"
  on public.fun_game_results for select
  using (public.is_teacher_of_student(student_id));

-- لا إدخال مباشر من المتصفح: كل شيء عبر الدالة أدناه.
revoke all on public.fun_game_results from anon, authenticated;
grant select on public.fun_game_results to authenticated;

create or replace function public.record_fun_game_result(
  p_game_id text,
  p_stars integer,
  p_mistakes integer,
  p_duration_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stars integer := greatest(1, least(3, coalesce(p_stars, 1)));
  v_mistakes integer := greatest(0, least(500, coalesce(p_mistakes, 0)));
  v_duration integer := case when p_duration_seconds is null then null else greatest(0, least(7200, p_duration_seconds)) end;
  v_points integer := 0;
begin
  if auth.uid() is null or not exists (select 1 from public.students where id = auth.uid()) then
    raise exception 'not a student';
  end if;

  -- نجوم الرصيد: مرة واحدة لكل لعبة في اليوم.
  if not exists (
    select 1 from public.fun_game_results
    where student_id = auth.uid()
      and game_id = p_game_id
      and played_at >= date_trunc('day', now())
  ) then
    v_points := v_stars;
  end if;

  insert into public.fun_game_results (student_id, game_id, stars, mistakes, duration_seconds, points_awarded)
  values (auth.uid(), p_game_id, v_stars, v_mistakes, v_duration, v_points);

  if v_points > 0 then
    update public.students set stars = stars + v_points where id = auth.uid();
  end if;
  perform public.evaluate_and_award_badges(auth.uid());

  return v_points;
end;
$$;

grant execute on function public.record_fun_game_result(text, integer, integer, integer) to authenticated;
revoke execute on function public.record_fun_game_result(text, integer, integer, integer) from public, anon;

-- شارات: «ألعاب مكتملة» صارت تحسب الألعاب القديمة والجديدة معًا (game_id مختلف لكل لعبة).
-- كل الشروط الأخرى كما هي تمامًا في phase7.
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

  select count(*) into v_games_completed from (
    select game_id from public.game_attempts
      where student_id = target_student_id and status = 'completed'
    union
    select game_id from public.fun_game_results
      where student_id = target_student_id
  ) g;

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
