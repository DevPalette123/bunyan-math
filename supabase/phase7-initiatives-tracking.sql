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
