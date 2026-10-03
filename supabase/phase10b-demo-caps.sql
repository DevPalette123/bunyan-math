-- ============================================================================
-- اختياري — سقوف موارد لحسابات التجربة فقط (المرحلة 10b)
--
-- لا تشغّلي هذا الملف إلا بعد موافقتكِ الصريحة. هو الجزء الوحيد من وضع التدشين
-- الذي يضيف قيودًا على جداول موجودة (محفّز على competitions + سياسة تقييدية على
-- storage.objects). كلاهما لا يؤثر على الحسابات الحقيقية: is_demo_user() ترجع false
-- فورًا لها، فتمر كل عملياتها كما هي.
--
--   • حدّ أقصى ٥ مسابقات لكل معلمة تجريبية.
--   • حدّ أقصى ٢٠ ملفًا في حاوية competition-media لكل معلمة تجريبية.
--
-- للتراجع الكامل:
--   drop trigger if exists demo_competition_cap on public.competitions;
--   drop function if exists public.demo_competition_cap();
--   drop policy if exists "competition_media_demo_cap" on storage.objects;
--   drop function if exists public.demo_media_count(uuid);
-- ============================================================================

create or replace function public.demo_competition_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_demo_user(new.teacher_id)
     and (select count(*) from public.competitions where teacher_id = new.teacher_id) >= 5 then
    raise exception 'demo_competition_limit';
  end if;
  return new;
end;
$$;
revoke execute on function public.demo_competition_cap() from public, anon, authenticated;

drop trigger if exists demo_competition_cap on public.competitions;
create trigger demo_competition_cap
  before insert on public.competitions
  for each row execute function public.demo_competition_cap();

create or replace function public.demo_media_count(p_user uuid)
returns integer
language sql
security definer
set search_path = public, storage
stable
as $$
  select count(*)::integer from storage.objects
  where bucket_id = 'competition-media' and (storage.foldername(name))[1] = p_user::text;
$$;
revoke execute on function public.demo_media_count(uuid) from public, anon;
grant execute on function public.demo_media_count(uuid) to authenticated;

-- سياسة تقييدية (AND مع السياسات الحالية، لا تستبدلها): تمنع تجاوز السقف لحساب تجريبي فقط.
drop policy if exists "competition_media_demo_cap" on storage.objects;
create policy "competition_media_demo_cap" on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'competition-media'
    or not public.is_demo_user(auth.uid())
    or public.demo_media_count(auth.uid()) < 20
  );
