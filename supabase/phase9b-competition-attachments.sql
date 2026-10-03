-- ============================================================================
-- المرحلة 9b — موارد مرفقة بالسؤال نفسه (صورة/فيديو/PDF/رابط)
--
-- تُحفظ الموارد داخل competition_items.data -> 'attachments' (لا أعمدة ولا جداول جديدة).
-- الشيء الوحيد المطلوب في قاعدة البيانات: أن تسمح سياسة قراءة الملفات للزائر بقراءة ملف
-- مرفق بسؤال في مسابقة «منشورة» (كانت تفحص data->>'path' للعنصر نفسه فقط).
-- آمن لإعادة التشغيل. شغّليه بعد phase9-competitions.sql.
-- ============================================================================

create index if not exists competition_items_attachments_idx
  on public.competition_items using gin ((data -> 'attachments') jsonb_path_ops)
  where data ? 'attachments';

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
      and (
        i.data ->> 'path' = p_path
        or i.data -> 'attachments' @> jsonb_build_array(jsonb_build_object('path', p_path))
      )
  );
$$;
