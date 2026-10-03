-- ============================================================================
-- Migration: لوحة النجوم المرحة (تعزيز الطلاب) — نسخة محدَّثة
-- تضيف ربط كل صف بطالب حقيقي (student_id) حتى يرى كل طالب نجومه هو فقط.
-- انسخي هذا الملف بالكامل وشغّليه مرة واحدة في Supabase SQL Editor.
-- آمن لإعادة التشغيل حتى لو سبق وشغّلتِ النسخة القديمة من هذا الجدول.
-- ============================================================================


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
