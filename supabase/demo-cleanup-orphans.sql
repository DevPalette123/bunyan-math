-- ============================================================================
-- تنظيف مستخدمي التجربة «اليتامى» الذين خلّفتهم محاولات التجهيز الفاشلة (قبل الإصلاح)
--
-- كان فشل التجهيز في منتصفه يترك مستخدمي Auth (معلمة + ٦ طالبات في كل محاولة) دون أن
-- يُسجَّلوا في demo_accounts. الإصلاح الجديد في الدالة يحذف ما ينشئه عند الفشل، أما ما
-- بقي من المحاولات السابقة فهذا الملف لتنظيفه.
--
-- الأمان: لا يلمس إلا مستخدمين وُسموا عند إنشائهم بـ app_metadata.demo = true (لا يضع هذا
-- الوسم إلا الدالة السحابية بمفتاح الخدمة)، وغير المسجّلين في demo_accounts، وغير المرتبطين بصف.
-- حسابات المعلمات والطلاب الحقيقيين لا يحملون هذا الوسم أبدًا.
--
-- الخطوة 1: شغّلي الاستعلام التالي وحده أولًا وراجعي القائمة (يجب أن تكون كلها من التجربة).
-- ============================================================================
select u.id, u.email, u.created_at
from auth.users u
where u.raw_app_meta_data ->> 'demo' = 'true'
  and not exists (select 1 from public.demo_accounts a where a.user_id = u.id)
  and not exists (select 1 from public.students s where s.id = u.id and s.class_id is not null)
order by u.created_at;

-- الخطوة 2: إن كانت القائمة صحيحة فقط، شغّلي الحذف (يتتالى إلى profiles/students/teachers/classes):
-- delete from auth.users u
-- where u.raw_app_meta_data ->> 'demo' = 'true'
--   and not exists (select 1 from public.demo_accounts a where a.user_id = u.id)
--   and not exists (select 1 from public.students s where s.id = u.id and s.class_id is not null);
